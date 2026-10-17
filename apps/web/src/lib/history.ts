/**
 * Repère chaque entrée de l'historique du navigateur : une clé unique (pour y attacher la position de
 * défilement) et un rang (0 = première page ouverte dans cet onglet sur le site). Le routeur Next.js
 * réécrit `history.state` à chaque navigation ; on enveloppe donc `pushState` / `replaceState` pour y
 * glisser notre repère, avant même l'hydratation (le module s'évalue au chargement du bundle client).
 */

const FIELD = "__pf";

export interface HistoryEntry {
  key: string;
  index: number;
}

type Listener = () => void;
const beforePush = new Set<Listener>();

const newKey = () => Math.random().toString(36).slice(2, 10);

/** Repère de l'entrée courante (absent tant que le routeur n'a pas encore écrit l'historique). */
export function currentEntry(): HistoryEntry | undefined {
  if (typeof window === "undefined") return undefined;
  return (window.history.state as Record<string, HistoryEntry> | null)?.[FIELD];
}

/** Vrai si la page précédente de l'onglet est une page du site : `history.back()` y ramène. */
export function canGoBack(): boolean {
  return (currentEntry()?.index ?? 0) > 0;
}

/** Appelé juste avant chaque nouvelle entrée (ex. : mémoriser le défilement de la page qu'on quitte). */
export function onBeforePush(fn: Listener): () => void {
  beforePush.add(fn);
  return () => beforePush.delete(fn);
}

declare global {
  interface Window {
    __pfHistory?: true;
  }
}

if (typeof window !== "undefined" && !window.__pfHistory) {
  window.__pfHistory = true;
  const { history } = window;
  const push = history.pushState.bind(history);
  const replace = history.replaceState.bind(history);
  history.pushState = (data: unknown, unused: string, url?: string | URL | null) => {
    for (const fn of beforePush) fn();
    const entry: HistoryEntry = { key: newKey(), index: (currentEntry()?.index ?? 0) + 1 };
    push({ ...(data as object | null), [FIELD]: entry }, unused, url);
  };
  history.replaceState = (data: unknown, unused: string, url?: string | URL | null) => {
    const entry: HistoryEntry = currentEntry() ?? { key: newKey(), index: 0 };
    replace({ ...(data as object | null), [FIELD]: entry }, unused, url);
  };
}
