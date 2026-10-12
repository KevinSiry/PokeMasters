"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface BoosterTimerProps {
  available: number;
  maxStock: number;
  /** ISO de la prochaine recharge calculée par le serveur ; null si le stock est plein. */
  nextAt: string | null;
  refillIntervalMs: number;
  className?: string;
}

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Pastille « boosters disponibles + compte à rebours ».
 * Purement visuelle : le serveur recalcule toujours le stock réel au moment d'ouvrir.
 */
export function BoosterTimer({ available, maxStock, nextAt, refillIntervalMs, className }: BoosterTimerProps) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Projection locale : si la recharge tombe pendant que la page est ouverte, on l'affiche.
  let shown = available;
  let next = nextAt ? new Date(nextAt).getTime() : null;
  if (now !== null && next !== null) {
    while (next !== null && now >= next && shown < maxStock) {
      shown += 1;
      next = shown >= maxStock ? null : next + refillIntervalMs;
    }
  }
  const full = shown >= maxStock;
  const remaining = next !== null && now !== null ? formatRemaining(next - now) : null;

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full border border-line bg-elev py-1 pr-3 pl-1.5 font-mono text-xs font-tabular",
        className,
      )}
      aria-label={
        full
          ? `${shown} boosters sur ${maxStock}, stock plein`
          : `${shown} boosters sur ${maxStock}, prochain dans ${remaining ?? "quelques minutes"}`
      }
      role="status"
    >
      <span
        aria-hidden="true"
        className={cn(
          "grid h-6 w-5 place-items-center rounded-[5px] bg-gradient-to-br from-accent to-coral text-[10px] font-bold text-bg",
          shown > 0 && "shadow-[0_0_12px_-2px_var(--color-coral)]",
        )}
      >
        {shown}
      </span>
      <span aria-hidden="true">
        {shown}/{maxStock}
        <span className="text-muted"> · </span>
        {full ? <span className="text-lime">plein</span> : <span>{remaining ?? "--:--"}</span>}
      </span>
    </div>
  );
}
