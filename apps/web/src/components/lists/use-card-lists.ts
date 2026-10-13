"use client";

import { useEffect, useState, useTransition } from "react";
import { setFavoriteAction, setWishlistedAction } from "@/app/actions/lists";
import { toast } from "@/components/toaster";

/**
 * État « favori » et « wishlist » d'une carte, basculé de façon optimiste : l'affichage change tout de suite
 * et revient en arrière si le serveur refuse. Partagé par la fiche carte et les vignettes du catalogue.
 */
export function useCardLists(cardId: string, cardName: string, favorite: boolean, wished: boolean) {
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
    });
  }

  return { fav, wish, pending, toggleFavorite, toggleWishlist };
}
