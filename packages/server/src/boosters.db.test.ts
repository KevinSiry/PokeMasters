/**
 * Tests d'intégration sur Postgres (base de développement ou service de la CI).
 * Ignorés si SKIP_DB_TESTS=1 (job Windows de la CI, sans base).
 */
import { gameConfig } from "@pokeflex/config";
import { prisma } from "@pokeflex/db";
import { seededRng } from "@pokeflex/game";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BoosterError, getDropPools, openFreeBooster } from "./boosters";

const skip = process.env.SKIP_DB_TESTS === "1";

describe.skipIf(skip)("openFreeBooster (Postgres)", () => {
  let userId = "";

  beforeAll(async () => {
    const pools = await getDropPools();
    if (Object.values(pools).every((p) => p.length === 0)) throw new Error("Catalogue vide : lance npm run db:seed");
    const u = await prisma.user.create({
      data: { handle: `test-booster-${Date.now()}`, name: "Test", boosterStock: 2, boosterAnchorAt: new Date() },
    });
    userId = u.id;
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  });

  it("enregistre 5 exemplaires, l'ouverture et décrémente le stock", async () => {
    const res = await openFreeBooster(userId, seededRng(1));
    expect(res.cards).toHaveLength(gameConfig.boosters.size);
    const copies = await prisma.cardCopy.count({ where: { ownerId: userId, openingId: res.openingId } });
    expect(copies).toBe(5);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.boosterStock).toBe(1);
    expect(res.boosters.available).toBe(1);
  });

  it("ne consomme jamais plus que le stock, même avec des clics simultanés", async () => {
    // Il reste 1 booster : 4 ouvertures en parallèle → une seule réussit.
    const results = await Promise.allSettled([1, 2, 3, 4].map((s) => openFreeBooster(userId, seededRng(s))));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    for (const r of results) {
      if (r.status === "rejected") expect(r.reason).toBeInstanceOf(BoosterError);
    }
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.boosterStock).toBe(0);
    expect(await prisma.boosterOpening.count({ where: { userId } })).toBe(2);
  });

  it("signale les cartes tirées qui sont déjà dans les favoris", async () => {
    const [first] = (await prisma.cardCopy.findMany({ where: { ownerId: userId }, select: { cardId: true }, take: 1 })).map((c) => c.cardId);
    await prisma.favoriteCard.create({ data: { userId, cardId: first! } });
    await prisma.user.update({ where: { id: userId }, data: { boosterStock: 1, boosterAnchorAt: new Date() } });
    const res = await openFreeBooster(userId, seededRng(7));
    for (const c of res.cards) expect(c.favorite).toBe(c.id === first);
  });
});
