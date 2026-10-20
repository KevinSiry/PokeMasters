import type { Metadata } from "next";
import Link from "next/link";
import { SearchBox } from "@/components/catalog/search-box";
import { SetLogo } from "@/components/catalog/set-logo";
import { getCatalogue, getCatalogueStats } from "@/lib/catalog";
import { formatYear, plural } from "@/lib/format";
import { resolveLogo } from "@/lib/logo";

export const metadata: Metadata = {
  title: "Catalogue",
  description: "Toutes les cartes Pokémon sorties depuis 1999, rangées par série et par set.",
};

const PRIORITY_LOGOS = 4;

export default async function CataloguePage() {
  const [series, stats] = await Promise.all([getCatalogue(), getCatalogueStats()]);
  // Logos visibles dès l'arrivée : bonne URL rendue directement, sans attendre le repli côté client.
  const firstLogos = await Promise.all((series[0]?.sets ?? []).slice(0, PRIORITY_LOGOS).map((set) => resolveLogo(set.logo)));

  return (
    <div className="grid grid-cols-1 gap-8 py-8 sm:py-12">
      <header className="grid gap-5">
        <div className="grid gap-2">
          <p className="font-mono text-xs tracking-[0.18em] text-muted uppercase">Depuis 1999</p>
          <h1 className="font-display text-[clamp(1.9rem,5vw,3rem)] leading-tight font-bold">Le catalogue</h1>
          <p className="max-w-[60ch] text-muted">
            {plural(stats.cards, "carte")}, {plural(stats.sets, "set")} et {plural(stats.series, "série")}. Les
            cartes sans version française sont affichées en anglais avec un badge <span className="font-mono text-fg">EN</span>.
          </p>
        </div>
        <SearchBox className="max-w-xl" />
      </header>

      {series.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-dashed border-line p-8 text-center text-muted">
          Le catalogue est vide. Lance <code className="font-mono text-fg">npm run sync:catalog</code> pour importer les
          cartes depuis TCGdex.
        </div>
      ) : (
        <>
          <nav aria-label="Séries" className="sticky top-14 z-30 sm:top-16 pf-bleed border-b border-line/60 bg-bg/85 py-3 backdrop-blur-md">
            <ul className="pf-scroll-x flex gap-2">
              {series.map((s) => (
                <li key={s.id}>
                  <a href={`#serie-${s.id}`} className="pf-chip">
                    {s.name}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="grid grid-cols-1 gap-12">
            {series.map((s, si) => {
              const years = s.sets.map((x) => x.releaseDate).filter((d): d is Date => d !== null);
              const from = formatYear(years.length ? new Date(Math.min(...years.map(Number))) : null);
              const to = formatYear(years.length ? new Date(Math.max(...years.map(Number))) : null);
              return (
                <section key={s.id} id={`serie-${s.id}`} aria-labelledby={`h-${s.id}`} className="grid min-w-0 scroll-mt-36 gap-4">
                  <div className="flex items-baseline justify-between gap-4">
                    <h2 id={`h-${s.id}`} className="font-display text-xl font-bold sm:text-2xl">
                      {s.name}
                    </h2>
                    <span className="shrink-0 font-mono text-xs text-muted">
                      {from && to ? (from === to ? from : `${from} – ${to}`) : null} · {plural(s.sets.length, "set")}
                    </span>
                  </div>
                  <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 min-[112rem]:grid-cols-6">
                    {s.sets.map((set, i) => (
                      <li key={set.id}>
                        <Link
                          href={`/catalogue/${set.id}`}
                          className="group grid h-full content-between gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-3 transition-[border-color,transform,background-color] hover:-translate-y-0.5 hover:border-accent hover:bg-elev sm:p-4"
                        >
                          <div className="flex h-16 items-center justify-center rounded-lg bg-[radial-gradient(circle_at_50%_30%,color-mix(in_srgb,var(--color-accent)_14%,transparent),transparent_70%)] px-2 sm:h-20">
                            {si === 0 && i < PRIORITY_LOGOS ? (
                              <SetLogo logo={firstLogos[i] ?? set.logo} name={set.name} priority />
                            ) : (
                              <SetLogo logo={set.logo} name={set.name} />
                            )}
                          </div>
                          <div className="grid gap-0.5">
                            <span className="line-clamp-2 text-sm leading-snug font-semibold">{set.name}</span>
                            <span className="font-mono text-[11px] text-muted">
                              {formatYear(set.releaseDate) ?? "—"} · {plural(set.cardCount, "carte")}
                              {set.lang === "en" && <span className="ml-1.5 rounded bg-elev px-1 font-bold">EN</span>}
                            </span>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
