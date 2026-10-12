import type { Prisma, PrismaClient } from "@prisma/client";

export interface LedgerMismatch {
  id: string;
  handle: string | null;
  balance: number;
  sum: bigint | null;
  last_after: number | null;
}

/**
 * Joueurs dont le solde ne correspond pas au registre : SUM(delta) ≠ balance,
 * ou dernier balanceAfter ≠ balance. Liste vide = registre cohérent.
 */
export function auditLedger(db: PrismaClient | Prisma.TransactionClient): Promise<LedgerMismatch[]> {
  return db.$queryRaw<LedgerMismatch[]>`
    SELECT u.id, u.handle, u.balance, s.sum, s.last_after
    FROM "User" u
    LEFT JOIN LATERAL (
      SELECT sum(delta) AS sum,
             (SELECT "balanceAfter" FROM "LedgerEntry" l2 WHERE l2."userId" = u.id ORDER BY id DESC LIMIT 1) AS last_after
      FROM "LedgerEntry" l WHERE l."userId" = u.id
    ) s ON true
    WHERE u.balance <> coalesce(s.sum, 0) OR (s.last_after IS NOT NULL AND s.last_after <> u.balance)`;
}
