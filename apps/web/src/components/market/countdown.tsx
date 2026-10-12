"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

function format(ms: number) {
  if (ms <= 0) return "Terminée";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d} j ${h} h`;
  if (h > 0) return `${h} h ${String(m).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/** Temps restant d'une enchère, à la seconde dans la dernière heure ; rouge dans la dernière minute. */
export function Countdown({ endsAt, className, onEnd }: { endsAt: string; className?: string; onEnd?: () => void }) {
  const end = new Date(endsAt).getTime();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const left = now === null ? null : end - now;
  useEffect(() => {
    if (left !== null && left <= 0) onEnd?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- on ne prévient qu'au passage à zéro
  }, [left !== null && left <= 0]);
  return (
    <span
      suppressHydrationWarning
      className={cn("font-mono font-tabular", left !== null && left > 0 && left < 60_000 && "text-coral", left !== null && left <= 0 && "text-muted", className)}
    >
      {left === null ? "··:··" : format(left)}
    </span>
  );
}
