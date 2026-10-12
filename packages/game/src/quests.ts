import { seededRng } from "./rng";

export interface QuestTemplate {
  kind: string;
  target: number;
  reward: number;
  labelFr: string;
  enabled: boolean;
}

/** Jour de jeu (« AAAA-MM-JJ ») dans le fuseau des quêtes. */
export function questDay(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Prochain changement de jour (minuit dans le fuseau), à la minute près, changements d'heure compris. */
export function nextQuestReset(now: Date, timeZone: string): Date {
  const today = questDay(now, timeZone);
  // Recherche par pas d'une heure puis d'une minute : simple et juste aux changements d'heure.
  let t = now.getTime();
  while (questDay(new Date(t + 3_600_000), timeZone) === today) t += 3_600_000;
  while (questDay(new Date(t), timeZone) === today) t += 60_000;
  return new Date(Math.floor(t / 60_000) * 60_000);
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Quêtes du jour : identiques pour tous les joueurs un jour donné, parmi les modèles actifs. */
export function pickDailyQuests<T extends QuestTemplate>(day: string, templates: readonly T[], perDay: number): T[] {
  const active = templates.filter((t) => t.enabled);
  if (active.length <= perDay) return active;
  const rng = seededRng(hash(day));
  const pool = [...active];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  const picked = new Set(pool.slice(0, perDay));
  return active.filter((t) => picked.has(t));
}

/** Progression après un événement, plafonnée à la cible. */
export function advanceQuest(progress: number, target: number, amount: number): number {
  return Math.min(target, Math.max(0, progress) + Math.max(0, amount));
}
