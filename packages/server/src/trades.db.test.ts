/**
 * Tests d'intégration des échanges sur Postgres. Ignorés si SKIP_DB_TESTS=1.
 */
import { gameConfig, type Finish } from "@pokeflex/config";
import { prisma } from "@pokeflex/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setFavorite, setWishlisted } from "./lists";
import { createListing } from "./market";
import { blockUser } from "./social";
import {
  acceptTrade,
  cancelTrade,
  countPendingTrades,
  declineTrade,
  getCardTraders,
  getTradeComposer,
  getTrades,
  getTradeSuggestions,
  proposeTrade,
  TradeError,
  tradeNoticeFor,
} from "./trades";

const skip = process.env.SKIP_DB_TESTS === "1";
const users: string[] = [];
let cardIds: string[] = [];

async function newUser(balance = 0) {
  const u = await prisma.user.create({
    data: { handle: `t-trd-${Math.random().toString(36).slice(2, 10)}`, name: "Test", boosterStock: 0, boosterAnchorAt: new Date() },
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

async function give(userId: string, cardId: string, finish: Finish = "normal") {
  return prisma.cardCopy.create({ data: { ownerId: userId, cardId, finish, obtainedVia: "seed" } });
}

const code = async (p: Promise<unknown>) => {
  try {
    await p;
    return null;
  } catch (e) {
    return e instanceof TradeError ? e.code : String(e);
  }
};

describe.skipIf(skip)("échanges (Postgres)", () => {
  beforeAll(async () => {
    cardIds = (
      await prisma.card.findMany({ where: { droppable: true, image: { not: null } }, orderBy: { id: "asc" }, take: 4, select: { id: true } })
    ).map((c) => c.id);
  });
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: users } } });
  });

  it("échange deux exemplaires en gardant leur finition, et retire les cartes reçues des wishlists", async () => {
    const [a, b] = [await newUser(), await newUser()];
    const ca = await give(a, cardIds[0]!, "holo");
    const cb = await give(b, cardIds[1]!, "reverse");
    await setWishlisted(a, cardIds[1]!, true);
    await setWishlisted(b, cardIds[0]!, true);

    const { tradeId } = await proposeTrade(a, { to: b, give: [ca.id], take: [cb.id], message: "  Salut ! " });
    expect(await countPendingTrades(b)).toBe(1);
    const inbox = await getTrades(b);
    expect(inbox.received).toHaveLength(1);
    expect(inbox.received[0]!.message).toBe("Salut !");
    expect(inbox.received[0]!.receive.map((i) => [i.cardId, i.finish, i.available])).toEqual([[cardIds[0], "holo", true]]);
    expect(inbox.received[0]!.give.map((i) => i.cardId)).toEqual([cardIds[1]]);
    expect((await getTrades(a)).sent).toHaveLength(1);

    const res = await acceptTrade(b, tradeId);
    expect(res.received).toBe(1);
    const [na, nb] = await Promise.all([prisma.cardCopy.findUniqueOrThrow({ where: { id: ca.id } }), prisma.cardCopy.findUniqueOrThrow({ where: { id: cb.id } })]);
    expect([na.ownerId, na.finish, na.obtainedVia]).toEqual([b, "holo", "trade"]);
    expect([nb.ownerId, nb.finish, nb.obtainedVia]).toEqual([a, "reverse", "trade"]);
    expect(await prisma.wishlistCard.count({ where: { userId: { in: [a, b] } } })).toBe(0);
    expect((await prisma.trade.findUniqueOrThrow({ where: { id: tradeId } })).status).toBe("accepted");
    expect(await countPendingTrades(b)).toBe(0);
    expect((await getTrades(a)).history[0]!.status).toBe("accepted");
    // On ne répond pas deux fois.
    expect(await code(acceptTrade(b, tradeId))).toBe("closed");
  });

  it("refuse les offres mal formées ou portant sur des exemplaires indisponibles", async () => {
    const [a, b] = [await newUser(), await newUser()];
    const ca = await give(a, cardIds[0]!);
    const cb = await give(b, cardIds[1]!);
    expect(await code(proposeTrade(a, { to: b, give: [], take: [cb.id] }))).toBe("invalid");
    expect(await code(proposeTrade(a, { to: a, give: [ca.id], take: [cb.id] }))).toBe("self");
    // Exemplaires inversés : on ne donne pas la carte d'un autre.
    expect(await code(proposeTrade(a, { to: b, give: [cb.id], take: [ca.id] }))).toBe("not_available");
    // Exemplaire en vente.
    await prisma.cardCopy.update({ where: { id: ca.id }, data: { status: "listed" } });
    expect(await code(proposeTrade(a, { to: b, give: [ca.id], take: [cb.id] }))).toBe("not_available");
  });

  it("protège les favoris des deux côtés", async () => {
    const [a, b] = [await newUser(), await newUser()];
    const ca = await give(a, cardIds[0]!);
    const cb = await give(b, cardIds[1]!);
    await setFavorite(a, cardIds[0]!, true);
    expect(await code(proposeTrade(a, { to: b, give: [ca.id], take: [cb.id] }))).toBe("favorite");
    await setFavorite(a, cardIds[0]!, false);

    const { tradeId } = await proposeTrade(a, { to: b, give: [ca.id], take: [cb.id] });
    await setFavorite(b, cardIds[1]!, true);
    expect(await code(acceptTrade(b, tradeId))).toBe("favorite");
    // Les favoris n'apparaissent pas parmi les cartes échangeables.
    expect((await getTradeComposer(a, b)).theirs).toEqual([]);
    await setFavorite(b, cardIds[1]!, false);
    await acceptTrade(b, tradeId);
  });

  it("annule l'échange sans rien transférer si une carte n'est plus disponible", async () => {
    const [a, b] = [await newUser(200), await newUser()];
    const ca = await give(a, cardIds[0]!);
    const ca2 = await give(a, cardIds[2]!);
    const cb = await give(b, cardIds[1]!);
    const { tradeId } = await proposeTrade(a, { to: b, give: [ca.id, ca2.id], take: [cb.id] });
    await createListing(a, { copyId: ca2.id, type: "fixed", price: 50 });
    expect((await getTrades(b)).received[0]!.receive.find((i) => i.cardId === cardIds[2])!.available).toBe(false);

    expect(await code(acceptTrade(b, tradeId))).toBe("unavailable");
    expect((await prisma.trade.findUniqueOrThrow({ where: { id: tradeId } })).status).toBe("unavailable");
    expect((await prisma.cardCopy.findUniqueOrThrow({ where: { id: ca.id } })).ownerId).toBe(a);
    expect((await prisma.cardCopy.findUniqueOrThrow({ where: { id: cb.id } })).ownerId).toBe(b);
  });

  it("ne transfère un exemplaire qu'une fois quand deux offres le visent en même temps", async () => {
    const [a, b, c] = [await newUser(), await newUser(), await newUser()];
    const cb = await give(b, cardIds[1]!);
    const ca = await give(a, cardIds[0]!);
    const cc = await give(c, cardIds[2]!);
    const t1 = await proposeTrade(a, { to: b, give: [ca.id], take: [cb.id] });
    const t2 = await proposeTrade(c, { to: b, give: [cc.id], take: [cb.id] });
    const results = await Promise.allSettled([acceptTrade(b, t1.tradeId), acceptTrade(b, t2.tradeId)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const owner = (await prisma.cardCopy.findUniqueOrThrow({ where: { id: cb.id } })).ownerId;
    expect([a, c]).toContain(owner);
    const statuses = (await prisma.trade.findMany({ where: { id: { in: [t1.tradeId, t2.tradeId] } } })).map((t) => t.status).sort();
    expect(statuses).toEqual(["accepted", "unavailable"]);
  });

  it("gère refus, annulation, contre-proposition et expiration", async () => {
    const [a, b] = [await newUser(), await newUser()];
    const ca = await give(a, cardIds[0]!);
    const cb = await give(b, cardIds[1]!);
    const cb2 = await give(b, cardIds[2]!);

    const t1 = await proposeTrade(a, { to: b, give: [ca.id], take: [cb.id] });
    expect(await code(declineTrade(a, t1.tradeId))).toBe("closed");
    expect(await code(cancelTrade(b, t1.tradeId))).toBe("closed");
    await declineTrade(b, t1.tradeId);
    expect((await prisma.trade.findUniqueOrThrow({ where: { id: t1.tradeId } })).status).toBe("declined");

    const t2 = await proposeTrade(a, { to: b, give: [ca.id], take: [cb.id] });
    await cancelTrade(a, t2.tradeId);
    expect((await prisma.trade.findUniqueOrThrow({ where: { id: t2.tradeId } })).status).toBe("cancelled");

    // Contre-proposition : b demande la même carte mais donne une autre des siennes.
    const t3 = await proposeTrade(a, { to: b, give: [ca.id], take: [cb.id] });
    const counter = await proposeTrade(b, { to: a, give: [cb2.id], take: [ca.id], counterOf: t3.tradeId });
    expect((await prisma.trade.findUniqueOrThrow({ where: { id: t3.tradeId } })).status).toBe("countered");
    expect((await getTrades(a)).received[0]!.isCounter).toBe(true);
    expect(await code(proposeTrade(b, { to: a, give: [cb2.id], take: [ca.id], counterOf: t3.tradeId }))).toBe("closed");
    expect((await tradeNoticeFor(b, counter.tradeId))?.payload.kind).toBe("counter");
    expect(await tradeNoticeFor(a, counter.tradeId)).toBeNull();

    // Expiration paresseuse.
    const later = new Date(Date.now() + gameConfig.trades.offerTtlMs + 1000);
    expect(await code(acceptTrade(a, counter.tradeId, later))).toBe("closed");
    await getTrades(a, later);
    expect((await prisma.trade.findUniqueOrThrow({ where: { id: counter.tradeId } })).status).toBe("expired");
  });

  it("bloque les échanges entre joueurs qui se sont bloqués", async () => {
    const [a, b] = [await newUser(), await newUser()];
    const ca = await give(a, cardIds[0]!);
    const cb = await give(b, cardIds[1]!);
    const { tradeId } = await proposeTrade(a, { to: b, give: [ca.id], take: [cb.id] });
    await blockUser(b, a);
    expect(await code(acceptTrade(b, tradeId))).toBe("blocked");
    expect(await code(proposeTrade(a, { to: b, give: [ca.id], take: [cb.id] }))).toBe("blocked");
    expect(await code(getTradeComposer(a, b))).toBe("blocked");
    expect((await getCardTraders(cardIds[1]!, a, 100)).some((p) => p.id === b)).toBe(false);
  });

  it("propose des partenaires qui ont des cartes de la wishlist, et liste les exemplaires échangeables", async () => {
    const [a, b] = [await newUser(), await newUser()];
    await give(b, cardIds[1]!, "normal");
    await give(b, cardIds[1]!, "normal");
    await give(b, cardIds[1]!, "holo");
    await give(b, cardIds[3]!);
    await give(a, cardIds[0]!);
    await setWishlisted(a, cardIds[1]!, true);

    const suggestions = await getTradeSuggestions(a, 50);
    const mine = suggestions.find((s) => s.player.id === b);
    expect(mine?.matches).toBe(1);
    expect(mine?.cards.map((c) => c.id)).toEqual([cardIds[1]]);
    expect((await getCardTraders(cardIds[1]!, a, 100)).find((p) => p.id === b)?.copies).toBe(3);

    const composer = await getTradeComposer(a, b);
    // La carte recherchée vient en premier, une ligne par finition.
    expect(composer.theirs[0]!.wished).toBe(true);
    expect(composer.theirs.filter((g) => g.cardId === cardIds[1]).map((g) => [g.finish, g.count, g.isNew]).sort()).toEqual([
      ["holo", 1, true],
      ["normal", 2, true],
    ]);
    expect(composer.mine.map((g) => g.cardId)).toEqual([cardIds[0]]);
  });

  it("limite le nombre de propositions en attente", async () => {
    const [a, b] = [await newUser(), await newUser()];
    const ca = await give(a, cardIds[0]!);
    const cb = await give(b, cardIds[1]!);
    const now = new Date();
    await prisma.trade.createMany({
      data: Array.from({ length: gameConfig.trades.maxPendingOutgoing }, () => ({ proposerId: a, recipientId: b, expiresAt: new Date(now.getTime() + 60_000) })),
    });
    expect(await code(proposeTrade(a, { to: b, give: [ca.id], take: [cb.id] }, now))).toBe("too_many");
  });
});
