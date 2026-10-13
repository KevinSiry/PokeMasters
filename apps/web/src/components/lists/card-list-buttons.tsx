"use client";

import { Heart, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { setFavoriteAction, setWishlistedAction } from "@/app/actions/lists";
import { toast } from "@/components/toaster";
import { cn } from "@/lib/utils";

/**
 * Boutons « Favori » et « Wishlist » de la fiche carte. Mise à jour optimiste, annulée si le serveur refuse.
 * Le favori n'est proposé que pour une carte possédée, la wishlist que pour une carte manquante
 * (chacune reste affichée si elle est déjà cochée, pour pouvoir la retirer).
 */
export function CardListButtons({ cardId, cardName, owned, favorite, wished }: { cardId: string; cardName: string; owned: boolean; favorite: boolean; wished: boolean }) {
  const router = useRouter();
  const [fav, setFav] = useState(favorite);
  const [wish, setWish] = useState(wished);
  const [pending, start] = useTransition();

  useEffect(() => setFav(favorite), [favorite]);
  useEffect(() => setWish(wished), [wished]);

  function toggleFavorite() {
    const next = !fav;
    setFav(next);
    start(async () => {
      const res = await setFavoriteAction(cardId, next);
      if (!res.ok) {
        setFav(!next);
        return toast({ title: res.error, tone: "error" });
      }
      toast({ title: next ? "Ajoutée à tes favoris" : "Retirée de tes favoris", description: next ? `${cardName} ne sera jamais recyclée avec les doublons.` : cardName });
      router.refresh();
    });
  }

  function toggleWishlist() {
    const next = !wish;
    setWish(next);
    start(async () => {
      const res = await setWishlistedAction(cardId, next);
      if (!res.ok) {
        setWish(!next);
        return toast({ title: res.error, tone: "error" });
      }
      toast({
        title: next ? "Ajoutée à ta wishlist" : "Retirée de ta wishlist",
        description: next ? "Une alerte s'affichera dès qu'un joueur la met en vente." : cardName,
        action: next ? { label: "Voir", href: "/collection?vue=wishlist" } : undefined,
      });
      router.refresh();
    });
  }

  const base =
    "inline-flex h-9 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors disabled:opacity-60 [&_svg]:size-4 [&_svg]:shrink-0";
  return (
    <div className="flex flex-wrap gap-2">
      {(owned || fav) && (
        <button
          type="button"
          onClick={toggleFavorite}
          disabled={pending}
          aria-pressed={fav}
          className={cn(base, fav ? "border-[#FFC93C]/60 bg-[#FFC93C]/10 text-[#FFC93C]" : "border-line bg-elev text-fg hover:border-accent")}
        >
          <Star aria-hidden="true" className={cn(fav && "fill-current")} />
          {fav ? "Favorite" : "Mettre en favori"}
        </button>
      )}
      {(!owned || wish) && (
      <button
        type="button"
        onClick={toggleWishlist}
        disabled={pending}
        aria-pressed={wish}
        className={cn(base, wish ? "border-coral/60 bg-coral/10 text-coral" : "border-line bg-elev text-fg hover:border-accent")}
      >
        <Heart aria-hidden="true" className={cn(wish && "fill-current")} />
        {wish ? "Dans ma wishlist" : "Ajouter à ma wishlist"}
      </button>
      )}
    </div>
  );
}
