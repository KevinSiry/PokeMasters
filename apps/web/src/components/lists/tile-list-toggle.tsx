"use client";

import { Heart, Star } from "lucide-react";
import { useCardLists } from "@/components/lists/use-card-lists";
import { cn } from "@/lib/utils";

/**
 * Bascule posée sur une vignette de la grille du catalogue : étoile « favori » pour une carte possédée,
 * cœur « wishlist » pour une carte manquante (mêmes règles que la fiche carte). Zone tactile de 40 px,
 * pastille visible plus petite pour ne pas masquer l'illustration.
 */
export function TileListToggle({ cardId, cardName, owned, favorite, wished }: { cardId: string; cardName: string; owned: boolean; favorite: boolean; wished: boolean }) {
  const { fav, wish, pending, toggleFavorite, toggleWishlist } = useCardLists(cardId, cardName, favorite, wished);
  const isFavorite = owned || fav;
  const on = isFavorite ? fav : wish;
  const Icon = isFavorite ? Star : Heart;
  const label = isFavorite
    ? fav
      ? `Retirer ${cardName} de tes favoris`
      : `Mettre ${cardName} en favori`
    : wish
      ? `Retirer ${cardName} de ta wishlist`
      : `Ajouter ${cardName} à ta wishlist`;

  return (
    <button
      type="button"
      onClick={isFavorite ? toggleFavorite : toggleWishlist}
      disabled={pending}
      aria-pressed={on}
      aria-label={label}
      title={label}
      data-list={isFavorite ? "favorite" : "wishlist"}
      className="group/toggle absolute top-0 left-0 z-10 grid size-10 place-items-center rounded-full outline-none disabled:opacity-70"
    >
      <span
        aria-hidden="true"
        className={cn(
          "grid size-7 place-items-center rounded-full border bg-bg/85 backdrop-blur transition-[transform,color,border-color] group-hover/toggle:scale-110 group-focus-visible/toggle:outline-2 group-focus-visible/toggle:outline-lime group-active/toggle:scale-95",
          on
            ? isFavorite
              ? "border-[#FFC93C]/60 text-[#FFC93C]"
              : "border-coral/60 text-coral"
            : "border-line/80 text-muted group-hover/toggle:text-fg",
        )}
      >
        <Icon className={cn("size-3.5", on && "fill-current")} />
      </span>
    </button>
  );
}
