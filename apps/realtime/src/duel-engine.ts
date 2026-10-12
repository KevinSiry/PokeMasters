/**
 * Moteur des duels en direct : salle d'attente, compte à rebours, questions chronométrées
 * par l'horloge du serveur, révélations, abandon et reconnexion, file du duel rapide.
 *
 * Il ne parle à la base que par `DuelStore` et au réseau que par `DuelEmitter`, ce qui
 * permet de le tester avec une horloge simulée.
 */
import { gameConfig } from "@pokeflex/config";
import { answerPoints, isOnTime, type QuizQuestion } from "@pokeflex/game";
import type { DuelAnswerRecord, DuelFinish, DuelStart } from "@pokeflex/server";

export interface DuelMeta {
  id: string;
  kind: "challenge" | "quick" | "training";
  status: string;
  playerAId: string;
  playerBId: string | null;
  expiresAt: Date | null;
}

export interface DuelStore {
  participants(duelId: string): Promise<DuelMeta | null>;
  start(duelId: string): Promise<DuelStart>;
  finish(duelId: string, input: { answers: DuelAnswerRecord[]; scoreA: number; scoreB: number; forfeitBy?: string | null }): Promise<DuelFinish>;
  expire(): Promise<void>;
  assertStakeable(userId: string, copyIds: readonly string[]): Promise<void>;
  createQuick(a: { userId: string; copyIds: readonly string[] }, b: { userId: string; copyIds: readonly string[] }): Promise<{ duelId: string }>;
}

export interface DuelEmitter {
  toUser(userId: string, event: string, payload: unknown): void;
  toDuel(duelId: string, event: string, payload: unknown): void;
}

export interface Clock {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export const systemClock: Clock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

export interface DuelRules {
  questionTimeMs: number;
  reconnectGraceMs: number;
  pointsPerCorrect: number;
  maxSpeedBonus: number;
  countdownMs: number;
  revealMs: number;
  bot: { name: string; accuracy: number; minAnswerMs: number; maxAnswerMs: number };
}

export const BOT_ID = "bot";

type Phase = "lobby" | "countdown" | "question" | "reveal" | "done";

interface Room {
  id: string;
  kind: DuelMeta["kind"];
  a: string;
  /** Joueur B, ou le Professeur (`bot`) en entraînement. */
  b: string;
  phase: Phase;
  questions: QuizQuestion[];
  index: number;
  askedAt: number;
  deadline: number;
  current: Map<string, { choice: number; at: number }>;
  records: DuelAnswerRecord[];
  scores: { a: number; b: number };
  /** Nombre de connexions (onglets) présentes par joueur. */
  present: Map<string, number>;
  away: Map<string, unknown>;
  timer: unknown;
  lobbyTimer: unknown;
  startsAt: number;
  last: RevealPayload | null;
  result: DuelFinish | null;
}

export interface QuestionPayload {
  duelId: string;
  index: number;
  total: number;
  prompt: string;
  image: string | null;
  choices: string[];
  deadline: number;
  serverNow: number;
}

export interface RevealPayload {
  duelId: string;
  index: number;
  answer: number;
  choices: Record<string, number | null>;
  points: Record<string, number>;
  scores: { a: number; b: number };
}

export class DuelEngine {
  private rooms = new Map<string, Room>();
  private queue = new Map<string, { copyIds: string[]; socketId: string }>();

  constructor(
    private store: DuelStore,
    private emit: DuelEmitter,
    private clock: Clock = systemClock,
    private rules: DuelRules = gameConfig.duels,
    private random: () => number = Math.random,
  ) {}

  /** Nombre de duels en cours (point de santé). */
  get activeCount() {
    return this.rooms.size;
  }

  private humans(room: Room) {
    return room.b === BOT_ID ? [room.a] : [room.a, room.b];
  }

  private publicQuestion(room: Room): QuestionPayload {
    const q = room.questions[room.index]!;
    return {
      duelId: room.id,
      index: room.index,
      total: room.questions.length,
      prompt: q.prompt,
      image: q.image,
      choices: q.choices,
      deadline: room.deadline,
      serverNow: this.clock.now(),
    };
  }

  /** État complet pour un joueur qui (re)vient dans l'arène. */
  snapshot(room: Room, userId: string) {
    return {
      duelId: room.id,
      phase: room.phase,
      you: userId,
      a: room.a,
      b: room.b,
      present: [...room.present.keys()],
      scores: room.scores,
      total: room.questions.length,
      startsAt: room.startsAt,
      question: room.phase === "question" ? this.publicQuestion(room) : null,
      answered: room.phase === "question" ? [...room.current.keys()] : [],
      myChoice: room.phase === "question" ? (room.current.get(userId)?.choice ?? null) : null,
      reveal: room.phase === "reveal" ? room.last : null,
      result: room.result,
      serverNow: this.clock.now(),
    };
  }

  /** Un joueur entre dans l'arène (ou y revient après une déconnexion). */
  async join(userId: string, duelId: string) {
    let room = this.rooms.get(duelId);
    if (!room) {
      const meta = await this.store.participants(duelId);
      if (!meta || (meta.playerAId !== userId && meta.playerBId !== userId)) throw new Error("Ce duel ne te concerne pas.");
      if (meta.status !== "ready") return { phase: "closed" as const, status: meta.status };
      room = this.rooms.get(duelId);
      if (!room) {
        room = {
          id: duelId,
          kind: meta.kind,
          a: meta.playerAId,
          b: meta.playerBId ?? BOT_ID,
          phase: "lobby",
          questions: [],
          index: -1,
          askedAt: 0,
          deadline: 0,
          current: new Map(),
          records: [],
          scores: { a: 0, b: 0 },
          present: new Map(),
          away: new Map(),
          timer: null,
          lobbyTimer: null,
          startsAt: 0,
          last: null,
          result: null,
        };
        this.rooms.set(duelId, room);
        // Personne n'est venu à temps : le duel est annulé et les cartes rendues.
        const left = meta.expiresAt ? Math.max(0, meta.expiresAt.getTime() - this.clock.now()) : this.rules.countdownMs * 40;
        const r = room;
        room.lobbyTimer = this.clock.setTimeout(() => void this.expireLobby(r), left + 500);
      }
    }
    if (room.a !== userId && room.b !== userId) throw new Error("Ce duel ne te concerne pas.");
    room.present.set(userId, (room.present.get(userId) ?? 0) + 1);
    const away = room.away.get(userId);
    if (away) {
      this.clock.clearTimeout(away);
      room.away.delete(userId);
    }
    this.emit.toDuel(room.id, "duel:presence", { duelId: room.id, present: [...room.present.keys()] });
    if (room.phase === "lobby" && this.humans(room).every((h) => room.present.has(h))) await this.begin(room);
    return this.snapshot(room, userId);
  }

  private async expireLobby(room: Room) {
    if (room.phase !== "lobby" || this.rooms.get(room.id) !== room) return;
    this.rooms.delete(room.id);
    await this.store.expire();
    this.emit.toDuel(room.id, "duel:cancelled", { duelId: room.id, reason: "Ton adversaire n'est pas venu : les cartes misées sont rendues." });
  }

  private async begin(room: Room) {
    room.phase = "countdown";
    this.clock.clearTimeout(room.lobbyTimer);
    try {
      const started = await this.store.start(room.id);
      room.questions = started.questions;
    } catch (err) {
      this.rooms.delete(room.id);
      this.emit.toDuel(room.id, "duel:cancelled", { duelId: room.id, reason: err instanceof Error ? err.message : "Le duel n'a pas pu commencer." });
      return;
    }
    if (room.questions.length === 0) {
      await this.finish(room, null);
      return;
    }
    room.startsAt = this.clock.now() + this.rules.countdownMs;
    this.emit.toDuel(room.id, "duel:countdown", { duelId: room.id, startsAt: room.startsAt, total: room.questions.length, serverNow: this.clock.now() });
    room.timer = this.clock.setTimeout(() => this.ask(room, 0), this.rules.countdownMs);
  }

  private ask(room: Room, index: number) {
    if (room.phase === "done") return;
    room.phase = "question";
    room.index = index;
    room.current = new Map();
    room.askedAt = this.clock.now();
    room.deadline = room.askedAt + this.rules.questionTimeMs;
    this.emit.toDuel(room.id, "duel:question", this.publicQuestion(room));
    room.timer = this.clock.setTimeout(() => this.reveal(room), this.rules.questionTimeMs);
    if (room.b === BOT_ID) {
      const { accuracy, minAnswerMs, maxAnswerMs } = this.rules.bot;
      const delay = Math.min(this.rules.questionTimeMs - 200, minAnswerMs + Math.floor(this.random() * (maxAnswerMs - minAnswerMs)));
      const q = room.questions[index]!;
      const right = this.random() < accuracy;
      const wrong = q.choices.map((_, i) => i).filter((i) => i !== q.answer);
      const choice = right ? q.answer : wrong[Math.floor(this.random() * wrong.length)]!;
      this.clock.setTimeout(() => this.record(room, BOT_ID, index, choice), delay);
    }
  }

  /** Réponse d'un joueur. Refusée hors délai (horloge serveur), en double ou sur une autre question. */
  answer(userId: string, duelId: string, index: number, choice: number) {
    const room = this.rooms.get(duelId);
    if (!room || (room.a !== userId && room.b !== userId)) return { ok: false as const, reason: "not_in_duel" };
    if (!Number.isInteger(choice) || choice < 0 || choice >= (room.questions[index]?.choices.length ?? 0)) return { ok: false as const, reason: "invalid" };
    return this.record(room, userId, index, choice);
  }

  private record(room: Room, userId: string, index: number, choice: number) {
    if (room.phase !== "question" || room.index !== index) return { ok: false as const, reason: "closed" };
    if (room.current.has(userId)) return { ok: false as const, reason: "already" };
    const now = this.clock.now();
    if (!isOnTime(now, room.deadline)) return { ok: false as const, reason: "late" };
    room.current.set(userId, { choice, at: now });
    this.emit.toDuel(room.id, "duel:answered", { duelId: room.id, index, userId });
    if ([room.a, room.b].every((p) => room.current.has(p))) this.reveal(room);
    return { ok: true as const };
  }

  private reveal(room: Room) {
    if (room.phase !== "question") return;
    this.clock.clearTimeout(room.timer);
    room.phase = "reveal";
    const q = room.questions[room.index]!;
    const choices: Record<string, number | null> = {};
    const points: Record<string, number> = {};
    for (const [side, player] of [["a", room.a], ["b", room.b]] as const) {
      const ans = room.current.get(player);
      const correct = ans?.choice === q.answer;
      const answeredMs = ans ? ans.at - room.askedAt : this.rules.questionTimeMs;
      const pts = answerPoints(correct, answeredMs, this.rules.questionTimeMs, this.rules);
      room.scores[side] += pts;
      choices[player] = ans?.choice ?? null;
      points[player] = pts;
      room.records.push({ userId: player, qIndex: room.index, choice: ans?.choice ?? null, correct, answeredMs, points: pts });
    }
    room.last = { duelId: room.id, index: room.index, answer: q.answer, choices, points, scores: { ...room.scores } };
    this.emit.toDuel(room.id, "duel:reveal", room.last);
    const next = room.index + 1;
    room.timer = this.clock.setTimeout(
      () => (next < room.questions.length ? this.ask(room, next) : void this.finish(room, null)),
      this.rules.revealMs,
    );
  }

  private async finish(room: Room, forfeitBy: string | null) {
    if (room.phase === "done") return;
    room.phase = "done";
    this.clock.clearTimeout(room.timer);
    this.clock.clearTimeout(room.lobbyTimer);
    for (const t of room.away.values()) this.clock.clearTimeout(t);
    try {
      room.result = await this.store.finish(room.id, { answers: room.records, scoreA: room.scores.a, scoreB: room.scores.b, forfeitBy });
      this.emit.toDuel(room.id, "duel:end", { duelId: room.id, ...room.result });
    } catch (err) {
      this.emit.toDuel(room.id, "duel:cancelled", { duelId: room.id, reason: err instanceof Error ? err.message : "Le duel n'a pas pu se terminer." });
    }
    // On garde la salle un moment pour un joueur qui revient voir le résultat.
    this.clock.setTimeout(() => {
      if (this.rooms.get(room.id) === room) this.rooms.delete(room.id);
    }, 60_000);
  }

  /** Abandon volontaire : l'adversaire gagne. */
  async forfeit(userId: string, duelId: string) {
    const room = this.rooms.get(duelId);
    if (!room || (room.a !== userId && room.b !== userId) || room.phase === "done" || room.phase === "lobby") return false;
    await this.finish(room, userId);
    return true;
  }

  /** Une connexion d'un joueur se ferme : après le délai de grâce sans retour, il perd par forfait. */
  leave(userId: string, duelId?: string) {
    for (const room of this.rooms.values()) {
      if (duelId && room.id !== duelId) continue;
      const n = room.present.get(userId);
      if (!n) continue;
      if (n > 1) {
        room.present.set(userId, n - 1);
        continue;
      }
      room.present.delete(userId);
      this.emit.toDuel(room.id, "duel:presence", { duelId: room.id, present: [...room.present.keys()] });
      if (room.phase === "lobby" || room.phase === "done" || room.away.has(userId)) continue;
      room.away.set(
        userId,
        this.clock.setTimeout(() => {
          room.away.delete(userId);
          if (!room.present.has(userId)) void this.finish(room, userId);
        }, this.rules.reconnectGraceMs),
      );
    }
  }

  // ───────── Duel rapide ─────────

  async enqueue(userId: string, socketId: string, copyIds: string[]) {
    await this.store.assertStakeable(userId, copyIds);
    const other = [...this.queue.entries()].find(([id]) => id !== userId);
    if (!other) {
      this.queue.set(userId, { copyIds, socketId });
      return { matched: false as const };
    }
    const [otherId, entry] = other;
    this.queue.delete(otherId);
    this.queue.delete(userId);
    try {
      const { duelId } = await this.store.createQuick({ userId: otherId, copyIds: entry.copyIds }, { userId, copyIds });
      for (const id of [otherId, userId]) this.emit.toUser(id, "duel:matched", { duelId });
      return { matched: true as const, duelId };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Le duel n'a pas pu être créé.";
      for (const id of [otherId, userId]) this.emit.toUser(id, "queue:error", { message });
      return { matched: false as const, error: message };
    }
  }

  dequeue(userId: string, socketId?: string) {
    const entry = this.queue.get(userId);
    if (entry && (!socketId || entry.socketId === socketId)) this.queue.delete(userId);
  }

  get queueSize() {
    return this.queue.size;
  }
}
