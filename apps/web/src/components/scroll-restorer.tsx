"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect } from "react";
import { currentEntry, onBeforePush } from "@/lib/history";

/**
 * Retour arrière (ou avant) « dans le même état » : chaque entrée de l'historique garde sa position de
 * défilement, rétablie une fois la page revenue à l'écran. Le navigateur sait le faire seul, mais trop
 * tôt : quand la page doit être redemandée au serveur (après un favori, un rafraîchissement temps réel…),
 * elle n'est pas encore assez haute et on se retrouve plus haut, voire tout en haut.
 */

const PREFIX = "pf:scroll:";
/** Au-delà, la page n'atteindra plus la hauteur voulue : on s'arrête au plus près. */
const MAX_WAIT_MS = 4000;
/** Le joueur fait défiler lui-même pendant le chargement : on le laisse faire. */
const USER_EVENTS = ["wheel", "touchstart", "keydown", "pointerdown"] as const;

function read(key: string): number | null {
  try {
    const v = sessionStorage.getItem(PREFIX + key);
    return v === null ? null : Number(v);
  } catch {
    return null;
  }
}

function write(key: string, y: number) {
  try {
    sessionStorage.setItem(PREFIX + key, String(Math.round(y)));
  } catch {
    // Stockage indisponible (navigation privée stricte) : le retour remontera simplement en haut.
  }
}

// Partagé entre l'écouteur `popstate` et l'effet qui suit l'affichage de la page restaurée.
let target: number | null = null;
let shownUrl = "";
let restoring = false;
let cancel: (() => void) | null = null;

function save() {
  const entry = currentEntry();
  if (entry && !restoring) write(entry.key, window.scrollY);
}

function restore() {
  if (target === null) return;
  const y = target;
  target = null;
  cancel?.();
  const start = performance.now();
  let frame = 0;
  const stop = () => {
    cancelAnimationFrame(frame);
    for (const e of USER_EVENTS) window.removeEventListener(e, stop);
    restoring = false;
    cancel = null;
  };
  for (const e of USER_EVENTS) window.addEventListener(e, stop, { passive: true });
  cancel = stop;
  const step = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo(0, Math.min(y, Math.max(0, max)));
    if (max >= y || performance.now() - start > MAX_WAIT_MS) return stop();
    frame = requestAnimationFrame(step);
  };
  step();
}

export function ScrollRestorer() {
  const pathname = usePathname();
  const search = useSearchParams().toString();

  useEffect(() => {
    window.history.scrollRestoration = "manual";
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        save();
      });
    };
    const onPopState = () => {
      // L'URL a déjà changé mais l'ancienne page est encore affichée : ne rien enregistrer d'ici là.
      cancel?.();
      restoring = true;
      target = read(currentEntry()?.key ?? "") ?? 0;
      // Même page (ancre seule) : aucun changement de page ne viendra déclencher la restauration.
      if (location.pathname + location.search === shownUrl) requestAnimationFrame(restore);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("popstate", onPopState);
    window.addEventListener("pagehide", save);
    const offPush = onBeforePush(save);

    // Rechargement ou retour depuis un autre site : la page vient d'être (re)chargée.
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    const key = currentEntry()?.key;
    if (key && (nav?.type === "back_forward" || nav?.type === "reload")) {
      const y = read(key);
      if (y) {
        restoring = true;
        target = y;
        restore();
      }
    }

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("pagehide", save);
      offPush();
    };
  }, []);

  // La page revenue est affichée (au moins sa structure) : on rétablit la position.
  useLayoutEffect(() => {
    shownUrl = pathname + (search ? `?${search}` : "");
    restore();
  }, [pathname, search]);

  return null;
}
