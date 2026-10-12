/**
 * Minuteur des boosters gratuits, calculé paresseusement.
 *
 * On ne stocke que `stock` (boosters déjà crédités) et `anchorAt` (instant à partir
 * duquel court la recharge suivante). Le nombre disponible se déduit de l'heure
 * serveur : aucun cron, et rien que le client puisse falsifier.
 *
 * Quand le stock atteint le plafond, le minuteur est en pause : l'ancre est
 * ramenée à « maintenant » au moment où l'on consomme un booster.
 */

export interface BoosterTimerConfig {
  refillIntervalMs: number;
  maxStock: number;
}

export interface StoredBoosterState {
  stock: number;
  anchorAt: Date;
}

export interface BoosterStatus {
  /** Boosters disponibles maintenant. */
  available: number;
  maxStock: number;
  /** Instant de la prochaine recharge, `null` si le stock est plein. */
  nextAt: Date | null;
}

function clampStock(n: number, max: number): number {
  return Math.max(0, Math.min(max, n));
}

/** Projette l'état stocké à l'instant `now` et le renvoie sous forme normalisée. */
export function materializeBoosters(
  state: StoredBoosterState,
  now: Date,
  cfg: BoosterTimerConfig,
): StoredBoosterState {
  const stock = clampStock(state.stock, cfg.maxStock);
  if (stock >= cfg.maxStock) {
    return { stock: cfg.maxStock, anchorAt: now };
  }
  const elapsed = Math.max(0, now.getTime() - state.anchorAt.getTime());
  const gained = Math.floor(elapsed / cfg.refillIntervalMs);
  const total = stock + gained;
  if (total >= cfg.maxStock) {
    return { stock: cfg.maxStock, anchorAt: now };
  }
  return {
    stock: total,
    anchorAt: new Date(state.anchorAt.getTime() + gained * cfg.refillIntervalMs),
  };
}

/** État lisible par l'interface. */
export function boosterStatus(
  state: StoredBoosterState,
  now: Date,
  cfg: BoosterTimerConfig,
): BoosterStatus {
  const m = materializeBoosters(state, now, cfg);
  return {
    available: m.stock,
    maxStock: cfg.maxStock,
    nextAt:
      m.stock >= cfg.maxStock ? null : new Date(m.anchorAt.getTime() + cfg.refillIntervalMs),
  };
}

export class NoBoosterAvailableError extends Error {
  constructor() {
    super("Aucun booster disponible");
    this.name = "NoBoosterAvailableError";
  }
}

/**
 * Consomme un booster à l'instant `now` et renvoie le nouvel état à persister.
 * Lève `NoBoosterAvailableError` si le stock est vide.
 */
export function consumeBooster(
  state: StoredBoosterState,
  now: Date,
  cfg: BoosterTimerConfig,
): StoredBoosterState {
  const m = materializeBoosters(state, now, cfg);
  if (m.stock <= 0) throw new NoBoosterAvailableError();
  // Si on était plein, la recharge redémarre maintenant ; sinon l'ancre court toujours.
  return { stock: m.stock - 1, anchorAt: m.stock >= cfg.maxStock ? now : m.anchorAt };
}
