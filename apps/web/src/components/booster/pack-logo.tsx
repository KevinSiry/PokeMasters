"use client";

import { logoSources, useImgFallback } from "@/lib/use-img-fallback";

/** Logo du set (CDN TCGdex) sous l'illustration de la pochette ; `fallback` s'il est absent ou introuvable. */
export function PackLogo({ logo, fallback }: { logo?: string | null; fallback: React.ReactNode }) {
  const { src, ref, onError } = useImgFallback(logoSources(logo));
  if (!src) return fallback;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- logo servi par le CDN TCGdex
    <img
      ref={ref}
      src={src}
      alt=""
      draggable={false}
      onError={onError}
      className="absolute inset-0 size-full object-contain [filter:drop-shadow(0_0_1.2cqw_rgb(255_255_255/0.35))_drop-shadow(0_0.8cqw_0.6cqw_rgb(0_0_0/0.6))]"
    />
  );
}
