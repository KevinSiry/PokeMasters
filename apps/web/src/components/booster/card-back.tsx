import { cn } from "@/lib/utils";

/** Dos de carte PokeFlex (création originale, pas le dos officiel du jeu). */
export function CardBack({ className }: { className?: string }) {
  return (
    <div className={cn("pf-card-back grid place-items-center", className)} aria-hidden="true">
      <svg viewBox="0 0 100 100" className="w-[46%] drop-shadow-[0_6px_16px_rgb(0_0_0/0.6)]">
        <defs>
          <linearGradient id="pf-back-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#8B6CFF" />
            <stop offset="1" stopColor="#FF5C85" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="46" fill="#120A26" stroke="url(#pf-back-g)" strokeWidth="5" />
        <circle cx="50" cy="50" r="34" fill="none" stroke="#B8F35C" strokeOpacity="0.35" strokeWidth="1.5" strokeDasharray="3 5" />
        <path d="M50 22l7.6 15.5 17 2.5-12.3 12 2.9 17L50 61l-15.2 8 2.9-17-12.3-12 17-2.5z" fill="url(#pf-back-g)" />
      </svg>
    </div>
  );
}
