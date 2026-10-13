/** Recyclage d'exemplaires contre des Jetons. Seuls les exemplaires « possédés » (ni en vente ni misés) se recyclent. */
import { TIERS, gameConfig, type Tier } from "@pokeflex/config";
import { prisma } from "@pokeflex/db";
import { pickDuplicates, recyclePayout, type RecyclePayout } from "@pokeflex/game";
import { applyLedger, lockUser, type Tx } from "./ledger";
import { getFavoriteCardIds } from "./lists";
import { bumpQuest, type QuestProgressed } from "./quests";

export class RecycleError extends Error {
  constructor(
    readonly code: "empty" | "unavailable",
    message: string,
  ) {
    super(message);
    this.name = "RecycleError";
  }
}

export interface RecycleResult extends RecyclePayout {
  balance: number;
  questsDone: QuestProgressed[];
}

async function ownedCopies(db: Tx | typeof prisma, userId: string) {
  const rows = await db.cardCopy.findMany({
    where: { ownerId: userId, status: "owned" },
    select: { id: true, cardId: true, finish: true, obtainedAt: true, card: { select: { tier: true } } },
  });
  return rows.map((r) => ({ id: r.id, cardId: r.cardId, finish: r.finish, obtainedAt: r.obtainedAt, tier: r.card.tier }));
}

async function recycleInTx(tx: Tx, userId: string, items: { id: string; tier: Tier }[], kind: "single" | "duplicates") {
  if (items.length === 0) throw new RecycleError("empty", "Rien à recycler.");
  const deleted = await tx.cardCopy.deleteMany({ where: { id: { in: items.map((i) => i.id) }, ownerId: userId, status: "owned" } });
  if (deleted.count !== items.length) throw new RecycleError("unavailable", "Cet exemplaire n'est plus disponible.");
  const payout = recyclePayout(items, gameConfig.economy.recycleValue);
  const balance = await applyLedger(tx, {
    userId,
    delta: payout.total,
    reason: "recycle",
    refType: kind,
    meta: { count: payout.count, byTier: Object.fromEntries(TIERS.filter((t) => payout.byTier[t] > 0).map((t) => [t, payout.byTier[t]])) },
  });
  const quest = await bumpQuest(tx, userId, "recycle_cards", payout.count);
  return { ...payout, balance, questsDone: quest ? [quest] : [] };
}

/** Recycle un exemplaire précis. */
export async function recycleCopy(userId: string, copyId: string): Promise<RecycleResult> {
  return prisma.$transaction(async (tx) => {
    await lockUser(tx, userId);
    const copy = await tx.cardCopy.findFirst({
      where: { id: copyId, ownerId: userId, status: "owned" },
      select: { id: true, card: { select: { tier: true } } },
    });
    if (!copy) throw new RecycleError("unavailable", "Cet exemplaire n'est plus disponible.");
    return recycleInTx(tx, userId, [{ id: copy.id, tier: copy.card.tier }], "single");
  });
}

/** Aperçu du recyclage des doublons (un exemplaire gardé par carte, favoris épargnés), par tier. */
export async function previewDuplicates(userId: string) {
  const dups = pickDuplicates(await ownedCopies(prisma, userId), undefined, await getFavoriteCardIds(userId));
  const values = gameConfig.economy.recycleValue;
  return TIERS.map((tier) => {
    const count = dups.filter((d) => d.tier === tier).length;
    return { tier, count, value: count * values[tier] };
  });
}

/** Recycle tous les doublons des tiers choisis (hors favoris), recalculés côté serveur au moment de l'action. */
export async function recycleDuplicates(userId: string, tiers: readonly Tier[]): Promise<RecycleResult> {
  const allowed = tiers.filter((t) => (TIERS as readonly string[]).includes(t));
  return prisma.$transaction(async (tx) => {
    await lockUser(tx, userId);
    const dups = pickDuplicates(await ownedCopies(tx, userId), allowed, await getFavoriteCardIds(userId, tx));
    if (dups.length === 0) throw new RecycleError("empty", "Aucun doublon à recycler.");
    return recycleInTx(tx, userId, dups, "duplicates");
  }, { timeout: 20_000 });
}
