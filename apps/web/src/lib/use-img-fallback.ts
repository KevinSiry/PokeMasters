"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Essaie des sources d'image dans l'ordre (ex. .webp puis .png). Renvoie null quand toutes ont échoué.
 * Rattrape aussi les erreurs survenues avant l'hydratation (image rendue côté serveur).
 */
export function useImgFallback(sources: string[]) {
  const [index, setIndex] = useState(0);
  const ref = useRef<HTMLImageElement>(null);
  const key = sources.join("|");

  useEffect(() => setIndex(0), [key]);
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0 && img.currentSrc) setIndex((i) => i + 1);
  }, [index, key]);

  const src = sources[index] ?? null;
  return { src, ref, onError: () => setIndex((i) => i + 1) };
}

/**
 * Sources d'un logo TCGdex : WebP d'abord, PNG ensuite (certains sets récents n'ont que le PNG).
 * Une URL déjà résolue avec son extension (voir lib/logo.ts) est utilisée telle quelle.
 */
export function logoSources(base: string | null | undefined): string[] {
  if (!base) return [];
  return /\.(png|webp)$/.test(base) ? [base] : [`${base}.webp`, `${base}.png`];
}
