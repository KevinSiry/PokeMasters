/**
 * Sets complétés. Un set est complet quand le joueur possède toutes ses cartes tirables
 * (les cartes sans image ne sortent jamais d'un booster, elles ne comptent pas).
 */
import { gameConfig, officialRarity, officialRarityRank, officialRarityTier } from "@pokeflex/config";
import { rarityCompletionBonus, setCompletionBonus } from "@pokeflex/game";
import { applyLedger, type Tx } from "./ledger";

export interface CompletedSet {
  setId: string;
  /** Nom du set. */
  name: string;
  bonus: number;
  /** `set` : set entier ; `rarity` : toutes les cartes d'une rareté officielle du set. */
  kind: "set" | "rarity";
  /** Rareté complétée (kind = rarity), libellé officiel. */
  rarity?: string;
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
    out.push({ setId: s.id, name: s.name, bonus, kind: "set" });
  }
  return [...(await checkRarityCompletions(tx, userId, ids)), ...out];
}

/** Progression par rareté officielle d'un joueur dans un set (cartes tirables uniquement). */
export interface RarityProgress {
  rarity: string;
  total: number;
  owned: number;
  /** Bonus de la rareté (0 si elle compte trop peu de cartes). */
  bonus: number;
}

/** Calcule la progression par rareté officielle à partir des cartes tirables d'un set. */
export function rarityProgress(cards: { id: string; rarityRaw: string | null }[], owned: ReadonlySet<string>): RarityProgress[] {
  const groups = new Map<string, { total: number; owned: number }>();
  for (const c of cards) {
    const r = officialRarity(c.rarityRaw);
    if (!r) continue;
    const g = groups.get(r) ?? { total: 0, owned: 0 };
    g.total++;
    if (owned.has(c.id)) g.owned++;
    groups.set(r, g);
  }
  const { minCards, bonusPerCard } = gameConfig.economy.rarityCompletion;
  return [...groups]
    .map(([rarity, g]) => ({
      rarity,
      ...g,
      bonus: rarityCompletionBonus(g.total, bonusPerCard[officialRarityTier(rarity)], minCards),
    }))
    .sort((a, b) => officialRarityRank(a.rarity) - officialRarityRank(b.rarity));
}

/** Verse le bonus des raretés officielles nouvellement complétées dans les sets touchés. */
async function checkRarityCompletions(tx: Tx, userId: string, setIds: string[]): Promise<CompletedSet[]> {
  const [cards, owned, done] = await Promise.all([
    tx.card.findMany({
      where: { setId: { in: setIds }, droppable: true },
      select: { id: true, setId: true, rarityRaw: true, set: { select: { name: true } } },
    }),
    tx.cardCopy.findMany({
      where: { ownerId: userId, card: { setId: { in: setIds } } },
      select: { cardId: true },
      distinct: ["cardId"],
    }),
    tx.setRarityCompletion.findMany({ where: { userId, setId: { in: setIds } }, select: { setId: true, rarity: true } }),
  ]);
  const ownedIds = new Set(owned.map((o) => o.cardId));
  const already = new Set(done.map((d) => `${d.setId}\u0000${d.rarity}`));
  const out: CompletedSet[] = [];
  for (const setId of setIds) {
    const inSet = cards.filter((c) => c.setId === setId);
    if (inSet.length === 0) continue;
    for (const p of rarityProgress(inSet, ownedIds)) {
      if (p.bonus === 0 || p.owned < p.total || already.has(`${setId}\u0000${p.rarity}`)) continue;
      const inserted = await tx.setRarityCompletion.createMany({
        data: [{ userId, setId, rarity: p.rarity, bonus: p.bonus }],
        skipDuplicates: true,
      });
      if (inserted.count === 0) continue;
      const name = inSet[0]!.set.name;
      await applyLedger(tx, {
        userId,
        delta: p.bonus,
        reason: "rarity_bonus",
        refType: "set",
        refId: setId,
        meta: { name, rarity: p.rarity },
      });
      out.push({ setId, name, bonus: p.bonus, kind: "rarity", rarity: p.rarity });
    }
  }
  return out;
}
