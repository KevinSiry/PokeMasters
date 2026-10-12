"use client";

import { logoSources, useImgFallback } from "@/lib/use-img-fallback";

const STAR = (
  <svg viewBox="0 0 100 100" className="my-[8%] w-[62%] drop-shadow-[0_10px_24px_rgb(0_0_0/0.45)]" aria-hidden="true">
    <circle cx="50" cy="50" r="46" fill="#0B0716" fillOpacity="0.55" stroke="#fff" strokeOpacity="0.85" strokeWidth="3" />
    <path d="M50 18l8.8 17.9 19.7 2.9-14.3 13.9 3.4 19.6L50 63l-17.6 9.3 3.4-19.6-14.3-13.9 19.7-2.9z" fill="#B8F35C" />
  </svg>
);

/** Emblème central de la pochette : logo du set (CDN TCGdex) ou étoile PokeFlex si absent ou introuvable. */
export function PackLogo({ logo }: { logo?: string | null }) {
  const { src, ref, onError } = useImgFallback(logoSources(logo));
  if (!src) return STAR;
  return (
    <div className="my-[8%] grid aspect-[5/4] w-[84%] place-items-center rounded-[14%] bg-[#0B0716]/55 p-[9%] ring-2 ring-white/70 drop-shadow-[0_10px_24px_rgb(0_0_0/0.45)]">
      {/* eslint-disable-next-line @next/next/no-img-element -- logo servi par le CDN TCGdex */}
      <img ref={ref} src={src} alt="" draggable={false} onError={onError} className="max-h-full w-full object-contain" />
    </div>
  );
}
