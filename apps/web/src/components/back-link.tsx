"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { canGoBack } from "@/lib/history";
import { cn } from "@/lib/utils";

/**
 * « Retour » : revient à la page précédente du site comme le bouton du navigateur (même défilement, mêmes
 * filtres, même page). Arrivé directement (lien partagé, nouvel onglet), on va à `href`, la page parente.
 */
export function BackLink({ href, label = "Retour", className }: { href: string; label?: string; className?: string }) {
  const router = useRouter();
  return (
    <Link
      href={href}
      onClick={(e) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        if (!canGoBack()) return;
        e.preventDefault();
        router.back();
      }}
      className={cn("pf-hit relative inline-flex w-fit items-center gap-1 text-sm text-muted hover:text-fg", className)}
    >
      <ChevronLeft aria-hidden="true" className="size-4" />
      {label}
    </Link>
  );
}
