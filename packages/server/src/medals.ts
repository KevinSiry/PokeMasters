/**
 * Médailles et missions de guilde hebdomadaires (idées reprises d'HoloPocket).
 *
 * Les médailles sont calculées à partir de compteurs déjà en base : pas de nouvel événement à
 * suivre. `syncMedals` enregistre les paliers atteints et verse leur récompense une seule fois.
 * Les missions de guilde additionnent l'activité de la semaine des membres actuels.
 */
import { gameConfig } from "@pokeflex/config";
import { prisma } from "@pokeflex/db";
import { MEDAL_LEVELS, type MedalLevel, medalLevel, medalsToAward, missionTarget, nextWeekReset, weekKey, weekStart } from "@pokeflex/game";
import { applyLedger, lockUser } from "./ledger";

const medals = gameConfig.medals;
const missions = gameConfig.guildMissions;
const { timeZone } = gameConfig.quests;

type Metric = (typeof medals.list)[number]["metric"];

/** Compteurs d'un joueur, toutes périodes confondues. */
export async function medalMetrics(userId: string): Promise<Record<Metric, number>> {
  const [cards, boosters, sets, rarities, sales, trades, friends, binder] = await Promise.all([
    prisma.$queryRaw<{ n: bigint }[]>`SELECT count(DISTINCT "cardId") AS n FROM "CardCopy" WHERE "ownerId" = ${userId}`,
    prisma.boosterOpening.count({ where: { userId } }),
    prisma.setCompletion.count({ where: { userId } }),
    prisma.setRarityCompletion.count({ where: { userId } }),
    prisma.sale.count({ where: { sellerId: userId } }),
    prisma.trade.count({ where: { status: "accepted", OR: [{ proposerId: userId }, { recipientId: userId }] } }),
    prisma.friendship.count({ where: { userId, status: "accepted" } }),
    prisma.binderSlot.count({ where: { binder: { ownerId: userId } } }),
  ]);
  return {
    distinct_cards: Number(cards[0]?.n ?? 0),
    boosters_opened: boosters,
    sets_completed: sets,
    rarities_completed: rarities,
    sales,
    trades,
    friends,
    binder_cards: binder,
  };
}

export interface MedalView {
  id: string;
  label: string;
  unit: string;
  value: number;
  thresholds: number[];
  /** Paliers obtenus (0 à 3). */
  level: number;
  /** Prochain palier à atteindre, null si l'or est obtenu. */
  next: { level: MedalLevel; target: number; reward: number } | null;
}

export interface MedalAward {
  medalId: string;
  label: string;
  level: MedalLevel;
  reward: number;
}

/**
 * Enregistre les paliers nouvellement atteints et verse leurs Jetons (idempotent, sûr en
 * concurrence : la ligne du joueur est verrouillée). Renvoie les médailles et les nouveautés.
 */
export async function syncMedals(userId: string): Promise<{ medals: MedalView[]; awarded: MedalAward[] }> {
  const values = await medalMetrics(userId);
  const earnedRows = await prisma.userMedal.findMany({ where: { userId }, select: { medalId: true, level: true } });
  const earned = new Set(earnedRows.map((r) => `${r.medalId}:${r.level}`));
  let awarded: MedalAward[] = [];
  if (medalsToAward(medals.list, values, earned).length > 0) {
    awarded = await prisma.$transaction(async (tx) => {
      if (!(await lockUser(tx, userId))) return [];
      const rows = await tx.userMedal.findMany({ where: { userId }, select: { medalId: true, level: true } });
      const fresh = medalsToAward(medals.list, values, new Set(rows.map((r) => `${r.medalId}:${r.level}`)));
      const out: MedalAward[] = [];
      for (const a of fresh) {
        const reward = medals.rewards[a.level];
        await tx.userMedal.create({ data: { userId, medalId: a.medalId, level: a.level, reward } });
        const label = medals.list.find((m) => m.id === a.medalId)!.labelFr;
        await applyLedger(tx, { userId, delta: reward, reason: "medal", refType: "medal", refId: a.medalId, meta: { medal: label, level: a.level } });
        out.push({ medalId: a.medalId, label, level: a.level, reward });
      }
      return out;
    });
  }
  return { medals: medalViews(values), awarded };
}

function medalViews(values: Record<string, number>): MedalView[] {
  return medals.list.map((m) => {
    const value = values[m.metric] ?? 0;
    const level = medalLevel(value, m.thresholds);
    const nextLevel = MEDAL_LEVELS[level];
    return {
      id: m.id,
      label: m.labelFr,
      unit: m.unitFr,
      value,
      thresholds: [...m.thresholds],
      level,
      next: nextLevel ? { level: nextLevel, target: m.thresholds[level]!, reward: medals.rewards[nextLevel] } : null,
    };
  });
}

/** Médailles d'un joueur, sans rien enregistrer (profil vu par un autre joueur). */
export async function getMedals(userId: string): Promise<MedalView[]> {
  return medalViews(await medalMetrics(userId));
}

// ───────── Missions de guilde ─────────

export type GuildMissionKind = (typeof missions.list)[number]["kind"];

export interface GuildMissionView {
  kind: GuildMissionKind;
  label: string;
  progress: number;
  target: number;
  reward: number;
  /** Réclamée par le joueur qui regarde (cette semaine, dans n'importe quelle guilde). */
  claimed: boolean;
}

export class GuildMissionError extends Error {
  constructor(
    readonly code: "not_member" | "not_found" | "not_done" | "already_claimed",
    message: string,
  ) {
    super(message);
    this.name = "GuildMissionError";
  }
}

async function missionProgress(guildId: string, now: Date) {
  const members = (await prisma.guildMember.findMany({ where: { guildId }, select: { userId: true } })).map((m) => m.userId);
  const since = weekStart(now, timeZone);
  const [boosters, rarities, sales, trades] = await Promise.all([
    prisma.boosterOpening.count({ where: { userId: { in: members }, createdAt: { gte: since } } }),
    prisma.setRarityCompletion.count({ where: { userId: { in: members }, completedAt: { gte: since } } }),
    prisma.sale.count({ where: { sellerId: { in: members }, createdAt: { gte: since } } }),
    prisma.trade.count({
      where: { status: "accepted", closedAt: { gte: since }, OR: [{ proposerId: { in: members } }, { recipientId: { in: members } }] },
    }),
  ]);
  const progress: Record<GuildMissionKind, number> = { open_boosters: boosters, rarities_completed: rarities, sales, trades };
  return { members, progress };
}

/** Missions de la semaine d'une guilde, vues par `viewerId` (pour l'état « réclamée »). */
export async function getGuildMissions(
  guildId: string,
  viewerId: string | null,
  now = new Date(),
): Promise<{ missions: GuildMissionView[]; resetAt: string }> {
  const week = weekKey(now, timeZone);
  const [{ members, progress }, claims] = await Promise.all([
    missionProgress(guildId, now),
    viewerId ? prisma.guildMissionClaim.findMany({ where: { userId: viewerId, week }, select: { kind: true } }) : Promise.resolve([]),
  ]);
  const claimed = new Set(claims.map((c) => c.kind));
  return {
    missions: missions.list.map((m) => {
      const target = missionTarget(m, members.length);
      return { kind: m.kind, label: m.labelFr, target, progress: Math.min(target, progress[m.kind]), reward: m.reward, claimed: claimed.has(m.kind) };
    }),
    resetAt: nextWeekReset(now, timeZone).toISOString(),
  };
}

/** Réclame la récompense d'une mission réussie par sa guilde (une fois par semaine et par mission). */
export async function claimGuildMission(userId: string, kind: string, now = new Date()): Promise<{ reward: number; balance: number }> {
  const def = missions.list.find((m) => m.kind === kind);
  if (!def) throw new GuildMissionError("not_found", "Mission introuvable.");
  const member = await prisma.guildMember.findUnique({ where: { userId }, select: { guildId: true } });
  if (!member) throw new GuildMissionError("not_member", "Rejoins une guilde pour réclamer ses missions.");
  const { members, progress } = await missionProgress(member.guildId, now);
  if (progress[def.kind] < missionTarget(def, members.length)) throw new GuildMissionError("not_done", "Ta guilde n'a pas encore réussi cette mission.");
  const week = weekKey(now, timeZone);
  return prisma.$transaction(async (tx) => {
    await lockUser(tx, userId);
    const done = await tx.guildMissionClaim.findUnique({ where: { userId_week_kind: { userId, week, kind: def.kind } } });
    if (done) throw new GuildMissionError("already_claimed", "Récompense déjà réclamée cette semaine.");
    await tx.guildMissionClaim.create({ data: { userId, week, kind: def.kind, guildId: member.guildId, reward: def.reward } });
    const balance = await applyLedger(tx, {
      userId,
      delta: def.reward,
      reason: "guild_mission",
      refType: "guild",
      refId: member.guildId,
      meta: { mission: def.labelFr, week },
    });
    return { reward: def.reward, balance };
  });
}
