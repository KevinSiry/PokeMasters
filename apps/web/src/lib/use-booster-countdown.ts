"use client";

import { useEffect, useState } from "react";

export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Projection locale du minuteur de boosters (purement visuelle : le serveur recalcule
 * toujours le stock réel au moment d'ouvrir).
 */
export function useBoosterCountdown(available: number, nextAt: string | null, maxStock: number, refillIntervalMs: number) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  let shown = available;
  let next = nextAt ? new Date(nextAt).getTime() : null;
  if (now !== null && next !== null) {
    while (next !== null && now >= next && shown < maxStock) {
      shown += 1;
      next = shown >= maxStock ? null : next + refillIntervalMs;
    }
  }
  const full = shown >= maxStock;
  const remainingMs = next !== null && now !== null ? next - now : null;
  return {
    shown,
    full,
    remaining: remainingMs !== null ? formatRemaining(remainingMs) : null,
    /** Avancement de la recharge en cours, entre 0 et 1. */
    progress: remainingMs !== null ? 1 - remainingMs / refillIntervalMs : full ? 1 : 0,
  };
}
