import { describe, expect, it } from "vitest";
import { answerPoints, buildQuestion, duelOutcome, duelReward, generateQuiz, isOnTime, QUESTION_KINDS, type QuizCard, type QuizPool } from "./duel";
import { seededRng } from "./rng";

const typeLabels = {
  grass: "Plante", fire: "Feu", water: "Eau", lightning: "Électrique", psychic: "Psy", fighting: "Combat",
  darkness: "Obscurité", metal: "Métal", fairy: "Fée", dragon: "Dragon", colorless: "Incolore",
};

const pool: QuizPool = {
  illustrators: ["Ken Sugimori", "Mitsuhiro Arita", "Atsuko Nishida", "Kagemaru Himeno", "5ban Graphics", "Yuka Morii"],
  sets: [
    { id: "base1", name: "Set de Base", serieId: "base" },
    { id: "base2", name: "Jungle", serieId: "base" },
    { id: "base3", name: "Fossile", serieId: "base" },
    { id: "base4", name: "Set de Base 2", serieId: "base" },
    { id: "sv01", name: "Écarlate et Violet", serieId: "sv" },
    { id: "sv03.5", name: "151", serieId: "sv" },
  ],
  attackNames: ["Charge", "Lance-Flammes", "Pistolet à O", "Tonnerre", "Fouet Lianes", "Psyko", "Ultralaser"],
  typeLabels,
};

const card = (id: string, over: Partial<QuizCard> = {}): QuizCard => ({
  id,
  name: `Pokémon ${id}`,
  image: `https://assets.tcgdex.net/fr/base/base1/${id}`,
  category: "pokemon",
  hp: 60,
  types: ["fire"],
  weaknesses: ["water"],
  illustrator: "Ken Sugimori",
  setId: "base1",
  setName: "Set de Base",
  serieId: "base",
  attacks: ["Flammèche"],
  retreat: 1,
  dexIds: [4],
  ...over,
});

const six = ["a", "b", "c", "d", "e", "f"].map((id, i) => card(id, { hp: 40 + i * 10, dexIds: [10 + i] }));

describe("générateur de questions", () => {
  it("est déterministe pour une même graine", () => {
    expect(generateQuiz("graine", six, pool, 10)).toEqual(generateQuiz("graine", six, pool, 10));
    expect(generateQuiz("graine", six, pool, 10)).not.toEqual(generateQuiz("autre", six, pool, 10));
  });

  it("produit 10 questions à 4 choix distincts contenant la bonne réponse", () => {
    for (const seed of ["1", "2", "3", "4", "5", "6", "7", "8"]) {
      const quiz = generateQuiz(seed, six, pool, 10);
      expect(quiz).toHaveLength(10);
      for (const q of quiz) {
        expect(q.choices).toHaveLength(4);
        expect(new Set(q.choices).size).toBe(4);
        expect(q.answer).toBeGreaterThanOrEqual(0);
        expect(q.answer).toBeLessThan(4);
      }
    }
  });

  it("répartit les questions entre les cartes sans répéter un gabarit sur une carte", () => {
    const quiz = generateQuiz("répartition", six, pool, 10);
    const perCard = new Map<string, number>();
    const pairs = new Set<string>();
    for (const q of quiz) {
      perCard.set(q.cardId, (perCard.get(q.cardId) ?? 0) + 1);
      const key = `${q.cardId}:${q.kind}`;
      expect(pairs.has(key)).toBe(false);
      pairs.add(key);
    }
    expect(Math.max(...perCard.values()) - Math.min(...perCard.values())).toBeLessThanOrEqual(1);
    expect(new Set(quiz.map((q) => q.kind)).size).toBeGreaterThanOrEqual(5);
  });

  it("ignore un gabarit quand la carte n'a pas la donnée", () => {
    const trainer = card("t", { category: "trainer", hp: null, types: [], weaknesses: [], attacks: [], retreat: null, dexIds: [] });
    const rng = seededRng(1);
    for (const kind of ["type", "hp", "weakness", "attack", "retreat", "dex"] as const) {
      expect(buildQuestion(trainer, kind, pool, rng)).toBeNull();
    }
    expect(buildQuestion(trainer, "illustrator", pool, rng)).not.toBeNull();
    expect(buildQuestion(card("x", { image: null }), "set", pool, rng)).toBeNull();
  });

  it("ne montre la carte que si elle ne donne pas la réponse", () => {
    const rng = seededRng(3);
    for (const kind of QUESTION_KINDS) {
      const q = buildQuestion(card("v"), kind, pool, rng);
      expect(q).not.toBeNull();
      expect(Boolean(q!.image)).toBe(kind === "illustrator" || kind === "set");
    }
  });

  it("propose d'abord des sets de la même série", () => {
    const q = buildQuestion(card("s"), "set", pool, seededRng(9))!;
    expect(q.choices.every((c) => ["Set de Base", "Jungle", "Fossile", "Set de Base 2"].includes(c))).toBe(true);
  });

  it("ne propose jamais une autre attaque de la carte comme mauvaise réponse", () => {
    const c = card("m", { attacks: ["Charge", "Ultralaser"] });
    for (let s = 0; s < 20; s++) {
      const q = buildQuestion(c, "attack", pool, seededRng(s))!;
      const wrong = q.choices.filter((_, i) => i !== q.answer);
      expect(wrong).not.toContain("Charge");
      expect(wrong).not.toContain("Ultralaser");
    }
  });

  it("renvoie moins de questions si les cartes manquent de matière", () => {
    const poor = [card("p", { category: "energy", hp: null, types: [], weaknesses: [], attacks: [], retreat: null, dexIds: [] })];
    expect(generateQuiz("x", poor, pool, 10).length).toBeLessThanOrEqual(2);
  });
});

describe("score", () => {
  const cfg = { pointsPerCorrect: 100, maxSpeedBonus: 50 };
  it("donne 100 points plus un bonus de vitesse", () => {
    expect(answerPoints(true, 0, 15_000, cfg)).toBe(150);
    expect(answerPoints(true, 7_500, 15_000, cfg)).toBe(125);
    expect(answerPoints(true, 15_000, 15_000, cfg)).toBe(100);
    expect(answerPoints(true, 20_000, 15_000, cfg)).toBe(100);
    expect(answerPoints(false, 0, 15_000, cfg)).toBe(0);
  });

  it("désigne le gagnant ou l'égalité", () => {
    expect(duelOutcome(300, 200)).toBe("a");
    expect(duelOutcome(200, 300)).toBe("b");
    expect(duelOutcome(250, 250)).toBe("draw");
  });

  it("plafonne les duels récompensés par jour", () => {
    const r = { rewards: { win: 60, draw: 25, loss: 10 }, rewardedDuelsPerDay: 10 };
    expect(duelReward("win", 0, r)).toBe(60);
    expect(duelReward("draw", 9, r)).toBe(25);
    expect(duelReward("loss", 10, r)).toBe(0);
  });

  it("refuse une réponse arrivée après l'échéance", () => {
    expect(isOnTime(1000, 1000)).toBe(true);
    expect(isOnTime(1001, 1000)).toBe(false);
  });
});
