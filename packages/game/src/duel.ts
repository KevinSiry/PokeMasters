/**
 * Duels quiz : générateur de questions et score (pur, sans I/O).
 *
 * Le générateur est déterministe : même graine + mêmes cartes + même réserve = mêmes questions.
 * Le serveur enregistre la graine du duel, ce qui permet de rejouer un duel en test.
 */
import { seededRng, type Rng } from "./rng";

export const QUESTION_KINDS = ["type", "hp", "weakness", "illustrator", "set", "attack", "retreat", "dex"] as const;
export type QuestionKind = (typeof QUESTION_KINDS)[number];

/** Ce qu'il faut savoir d'une carte pour en tirer des questions. */
export interface QuizCard {
  id: string;
  name: string;
  /** URL de base sur le CDN TCGdex, ou null. */
  image: string | null;
  category: "pokemon" | "trainer" | "energy";
  hp: number | null;
  /** Codes canoniques (fire, water…). */
  types: string[];
  weaknesses: string[];
  illustrator: string | null;
  setId: string;
  setName: string;
  serieId: string;
  attacks: string[];
  retreat: number | null;
  dexIds: number[];
}

/** Réserve de mauvaises réponses plausibles, construite par le serveur à partir du catalogue. */
export interface QuizPool {
  illustrators: string[];
  sets: { id: string; name: string; serieId: string }[];
  attackNames: string[];
  /** Libellé français de chaque type (code → libellé). */
  typeLabels: Record<string, string>;
}

export interface QuizQuestion {
  cardId: string;
  kind: QuestionKind;
  prompt: string;
  /** Carte à montrer avec la question (seulement quand la voir ne donne pas la réponse). */
  image: string | null;
  choices: string[];
  /** Index de la bonne réponse dans `choices`. Jamais envoyé au client avant la révélation. */
  answer: number;
}

/** Graine texte → entier 32 bits (FNV-1a). */
export function seedNumber(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return h >>> 0;
}

function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Prend `n` éléments distincts (sans `exclude`), dans l'ordre de préférence des listes. */
function pickDistinct(lists: readonly (readonly string[])[], n: number, exclude: ReadonlySet<string>, rng: Rng): string[] {
  const out: string[] = [];
  const seen = new Set(exclude);
  for (const list of lists) {
    for (const v of shuffle(list, rng)) {
      if (out.length >= n) return out;
      if (!v || seen.has(v)) continue;
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

/** Place la bonne réponse parmi les mauvaises, à une position aléatoire. */
function withChoices(
  base: Omit<QuizQuestion, "choices" | "answer">,
  correct: string,
  wrong: string[],
  size: number,
  rng: Rng,
): QuizQuestion | null {
  if (wrong.length < size - 1) return null;
  const choices = shuffle([correct, ...wrong.slice(0, size - 1)], rng);
  return { ...base, choices, answer: choices.indexOf(correct) };
}

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

/** Une question d'un gabarit donné sur une carte, ou null si la carte n'a pas la donnée. */
export function buildQuestion(card: QuizCard, kind: QuestionKind, pool: QuizPool, rng: Rng, size = 4): QuizQuestion | null {
  const label = `${card.name} (${card.setName})`;
  const base = { cardId: card.id, kind, image: null as string | null };
  const typeLabel = (code: string) => pool.typeLabels[code] ?? code;
  const allTypes = Object.keys(pool.typeLabels);

  switch (kind) {
    case "type": {
      const t = card.category === "pokemon" ? card.types[0] : undefined;
      if (!t) return null;
      const own = new Set(card.types.map(typeLabel));
      const wrong = pickDistinct([allTypes.filter((c) => c !== "colorless" || t === "colorless").map(typeLabel)], size - 1, own, rng);
      return withChoices({ ...base, prompt: `De quel type est ${label} ?` }, typeLabel(t), wrong, size, rng);
    }
    case "weakness": {
      const w = card.weaknesses[0];
      if (!w) return null;
      const wrong = pickDistinct([allTypes.filter((c) => c !== "colorless").map(typeLabel)], size - 1, new Set([typeLabel(w)]), rng);
      return withChoices({ ...base, prompt: `Quelle est la faiblesse de ${label} ?` }, typeLabel(w), wrong, size, rng);
    }
    case "hp": {
      if (!card.hp || card.category !== "pokemon") return null;
      const near = [-60, -50, -40, -30, -20, -10, 10, 20, 30, 40, 50, 60].map((d) => card.hp! + d).filter((v) => v >= 30);
      const fmt = (v: number) => `${v} PV`;
      const wrong = pickDistinct([near.map(fmt)], size - 1, new Set([fmt(card.hp)]), rng);
      return withChoices({ ...base, prompt: `Combien de PV a ${label} ?` }, fmt(card.hp), wrong, size, rng);
    }
    case "retreat": {
      if (card.retreat == null || card.category !== "pokemon") return null;
      const fmt = (v: number) => plural(v, "Énergie", "Énergies");
      const wrong = pickDistinct([[0, 1, 2, 3, 4, 5].map(fmt)], size - 1, new Set([fmt(card.retreat)]), rng);
      return withChoices({ ...base, prompt: `Quel est le coût de retraite de ${label} ?` }, fmt(card.retreat), wrong, size, rng);
    }
    case "dex": {
      const dex = card.dexIds[0];
      if (!dex || card.category !== "pokemon") return null;
      const fmt = (v: number) => `n° ${v}`;
      const near = [-30, -20, -12, -7, -3, -1, 1, 3, 7, 12, 20, 30].map((d) => dex + d).filter((v) => v >= 1 && v <= 1025);
      const wrong = pickDistinct([near.map(fmt)], size - 1, new Set([fmt(dex)]), rng);
      return withChoices({ ...base, prompt: `Quel est le numéro de Pokédex national de ${card.name} ?` }, fmt(dex), wrong, size, rng);
    }
    case "attack": {
      if (card.attacks.length === 0) return null;
      const correct = card.attacks[rng.int(card.attacks.length)]!;
      const wrong = pickDistinct([pool.attackNames], size - 1, new Set(card.attacks), rng);
      return withChoices({ ...base, prompt: `Laquelle de ces attaques appartient à ${label} ?` }, correct, wrong, size, rng);
    }
    case "illustrator": {
      if (!card.illustrator || !card.image) return null;
      const wrong = pickDistinct([pool.illustrators], size - 1, new Set([card.illustrator]), rng);
      return withChoices({ ...base, image: card.image, prompt: "Qui a illustré cette carte ?" }, card.illustrator, wrong, size, rng);
    }
    case "set": {
      if (!card.image) return null;
      // Mauvaises réponses plausibles : d'abord les sets de la même série.
      const sameSerie = pool.sets.filter((s) => s.serieId === card.serieId && s.id !== card.setId).map((s) => s.name);
      const others = pool.sets.filter((s) => s.serieId !== card.serieId).map((s) => s.name);
      const wrong = pickDistinct([sameSerie, others], size - 1, new Set([card.setName]), rng);
      return withChoices({ ...base, image: card.image, prompt: "De quel set vient cette carte ?" }, card.setName, wrong, size, rng);
    }
  }
}

/**
 * Questions d'un duel : réparties équitablement entre les cartes, gabarits variés,
 * jamais deux fois le même gabarit sur la même carte. Peut en renvoyer moins que `count`
 * si les cartes ne donnent pas assez de matière.
 */
export function generateQuiz(seed: string, cards: readonly QuizCard[], pool: QuizPool, count: number, size = 4): QuizQuestion[] {
  const rng = seededRng(seedNumber(seed));
  const order = shuffle(cards, rng);
  const used = new Map<string, Set<QuestionKind>>(order.map((c) => [c.id, new Set()]));
  const kindUse = new Map<QuestionKind, number>(QUESTION_KINDS.map((k) => [k, 0]));
  const out: QuizQuestion[] = [];

  let progressed = true;
  while (out.length < count && progressed) {
    progressed = false;
    for (const card of order) {
      if (out.length >= count) break;
      const done = used.get(card.id)!;
      // Gabarits les moins utilisés d'abord, à égalité dans un ordre aléatoire.
      const kinds = shuffle(
        QUESTION_KINDS.filter((k) => !done.has(k)),
        rng,
      ).sort((a, b) => kindUse.get(a)! - kindUse.get(b)!);
      for (const kind of kinds) {
        done.add(kind);
        const q = buildQuestion(card, kind, pool, rng, size);
        if (!q) continue;
        out.push(q);
        kindUse.set(kind, kindUse.get(kind)! + 1);
        progressed = true;
        break;
      }
    }
  }
  return out;
}

/** Points d'une réponse : base si juste, plus un bonus de vitesse décroissant linéairement. */
export function answerPoints(
  correct: boolean,
  answeredMs: number,
  timeMs: number,
  cfg: { pointsPerCorrect: number; maxSpeedBonus: number },
): number {
  if (!correct) return 0;
  const left = Math.min(1, Math.max(0, 1 - answeredMs / timeMs));
  return cfg.pointsPerCorrect + Math.round(cfg.maxSpeedBonus * left);
}

export type DuelSide = "a" | "b";
export type DuelOutcome = DuelSide | "draw";

export function duelOutcome(scoreA: number, scoreB: number): DuelOutcome {
  return scoreA === scoreB ? "draw" : scoreA > scoreB ? "a" : "b";
}

/** Jetons gagnés à la fin d'un duel, selon le résultat et le nombre de duels déjà récompensés aujourd'hui. */
export function duelReward(
  result: "win" | "draw" | "loss",
  rewardedToday: number,
  cfg: { rewards: { win: number; draw: number; loss: number }; rewardedDuelsPerDay: number },
): number {
  if (rewardedToday >= cfg.rewardedDuelsPerDay) return 0;
  return cfg.rewards[result];
}

/** Une réponse est acceptée seulement si elle arrive avant l'échéance (horloge serveur). */
export function isOnTime(receivedAt: number, deadline: number): boolean {
  return receivedAt <= deadline;
}
