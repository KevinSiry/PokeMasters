"use client";

import { useEffect } from "react";

/**
 * Reflète des filtres dans l'URL, sans créer d'entrée d'historique : un retour arrière vers la page (ou un
 * rechargement) les retrouve tels quels. `null` ou chaîne vide retire le paramètre ; les autres paramètres
 * de l'URL sont conservés. Écriture légèrement différée pour ne pas réécrire l'URL à chaque lettre tapée,
 * mais faite tout de suite si on clique ailleurs (un lien vers une autre page part de l'URL à jour).
 */
export function useUrlFilters(params: Record<string, string | null>, delayMs = 250) {
  const serialized = JSON.stringify(params);
  useEffect(() => {
    const write = () => {
      cancel();
      const url = new URL(window.location.href);
      for (const [k, v] of Object.entries(JSON.parse(serialized) as Record<string, string | null>)) {
        if (v) url.searchParams.set(k, v);
        else url.searchParams.delete(k);
      }
      if (url.href !== window.location.href) window.history.replaceState(null, "", url);
    };
    const timer = window.setTimeout(write, delayMs);
    // Retour arrière avant l'écriture : l'URL est déjà celle d'une autre entrée, on n'y touche plus.
    const cancel = () => {
      window.clearTimeout(timer);
      document.removeEventListener("click", write, true);
      window.removeEventListener("popstate", cancel);
    };
    document.addEventListener("click", write, true);
    window.addEventListener("popstate", cancel);
    return cancel;
  }, [serialized, delayMs]);
}
