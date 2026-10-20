import { gameConfig } from "@pokeflex/config";
import { ArrowRight, BookOpen, Sparkles } from "lucide-react";
import Link from "next/link";
import { BoosterPackArt } from "@/components/booster/booster-pack";
import { CardTile } from "@/components/catalog/card-tile";
import { ProgressRing } from "@/components/progress";
import { Button } from "@/components/ui/button";
import { QuestsPanel } from "@/components/economy/quests-panel";
import { getCollectionTotals, getRecentPulls } from "@/lib/collection";
import { getDailyQuests, getPackCover } from "@pokeflex/server";
import type { CurrentPlayer } from "@/lib/player";
import { HomeBoosterStatus } from "./home-booster-status";

/** Accueil d'un joueur connecté : son booster, sa progression, ses dernières cartes. */
export async function PlayerHome({ player }: { player: CurrentPlayer }) {
  const [totals, recent, daily, cover] = await Promise.all([
    getCollectionTotals(player.id),
    getRecentPulls(player.id),
    getDailyQuests(player.id),
    getPackCover(),
  ]);
  const has = player.boosters.available > 0;

  return (
    <div className="grid grid-cols-1 gap-8 py-8 sm:py-12">
      <h1 className="font-display text-[clamp(1.6rem,4.5vw,2.4rem)] leading-tight font-bold">
        Salut <span className="text-prism">{player.displayName}</span>
      </h1>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Link
          href="/boosters"
          className="group relative grid grid-cols-[auto_1fr] items-center gap-5 overflow-hidden rounded-[calc(var(--radius-card)*1.4)] border border-line bg-[radial-gradient(120%_120%_at_0%_0%,color-mix(in_srgb,var(--color-accent)_28%,transparent),transparent_60%),var(--color-surface)] p-5 transition-colors hover:border-accent sm:p-7"
        >
          <div className="w-24 transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-105 sm:w-32">
            <BoosterPackArt empty={!has} cover={cover} coverQuality="low" />
          </div>
          <div className="grid gap-3">
            <p className="font-mono text-xs tracking-[0.16em] text-muted uppercase">Booster gratuit</p>
            <HomeBoosterStatus
              available={player.boosters.available}
              nextAt={player.boosters.nextAt}
              maxStock={player.boosters.maxStock}
              refillIntervalMs={gameConfig.boosters.refillIntervalMs}
            />
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent">
              {has ? "Ouvrir maintenant" : "Voir le minuteur"}
              <ArrowRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-1" />
            </span>
          </div>
        </Link>

        <Link
          href="/collection"
          className="group grid grid-cols-[auto_1fr] items-center gap-5 rounded-[calc(var(--radius-card)*1.4)] border border-line bg-surface p-5 transition-colors hover:border-accent sm:p-7"
        >
          <ProgressRing percent={totals.percent} size={96} label="Complétion du catalogue" />
          <div className="grid gap-1">
            <p className="font-mono text-xs tracking-[0.16em] text-muted uppercase">Ta collection</p>
            <p className="font-display text-xl font-bold font-tabular">
              {totals.unique.toLocaleString("fr-FR")}
              <span className="text-sm text-muted"> / {totals.catalog.toLocaleString("fr-FR")} cartes</span>
            </p>
            <p className="text-sm text-muted">
              {totals.copies.toLocaleString("fr-FR")} exemplaires · {totals.setsCompleted} set{totals.setsCompleted > 1 ? "s" : ""} complété
              {totals.setsCompleted > 1 ? "s" : ""}
            </p>
          </div>
        </Link>
      </div>

      <QuestsPanel quests={daily.quests} resetAt={daily.resetAt} />

      <section aria-labelledby="recent" className="grid min-w-0 gap-4">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="recent" className="font-display text-xl font-bold">
            Tes dernières cartes
          </h2>
          {recent.length > 0 && (
            <Link href="/collection?vue=cartes" className="text-sm font-semibold text-accent hover:underline">
              Tout voir
            </Link>
          )}
        </div>
        {recent.length === 0 ? (
          <div className="grid justify-items-start gap-3 rounded-[var(--radius-card)] border border-dashed border-line p-6">
            <p className="text-muted">Tu n&apos;as encore aucune carte. Ton premier booster t&apos;attend.</p>
            <Button asChild>
              <Link href="/boosters">
                <Sparkles aria-hidden="true" />
                Ouvrir mon premier booster
              </Link>
            </Button>
          </div>
        ) : (
          <ul className="pf-scroll-x pf-bleed flex snap-x gap-3 pb-2">
            {recent.map((c) => (
              <li key={c.copyId} className="w-28 shrink-0 snap-start sm:w-36">
                <CardTile card={c} subtitle={c.setName} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link
        href="/catalogue"
        className="flex items-center gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-5 transition-colors hover:border-accent"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-elev text-coral" aria-hidden="true">
          <BookOpen className="size-5" />
        </span>
        <span className="grid flex-1 gap-0.5">
          <span className="font-semibold">Explorer le catalogue</span>
          <span className="text-sm text-muted">Toutes les séries depuis 1999, set par set.</span>
        </span>
        <ArrowRight aria-hidden="true" className="size-5 text-muted" />
      </Link>
    </div>
  );
}
