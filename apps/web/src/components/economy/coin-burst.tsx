"use client";

import { motion, useReducedMotion } from "motion/react";
import { useMemo } from "react";
import { JetonIcon } from "@/components/jetons";

/** Pluie de pièces pour célébrer un gain de Jetons. */
export function CoinBurst({ count = 14 }: { count?: number }) {
  const reduced = useReducedMotion();
  const coins = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = -Math.PI / 2 + ((i / (count - 1)) - 0.5) * Math.PI * 1.1;
        const dist = 70 + Math.random() * 70;
        return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, r: (Math.random() - 0.5) * 540, d: Math.random() * 0.15, s: 0.7 + Math.random() * 0.6 };
      }),
    [count],
  );
  if (reduced) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 grid place-items-center">
      {coins.map((c, i) => (
        <motion.span
          key={i}
          className="absolute text-2xl"
          initial={{ x: 0, y: 0, opacity: 1, scale: 0.4, rotate: 0 }}
          animate={{ x: c.x, y: [0, c.y, c.y + 90], opacity: [1, 1, 0], scale: c.s, rotate: c.r }}
          transition={{ duration: 1.1, delay: c.d, ease: [0.2, 0.7, 0.4, 1], times: [0, 0.45, 1] }}
        >
          <JetonIcon />
        </motion.span>
      ))}
    </div>
  );
}
