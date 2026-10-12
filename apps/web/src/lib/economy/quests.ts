/** Quêtes du jour : créées paresseusement, avancées dans la transaction de l'action qui les fait progresser. */
import { gameConfig } from "@pokeflex/config";
import { prisma } from "@pokeflex/db";
import { nextQuestReset, pickDailyQuests, questDay } from "@pokeflex/game";
import { applyLedger, lockUser, type Tx } from "./ledger";

export type QuestKind = (typeof gameConfig.quests.templates)[number]["kind"];

const { timeZone, templates, perDay } = gameConfig.quests;

function dayDate(now: Date) {
  return new Date(`${questDay(now, timeZone)}T00:00:00Z`);
}

/** Crée les quêtes du jour si elles n'existent pas encore (idempotent). */
export async function ensureDailyQuests(db: Tx | typeof prisma, userId: string, now = new Date()) {
  const day = dayDate(now);
  const picked = pickDailyQuests(questDay(now, timeZone), templates, perDay);
  await db.dailyQuest.createMany({
    data: picked.map((t) => ({ userId, day, kind: t.kind, target: t.target, reward: t.reward })),
    skipDuplicates: true,
  });
  return day;
}

export interface QuestProgressed {
  kind: string;
  label: string;
  reward: number;
}

/** Fait avancer une quête ; renvoie la quête si elle vient d'être terminée. */
export async function bumpQuest(tx: Tx, userId: string, kind: QuestKind, amount: number, now = new Date()): Promise<QuestProgressed | null> {
  if (amount <= 0) return null;
  await ensureDailyQuests(tx, userId, now);
  // L'appelant a verrouillé la ligne du joueur : les actions d'un même joueur sont sérialisées.
  const rows = await tx.$queryRaw<{ progress: number; target: number; reward: number; before: number }[]>`
    UPDATE "DailyQuest" q SET progress = LEAST(q.target, q.progress + ${amount})
    FROM (SELECT id, progress AS before FROM "DailyQuest"
          WHERE "userId" = ${userId} AND day = ${questDay(now, timeZone)}::date AND kind = ${kind}) old
    WHERE q.id = old.id AND q."claimedAt" IS NULL
    RETURNING q.progress, q.target, q.reward, old.before`;
  const row = rows[0];
  if (!row || row.before >= row.target || row.progress < row.target) return null;
  const tpl = templates.find((t) => t.kind === kind);
  return { kind, label: tpl?.labelFr ?? kind, reward: row.reward };
}

export interface QuestView {
  id: string;
  kind: string;
  label: string;
  target: number;
  progress: number;
  reward: number;
  claimed: boolean;
}

export async function getDailyQuests(userId: string, now = new Date()): Promise<{ quests: QuestView[]; resetAt: string }> {
  const day = await ensureDailyQuests(prisma, userId, now);
  const rows = await prisma.dailyQuest.findMany({ where: { userId, day }, orderBy: { kind: "asc" } });
  const order = templates.map((t) => t.kind as string);
  const quests = rows
    .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))
    .map((q) => ({
      id: q.id,
      kind: q.kind,
      label: templates.find((t) => t.kind === q.kind)?.labelFr ?? q.kind,
      target: q.target,
      progress: q.progress,
      reward: q.reward,
      claimed: q.claimedAt !== null,
    }));
  return { quests, resetAt: nextQuestReset(now, timeZone).toISOString() };
}

export class QuestError extends Error {
  constructor(
    readonly code: "not_found" | "not_done" | "already_claimed",
    message: string,
  ) {
    super(message);
    this.name = "QuestError";
  }
}

/** Réclame la récompense d'une quête terminée (une seule fois, même avec des clics simultanés). */
export async function claimQuest(userId: string, questId: string) {
  return prisma.$transaction(async (tx) => {
    await lockUser(tx, userId);
    const [q] = await tx.$queryRaw<{ id: string; progress: number; target: number; reward: number; claimedAt: Date | null; kind: string }[]>`
      SELECT id, progress, target, reward, "claimedAt", kind FROM "DailyQuest" WHERE id = ${questId} AND "userId" = ${userId} FOR UPDATE`;
    if (!q) throw new QuestError("not_found", "Quête introuvable.");
    if (q.claimedAt) throw new QuestError("already_claimed", "Récompense déjà réclamée.");
    if (q.progress < q.target) throw new QuestError("not_done", "Cette quête n'est pas encore terminée.");
    await tx.dailyQuest.update({ where: { id: q.id }, data: { claimedAt: new Date() } });
    const balance = await applyLedger(tx, { userId, delta: q.reward, reason: "quest", refType: "quest", refId: q.id, meta: { kind: q.kind } });
    return { reward: q.reward, balance };
  });
}
