/**
 * Mouvements de Jetons. Toute modification de `User.balance` passe par `applyLedger`,
 * dans la transaction de l'action qui la provoque : SUM(delta) = balance, toujours.
 */
import { type LedgerReason, type Prisma, prisma } from "@pokeflex/db";
import { InsufficientFundsError } from "@pokeflex/game";

export type Tx = Prisma.TransactionClient;

export interface LedgerMove {
  userId: string;
  delta: number;
  reason: LedgerReason;
  refType?: string;
  refId?: string;
  meta?: Prisma.InputJsonObject;
}

/** Applique un mouvement et l'inscrit au registre. Lève `InsufficientFundsError` si le solde deviendrait négatif. */
export async function applyLedger(tx: Tx, move: LedgerMove): Promise<number> {
  if (!Number.isSafeInteger(move.delta) || move.delta === 0) throw new RangeError(`Montant invalide : ${move.delta}`);
  const rows = await tx.$queryRaw<{ balance: number }[]>`
    UPDATE "User" SET balance = balance + ${move.delta}
    WHERE id = ${move.userId} AND balance + ${move.delta} >= 0
    RETURNING balance`;
  const balance = rows[0]?.balance;
  if (balance === undefined) {
    const user = await tx.user.findUnique({ where: { id: move.userId }, select: { balance: true } });
    if (!user) throw new Error(`Joueur introuvable : ${move.userId}`);
    throw new InsufficientFundsError(user.balance, -move.delta);
  }
  await tx.ledgerEntry.create({
    data: {
      userId: move.userId,
      delta: move.delta,
      balanceAfter: balance,
      reason: move.reason,
      refType: move.refType,
      refId: move.refId,
      meta: move.meta,
    },
  });
  return balance;
}

/** Verrouille la ligne du joueur pour sérialiser ses actions (deux onglets, double clic…). */
export async function lockUser(tx: Tx, userId: string) {
  const [user] = await tx.$queryRaw<{ id: string; balance: number; boosterStock: number; boosterAnchorAt: Date }[]>`
    SELECT id, balance, "boosterStock", "boosterAnchorAt" FROM "User" WHERE id = ${userId} FOR UPDATE`;
  return user ?? null;
}

export const LEDGER_LABELS_FR: Record<LedgerReason, string> = {
  seed: "Jetons de démo",
  admin: "Ajustement",
  recycle: "Recyclage",
  set_booster: "Booster de set",
  set_bonus: "Set complété",
  quest: "Quête du jour",
  duel_win: "Duel gagné",
  duel_draw: "Duel nul",
  duel_loss: "Duel joué",
  market_fee: "Frais de mise en vente",
  market_sale: "Vente au marché",
  market_purchase: "Achat au marché",
  bid_hold: "Enchère réservée",
  bid_release: "Enchère libérée",
  guild_create: "Création de guilde",
};

export async function getLedger(userId: string, take = 50, before?: bigint) {
  return prisma.ledgerEntry.findMany({
    where: { userId, ...(before ? { id: { lt: before } } : {}) },
    orderBy: { id: "desc" },
    take,
  });
}

/** Verrouille plusieurs joueurs toujours dans le même ordre (par id) pour éviter les interblocages. */
export async function lockUsers(tx: Tx, userIds: string[]) {
  const ids = [...new Set(userIds)].sort();
  for (const id of ids) await lockUser(tx, id);
}

/**
 * Rejoue une transaction interrompue par un interblocage ou un conflit de sérialisation
 * (rare : deux joueurs qui agissent en même temps l'un sur l'autre).
 */
export async function withTxRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const retryable = /deadlock detected|could not serialize|P2034|40P01|40001/.test(msg) || (err as { code?: string }).code === "P2034";
      if (!retryable || i >= attempts) throw err;
      await new Promise((r) => setTimeout(r, 20 * i + Math.random() * 30));
    }
  }
}
