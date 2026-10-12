"use client";

import type { Tier } from "@pokeflex/config";
import { useEffect, useRef, useState } from "react";
import { cardImageUrl, type CardImageQuality } from "@/lib/card-image";
import { cn } from "@/lib/utils";

interface TiltCardProps {
  /** Champ `image` de TCGdex (URL de base), ou null si la carte n'a pas d'image. */
  image: string | null;
  name: string;
  tier: Tier;
  quality?: CardImageQuality;
  className?: string;
  priority?: boolean;
}

const MAX_TILT = 12; // degrés

/**
 * Carte avec inclinaison au survol / au doigt et reflet holo selon le tier.
 * Affiche un visuel de remplacement si l'image est absente ou ne charge pas.
 */
export function TiltCard({ image, name, tier, quality = "high", className, priority }: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [failed, setFailed] = useState(false);

  // L'image rendue côté serveur peut échouer avant l'hydratation : onError ne se déclenche alors pas.
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, []);
  const [active, setActive] = useState(false);
  const src = failed ? null : cardImageUrl(image, quality);

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty("--ry", `${(x - 0.5) * 2 * MAX_TILT}deg`);
    el.style.setProperty("--rx", `${(0.5 - y) * 2 * MAX_TILT}deg`);
    el.style.setProperty("--mx", `${x * 100}%`);
    el.style.setProperty("--my", `${y * 100}%`);
  }

  function reset() {
    const el = ref.current;
    setActive(false);
    if (!el) return;
    for (const [k, v] of [["--rx", "0deg"], ["--ry", "0deg"], ["--mx", "50%"], ["--my", "50%"]] as const) {
      el.style.setProperty(k, v);
    }
  }

  return (
    <div
      ref={ref}
      className={cn("pf-card bg-elev shadow-[0_24px_48px_-18px_rgb(0_0_0/0.8)]", className)}
      data-tier={tier}
      data-active={active}
      onPointerEnter={() => setActive(true)}
      onPointerMove={onPointerMove}
      onPointerLeave={reset}
      onPointerCancel={reset}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- images servies telles quelles par le CDN TCGdex
        <img
          ref={imgRef}
          src={src}
          alt={name}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          draggable={false}
          onError={() => setFailed(true)}
        />
      ) : (
        <div
          role="img"
          aria-label={`${name} (image indisponible)`}
          className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-[inherit] border-2 border-dashed border-line bg-surface p-4 text-center"
        >
          <span aria-hidden="true" className="font-display text-3xl text-prism">
            ?
          </span>
          <span className="text-xs text-muted">{name}</span>
        </div>
      )}
    </div>
  );
}
