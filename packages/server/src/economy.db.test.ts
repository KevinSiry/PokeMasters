/**
 * Tests d'intégration de l'économie sur Postgres. Ignorés si SKIP_DB_TESTS=1.
 */
import { gameConfig } from "@pokeflex/config";
import { auditLedger, prisma } from "@pokeflex/db";
import { InsufficientFundsError, seededRng } from "@pokeflex/game";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BoosterError, getBoosterSets, openBooster } from "./boosters";
import { checkSetCompletions } from "./completion";
import { applyLedger } from "./ledger";
import { claimQuest, getDailyQuests, QuestError } from "./quests";
import { previewDuplicates, recycleCopy, recycleDuplicates, RecycleError } from "./recycle";

const skip = process.env.SKIP_DB_TESTS === "1";
const users: string[] = [];

async function newUser(balance = 0, boosterStock = 0) {
  const u = await prisma.user.create({
    data: { handle: `test-eco-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: "Test", boosterStock, boosterAnchorAt: new Date() },
  });
  users.push(u.id);
  if (balance > 0) await prisma.$transaction((tx) => applyLedger(tx, { userId: u.id, delta: balance, reason: "admin" }));
  return u.id;
}

async function expectAuditClean() {
  const bad = (await auditLedger(prisma)).filter((r) => users.includes(r.id));
  expect(bad).toEqual([]);
}

describe.skipIf(skip)("économie (Postgres)", () => {
  let setId = "";

  beforeAll(async () => {
    const sets = await getBoosterSets("nobody");
    if (sets.length === 0) throw new Error("Catalogue vide : lance npm run db:seed");
    setId = sets.find((s) => s.id === "base1")?.id ?? sets[0]!.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: users } } });
  });

  it("des débits simultanés ne rendent jamais le solde négatif", async () => {
    const userId = await newUser(100);
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () => prisma.$transaction((tx) => applyLedger(tx, { userId, delta: -30, reason: "admin" }))),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
    for (const r of results) if (r.status === "rejected") expect(r.reason).toBeInstanceOf(InsufficientFundsError);
    const u = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(u.balance).toBe(10);
    await expectAuditClean();
  });

  it("refuse un booster de set sans assez de Jetons, sans rien écrire", async () => {
    const userId = await newUser(gameConfig.boosters.setBoosterPrice - 1);
    await expect(openBooster(userId, { kind: "set", setId }, seededRng(1))).rejects.toMatchObject({ code: "insufficient_funds" });
    expect(await prisma.cardCopy.count({ where: { ownerId: userId } })).toBe(0);
    expect(await prisma.boosterOpening.count({ where: { userId } })).toBe(0);
    await expectAuditClean();
  });

  it("un booster de set débite le prix et ne tire que des cartes du set", async () => {
    const price = gameConfig.boosters.setBoosterPrice;
    const userId = await newUser(price * 2);
    const res = await openBooster(userId, { kind: "set", setId }, seededRng(2));
    expect(res.cards).toHaveLength(gameConfig.boosters.size);
    const cards = await prisma.card.findMany({ where: { id: { in: res.cards.map((c) => c.id) } }, select: { setId: true } });
    expect(new Set(cards.map((c) => c.setId))).toEqual(new Set([setId]));
    expect(res.balance).toBe(price);
    // Deux achats simultanés avec de quoi en payer un seul : un seul passe.
    const both = await Promise.allSettled([
      openBooster(userId, { kind: "set", setId }, seededRng(3)),
      openBooster(userId, { kind: "set", setId }, seededRng(4)),
    ]);
    expect(both.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = both.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(BoosterError);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).balance).toBe(0);
    await expectAuditClean();
  });

  it("recycle un exemplaire une seule fois, même avec deux clics simultanés", async () => {
    const userId = await newUser(0, 1);
    const res = await openBooster(userId, { kind: "free" }, seededRng(5));
    const target = res.cards[0]!;
    const both = await Promise.allSettled([recycleCopy(userId, target.copyId), recycleCopy(userId, target.copyId)]);
    expect(both.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((both.find((r) => r.status === "rejected") as PromiseRejectedResult).reason).toBeInstanceOf(RecycleError);
    const u = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(u.balance).toBe(gameConfig.economy.recycleValue[target.tier]);
    await expectAuditClean();
  });

  it("recycle les doublons en gardant un exemplaire par carte", async () => {
    const userId = await newUser();
    const card = await prisma.card.findFirstOrThrow({ where: { droppable: true, tier: "common" } });
    const other = await prisma.card.findFirstOrThrow({ where: { droppable: true, tier: "rare" } });
    await prisma.cardCopy.createMany({
      data: [
        { ownerId: userId, cardId: card.id, finish: "normal", obtainedVia: "test" },
        { ownerId: userId, cardId: card.id, finish: "normal", obtainedVia: "test" },
        { ownerId: userId, cardId: card.id, finish: "normal", obtainedVia: "test" },
        { ownerId: userId, cardId: other.id, finish: "normal", obtainedVia: "test" },
        { ownerId: userId, cardId: other.id, finish: "normal", obtainedVia: "test", status: "listed" },
      ],
    });
    const preview = await previewDuplicates(userId);
    expect(preview.find((p) => p.tier === "common")!.count).toBe(2);
    expect(preview.find((p) => p.tier === "rare")!.count).toBe(0); // l'exemplaire en vente ne compte pas
    await expect(recycleDuplicates(userId, ["rare"])).rejects.toBeInstanceOf(RecycleError);
    const res = await recycleDuplicates(userId, ["common", "rare"]);
    expect(res.count).toBe(2);
    expect(res.total).toBe(2 * gameConfig.economy.recycleValue.common);
    expect(await prisma.cardCopy.count({ where: { ownerId: userId, cardId: card.id } })).toBe(1);
    await expectAuditClean();
  });

  it("verse le bonus de set complété une seule fois", async () => {
    const userId = await newUser();
    const set = await prisma.set.findUniqueOrThrow({ where: { id: setId } });
    const cards = await prisma.card.findMany({ where: { setId, droppable: true }, select: { id: true } });
    await prisma.cardCopy.createMany({ data: cards.slice(1).map((c) => ({ ownerId: userId, cardId: c.id, obtainedVia: "test" })) });
    expect(await prisma.$transaction((tx) => checkSetCompletions(tx, userId, [setId]))).toEqual([]);
    await prisma.cardCopy.create({ data: { ownerId: userId, cardId: cards[0]!.id, obtainedVia: "test" } });
    const done = await prisma.$transaction((tx) => checkSetCompletions(tx, userId, [setId, setId]));
    const bonus = set.cardCountOfficial * gameConfig.economy.setCompletionBonusPerCard;
    expect(done).toEqual([{ setId, name: set.name, bonus }]);
    expect(await prisma.$transaction((tx) => checkSetCompletions(tx, userId, [setId]))).toEqual([]);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).balance).toBe(bonus);
    await expectAuditClean();
  });

  it("termine la quête « ouvrir 5 boosters » et ne paie la récompense qu'une fois", async () => {
    const userId = await newUser(0, 5);
    let done = false;
    for (let i = 0; i < 5; i++) {
      const res = await openBooster(userId, { kind: "free" }, seededRng(10 + i));
      if (res.questsDone.some((q) => q.kind === "open_boosters")) done = i === 4;
    }
    expect(done).toBe(true);
    const { quests } = await getDailyQuests(userId);
    const q = quests.find((x) => x.kind === "open_boosters")!;
    expect(q.progress).toBe(5);
    const before = (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).balance;
    const both = await Promise.allSettled([claimQuest(userId, q.id), claimQuest(userId, q.id)]);
    expect(both.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((both.find((r) => r.status === "rejected") as PromiseRejectedResult).reason).toBeInstanceOf(QuestError);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).balance).toBe(before + q.reward);
    await expectAuditClean();
  });

  it("refuse de réclamer une quête non terminée", async () => {
    const userId = await newUser();
    const { quests } = await getDailyQuests(userId);
    expect(quests).toHaveLength(gameConfig.quests.perDay);
    await expect(claimQuest(userId, quests[0]!.id)).rejects.toMatchObject({ code: "not_done" });
  });
});
