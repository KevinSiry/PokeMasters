"use client";

import { FINISH_LABELS_FR, TIER_LABELS_FR, tierRank, type Tier } from "@pokeflex/config";
import { CheckCircle2, Layers, Recycle, Sparkles, Target, Zap } from "lucide-react";
import { AnimatePresence, motion, useIsPresent, useReducedMotion, type PanInfo } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { openBoosterAction, openSetBoosterAction } from "@/app/boosters/actions";
import { CoinBurst } from "@/components/economy/coin-burst";
import { Jetons } from "@/components/jetons";
import { BoosterPackArt } from "@/components/booster/booster-pack";
import { CardBack } from "@/components/booster/card-back";
import { TIER_ICON } from "@/components/tier-badge";
import { TiltCard } from "@/components/tilt-card";
import { Button } from "@/components/ui/button";
import { cardImageUrl } from "@/lib/card-image";
import { emitBalance } from "@/lib/balance-events";
import type { BoosterResult, PulledCard } from "@/lib/boosters";
import { useBoosterCountdown } from "@/lib/use-booster-countdown";
import { cn } from "@/lib/utils";

type Phase = "idle" | "charging" | "tearing" | "reveal" | "summary";

interface BoosterOpeningProps {
  available: number;
  nextAt: string | null;
  maxStock: number;
  refillIntervalMs: number;
  balance: number;
  /** Booster d'un set précis, payé en Jetons. Sans `set` : booster gratuit « Toutes époques ». */
  set?: { id: string; name: string; logo: string | null; price: number };
}

const TIER_COLORS: Record<Tier, string[]> = {
  common: ["#9AA3B5"],
  uncommon: ["#5CC98A", "#B8F35C"],
  rare: ["#4EA8F5", "#BFE3FF", "#ffffff"],
  epic: ["#B57CF7", "#FF5C85", "#7AD7FF", "#ffffff"],
  legendary: ["#F5A524", "#FFD86B", "#FFF3C4", "#ffffff"],
  mythic: ["#FF6FB5", "#7AD7FF", "#9CFF8A", "#FFD86B", "#B57CF7", "#ffffff"],
};
const PARTICLES: Record<Tier, number> = { common: 0, uncommon: 0, rare: 12, epic: 20, legendary: 32, mythic: 48 };
/** Durée du suspense avant de retourner une carte (ms). */
const SUSPENSE: Record<Tier, number> = { common: 0, uncommon: 0, rare: 0, epic: 350, legendary: 1100, mythic: 1700 };
const HAPTICS: Partial<Record<Tier, number[]>> = { epic: [18], legendary: [30, 40, 60], mythic: [40, 50, 40, 50, 120] };

function vibrate(pattern?: number[]) {
  if (pattern && typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(pattern);
}

function preload(cards: PulledCard[]) {
  for (const c of cards) {
    const src = cardImageUrl(c.image, "high");
    if (src) {
      const img = new Image();
      img.decoding = "async";
      img.src = src;
    }
  }
}

/** Gerbe de particules autour d'une carte qui vient d'être révélée. */
function Burst({ tier }: { tier: Tier }) {
  const particles = useMemo(
    () =>
      Array.from({ length: PARTICLES[tier] }, (_, i) => {
        const angle = (i / PARTICLES[tier]) * Math.PI * 2 + Math.random() * 0.5;
        const dist = 120 + Math.random() * (tier === "mythic" ? 220 : 140);
        const colors = TIER_COLORS[tier];
        return {
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist,
          size: 4 + Math.random() * (tier === "mythic" ? 9 : 6),
          color: colors[i % colors.length]!,
          delay: Math.random() * 0.12,
          star: i % 3 === 0,
        };
      }),
    [tier],
  );
  if (particles.length === 0) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-20 grid place-items-center">
      <motion.span
        className="absolute size-24 rounded-full border-4"
        style={{ borderColor: TIER_COLORS[tier][0] }}
        initial={{ scale: 0.4, opacity: 0.9 }}
        animate={{ scale: 4, opacity: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
      {particles.map((p, i) => (
        <motion.span
          key={i}
          className="absolute"
          style={{
            width: p.size,
            height: p.size,
            background: p.color,
            borderRadius: p.star ? 2 : 999,
            rotate: p.star ? 45 : 0,
            boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
          }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ x: p.x, y: p.y, opacity: 0, scale: 0.2 }}
          transition={{ duration: 0.9 + Math.random() * 0.5, delay: p.delay, ease: [0.15, 0.8, 0.3, 1] }}
        />
      ))}
    </div>
  );
}

/** Une carte qui sort de l'écran n'est plus cliquable ni annoncée (sinon un double tap sauterait une carte). */
function Presence({ children }: { children: React.ReactNode }) {
  const present = useIsPresent();
  return (
    <div inert={!present} aria-hidden={!present || undefined}>
      {children}
    </div>
  );
}

function CardFront({ card }: { card: PulledCard }) {
  const src = cardImageUrl(card.image, "high");
  return (
    <div className="pf-card bg-elev" data-tier={card.tier}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- CDN TCGdex
        <img src={src} alt={card.name} draggable={false} />
      ) : (
        <div className="grid h-full place-items-center rounded-[inherit] bg-surface p-4 text-center text-sm text-muted">{card.name}</div>
      )}
    </div>
  );
}

function PullBadges({ card, className, compact }: { card: PulledCard; className?: string; compact?: boolean }) {
  if (compact) {
    return (
      <div className={cn("flex items-center justify-center gap-1 text-[11px] font-bold", className)}>
        <span data-tier={card.tier} className="pf-tier-pip" title={TIER_LABELS_FR[card.tier]}>
          <span aria-hidden="true">{TIER_ICON[card.tier]}</span>
          <span className="sr-only">{TIER_LABELS_FR[card.tier]}</span>
        </span>
        {card.isNew && <span className="rounded-full bg-lime px-1.5 text-[10px] font-black text-bg">NEW</span>}
        {card.finish !== "normal" && (
          <span className="rounded-full bg-gradient-to-r from-accent-strong to-coral-strong px-1.5 text-[10px]">
            {FINISH_LABELS_FR[card.finish]}
          </span>
        )}
      </div>
    );
  }
  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-1.5", className)}>
      <span
        data-tier={card.tier}
        className="pf-tier-pip inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-bold"
      >
        <span aria-hidden="true">{TIER_ICON[card.tier]}</span>
        {TIER_LABELS_FR[card.tier]}
      </span>
      {card.isNew && (
        <span className="rounded-full bg-lime px-2.5 py-1 text-xs font-black tracking-wide text-bg">NOUVELLE</span>
      )}
      {card.finish !== "normal" && (
        <span className="rounded-full bg-gradient-to-r from-accent-strong to-coral-strong px-2.5 py-1 text-xs font-bold">
          {FINISH_LABELS_FR[card.finish]}
        </span>
      )}
    </div>
  );
}

export function BoosterOpening({ available, nextAt, maxStock, refillIntervalMs, balance: initialBalance, set }: BoosterOpeningProps) {
  const reduced = useReducedMotion() ?? false;
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<BoosterResult | null>(null);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [suspense, setSuspense] = useState(false);
  const [flash, setFlash] = useState(0);
  const [stock, setStock] = useState({ available, nextAt });
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState(initialBalance);
  const [, startTransition] = useTransition();
  const busy = useRef(false);
  const countdown = useBoosterCountdown(stock.available, stock.nextAt, maxStock, refillIntervalMs);

  // Le serveur peut renvoyer un nouvel état (navigation, autre onglet) : on s'aligne au repos.
  useEffect(() => {
    if (phase === "idle") {
      setStock({ available, nextAt });
      setBalance(initialBalance);
    }
  }, [available, nextAt, initialBalance, phase]);

  const canOpen = set ? balance >= set.price : countdown.shown > 0;
  const packProps = set ? { label: set.name, logo: set.logo, palette: set.id } : {};

  const cards = useMemo(() => result?.cards ?? [], [result]);
  const current = cards[index];
  const best = useMemo(
    () => cards.reduce<PulledCard | null>((b, c) => (!b || tierRank(c.tier) > tierRank(b.tier) ? c : b), null),
    [cards],
  );

  const open = useCallback(() => {
    if (busy.current || !canOpen) return;
    busy.current = true;
    setError(null);
    setPhase("charging");
    startTransition(async () => {
      const res = set ? await openSetBoosterAction(set.id) : await openBoosterAction();
      if (!res.ok) {
        setError(res.error);
        setPhase("idle");
        busy.current = false;
        return;
      }
      preload(res.result.cards);
      setResult(res.result);
      setStock(res.result.boosters);
      // Le prix est débité tout de suite ; les bonus de set complété s'afficheront au récapitulatif.
      const bonus = res.result.completedSets.reduce((n, s) => n + s.bonus, 0);
      setBalance(res.result.balance);
      if (set) emitBalance(res.result.balance - bonus);
      setIndex(0);
      setFlipped(false);
      setPhase("tearing");
      vibrate([12]);
      window.setTimeout(
        () => {
          setPhase("reveal");
          busy.current = false;
        },
        reduced ? 250 : 1250,
      );
    });
  }, [canOpen, set, reduced]);

  const flipCurrent = useCallback(() => {
    if (!current || flipped || suspense) return;
    const wait = reduced ? 0 : SUSPENSE[current.tier];
    const doFlip = () => {
      setSuspense(false);
      setFlipped(true);
      vibrate(HAPTICS[current.tier]);
      if (current.tier === "mythic" && !reduced) setFlash((f) => f + 1);
    };
    if (wait > 0) {
      setSuspense(true);
      window.setTimeout(doFlip, wait);
    } else doFlip();
  }, [current, flipped, suspense, reduced]);

  const advance = useCallback(() => {
    if (phase !== "reveal" || !current) return;
    if (!flipped) return flipCurrent();
    if (index < cards.length - 1) {
      setIndex((i) => i + 1);
      setFlipped(false);
    } else setPhase("summary");
  }, [phase, current, flipped, flipCurrent, index, cards.length]);

  useEffect(() => {
    if (phase !== "reveal") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter" || e.key === "ArrowRight") {
        e.preventDefault();
        advance();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, advance]);

  function onDragEnd(_: unknown, info: PanInfo) {
    if (flipped && Math.abs(info.offset.x) > 80) advance();
  }

  function reset() {
    setPhase("idle");
    setResult(null);
    setIndex(0);
    setFlipped(false);
  }

  useEffect(() => {
    if (phase === "summary" && result && result.completedSets.length > 0) emitBalance(result.balance);
  }, [phase, result]);

  const dim = phase === "reveal" && current && (suspense || flipped) && tierRank(current.tier) >= tierRank("legendary");

  return (
    <div className="relative grid min-h-[calc(100dvh-12rem)] grid-cols-1 content-center justify-items-center gap-6 py-6">
      {/* Assombrissement de la scène pour les grandes révélations. */}
      <AnimatePresence>
        {dim && (
          <motion.div
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 z-30 bg-black/70"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {flash > 0 && (
          <motion.div
            key={flash}
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 z-[60] bg-white"
            initial={{ opacity: 0.85 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        )}
      </AnimatePresence>

      {/* ─── Repos : la pochette ─── */}
      {(phase === "idle" || phase === "charging") && (
        <div className="grid justify-items-center gap-6">
          <motion.button
            type="button"
            onClick={open}
            disabled={!canOpen || phase === "charging"}
            aria-label={canOpen ? (set ? `Ouvrir un booster ${set.name}` : "Ouvrir un booster") : set ? "Solde insuffisant" : "Aucun booster disponible"}
            className="relative w-[min(62vw,260px)] cursor-pointer rounded-2xl disabled:cursor-default"
            animate={
              phase === "charging" && !reduced
                ? { x: [0, -4, 4, -3, 3, 0], rotate: [0, -1.5, 1.5, -1, 1, 0], transition: { duration: 0.4, repeat: Infinity } }
                : reduced || !canOpen
                  ? {}
                  : { y: [0, -10, 0], transition: { duration: 3.2, repeat: Infinity, ease: "easeInOut" } }
            }
            whileHover={canOpen && !reduced ? { scale: 1.04, rotate: -1.5 } : undefined}
            whileTap={canOpen && !reduced ? { scale: 0.97 } : undefined}
          >
            <BoosterPackArt empty={!canOpen} {...packProps} />
            {!set && countdown.shown > 1 && (
              <span className="absolute -top-3 -right-3 grid size-11 place-items-center rounded-full bg-lime font-display text-base font-bold text-bg shadow-[0_6px_18px_-4px_var(--color-lime)]">
                ×{countdown.shown}
              </span>
            )}
          </motion.button>

          <div className="grid justify-items-center gap-3 text-center">
            {set ? (
              canOpen ? (
                <>
                  <Button size="lg" onClick={open} disabled={phase === "charging"} className="min-w-56">
                    <Sparkles aria-hidden="true" />
                    {phase === "charging" ? "Ouverture…" : <>Ouvrir · <Jetons value={set.price} /></>}
                  </Button>
                  <p className="text-sm text-muted">
                    Ton solde : <Jetons value={balance} className="text-fg" /> · 5 cartes de ce set, dont au moins une Peu commune
                  </p>
                </>
              ) : (
                <>
                  <p className="font-display text-lg font-bold">Il te manque {set.price - balance} Jetons</p>
                  <p className="max-w-[40ch] text-sm text-muted">
                    Recycle tes doublons ou termine tes quêtes du jour pour gagner des Jetons. Ton solde : <Jetons value={balance} className="text-fg" />
                  </p>
                  <div className="flex flex-wrap justify-center gap-2 pt-1">
                    <Button asChild variant="secondary">
                      <Link href="/collection?vue=cartes&tri=duplicates">
                        <Recycle aria-hidden="true" />
                        Recycler mes doublons
                      </Link>
                    </Button>
                    <Button asChild variant="secondary">
                      <Link href="/#quetes">
                        <Target aria-hidden="true" />
                        Quêtes du jour
                      </Link>
                    </Button>
                  </div>
                </>
              )
            ) : countdown.shown > 0 ? (
              <>
                <Button size="lg" onClick={open} disabled={phase === "charging"} className="min-w-56">
                  <Sparkles aria-hidden="true" />
                  {phase === "charging" ? "Ouverture…" : "Ouvrir le booster"}
                </Button>
                <p className="text-sm text-muted">
                  {countdown.shown} booster{countdown.shown > 1 ? "s" : ""} en réserve
                  {!countdown.full && countdown.remaining && <> · prochain dans <span className="font-mono text-fg">{countdown.remaining}</span></>}
                  {countdown.full && <> · <span className="text-lime">réserve pleine, ouvre-les !</span></>}
                </p>
              </>
            ) : (
              <>
                <p className="font-display text-lg font-bold">Prochain booster dans</p>
                <p className="font-mono text-4xl font-bold font-tabular text-lime" aria-live="off">
                  {countdown.remaining ?? "--:--"}
                </p>
                <div className="h-2 w-56 overflow-hidden rounded-full bg-elev" aria-hidden="true">
                  <div className="h-full rounded-full bg-gradient-to-r from-accent to-coral" style={{ width: `${Math.round(countdown.progress * 100)}%` }} />
                </div>
                <div className="mt-2 flex flex-wrap justify-center gap-2">
                  <Button asChild variant="secondary">
                    <Link href="/boosters/sets">
                      <Sparkles aria-hidden="true" />
                      Boosters de set
                    </Link>
                  </Button>
                  <Button asChild variant="secondary">
                    <Link href="/collection">
                      <Layers aria-hidden="true" />
                      Ma collection
                    </Link>
                  </Button>
                </div>
              </>
            )}
            {error && (
              <p role="alert" className="rounded-full bg-danger/15 px-4 py-2 text-sm text-danger">
                {error}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ─── Déchirure de la pochette ─── */}
      {phase === "tearing" && (
        <div className="relative w-[min(62vw,260px)]" aria-live="polite">
          <span className="sr-only">Ouverture du booster…</span>
          <motion.div
            className="relative"
            style={{ clipPath: "inset(0 0 89% 0)" }}
            initial={{ x: 0, y: 0, rotate: 0 }}
            animate={reduced ? { opacity: 0 } : { x: 60, y: -160, rotate: 24, opacity: 0 }}
            transition={{ duration: 0.7, delay: 0.25, ease: [0.3, 0.7, 0.4, 1] }}
          >
            <BoosterPackArt {...packProps} />
          </motion.div>
          <motion.div
            className="absolute inset-0"
            style={{ clipPath: "inset(11% 0 0 0)" }}
            initial={{ y: 0, opacity: 1 }}
            animate={reduced ? { opacity: 0 } : { y: [0, 0, 70], opacity: [1, 1, 0], scale: [1, 1, 0.95] }}
            transition={{ duration: 1.1, times: [0, 0.55, 1] }}
          >
            <BoosterPackArt {...packProps} />
          </motion.div>
          {!reduced && (
            <motion.div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-[-30%] top-[6%] h-24 rounded-full bg-[radial-gradient(closest-side,rgb(255_255_255/0.95),rgb(184_243_92/0.5),transparent)]"
              initial={{ opacity: 0, scaleY: 0.2 }}
              animate={{ opacity: [0, 1, 0], scaleY: [0.2, 1.6, 2.4] }}
              transition={{ duration: 0.9, delay: 0.2 }}
            />
          )}
        </div>
      )}

      {/* ─── Révélation carte par carte ─── */}
      {phase === "reveal" && current && (
        <div className="relative z-40 grid w-full justify-items-center gap-5">
          <div className="relative w-[min(70vw,300px)]">
            {/* Pile des cartes restantes, face cachée. */}
            {cards.slice(index + 1).map((c, i) => (
              <div
                key={c.copyId}
                aria-hidden="true"
                className="absolute inset-0"
                style={{ transform: `translate(${(i + 1) * 5}px, ${(i + 1) * 6}px) rotate(${(i + 1) * 1.6}deg)`, zIndex: -1 - i }}
              >
                <CardBack />
              </div>
            ))}

            {/* Rayons derrière les cartes Légendaire et Mythique. */}
            <AnimatePresence>
              {flipped && !reduced && tierRank(current.tier) >= tierRank("legendary") && (
                <motion.div
                  key={`rays-${index}`}
                  aria-hidden="true"
                  data-tier={current.tier}
                  className="pf-rays pointer-events-none absolute -inset-[70%] -z-10"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.6 }}
                />
              )}
            </AnimatePresence>

            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={current.copyId}
                className="relative"
                initial={reduced ? { opacity: 0 } : { y: index === 0 ? 120 : 0, opacity: index === 0 ? 0 : 1, scale: index === 0 ? 0.8 : 1 }}
                animate={{ y: 0, x: 0, opacity: 1, scale: 1, rotate: 0 }}
                exit={reduced ? { opacity: 0 } : { x: -420, y: 40, rotate: -22, opacity: 0, transition: { duration: 0.35, ease: "easeIn" } }}
                transition={{ type: "spring", stiffness: 260, damping: 24 }}
                drag={flipped ? "x" : false}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.7}
                onDragEnd={onDragEnd}
              >
                <Presence>
                <motion.button
                  type="button"
                  onClick={advance}
                  aria-label={flipped ? `${current.name}, ${TIER_LABELS_FR[current.tier]}. Carte suivante` : "Retourner la carte"}
                  data-tier={current.tier}
                  className={cn("relative block w-full rounded-[var(--radius-card)] [perspective:1200px]", suspense && "pf-leak")}
                  animate={
                    suspense && !reduced
                      ? { x: [0, -5, 5, -6, 6, -3, 3, 0], rotate: [0, -1, 1, -1.5, 1.5, 0], transition: { duration: 0.45, repeat: Infinity } }
                      : { x: 0, rotate: 0 }
                  }
                >
                  <motion.div
                    className="relative [transform-style:preserve-3d]"
                    animate={{ rotateY: flipped ? 180 : 0 }}
                    transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 140, damping: 16, mass: 0.9 }}
                  >
                    <div className="[backface-visibility:hidden]">
                      <CardBack />
                    </div>
                    <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]">
                      <CardFront card={current} />
                    </div>
                  </motion.div>
                </motion.button>
                </Presence>
                {flipped && !reduced && <Burst key={`burst-${index}`} tier={current.tier} />}
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="grid min-h-24 justify-items-center gap-2 text-center" aria-live="polite">
            <AnimatePresence mode="wait">
              {flipped ? (
                <motion.div
                  key={`info-${index}`}
                  className="grid justify-items-center gap-2"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.25 }}
                >
                  <PullBadges card={current} />
                  <p className="font-display text-xl font-bold">{current.name}</p>
                  <p className="text-sm text-muted">
                    {current.setName} · n° {current.localId}
                  </p>
                </motion.div>
              ) : (
                <motion.p key={`hint-${index}`} className="pt-4 text-sm text-muted" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  {suspense ? "Oh… quelque chose brille" : "Touche la carte pour la retourner"}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-4">
            <ol className="flex gap-2" aria-label="Progression">
              {cards.map((c, i) => (
                <li
                  key={c.copyId}
                  data-tier={c.tier}
                  aria-label={i < index || (i === index && flipped) ? TIER_LABELS_FR[c.tier] : "Face cachée"}
                  className={cn(
                    "size-2.5 rounded-full transition-colors",
                    i < index || (i === index && flipped) ? "bg-[var(--tier)]" : i === index ? "bg-fg" : "bg-line",
                  )}
                />
              ))}
            </ol>
            <Button variant="ghost" size="sm" onClick={() => setPhase("summary")}>
              <Zap aria-hidden="true" />
              Tout révéler
            </Button>
          </div>
        </div>
      )}

      {/* ─── Récapitulatif ─── */}
      {phase === "summary" && result && (
        <motion.div
          className="grid w-full grid-cols-1 justify-items-center gap-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className="grid justify-items-center gap-2 text-center">
            <h2 className="font-display text-2xl font-bold sm:text-3xl">{set ? set.name : "Ton booster"}</h2>
            {best && (
              <p className="text-muted">
                Meilleure carte : <strong className="text-fg">{best.name}</strong> ({TIER_LABELS_FR[best.tier]})
                {cards.some((c) => c.isNew) && <> · {cards.filter((c) => c.isNew).length} nouvelle{cards.filter((c) => c.isNew).length > 1 ? "s" : ""}</>}
              </p>
            )}
          </div>
          {result.completedSets.map((cs) => (
            <motion.div
              key={cs.setId}
              className="relative grid w-full max-w-md justify-items-center gap-1 overflow-hidden rounded-[var(--radius-card)] border-2 border-[#FFC93C] bg-[radial-gradient(120%_120%_at_50%_0%,rgb(255_201_60/0.28),transparent_60%)] p-5 text-center shadow-[0_0_60px_-12px_#FFC93C]"
              initial={reduced ? { opacity: 0 } : { scale: 0.7, opacity: 0, rotate: -3 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 14, delay: 0.4 }}
            >
              <CoinBurst count={18} />
              <p className="inline-flex items-center gap-1.5 font-mono text-xs font-bold tracking-[0.2em] text-[#FFC93C] uppercase">
                <CheckCircle2 aria-hidden="true" className="size-4" />
                Set complété
              </p>
              <p className="font-display text-xl font-bold">{cs.name}</p>
              <p className="text-muted">
                Bonus : <Jetons value={cs.bonus} signed className="text-[#FFC93C]" />
              </p>
            </motion.div>
          ))}
          {result.questsDone.length > 0 && (
            <ul className="flex flex-wrap justify-center gap-2">
              {result.questsDone.map((q) => (
                <li key={q.kind}>
                  <Link href="/#quetes" className="inline-flex items-center gap-2 rounded-full border border-accent/60 bg-accent/10 px-3.5 py-1.5 text-sm hover:bg-accent/20">
                    <Target aria-hidden="true" className="size-4 text-accent" />
                    Quête terminée : {q.label} · réclame <Jetons value={q.reward} className="text-[#FFC93C]" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <ul className="grid w-full max-w-4xl grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-5">
            {cards.map((c, i) => (
              <motion.li
                key={c.copyId}
                className="grid gap-2"
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 30, rotate: -4 }}
                animate={{ opacity: 1, y: 0, rotate: 0 }}
                transition={{ delay: reduced ? 0 : i * 0.07, type: "spring", stiffness: 220, damping: 20 }}
              >
                <Link href={`/cartes/${c.id}`} className="rounded-[var(--radius-card)]" aria-label={`${c.name}, ${TIER_LABELS_FR[c.tier]}`}>
                  <TiltCard image={c.image} name={c.name} tier={c.tier} quality="high" />
                </Link>
                <PullBadges card={c} compact />
              </motion.li>
            ))}
          </ul>
          <div className="flex flex-wrap justify-center gap-3">
            {set ? (
              canOpen ? (
                <Button size="lg" onClick={() => { reset(); window.setTimeout(open, 50); }}>
                  <Sparkles aria-hidden="true" />
                  Encore un · <Jetons value={set.price} />
                </Button>
              ) : (
                <Button asChild size="lg">
                  <Link href="/boosters/sets">Autres sets</Link>
                </Button>
              )
            ) : countdown.shown > 0 ? (
              <Button size="lg" onClick={() => { reset(); window.setTimeout(open, 50); }}>
                <Sparkles aria-hidden="true" />
                Ouvrir le suivant ({countdown.shown})
              </Button>
            ) : (
              <Button size="lg" onClick={reset}>
                Prochain dans {countdown.remaining ?? "--:--"}
              </Button>
            )}
            <Button asChild size="lg" variant="secondary">
              <Link href="/collection">
                <Layers aria-hidden="true" />
                Ma collection
              </Link>
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
