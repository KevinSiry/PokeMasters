import { cn } from "@/lib/utils";

/** Visuel de la pochette « Toutes époques ». Le haut et le corps peuvent être rendus séparément pour l'animation de déchirure. */
export function BoosterPackArt({ label = "Toutes époques", count = 5, className, empty }: { label?: string; count?: number; className?: string; empty?: boolean }) {
  return (
    <div className={cn("pf-pack select-none [container-type:inline-size]", className)} data-empty={empty || undefined}>
      <div className="absolute inset-x-0 top-[11%] border-t-2 border-dashed border-white/25" aria-hidden="true" />
      <div className="absolute inset-0 grid grid-rows-[1fr_auto_1fr] place-items-center p-[8%] text-center">
        <span className="self-end font-mono text-[4.4cqw] font-bold tracking-[0.3em] text-white/80 uppercase">
          Booster
        </span>
        <svg viewBox="0 0 100 100" className="my-[8%] w-[62%] drop-shadow-[0_10px_24px_rgb(0_0_0/0.45)]" aria-hidden="true">
          <circle cx="50" cy="50" r="46" fill="#0B0716" fillOpacity="0.55" stroke="#fff" strokeOpacity="0.85" strokeWidth="3" />
          <path d="M50 18l8.8 17.9 19.7 2.9-14.3 13.9 3.4 19.6L50 63l-17.6 9.3 3.4-19.6-14.3-13.9 19.7-2.9z" fill="#B8F35C" />
        </svg>
        <div className="grid gap-1 self-start">
          <span className="font-display text-[9cqw] leading-none font-bold text-white drop-shadow">{label}</span>
          <span className="font-mono text-[4cqw] font-bold tracking-[0.2em] text-white/75 uppercase">
            {count} cartes · PokeFlex
          </span>
        </div>
      </div>
    </div>
  );
}
