import { PackLogo } from "@/components/booster/pack-logo";
import { cn } from "@/lib/utils";

/** FNV-1a mélangé : deux ids voisins (« me04 », « me05 ») donnent des teintes éloignées. */
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  return h >>> 0;
}

/** Couleurs de pochette propres à chaque set (stables d'une visite à l'autre). */
export function packPalette(seed: string): React.CSSProperties {
  const h = hash(seed) % 360;
  return {
    "--pack-1": `hsl(${h} 62% 22%)`,
    "--pack-2": `hsl(${h} 72% 48%)`,
    "--pack-3": `hsl(${(h + 45) % 360} 70% 42%)`,
    "--pack-4": `hsl(${(h + 80) % 360} 92% 66%)`,
  } as React.CSSProperties;
}

interface BoosterPackArtProps {
  label?: string;
  count?: number;
  className?: string;
  empty?: boolean;
  /** Logo du set (base d'URL TCGdex) : remplace l'étoile des boosters « Toutes époques ». */
  logo?: string | null;
  /** Graine des couleurs (id du set) ; sans graine, la pochette prisme par défaut. */
  palette?: string;
  /** Calques ajoutés par-dessus le visuel (reflet qui suit l'inclinaison), découpés à la forme de la pochette. */
  children?: React.ReactNode;
}

/** Visuel d'une pochette de booster. Le haut et le corps peuvent être rendus séparément pour l'animation de déchirure. */
export function BoosterPackArt({ label = "Toutes époques", count = 5, className, empty, logo, palette, children }: BoosterPackArtProps) {
  return (
    <div
      className={cn("pf-pack select-none [container-type:inline-size]", className)}
      data-empty={empty || undefined}
      style={palette ? packPalette(palette) : undefined}
    >
      <div className="absolute inset-x-0 top-[11%] border-t-2 border-dashed border-white/25" aria-hidden="true" />
      <div className="absolute inset-0 grid grid-rows-[1fr_auto_1fr] place-items-center p-[8%] text-center">
        <span className="self-end font-mono text-[4.4cqw] font-bold tracking-[0.3em] text-white/80 uppercase">
          Booster
        </span>
        <PackLogo logo={logo} />
        <div className="grid gap-1 self-start">
          <span className={cn("font-display leading-none font-bold text-balance text-white drop-shadow", label.length > 18 ? "text-[7cqw]" : "text-[9cqw]")}>{label}</span>
          <span className="font-mono text-[4cqw] font-bold tracking-[0.2em] text-white/75 uppercase">
            {count} cartes · PokeFlex
          </span>
        </div>
      </div>
      {children}
    </div>
  );
}
