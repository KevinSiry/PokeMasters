import { gameConfig } from "@pokeflex/config";
import { prisma } from "@pokeflex/db";
import { setCompletionBonus } from "@pokeflex/game";
import { getFavoriteCardIds, getWishlistCardIds } from "@pokeflex/server";
import { CheckCircle2, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/back-link";
import { CardGrid } from "@/components/catalog/card-grid";
import { SetLogo } from "@/components/catalog/set-logo";
import { Jetons } from "@/components/jetons";
import { ProgressBar } from "@/components/progress";
import { Button } from "@/components/ui/button";
import { getSet, getSetCards } from "@/lib/catalog";
import { getOwnedCounts } from "@/lib/collection";
import { getCurrentPlayerSafe } from "@/lib/player";
import { formatDateFr, plural } from "@/lib/format";
import { resolveLogo } from "@/lib/logo";

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
  const [cards, player, logo] = await Promise.all([getSetCards(set.id), getCurrentPlayerSafe(), resolveLogo(set.logo)]);
  const [owned, completion, favoriteIds, wishlistIds] = player
    ? await Promise.all([
        getOwnedCounts(player.id, set.id),
        prisma.setCompletion.findUnique({ where: { userId_setId: { userId: player.id, setId: set.id } } }),
        getFavoriteCardIds(player.id),
        getWishlistCardIds(
          player.id,
          cards.map((c) => c.id),
        ),
      ])
    : [null, null, null, null];
  // Seules les cartes tirables (avec image) comptent pour compléter un set.
  const collectable = cards.filter((c) => c.droppable);
  const ownedCount = owned ? collectable.filter((c) => owned[c.id]).length : 0;
  const bonus = setCompletionBonus(set.cardCountOfficial, gameConfig.economy.setCompletionBonusPerCard);
  // Seules les listes de ce set partent vers le client.
  const setCardIds = new Set(cards.map((c) => c.id));
  const inSet = (id: string) => setCardIds.has(id);
  const lists =
    favoriteIds && wishlistIds ? { favorites: [...favoriteIds].filter(inSet), wishlist: wishlistIds.filter(inSet) } : null;
  const hasBooster = collectable.length >= gameConfig.setBoosters.minDroppableCards;

  return (
    <div className="grid grid-cols-1 gap-8 py-6 sm:py-10">
      <BackLink href={`/catalogue#serie-${set.serie.id}`} />

      <header className="grid items-center gap-4 rounded-[calc(var(--radius-card)*1.4)] border border-line bg-surface p-5 sm:grid-cols-[minmax(0,15rem)_1fr] sm:gap-6 sm:p-8">
        <div className="flex h-16 items-center justify-center sm:h-32">
          <SetLogo logo={logo} name={set.name} priority />
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
          {owned && collectable.length > 0 && (
            <div className="grid max-w-md gap-1.5 pt-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted">Ta progression</span>
                <span className={ownedCount >= collectable.length ? "font-mono font-bold text-lime" : "font-mono font-bold"}>
                  {ownedCount}/{collectable.length}
                </span>
              </div>
              <ProgressBar value={ownedCount} max={collectable.length} label="Complétion du set" />
              <p className="text-xs text-muted">
                {completion ? (
                  <span className="inline-flex items-center gap-1 text-lime">
                    <CheckCircle2 aria-hidden="true" className="size-3.5" />
                    Set complété le {formatDateFr(completion.completedAt)} · bonus de <Jetons value={completion.bonus} /> reçu
                  </span>
                ) : (
                  <>
                    Complète-le pour gagner <Jetons value={bonus} className="text-fg" /> (une fois)
                  </>
                )}
              </p>
            </div>
          )}
          {player && hasBooster && (
            <div className="pt-1">
              <Button asChild size="md">
                <Link href={`/boosters/sets/${set.id}`}>
                  <Sparkles aria-hidden="true" />
                  Booster de ce set · <Jetons value={gameConfig.boosters.setBoosterPrice} />
                </Link>
              </Button>
            </div>
          )}
        </div>
      </header>

      {cards.length === 0 ? (
        <p className="text-muted">Aucune carte importée pour ce set ({plural(set.cardCountTotal, "carte")} attendues).</p>
      ) : (
        <CardGrid cards={cards} owned={owned} lists={lists} />
      )}
    </div>
  );
}
