"use client";

import { Layers } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Logo d'un set (CDN TCGdex), contenu dans la boîte de son parent.
 * Sans logo : un pictogramme neutre (le nom est déjà affiché à côté).
 */
export function SetLogo({ logo, name, className }: { logo: string | null; name: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!logo || failed) {
    return (
      <span role="img" aria-label={name} className={cn("grid h-full w-full place-items-center", className)}>
        <Layers aria-hidden="true" className="size-9 text-accent/70" strokeWidth={1.5} />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- logos servis par le CDN TCGdex
    <img
      src={`${logo}.webp`}
      alt={name}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={cn("h-full w-full object-contain drop-shadow-[0_6px_14px_rgb(0_0_0/0.55)]", className)}
    />
  );
}
