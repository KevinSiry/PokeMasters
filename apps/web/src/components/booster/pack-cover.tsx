"use client";

import { cardImageUrl, type CardImageQuality } from "@/lib/card-image";
import { useImgFallback } from "@/lib/use-img-fallback";

/**
 * Illustration de la carte vedette en pleine pochette, comme sur les boosters récents : la même image, floutée,
 * habille tout le sachet, et l'illustration nette (recadrée sur sa fenêtre, sans nom ni texte d'attaque)
 * occupe le centre en fondu. Servie par le CDN des cartes ; rien n'est affiché si l'image est introuvable.
 */
export function PackCover({ image, quality, onMissing }: { image: string; quality: CardImageQuality; onMissing?: React.ReactNode }) {
  const url = cardImageUrl(image, quality);
  const { src, ref, onError } = useImgFallback(url ? [url] : []);
  if (!src) return onMissing ?? null;
  const loading = quality === "low" ? "lazy" : undefined;
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- image servie par le CDN des cartes, jamais re-hébergée */}
      <img
        src={src}
        alt=""
        aria-hidden="true"
        draggable={false}
        loading={loading}
        decoding="async"
        className="pf-pack-backdrop absolute inset-0 size-full object-cover object-[50%_28%]"
      />
      <div className="pf-pack-cover absolute inset-x-0 top-[9%] h-[75%] overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element -- image servie par le CDN des cartes, jamais re-hébergée */}
        <img
          ref={ref}
          src={src}
          alt=""
          draggable={false}
          loading={loading}
          decoding="async"
          onError={onError}
          className="mt-[-24%] ml-[-32.5%] block aspect-[600/825] w-[165%] max-w-none"
        />
      </div>
    </>
  );
}
