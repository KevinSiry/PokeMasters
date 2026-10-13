/**
 * Tests d'intégration des favoris et de la wishlist sur Postgres. Ignorés si SKIP_DB_TESTS=1.
 */
import { prisma } from "@pokeflex/db";
import { seededRng } from "@pokeflex/game";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  countWishers,
  getCardListState,
  getFavorites,
  getOwnedCopyCounts,
  getProfileWishlist,
  getWishlist,
  ListError,
  setFavorite,
  setWishlisted,
  wishlistAlertForListing,
} from "./lists";
import { openFreeBooster } from "./boosters";
import { buyListing, createListing, getMarketListings } from "./market";
import { previewDuplicates, recycleDuplicates } from "./recycle";

const skip = process.env.SKIP_DB_TESTS === "1";
const users: string[] = [];
let cardIds: string[] = [];

async function newUser(balance = 0) {
  const u = await prisma.user.create({
    data: { handle: `t-lst-${Math.random().toString(36).slice(2, 10)}`, name: "Test", boosterStock: 0, boosterAnchorAt: new Date() },
  });
  users.push(u.id);
  if (balance > 0) {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: u.id }, data: { balance } });
      await tx.ledgerEntry.create({ data: { userId: u.id, delta: balance, balanceAfter: balance, reason: "admin" } });
    });
  }
  return u.id;
}

async function give(userId: string, cardId: string, n = 1) {
  const created = [];
  for (let i = 0; i < n; i++) {
    created.push(await prisma.cardCopy.create({ data: { ownerId: userId, cardId, obtainedVia: "seed" } }));
  }
  return created;
}

const code = async (p: Promise<unknown>) => {
  try {
    await p;
    return null;
  } catch (e) {
    return e instanceof ListError ? e.code : String(e);
  }
};

describe.skipIf(skip)("favoris et wishlist (Postgres)", () => {
  beforeAll(async () => {
    cardIds = (
      await prisma.card.findMany({ where: { droppable: true, image: { not: null } }, orderBy: { id: "asc" }, take: 4, select: { id: true } })
    ).map((c) => c.id);
  });
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: users } } });
  });

  it("n'accepte en favori qu'une carte possédée, et la retire", async () => {
    const a = await newUser();
    expect(await code(setFavorite(a, cardIds[0]!, true))).toBe("not_owned");
    expect(await code(setFavorite(a, "carte-inexistante", true))).toBe("not_found");
    await give(a, cardIds[0]!);
    expect(await setFavorite(a, cardIds[0]!, true)).toEqual({ favorite: true });
    expect(await setFavorite(a, cardIds[0]!, true)).toEqual({ favorite: true });
    expect((await getFavorites(a)).map((c) => [c.id, c.copies])).toEqual([[cardIds[0], 1]]);
    expect(await getCardListState(a, cardIds[0]!)).toEqual({ favorite: true, wished: false });
    await setFavorite(a, cardIds[0]!, false);
    expect(await getFavorites(a)).toEqual([]);
  });

  it("épargne les favoris quand on recycle les doublons", async () => {
    const a = await newUser();
    await give(a, cardIds[0]!, 3);
    await give(a, cardIds[1]!, 2);
    await setFavorite(a, cardIds[0]!, true);
    const preview = await previewDuplicates(a);
    expect(preview.reduce((n, t) => n + t.count, 0)).toBe(1);
    const res = await recycleDuplicates(a, ["common", "uncommon", "rare", "epic", "legendary", "mythic"]);
    expect(res.count).toBe(1);
    expect(await prisma.cardCopy.count({ where: { ownerId: a, cardId: cardIds[0]! } })).toBe(3);
    expect(await prisma.cardCopy.count({ where: { ownerId: a, cardId: cardIds[1]! } })).toBe(1);
  });

  it("tient la wishlist, montre les cartes en vente et filtre le marché", async () => {
    const buyer = await newUser();
    const seller = await newUser(1000);
    await setWishlisted(buyer, cardIds[2]!, true);
    await setWishlisted(buyer, cardIds[3]!, true);
    expect(await code(setWishlisted(buyer, "carte-inexistante", true))).toBe("not_found");
    const [copy] = await give(seller, cardIds[2]!);
    const { listingId } = await createListing(seller, { copyId: copy!.id, type: "fixed", price: 40 });

    const list = await getWishlist(buyer);
    expect(list.map((c) => c.id).sort()).toEqual([cardIds[2], cardIds[3]].sort());
    // D'autres annonces de cette carte peuvent exister (annonces de démo du seed).
    const others = await prisma.listing.findMany({ where: { cardId: cardIds[2]!, status: "active", sellerId: { not: buyer } }, select: { price: true, currentBid: true } });
    const onSale = list.find((c) => c.id === cardIds[2])!;
    expect(onSale).toMatchObject({ onSale: others.length, lowestPrice: Math.min(...others.map((l) => l.currentBid ?? l.price)) });
    expect(onSale.onSale).toBeGreaterThanOrEqual(1);

    const market = await getMarketListings({ cardIds: [cardIds[2]!, cardIds[3]!], perPage: 100 });
    expect(market.listings.map((l) => l.id)).toContain(listingId);
    expect(market.listings.every((l) => l.card.id === cardIds[2] || l.card.id === cardIds[3])).toBe(true);
    expect((await getMarketListings({ cardIds: [] })).total).toBe(0);

    expect(await countWishers(cardIds[2]!)).toBeGreaterThanOrEqual(1);
    const profile = await getProfileWishlist(buyer, null);
    expect(profile?.total).toBe(2);

    await setWishlisted(buyer, cardIds[3]!, false);
    expect((await getWishlist(buyer)).map((c) => c.id)).toEqual([cardIds[2]]);
  });

  it("retire de la wishlist une carte obtenue, et refuse une carte déjà possédée", async () => {
    const buyer = await newUser(1000);
    const seller = await newUser(1000);
    await setWishlisted(buyer, cardIds[3]!, true);
    const [copy] = await give(seller, cardIds[3]!);
    const { listingId } = await createListing(seller, { copyId: copy!.id, type: "fixed", price: 30 });
    await buyListing(buyer, listingId);
    expect(await getCardListState(buyer, cardIds[3]!)).toEqual({ favorite: false, wished: false });
    expect(await code(setWishlisted(buyer, cardIds[3]!, true))).toBe("owned");
  });

  it("retire de la wishlist les cartes tirées dans un booster", async () => {
    // Même graine, même tirage : le premier joueur révèle les cartes que le second va tirer.
    const [scout, fan] = [await newUser(), await newUser()];
    await prisma.user.updateMany({ where: { id: { in: [scout, fan] } }, data: { boosterStock: 1, boosterAnchorAt: new Date() } });
    const pulled = (await openFreeBooster(scout, seededRng(7))).cards.map((c) => c.id);
    for (const id of new Set(pulled)) await setWishlisted(fan, id, true);
    await openFreeBooster(fan, seededRng(7));
    expect(await getWishlist(fan)).toEqual([]);
  });

  it("compte les exemplaires possédés par carte, en vente compris", async () => {
    const seller = await newUser();
    const [a] = await give(seller, cardIds[0]!, 2);
    await give(seller, cardIds[1]!);
    await createListing(seller, { copyId: a!.id, type: "fixed", price: 50 });
    const counts = await getOwnedCopyCounts(seller, [cardIds[0]!, cardIds[1]!, cardIds[2]!, cardIds[0]!]);
    expect(counts.get(cardIds[0]!)).toBe(2);
    expect(counts.get(cardIds[1]!)).toBe(1);
    expect(counts.has(cardIds[2]!)).toBe(false);
    expect((await getOwnedCopyCounts(seller, [])).size).toBe(0);
  });

  it("alerte les joueurs qui recherchent la carte, sauf blocage, et seulement à la demande du vendeur", async () => {
    const seller = await newUser(1000);
    const fan = await newUser();
    const blocked = await newUser();
    await setWishlisted(fan, cardIds[1]!, true);
    await setWishlisted(blocked, cardIds[1]!, true);
    await setWishlisted(seller, cardIds[1]!, true);
    await prisma.block.create({ data: { userId: blocked, blockedId: seller } });
    const [copy] = await give(seller, cardIds[1]!);
    const { listingId } = await createListing(seller, { copyId: copy!.id, type: "auction", price: 10, durationMs: 3_600_000 });

    const alert = await wishlistAlertForListing(seller, listingId);
    expect(alert?.recipients).toEqual([fan]);
    expect(alert?.listing).toMatchObject({ id: listingId, cardId: cardIds[1], type: "auction", price: 10 });
    expect(await wishlistAlertForListing(fan, listingId)).toBeNull();
    expect(await wishlistAlertForListing(seller, listingId, new Date(Date.now() + 60 * 60_000))).toBeNull();
  });
});
