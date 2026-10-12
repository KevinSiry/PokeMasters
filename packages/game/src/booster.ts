import { FINISHES, TIERS, type Finish, type Tier, tierRank } from "@pokeflex/config";
import { type Rng, weightedPick } from "./rng";

export interface BoosterDrawConfig {
  size: number;
  tierWeights: Readonly<Record<Tier, number>>;
  guaranteedMinTier: Tier;
}

/** Nombre de cartes tirables par tier dans le pool (catalogue entier ou un set). */
export type TierPoolSizes = Readonly<Record<Tier, number>>;

export class EmptyPoolError extends Error {
  constructor() {
    super("Aucune carte tirable dans ce pool");
    this.name = "EmptyPoolError";
  }
}

/** Poids effectifs : un tier vide (vieux set sans Mythique…) est ignoré, son poids redistribué. */
function effectiveWeights(
  weights: Readonly<Record<Tier, number>>,
  pools: TierPoolSizes,
  minTier?: Tier,
): Record<Tier, number> {
  const out = {} as Record<Tier, number>;
  for (const t of TIERS) {
    const allowed = pools[t] > 0 && (!minTier || tierRank(t) >= tierRank(minTier));
    out[t] = allowed ? weights[t] : 0;
  }
  return out;
}

/**
 * Tire les tiers des emplacements d'un booster.
 * Garantie : si aucun emplacement n'atteint `guaranteedMinTier`, le dernier est
 * retiré parmi les tiers ≥ ce minimum (s'il en existe dans le pool).
 * Le résultat est trié du moins rare au plus rare : la meilleure carte se révèle en dernier.
 */
export function drawBoosterTiers(cfg: BoosterDrawConfig, pools: TierPoolSizes, rng: Rng): Tier[] {
  const weights = effectiveWeights(cfg.tierWeights, pools);
  if (Object.values(weights).every((w) => w === 0)) throw new EmptyPoolError();
  const tiers: Tier[] = Array.from({ length: cfg.size }, () => weightedPick(weights, rng));

  const min = tierRank(cfg.guaranteedMinTier);
  if (!tiers.some((t) => tierRank(t) >= min)) {
    const guaranteed = effectiveWeights(cfg.tierWeights, pools, cfg.guaranteedMinTier);
    if (Object.values(guaranteed).some((w) => w > 0)) {
      tiers[tiers.length - 1] = weightedPick(guaranteed, rng);
    }
  }
  return tiers.sort((a, b) => tierRank(a) - tierRank(b));
}

/**
 * Choisit la finition d'un exemplaire parmi celles que la carte possède réellement.
 * Sans variante connue : finition normale.
 */
export function drawFinish(
  available: Partial<Record<Finish, boolean>> | null | undefined,
  weights: Readonly<Record<Finish, number>>,
  rng: Rng,
): Finish {
  const w = {} as Record<Finish, number>;
  for (const f of FINISHES) w[f] = available?.[f] ? weights[f] : 0;
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
