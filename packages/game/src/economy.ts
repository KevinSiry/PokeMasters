import { TIERS, type Finish, type Tier } from "@pokeflex/config";

export class InsufficientFundsError extends Error {
  constructor(
    readonly balance: number,
    readonly needed: number,
  ) {
    super(`Solde insuffisant : ${balance} Jetons pour ${needed} nécessaires`);
    this.name = "InsufficientFundsError";
  }
}

/** Nouveau solde après un mouvement. Refuse un solde négatif ou un montant non entier. */
export function applyDelta(balance: number, delta: number): number {
  if (!Number.isSafeInteger(delta)) throw new RangeError(`Montant invalide : ${delta}`);
  const next = balance + delta;
  if (next < 0) throw new InsufficientFundsError(balance, -delta);
  return next;
}

/** Ordre de préférence des finitions à garder quand on recycle des doublons. */
const FINISH_KEEP_RANK: Record<Finish, number> = { normal: 0, reverse: 1, holo: 2, firstEdition: 3 };

export interface RecyclableCopy {
  id: string;
  cardId: string;
  tier: Tier;
  finish: Finish;
  obtainedAt: Date;
}

/**
 * Doublons à recycler : pour chaque carte, garde un exemplaire (la plus belle finition,
 * puis le plus ancien) et renvoie tous les autres. `tiers` limite le recyclage à certains tiers.
 */
export function pickDuplicates(copies: readonly RecyclableCopy[], tiers: readonly Tier[] = TIERS): RecyclableCopy[] {
  const byCard = new Map<string, RecyclableCopy[]>();
  for (const c of copies) byCard.set(c.cardId, [...(byCard.get(c.cardId) ?? []), c]);
  const allowed = new Set(tiers);
  const out: RecyclableCopy[] = [];
  for (const group of byCard.values()) {
    if (group.length < 2) continue;
    const sorted = [...group].sort(
      (a, b) =>
        FINISH_KEEP_RANK[b.finish] - FINISH_KEEP_RANK[a.finish] ||
        a.obtainedAt.getTime() - b.obtainedAt.getTime() ||
        a.id.localeCompare(b.id),
    );
    for (const c of sorted.slice(1)) if (allowed.has(c.tier)) out.push(c);
  }
  return out;
}

export interface RecyclePayout {
  total: number;
  count: number;
  byTier: Record<Tier, number>;
}

/** Jetons rapportés par un lot d'exemplaires recyclés. */
export function recyclePayout(items: readonly { tier: Tier }[], values: Readonly<Record<Tier, number>>): RecyclePayout {
  const byTier = Object.fromEntries(TIERS.map((t) => [t, 0])) as Record<Tier, number>;
  let total = 0;
  for (const it of items) {
    byTier[it.tier]++;
    total += values[it.tier];
  }
  return { total, count: items.length, byTier };
}

/** Bonus unique d'un set complété : multiplicateur × nombre officiel de cartes (au moins 1). */
export function setCompletionBonus(officialCount: number, perCard: number): number {
  return Math.max(1, officialCount) * perCard;
}

/** Valeur de recyclage moyenne d'un booster (sans la garantie), pour l'équilibrage. */
export function expectedBoosterValue(
  weights: Readonly<Record<Tier, number>>,
  values: Readonly<Record<Tier, number>>,
  size: number,
): number {
  const total = TIERS.reduce((s, t) => s + weights[t], 0);
  return size * TIERS.reduce((s, t) => s + (weights[t] / total) * values[t], 0);
}
