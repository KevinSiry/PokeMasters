/**
 * Tests d'intégration des duels sur Postgres. Ignorés si SKIP_DB_TESTS=1.
 */
import { gameConfig } from "@pokeflex/config";
import { auditLedger, prisma } from "@pokeflex/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  acceptChallenge,
  createChallenge,
  createQuickDuel,
  createTrainingDuel,
  expireDuels,
  finishDuel,
  getMyDuels,
  startDuel,
  withdrawChallenge,
} from "./duels";
import { recycleCopy, RecycleError } from "./recycle";

const skip = process.env.SKIP_DB_TESTS === "1";
const users: string[] = [];
let cardIds: string[] = [];

async function newUser() {
  const handle = `test-duel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const u = await prisma.user.create({ data: { handle, name: "Test", boosterStock: 0, boosterAnchorAt: new Date() } });
  users.push(u.id);
  return { id: u.id, handle };
}
/** Trois exemplaires de cartes différentes. */
async function giveStake(userId: string, offset = 0) {
  const ids: string[] = [];
  for (const cardId of cardIds.slice(offset, offset + 3)) {
    ids.push((await prisma.cardCopy.create({ data: { ownerId: userId, cardId, obtainedVia: "test" } })).id);
  }
  return ids;
}
const statuses = async (ids: string[]) => (await prisma.cardCopy.findMany({ where: { id: { in: ids } } })).map((c) => c.status).sort();
const balance = async (id: string) => (await prisma.user.findUniqueOrThrow({ where: { id } })).balance;

async function readyDuel() {
  const a = await newUser();
  const b = await newUser();
  const sa = await giveStake(a.id);
  const sb = await giveStake(b.id, 3);
  const { duelId } = await createChallenge(a.id, b.handle, sa);
  await acceptChallenge(b.id, duelId, sb);
  return { a, b, sa, sb, duelId };
}

describe.skipIf(skip)("duels (Postgres)", () => {
  beforeAll(async () => {
    cardIds = (
      await prisma.card.findMany({ where: { droppable: true, category: "pokemon", image: { not: null } }, orderBy: { id: "asc" }, take: 6, select: { id: true } })
    ).map((c) => c.id);
  });
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: users } } });
  });

  it("un défi bloque les cartes misées (ni recyclables, ni misées ailleurs)", async () => {
    const a = await newUser();
    const b = await newUser();
    const c = await newUser();
    const stake = await giveStake(a.id);
    await createChallenge(a.id, b.handle, stake);
    expect(await statuses(stake)).toEqual(["staked", "staked", "staked"]);
    await expect(recycleCopy(a.id, stake[0]!)).rejects.toBeInstanceOf(RecycleError);
    await expect(createChallenge(a.id, c.handle, stake)).rejects.toMatchObject({ code: "invalid_stake" });
  });

  it("refuse une mise incomplète ou en double, et un défi contre soi-même", async () => {
    const a = await newUser();
    const b = await newUser();
    const stake = await giveStake(a.id);
    await expect(createChallenge(a.id, b.handle, stake.slice(0, 2))).rejects.toMatchObject({ code: "invalid_stake" });
    await expect(createChallenge(a.id, a.handle, stake)).rejects.toMatchObject({ code: "self" });
    await expect(createChallenge(a.id, "personne-de-ce-nom", stake)).rejects.toMatchObject({ code: "unknown_player" });
    expect(await statuses(stake)).toEqual(["owned", "owned", "owned"]);
  });

  it("refuser ou annuler un défi rend les cartes", async () => {
    const a = await newUser();
    const b = await newUser();
    const stake = await giveStake(a.id);
    const { duelId } = await createChallenge(a.id, b.handle, stake);
    const res = await withdrawChallenge(b.id, duelId);
    expect(res.status).toBe("declined");
    expect(await statuses(stake)).toEqual(["owned", "owned", "owned"]);
    await expect(acceptChallenge(b.id, duelId, await giveStake(b.id, 3))).rejects.toMatchObject({ code: "not_pending" });
  });

  it("deux acceptations simultanées : une seule passe", async () => {
    const a = await newUser();
    const b = await newUser();
    const { duelId } = await createChallenge(a.id, b.handle, await giveStake(a.id));
    const s1 = await giveStake(b.id, 3);
    const s2 = await giveStake(b.id, 0);
    const results = await Promise.allSettled([acceptChallenge(b.id, duelId, s1), acceptChallenge(b.id, duelId, s2)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.duelStake.count({ where: { duelId, userId: b.id } })).toBe(3);
  });

  it("un duel complet : questions sur les cartes misées, Jetons au gagnant, quête, cartes rendues", async () => {
    const { a, b, sa, sb, duelId } = await readyDuel();
    const started = await startDuel(duelId);
    expect(started.questions.length).toBeGreaterThanOrEqual(gameConfig.duels.questionCount - 2);
    const staked = new Set(cardIds);
    expect(started.questions.every((q) => staked.has(q.cardId))).toBe(true);
    const res = await finishDuel(duelId, {
      answers: [{ userId: a.id, qIndex: 0, choice: started.questions[0]!.answer, correct: true, answeredMs: 1000, points: 147 }],
      scoreA: 147,
      scoreB: 0,
    });
    expect(res.outcome).toBe("a");
    expect(await balance(a.id)).toBe(gameConfig.duels.rewards.win);
    expect(await balance(b.id)).toBe(gameConfig.duels.rewards.loss);
    expect(res.players.find((p) => p.userId === a.id)?.result).toBe("win");
    expect(await statuses([...sa, ...sb])).toEqual(Array(6).fill("owned"));
    await expect(finishDuel(duelId, { answers: [], scoreA: 0, scoreB: 0 })).rejects.toMatchObject({ code: "not_ready" });
    const mine = await getMyDuels(a.id);
    expect(mine.stats.wins).toBe(1);
    expect(mine.history[0]?.result).toBe("win");
    expect((await auditLedger(prisma)).filter((r) => users.includes(r.id))).toEqual([]);
  });

  it("l'abandon ne rapporte rien à celui qui abandonne", async () => {
    const { a, b, duelId } = await readyDuel();
    await startDuel(duelId);
    const res = await finishDuel(duelId, { answers: [], scoreA: 500, scoreB: 0, forfeitBy: a.id });
    expect(res.outcome).toBe("b");
    expect(await balance(a.id)).toBe(0);
    expect(await balance(b.id)).toBe(gameConfig.duels.rewards.win);
  });

  it("plafonne les duels récompensés par jour", async () => {
    const a = await newUser();
    const b = await newUser();
    for (let i = 0; i < gameConfig.duels.rewardedDuelsPerDay + 1; i++) {
      const { duelId } = await createQuickDuel({ userId: a.id, copyIds: await giveStake(a.id) }, { userId: b.id, copyIds: await giveStake(b.id, 3) });
      await startDuel(duelId);
      const res = await finishDuel(duelId, { answers: [], scoreA: 0, scoreB: 0 });
      if (i === gameConfig.duels.rewardedDuelsPerDay) expect(res.players.every((p) => p.reward === 0 && p.capped)).toBe(true);
    }
    expect(await balance(a.id)).toBe(gameConfig.duels.rewards.draw * gameConfig.duels.rewardedDuelsPerDay);
  });

  it("un entraînement ne rapporte rien et ne mise rien", async () => {
    const a = await newUser();
    await giveStake(a.id);
    const { duelId } = await createTrainingDuel(a.id);
    const started = await startDuel(duelId);
    expect(started.questions.length).toBeGreaterThan(0);
    const res = await finishDuel(duelId, { answers: [], scoreA: 900, scoreB: 0 });
    expect(res.players).toHaveLength(1);
    expect(await balance(a.id)).toBe(0);
  });

  it("un défi sans réponse expire et rend les cartes", async () => {
    const a = await newUser();
    const b = await newUser();
    const stake = await giveStake(a.id);
    const { duelId } = await createChallenge(a.id, b.handle, stake);
    const later = new Date(Date.now() + gameConfig.duels.challengeTtlMs + 1000);
    const expired = await expireDuels(later);
    expect(expired.map((d) => d.id)).toContain(duelId);
    expect(await statuses(stake)).toEqual(["owned", "owned", "owned"]);
  });
});
