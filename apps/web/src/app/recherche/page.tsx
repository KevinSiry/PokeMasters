import { getFavoriteCardIds, getWishlistCardIds } from "@pokeflex/server";
import type { Metadata } from "next";
import { SearchX } from "lucide-react";
import Link from "next/link";
import { CardTile } from "@/components/catalog/card-tile";
import { SearchBox } from "@/components/catalog/search-box";
import { TileListToggle } from "@/components/lists/tile-list-toggle";
import { EmptyState } from "@/components/ui/empty-state";
import { searchCards } from "@/lib/catalog";
import { getOwnedCountsFor } from "@/lib/collection";
import { getCurrentPlayerSafe } from "@/lib/player";

export const metadata: Metadata = { title: "Recherche", robots: { index: false } };

type SearchParams = Promise<{ q?: string; illustrateur?: string }>;

const SUGGESTIONS = ["Dracaufeu", "Pikachu", "Mewtwo", "Évoli", "Rayquaza", "Lugia"];

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const { q = "", illustrateur } = await searchParams;
  const query = q.trim();
  const [results, player] = await Promise.all([
    illustrateur ? searchCards("", { illustrator: illustrateur, limit: 120 }) : searchCards(query),
    getCurrentPlayerSafe(),
  ]);
  const searched = Boolean(illustrateur) || query.length >= 2;
  // Joueur connecté : possession, favoris et wishlist des résultats, pour la bascule de chaque vignette.
  const [owned, favoriteIds, wishlistIds] =
    player && results.length > 0
      ? await Promise.all([
          getOwnedCountsFor(
            player.id,
            results.map((c) => c.id),
          ),
          getFavoriteCardIds(player.id),
          getWishlistCardIds(
            player.id,
            results.map((c) => c.id),
          ),
        ])
      : [null, null, null];
  const favorites = new Set(favoriteIds);
  const wishlist = new Set(wishlistIds);

  return (
    <div className="grid grid-cols-1 gap-8 py-8 sm:py-12">
      <header className="grid gap-4">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">
          {illustrateur ? (
            <>
              Illustrées par <span className="text-prism">{illustrateur}</span>
            </>
          ) : (
            "Rechercher une carte"
          )}
        </h1>
        {!illustrateur && (
          <>
            <SearchBox defaultValue={query} className="max-w-xl" autoFocus={!query} />
            <p className="text-sm text-muted">En français ou en anglais, les accents et petites fautes sont tolérés.</p>
          </>
        )}
      </header>

      {!searched ? (
        <div className="grid gap-3">
          <p className="text-sm text-muted">Quelques idées :</p>
          <ul className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <li key={s}>
                <Link href={`/recherche?q=${encodeURIComponent(s)}`} className="pf-chip">
                  {s}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : results.length === 0 ? (
        <EmptyState icon={<SearchX />} title={`Aucune carte trouvée pour « ${query || illustrateur} »`}>
          Essaie le nom anglais ou une orthographe plus courte.
        </EmptyState>
      ) : (
        <section aria-label="Résultats" className="grid gap-4">
          <p className="text-sm text-muted" aria-live="polite">
            {results.length} résultat{results.length > 1 ? "s" : ""}
            {results.length >= 60 && !illustrateur ? " (les plus pertinents)" : ""}
          </p>
          <ul className="pf-card-grid">
            {results.map((c, i) => {
              const count = owned ? (owned[c.id] ?? 0) : null;
              return (
                <li key={c.id} className="relative">
                  <CardTile
                    card={c}
                    subtitle={c.setName}
                    priority={i < 12}
                    missing={count === 0}
                    badge={
                      count && count > 1 ? (
                        <span className="absolute bottom-1.5 right-1.5 rounded-full bg-lime px-1.5 font-mono text-[11px] font-bold text-bg">
                          ×{count}
                        </span>
                      ) : null
                    }
                  />
                  {count !== null && (
                    <TileListToggle cardId={c.id} cardName={c.name} owned={count > 0} favorite={favorites.has(c.id)} wished={wishlist.has(c.id)} />
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
