import Link from "next/link";
import { cn } from "@/lib/utils";

/** Logotype PokeFlex : monogramme « carte inclinée » + nom en dégradé prisme. */
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="group inline-flex shrink-0 items-center gap-2 rounded-lg p-1 -m-1" aria-label="PokeFlex, accueil">
      <svg width="26" height="30" viewBox="0 0 26 30" aria-hidden="true" className="transition-transform group-hover:-rotate-6">
        <defs>
          <linearGradient id="pf-logo-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--color-accent)" />
            <stop offset="1" stopColor="var(--color-coral)" />
          </linearGradient>
        </defs>
        <rect x="5" y="1" width="18" height="26" rx="3.5" transform="rotate(8 14 14)" fill="var(--color-elev)" stroke="var(--color-line)" />
        <rect x="2" y="3" width="18" height="26" rx="3.5" fill="url(#pf-logo-g)" />
        <path d="M11 9.5l1.6 3.3 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.5 3.6-.5z" fill="var(--color-bg)" />
      </svg>
      {/* Sur téléphone connecté, la place va aux compteurs : le monogramme suffit. */}
      <span className={cn("font-display text-lg font-bold tracking-tight text-prism", compact && "max-sm:sr-only")}>PokeFlex</span>
    </Link>
  );
}
