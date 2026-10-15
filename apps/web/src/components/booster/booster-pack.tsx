import { PackCover } from "@/components/booster/pack-cover";
import { PackLogo } from "@/components/booster/pack-logo";
import { PokemonWordmark } from "@/components/booster/pokemon-wordmark";
import type { CardImageQuality } from "@/lib/card-image";
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

/** Poké Ball en relief dans le métal, à la place de l'illustration quand le set n'a pas de carte vedette. */
const EMBLEM = (
  <svg viewBox="0 0 100 100" className="absolute top-[27%] left-1/2 w-[64%] -translate-x-1/2 opacity-80" aria-hidden="true">
    <circle cx="50" cy="50" r="46" fill="rgb(255 255 255 / 0.12)" stroke="rgb(255 255 255 / 0.75)" strokeWidth="4" />
    <path d="M6 50h31a13 13 0 0 1 26 0h31" fill="none" stroke="rgb(255 255 255 / 0.75)" strokeWidth="4" />
    <path d="M4 50a46 46 0 0 1 92 0z" fill="rgb(255 92 92 / 0.35)" />
    <circle cx="50" cy="50" r="8" fill="rgb(255 255 255 / 0.85)" />
  </svg>
);

interface BoosterPackArtProps {
  label?: string;
  count?: number;
  className?: string;
  empty?: boolean;
  /** Logo du set (base d'URL TCGdex), sous l'illustration ; sans logo, le nom du set. */
  logo?: string | null;
  /** Carte vedette (URL de base de son image) dont l'illustration occupe le centre, comme sur un vrai booster. */
  cover?: string | null;
  /** Qualité de l'illustration : « low » pour les vignettes (boutique), « high » pour la grande pochette. */
  coverQuality?: CardImageQuality;
  /** Graine des couleurs (id du set) ; sans graine, la pochette prisme par défaut. */
  palette?: string;
  /** Calques ajoutés par-dessus le visuel (reflet qui suit l'inclinaison), découpés à la forme de la pochette. */
  children?: React.ReactNode;
}

/**
 * Visuel d'une pochette de booster, à la manière d'un vrai booster du jeu de cartes : sachet métallisé serti
 * en haut et en bas, languette prédécoupée, inscription « Pokémon », illustration d'une carte vedette,
 * logo du set et nombre de cartes. Le haut et le corps peuvent être rendus séparément pour l'animation de déchirure.
 */
export function BoosterPackArt({
  label = "Toutes époques",
  count = 5,
  className,
  empty,
  logo,
  cover,
  coverQuality = "high",
  palette,
  children,
}: BoosterPackArtProps) {
  const name = (
    <span
      className={cn(
        "font-display text-center leading-[1.05] font-black text-balance text-white [text-shadow:0_0.5cqw_0_#0F2A66,0_0_2cqw_rgb(0_0_0/0.6)]",
        label.length > 18 ? "text-[6.4cqw]" : "text-[8cqw]",
      )}
    >
      {label}
    </span>
  );
  return (
    <div
      className={cn("pf-pack select-none [container-type:inline-size]", className)}
      data-empty={empty || undefined}
      style={palette ? packPalette(palette) : undefined}
    >
      {cover ? <PackCover image={cover} quality={coverQuality} onMissing={EMBLEM} /> : EMBLEM}
      {/* Couleurs du set en haut et en bas du sachet, film holographique par-dessus l'illustration. */}
      <div className="pf-pack-tint" aria-hidden="true" />
      <div className="pf-pack-holo" aria-hidden="true" />

      {/* Sertissage du sachet en haut et en bas. */}
      <div className="pf-pack-crimp top-0" aria-hidden="true" />
      <div className="pf-pack-crimp bottom-0" aria-hidden="true" />
      {/* Ligne de découpe et encoches de la languette. */}
      <div className="absolute inset-x-[3%] top-[11%] border-t border-dashed border-white/35" aria-hidden="true" />
      <div className="pf-pack-notch left-0" aria-hidden="true" />
      <div className="pf-pack-notch right-0 rotate-180" aria-hidden="true" />

      {/* Marque en haut à gauche, comme le logo du jeu sur les boosters récents. */}
      <div className="absolute top-[12.6%] left-[6%] grid w-[46%] justify-items-center">
        <PokemonWordmark className="drop-shadow-[0_0.6cqw_0.5cqw_rgb(0_0_0/0.5)]" />
        <span className="mt-[0.3cqw] font-mono text-[2.3cqw] leading-none font-bold tracking-[0.06em] whitespace-nowrap text-white uppercase [text-shadow:0_0.3cqw_0.6cqw_rgb(0_0_0/0.8)]">
          Jeu de cartes à collectionner
        </span>
      </div>
      <span className="absolute top-[13.4%] right-[6%] rounded-[1cqw] border border-white/50 bg-black/35 px-[1.6cqw] py-[0.6cqw] font-mono text-[2.4cqw] leading-none font-bold tracking-[0.14em] text-white uppercase backdrop-blur-[2px]">
        Booster
      </span>

      <div className="absolute inset-x-[7%] top-[64%] grid h-[17%] place-items-center">
        <PackLogo logo={logo} fallback={name} />
      </div>

      <div className="absolute inset-x-[6%] bottom-[8.2%] flex items-center justify-between">
        <span className="flex items-baseline gap-[1cqw] rounded-[1.4cqw] bg-white px-[2.2cqw] py-[0.8cqw] leading-none text-[#0F2A66] shadow-[0_0.6cqw_1.6cqw_rgb(0_0_0/0.45)]">
          <span className="font-display text-[5.4cqw] font-black">{count}</span>
          <span className="font-mono text-[2.6cqw] font-bold tracking-[0.1em] uppercase">cartes</span>
        </span>
        <span className="font-mono text-[2.4cqw] font-bold tracking-[0.2em] text-white/80 uppercase [text-shadow:0_0.3cqw_0.6cqw_rgb(0_0_0/0.8)]">
          PokeFlex
        </span>
      </div>
      {children}
    </div>
  );
}
