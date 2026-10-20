"use client";

import { TIER_LABELS_FR, TIERS, type Tier } from "@pokeflex/config";
import { Search, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useDeferredValue, useMemo, useState } from "react";
import { CardTile } from "@/components/catalog/card-tile";
import { EnergyIcon, TYPE_LABELS } from "@/components/energy-icon";
import { TileListToggle } from "@/components/lists/tile-list-toggle";
import { TIER_ICON } from "@/components/tier-badge";
import type { CardTile as CardTileData } from "@/lib/catalog";
import { useUrlFilters } from "@/lib/use-url-filters";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { id: "pokemon", label: "Pokémon" },
  { id: "trainer", label: "Dresseurs" },
  { id: "energy", label: "Énergies" },
] as const;

interface CardGridProps {
  cards: CardTileData[];
  /** Exemplaires possédés par carte (joueur connecté) ; null = visiteur. */
  owned?: Record<string, number> | null;
  /** Favoris et wishlist du joueur connecté : affiche une bascule sur chaque vignette. */
  lists?: { favorites: string[]; wishlist: string[] } | null;
  subtitle?: (c: CardTileData) => string;
}

type Ownership = "all" | "owned" | "missing";
/** Valeurs de `?possession=` (filtres gardés dans l'URL pour le retour arrière). */
const OWNERSHIP_PARAM: Record<Ownership, string | null> = { all: null, owned: "possedees", missing: "manquantes" };

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/** Grille filtrable (texte, tier, catégorie, type, possession) d'un ensemble de cartes. */
export function CardGrid({ cards, owned = null, lists = null, subtitle }: CardGridProps) {
  const params = useSearchParams();
  const [query, setQuery] = useState(() => params.get("filtre") ?? "");
  const [tiers, setTiers] = useState<Set<Tier>>(
    () => new Set((params.get("tiers")?.split(",") ?? []).filter((t): t is Tier => (TIERS as readonly string[]).includes(t))),
  );
  const [category, setCategory] = useState<string | null>(() => params.get("categorie"));
  const [type, setType] = useState<string | null>(() => params.get("type"));
  const [ownership, setOwnership] = useState<Ownership>(
    () => (Object.keys(OWNERSHIP_PARAM) as Ownership[]).find((o) => o !== "all" && OWNERSHIP_PARAM[o] === params.get("possession")) ?? "all",
  );
  const q = useDeferredValue(norm(query.trim()));
  useUrlFilters({
    filtre: query.trim() || null,
    tiers: [...tiers].join(",") || null,
    categorie: category,
    type,
    possession: OWNERSHIP_PARAM[ownership],
  });

  const favorites = useMemo(() => new Set(lists?.favorites), [lists]);
  const wishlist = useMemo(() => new Set(lists?.wishlist), [lists]);
  const presentTiers = useMemo(() => TIERS.filter((t) => cards.some((c) => c.tier === t)), [cards]);
  const presentTypes = useMemo(() => [...new Set(cards.flatMap((c) => c.types))].sort(), [cards]);
  const presentCategories = CATEGORIES.filter((c) => cards.some((x) => x.category === c.id));

  const shown = cards.filter(
    (c) =>
      (!q || norm(c.name).includes(q) || c.localId === q) &&
      (tiers.size === 0 || tiers.has(c.tier)) &&
      (!category || c.category === category) &&
      (!type || c.types.includes(type)) &&
      (ownership === "all" || !owned || (ownership === "owned" ? (owned[c.id] ?? 0) > 0 : !owned[c.id])),
  );
  const filtered = q || tiers.size || category || type || ownership !== "all";

  function toggleTier(t: Tier) {
    setTiers((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }

  function reset() {
    setQuery("");
    setTiers(new Set());
    setCategory(null);
    setType(null);
    setOwnership("all");
  }

  return (
    <div className="grid grid-cols-1 gap-5">
      <div className="grid grid-cols-1 gap-3">
        <div className="relative max-w-md">
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrer par nom ou numéro"
            aria-label="Filtrer les cartes par nom ou numéro"
            className="h-11 w-full rounded-full border border-line bg-surface pr-4 pl-10 text-sm focus:border-accent focus:outline-none"
          />
        </div>
        <div className="pf-scroll-x pf-bleed flex gap-2" role="group" aria-label="Filtres">
          {owned && (
            <>
              {(["all", "owned", "missing"] as const).map((o) => (
                <button key={o} type="button" className="pf-chip" aria-pressed={ownership === o} onClick={() => setOwnership(o)}>
                  {o === "all" ? "Toutes" : o === "owned" ? "Possédées" : "Manquantes"}
                </button>
              ))}
              <span aria-hidden="true" className="mx-1 w-px shrink-0 bg-line" />
            </>
          )}
          {presentTiers.map((t) => (
            <button
              key={t}
              type="button"
              className="pf-chip"
              data-tier={t}
              aria-pressed={tiers.has(t)}
              onClick={() => toggleTier(t)}
            >
              <span aria-hidden="true" className="pf-tier-pip">
                {TIER_ICON[t]}
              </span>
              {TIER_LABELS_FR[t]}
            </button>
          ))}
          {presentCategories.length > 1 && <span aria-hidden="true" className="mx-1 w-px shrink-0 bg-line" />}
          {presentCategories.length > 1 &&
            presentCategories.map((c) => (
              <button
                key={c.id}
                type="button"
                className="pf-chip"
                aria-pressed={category === c.id}
                onClick={() => setCategory(category === c.id ? null : c.id)}
              >
                {c.label}
              </button>
            ))}
          {presentTypes.length > 1 && <span aria-hidden="true" className="mx-1 w-px shrink-0 bg-line" />}
          {presentTypes.length > 1 &&
            presentTypes.map((t) => (
              <button
                key={t}
                type="button"
                className="pf-chip px-2"
                aria-pressed={type === t}
                aria-label={TYPE_LABELS[t] ?? t}
                title={TYPE_LABELS[t] ?? t}
                onClick={() => setType(type === t ? null : t)}
              >
                <EnergyIcon type={t} size={20} />
              </button>
            ))}
        </div>
        <div className="flex min-h-6 items-center gap-3 text-sm text-muted" aria-live="polite">
          <span>
            {shown.length} carte{shown.length > 1 ? "s" : ""}
            {filtered ? ` sur ${cards.length}` : ""}
          </span>
          {filtered ? (
            <button type="button" onClick={reset} className="inline-flex items-center gap-1 text-accent hover:underline">
              <X aria-hidden="true" className="size-3.5" />
              Effacer les filtres
            </button>
          ) : null}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-[var(--radius-card)] border border-dashed border-line p-8 text-center text-muted">
          Aucune carte ne correspond à ces filtres.
        </p>
      ) : (
        <ul className={cn("grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6")}>
          {shown.map((c, i) => {
            const count = owned ? (owned[c.id] ?? 0) : null;
            return (
              <li key={c.id} className="relative">
                <CardTile
                  card={c}
                  priority={i < 12}
                  missing={count === 0}
                  subtitle={subtitle ? subtitle(c) : `n° ${c.localId}`}
                  badge={
                    count && count > 1 ? (
                      <span className="absolute bottom-1.5 right-1.5 rounded-full bg-lime px-1.5 font-mono text-[11px] font-bold text-bg">
                        ×{count}
                      </span>
                    ) : null
                  }
                />
                {lists && count !== null && (
                  <TileListToggle cardId={c.id} cardName={c.name} owned={count > 0} favorite={favorites.has(c.id)} wished={wishlist.has(c.id)} />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
