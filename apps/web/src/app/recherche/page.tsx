import type { Metadata } from "next";
import Link from "next/link";
import { CardTile } from "@/components/catalog/card-tile";
import { SearchBox } from "@/components/catalog/search-box";
import { searchCards } from "@/lib/catalog";

export const metadata: Metadata = { title: "Recherche", robots: { index: false } };

type SearchParams = Promise<{ q?: string; illustrateur?: string }>;

const SUGGESTIONS = ["Dracaufeu", "Pikachu", "Mewtwo", "Évoli", "Rayquaza", "Lugia"];

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const { q = "", illustrateur } = await searchParams;
  const query = q.trim();
  const results = illustrateur ? await searchCards("", { illustrator: illustrateur, limit: 120 }) : await searchCards(query);
  const searched = Boolean(illustrateur) || query.length >= 2;

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
        <p className="rounded-[var(--radius-card)] border border-dashed border-line p-8 text-center text-muted">
          Aucune carte trouvée pour « {query || illustrateur} ». Essaie le nom anglais ou une orthographe plus courte.
        </p>
      ) : (
        <section aria-label="Résultats" className="grid gap-4">
          <p className="text-sm text-muted" aria-live="polite">
            {results.length} résultat{results.length > 1 ? "s" : ""}
            {results.length >= 60 && !illustrateur ? " (les plus pertinents)" : ""}
          </p>
          <ul className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
            {results.map((c, i) => (
              <li key={c.id}>
                <CardTile card={c} subtitle={c.setName} priority={i < 12} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
