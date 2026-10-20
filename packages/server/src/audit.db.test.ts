/**
 * Anomalies relevées par l'audit fonctionnel (2026-10-20) : chaque test reproduit un défaut corrigé.
 * Tests d'intégration sur Postgres, ignorés si SKIP_DB_TESTS=1.
 */
import { gameConfig } from "@pokeflex/config";
import { prisma } from "@pokeflex/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BoosterError, cachedSetPoolCount, openBooster } from "./boosters";
import { applyLedger } from "./ledger";
import { ListError, setWishlisted } from "./lists";
import { createListing, getMarketListings, placeBid } from "./market";
import { blockUser, getGuildSummary, reportUser, respondFriendRequest, sendFriendRequest, SocialError } from "./social";
import { acceptTrade, getTrades, proposeTrade, TradeError } from "./trades";

const skip = process.env.SKIP_DB_TESTS === "1";
const users: string[] = [];
const HOUR = 3_600_000;

async function newUser(balance = 0) {
  const u = await prisma.user.create({
    data: { handle: `t-audit-${Math.random().toString(36).slice(2, 10)}`, name: "Test", boosterStock: 0, boosterAnchorAt: new Date() },
  });
  users.push(u.id);
  if (balance > 0) await prisma.$transaction((tx) => applyLedger(tx, { userId: u.id, delta: balance, reason: "admin" }));
  return u;
}

const errorCode = async (p: Promise<unknown>) => {
  try {
    await p;
    return null;
  } catch (e) {
    return e instanceof SocialError || e instanceof TradeError || e instanceof ListError || e instanceof BoosterError ? e.code : String(e);
  }
};

describe.skipIf(skip)("audit fonctionnel (Postgres)", () => {
  let cardIds: string[] = [];

  beforeAll(async () => {
    // Cartes que personne ne vend : les tests du marché ne voient que leurs propres annonces.
    cardIds = (
      await prisma.card.findMany({ where: { droppable: true, listings: { none: {} } }, orderBy: { id: "desc" }, take: 3, select: { id: true } })
    ).map((c) => c.id);
  });
  afterAll(async () => {
    await prisma.guild.deleteMany({ where: { ownerId: { in: users } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
  });

  describe("marché", () => {
    it("trie « prix croissant » sur le prix affiché : l'offre courante d'une enchère, pas son prix de départ", async () => {
      const [seller, bidder] = [await newUser(1000), await newUser(1000)];
      const copy = (cardId: string) => prisma.cardCopy.create({ data: { ownerId: seller.id, cardId, obtainedVia: "test" } });
      const auction = await createListing(seller.id, { copyId: (await copy(cardIds[0]!)).id, type: "auction", price: 10, durationMs: HOUR });
      await placeBid(bidder.id, auction.listingId, 500);
      const fixed = await createListing(seller.id, { copyId: (await copy(cardIds[1]!)).id, type: "fixed", price: 100 });

      const asc = await getMarketListings({ cardIds: cardIds.slice(0, 2), sort: "price_asc" });
      expect(asc.listings.map((l) => l.id)).toEqual([fixed.listingId, auction.listingId]);
      const desc = await getMarketListings({ cardIds: cardIds.slice(0, 2), sort: "price_desc" });
      expect(desc.listings.map((l) => l.id)).toEqual([auction.listingId, fixed.listingId]);
    });

    it("pagine sans doublon ni oubli quand plusieurs annonces sont à égalité, et borne la page demandée", async () => {
      const seller = await newUser(1000);
      const ids: string[] = [];
      for (let i = 0; i < 5; i++) {
        const c = await prisma.cardCopy.create({ data: { ownerId: seller.id, cardId: cardIds[2]!, obtainedVia: "test" } });
        ids.push((await createListing(seller.id, { copyId: c.id, type: "fixed", price: 42 })).listingId);
      }
      // Toutes les annonces ont le même prix et pas d'échéance : seul le départage par id rend l'ordre stable.
      await prisma.listing.updateMany({ where: { id: { in: ids } }, data: { createdAt: new Date("2026-01-01T00:00:00Z") } });
      for (const sort of ["price_asc", "ending", "recent"] as const) {
        const seen: string[] = [];
        for (let page = 1; page <= 3; page++) {
          seen.push(...(await getMarketListings({ cardIds: [cardIds[2]!], sort, page, perPage: 2 })).listings.map((l) => l.id));
        }
        expect(seen.sort(), sort).toEqual([...ids].sort());
      }

      // Page décimale (?page=2.5) : Prisma refusait un `skip` non entier et la page plantait.
      const decimal = await getMarketListings({ cardIds: [cardIds[2]!], page: 2.5, perPage: 2 });
      expect(decimal.page).toBe(2);
      // Au-delà de la dernière page : on montre la dernière plutôt qu'une page vide.
      const beyond = await getMarketListings({ cardIds: [cardIds[2]!], page: 999, perPage: 2 });
      expect(beyond).toMatchObject({ page: 3, pages: 3 });
      expect(beyond.listings).toHaveLength(1);
      expect((await getMarketListings({ cardIds: [cardIds[2]!], page: Number.NaN })).page).toBe(1);
    });
  });

  describe("amis", () => {
    it("n'accepte pas une demande d'ami qui ferait dépasser le plafond, d'un côté comme de l'autre", async () => {
      const max = gameConfig.social.maxFriends;
      const [full, asker] = [await newUser(), await newUser()];
      const fillers = Array.from({ length: max }, (_, i) => `t-audit-fill-${full.id}-${i}`);
      await prisma.user.createMany({ data: fillers.map((id) => ({ id, name: "Ami", boosterAnchorAt: new Date() })) });
      users.push(...fillers);
      await prisma.friendship.createMany({ data: fillers.map((friendId) => ({ userId: full.id, friendId, status: "accepted" as const })) });

      // Le joueur au plafond reçoit une demande et l'accepte : 201 amis avant le correctif.
      await sendFriendRequest(asker.id, full.handle!);
      expect(await errorCode(respondFriendRequest(full.id, asker.id, true))).toBe("too_many");
      // Demande croisée : l'autre joueur est au plafond, l'acceptation automatique est refusée aussi.
      const other = await newUser();
      await prisma.friendship.create({ data: { userId: full.id, friendId: other.id, status: "pending" } });
      expect(await errorCode(sendFriendRequest(other.id, full.handle!))).toBe("too_many");
      expect(await prisma.friendship.count({ where: { userId: full.id, status: "accepted" } })).toBe(max);
    });
  });

  describe("blocages", () => {
    it("bloquer un joueur annule les offres d'échange en attente entre vous", async () => {
      const [a, b] = [await newUser(), await newUser()];
      const ca = await prisma.cardCopy.create({ data: { ownerId: a.id, cardId: cardIds[0]!, obtainedVia: "test" } });
      const cb = await prisma.cardCopy.create({ data: { ownerId: b.id, cardId: cardIds[1]!, obtainedVia: "test" } });
      const { tradeId } = await proposeTrade(a.id, { to: b.id, give: [ca.id], take: [cb.id] });

      await blockUser(b.id, a.id);
      // Avant : l'offre restait « en attente » chez les deux joueurs, comptait dans les 20 offres de A et
      // ne pouvait plus être acceptée (« blocked ») ; elle ne quittait la page qu'à son expiration, 7 jours plus tard.
      expect((await getTrades(a.id)).sent).toHaveLength(0);
      expect((await getTrades(b.id)).received).toHaveLength(0);
      expect((await prisma.trade.findUniqueOrThrow({ where: { id: tradeId } })).status).toBe("cancelled");
      expect(await errorCode(acceptTrade(b.id, tradeId))).toBe("closed");
    });
  });

  describe("signalements", () => {
    it("refuse un joueur inconnu et un motif hérité de l'objet (« constructor »)", async () => {
      const a = await newUser();
      // Avant : clé étrangère violée, l'action renvoyait une erreur générique.
      expect(await errorCode(reportUser(a.id, "joueur-inexistant", "spam"))).toBe("not_found");
      const b = await newUser();
      // Avant : `"constructor" in REPORT_REASONS` est vrai, le motif était enregistré.
      expect(await errorCode(reportUser(a.id, b.id, "constructor"))).toBe("invalid");
      expect(await prisma.report.count({ where: { reporterId: a.id } })).toBe(0);
    });
  });

  describe("wishlist", () => {
    it("refuse une carte masquée du catalogue (sans image, jamais tirée)", async () => {
      const model = await prisma.card.findFirstOrThrow({ where: { droppable: true } });
      const hidden = await prisma.card.create({
        data: {
          id: `audit-masquee-${Math.random().toString(36).slice(2, 10)}`,
          setId: model.setId,
          localId: "999",
          sortKey: 9999,
          name: "Carte masquée",
          lang: "fr",
          category: "pokemon",
          tier: "common",
          tierReason: "rarity",
          droppable: false,
          syncedAt: new Date(),
        },
      });
      try {
        const a = await newUser();
        expect(await errorCode(setWishlisted(a.id, hidden.id, true))).toBe("not_found");
      } finally {
        await prisma.card.delete({ where: { id: hidden.id } });
      }
    });
  });

  describe("boosters de set", () => {
    it("ne garde pas en mémoire le pool d'un set inventé", async () => {
      const a = await newUser(1000);
      const before = cachedSetPoolCount();
      for (let i = 0; i < 5; i++) {
        expect(await errorCode(openBooster(a.id, { kind: "set", setId: `set-invente-${i}-${Math.random()}` }))).toBe("unknown_set");
      }
      expect(cachedSetPoolCount()).toBe(before);
    });
  });

  describe("guildes", () => {
    it("retrouve sa guilde même hors des 30 premières de la liste", async () => {
      const owner = await newUser();
      const g = await prisma.guild.create({ data: { name: `Audit ${owner.id}`, tag: owner.id.slice(-4).toUpperCase(), ownerId: owner.id } });
      await prisma.guildMember.create({ data: { guildId: g.id, userId: owner.id, role: "owner" } });
      expect(await getGuildSummary(g.id)).toMatchObject({ id: g.id, members: 1 });
      expect(await getGuildSummary("guilde-inexistante")).toBeNull();
    });
  });

  describe("index", () => {
    it("les requêtes fréquentes ont leur index", async () => {
      const rows = await prisma.$queryRaw<{ indexname: string }[]>`SELECT indexname FROM pg_indexes WHERE schemaname = current_schema()`;
      const names = new Set(rows.map((r) => r.indexname));
      for (const idx of [
        "Sale_sellerId_idx",
        "Sale_buyerId_idx",
        "Block_blockedId_idx",
        "Report_reporterId_targetId_createdAt_idx",
        "Listing_currentBidderId_status_idx",
        "LedgerEntry_userId_id_idx",
      ]) {
        expect(names.has(idx), idx).toBe(true);
      }
    });
  });
});
