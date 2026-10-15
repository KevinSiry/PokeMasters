import { useId } from "react";
import { PokemonWordmark } from "@/components/booster/pokemon-wordmark";
import { cn } from "@/lib/utils";

/** Volutes bleues qui tournent autour de la Poké Ball (centre 315, 545). */
const SWIRLS = [
  "M315 545 C 470 420, 520 220, 380 90",
  "M315 545 C 140 470, 60 300, 150 110",
  "M315 545 C 160 640, 70 760, 40 860",
  "M315 545 C 480 640, 560 760, 610 870",
  "M315 545 C 520 520, 600 400, 620 300",
  "M315 545 C 110 560, 30 520, 10 420",
];

/**
 * Dos de carte classique du jeu de cartes Pokémon : fond bleu tourbillonnant dans un cadre bleu foncé,
 * grande Poké Ball inclinée et inscription « Pokémon » jaune. Entièrement dessiné (aucune image officielle).
 */
export function CardBack({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  const url = (name: string) => `url(#${id}-${name})`;
  return (
    <div className={cn("pf-card-back", className)} aria-hidden="true">
      <svg viewBox="0 0 630 880" preserveAspectRatio="none" className="absolute inset-0 size-full">
        <defs>
          <radialGradient id={`${id}-field`} cx="0.5" cy="0.62" r="0.75">
            <stop offset="0" stopColor="#9CC8FF" />
            <stop offset="0.22" stopColor="#4D8FE8" />
            <stop offset="0.55" stopColor="#1F55B8" />
            <stop offset="1" stopColor="#0D2A6E" />
          </radialGradient>
          <linearGradient id={`${id}-frame`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#2B58B0" />
            <stop offset="0.5" stopColor="#1A3C8C" />
            <stop offset="1" stopColor="#12306F" />
          </linearGradient>
          <filter id={`${id}-clouds`} x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.008 0.014" numOctaves="3" seed="7" />
            <feColorMatrix values="0 0 0 0 0.75  0 0 0 0 0.88  0 0 0 0 1  0 0 0 1.6 -0.75" />
          </filter>
          <linearGradient id={`${id}-red`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FF6A4D" />
            <stop offset="0.6" stopColor="#E3350D" />
            <stop offset="1" stopColor="#A81E06" />
          </linearGradient>
          <linearGradient id={`${id}-white`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FFFFFF" />
            <stop offset="1" stopColor="#B9C3D6" />
          </linearGradient>
          <radialGradient id={`${id}-halo`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#E6F2FF" stopOpacity="0.9" />
            <stop offset="0.55" stopColor="#7DB4FF" stopOpacity="0.35" />
            <stop offset="1" stopColor="#7DB4FF" stopOpacity="0" />
          </radialGradient>
          <clipPath id={`${id}-inner`}>
            <rect x="34" y="34" width="562" height="812" rx="18" />
          </clipPath>
        </defs>

        <rect width="630" height="880" fill={url("frame")} />
        <g clipPath={url("inner")}>
          <rect width="630" height="880" fill={url("field")} />
          <rect width="630" height="880" filter={url("clouds")} opacity="0.55" />
          <g fill="none" stroke="#BFE0FF" strokeLinecap="round" opacity="0.28">
            {SWIRLS.map((d, i) => (
              <path key={d} d={d} strokeWidth={i % 2 ? 26 : 40} />
            ))}
          </g>
          <circle cx="315" cy="545" r="250" fill={url("halo")} />

          {/* Poké Ball inclinée. */}
          <g transform="rotate(-22 315 545)">
            <circle cx="315" cy="545" r="178" fill="#101418" />
            <path d="M151 545 a164 164 0 0 1 328 0 z" fill={url("red")} />
            <path d="M151 545 a164 164 0 0 0 328 0 z" fill={url("white")} />
            <ellipse cx="255" cy="455" rx="62" ry="30" fill="#fff" opacity="0.35" transform="rotate(-25 255 455)" />
            <rect x="140" y="530" width="350" height="30" fill="#101418" />
            <circle cx="315" cy="545" r="58" fill="#101418" />
            <circle cx="315" cy="545" r="40" fill={url("white")} stroke="#5D6675" strokeWidth="4" />
            <circle cx="315" cy="545" r="22" fill="#fff" />
          </g>
        </g>
        <rect x="34" y="34" width="562" height="812" rx="18" fill="none" stroke="#0A1F52" strokeWidth="5" />
      </svg>
      <PokemonWordmark className="absolute top-[12%] left-[11%] w-[78%] -rotate-[9deg]" />
    </div>
  );
}
