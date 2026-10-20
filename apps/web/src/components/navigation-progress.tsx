"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** En dessous, la page arrive assez vite pour qu'une barre qui clignote gêne plus qu'elle n'aide. */
const SHOW_AFTER_MS = 150;
/** Au-delà, on suppose la navigation abandonnée (lien qui ne mène nulle part, erreur réseau). */
const GIVE_UP_MS = 12_000;

/**
 * Barre de progression en haut de l'écran pendant qu'une page se charge : retour immédiat au clic,
 * même quand le serveur met du temps à répondre. Elle part sur un clic de lien interne ou un retour
 * arrière, et s'efface dès que l'adresse a changé.
 *
 * Pas de `loading.tsx` à la place : une frontière Suspense autour des pages fait répondre 200 une page
 * qui devrait répondre 404, et un tap juste après l'affichage, pendant l'hydratation, pouvait se perdre.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const params = useSearchParams();
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const timers = useRef<number[]>([]);

  const clear = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  useEffect(() => {
    const start = () => {
      clear();
      timers.current.push(
        window.setTimeout(() => setState("loading"), SHOW_AFTER_MS),
        window.setTimeout(() => setState("idle"), GIVE_UP_MS),
      );
    };
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element).closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      start();
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", start);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", start);
      clear();
    };
  }, []);

  // Nouvelle adresse : la page est là, la barre finit sa course puis s'efface.
  useEffect(() => {
    clear();
    setState((s) => (s === "loading" ? "done" : "idle"));
    timers.current.push(window.setTimeout(() => setState("idle"), 400));
  }, [pathname, params]);

  if (state === "idle") return null;
  return (
    <div
      role="progressbar"
      aria-label="Chargement de la page"
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px] overflow-hidden"
    >
      <div className="pf-nav-progress h-full origin-left bg-gradient-to-r from-accent via-coral to-lime" data-state={state} />
    </div>
  );
}
