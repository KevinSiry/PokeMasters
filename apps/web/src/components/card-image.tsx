"use client";

import { useEffect, useRef, useState } from "react";
import { cardImageUrl, type CardImageQuality } from "@/lib/card-image";
import { cn } from "@/lib/utils";

interface CardImageProps {
  image: string | null;
  name: string;
  quality?: CardImageQuality;
  priority?: boolean;
  className?: string;
}

/**
 * Image de carte servie par le CDN TCGdex, avec apparition en fondu et visuel
 * de remplacement si l'image manque ou ne charge pas.
 * `priority` : image visible dès l'arrivée, chargée tout de suite et affichée sans fondu (pas d'attente de l'hydratation).
 */
export function CardImage({ image, name, quality = "low", priority, className }: CardImageProps) {
  const ref = useRef<HTMLImageElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const src = cardImageUrl(image, quality);

  useEffect(() => {
    const img = ref.current;
    if (!img) return;
    if (img.complete) setState(img.naturalWidth > 0 ? "ready" : "failed");
  }, [src]);

  if (!src || state === "failed") {
    return (
      <div
        role="img"
        aria-label={`${name} (image indisponible)`}
        className={cn(
          "flex aspect-[63/88] w-full flex-col items-center justify-center gap-2 rounded-[inherit] border-2 border-dashed border-line bg-surface p-3 text-center",
          className,
        )}
      >
        <span aria-hidden="true" className="font-display text-2xl text-prism">
          ?
        </span>
        <span className="line-clamp-2 text-[11px] leading-tight text-muted">{name}</span>
      </div>
    );
  }

  return (
    <div className={cn("relative aspect-[63/88] w-full overflow-hidden rounded-[inherit] bg-elev", className)}>
      {state === "loading" && <div aria-hidden="true" className="pf-shimmer absolute inset-0" />}
      {/* eslint-disable-next-line @next/next/no-img-element -- images servies telles quelles par le CDN TCGdex */}
      <img
        ref={ref}
        src={src}
        alt={name}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        draggable={false}
        onLoad={() => setState("ready")}
        onError={() => setState("failed")}
        className={cn(
          "absolute inset-0 h-full w-full object-cover transition-opacity duration-300",
          priority || state === "ready" ? "opacity-100" : "opacity-0",
        )}
      />
    </div>
  );
}
