/**
 * Tests d'intégration du marché sur Postgres. Ignorés si SKIP_DB_TESTS=1.
 */
import { gameConfig } from "@pokeflex/config";
import { auditLedger, prisma } from "@pokeflex/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyLedger } from "./ledger";
import { buyListing, cancelListing, closeAuction, closeDueAuctions, createListing, MarketError, placeBid } from "./market";
import { recycleCopy, RecycleError } from "./recycle";

const skip = process.env.SKIP_DB_TESTS === "1";
const users: string[] = [];
const HOUR = 3_600_000;
let cardId = "";

async function newUser(balance = 0) {
  const u = await prisma.user.create({
    data: { handle: `test-mkt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: "Test", boosterStock: 0, boosterAnchorAt: new Date() },
  });
  users.push(u.id);
  if (balance > 0) await prisma.$transaction((tx) => applyLedger(tx, { userId: u.id, delta: balance, reason: "admin" }));
  return u.id;
}
async function giveCopy(userId: string) {
  const c = await prisma.cardCopy.create({ data: { ownerId: userId, cardId, obtainedVia: "test" } });
  return c.id;
}
const balance = async (id: string) => (await prisma.user.findUniqueOrThrow({ where: { id } })).balance;
async function expectAuditClean() {
  expect((await auditLedger(prisma)).filter((r) => users.includes(r.id))).toEqual([]);
}

describe.skipIf(skip)("marché (Postgres)", () => {
  beforeAll(async () => {
    cardId = (await prisma.card.findFirstOrThrow({ where: { droppable: true }, orderBy: { id: "asc" } })).id;
  });
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: users } } });
  });

  it("met en vente : frais débités, exemplaire bloqué (ni recyclable, ni revendable)", async () => {
    const seller = await newUser(100);
    const copyId = await giveCopy(seller);
    const res = await createListing(seller, { copyId, type: "fixed", price: 200 });
    expect(res.fee).toBe(10);
    expect(await balance(seller)).toBe(90);
    await expect(recycleCopy(seller, copyId)).rejects.toBeInstanceOf(RecycleError);
    await expect(createListing(seller, { copyId, type: "fixed", price: 50 })).rejects.toMatchObject({ code: "not_available" });
    await expectAuditClean();
  });

  it("refuse la mise en vente sans quoi payer les frais, sans rien bloquer", async () => {
    const seller = await newUser(0);
    const copyId = await giveCopy(seller);
    await expect(createListing(seller, { copyId, type: "fixed", price: 100 })).rejects.toMatchObject({ code: "insufficient_funds" });
    expect((await prisma.cardCopy.findUniqueOrThrow({ where: { id: copyId } })).status).toBe("owned");
    expect(await prisma.listing.count({ where: { sellerId: seller } })).toBe(0);
  });

  it("deux achats simultanés : une seule vente, l'exemplaire change de main", async () => {
    const seller = await newUser(20);
    const [a, b] = [await newUser(500), await newUser(500)];
    const copyId = await giveCopy(seller);
    const { listingId } = await createListing(seller, { copyId, type: "fixed", price: 300 });
    const results = await Promise.allSettled([buyListing(a, listingId), buyListing(b, listingId)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((results.find((r) => r.status === "rejected") as PromiseRejectedResult).reason).toMatchObject({ code: "not_available" });
    const copy = await prisma.cardCopy.findUniqueOrThrow({ where: { id: copyId } });
    expect([a, b]).toContain(copy.ownerId);
    expect(copy.status).toBe("owned");
    expect(await balance(seller)).toBe(20 - 15 + 300);
    expect((await balance(a)) + (await balance(b))).toBe(1000 - 300);
    expect(await prisma.sale.count({ where: { listingId } })).toBe(1);
    await expectAuditClean();
  });

  it("refuse l'achat de sa propre annonce et l'achat sans assez de Jetons", async () => {
    const seller = await newUser(10);
    const poor = await newUser(5);
    const { listingId } = await createListing(seller, { copyId: await giveCopy(seller), type: "fixed", price: 50 });
    await expect(buyListing(seller, listingId)).rejects.toMatchObject({ code: "own_listing" });
    await expect(buyListing(poor, listingId)).rejects.toMatchObject({ code: "insufficient_funds" });
    expect(await balance(poor)).toBe(5);
  });

  it("enchères : réservation, libération du surenchéri, clôture au meilleur enchérisseur", async () => {
    const now = new Date();
    const seller = await newUser(10);
    const [a, b] = [await newUser(200), await newUser(200)];
    const copyId = await giveCopy(seller);
    const { listingId } = await createListing(seller, { copyId, type: "auction", price: 40, durationMs: HOUR }, now);
    await expect(placeBid(a, listingId, 39, now)).rejects.toMatchObject({ code: "bid_too_low" });
    await placeBid(a, listingId, 50, now);
    expect(await balance(a)).toBe(150);
    await expect(placeBid(b, listingId, 51, now)).rejects.toMatchObject({ code: "bid_too_low" }); // +5 % minimum → 53
    await placeBid(b, listingId, 60, now);
    expect(await balance(a)).toBe(200);
    expect(await balance(b)).toBe(140);
    await expect(cancelListing(seller, listingId)).rejects.toMatchObject({ code: "has_bids" });
    expect(await closeAuction(listingId, now)).toBeNull(); // pas encore échue
    const later = new Date(now.getTime() + HOUR + 1000);
    await expect(placeBid(a, listingId, 100, later)).rejects.toMatchObject({ code: "ended" });
    expect(await closeAuction(listingId, later)).toMatchObject({ status: "sold", buyerId: b, price: 60 });
    expect(await closeAuction(listingId, later)).toBeNull(); // idempotent
    expect((await prisma.cardCopy.findUniqueOrThrow({ where: { id: copyId } })).ownerId).toBe(b);
    expect(await balance(b)).toBe(140);
    expect(await balance(seller)).toBe(10 - 2 + 60);
    await expectAuditClean();
  });

  it("des enchères simultanées au même montant : une seule est retenue", async () => {
    const seller = await newUser(10);
    const bidders = await Promise.all(Array.from({ length: 5 }, () => newUser(300)));
    const { listingId } = await createListing(seller, { copyId: await giveCopy(seller), type: "auction", price: 100, durationMs: HOUR });
    const results = await Promise.allSettled(bidders.map((u) => placeBid(u, listingId, 100)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    for (const r of results) if (r.status === "rejected") expect(r.reason).toBeInstanceOf(MarketError);
    const total = (await Promise.all(bidders.map(balance))).reduce((n, x) => n + x, 0);
    expect(total).toBe(5 * 300 - 100);
    await expectAuditClean();
  });

  it("prolonge une enchère placée dans la dernière minute", async () => {
    const now = new Date();
    const seller = await newUser(10);
    const a = await newUser(100);
    const { listingId } = await createListing(seller, { copyId: await giveCopy(seller), type: "auction", price: 10, durationMs: HOUR }, now);
    const late = new Date(now.getTime() + HOUR - 20_000);
    const res = await placeBid(a, listingId, 10, late);
    expect(res.extended).toBe(true);
    expect(new Date(res.endsAt).getTime()).toBe(late.getTime() + gameConfig.market.antiSnipingWindowMs);
  });

  it("une enchère sans offre expire et rend l'exemplaire ; un prix fixe se retire", async () => {
    const now = new Date();
    const seller = await newUser(20);
    const copyA = await giveCopy(seller);
    const copyB = await giveCopy(seller);
    const auction = await createListing(seller, { copyId: copyA, type: "auction", price: 10, durationMs: HOUR }, now);
    const fixed = await createListing(seller, { copyId: copyB, type: "fixed", price: 10 });
    expect(await closeDueAuctions(new Date(now.getTime() + 2 * HOUR))).toBeGreaterThanOrEqual(1);
    expect((await prisma.listing.findUniqueOrThrow({ where: { id: auction.listingId } })).status).toBe("expired");
    expect((await prisma.cardCopy.findUniqueOrThrow({ where: { id: copyA } })).status).toBe("owned");
    await cancelListing(seller, fixed.listingId);
    expect((await prisma.cardCopy.findUniqueOrThrow({ where: { id: copyB } })).status).toBe("owned");
    // L'exemplaire retiré peut être remis en vente.
    await createListing(seller, { copyId: copyB, type: "fixed", price: 12 });
  });

  it("limite le nombre d'annonces actives", async () => {
    const seller = await newUser(1000);
    const max = gameConfig.market.maxActiveListingsPerUser;
    for (let i = 0; i < max; i++) await createListing(seller, { copyId: await giveCopy(seller), type: "fixed", price: 1 });
    await expect(createListing(seller, { copyId: await giveCopy(seller), type: "fixed", price: 1 })).rejects.toMatchObject({ code: "too_many" });
  });

  it("refuse les prix et durées invalides", async () => {
    const seller = await newUser(100);
    const copyId = await giveCopy(seller);
    await expect(createListing(seller, { copyId, type: "fixed", price: 0 })).rejects.toMatchObject({ code: "invalid" });
    await expect(createListing(seller, { copyId, type: "fixed", price: 2.5 })).rejects.toMatchObject({ code: "invalid" });
    await expect(createListing(seller, { copyId, type: "auction", price: 5, durationMs: 1234 })).rejects.toMatchObject({ code: "invalid" });
  });
});
