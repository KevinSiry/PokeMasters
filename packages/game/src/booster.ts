import { FINISHES, TIERS, type Finish, type Tier } from "@pokeflex/config";
import { type Rng, weightedPick } from "./rng";

/** Nombre de cartes tirables par tier dans le pool (catalogue entier ou un set). */
export type TierPoolSizes = Readonly<Record<Tier, number>>;

export class EmptyPoolError extends Error {
  constructor() {
    super("Aucune carte tirable dans ce pool");
    this.name = "EmptyPoolError";
  }
}

/** Poids effectifs : un tier vide (vieux set sans Mythique…) est ignoré, son poids redistribué. */
function effectiveWeights(weights: Readonly<Record<Tier, number>>, pools: TierPoolSizes): Record<Tier, number> {
  const out = {} as Record<Tier, number>;
  for (const t of TIERS) out[t] = pools[t] > 0 ? weights[t] : 0;
  return out;
}

export interface BoosterSlotSpec {
  count: number;
  tiers: Readonly<Partial<Record<Tier, number>>>;
  finishWeights?: Readonly<Partial<Record<Finish, number>>>;
}

export interface DrawnSlot {
  tier: Tier;
  /** Poids de finition propres à l'emplacement (sinon les poids globaux). */
  finishWeights?: Readonly<Partial<Record<Finish, number>>>;
}

/**
 * Tire le tier de chaque emplacement d'un booster, dans l'ordre des emplacements (l'ordre de
 * révélation d'un vrai paquet : la rare à la fin). Un emplacement dont aucun tier n'existe dans
 * le pool se rabat sur `fallback`, restreint aux tiers présents.
 */
export function drawBoosterSlots(
  layout: readonly BoosterSlotSpec[],
  pools: TierPoolSizes,
  fallback: Readonly<Record<Tier, number>>,
  rng: Rng,
): DrawnSlot[] {
  const backup = effectiveWeights(fallback, pools);
  if (Object.values(backup).every((w) => w === 0)) throw new EmptyPoolError();
  const out: DrawnSlot[] = [];
  for (const slot of layout) {
    const w = {} as Record<Tier, number>;
    for (const t of TIERS) w[t] = pools[t] > 0 ? (slot.tiers[t] ?? 0) : 0;
    const weights = Object.values(w).some((x) => x > 0) ? w : backup;
    for (let i = 0; i < slot.count; i++) out.push({ tier: weightedPick(weights, rng), ...(slot.finishWeights ? { finishWeights: slot.finishWeights } : {}) });
  }
  return out;
}

/** Espérance d'une valeur par tier (recyclage…) sur un booster, pool complet. */
export function expectedLayoutValue(layout: readonly BoosterSlotSpec[], values: Readonly<Record<Tier, number>>): number {
  return layout.reduce((sum, slot) => {
    const total = TIERS.reduce((s, t) => s + (slot.tiers[t] ?? 0), 0);
    return sum + slot.count * TIERS.reduce((s, t) => s + ((slot.tiers[t] ?? 0) / total) * values[t], 0);
  }, 0);
}

/**
 * Choisit la finition d'un exemplaire parmi celles que la carte possède réellement.
 * Sans variante connue : finition normale.
 */
export function drawFinish(
  available: Partial<Record<Finish, boolean>> | null | undefined,
  weights: Readonly<Partial<Record<Finish, number>>>,
  rng: Rng,
): Finish {
  const w = {} as Record<Finish, number>;
  for (const f of FINISHES) w[f] = available?.[f] ? (weights[f] ?? 0) : 0;
  if (Object.values(w).every((x) => x === 0)) return "normal";
  return weightedPick(w, rng);
}

/** Index uniforme d'une carte dans un pool de taille `n`. */
export function drawIndex(n: number, rng: Rng): number {
  if (n <= 0) throw new EmptyPoolError();
  return rng.int(n);
}

/** Espérance de la valeur de recyclage d'un booster (sert aux tests d'équilibrage). */
export function expectedTierShare(weights: Readonly<Record<Tier, number>>): Record<Tier, number> {
  const total = TIERS.reduce((s, t) => s + weights[t], 0);
  return Object.fromEntries(TIERS.map((t) => [t, weights[t] / total])) as Record<Tier, number>;
}
