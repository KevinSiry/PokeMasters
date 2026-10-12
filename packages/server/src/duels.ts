/**
 * Duels quiz : défis, mises, démarrage et clôture en base.
 * Le déroulé en direct (questions, chrono, réponses) vit dans le serveur temps réel ;
 * il n'écrit qu'au démarrage (questions) et à la fin (réponses, score, Jetons).
 */
import { randomUUID } from "node:crypto";
import { gameConfig, type Tier } from "@pokeflex/config";
import { type DuelKind, type DuelStatus, prisma, type Prisma } from "@pokeflex/db";
import { cryptoRng, duelOutcome, duelReward, generateQuiz, nextQuestReset, type QuizCard, type QuizPool, type QuizQuestion } from "@pokeflex/game";
import { TYPE_LABELS_FR } from "@pokeflex/tcgdex";
import { applyLedger, lockUser, lockUsers, type Tx, withTxRetry } from "./ledger";
import { bumpQuest, type QuestProgressed } from "./quests";

const rules = gameConfig.duels;

export class DuelError extends Error {
  constructor(
    readonly code:
      | "not_found"
      | "invalid_stake"
      | "self"
      | "unknown_player"
      | "too_many"
      | "already_pending"
      | "not_pending"
      | "expired"
      | "not_participant"
      | "not_ready",
    message: string,
  ) {
    super(message);
    this.name = "DuelError";
  }
}

// ───────── Mises ─────────

/** Pose les mises d'un joueur : exactement `stakeSize` exemplaires possédés, de cartes différentes. */
async function stakeCopies(tx: Tx, userId: string, duelId: string, copyIds: readonly string[]) {
  const ids = [...new Set(copyIds)];
  if (ids.length !== rules.stakeSize) {
    throw new DuelError("invalid_stake", `Choisis ${rules.stakeSize} cartes différentes à miser.`);
  }
  const copies = await tx.cardCopy.findMany({
    where: { id: { in: ids }, ownerId: userId, status: "owned" },
    select: { id: true, cardId: true },
  });
  if (copies.length !== ids.length) throw new DuelError("invalid_stake", "Une des cartes choisies n'est plus disponible.");
  if (new Set(copies.map((c) => c.cardId)).size !== copies.length) {
    throw new DuelError("invalid_stake", `Choisis ${rules.stakeSize} cartes différentes à miser.`);
  }
  const updated = await tx.cardCopy.updateMany({ where: { id: { in: ids }, ownerId: userId, status: "owned" }, data: { status: "staked" } });
  if (updated.count !== ids.length) throw new DuelError("invalid_stake", "Une des cartes choisies n'est plus disponible.");
  await tx.duelStake.createMany({ data: copies.map((c) => ({ duelId, userId, copyId: c.id, cardId: c.cardId })) });
}

/** Rend les cartes misées à leurs propriétaires. */
async function releaseStakes(tx: Tx, duelId: string) {
  const stakes = await tx.duelStake.findMany({ where: { duelId, copyId: { not: null } }, select: { copyId: true } });
  if (stakes.length === 0) return;
  await tx.cardCopy.updateMany({ where: { id: { in: stakes.map((s) => s.copyId!) }, status: "staked" }, data: { status: "owned" } });
}

/** Exemplaires qu'un joueur peut miser : un par carte, les Pokémon illustrés d'abord (plus de questions possibles). */
export async function getStakeCandidates(userId: string, take = 120) {
  const rows = await prisma.$queryRaw<
    { copyId: string; cardId: string; name: string; image: string | null; tier: Tier; setName: string; finish: string }[]
  >`
    SELECT DISTINCT ON (cc."cardId") cc.id AS "copyId", c.id AS "cardId", c.name, c.image, c.tier, s.name AS "setName", cc.finish
    FROM "CardCopy" cc JOIN "Card" c ON c.id = cc."cardId" JOIN "Set" s ON s.id = c."setId"
    WHERE cc."ownerId" = ${userId} AND cc.status = 'owned'
    ORDER BY cc."cardId", cc."obtainedAt" ASC`;
  const rank = (r: (typeof rows)[number]) => (r.image ? 0 : 1);
  return rows.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, "fr")).slice(0, take);
}

// ───────── Défis ─────────

export async function createChallenge(userId: string, opponentHandle: string, copyIds: readonly string[], now = new Date()) {
  const opponent = await prisma.user.findFirst({
    where: { handle: { equals: opponentHandle.trim().replace(/^@/, ""), mode: "insensitive" } },
    select: { id: true, name: true, handle: true },
  });
  if (!opponent) throw new DuelError("unknown_player", "Aucun joueur ne porte ce nom.");
  if (opponent.id === userId) throw new DuelError("self", "Tu ne peux pas te défier toi-même.");

  return withTxRetry(() =>
    prisma.$transaction(async (tx) => {
      await lockUser(tx, userId);
      const pending = await tx.duel.count({ where: { playerAId: userId, status: "pending" } });
      if (pending >= rules.maxPendingChallenges) {
        throw new DuelError("too_many", `Tu as déjà ${rules.maxPendingChallenges} défis en attente.`);
      }
      const existing = await tx.duel.findFirst({
        where: { status: "pending", OR: [{ playerAId: userId, playerBId: opponent.id }, { playerAId: opponent.id, playerBId: userId }] },
        select: { id: true },
      });
      if (existing) throw new DuelError("already_pending", "Un défi est déjà en attente entre vous deux.");
      const duel = await tx.duel.create({
        data: { kind: "challenge", status: "pending", playerAId: userId, playerBId: opponent.id, expiresAt: new Date(now.getTime() + rules.challengeTtlMs) },
      });
      await stakeCopies(tx, userId, duel.id, copyIds);
      return { duelId: duel.id, opponentId: opponent.id };
    }),
  );
}

async function lockDuel(tx: Tx, duelId: string) {
  const [row] = await tx.$queryRaw<
    { id: string; kind: DuelKind; status: DuelStatus; playerAId: string; playerBId: string | null; expiresAt: Date | null }[]
  >`SELECT id, kind, status, "playerAId", "playerBId", "expiresAt" FROM "Duel" WHERE id = ${duelId} FOR UPDATE`;
  if (!row) throw new DuelError("not_found", "Ce duel n'existe pas.");
  return row;
}

export async function acceptChallenge(userId: string, duelId: string, copyIds: readonly string[], now = new Date()) {
  return withTxRetry(() =>
    prisma.$transaction(async (tx) => {
      await lockUser(tx, userId);
      const duel = await lockDuel(tx, duelId);
      if (duel.playerBId !== userId) throw new DuelError("not_participant", "Ce défi ne t'est pas adressé.");
      if (duel.status !== "pending") throw new DuelError("not_pending", "Ce défi n'est plus en attente.");
      if (duel.expiresAt && duel.expiresAt <= now) throw new DuelError("expired", "Ce défi a expiré.");
      await stakeCopies(tx, userId, duelId, copyIds);
      await tx.duel.update({ where: { id: duelId }, data: { status: "ready", expiresAt: new Date(now.getTime() + rules.joinWindowMs) } });
      return { duelId, opponentId: duel.playerAId };
    }),
  );
}

/** Refus (par l'adversaire) ou annulation (par le lanceur) d'un défi en attente. */
export async function withdrawChallenge(userId: string, duelId: string) {
  return prisma.$transaction(async (tx) => {
    const duel = await lockDuel(tx, duelId);
    if (duel.playerAId !== userId && duel.playerBId !== userId) throw new DuelError("not_participant", "Ce défi ne te concerne pas.");
    if (duel.status !== "pending") throw new DuelError("not_pending", "Ce défi n'est plus en attente.");
    const status = duel.playerAId === userId ? "cancelled" : "declined";
    await tx.duel.update({ where: { id: duelId }, data: { status, finishedAt: new Date() } });
    await releaseStakes(tx, duelId);
    return { status, otherId: duel.playerAId === userId ? duel.playerBId! : duel.playerAId };
  });
}

/** Duel rapide entre deux joueurs de la file d'attente. */
export async function createQuickDuel(
  a: { userId: string; copyIds: readonly string[] },
  b: { userId: string; copyIds: readonly string[] },
  now = new Date(),
) {
  if (a.userId === b.userId) throw new DuelError("self", "Tu ne peux pas te défier toi-même.");
  return withTxRetry(() =>
    prisma.$transaction(async (tx) => {
      await lockUsers(tx, [a.userId, b.userId]);
      const duel = await tx.duel.create({
        data: { kind: "quick", status: "ready", playerAId: a.userId, playerBId: b.userId, expiresAt: new Date(now.getTime() + rules.joinWindowMs) },
      });
      await stakeCopies(tx, a.userId, duel.id, a.copyIds);
      await stakeCopies(tx, b.userId, duel.id, b.copyIds);
      return { duelId: duel.id };
    }),
  );
}

/** Vérifie qu'un joueur peut miser ces cartes, sans les bloquer (avant d'entrer dans la file). */
export async function assertStakeable(userId: string, copyIds: readonly string[]) {
  const ids = [...new Set(copyIds)];
  if (ids.length !== rules.stakeSize) throw new DuelError("invalid_stake", `Choisis ${rules.stakeSize} cartes différentes à miser.`);
  const copies = await prisma.cardCopy.findMany({ where: { id: { in: ids }, ownerId: userId, status: "owned" }, select: { cardId: true } });
  if (copies.length !== ids.length || new Set(copies.map((c) => c.cardId)).size !== ids.length) {
    throw new DuelError("invalid_stake", "Une des cartes choisies n'est plus disponible.");
  }
}

/** Entraînement contre le Professeur, sans mise. */
export async function createTrainingDuel(userId: string, now = new Date()) {
  const duel = await prisma.duel.create({
    data: { kind: "training", status: "ready", playerAId: userId, expiresAt: new Date(now.getTime() + rules.joinWindowMs) },
  });
  return { duelId: duel.id };
}

/** Défis échus et duels prêts jamais commencés : on rend les cartes. */
export async function expireDuels(now = new Date(), limit = 50) {
  const due = await prisma.duel.findMany({
    where: { status: { in: ["pending", "ready"] }, expiresAt: { lte: now } },
    select: { id: true },
    take: limit,
  });
  const done: { id: string; status: DuelStatus; playerAId: string; playerBId: string | null }[] = [];
  for (const { id } of due) {
    const res = await prisma.$transaction(async (tx) => {
      const duel = await lockDuel(tx, id);
      if ((duel.status !== "pending" && duel.status !== "ready") || !duel.expiresAt || duel.expiresAt > now) return null;
      const status: DuelStatus = duel.status === "pending" ? "expired" : "cancelled";
      await tx.duel.update({ where: { id }, data: { status, finishedAt: now } });
      await releaseStakes(tx, id);
      return { id, status, playerAId: duel.playerAId, playerBId: duel.playerBId };
    });
    if (res) done.push(res);
  }
  return done;
}

/** Au redémarrage du serveur temps réel, les duels en cours sont perdus : on les annule et on rend les cartes. */
export async function abortActiveDuels(now = new Date()) {
  const active = await prisma.duel.findMany({ where: { status: "active" }, select: { id: true } });
  for (const { id } of active) {
    await prisma.$transaction(async (tx) => {
      const duel = await lockDuel(tx, id);
      if (duel.status !== "active") return;
      await tx.duel.update({ where: { id }, data: { status: "cancelled", finishedAt: now } });
      await releaseStakes(tx, id);
    });
  }
  return active.length;
}

// ───────── Questions ─────────

const cardQuizSelect = {
  id: true,
  name: true,
  image: true,
  category: true,
  hp: true,
  types: true,
  weaknesses: true,
  illustrator: true,
  attacks: true,
  retreat: true,
  dexIds: true,
  set: { select: { id: true, name: true, serieId: true } },
} satisfies Prisma.CardSelect;

function toQuizCard(c: Prisma.CardGetPayload<{ select: typeof cardQuizSelect }>): QuizCard {
  const names = (v: Prisma.JsonValue, key: "name" | "type") =>
    Array.isArray(v) ? v.flatMap((x) => (x && typeof x === "object" && !Array.isArray(x) && typeof x[key] === "string" ? [x[key] as string] : [])) : [];
  return {
    id: c.id,
    name: c.name,
    image: c.image,
    category: c.category,
    hp: c.hp,
    types: c.types,
    weaknesses: names(c.weaknesses, "type"),
    illustrator: c.illustrator,
    setId: c.set.id,
    setName: c.set.name,
    serieId: c.set.serieId,
    attacks: [...new Set(names(c.attacks, "name"))],
    retreat: c.retreat,
    dexIds: c.dexIds,
  };
}

let poolCache: { at: number; pool: QuizPool } | null = null;

/** Réserve de mauvaises réponses, construite depuis le catalogue (gardée une heure en mémoire). */
export async function getQuizPool(now = Date.now()): Promise<QuizPool> {
  if (poolCache && now - poolCache.at < 3_600_000) return poolCache.pool;
  const [illustrators, sets, attacks] = await Promise.all([
    prisma.$queryRaw<{ name: string }[]>`
      SELECT illustrator AS name FROM "Card" WHERE illustrator IS NOT NULL GROUP BY illustrator ORDER BY count(*) DESC LIMIT 300`,
    prisma.set.findMany({ select: { id: true, name: true, serieId: true } }),
    prisma.$queryRaw<{ name: string }[]>`
      SELECT DISTINCT a->>'name' AS name FROM "Card" c, jsonb_array_elements(c.attacks) a
      WHERE c.lang = 'fr' AND a->>'name' IS NOT NULL LIMIT 3000`,
  ]);
  const pool: QuizPool = {
    illustrators: illustrators.map((r) => r.name),
    sets,
    attackNames: attacks.map((r) => r.name),
    typeLabels: { ...TYPE_LABELS_FR },
  };
  poolCache = { at: now, pool };
  return pool;
}

/** Cartes d'un entraînement : quelques cartes du joueur, complétées par des cartes du catalogue. */
async function trainingCardIds(userId: string): Promise<string[]> {
  const mine = await prisma.$queryRaw<{ id: string }[]>`
    SELECT c.id FROM (SELECT DISTINCT "cardId" FROM "CardCopy" WHERE "ownerId" = ${userId}) o
    JOIN "Card" c ON c.id = o."cardId" WHERE c.category = 'pokemon' AND c.image IS NOT NULL
    ORDER BY random() LIMIT 3`;
  const others = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Card" WHERE droppable AND category = 'pokemon' AND image IS NOT NULL
    ORDER BY random() LIMIT ${6 - mine.length}`;
  return [...mine, ...others].map((r) => r.id);
}

export interface DuelStart {
  duelId: string;
  kind: DuelKind;
  playerAId: string;
  playerBId: string | null;
  questions: QuizQuestion[];
}

/** Passe un duel prêt en cours : tire la graine et les questions, enregistrées avant la première question. */
export async function startDuel(duelId: string, now = new Date()): Promise<DuelStart> {
  const meta = await prisma.duel.findUnique({ where: { id: duelId }, select: { kind: true, playerAId: true, stakes: { select: { cardId: true } } } });
  if (!meta) throw new DuelError("not_found", "Ce duel n'existe pas.");
  const cardIds = meta.kind === "training" ? await trainingCardIds(meta.playerAId) : meta.stakes.map((s) => s.cardId);
  const [cards, pool] = await Promise.all([prisma.card.findMany({ where: { id: { in: cardIds } }, select: cardQuizSelect }), getQuizPool()]);
  const seed = randomUUID();
  const questions = generateQuiz(seed, cards.map(toQuizCard), pool, rules.questionCount, rules.choicesPerQuestion);

  return prisma.$transaction(async (tx) => {
    const duel = await lockDuel(tx, duelId);
    if (duel.status !== "ready") throw new DuelError("not_ready", "Ce duel ne peut pas commencer.");
    await tx.duel.update({
      where: { id: duelId },
      data: { status: "active", seed, questions: questions as unknown as Prisma.InputJsonValue, startedAt: now, expiresAt: null },
    });
    return { duelId, kind: duel.kind, playerAId: duel.playerAId, playerBId: duel.playerBId, questions };
  });
}

// ───────── Fin de duel ─────────

export interface DuelAnswerRecord {
  userId: string;
  qIndex: number;
  choice: number | null;
  correct: boolean;
  answeredMs: number;
  points: number;
}

export interface PlayerResult {
  userId: string;
  result: "win" | "draw" | "loss";
  reward: number;
  balance: number | null;
  quest: QuestProgressed | null;
  /** Le plafond quotidien de duels récompensés est atteint. */
  capped: boolean;
  /** Carte gagnée sur la mise adverse (option `winnerTakesStake`). */
  wonCardId: string | null;
}

export interface DuelFinish {
  outcome: "a" | "b" | "draw";
  scoreA: number;
  scoreB: number;
  forfeitBy: string | null;
  players: PlayerResult[];
}

const DUEL_REASONS = ["duel_win", "duel_draw", "duel_loss"] as const;

/** Début du jour de jeu (minuit, heure de Paris) contenant `now`. */
function dayStart(now: Date): Date {
  return new Date(nextQuestReset(now, gameConfig.quests.timeZone).getTime() - 24 * 3_600_000);
}

/**
 * Termine un duel en cours : enregistre les réponses, désigne le gagnant, verse les Jetons
 * (dans la limite quotidienne), fait avancer la quête « Gagner 1 duel » et rend les mises.
 */
export async function finishDuel(
  duelId: string,
  input: { answers: DuelAnswerRecord[]; scoreA: number; scoreB: number; forfeitBy?: string | null },
  now = new Date(),
): Promise<DuelFinish> {
  return withTxRetry(() =>
    prisma.$transaction(async (tx) => {
      const head = await tx.duel.findUnique({ where: { id: duelId }, select: { playerAId: true, playerBId: true } });
      if (!head) throw new DuelError("not_found", "Ce duel n'existe pas.");
      await lockUsers(tx, [head.playerAId, ...(head.playerBId ? [head.playerBId] : [])]);
      const duel = await lockDuel(tx, duelId);
      if (duel.status !== "active") throw new DuelError("not_ready", "Ce duel n'est pas en cours.");

      const forfeitBy = input.forfeitBy ?? null;
      let outcome = duelOutcome(input.scoreA, input.scoreB);
      if (forfeitBy === duel.playerAId) outcome = "b";
      if (forfeitBy && forfeitBy === duel.playerBId) outcome = "a";

      if (input.answers.length > 0) {
        await tx.duelAnswer.createMany({ data: input.answers.map((a) => ({ duelId, ...a })), skipDuplicates: true });
      }

      const players: PlayerResult[] = [];
      const sides: { userId: string; side: "a" | "b" }[] = [{ userId: duel.playerAId, side: "a" }];
      if (duel.playerBId) sides.push({ userId: duel.playerBId, side: "b" });
      const since = dayStart(now);
      for (const { userId, side } of sides) {
        const result = outcome === "draw" ? "draw" : outcome === side ? "win" : "loss";
        let reward = 0;
        let balance: number | null = null;
        let quest: QuestProgressed | null = null;
        let capped = false;
        if (duel.kind !== "training") {
          const rewardedToday = await tx.ledgerEntry.count({ where: { userId, reason: { in: [...DUEL_REASONS] }, createdAt: { gte: since } } });
          capped = rewardedToday >= rules.rewardedDuelsPerDay;
          // Abandonner ne rapporte rien.
          reward = forfeitBy === userId ? 0 : duelReward(result, rewardedToday, rules);
          if (reward > 0) {
            balance = await applyLedger(tx, { userId, delta: reward, reason: `duel_${result}`, refType: "duel", refId: duelId });
          }
          if (result === "win") quest = await bumpQuest(tx, userId, "win_duel", 1, now);
        }
        players.push({ userId, result, reward, balance, quest, capped, wonCardId: null });
      }

      // Option : le gagnant emporte une carte misée par le perdant (au hasard).
      if (rules.winnerTakesStake && duel.kind !== "training" && outcome !== "draw" && duel.playerBId) {
        const winnerId = outcome === "a" ? duel.playerAId : duel.playerBId;
        const loserId = outcome === "a" ? duel.playerBId : duel.playerAId;
        const loserStakes = await tx.duelStake.findMany({ where: { duelId, userId: loserId, copyId: { not: null } } });
        const prize = loserStakes[cryptoRng.int(Math.max(1, loserStakes.length))];
        if (prize?.copyId) {
          await tx.cardCopy.update({ where: { id: prize.copyId }, data: { ownerId: winnerId, status: "owned", obtainedVia: "duel", obtainedAt: now, openingId: null } });
          const winner = players.find((p) => p.userId === winnerId);
          if (winner) winner.wonCardId = prize.cardId;
        }
      }
      await releaseStakes(tx, duelId);

      const [pa, pb] = [players[0], players[1]];
      await tx.duel.update({
        where: { id: duelId },
        data: {
          status: "finished",
          scoreA: input.scoreA,
          scoreB: input.scoreB,
          outcome,
          forfeitBy,
          rewardA: pa?.reward ?? null,
          rewardB: pb?.reward ?? null,
          finishedAt: now,
        },
      });
      return { outcome, scoreA: input.scoreA, scoreB: input.scoreB, forfeitBy, players };
    }),
  );
}

// ───────── Lectures ─────────

const playerSelect = { id: true, name: true, handle: true, image: true } as const;
const displayName = (u: { name: string | null; handle: string | null }) => u.name ?? u.handle ?? "Dresseur";

export interface DuelPlayerView {
  id: string;
  name: string;
  handle: string | null;
  image: string | null;
}

export interface DuelView {
  id: string;
  kind: DuelKind;
  status: DuelStatus;
  playerA: DuelPlayerView;
  /** Null pour un entraînement : l'adversaire est le Professeur. */
  playerB: DuelPlayerView | null;
  stakes: { userId: string; cardId: string; name: string; image: string | null; tier: Tier }[];
  scoreA: number;
  scoreB: number;
  outcome: string | null;
  forfeitBy: string | null;
  rewardA: number | null;
  rewardB: number | null;
  createdAt: string;
  expiresAt: string | null;
  finishedAt: string | null;
  /** Récapitulatif question par question, seulement une fois le duel terminé. */
  recap: { prompt: string; image: string | null; choices: string[]; answer: number; a: number | null; b: number | null; pointsA: number; pointsB: number }[] | null;
}

const asPlayer = (u: { id: string; name: string | null; handle: string | null; image: string | null }): DuelPlayerView => ({
  id: u.id,
  name: displayName(u),
  handle: u.handle,
  image: u.image,
});

export async function getDuelView(duelId: string): Promise<DuelView | null> {
  const d = await prisma.duel.findUnique({
    where: { id: duelId },
    include: {
      playerA: { select: playerSelect },
      playerB: { select: playerSelect },
      stakes: { select: { userId: true, cardId: true } },
      answers: true,
    },
  });
  if (!d) return null;
  const cards = await prisma.card.findMany({
    where: { id: { in: d.stakes.map((s) => s.cardId) } },
    select: { id: true, name: true, image: true, tier: true },
  });
  const byId = new Map(cards.map((c) => [c.id, c]));
  let recap: DuelView["recap"] = null;
  if (d.status === "finished" && Array.isArray(d.questions)) {
    const qs = d.questions as unknown as QuizQuestion[];
    const ans = (uid: string | null, i: number) => d.answers.find((a) => a.userId === (uid ?? "bot") && a.qIndex === i);
    recap = qs.map((q, i) => ({
      prompt: q.prompt,
      image: q.image,
      choices: q.choices,
      answer: q.answer,
      a: ans(d.playerAId, i)?.choice ?? null,
      b: ans(d.playerBId, i)?.choice ?? null,
      pointsA: ans(d.playerAId, i)?.points ?? 0,
      pointsB: ans(d.playerBId, i)?.points ?? 0,
    }));
  }
  return {
    id: d.id,
    kind: d.kind,
    status: d.status,
    playerA: asPlayer(d.playerA),
    playerB: d.playerB ? asPlayer(d.playerB) : null,
    stakes: d.stakes.flatMap((s) => {
      const c = byId.get(s.cardId);
      return c ? [{ userId: s.userId, cardId: c.id, name: c.name, image: c.image, tier: c.tier }] : [];
    }),
    scoreA: d.scoreA,
    scoreB: d.scoreB,
    outcome: d.outcome,
    forfeitBy: d.forfeitBy,
    rewardA: d.rewardA,
    rewardB: d.rewardB,
    createdAt: d.createdAt.toISOString(),
    expiresAt: d.expiresAt?.toISOString() ?? null,
    finishedAt: d.finishedAt?.toISOString() ?? null,
    recap,
  };
}

export interface DuelSummary {
  id: string;
  kind: DuelKind;
  status: DuelStatus;
  opponent: DuelPlayerView | null;
  /** Le joueur est le lanceur (A). */
  mine: boolean;
  myScore: number;
  theirScore: number;
  result: "win" | "draw" | "loss" | null;
  reward: number | null;
  createdAt: string;
  expiresAt: string | null;
}

/** Duels d'un joueur : défis reçus et envoyés, duels prêts, historique et bilan. */
export async function getMyDuels(userId: string, now = new Date()) {
  const rows = await prisma.duel.findMany({
    where: { OR: [{ playerAId: userId }, { playerBId: userId }], status: { not: "cancelled" }, kind: { not: "training" } },
    include: { playerA: { select: playerSelect }, playerB: { select: playerSelect } },
    orderBy: { createdAt: "desc" },
    take: 60,
  });
  const summaries: DuelSummary[] = rows.map((d) => {
    const mine = d.playerAId === userId;
    const opp = mine ? d.playerB : d.playerA;
    const side = mine ? "a" : "b";
    const result = d.status !== "finished" || !d.outcome ? null : d.outcome === "draw" ? "draw" : d.outcome === side ? "win" : "loss";
    return {
      id: d.id,
      kind: d.kind,
      status: d.status,
      opponent: opp ? asPlayer(opp) : null,
      mine,
      myScore: mine ? d.scoreA : d.scoreB,
      theirScore: mine ? d.scoreB : d.scoreA,
      result,
      reward: mine ? d.rewardA : d.rewardB,
      createdAt: d.createdAt.toISOString(),
      expiresAt: d.expiresAt?.toISOString() ?? null,
    };
  });
  const live = (s: DuelSummary) => !s.expiresAt || new Date(s.expiresAt) > now;
  const [stats, rewardedToday] = await Promise.all([
    prisma.$queryRaw<{ wins: bigint; draws: bigint; losses: bigint }[]>`
      SELECT count(*) FILTER (WHERE (outcome = 'a' AND "playerAId" = ${userId}) OR (outcome = 'b' AND "playerBId" = ${userId})) AS wins,
             count(*) FILTER (WHERE outcome = 'draw') AS draws,
             count(*) FILTER (WHERE (outcome = 'b' AND "playerAId" = ${userId}) OR (outcome = 'a' AND "playerBId" = ${userId})) AS losses
      FROM "Duel" WHERE status = 'finished' AND kind <> 'training' AND ("playerAId" = ${userId} OR "playerBId" = ${userId})`,
    prisma.ledgerEntry.count({ where: { userId, reason: { in: [...DUEL_REASONS] }, createdAt: { gte: dayStart(now) } } }),
  ]);
  const s = stats[0];
  return {
    incoming: summaries.filter((d) => d.status === "pending" && !d.mine && live(d)),
    outgoing: summaries.filter((d) => d.status === "pending" && d.mine && live(d)),
    ready: summaries.filter((d) => (d.status === "ready" || d.status === "active") && live(d)),
    history: summaries.filter((d) => d.status === "finished").slice(0, 20),
    stats: { wins: Number(s?.wins ?? 0), draws: Number(s?.draws ?? 0), losses: Number(s?.losses ?? 0) },
    rewardedToday,
    rewardedCap: rules.rewardedDuelsPerDay,
  };
}

/** Joueurs à défier : recherche par nom (au moins 2 lettres), sinon des adversaires récents. */
export async function findOpponents(userId: string, q: string, take = 8): Promise<DuelPlayerView[]> {
  const query = q.trim().replace(/^@/, "");
  if (query.length >= 2) {
    const rows = await prisma.user.findMany({
      where: {
        id: { not: userId },
        handle: { not: null },
        OR: [{ handle: { contains: query, mode: "insensitive" } }, { name: { contains: query, mode: "insensitive" } }],
      },
      select: playerSelect,
      take,
      orderBy: { handle: "asc" },
    });
    return rows.map(asPlayer);
  }
  const recent = await prisma.duel.findMany({
    where: { OR: [{ playerAId: userId }, { playerBId: userId }], playerBId: { not: null } },
    include: { playerA: { select: playerSelect }, playerB: { select: playerSelect } },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  const seen = new Map<string, DuelPlayerView>();
  for (const d of recent) {
    const opp = d.playerAId === userId ? d.playerB : d.playerA;
    if (opp && opp.handle && !seen.has(opp.id)) seen.set(opp.id, asPlayer(opp));
  }
  if (seen.size < take) {
    const more = await prisma.user.findMany({
      where: { id: { notIn: [userId, ...seen.keys()] }, handle: { not: null } },
      select: playerSelect,
      orderBy: { createdAt: "asc" },
      take: take - seen.size,
    });
    for (const u of more) seen.set(u.id, asPlayer(u));
  }
  return [...seen.values()].slice(0, take);
}

/** Participants d'un duel (contrôle d'accès du serveur temps réel). */
export async function getDuelParticipants(duelId: string) {
  return prisma.duel.findUnique({ where: { id: duelId }, select: { id: true, kind: true, status: true, playerAId: true, playerBId: true, expiresAt: true } });
}
