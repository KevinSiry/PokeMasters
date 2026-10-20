import { FINISH_LABELS_FR, gameConfig, TIER_LABELS_FR, type Finish } from "@pokeflex/config";
import { countWishers, getCardListState, getCardMarket, getCardTraders } from "@pokeflex/server";
import { ChevronLeft, ChevronRight, Heart, Palette, Repeat2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/back-link";
import { CardTile } from "@/components/catalog/card-tile";
import { MyCopies } from "@/components/economy/my-copies";
import { PlayerAvatar } from "@/components/player-avatar";
import { CardListButtons } from "@/components/lists/card-list-buttons";
import { Jetons } from "@/components/jetons";
import { ListingTile } from "@/components/market/listing-tile";
import { EnergyIcon } from "@/components/energy-icon";
import { TierBadge } from "@/components/tier-badge";
import { TiltCard } from "@/components/tilt-card";
import { cardImageUrl } from "@/lib/card-image";
import { getCard, getSamePokemon, getSetNeighbours } from "@/lib/catalog";
import { getMyCopies } from "@/lib/collection";
import { getCurrentPlayerSafe } from "@/lib/player";
import { formatDateFr, formatEur } from "@/lib/format";

type Params = Promise<{ id: string }>;

const CATEGORY_LABELS = { pokemon: "Pokémon", trainer: "Dresseur", energy: "Énergie" } as const;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const card = await getCard((await params).id);
  if (!card) return { title: "Carte introuvable" };
  const img = cardImageUrl(card.image, "high");
  return {
    title: `${card.name} — ${card.set.name}`,
    description: `${card.name} (${card.set.name}, ${card.localId}/${card.set.cardCountOfficial}) : tier ${TIER_LABELS_FR[card.tier]}${card.illustrator ? `, illustrée par ${card.illustrator}` : ""}.`,
    openGraph: img ? { images: [{ url: img }] } : undefined,
  };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3">
      <h2 className="font-mono text-xs tracking-[0.16em] text-muted uppercase">{title}</h2>
      {children}
    </section>
  );
}

export default async function CardPage({ params }: { params: Params }) {
  const { id } = await params;
  const card = await getCard(decodeURIComponent(id));
  if (!card) notFound();
  const [nav, same, player, market, wishers] = await Promise.all([
    getSetNeighbours(card.setId, card.sortKey, card.id),
    getSamePokemon(card.dexIds, card.id),
    getCurrentPlayerSafe(),
    getCardMarket(card.id),
    countWishers(card.id),
  ]);
  const suggestedPrice = market.stats.average ?? Math.max(5, gameConfig.economy.recycleValue[card.tier] * 3);
  const [copies, lists, traders] = player
    ? await Promise.all([getMyCopies(player.id, card.id), getCardListState(player.id, card.id), getCardTraders(card.id, player.id)])
    : [null, null, []];
  const finishes = (Object.keys(FINISH_LABELS_FR) as Finish[]).filter((f) => card.variants?.[f]);
  const price = formatEur(card.priceEurTrend);

  return (
    <div className="grid grid-cols-1 gap-10 py-6 sm:py-10">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <BackLink href={`/catalogue/${card.set.id}`} />
        <nav aria-label="Fil d'Ariane" className="flex flex-wrap items-center gap-1 text-sm text-muted">
          <Link href="/catalogue" className="pf-hit relative hover:text-fg">
            Catalogue
          </Link>
          <ChevronRight aria-hidden="true" className="size-3.5" />
          <Link href={`/catalogue/${card.set.id}`} className="pf-hit relative hover:text-fg">
            {card.set.name}
          </Link>
          <ChevronRight aria-hidden="true" className="size-3.5" />
          <span className="text-fg">{card.name}</span>
        </nav>
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,26rem)_1fr] lg:gap-14">
        <div className="grid gap-4 lg:sticky lg:top-24">
          <div className="mx-auto w-full max-w-[17rem] sm:max-w-[22rem] lg:max-w-none">
            <TiltCard image={card.image} name={card.name} tier={card.tier} priority />
          </div>
          <div className="flex items-center justify-between gap-2 text-sm">
            {nav.prev ? (
              <Link href={`/cartes/${nav.prev.id}`} className="pf-chip" rel="prev">
                <ChevronLeft aria-hidden="true" className="size-4" />
                <span className="max-w-[9rem] truncate">{nav.prev.name}</span>
              </Link>
            ) : (
              <span />
            )}
            {nav.next && (
              <Link href={`/cartes/${nav.next.id}`} className="pf-chip" rel="next">
                <span className="max-w-[9rem] truncate">{nav.next.name}</span>
                <ChevronRight aria-hidden="true" className="size-4" />
              </Link>
            )}
          </div>
        </div>

        <div className="grid min-w-0 gap-8">
          <header className="grid gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <TierBadge tier={card.tier} />
              {card.rarityRaw && (
                <span className="rounded-full border border-line px-2.5 py-1 text-xs text-muted">{card.rarityRaw}</span>
              )}
              <span className="rounded-full border border-line px-2.5 py-1 text-xs text-muted">{CATEGORY_LABELS[card.category]}</span>
              {card.lang === "en" && (
                <span className="rounded-full bg-elev px-2.5 py-1 font-mono text-xs font-bold">EN · pas de version FR</span>
              )}
            </div>
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
              <div className="grid gap-1">
                <h1 className="font-display text-[clamp(2rem,5vw,3rem)] leading-none font-bold">{card.name}</h1>
                {card.nameEn && card.nameEn !== card.name && <p className="text-muted">{card.nameEn}</p>}
              </div>
              {card.hp && (
                <p className="flex items-center gap-2 font-mono text-2xl font-bold">
                  <span className="text-sm text-muted">PV</span>
                  {card.hp}
                  {card.types.map((t) => (
                    <EnergyIcon key={t} type={t} size={26} />
                  ))}
                </p>
              )}
            </div>
            {(card.stage || card.evolveFrom) && (
              <p className="text-sm text-muted">
                {card.stage}
                {card.evolveFrom && (
                  <>
                    {card.stage ? " · " : ""}évolue de{" "}
                    <Link href={`/recherche?q=${encodeURIComponent(card.evolveFrom)}`} className="text-accent hover:underline">
                      {card.evolveFrom}
                    </Link>
                  </>
                )}
              </p>
            )}
          </header>

          {copies && lists && (
            <CardListButtons cardId={card.id} cardName={card.name} owned={copies.length > 0} favorite={lists.favorite} wished={lists.wished} />
          )}

          {copies && (
            <MyCopies
              copies={copies.map((c) => ({ ...c, obtainedAt: c.obtainedAt.toISOString() }))}
              value={gameConfig.economy.recycleValue[card.tier]}
              cardName={card.name}
              suggestedPrice={suggestedPrice}
              balance={player?.balance ?? 0}
            />
          )}

          {card.abilities.length > 0 && (
            <Section title="Talents">
              <ul className="grid gap-3">
                {card.abilities.map((a) => (
                  <li key={a.name} className="rounded-xl border border-coral/40 bg-coral/5 p-4">
                    <p className="font-semibold">
                      <span className="mr-2 rounded bg-coral-strong px-1.5 py-0.5 text-[11px] font-bold tracking-wide uppercase">
                        {a.type ?? "Talent"}
                      </span>
                      {a.name}
                    </p>
                    {a.effect && <p className="mt-2 text-sm leading-relaxed text-muted">{a.effect}</p>}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {card.attacks.length > 0 && (
            <Section title="Attaques">
              <ul className="grid divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
                {card.attacks.map((a, i) => (
                  <li key={`${a.name}-${i}`} className="grid gap-2 p-4">
                    <div className="flex items-center gap-3">
                      <span className="flex shrink-0 gap-1">
                        {a.cost.length === 0 ? (
                          <span className="text-xs text-muted">—</span>
                        ) : (
                          a.cost.map((c, j) => <EnergyIcon key={j} type={c} size={20} />)
                        )}
                      </span>
                      <span className="min-w-0 flex-1 font-semibold">{a.name}</span>
                      {a.damage && <span className="font-mono text-lg font-bold">{a.damage}</span>}
                    </div>
                    {a.effect && <p className="text-sm leading-relaxed text-muted">{a.effect}</p>}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {card.effect && (
            <Section title="Effet">
              <p className="rounded-xl border border-line bg-surface p-4 leading-relaxed">{card.effect}</p>
            </Section>
          )}

          {card.category === "pokemon" && (card.weaknesses.length > 0 || card.resistances.length > 0 || card.retreat !== null) && (
            <dl className="grid grid-cols-3 gap-3">
              {(
                [
                  ["Faiblesse", card.weaknesses],
                  ["Résistance", card.resistances],
                ] as const
              ).map(([label, list]) => (
                <div key={label} className="grid content-start gap-1.5 rounded-xl border border-line bg-surface p-3">
                  <dt className="text-xs text-muted">{label}</dt>
                  <dd className="flex flex-wrap items-center gap-1.5 font-mono font-bold">
                    {list.length === 0
                      ? "—"
                      : list.map((w) => (
                          <span key={w.type} className="inline-flex items-center gap-1">
                            <EnergyIcon type={w.type} size={18} />
                            {w.value}
                          </span>
                        ))}
                  </dd>
                </div>
              ))}
              <div className="grid content-start gap-1.5 rounded-xl border border-line bg-surface p-3">
                <dt className="text-xs text-muted">Retraite</dt>
                <dd className="flex flex-wrap gap-1">
                  {card.retreat
                    ? Array.from({ length: card.retreat }, (_, i) => <EnergyIcon key={i} type="colorless" size={18} />)
                    : "—"}
                </dd>
              </div>
            </dl>
          )}

          {card.description && (
            <blockquote className="border-l-2 border-accent pl-4 leading-relaxed text-muted italic">{card.description}</blockquote>
          )}

          <Section title="Fiche">
            <dl className="grid gap-x-6 gap-y-3 rounded-xl border border-line bg-surface p-4 text-sm sm:grid-cols-2">
              <div className="flex items-center justify-between gap-3 sm:block">
                <dt className="text-muted">Set</dt>
                <dd className="flex items-center gap-2 font-semibold">
                  <Link href={`/catalogue/${card.set.id}`} className="pf-hit relative hover:text-accent">
                    {card.set.name}
                  </Link>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 sm:block">
                <dt className="text-muted">Numéro</dt>
                <dd className="font-mono font-semibold">
                  {card.localId}/{card.set.cardCountOfficial}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 sm:block">
                <dt className="text-muted">Sortie</dt>
                <dd className="font-semibold">{formatDateFr(card.set.releaseDate) ?? "—"}</dd>
              </div>
              {card.illustrator && (
                <div className="flex items-center justify-between gap-3 sm:block">
                  <dt className="text-muted">Illustration</dt>
                  <dd>
                    <Link
                      href={`/recherche?illustrateur=${encodeURIComponent(card.illustrator)}`}
                      className="pf-hit relative inline-flex items-center gap-1.5 font-semibold text-accent hover:underline"
                    >
                      <Palette aria-hidden="true" className="size-3.5" />
                      {card.illustrator}
                    </Link>
                  </dd>
                </div>
              )}
              {finishes.length > 0 && (
                <div className="flex items-center justify-between gap-3 sm:block">
                  <dt className="text-muted">Finitions existantes</dt>
                  <dd className="font-semibold">{finishes.map((f) => FINISH_LABELS_FR[f]).join(", ")}</dd>
                </div>
              )}
              {card.regulationMark && (
                <div className="flex items-center justify-between gap-3 sm:block">
                  <dt className="text-muted">Marque de règlement</dt>
                  <dd className="font-mono font-semibold">{card.regulationMark}</dd>
                </div>
              )}
              {price && (
                <div className="flex items-center justify-between gap-3 sm:col-span-2 sm:block">
                  <dt className="text-muted">Cote indicative (Cardmarket)</dt>
                  <dd className="font-mono font-semibold">
                    {price}
                    <span className="ml-2 font-sans text-xs font-normal text-muted">
                      sert uniquement au calcul du tier ; rien ne s&apos;achète ici
                    </span>
                  </dd>
                </div>
              )}
            </dl>
          </Section>
        </div>
      </div>

      <section aria-labelledby="au-marche" className="grid min-w-0 gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="au-marche" className="font-display text-xl font-bold">
            Au marché
          </h2>
          <p className="text-sm text-muted">
            {market.stats.average !== null ? (
              <>
                Prix moyen sur 30 jours : <Jetons value={market.stats.average} className="text-fg" /> ({market.stats.count} vente{market.stats.count > 1 ? "s" : ""})
              </>
            ) : (
              "Pas encore de vente pour cette carte."
            )}
          </p>
        </div>
        {wishers !== null && wishers > 0 && (
          <p className="inline-flex items-center gap-2 text-sm text-muted">
            <Heart aria-hidden="true" className="size-4 text-coral" />
            {wishers === 1 ? "1 joueur recherche cette carte." : `${wishers.toLocaleString("fr-FR")} joueurs recherchent cette carte.`}
          </p>
        )}
        {market.active.length === 0 ? (
          <p className="rounded-[var(--radius-card)] border border-dashed border-line p-5 text-sm text-muted">
            Aucune annonce en ce moment. {copies && copies.length > 0 ? "Tu peux vendre un exemplaire depuis « Gérer » ci-dessus." : ""}
          </p>
        ) : (
          <ul className="pf-scroll-x pf-bleed flex snap-x gap-3 pb-2">
            {market.active.map((l) => (
              <li key={l.id} className="w-32 shrink-0 snap-start sm:w-40">
                <ListingTile l={l} mine={l.seller.id === player?.id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {traders.length > 0 && (
        <section aria-labelledby="a-l-echange" className="grid min-w-0 gap-4">
          <div className="grid gap-1">
            <h2 id="a-l-echange" className="flex items-center gap-2 font-display text-xl font-bold">
              <Repeat2 aria-hidden="true" className="size-5 text-accent" />
              À l&apos;échange
            </h2>
            <p className="text-sm text-muted">
              {lists?.wished ? "Elle est dans ta wishlist : ces joueurs peuvent te l'échanger." : "Ces joueurs en ont un exemplaire libre à échanger."}
            </p>
          </div>
          <ul className="pf-scroll-x pf-bleed flex snap-x gap-3 pb-2">
            {traders.map((t) => (
              <li key={t.id} className="w-44 shrink-0 snap-start">
                <Link
                  href={`/echanges/nouveau?avec=${encodeURIComponent(t.handle ?? "")}&carte=${encodeURIComponent(card.id)}`}
                  className="grid gap-2 rounded-2xl border border-line bg-surface p-3 transition-colors hover:border-accent"
                >
                  <span className="flex items-center gap-2">
                    <PlayerAvatar name={t.name} image={t.image} size="sm" />
                    <span className="grid min-w-0">
                      <span className="truncate text-sm font-semibold">{t.name}</span>
                      <span className="font-mono text-[11px] text-muted">×{t.copies}</span>
                    </span>
                  </span>
                  <span className="text-xs font-semibold text-accent">Proposer un échange</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {same.length > 0 && (
        <section aria-labelledby="same" className="grid min-w-0 gap-4">
          <h2 id="same" className="font-display text-xl font-bold">
            {card.name.split(/\s/)[0]} dans d&apos;autres sets
          </h2>
          <ul className="pf-scroll-x pf-bleed flex snap-x gap-3 pb-2">
            {same.map((c) => (
              <li key={c.id} className="w-32 shrink-0 snap-start sm:w-36">
                <CardTile card={c} subtitle={`n° ${c.localId}`} />
              </li>
            ))}
          </ul>
        </section>
      )}

    </div>
  );
}
