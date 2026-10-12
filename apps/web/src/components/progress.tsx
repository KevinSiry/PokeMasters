import { cn } from "@/lib/utils";

/** Barre de progression (complétion). Verte à 100 %. */
export function ProgressBar({ value, max, className, label }: { value: number; max: number; className?: string; label?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const done = max > 0 && value >= max;
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-label={label}
      className={cn("h-2 overflow-hidden rounded-full bg-elev", className)}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-700", done ? "bg-lime" : "bg-gradient-to-r from-accent to-coral")}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** Anneau de complétion avec le pourcentage au centre. */
export function ProgressRing({ percent, size = 112, label }: { percent: number; size?: number; label: string }) {
  const r = 44;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, percent));
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }} role="img" aria-label={`${label} : ${p.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden="true">
        <defs>
          <linearGradient id="pf-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--color-accent)" />
            <stop offset="1" stopColor="var(--color-coral)" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--color-elev)" strokeWidth="9" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="url(#pf-ring)"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${(p / 100) * c} ${c}`}
        />
      </svg>
      <span className="font-display text-xl font-bold font-tabular" aria-hidden="true">
        {(p < 10 && p > 0 ? Math.floor(p * 10) / 10 : Math.floor(p)).toLocaleString("fr-FR")}
        <span className="text-sm text-muted">%</span>
      </span>
    </div>
  );
}
