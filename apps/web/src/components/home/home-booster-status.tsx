"use client";

import { useBoosterCountdown } from "@/lib/use-booster-countdown";

export function HomeBoosterStatus(props: { available: number; nextAt: string | null; maxStock: number; refillIntervalMs: number }) {
  const { shown, full, remaining } = useBoosterCountdown(props.available, props.nextAt, props.maxStock, props.refillIntervalMs);
  return (
    <div className="grid gap-1">
      <p className="font-display text-2xl leading-tight font-bold sm:text-3xl">
        {shown > 0 ? (
          <>
            {shown} booster{shown > 1 ? "s" : ""} <span className="text-prism">à ouvrir</span>
          </>
        ) : (
          "Plus de booster"
        )}
      </p>
      <p className="text-sm text-muted">
        {full ? (
          <span className="text-lime">Réserve pleine : le minuteur est en pause.</span>
        ) : (
          <>
            Prochain dans <span className="font-mono text-fg font-tabular">{remaining ?? "--:--"}</span>
          </>
        )}
      </p>
    </div>
  );
}
