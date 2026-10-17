"use client";

import { useCallback, useState } from "react";
import { setFavoriteAction } from "@/app/actions/lists";
import { toast } from "@/components/toaster";

/**
 * État « favori » de plusieurs cartes à la fois (par id de carte), basculé de façon optimiste comme
 * `useCardLists`. Sert à l'ouverture de booster : une même carte tirée deux fois partage son étoile,
 * entre la révélation et le récapitulatif. Pas de toast de confirmation (il masquerait la carte
 * suivante) : l'étoile qui se remplit suffit, seul un refus du serveur est signalé.
 */
export function useFavoriteMap() {
  const [favs, setFavs] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState<Record<string, boolean>>({});

  const reset = useCallback((cards: { id: string; favorite: boolean }[]) => {
    setFavs(Object.fromEntries(cards.map((c) => [c.id, c.favorite])));
    setPending({});
  }, []);

  const toggle = useCallback(
    async (cardId: string) => {
      if (pending[cardId]) return;
      const next = !favs[cardId];
      setFavs((f) => ({ ...f, [cardId]: next }));
      setPending((p) => ({ ...p, [cardId]: true }));
      const res = await setFavoriteAction(cardId, next);
      setPending((p) => ({ ...p, [cardId]: false }));
      if (!res.ok) {
        setFavs((f) => ({ ...f, [cardId]: !next }));
        toast({ title: res.error, tone: "error" });
      }
    },
    [favs, pending],
  );

  return { favs, pending, reset, toggle };
}
