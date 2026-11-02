/**
 * Médailles (succès permanents à trois paliers) et missions de guilde hebdomadaires : calculs purs.
 */
import { questDay } from "./quests";

export const MEDAL_LEVELS = ["bronze", "silver", "gold"] as const;
export type MedalLevel = (typeof MEDAL_LEVELS)[number];

export interface MedalDef {
  id: string;
  metric: string;
  thresholds: readonly [number, number, number] | readonly number[];
}

/** Nombre de paliers atteints (0 à 3) pour une valeur. */
export function medalLevel(value: number, thresholds: readonly number[]): number {
  let n = 0;
  for (const t of thresholds.slice(0, MEDAL_LEVELS.length)) if (value >= t) n++;
  return n;
}

/** Paliers atteints mais pas encore enregistrés (`earned` : clés « id:palier »). */
export function medalsToAward(
  defs: readonly MedalDef[],
  values: Readonly<Record<string, number>>,
  earned: ReadonlySet<string>,
): { medalId: string; level: MedalLevel }[] {
  const out: { medalId: string; level: MedalLevel }[] = [];
  for (const def of defs) {
    const reached = medalLevel(values[def.metric] ?? 0, def.thresholds);
    for (let i = 0; i < reached; i++) {
      const level = MEDAL_LEVELS[i]!;
      if (!earned.has(`${def.id}:${level}`)) out.push({ medalId: def.id, level });
    }
  }
  return out;
}

/** Semaine de jeu : date (« AAAA-MM-JJ ») du lundi, dans le fuseau donné. */
export function weekKey(now: Date, timeZone: string): string {
  const day = questDay(now, timeZone);
  const d = new Date(`${day}T00:00:00Z`);
  const back = (d.getUTCDay() + 6) % 7; // lundi = 0
  d.setUTCDate(d.getUTCDate() - back);
  return d.toISOString().slice(0, 10);
}

function edge(now: Date, timeZone: string, dir: 1 | -1): Date {
  const key = weekKey(now, timeZone);
  let t = Math.floor(now.getTime() / 60_000) * 60_000;
  if (dir === -1) {
    while (weekKey(new Date(t - 3_600_000), timeZone) === key) t -= 3_600_000;
    while (weekKey(new Date(t - 60_000), timeZone) === key) t -= 60_000;
    return new Date(t);
  }
  while (weekKey(new Date(t + 3_600_000), timeZone) === key) t += 3_600_000;
  while (weekKey(new Date(t), timeZone) === key) t += 60_000;
  return new Date(t);
}

/** Début de la semaine en cours (lundi minuit dans le fuseau), changements d'heure compris. */
export function weekStart(now: Date, timeZone: string): Date {
  return edge(now, timeZone, -1);
}

/** Prochain lundi minuit dans le fuseau. */
export function nextWeekReset(now: Date, timeZone: string): Date {
  return edge(now, timeZone, 1);
}

/** Cible d'une mission de guilde selon le nombre de membres. */
export function missionTarget(def: { perMember: number; min: number }, members: number): number {
  return Math.max(def.min, Math.ceil(def.perMember * Math.max(0, members)));
}
