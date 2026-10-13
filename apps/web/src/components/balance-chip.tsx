"use client";

import { animate, AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { JetonIcon } from "@/components/jetons";
import { onBalance } from "@/lib/balance-events";
import { cn, formatJetons } from "@/lib/utils";

/**
 * Solde de Jetons de l'en-tête. Se met à jour instantanément après une action (événement local)
 * puis se réaligne sur la valeur du serveur ; les gains s'affichent en « +N » qui s'envole.
 */
export function BalanceChip({ balance, className }: { balance: number; className?: string }) {
  const reduced = useReducedMotion() ?? false;
  const [shown, setShown] = useState(balance);
  const [target, setTarget] = useState(balance);
  const [gains, setGains] = useState<{ id: number; delta: number }[]>([]);
  const last = useRef(balance);
  const ref = useRef<HTMLAnchorElement>(null);

  useEffect(() => setTarget(balance), [balance]);
  useEffect(() => onBalance(({ balance: b }) => setTarget(b)), []);

  useEffect(() => {
    const from = last.current;
    if (from === target) return;
    last.current = target;
    const delta = target - from;
    setGains((g) => [...g.slice(-2), { id: Date.now() + Math.random(), delta }]);
    if (delta > 0 && !reduced) ref.current?.animate([{ transform: "scale(1)" }, { transform: "scale(1.12)" }, { transform: "scale(1)" }], { duration: 450, easing: "ease-out" });
    if (reduced) {
      setShown(target);
      return;
    }
    const controls = animate(from, target, { duration: Math.min(1.2, 0.4 + Math.abs(delta) / 800), ease: "easeOut", onUpdate: (v) => setShown(Math.round(v)) });
    return () => controls.stop();
  }, [target, reduced]);

  return (
    <Link
      ref={ref}
      href="/jetons"
      className={cn(
        "relative flex h-10 items-center gap-1.5 rounded-full border border-line bg-elev pr-3 pl-1.5 sm:h-auto sm:py-1 font-mono text-xs font-bold font-tabular transition-colors hover:border-[#FFC93C]",
        className,
      )}
      aria-label={`${formatJetons(target)} Jetons, voir l'historique`}
    >
      <JetonIcon className="size-5" />
      <span aria-hidden="true">{formatJetons(shown)}</span>
      <AnimatePresence>
        {gains.map((g) => (
          <motion.span
            key={g.id}
            aria-hidden="true"
            className={cn("pointer-events-none absolute top-full right-2 font-mono text-xs font-bold", g.delta > 0 ? "text-[#FFC93C]" : "text-coral")}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: [0, 1, 1, 0], y: [-4, 2, 8, 14] }}
            transition={{ duration: 1.6, times: [0, 0.15, 0.7, 1] }}
            onAnimationComplete={() => setGains((all) => all.filter((x) => x.id !== g.id))}
          >
            {g.delta > 0 ? "+" : "−"}
            {formatJetons(Math.abs(g.delta))}
          </motion.span>
        ))}
      </AnimatePresence>
    </Link>
  );
}
