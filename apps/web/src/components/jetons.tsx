import { cn, formatJetons } from "@/lib/utils";

/** Pièce de Jeton (monnaie du jeu, sans valeur réelle). */
export function JetonIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn("size-[1.05em] shrink-0", className)}>
      <defs>
        <linearGradient id="pf-jeton" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFE9A3" />
          <stop offset="0.55" stopColor="#FFC93C" />
          <stop offset="1" stopColor="#E08A1E" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="11" fill="url(#pf-jeton)" />
      <circle cx="12" cy="12" r="8" fill="none" stroke="#8A4B0F" strokeOpacity="0.45" strokeWidth="1.4" />
      <path d="M13.6 7.2v6.1c0 2-1.2 3.3-3.2 3.3-.9 0-1.7-.3-2.3-.8l.9-1.5c.4.3.8.5 1.3.5.8 0 1.2-.5 1.2-1.5V7.2z" fill="#6B3A0B" />
    </svg>
  );
}

/** Montant de Jetons avec sa pièce. */
export function Jetons({ value, className, signed }: { value: number; className?: string; signed?: boolean }) {
  const sign = signed && value > 0 ? "+" : signed && value < 0 ? "−" : "";
  return (
    <span className={cn("inline-flex items-center gap-1 align-[-0.1em] font-mono font-bold font-tabular whitespace-nowrap", className)}>
      <JetonIcon />
      <span aria-hidden="true">
        {sign}
        {formatJetons(Math.abs(value))}
      </span>
      <span className="sr-only">
        {sign}
        {formatJetons(Math.abs(value))} Jetons
      </span>
    </span>
  );
}
