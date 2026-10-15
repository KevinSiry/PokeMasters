import { cn } from "@/lib/utils";

const TEXT = {
  x: 150,
  y: 70,
  textAnchor: "middle",
  textLength: 284,
  lengthAdjust: "spacingAndGlyphs",
  fontFamily: "var(--font-display), 'Arial Black', sans-serif",
  fontSize: 78,
  fontWeight: 900,
  strokeLinejoin: "round",
} as const;

/**
 * Inscription « Pokémon » jaune cerclée de bleu, à la manière du logo du jeu (dessinée en texte, pas l'image officielle).
 * Elle prend toute la largeur de son conteneur.
 */
export function PokemonWordmark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 300 92" className={cn("block w-full overflow-visible", className)} aria-hidden="true">
      {/* Liseré bleu nuit, puis contour bleu, puis lettres jaunes. */}
      <text {...TEXT} fill="#0F2A66" stroke="#0F2A66" strokeWidth="19">
        Pokémon
      </text>
      <text {...TEXT} fill="#FFCB05" stroke="#3466C2" strokeWidth="12" paintOrder="stroke">
        Pokémon
      </text>
    </svg>
  );
}
