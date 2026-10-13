import { TIER_LABELS_FR, TIERS, type Tier } from "@pokeflex/config";
import { prisma } from "@pokeflex/db";
import { closeDueAuctions, getHeldBids, getMarketListings, getOwnedCopyCounts, getWishlistCardIds, type MarketSort } from "@pokeflex/server";
import { Gavel, Heart, Search, Store, Tag } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Jetons } from "@/components/jetons";
import { ListingTile } from "@/components/market/listing-tile";
import { Button } from "@/components/ui/button";
import { getCurrentPlayerSafe } from "@/lib/player";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Marché",
  description: "Achète et vends des cartes Pokémon entre joueurs, à prix fixe ou aux enchères, en Jetons (sans valeur réelle).",
};

type SearchParams = Promise<{ q?: string; type?: string; rarete?: string; tri?: string; page?: string; wishlist?: string }>;

const TYPES = [
  { id: "", label: "Tout" },
  { id: "fixed", label: "Prix fixe" },
  { id: "auction", label: "Enchères" },
] as const;
const SORTS: { id: MarketSort; label: string }[] = [
  { id: "recent", label: "Récentes" },
  { id: "ending", label: "Fin proche" },
  { id: "price_asc", label: "Prix croissant" },
  { id: "price_desc", label: "Prix décroissant" },
];

export default async function MarketPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  // Rattrapage : une enchère échue est clôturée avant affichage, même si le serveur temps réel est arrêté.
  await closeDueAuctions();
  const type = sp.type === "fixed" || sp.type === "auction" ? sp.type : undefined;
  const tier = (TIERS as readonly string[]).includes(sp.rarete ?? "") ? (sp.rarete as Tier) : undefined;
  const sort = SORTS.find((s) => s.id === sp.tri)?.id ?? (type === "auction" ? "ending" : "recent");
  const page = Math.max(1, Number(sp.page) || 1);
  const player = await getCurrentPlayerSafe();
  const wishIds = player ? await getWishlistCardIds(player.id) : [];
  const onlyWishlist = Boolean(player && sp.wishlist === "1");
  const [result, sales24h] = await Promise.all([
    getMarketListings({ q: sp.q, type, tier, sort, page, cardIds: onlyWishlist ? wishIds : undefined }),
    prisma.sale.count({ where: { createdAt: { gte: new Date(Date.now() - 24 * 3_600_000) } } }),
  ]);
  const wished = new Set(wishIds);
  const [held, owned] = player
    ? await Promise.all([getHeldBids(player.id), getOwnedCopyCounts(player.id, result.listings.map((l) => l.card.id))])
    : [null, null];

  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { q: sp.q, type, rarete: tier, tri: sp.tri, wishlist: onlyWishlist ? "1" : undefined, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/marche?${s}` : "/marche";
  };

  return (
    <div className="grid grid-cols-1 gap-6 py-8 sm:py-12">
      <header className="grid gap-4 rounded-[calc(var(--radius-card)*1.4)] border border-line bg-[radial-gradient(110%_130%_at_100%_0%,color-mix(in_srgb,var(--color-coral)_22%,transparent),transparent_60%),var(--color-surface)] p-5 sm:grid-cols-[1fr_auto] sm:items-end sm:p-7">
        <div className="grid gap-2">
          <h1 className="flex items-center gap-2.5 font-display text-2xl font-bold sm:text-3xl">
            <Store aria-hidden="true" className="size-7 text-coral" />
            Marché
          </h1>
          <p className="max-w-[56ch] text-sm text-muted">
            Achète la carte qui te manque, vends tes doublons au plus offrant. Tout se paie en Jetons, sans valeur réelle.
          </p>
          <p className="font-mono text-xs text-muted">
            {result.total.toLocaleString("fr-FR")} annonce{result.total > 1 ? "s" : ""} · {sales24h} vente{sales24h > 1 ? "s" : ""} en 24 h
            {held && held.count > 0 && (
              <>
                {" "}· <Jetons value={held.amount} className="text-fg" /> réservés sur {held.count} enchère{held.count > 1 ? "s" : ""}
              </>
            )}
          </p>
        </div>
        {player && (
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary" size="sm">
              <Link href="/marche/mes-ventes">
                <Tag aria-hidden="true" />
                Mes ventes
              </Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href="/marche/mes-encheres">
                <Gavel aria-hidden="true" />
                Mes enchères
              </Link>
            </Button>
          </div>
        )}
      </header>

      <form action="/marche" className="relative" role="search">
        {type && <input type="hidden" name="type" value={type} />}
        {onlyWishlist && <input type="hidden" name="wishlist" value="1" />}
        {tier && <input type="hidden" name="rarete" value={tier} />}
        <label className="sr-only" htmlFor="marche-q">
          Chercher une carte au marché
        </label>
        <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted" />
        <input
          id="marche-q"
          name="q"
          type="search"
          defaultValue={sp.q}
          placeholder="Chercher une carte (Dracaufeu, Pikachu…)"
          className="h-12 w-full rounded-full border border-line bg-surface pr-4 pl-11 text-sm placeholder:text-muted focus:border-accent focus:outline-none"
        />
      </form>

      <div className="grid gap-3">
        <div className="pf-scroll-x -mx-4 flex gap-2 px-4" role="group" aria-label="Type d'annonce">
          {TYPES.map((t) => (
            <Link key={t.id} href={qs({ type: t.id || undefined, page: undefined, tri: undefined })} className="pf-chip" aria-current={(type ?? "") === t.id ? "page" : undefined}>
              {t.label}
            </Link>
          ))}
          {player && (
            <Link
              href={qs({ wishlist: onlyWishlist ? undefined : "1", page: undefined })}
              className="pf-chip"
              aria-current={onlyWishlist ? "page" : undefined}
            >
              <Heart aria-hidden="true" className="size-3.5 text-coral" />
              Ma wishlist
            </Link>
          )}
          <span aria-hidden="true" className="mx-1 w-px shrink-0 bg-line" />
          {TIERS.map((t) => (
            <Link
              key={t}
              href={qs({ rarete: tier === t ? undefined : t, page: undefined })}
              className="pf-chip"
              data-tier={t}
              aria-current={tier === t ? "page" : undefined}
            >
              {TIER_LABELS_FR[t]}
            </Link>
          ))}
        </div>
        <div className="pf-scroll-x -mx-4 flex items-center gap-2 px-4 text-sm" role="group" aria-label="Trier">
          <span className="shrink-0 text-muted">Trier :</span>
          {SORTS.map((s) => (
            <Link key={s.id} href={qs({ tri: s.id, page: undefined })} className={cn("shrink-0 rounded-full px-3 py-1", s.id === sort ? "bg-elev text-fg" : "text-muted hover:text-fg")} aria-current={s.id === sort ? "page" : undefined}>
              {s.label}
            </Link>
          ))}
        </div>
      </div>

      {result.listings.length === 0 ? (
        <div className="grid justify-items-center gap-3 rounded-[var(--radius-card)] border border-dashed border-line p-10 text-center">
          <p className="font-display text-lg font-bold">Aucune annonce {sp.q || tier || type || onlyWishlist ? "ne correspond" : "pour l'instant"}</p>
          <p className="max-w-[44ch] text-sm text-muted">
            {onlyWishlist
              ? wishIds.length === 0
                ? "Ta wishlist est vide : ajoute les cartes que tu cherches depuis leur fiche."
                : "Aucune carte de ta wishlist n'est en vente. Une alerte s'affichera dès qu'un joueur en propose une."
              : "Mets une carte en vente depuis sa fiche : ouvre une carte de ta collection, puis « Gérer » et « Vendre »."}
          </p>
          {player && (
            <Button asChild variant="secondary">
              <Link href="/collection?vue=cartes&tri=duplicates">Voir mes doublons</Link>
            </Button>
          )}
        </div>
      ) : (
        <ul className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {result.listings.map((l, i) => (
            <li key={l.id} className="min-w-0">
              <ListingTile l={l} mine={l.seller.id === player?.id} wished={wished.has(l.card.id)} owned={owned ? (owned.get(l.card.id) ?? 0) : undefined} priority={i < 12} />
            </li>
          ))}
        </ul>
      )}

      {result.pages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-center gap-3 text-sm">
          {page > 1 && (
            <Button asChild variant="secondary" size="sm">
              <Link href={qs({ page: String(page - 1) })}>Précédente</Link>
            </Button>
          )}
          <span className="font-mono text-muted">
            {page} / {result.pages}
          </span>
          {page < result.pages && (
            <Button asChild variant="secondary" size="sm">
              <Link href={qs({ page: String(page + 1) })}>Suivante</Link>
            </Button>
          )}
        </nav>
      )}
    </div>
  );
}
