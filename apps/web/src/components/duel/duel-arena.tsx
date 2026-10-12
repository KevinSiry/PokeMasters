"use client";

import { gameConfig } from "@pokeflex/config";
import { Check, Flag, GraduationCap, Loader2, RotateCcw, Swords, WifiOff, X } from "lucide-react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { CardImage } from "@/components/card-image";
import { CoinBurst } from "@/components/economy/coin-burst";
import { Jetons } from "@/components/jetons";
import { toast } from "@/components/toaster";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { emitBalance } from "@/lib/balance-events";
import { getSocket, request, serverOffset, useConnection, useSocketEvent } from "@/lib/realtime";
import { cn } from "@/lib/utils";

const BOT = "bot";
const LETTERS = ["A", "B", "C", "D", "E", "F"];

export interface ArenaPlayer {
  id: string;
  name: string;
  image: string | null;
  handle?: string | null;
}

export interface ArenaStake {
  userId: string;
  cardId: string;
  name: string;
  image: string | null;
}

interface Question {
  index: number;
  total: number;
  prompt: string;
  image: string | null;
  choices: string[];
  deadline: number;
  serverNow: number;
}

interface Reveal {
  index: number;
  answer: number;
  choices: Record<string, number | null>;
  points: Record<string, number>;
  scores: { a: number; b: number };
}

interface PlayerResult {
  userId: string;
  result: "win" | "draw" | "loss";
  reward: number;
  balance: number | null;
  quest: { label: string; reward: number } | null;
  capped: boolean;
}

interface EndPayload {
  outcome: "a" | "b" | "draw";
  scoreA: number;
  scoreB: number;
  forfeitBy: string | null;
  players: PlayerResult[];
}

interface Snapshot {
  phase: "lobby" | "countdown" | "question" | "reveal" | "done";
  present: string[];
  scores: { a: number; b: number };
  total: number;
  startsAt: number;
  question: Question | null;
  answered: string[];
  myChoice: number | null;
  reveal: Reveal | null;
  result: EndPayload | null;
  serverNow: number;
}

type Phase = "connecting" | Snapshot["phase"] | "closed";

function Avatar({ p, size = "md", bot }: { p: ArenaPlayer; size?: "md" | "lg"; bot?: boolean }) {
  const cls = size === "lg" ? "size-14 text-xl" : "size-10 text-base";
  if (bot) {
    return (
      <span aria-hidden="true" className={cn("grid place-items-center rounded-full bg-lime/20 text-lime", cls)}>
        <GraduationCap className="size-1/2" />
      </span>
    );
  }
  return p.image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={p.image} alt="" className={cn("rounded-full object-cover", cls)} />
  ) : (
    <span aria-hidden="true" className={cn("grid place-items-center rounded-full bg-elev font-display", cls)}>
      {p.name.slice(0, 1).toUpperCase()}
    </span>
  );
}

/** Score qui défile jusqu'à sa nouvelle valeur. */
function Score({ value, className }: { value: number; className?: string }) {
  const reduced = useReducedMotion();
  const mv = useMotionValue(value);
  const text = useTransform(mv, (v) => Math.round(v).toLocaleString("fr-FR"));
  useEffect(() => {
    if (reduced) return mv.set(value);
    const c = animate(mv, value, { duration: 0.7, ease: "easeOut" });
    return () => c.stop();
  }, [value, mv, reduced]);
  return <motion.span className={cn("font-mono font-bold font-tabular", className)}>{text}</motion.span>;
}

function Plate({
  player,
  score,
  side,
  online,
  answered,
  gained,
  bot,
}: {
  player: ArenaPlayer;
  score: number;
  side: "left" | "right";
  online: boolean;
  answered: boolean;
  gained: number | null;
  bot?: boolean;
}) {
  return (
    <div className={cn("relative flex min-w-0 items-center gap-2.5", side === "right" && "flex-row-reverse text-right")}>
      <span className="relative shrink-0">
        <Avatar p={player} bot={bot} />
        <span
          aria-hidden="true"
          className={cn("absolute -bottom-0.5 size-3 rounded-full border-2 border-surface", side === "left" ? "-right-0.5" : "-left-0.5", online ? "bg-lime" : "bg-muted")}
        />
      </span>
      <div className="grid min-w-0">
        <span className="truncate text-xs text-muted sm:text-sm">
          {player.name}
          <span className="sr-only">{online ? " (en ligne)" : " (hors ligne)"}</span>
        </span>
        <span className="relative">
          <Score value={score} className="text-xl sm:text-2xl" />
          <AnimatePresence>
            {gained !== null && gained > 0 && (
              <motion.span
                key={`gain-${score}`}
                initial={{ y: 4, opacity: 0 }}
                animate={{ y: -10, opacity: [0, 1, 1, 0] }}
                transition={{ duration: 1.6, times: [0, 0.15, 0.7, 1] }}
                className={cn("absolute top-1 font-mono text-sm font-bold text-lime", side === "left" ? "left-full ml-2" : "right-full mr-2")}
                aria-hidden="true"
              >
                +{gained}
              </motion.span>
            )}
          </AnimatePresence>
        </span>
      </div>
      <AnimatePresence>
        {answered && (
          <motion.span
            key="answered"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className={cn("absolute -top-2 grid size-5 place-items-center rounded-full bg-accent text-white", side === "left" ? "left-7" : "right-7")}
            aria-label={`${player.name} a répondu`}
          >
            <Check className="size-3" aria-hidden="true" />
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Barre de temps restant, calée sur l'horloge du serveur. */
function TimeBar({ deadline, offset, durationMs }: { deadline: number; offset: number; durationMs: number }) {
  const [left, setLeft] = useState(durationMs);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setLeft(Math.max(0, deadline - (Date.now() + offset)));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [deadline, offset]);
  const ratio = Math.min(1, left / durationMs);
  const secs = Math.ceil(left / 1000);
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between text-xs text-muted">
        <span>Temps restant</span>
        <span className={cn("font-mono font-bold font-tabular", secs <= 5 && "text-coral")} aria-live={secs <= 5 ? "polite" : "off"}>
          {secs} s
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-bg" role="progressbar" aria-valuemin={0} aria-valuemax={durationMs / 1000} aria-valuenow={secs} aria-label="Temps restant">
        <div
          className={cn("h-full rounded-full", ratio > 0.33 ? "bg-gradient-to-r from-accent to-coral" : "bg-coral")}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
}

/** Arène d'un duel en direct : salle d'attente, compte à rebours, questions, révélations, résultat. */
export function DuelArena({
  duelId,
  me,
  playerA,
  playerB,
  stakes,
  training,
}: {
  duelId: string;
  me: string;
  playerA: ArenaPlayer;
  /** Null : entraînement contre le Professeur. */
  playerB: ArenaPlayer | null;
  stakes: ArenaStake[];
  training: boolean;
}) {
  const router = useRouter();
  const connected = useConnection();
  const reduced = useReducedMotion();
  const bot: ArenaPlayer = { id: BOT, name: gameConfig.duels.bot.name, image: null };
  const opp = me === playerA.id ? (playerB ?? bot) : playerA;
  const mySide = me === playerA.id ? "a" : "b";
  const oppSide = mySide === "a" ? "b" : "a";

  const [phase, setPhase] = useState<Phase>("connecting");
  const [closedReason, setClosedReason] = useState<string | null>(null);
  const [present, setPresent] = useState<string[]>([]);
  const [scores, setScores] = useState({ a: 0, b: 0 });
  const [total, setTotal] = useState<number>(gameConfig.duels.questionCount);
  const [startsAt, setStartsAt] = useState(0);
  const [question, setQuestion] = useState<Question | null>(null);
  const [answered, setAnswered] = useState<string[]>([]);
  const [myChoice, setMyChoice] = useState<number | null>(null);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [history, setHistory] = useState<Record<number, boolean>>({});
  const [result, setResult] = useState<EndPayload | null>(null);
  const [offset, setOffset] = useState(0);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [countLeft, setCountLeft] = useState(3);
  const lastIndex = useRef(-1);

  const applyReveal = useCallback(
    (r: Reveal) => {
      setReveal(r);
      setScores(r.scores);
      setHistory((h) => ({ ...h, [r.index]: r.choices[me] === r.answer }));
    },
    [me],
  );

  const applyEnd = useCallback(
    (e: EndPayload) => {
      setResult(e);
      setScores({ a: e.scoreA, b: e.scoreB });
      setPhase("done");
      const mine = e.players.find((p) => p.userId === me);
      if (mine?.balance != null) emitBalance(mine.balance);
    },
    [me],
  );

  const join = useCallback(async () => {
    const res = await request<Snapshot | { phase: "closed"; status: string }>("duel:join", duelId);
    if (!res.ok) {
      setPhase("closed");
      setClosedReason(res.error);
      return;
    }
    const s = res.data!;
    if (s.phase === "closed") {
      // Duel terminé ou annulé : la page serveur affiche le bon écran.
      if ((s as { status: string }).status === "finished") return router.refresh();
      setPhase("closed");
      setClosedReason(
        (s as { status: string }).status === "pending" ? "Ton adversaire n'a pas encore accepté le défi." : "Ce duel a été annulé : les cartes misées sont rendues.",
      );
      return;
    }
    const snap = s as Snapshot;
    setOffset(serverOffset(snap.serverNow));
    setPresent(snap.present);
    setScores(snap.scores);
    if (snap.total) setTotal(snap.total);
    setStartsAt(snap.startsAt);
    setQuestion(snap.question);
    setAnswered(snap.answered);
    setMyChoice(snap.myChoice);
    if (snap.reveal) applyReveal(snap.reveal);
    if (snap.question) lastIndex.current = snap.question.index;
    if (snap.result) applyEnd(snap.result);
    else setPhase(snap.phase);
  }, [duelId, router, applyReveal, applyEnd]);

  // Entrée dans l'arène, et retour automatique après une coupure réseau.
  useEffect(() => {
    const s = getSocket();
    void join();
    const onConnect = () => void join();
    s.on("connect", onConnect);
    return () => {
      s.off("connect", onConnect);
      s.emit("duel:leave", duelId);
    };
  }, [join, duelId]);

  useSocketEvent<{ duelId: string; present: string[] }>("duel:presence", (p) => p.duelId === duelId && setPresent(p.present));
  useSocketEvent<{ duelId: string; startsAt: number; total: number; serverNow: number }>("duel:countdown", (p) => {
    if (p.duelId !== duelId) return;
    setOffset(serverOffset(p.serverNow));
    setStartsAt(p.startsAt);
    setTotal(p.total);
    setPhase("countdown");
  });
  useSocketEvent<Question & { duelId: string }>("duel:question", (q) => {
    if (q.duelId !== duelId) return;
    setOffset(serverOffset(q.serverNow));
    lastIndex.current = q.index;
    setQuestion(q);
    setTotal(q.total);
    setAnswered([]);
    setMyChoice(null);
    setReveal(null);
    setPhase("question");
  });
  useSocketEvent<{ duelId: string; index: number; userId: string }>("duel:answered", (p) => {
    if (p.duelId === duelId && p.index === lastIndex.current) setAnswered((a) => (a.includes(p.userId) ? a : [...a, p.userId]));
  });
  useSocketEvent<Reveal & { duelId: string }>("duel:reveal", (r) => {
    if (r.duelId !== duelId) return;
    applyReveal(r);
    setPhase("reveal");
  });
  useSocketEvent<EndPayload & { duelId: string }>("duel:end", (e) => e.duelId === duelId && applyEnd(e));
  useSocketEvent<{ duelId: string; reason: string }>("duel:cancelled", (p) => {
    if (p.duelId !== duelId) return;
    setPhase("closed");
    setClosedReason(p.reason);
  });

  // Compte à rebours 3, 2, 1.
  useEffect(() => {
    if (phase !== "countdown") return;
    const t = window.setInterval(() => setCountLeft(Math.max(0, Math.ceil((startsAt - (Date.now() + offset)) / 1000))), 100);
    return () => window.clearInterval(t);
  }, [phase, startsAt, offset]);

  const choose = useCallback(
    async (i: number) => {
      if (phase !== "question" || myChoice !== null || !question) return;
      setMyChoice(i);
      const res = await request("duel:answer", { duelId, index: question.index, choice: i });
      if (!res.ok) {
        toast({ title: res.error, tone: "error" });
        if (res.error !== "Trop tard !") setMyChoice(null);
      }
    },
    [phase, myChoice, question, duelId],
  );

  // Clavier : 1 à 4 (ou A à D) pour répondre.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toUpperCase();
      const i = /^[1-6]$/.test(k) ? Number(k) - 1 : LETTERS.indexOf(k);
      if (i >= 0 && question && i < question.choices.length) void choose(i);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [choose, question]);

  async function quit() {
    setConfirmQuit(false);
    const res = await request("duel:forfeit", duelId);
    if (!res.ok) toast({ title: "Abandon impossible", description: res.error, tone: "error" });
  }

  const myResult = result?.players.find((p) => p.userId === me) ?? null;
  const outcomeForMe = result ? (result.outcome === "draw" ? "draw" : result.outcome === mySide ? "win" : "loss") : null;
  const oppOnline = opp.id === BOT || present.includes(opp.id);
  const inGame = phase === "countdown" || phase === "question" || phase === "reveal";
  const myStakes = stakes.filter((s) => s.userId === me);
  const oppStakes = stakes.filter((s) => s.userId !== me);

  return (
    <div className="grid grid-cols-1 gap-4 py-5 sm:py-8">
      {!connected && phase !== "closed" && phase !== "done" && (
        <p role="status" className="flex items-center justify-center gap-2 rounded-full border border-coral/50 bg-coral/10 px-4 py-2 text-sm text-coral">
          <WifiOff aria-hidden="true" className="size-4" />
          Reconnexion… tu as {gameConfig.duels.reconnectGraceMs / 1000} secondes pour revenir.
        </p>
      )}

      {/* Tableau des scores */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-[calc(var(--radius-card)*1.2)] border border-line bg-surface p-3 sm:p-4">
        <Plate
          player={me === playerA.id ? playerA : (playerB ?? bot)}
          score={scores[mySide]}
          side="left"
          online={connected}
          answered={phase === "question" && answered.includes(me)}
          gained={phase === "reveal" && reveal ? (reveal.points[me] ?? 0) : null}
        />
        <div className="grid justify-items-center gap-1.5">
          <span className="font-display text-sm font-bold text-muted">VS</span>
          <ol className="flex gap-1" aria-label="Progression des questions">
            {Array.from({ length: total }, (_, i) => (
              <li
                key={i}
                aria-label={`Question ${i + 1}${history[i] === undefined ? "" : history[i] ? " : juste" : " : ratée"}`}
                className={cn(
                  "size-1.5 rounded-full sm:size-2",
                  history[i] === true ? "bg-lime" : history[i] === false ? "bg-coral" : i === question?.index && inGame ? "bg-fg" : "bg-line",
                )}
              />
            ))}
          </ol>
        </div>
        <Plate
          player={opp}
          bot={opp.id === BOT}
          score={scores[oppSide]}
          side="right"
          online={oppOnline}
          answered={phase === "question" && answered.includes(opp.id)}
          gained={phase === "reveal" && reveal ? (reveal.points[opp.id] ?? 0) : null}
        />
      </div>

      {/* Scène */}
      <div className="relative grid min-h-[26rem] overflow-hidden rounded-[calc(var(--radius-card)*1.4)] border border-line bg-[radial-gradient(90%_70%_at_50%_0%,color-mix(in_srgb,var(--color-accent)_18%,transparent),transparent_70%),var(--color-surface)] p-4 sm:p-7">
        <AnimatePresence mode="wait">
          {phase === "connecting" && (
            <motion.div key="connecting" className="grid place-items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Loader2 aria-hidden="true" className="size-8 animate-spin text-muted" />
              <span className="sr-only">Connexion à l&apos;arène…</span>
            </motion.div>
          )}

          {phase === "lobby" && (
            <motion.div key="lobby" className="grid content-center justify-items-center gap-6 text-center" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="flex items-center gap-4">
                <Avatar p={me === playerA.id ? playerA : (playerB ?? bot)} size="lg" />
                <motion.span animate={reduced ? undefined : { scale: [1, 1.15, 1] }} transition={{ duration: 1.4, repeat: Infinity }}>
                  <Swords aria-hidden="true" className="size-8 text-accent" />
                </motion.span>
                <span className={cn("transition-opacity", !oppOnline && "opacity-40")}>
                  <Avatar p={opp} size="lg" bot={opp.id === BOT} />
                </span>
              </div>
              <div className="grid gap-1">
                <p className="font-display text-xl font-bold">{oppOnline ? "C'est parti !" : `En attente de ${opp.name}…`}</p>
                <p className="text-sm text-muted">Le duel commence dès que vous êtes tous les deux dans l&apos;arène.</p>
              </div>
              {stakes.length > 0 && (
                <div className="grid w-full max-w-lg grid-cols-2 gap-4">
                  {[
                    { label: "Ta mise", list: myStakes },
                    { label: `Mise de ${opp.name}`, list: oppStakes },
                  ].map(({ label, list }) => (
                    <div key={label} className="grid gap-2">
                      <p className="text-xs text-muted">{label}</p>
                      <div className="flex justify-center">
                        {list.map((s, i) => (
                          <div key={s.cardId} className="w-16 sm:w-20" style={{ transform: `rotate(${(i - 1) * 8}deg) translateY(${Math.abs(i - 1) * 6}px)`, marginInline: "-0.5rem" }}>
                            <CardImage image={s.image} name={s.name} className="rounded-md shadow-lg" />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {phase === "countdown" && (
            <motion.div key="countdown" className="grid content-center justify-items-center gap-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <p className="text-sm text-muted">Prépare-toi…</p>
              <AnimatePresence mode="popLayout">
                <motion.span
                  key={countLeft}
                  initial={{ scale: 2.2, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 18 }}
                  className="font-display text-8xl font-bold text-prism"
                  aria-live="assertive"
                >
                  {countLeft > 0 ? countLeft : "Go !"}
                </motion.span>
              </AnimatePresence>
            </motion.div>
          )}

          {(phase === "question" || phase === "reveal") && question && (
            <motion.div key={`q-${question.index}`} className="grid content-start gap-4 sm:gap-5" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25 }}>
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-full bg-elev px-3 py-1 font-mono text-xs font-bold">
                  Question {question.index + 1}/{question.total}
                </span>
                {phase === "question" && answered.includes(opp.id) && myChoice === null && (
                  <span className="text-xs text-coral" role="status">
                    {opp.name} a déjà répondu !
                  </span>
                )}
              </div>
              {phase === "question" ? (
                <TimeBar deadline={question.deadline} offset={offset} durationMs={gameConfig.duels.questionTimeMs} />
              ) : (
                <div className="h-[1.6rem]" />
              )}
              <div className={cn("grid gap-4", question.image && "sm:grid-cols-[minmax(0,12rem)_1fr] sm:items-start")}>
                {question.image && (
                  // Seule l'illustration est montrée : le bas de la carte porte le nom de l'illustrateur et le symbole du set.
                  <div className="relative mx-auto aspect-[63/42] w-56 overflow-hidden rounded-xl border border-line shadow-[0_18px_40px_-12px_rgb(0_0_0/0.8)] sm:w-full">
                    <div className="absolute inset-x-0 top-[-16%]">
                      <CardImage image={question.image} name="Illustration de la carte" quality="high" />
                    </div>
                  </div>
                )}
                <div className="grid content-start gap-4">
                  <h2 className="font-display text-lg leading-snug font-bold sm:text-2xl">{question.prompt}</h2>
                  <ul className="grid gap-2.5 sm:grid-cols-2">
                    {question.choices.map((c, i) => {
                      const isAnswer = phase === "reveal" && reveal?.answer === i;
                      const mine = myChoice === i || (phase === "reveal" && reveal?.choices[me] === i);
                      const theirs = phase === "reveal" && reveal?.choices[opp.id] === i;
                      const wrongMine = phase === "reveal" && mine && !isAnswer;
                      return (
                        <li key={i}>
                          <motion.button
                            type="button"
                            onClick={() => void choose(i)}
                            disabled={phase !== "question" || myChoice !== null}
                            animate={wrongMine && !reduced ? { x: [0, -6, 6, -4, 4, 0] } : isAnswer && !reduced ? { scale: [1, 1.04, 1] } : undefined}
                            transition={{ duration: 0.45 }}
                            className={cn(
                              "relative flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 px-3.5 py-3 text-left text-sm font-semibold transition-colors sm:text-base",
                              phase === "question" && myChoice === null && "border-line bg-bg hover:border-accent hover:bg-elev active:scale-[0.98]",
                              phase === "question" && myChoice !== null && (mine ? "border-accent bg-accent/15" : "border-line bg-bg opacity-60"),
                              phase === "reveal" && (isAnswer ? "border-lime bg-lime/15" : wrongMine ? "border-coral bg-coral/15" : "border-line bg-bg opacity-55"),
                            )}
                          >
                            <span
                              aria-hidden="true"
                              className={cn(
                                "grid size-7 shrink-0 place-items-center rounded-lg font-mono text-xs",
                                isAnswer ? "bg-lime text-bg" : wrongMine ? "bg-coral text-bg" : mine ? "bg-accent text-white" : "bg-elev text-muted",
                              )}
                            >
                              {isAnswer ? <Check className="size-4" /> : wrongMine ? <X className="size-4" /> : LETTERS[i]}
                            </span>
                            <span className="min-w-0 flex-1">{c}</span>
                            {theirs && (
                              <span className="shrink-0" title={`Réponse de ${opp.name}`}>
                                <span className="sr-only">Réponse de {opp.name}</span>
                                <span className="block scale-75">
                                  <Avatar p={opp} bot={opp.id === BOT} />
                                </span>
                              </span>
                            )}
                          </motion.button>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="min-h-5 text-center text-xs text-muted" aria-live="polite">
                    {phase === "question" && myChoice !== null && !answered.includes(opp.id) && `Réponse envoyée, en attente de ${opp.name}…`}
                    {phase === "reveal" && reveal && (reveal.choices[me] === reveal.answer ? `Bien joué ! +${reveal.points[me]} points` : reveal.choices[me] === null ? "Temps écoulé." : "Raté !")}
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {phase === "done" && result && (
            <motion.div key="done" className="relative grid content-center justify-items-center gap-5 text-center" initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 220, damping: 22 }}>
              {myResult && myResult.reward > 0 && <CoinBurst count={18} />}
              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className={cn("font-display text-5xl font-bold sm:text-6xl", outcomeForMe === "win" ? "text-prism" : outcomeForMe === "draw" ? "text-accent" : "text-muted")}
              >
                {outcomeForMe === "win" ? "Victoire !" : outcomeForMe === "draw" ? "Égalité" : "Défaite"}
              </motion.p>
              <p className="text-sm text-muted">
                {result.forfeitBy
                  ? result.forfeitBy === me
                    ? "Tu as quitté le duel."
                    : `${opp.name} a quitté le duel.`
                  : outcomeForMe === "win"
                    ? `Tu as battu ${opp.name}.`
                    : outcomeForMe === "draw"
                      ? "Impossible de vous départager !"
                      : `${opp.name} l'emporte cette fois.`}
              </p>
              <p className="font-mono text-3xl font-bold font-tabular">
                {mySide === "a" ? result.scoreA : result.scoreB} <span className="text-muted">–</span> {mySide === "a" ? result.scoreB : result.scoreA}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {myResult && myResult.reward > 0 && (
                  <span className="rounded-full border border-[#FFC93C]/40 bg-[#FFC93C]/10 px-3 py-1.5">
                    <Jetons value={myResult.reward} signed className="text-[#FFC93C]" />
                  </span>
                )}
                {myResult?.quest && (
                  <span className="rounded-full border border-lime/40 bg-lime/10 px-3 py-1.5 text-sm text-lime">Quête terminée : {myResult.quest.label}</span>
                )}
                {myResult?.capped && <span className="rounded-full bg-elev px-3 py-1.5 text-xs text-muted">Limite de duels récompensés atteinte pour aujourd&apos;hui</span>}
                {training && <span className="rounded-full bg-elev px-3 py-1.5 text-xs text-muted">Entraînement : sans Jetons</span>}
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {training ? (
                  <Button asChild>
                    <Link href="/duels">
                      <RotateCcw aria-hidden="true" />
                      Rejouer
                    </Link>
                  </Button>
                ) : (
                  opp.handle && (
                    <Button asChild>
                      <Link href={`/duels?defi=${encodeURIComponent(opp.handle)}`}>
                        <RotateCcw aria-hidden="true" />
                        Revanche
                      </Link>
                    </Button>
                  )
                )}
                <Button variant="secondary" onClick={() => router.refresh()}>
                  Voir le récapitulatif
                </Button>
              </div>
            </motion.div>
          )}

          {phase === "closed" && (
            <motion.div key="closed" className="grid content-center justify-items-center gap-4 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <p className="font-display text-xl font-bold">Pas de duel ici</p>
              <p className="max-w-sm text-sm text-muted">{closedReason}</p>
              <Button asChild>
                <Link href="/duels">Retour aux duels</Link>
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {inGame && (
        <div className="flex items-center justify-between gap-3 text-xs text-muted">
          <span className="hidden sm:inline">Astuce : réponds avec les touches 1 à 4.</span>
          <Button variant="ghost" size="sm" onClick={() => setConfirmQuit(true)}>
            <Flag aria-hidden="true" />
            Abandonner
          </Button>
        </div>
      )}

      <Dialog open={confirmQuit} onClose={() => setConfirmQuit(false)} title="Abandonner le duel ?" description={training ? "L'entraînement s'arrête ici." : `${opp.name} remportera la victoire. Tes cartes misées te reviennent.`}>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmQuit(false)}>
            Continuer
          </Button>
          <Button onClick={quit}>Abandonner</Button>
        </div>
      </Dialog>
    </div>
  );
}
