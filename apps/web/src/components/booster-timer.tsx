"use client";

import Link from "next/link";
import { useBoosterCountdown } from "@/lib/use-booster-countdown";
import { cn } from "@/lib/utils";

interface BoosterTimerProps {
  available: number;
  maxStock: number;
  /** ISO de la prochaine recharge calculée par le serveur ; null si le stock est plein. */
  nextAt: string | null;
  refillIntervalMs: number;
  className?: string;
}

/**
 * Pastille « boosters disponibles + compte à rebours ».
 * Purement visuelle : le serveur recalcule toujours le stock réel au moment d'ouvrir.
 */
export function BoosterTimer({ available, maxStock, nextAt, refillIntervalMs, className }: BoosterTimerProps) {
  const { shown, full, remaining } = useBoosterCountdown(available, nextAt, maxStock, refillIntervalMs);

  return (
    <Link
      href="/boosters"
      className={cn(
        "flex h-10 items-center gap-2 rounded-full border border-line bg-elev pr-3 pl-1.5 sm:h-auto sm:py-1 font-mono text-xs font-tabular transition-colors hover:border-accent",
        className,
      )}
      aria-label={
        full
          ? `${shown} boosters sur ${maxStock}, stock plein`
          : `${shown} boosters sur ${maxStock}, prochain dans ${remaining ?? "quelques minutes"}`
      }
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
      <span aria-hidden="true" className="whitespace-nowrap">
        {/* Sur mobile, le badge donne déjà le stock : on n'affiche que l'état. */}
        <span className="hidden sm:inline">
          {shown}/{maxStock}
          <span className="text-muted"> · </span>
        </span>
        {full ? <span className="text-lime">plein</span> : <span>{remaining ?? "--:--"}</span>}
      </span>
    </Link>
  );
}
