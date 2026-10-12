import type { QuizQuestion } from "@pokeflex/game";
import { describe, expect, it, vi } from "vitest";
import { BOT_ID, type Clock, DuelEngine, type DuelMeta, type DuelRules, type DuelStore } from "./duel-engine";

/** Horloge simulée : les minuteurs se déclenchent quand on avance le temps. */
function fakeClock() {
  let t = 1_000_000;
  let seq = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const clock: Clock & { advance(ms: number): Promise<void> } = {
    now: () => t,
    setTimeout(fn, ms) {
      const id = ++seq;
      timers.set(id, { at: t + ms, fn });
      return id;
    },
    clearTimeout(h) {
      timers.delete(h as number);
    },
    async advance(ms) {
      const end = t + ms;
      for (;;) {
        const next = [...timers.entries()].filter(([, v]) => v.at <= end).sort((x, y) => x[1].at - y[1].at)[0];
        if (!next) break;
        timers.delete(next[0]);
        t = next[1].at;
        next[1].fn();
        await Promise.resolve();
        await Promise.resolve();
      }
      t = end;
      await Promise.resolve();
    },
  };
  return clock;
}

const rules: DuelRules = {
  questionTimeMs: 10_000,
  reconnectGraceMs: 30_000,
  pointsPerCorrect: 100,
  maxSpeedBonus: 50,
  countdownMs: 3_000,
  revealMs: 2_000,
  bot: { name: "Prof", accuracy: 1, minAnswerMs: 4_000, maxAnswerMs: 4_000 },
};

const questions: QuizQuestion[] = [0, 1, 2].map((i) => ({
  cardId: `c${i}`,
  kind: "hp",
  prompt: `Q${i}`,
  image: null,
  choices: ["w", "x", "y", "z"],
  answer: i,
}));

function setup(meta: Partial<DuelMeta> = {}) {
  const m: DuelMeta = { id: "d1", kind: "challenge", status: "ready", playerAId: "alice", playerBId: "bob", expiresAt: null, ...meta };
  const finish = vi.fn(async (_id: string, input: { answers: unknown[]; scoreA: number; scoreB: number; forfeitBy?: string | null }) => ({
    outcome: (input.forfeitBy === "alice" ? "b" : input.forfeitBy === "bob" ? "a" : input.scoreA === input.scoreB ? "draw" : input.scoreA > input.scoreB ? "a" : "b") as "a" | "b" | "draw",
    scoreA: input.scoreA,
    scoreB: input.scoreB,
    forfeitBy: input.forfeitBy ?? null,
    players: [],
  }));
  const store: DuelStore = {
    participants: vi.fn(async () => m),
    start: vi.fn(async () => ({ duelId: m.id, kind: m.kind, playerAId: m.playerAId, playerBId: m.playerBId, questions })),
    finish,
    expire: vi.fn(async () => {}),
    assertStakeable: vi.fn(async () => {}),
    createQuick: vi.fn(async () => ({ duelId: "quick1" })),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- charges utiles variées, lues dans les assertions
  const events: { to: string; event: string; payload: any }[] = [];
  const emit = {
    toUser: (to: string, event: string, payload: unknown) => events.push({ to, event, payload }),
    toDuel: (to: string, event: string, payload: unknown) => events.push({ to, event, payload }),
  };
  const clock = fakeClock();
  const engine = new DuelEngine(store, emit, clock, rules, () => 0);
  const of = (event: string) => events.filter((e) => e.event === event);
  return { engine, store, clock, events, of, finish };
}

describe("moteur de duel", () => {
  it("attend les deux joueurs, puis compte à rebours et première question", async () => {
    const { engine, clock, of } = setup();
    await engine.join("alice", "d1");
    expect(of("duel:countdown")).toHaveLength(0);
    await engine.join("bob", "d1");
    expect(of("duel:countdown")).toHaveLength(1);
    await clock.advance(3_000);
    const q = of("duel:question")[0]!.payload;
    expect(q.index).toBe(0);
    expect(q).not.toHaveProperty("answer");
    expect(q.deadline - q.serverNow).toBe(10_000);
  });

  it("révèle dès que les deux ont répondu et compte le bonus de vitesse", async () => {
    const { engine, clock, of } = setup();
    await engine.join("alice", "d1");
    await engine.join("bob", "d1");
    await clock.advance(3_000);
    await clock.advance(2_000);
    expect(engine.answer("alice", "d1", 0, 0).ok).toBe(true);
    expect(engine.answer("alice", "d1", 0, 1).ok).toBe(false);
    await clock.advance(3_000);
    engine.answer("bob", "d1", 0, 2);
    const r = of("duel:reveal")[0]!.payload;
    expect(r.points).toEqual({ alice: 140, bob: 0 });
    expect(r.scores).toEqual({ a: 140, b: 0 });
  });

  it("refuse une réponse après l'échéance et révèle à la fin du temps", async () => {
    const { engine, clock, of } = setup();
    await engine.join("alice", "d1");
    await engine.join("bob", "d1");
    await clock.advance(3_000);
    await clock.advance(10_000);
    expect(of("duel:reveal")).toHaveLength(1);
    expect(engine.answer("alice", "d1", 0, 0).ok).toBe(false);
    expect(of("duel:reveal")[0]!.payload.choices).toEqual({ alice: null, bob: null });
  });

  it("enchaîne toutes les questions puis termine et enregistre le score", async () => {
    const { engine, clock, of, finish } = setup();
    await engine.join("alice", "d1");
    await engine.join("bob", "d1");
    await clock.advance(3_000);
    for (let i = 0; i < 3; i++) {
      engine.answer("alice", "d1", i, i);
      engine.answer("bob", "d1", i, (i + 1) % 4);
      await clock.advance(2_000);
    }
    expect(of("duel:end")).toHaveLength(1);
    expect(finish).toHaveBeenCalledTimes(1);
    const input = finish.mock.calls[0]![1];
    expect(input.scoreA).toBe(450);
    expect(input.scoreB).toBe(0);
    expect(input.answers).toHaveLength(6);
  });

  it("déclare forfait un joueur qui ne revient pas dans le délai de grâce", async () => {
    const { engine, clock, finish } = setup();
    await engine.join("alice", "d1");
    await engine.join("bob", "d1");
    await clock.advance(3_000);
    engine.leave("bob");
    await clock.advance(29_000);
    expect(finish).not.toHaveBeenCalled();
    await clock.advance(1_500);
    expect(finish).toHaveBeenCalledTimes(1);
    expect(finish.mock.calls[0]![1].forfeitBy).toBe("bob");
  });

  it("laisse revenir un joueur déconnecté à temps", async () => {
    const { engine, clock, finish } = setup();
    await engine.join("alice", "d1");
    await engine.join("bob", "d1");
    await clock.advance(3_000);
    engine.leave("bob");
    await clock.advance(10_000);
    const snap = await engine.join("bob", "d1");
    expect(snap).toMatchObject({ phase: expect.any(String) });
    await clock.advance(25_000);
    expect(finish.mock.calls.find((c) => c[1].forfeitBy)).toBeUndefined();
  });

  it("ne compte pas une seconde connexion fermée comme un départ", async () => {
    const { engine, clock, finish } = setup();
    await engine.join("alice", "d1");
    await engine.join("bob", "d1");
    await engine.join("bob", "d1");
    await clock.advance(3_000);
    engine.leave("bob");
    await clock.advance(31_000);
    expect(finish.mock.calls.find((c) => c[1].forfeitBy)).toBeUndefined();
  });

  it("refuse un joueur étranger au duel", async () => {
    const { engine } = setup();
    await expect(engine.join("eve", "d1")).rejects.toThrow();
  });

  it("joue un entraînement contre le Professeur", async () => {
    const { engine, clock, of } = setup({ kind: "training", playerBId: null });
    await engine.join("alice", "d1");
    expect(of("duel:countdown")).toHaveLength(1);
    await clock.advance(3_000);
    await clock.advance(4_000);
    expect(of("duel:answered").map((e) => e.payload.userId)).toContain(BOT_ID);
    engine.answer("alice", "d1", 0, 3);
    expect(of("duel:reveal")[0]!.payload.points[BOT_ID]).toBe(130);
  });

  it("annule un duel si l'adversaire ne vient pas", async () => {
    const { engine, clock, of, store } = setup({ expiresAt: new Date(1_000_000 + 60_000) });
    await engine.join("alice", "d1");
    await clock.advance(61_000);
    expect(store.expire).toHaveBeenCalled();
    expect(of("duel:cancelled")).toHaveLength(1);
  });

  it("forme un duel rapide avec deux joueurs de la file", async () => {
    const { engine, of } = setup();
    expect((await engine.enqueue("alice", "s1", ["1", "2", "3"])).matched).toBe(false);
    expect((await engine.enqueue("alice", "s2", ["1", "2", "3"])).matched).toBe(false);
    const res = await engine.enqueue("bob", "s3", ["4", "5", "6"]);
    expect(res).toEqual({ matched: true, duelId: "quick1" });
    expect(of("duel:matched").map((e) => e.to).sort()).toEqual(["alice", "bob"]);
    expect(engine.queueSize).toBe(0);
  });
});
