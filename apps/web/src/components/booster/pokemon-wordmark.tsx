import { useId } from "react";
import { cn } from "@/lib/utils";

/** Lettres de tailles inégales et ligne de base ondulée, comme sur le logo imprimé. */
const LETTERS: [string, number, number][] = [
  ["P", 96, 4],
  ["o", 68, -2],
  ["k", 86, -4],
  ["é", 70, -2],
  ["m", 72, 0],
  ["o", 68, 2],
  ["n", 76, 4],
];
const GLYPHS = LETTERS.map(([c, size, dy], i) => (
  <tspan key={i} fontSize={size} dy={i === 0 ? dy : dy - LETTERS[i - 1]![2]}>
    {c}
  </tspan>
));

const TEXT = {
  x: 150,
  y: 70,
  textAnchor: "middle",
  textLength: 284,
  lengthAdjust: "spacingAndGlyphs",
  fontFamily: "var(--font-display), 'Arial Black', sans-serif",
  fontSize: 74,
  fontWeight: 900,
  strokeLinejoin: "round",
} as const;

/**
 * Inscription « Pokémon » jaune cerclée de bleu, à la manière du logo du jeu (dessinée en texte, pas l'image officielle).
 * Elle prend toute la largeur de son conteneur.
 */
export function PokemonWordmark({ className }: { className?: string }) {
  const gold = `${useId().replace(/:/g, "")}-gold`;
  return (
    <svg viewBox="0 0 300 92" className={cn("block w-full overflow-visible", className)} aria-hidden="true">
      <defs>
        <linearGradient id={gold} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.25" stopColor="#FFDE3B" />
          <stop offset="0.75" stopColor="#FFC405" />
          <stop offset="1" stopColor="#F2A900" />
        </linearGradient>
      </defs>
      {/* Liseré bleu nuit, puis contour bleu, puis lettres jaunes. */}
      <text {...TEXT} fill="#0F2A66" stroke="#0F2A66" strokeWidth="19">
        {GLYPHS}
      </text>
      <text {...TEXT} fill={`url(#${gold})`} stroke="#3466C2" strokeWidth="12" paintOrder="stroke">
        {GLYPHS}
      </text>
    </svg>
  );
}
