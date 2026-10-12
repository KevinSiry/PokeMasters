import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CardGrid } from "@/components/catalog/card-grid";
import { SetLogo } from "@/components/catalog/set-logo";
import { getSet, getSetCards } from "@/lib/catalog";
import { formatDateFr, plural } from "@/lib/format";

type Params = Promise<{ setId: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const set = await getSet((await params).setId);
  if (!set) return { title: "Set introuvable" };
  return {
    title: `${set.name} (${set.serie.name})`,
    description: `Les ${set.cardCountTotal} cartes du set ${set.name}, série ${set.serie.name}.`,
  };
}

export default async function SetPage({ params }: { params: Params }) {
  const { setId } = await params;
  const set = await getSet(setId);
  if (!set) notFound();
  const cards = await getSetCards(set.id);

  return (
    <div className="grid grid-cols-1 gap-8 py-6 sm:py-10">
      <nav aria-label="Fil d'Ariane">
        <Link href={`/catalogue#serie-${set.serie.id}`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
          <ChevronLeft aria-hidden="true" className="size-4" />
          {set.serie.name}
        </Link>
      </nav>

      <header className="grid items-center gap-6 rounded-[calc(var(--radius-card)*1.4)] border border-line bg-surface p-5 sm:grid-cols-[minmax(0,15rem)_1fr] sm:p-8">
        <div className="flex h-24 items-center justify-center sm:h-32">
          <SetLogo logo={set.logo} name={set.name} />
        </div>
        <div className="grid gap-3">
          <h1 className="font-display text-2xl leading-tight font-bold sm:text-4xl">{set.name}</h1>
          {set.nameEn && set.nameEn !== set.name && <p className="text-muted">{set.nameEn}</p>}
          <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <div>
              <dt className="text-muted">Série</dt>
              <dd className="font-semibold">{set.serie.name}</dd>
            </div>
            {set.releaseDate && (
              <div>
                <dt className="text-muted">Sortie</dt>
                <dd className="font-semibold">{formatDateFr(set.releaseDate)}</dd>
              </div>
            )}
            <div>
              <dt className="text-muted">Cartes</dt>
              <dd className="font-mono font-semibold">
                {set.cardCountOfficial}
                {set.cardCountTotal > set.cardCountOfficial && (
                  <span className="text-muted"> + {set.cardCountTotal - set.cardCountOfficial} secrètes</span>
                )}
              </dd>
            </div>
            {set.lang === "en" && (
              <div>
                <dt className="text-muted">Langue</dt>
                <dd className="font-semibold">Anglais (pas de version française)</dd>
              </div>
            )}
          </dl>
        </div>
      </header>

      {cards.length === 0 ? (
        <p className="text-muted">Aucune carte importée pour ce set ({plural(set.cardCountTotal, "carte")} attendues).</p>
      ) : (
        <CardGrid cards={cards} />
      )}
    </div>
  );
}
