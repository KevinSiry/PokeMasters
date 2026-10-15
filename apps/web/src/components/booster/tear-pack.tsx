"use client";

import { animate, motion, useMotionValue, useSpring, useTransform, type PanInfo } from "motion/react";
import { useEffect, useRef } from "react";
import { BoosterPackArt } from "@/components/booster/booster-pack";
import { cn } from "@/lib/utils";

type PackProps = { label?: string; logo?: string | null; palette?: string; cover?: string | null };

/** Hauteur de la ligne de déchirure, en % de la pochette (pointillés dessinés par BoosterPackArt). */
const TEAR_Y = 11;

/** Bord déchiré en dents de scie, partagé par la languette et le corps pour qu'ils s'emboîtent. */
function tearEdge() {
  const n = 26;
  return Array.from({ length: n + 1 }, (_, i) => `${((i / n) * 100).toFixed(2)}% ${(TEAR_Y + (i % 2 ? 0.8 : -0.8)).toFixed(2)}%`);
}
const EDGE = tearEdge();
const STRIP_CLIP = `polygon(0 0, 100% 0, ${[...EDGE].reverse().join(", ")})`;
const BODY_CLIP = `polygon(${EDGE.join(", ")}, 100% 100%, 0 100%)`;

/** Part du trajet horizontal (largeur de la pochette) qui déchire complètement la languette. */
const TEAR_DISTANCE = 0.7;
const MAX_TILT = 14;

function buzz(pattern: number[]) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(pattern);
}

/**
 * Pochette au repos : elle flotte et s'incline sous le doigt ou la souris, avec un reflet métallisé
 * qui suit l'inclinaison. Tout passe par des valeurs animées (transform) : aucun rendu React par image.
 */
export function FloatingPack({ pack, empty, interactive }: { pack: PackProps; empty?: boolean; interactive: boolean }) {
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const spring = { stiffness: 220, damping: 18, mass: 0.6 };
  const rotateX = useSpring(rx, spring);
  const rotateY = useSpring(ry, spring);
  const glareX = useTransform(rotateY, [-MAX_TILT, MAX_TILT], ["-28%", "28%"]);
  const glareY = useTransform(rotateX, [-MAX_TILT, MAX_TILT], ["28%", "-28%"]);

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!interactive) return;
    const r = e.currentTarget.getBoundingClientRect();
    ry.set(((e.clientX - r.left) / r.width - 0.5) * 2 * MAX_TILT);
    rx.set((0.5 - (e.clientY - r.top) / r.height) * 2 * MAX_TILT);
  }
  function onPointerLeave() {
    rx.set(0);
    ry.set(0);
  }

  return (
    <motion.div layoutId="pf-pack" className="relative" onPointerMove={onPointerMove} onPointerLeave={onPointerLeave} onPointerCancel={onPointerLeave}>
      <motion.div style={{ rotateX, rotateY, transformPerspective: 900 }} className="will-change-transform">
        <BoosterPackArt empty={empty} {...pack}>
          {interactive && (
            <motion.span
              aria-hidden="true"
              className="pf-pack-glare pointer-events-none absolute -inset-1/4"
              style={{ x: glareX, y: glareY }}
            />
          )}
        </BoosterPackArt>
      </motion.div>
    </motion.div>
  );
}

interface TearPackProps {
  pack: PackProps;
  stage: "tearing" | "emerging";
  torn: boolean;
  /** Languette arrachée, en attente de la réponse du serveur. */
  waiting: boolean;
  reduced: boolean;
  onTear: () => void;
}

/**
 * Pochette prête à être ouverte : on la déchire en glissant le doigt le long du haut (ou d'un tap).
 * La languette pivote autour de son extrémité à mesure qu'on avance, une lumière filtre par la fente,
 * puis elle s'envole ; à l'étape « emerging », le corps du sachet descend pour libérer les cartes.
 */
export function TearPack({ pack, stage, torn, waiting, reduced, onTear }: TearPackProps) {
  const ref = useRef<HTMLDivElement>(null);
  const progress = useMotionValue(0);
  /** 1 : la languette pivote autour de son bout droit (déchirure de gauche à droite) ; 0 : l'inverse. */
  const pivot = useMotionValue(1);
  const stripRotate = useTransform(() => progress.get() * 11 * (pivot.get() === 1 ? 1 : -1));
  const seamOrigin = useTransform(pivot, (v) => 1 - v);
  const stripY = useTransform(progress, [0, 1], [0, -8]);
  const seamOpacity = useTransform(progress, [0, 0.04, 1], [0, 0.75, 1]);
  const panned = useRef(false);
  const width = useRef(1);
  const lastTick = useRef(0);

  useEffect(() => {
    if (!torn) return;
    const controls = animate(progress, 1, { duration: reduced ? 0 : 0.22, ease: "easeOut" });
    return () => controls.stop();
  }, [torn, progress, reduced]);

  function onPanStart(_: PointerEvent, info: PanInfo) {
    panned.current = true;
    width.current = ref.current?.getBoundingClientRect().width ?? 1;
    // On déchire depuis le côté où le doigt commence : la languette pivote autour de l'autre bout.
    pivot.set(info.delta.x >= 0 ? 1 : 0);
  }
  function onPan(_: PointerEvent, info: PanInfo) {
    if (torn) return;
    const p = Math.min(1, Math.abs(info.offset.x) / (width.current * TEAR_DISTANCE));
    progress.set(p);
    const tick = Math.floor(p * 5);
    if (tick > lastTick.current) buzz([6]);
    lastTick.current = tick;
  }
  function onPanEnd(_: PointerEvent, info: PanInfo) {
    if (torn) return;
    const p = progress.get();
    if (p > 0.55 || (p > 0.15 && Math.abs(info.velocity.x) > 650)) onTear();
    else animate(progress, 0, { type: "spring", stiffness: 420, damping: 30 });
    lastTick.current = 0;
  }

  return (
    <motion.div
      ref={ref}
      layoutId="pf-pack"
      className={cn("absolute top-[-21%] left-[-6%] z-10 w-[112%] touch-pan-y select-none", !torn && "cursor-grab active:cursor-grabbing")}
      onPointerDown={() => (panned.current = false)}
      onPanStart={onPanStart}
      onPan={onPan}
      onPanEnd={onPanEnd}
      onClick={() => {
        if (!panned.current && !torn) onTear();
      }}
    >
      {/* Ombre portée (dégradé plutôt qu'un filtre : rien à recalculer pendant l'animation). */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-[8%] -bottom-[4%] h-[8%] rounded-[50%] bg-[radial-gradient(closest-side,rgb(0_0_0/0.65),transparent)]"
        animate={stage === "emerging" ? { opacity: 0 } : { opacity: 1 }}
        transition={{ duration: 0.4, delay: stage === "emerging" ? 0.5 : 0 }}
      />

      {/* Corps du sachet : descend et s'efface une fois les cartes sorties. */}
      <motion.div
        style={{ clipPath: BODY_CLIP }}
        className="will-change-transform"
        initial={false}
        animate={stage === "emerging" ? { y: ["0%", "0%", "70%"], opacity: [1, 1, 0], rotate: [0, 0, 4] } : { y: "0%", opacity: 1, rotate: 0 }}
        transition={stage === "emerging" ? { duration: 1.05, times: [0, 0.6, 1], ease: [0.5, 0, 0.75, 0] } : { duration: 0.2 }}
      >
        <BoosterPackArt {...pack} />
      </motion.div>

      {/* Lumière qui filtre par la fente pendant la déchirure, puis pulse en attendant les cartes. */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-[2%] top-[8.6%] h-[4.8%]"
        initial={false}
        animate={{ opacity: torn ? 0 : 1 }}
        transition={{ duration: 0.45, delay: torn ? 0.15 : 0 }}
      >
        <motion.div className="pf-tear-seam h-full will-change-transform" style={{ scaleX: progress, opacity: seamOpacity, originX: seamOrigin }} />
      </motion.div>
      {torn && (
        <motion.div
          aria-hidden="true"
          className={cn("pf-tear-glow pointer-events-none absolute inset-x-[-25%] top-[-14%] h-[48%]", waiting && "pf-tear-wait")}
          initial={{ opacity: 0, scale: 0.4 }}
          animate={stage === "emerging" ? { opacity: 0, scale: 1.4 } : { opacity: 1, scale: 1 }}
          transition={{ duration: stage === "emerging" ? 0.8 : 0.35, ease: "easeOut" }}
        />
      )}

      {/* Languette : pivote autour de son extrémité pendant le geste, puis s'envole. */}
      <motion.div
        className="pointer-events-none absolute inset-0 will-change-transform"
        initial={false}
        animate={torn ? { x: "42%", y: "-55%", rotate: 34, opacity: 0 } : { x: 0, y: 0, rotate: 0, opacity: 1 }}
        transition={torn ? { duration: 0.65, ease: [0.25, 0.6, 0.35, 1], opacity: { duration: 0.65, ease: "easeIn" } } : { duration: 0 }}
      >
        <motion.div style={{ clipPath: STRIP_CLIP, rotate: stripRotate, y: stripY, originX: pivot, originY: TEAR_Y / 100 }}>
          <BoosterPackArt {...pack} />
        </motion.div>
      </motion.div>

      {/* Indication du geste, sur la ligne de déchirure. */}
      {!torn && !reduced && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-[10%] top-[6.5%] h-[9%] overflow-hidden">
          <span className="pf-tear-hint absolute top-1/2 left-0 block h-[34%] w-[22%] -translate-y-1/2 rounded-full" />
        </div>
      )}
    </motion.div>
  );
}
