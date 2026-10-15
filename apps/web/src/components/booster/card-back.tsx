import { cn } from "@/lib/utils";

/**
 * Le dos est servi en bitmap, généré depuis `card-back.svg` (`npm run render:card-back`). En SVG, ses
 * filtres (bruit fractal des nuages, flou des spirales) coûtaient une dizaine de fois plus cher à
 * peindre, et le navigateur les recalculait à chaque carte qui arrive sur la pile : à-coups sur mobile.
 */
export const CARD_BACK_SRC = "/card-back.webp";

/**
 * Dos de carte classique du jeu de cartes Pokémon : fond bleu tourbillonnant dans un cadre bleu foncé,
 * grande Poké Ball inclinée au centre, sans inscription. Entièrement dessiné (aucune image officielle).
 */
export function CardBack({ className }: { className?: string }) {
  return (
    <div className={cn("pf-card-back", className)} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element -- petit bitmap statique, déjà à la bonne taille */}
      <img src={CARD_BACK_SRC} alt="" draggable={false} decoding="sync" className="absolute inset-0 size-full" />
    </div>
  );
}
