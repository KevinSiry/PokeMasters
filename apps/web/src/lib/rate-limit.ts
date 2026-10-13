import { gameConfig } from "@pokeflex/config";
import { RateLimiter } from "@pokeflex/game";

export type ActionBucket = keyof typeof gameConfig.antiCheat.actionRate;

/**
 * Limite de débit des actions serveur, par joueur et par famille d'actions.
 * En mémoire du processus web (une seule instance en production) : un redémarrage remet les compteurs à zéro, sans conséquence.
 */
const limiters = new Map<ActionBucket, RateLimiter>();
const lastWarn = new Map<string, number>();

/** Message d'erreur si le joueur dépasse la limite, null sinon (l'action est alors comptée). */
export function checkActionRate(uid: string, bucket: ActionBucket, now = Date.now()): string | null {
  const { count, windowMs } = gameConfig.antiCheat.actionRate[bucket];
  let limiter = limiters.get(bucket);
  if (!limiter) limiters.set(bucket, (limiter = new RateLimiter(count, windowMs)));
  if (limiter.take(uid, now)) return null;

  // Un seul avertissement par joueur et par fenêtre : les journaux restent lisibles même sous un script.
  const key = `${bucket}:${uid}`;
  if (now - (lastWarn.get(key) ?? 0) >= windowMs) {
    lastWarn.set(key, now);
    console.warn(`[anti-triche] limite atteinte : ${bucket}, joueur ${uid}, ${count} actions par ${windowMs / 1000} s`);
  }
  const seconds = Math.max(1, Math.ceil(limiter.retryIn(uid, now) / 1000));
  return `Doucement\u00a0! Trop d'actions d'affilée, réessaie dans ${seconds}\u00a0s.`;
}
