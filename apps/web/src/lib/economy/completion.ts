/**
 * Sets complétés. Un set est complet quand le joueur possède toutes ses cartes tirables
 * (les cartes sans image ne sortent jamais d'un booster, elles ne comptent pas).
 */
import { gameConfig } from "@pokeflex/config";
import { setCompletionBonus } from "@pokeflex/game";
import { applyLedger, type Tx } from "./ledger";

export interface CompletedSet {
  setId: string;
  name: string;
  bonus: number;
}

/** Vérifie les sets touchés par une acquisition et verse le bonus des sets nouvellement complétés. */
export async function checkSetCompletions(tx: Tx, userId: string, setIds: string[]): Promise<CompletedSet[]> {
  const ids = [...new Set(setIds)];
  if (ids.length === 0) return [];
  const done = await tx.$queryRaw<{ id: string; name: string; official: number }[]>`
    SELECT s.id, s.name, s."cardCountOfficial" AS official
    FROM "Set" s
    JOIN "Card" c ON c."setId" = s.id AND c.droppable
    LEFT JOIN (SELECT DISTINCT "cardId" FROM "CardCopy" WHERE "ownerId" = ${userId}) o ON o."cardId" = c.id
    WHERE s.id = ANY(${ids}::text[])
      AND NOT EXISTS (SELECT 1 FROM "SetCompletion" sc WHERE sc."userId" = ${userId} AND sc."setId" = s.id)
    GROUP BY s.id
    HAVING count(c.id) > 0 AND count(o."cardId") = count(c.id)`;
  const out: CompletedSet[] = [];
  for (const s of done) {
    const bonus = setCompletionBonus(s.official, gameConfig.economy.setCompletionBonusPerCard);
    const inserted = await tx.setCompletion.createMany({ data: [{ userId, setId: s.id, bonus }], skipDuplicates: true });
    if (inserted.count === 0) continue;
    await applyLedger(tx, { userId, delta: bonus, reason: "set_bonus", refType: "set", refId: s.id, meta: { name: s.name } });
    out.push({ setId: s.id, name: s.name, bonus });
  }
  return out;
}
