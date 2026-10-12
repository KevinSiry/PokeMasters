import { randomInt } from "node:crypto";

/**
 * Source d'aléa injectable : `int(n)` renvoie un entier uniforme dans [0, n).
 * En production on utilise `cryptoRng` ; les tests utilisent `seededRng` pour être déterministes.
 */
export interface Rng {
  int(maxExclusive: number): number;
}

export const cryptoRng: Rng = {
  int(maxExclusive) {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
      throw new RangeError(`maxExclusive doit être un entier > 0 (reçu ${maxExclusive})`);
    }
    return randomInt(maxExclusive);
  },
};

/** Générateur déterministe (mulberry32) pour les tests et le générateur de questions de duel. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    int(maxExclusive) {
      if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
        throw new RangeError(`maxExclusive doit être un entier > 0 (reçu ${maxExclusive})`);
      }
      return Math.floor(next() * maxExclusive);
    },
  };
}

/**
 * Tire une clé selon des poids entiers positifs. Les clés de poids nul sont ignorées.
 * Lève une erreur si aucune clé n'a de poids.
 */
export function weightedPick<K extends string>(weights: Readonly<Record<K, number>>, rng: Rng): K {
  const entries = (Object.entries(weights) as [K, number][]).filter(([, w]) => w > 0);
  if (entries.length === 0) throw new Error("weightedPick : aucun poids positif");
  for (const [k, w] of entries) {
    if (!Number.isInteger(w)) throw new Error(`weightedPick : poids non entier pour ${k}`);
  }
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let roll = rng.int(total);
  for (const [k, w] of entries) {
    if (roll < w) return k;
    roll -= w;
  }
  // Inatteignable : roll < total.
  return entries[entries.length - 1]![0];
}
