"use client";

import { cardImageUrl, type CardImageQuality } from "@/lib/card-image";
import { useImgFallback } from "@/lib/use-img-fallback";

/**
 * Illustration de la carte vedette, recadrée sur sa fenêtre d'illustration (sans nom ni texte d'attaque),
 * servie par le CDN des cartes. Rien n'est affiché si l'image est introuvable.
 */
export function PackCover({ image, quality, onMissing }: { image: string; quality: CardImageQuality; onMissing?: React.ReactNode }) {
  const url = cardImageUrl(image, quality);
  const { src, ref, onError } = useImgFallback(url ? [url] : []);
  if (!src) return onMissing ?? null;
  return (
    <div className="pf-pack-cover absolute inset-x-0 top-[23%] aspect-[1.49] overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element -- image servie par le CDN des cartes, jamais re-hébergée */}
      <img
        ref={ref}
        src={src}
        alt=""
        draggable={false}
        loading={quality === "low" ? "lazy" : undefined}
        decoding="async"
        onError={onError}
        className="mt-[-21.5%] ml-[-12.5%] block aspect-[600/825] w-[125%] max-w-none"
      />
    </div>
  );
}
