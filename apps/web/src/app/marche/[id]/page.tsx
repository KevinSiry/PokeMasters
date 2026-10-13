import { FINISH_LABELS_FR, TIER_LABELS_FR } from "@pokeflex/config";
import { closeAuction, getCardMarket, getListing, getOwnedCopyCounts } from "@pokeflex/server";
import { Check, ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Jetons } from "@/components/jetons";
import { ListingActions } from "@/components/market/listing-actions";
import { TierBadge } from "@/components/tier-badge";
import { TiltCard } from "@/components/tilt-card";
import { getCurrentPlayerSafe } from "@/lib/player";

type Params = Promise<{ id: string }>;

const when = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const data = await getListing((await params).id);
  return { title: data ? `${data.listing.card.name} au marché` : "Annonce introuvable" };
}

export default async function ListingPage({ params }: { params: Params }) {
  const { id } = await params;
  const first = await getListing(id);
  if (!first) notFound();
  // Une enchère échue est clôturée avant affichage.
  if (first.listing.type === "auction" && first.listing.status === "active" && first.listing.endsAt && new Date(first.listing.endsAt) <= new Date()) {
    await closeAuction(id);
  }
  const data = (await getListing(id))!;
  const l = data.listing;
  const [player, market] = await Promise.all([getCurrentPlayerSafe(), getCardMarket(l.card.id)]);
  const owned = player && player.id !== l.seller.id ? ((await getOwnedCopyCounts(player.id, [l.card.id])).get(l.card.id) ?? 0) : null;

  return (
    <div className="grid grid-cols-1 gap-6 py-6 sm:py-10">
      <nav aria-label="Fil d'Ariane">
        <Link href="/marche" className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
          <ChevronLeft aria-hidden="true" className="size-4" />
          Marché
        </Link>
      </nav>
      <div className="grid gap-8 md:grid-cols-[minmax(0,22rem)_1fr] md:items-start">
        <div className="mx-auto w-[min(78vw,22rem)]">
          <TiltCard image={l.card.image} name={l.card.name} tier={l.card.tier} priority />
        </div>
        <div className="grid min-w-0 gap-5">
          <header className="grid gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <TierBadge tier={l.card.tier} />
              {l.finish !== "normal" && (
                <span className="rounded-full bg-gradient-to-r from-accent-strong to-coral-strong px-2.5 py-1 text-xs font-bold">{FINISH_LABELS_FR[l.finish]}</span>
              )}
              {l.card.lang === "en" && <span className="rounded-full bg-elev px-2.5 py-1 font-mono text-xs">EN</span>}
              {owned !== null &&
                (owned > 0 ? (
                  <Link href={`/cartes/${l.card.id}`} className="inline-flex items-center gap-1 rounded-full bg-lime/15 px-2.5 py-1 text-xs font-bold text-lime hover:bg-lime/25">
                    <Check aria-hidden="true" className="size-3.5" strokeWidth={3} />
                    Déjà obtenue · {owned} ex.
                  </Link>
                ) : (
                  <span className="rounded-full bg-lime px-2.5 py-1 text-xs font-black text-bg">Pas encore obtenue</span>
                ))}
            </div>
            <h1 className="font-display text-2xl font-bold sm:text-3xl">{l.card.name}</h1>
            <p className="text-sm text-muted">
              <Link href={`/catalogue/${l.card.setId}`} className="hover:text-fg">
                {l.card.setName}
              </Link>{" "}
              · n° {l.card.localId} · vendue par <span className="text-fg">{l.seller.name}</span>
            </p>
          </header>

          <ListingActions
            listing={{
              id: l.id,
              type: l.type,
              status: l.status,
              price: l.price,
              currentBid: l.currentBid,
              currentBidderId: l.currentBidderId,
              buyerId: l.buyerId,
              bidCount: l.bidCount,
              endsAt: l.endsAt,
              sellerId: l.seller.id,
              cardId: l.card.id,
              cardName: l.card.name,
            }}
            viewer={player ? { id: player.id, balance: player.balance } : null}
          />

          <section aria-labelledby="cote" className="grid gap-3 rounded-[var(--radius-card)] border border-line p-5">
            <h2 id="cote" className="font-display text-base font-bold">
              Cote de la carte
            </h2>
            {market.stats.count === 0 ? (
              <p className="text-sm text-muted">Aucune vente ces 30 derniers jours. Rareté : {TIER_LABELS_FR[l.card.tier]}.</p>
            ) : (
              <dl className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <dt className="text-muted">Prix moyen</dt>
                  <dd>
                    <Jetons value={market.stats.average!} />
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">Plus bas</dt>
                  <dd>
                    <Jetons value={market.stats.min!} />
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">Ventes (30 j)</dt>
                  <dd className="font-mono font-bold">{market.stats.count}</dd>
                </div>
              </dl>
            )}
            {market.sales.length > 0 && (
              <ul className="grid gap-1 text-sm">
                {market.sales.map((s) => (
                  <li key={s.id} className="flex justify-between gap-3 border-t border-line pt-1.5">
                    <span className="text-muted">
                      {when.format(new Date(s.createdAt))} · {FINISH_LABELS_FR[s.finish]}
                    </span>
                    <Jetons value={s.price} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {l.type === "auction" && data.bids.length > 0 && (
            <section aria-labelledby="offres" className="grid gap-2 rounded-[var(--radius-card)] border border-line p-5">
              <h2 id="offres" className="font-display text-base font-bold">
                Offres
              </h2>
              <ol className="grid gap-1 text-sm">
                {data.bids.map((b, i) => (
                  <li key={b.id} className="flex justify-between gap-3">
                    <span className={i === 0 ? "font-semibold" : "text-muted"}>
                      {b.bidder.id === player?.id ? "Toi" : b.bidder.name} · {when.format(new Date(b.at))}
                    </span>
                    <Jetons value={b.amount} className={i === 0 ? "text-[#FFC93C]" : ""} />
                  </li>
                ))}
              </ol>
            </section>
          )}

          <Link href={`/cartes/${l.card.id}`} className="text-sm font-semibold text-accent hover:underline">
            Fiche complète de la carte
          </Link>
        </div>
      </div>
    </div>
  );
}
