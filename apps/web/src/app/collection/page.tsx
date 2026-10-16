import { FINISH_LABELS_FR, gameConfig } from "@pokeflex/config";
import { getFavoriteCardIds, getFavorites, getWishlist, getWishlistSummary } from "@pokeflex/server";
import { CheckCircle2, ChevronDown, Heart, Sparkles, Star, Store } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CardTile } from "@/components/catalog/card-tile";
import { RecycleDuplicates } from "@/components/economy/recycle-duplicates";
import { Jetons } from "@/components/jetons";
import { Pagination } from "@/components/pagination";
import { SetLogo } from "@/components/catalog/set-logo";
import { ProgressBar, ProgressRing } from "@/components/progress";
import { Button } from "@/components/ui/button";
import {
  GENERATIONS,
  getCollectionTotals,
  getDex,
  getIllustratorProgress,
  getOwnedCards,
  getSetProgress,
  type CollectionSort,
  type SetProgress,
} from "@/lib/collection";
import { plural } from "@/lib/format";
import { paginate, type PageInfo } from "@/lib/pagination";
import { getCurrentPlayer } from "@/lib/player";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Ma collection" };

const VIEWS = [
  { id: "sets", label: "Sets" },
  { id: "cartes", label: "Mes cartes" },
  { id: "favoris", label: "Favoris" },
  { id: "wishlist", label: "Wishlist" },
  { id: "pokedex", label: "Pokédex" },
  { id: "illustrateurs", label: "Illustrateurs" },
] as const;
type View = (typeof VIEWS)[number]["id"];

const SORTS: { id: CollectionSort; label: string }[] = [
  { id: "recent", label: "Récentes" },
  { id: "tier", label: "Rareté" },
  { id: "name", label: "Nom" },
  { id: "duplicates", label: "Doublons" },
];

type SearchParams = Promise<{ vue?: string; tri?: string; gen?: string; page?: string }>;

export default async function CollectionPage({ searchParams }: { searchParams: SearchParams }) {
  const player = await getCurrentPlayer();
  if (!player) redirect("/connexion?suite=/collection");
  const sp = await searchParams;
  const view: View = (VIEWS.find((v) => v.id === sp.vue)?.id ?? "sets") as View;
  const totals = await getCollectionTotals(player.id);

  return (
    <div className="grid grid-cols-1 gap-8 py-8 sm:py-12">
      <header className="grid grid-cols-[auto_1fr] items-center gap-5 rounded-[calc(var(--radius-card)*1.4)] border border-line bg-surface p-5 sm:gap-6 sm:p-7">
        <ProgressRing percent={totals.percent} size={92} label="Complétion du catalogue" />
        <div className="grid gap-1">
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Ma collection</h1>
          <p className="text-sm text-muted">des cartes à collectionner, toutes séries confondues</p>
        </div>
          <dl className="col-span-2 grid grid-cols-3 gap-3 text-sm sm:col-start-2 sm:max-w-lg">
            <div>
              <dt className="text-muted">Cartes uniques</dt>
              <dd className="font-mono text-lg font-bold font-tabular">
                {totals.unique.toLocaleString("fr-FR")}
                <span className="text-xs text-muted"> / {totals.catalog.toLocaleString("fr-FR")}</span>
              </dd>
            </div>
            <div>
              <dt className="text-muted">Exemplaires</dt>
              <dd className="font-mono text-lg font-bold font-tabular">{totals.copies.toLocaleString("fr-FR")}</dd>
            </div>
            <div>
              <dt className="text-muted">Sets complétés</dt>
              <dd className="font-mono text-lg font-bold font-tabular">{totals.setsCompleted}</dd>
            </div>
          </dl>
      </header>

      {totals.copies === 0 && view !== "wishlist" ? (
        <div className="grid justify-items-center gap-4 rounded-[var(--radius-card)] border border-dashed border-line p-10 text-center">
          <p className="font-display text-xl font-bold">Ton classeur est vide</p>
          <p className="max-w-[44ch] text-muted">Ouvre ton premier booster : 5 cartes tirées dans tout le catalogue, dont au moins une Peu commune.</p>
          <Button asChild size="lg">
            <Link href="/boosters">
              <Sparkles aria-hidden="true" />
              Ouvrir un booster
            </Link>
          </Button>
        </div>
      ) : (
        <>
          <nav aria-label="Vues de la collection" className="pf-scroll-x -mx-4 flex gap-2 px-4">
            {VIEWS.map((v) => (
              <Link key={v.id} href={`/collection?vue=${v.id}`} className="pf-chip" aria-current={v.id === view ? "page" : undefined}>
                {v.label}
              </Link>
            ))}
          </nav>
          {view === "sets" && <SetsView userId={player.id} />}
          {view === "cartes" && <CardsView userId={player.id} sort={(SORTS.find((s) => s.id === sp.tri)?.id ?? "recent") as CollectionSort} page={sp.page} />}
          {view === "favoris" && <FavoritesView userId={player.id} page={sp.page} />}
          {view === "wishlist" && <WishlistView userId={player.id} page={sp.page} />}
          {view === "pokedex" && <DexView userId={player.id} gen={Number(sp.gen ?? 1)} />}
          {view === "illustrateurs" && <IllustratorsView userId={player.id} />}
        </>
      )}
    </div>
  );
}

async function SetsView({ userId }: { userId: string }) {
  const sets = await getSetProgress(userId);
  const series = new Map<string, { name: string; sets: SetProgress[] }>();
  for (const s of sets) {
    const entry = series.get(s.serieId) ?? { name: s.serieName, sets: [] };
    entry.sets.push(s);
    series.set(s.serieId, entry);
  }
  return (
    <div className="grid grid-cols-1 gap-3">
      {[...series.entries()].map(([id, serie]) => {
        const owned = serie.sets.reduce((n, s) => n + s.owned, 0);
        const total = serie.sets.reduce((n, s) => n + s.total, 0);
        return (
          <details key={id} open={owned > 0} className="group min-w-0 rounded-[var(--radius-card)] border border-line bg-surface">
            <summary className="flex cursor-pointer list-none items-center gap-4 p-4 sm:px-5 [&::-webkit-details-marker]:hidden">
              <span className="min-w-0 flex-1">
                <span className="block font-display font-bold">{serie.name}</span>
                <span className="font-mono text-xs text-muted">
                  {owned}/{total} · {plural(serie.sets.length, "set")}
                </span>
              </span>
              <ProgressBar value={owned} max={total} className="hidden w-40 sm:block" label={`Complétion ${serie.name}`} />
              <ChevronDown aria-hidden="true" className="size-5 text-muted transition-transform group-open:rotate-180" />
            </summary>
            <ul className="grid grid-cols-1 gap-1 border-t border-line p-2 sm:grid-cols-2">
              {serie.sets.map((s) => (
                <li key={s.id} className="min-w-0">
                  <Link href={`/catalogue/${s.id}`} className="flex items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-elev">
                    <span className="flex h-9 w-16 shrink-0 items-center justify-center">
                      <SetLogo logo={s.logo} name={s.name} />
                    </span>
                    <span className="grid min-w-0 flex-1 grid-cols-1 gap-1.5">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="min-w-0 truncate text-sm font-semibold">{s.name}</span>
                          {s.completed && <CheckCircle2 aria-label="Set complété" className="size-4 shrink-0 text-lime" />}
                        </span>
                        <span className={cn("shrink-0 font-mono text-xs", s.owned >= s.total ? "text-lime" : "text-muted")}>
                          {s.owned}/{s.total}
                        </span>
                      </span>
                      <ProgressBar value={s.owned} max={s.total} label={`Complétion ${s.name}`} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        );
      })}
    </div>
  );
}

const favoriteBadge = (
  <span className="absolute top-1.5 left-1.5 grid size-6 place-items-center rounded-full bg-bg/85 text-[#FFC93C] backdrop-blur">
    <Star aria-label="Favorite" className="size-3.5 fill-current" />
  </span>
);

async function CardsView({ userId, sort, page }: { userId: string; sort: CollectionSort; page?: string }) {
  const [owned, favorites] = await Promise.all([getOwnedCards(userId, sort, page), getFavoriteCardIds(userId)]);
  const { cards } = owned;
  return (
    <div className="grid grid-cols-1 gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="pf-scroll-x -mx-4 flex gap-2 px-4 sm:mx-0 sm:px-0" role="group" aria-label="Trier">
          {SORTS.map((s) => (
            <Link key={s.id} href={`/collection?vue=cartes&tri=${s.id}`} className="pf-chip" aria-current={s.id === sort ? "page" : undefined}>
              {s.label}
            </Link>
          ))}
        </div>
        <RecycleDuplicates />
      </div>
      <PageCount info={owned} />
      <ul className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
        {cards.map((c, i) => (
          <li key={c.id}>
            <CardTile
              card={c}
              priority={i < 12}
              subtitle={c.finishes.filter((f) => f !== "normal").map((f) => FINISH_LABELS_FR[f]).join(" · ") || c.setName}
              badge={
                <>
                  {favorites.has(c.id) && favoriteBadge}
                  {c.copies > 1 && (
                    <span className="absolute right-1.5 bottom-1.5 rounded-full bg-lime px-1.5 font-mono text-[11px] font-bold text-bg">×{c.copies}</span>
                  )}
                </>
              }
            />
          </li>
        ))}
      </ul>
      <Pagination info={owned} href={(p) => `/collection?vue=cartes&tri=${sort}&page=${p}`} label="Pages de ta collection" />
    </div>
  );
}

/** « Cartes 61 à 120 sur 523 » au-dessus d'une grille paginée. */
function PageCount({ info }: { info: PageInfo }) {
  if (info.pageCount <= 1) return null;
  return (
    <p className="text-sm text-muted">
      Cartes {(info.start + 1).toLocaleString("fr-FR")} à {info.end.toLocaleString("fr-FR")} sur {info.total.toLocaleString("fr-FR")}
    </p>
  );
}

function ListEmpty({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="grid justify-items-center gap-2 rounded-[var(--radius-card)] border border-dashed border-line p-10 text-center">
      {icon}
      <p className="font-display text-lg font-bold">{title}</p>
      <p className="max-w-[48ch] text-sm text-muted">{children}</p>
    </div>
  );
}

async function FavoritesView({ userId, page }: { userId: string; page?: string }) {
  const all = await getFavorites(userId);
  const info = paginate(all.length, page);
  const cards = all.slice(info.start, info.end);
  if (cards.length === 0) {
    return (
      <ListEmpty icon={<Star aria-hidden="true" className="size-7 text-[#FFC93C]" />} title="Aucune carte favorite">
        Ouvre une carte de ta collection et touche « Mettre en favori ». Tes favorites gardent tous leurs exemplaires quand tu recycles tes doublons.
      </ListEmpty>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4">
      <p className="text-sm text-muted">
        {plural(all.length, "carte favorite", "cartes favorites")} sur {gameConfig.lists.favoritesMax} · jamais recyclées avec les doublons
      </p>
      <ul className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
        {cards.map((c, i) => (
          <li key={c.id}>
            <CardTile
              card={c}
              priority={i < 12}
              subtitle={c.copies === 0 ? "plus dans ta collection" : c.setName}
              missing={c.copies === 0}
              badge={
                <>
                  {favoriteBadge}
                  {c.copies > 1 && (
                    <span className="absolute right-1.5 bottom-1.5 rounded-full bg-lime px-1.5 font-mono text-[11px] font-bold text-bg">×{c.copies}</span>
                  )}
                </>
              }
            />
          </li>
        ))}
      </ul>
      <Pagination info={info} href={(p) => `/collection?vue=favoris&page=${p}`} label="Pages de tes favoris" />
    </div>
  );
}

async function WishlistView({ userId, page }: { userId: string; page?: string }) {
  // La wishlist n'a pas de limite : comptée en base, puis seule la page affichée est chargée.
  const { total, onSale } = await getWishlistSummary(userId);
  const info = paginate(total, page);
  const cards = total > 0 ? await getWishlist(userId, { skip: info.start, take: info.end - info.start }) : [];
  if (cards.length === 0) {
    return (
      <ListEmpty icon={<Heart aria-hidden="true" className="size-7 text-coral" />} title="Ta wishlist est vide">
        Ajoute les cartes que tu cherches depuis leur fiche, avec « Ajouter à ma wishlist ». Une alerte s&apos;affiche dès qu&apos;un joueur en met une en vente, et une carte obtenue quitte la liste d&apos;elle-même.
      </ListEmpty>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {plural(total, "carte recherchée", "cartes recherchées")}
          {gameConfig.lists.wishlistMax !== null && <> sur {gameConfig.lists.wishlistMax}</>}
          {onSale > 0 && <> · {plural(onSale, "en vente", "en vente")} au marché</>}
        </p>
        {onSale > 0 && (
          <Button asChild variant="secondary" size="sm">
            <Link href="/marche?wishlist=1">
              <Store aria-hidden="true" />
              Voir au marché
            </Link>
          </Button>
        )}
      </div>
      <ul className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
        {cards.map((c, i) => (
          <li key={c.id} className="grid gap-1.5">
            <CardTile
              card={c}
              priority={i < 12}
              subtitle={c.setName}
            />
            {c.onSale > 0 && c.lowestPrice !== null && (
              <Link href={`/cartes/${c.id}#au-marche`} className="inline-flex items-center gap-1 px-0.5 text-[11px] text-coral hover:underline">
                <Store aria-hidden="true" className="size-3" />
                dès <Jetons value={c.lowestPrice} className="text-[11px]" />
              </Link>
            )}
          </li>
        ))}
      </ul>
      <Pagination info={info} href={(p) => `/collection?vue=wishlist&page=${p}`} label="Pages de ta wishlist" />
    </div>
  );
}

async function DexView({ userId, gen }: { userId: string; gen: number }) {
  const g = GENERATIONS.find((x) => x.id === gen) ?? GENERATIONS[0];
  const entries = await getDex(userId, g.from, g.to);
  const caught = entries.filter((e) => e.owned > 0).length;
  return (
    <div className="grid grid-cols-1 gap-5">
      <div className="pf-scroll-x -mx-4 flex gap-2 px-4" role="group" aria-label="Génération">
        {GENERATIONS.map((x) => (
          <Link key={x.id} href={`/collection?vue=pokedex&gen=${x.id}`} className="pf-chip" aria-current={x.id === g.id ? "page" : undefined}>
            {x.label}
          </Link>
        ))}
      </div>
      <p className="text-sm text-muted">
        {caught} Pokémon sur {g.to - g.from + 1} de {g.label} ont au moins une carte dans ta collection.
      </p>
      <ul className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-5 lg:grid-cols-7">
        {entries.map((e) => (
          <li key={e.dex}>
            <CardTile
              card={{ id: e.cardId, name: e.name, image: e.image, tier: "common", lang: "fr" }}
              missing={e.owned === 0}
              hideTier
              href={`/recherche?q=${encodeURIComponent(e.name)}`}
              subtitle={`#${String(e.dex).padStart(4, "0")} · ${e.owned}/${e.total}`}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

async function IllustratorsView({ userId }: { userId: string }) {
  const rows = await getIllustratorProgress(userId);
  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {rows.map((r) => (
        <li key={r.name} className="min-w-0">
          <Link
            href={`/recherche?illustrateur=${encodeURIComponent(r.name)}`}
            className="grid grid-cols-1 gap-2 rounded-xl border border-line bg-surface p-3.5 transition-colors hover:border-accent"
          >
            <span className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 truncate font-semibold">{r.name}</span>
              <span className="shrink-0 font-mono text-xs text-muted">
                {r.owned}/{r.total}
              </span>
            </span>
            <ProgressBar value={r.owned} max={r.total} label={`Cartes de ${r.name}`} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
