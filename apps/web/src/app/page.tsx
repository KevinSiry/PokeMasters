import { gameConfig, TIERS } from "@pokeflex/config";
import { Layers, Swords, Sparkles } from "lucide-react";
import Link from "next/link";
import { TierBadge } from "@/components/tier-badge";
import { TiltCard } from "@/components/tilt-card";
import { Button } from "@/components/ui/button";
import { getCurrentPlayerSafe } from "@/lib/player";

// Trois cartes du Set de Base (1999), servies par le CDN TCGdex.
const HERO_CARDS = [
  { image: "https://assets.tcgdex.net/fr/base/base1/15", name: "Florizarre, Set de Base", tier: "epic" },
  { image: "https://assets.tcgdex.net/fr/base/base1/4", name: "Dracaufeu, Set de Base", tier: "mythic" },
  { image: "https://assets.tcgdex.net/fr/base/base1/2", name: "Tortank, Set de Base", tier: "legendary" },
] as const;

const minutes = gameConfig.boosters.refillIntervalMs / 60_000;

const STEPS = [
  {
    icon: Sparkles,
    title: "Ouvre",
    body: `Un booster de ${gameConfig.boosters.size} cartes toutes les ${minutes} minutes, jusqu'à ${gameConfig.boosters.maxStock} en réserve. Au moins une Peu commune garantie.`,
  },
  {
    icon: Layers,
    title: "Collectionne",
    body: "Toutes les cartes sorties depuis 1999, rangées par série et par set. Complète ton Pokédex de cartes, chasse les reverse et les holos.",
  },
  {
    icon: Swords,
    title: "Échange et affronte",
    body: "Revends tes doubles contre des Jetons au marché, et mise tes cartes en duel de quiz contre d'autres joueurs.",
  },
] as const;

export default async function HomePage() {
  const player = await getCurrentPlayerSafe();

  return (
    <>
      <section className="grid items-center gap-10 py-10 sm:py-16 lg:grid-cols-[1.05fr_1fr]">
        <div className="grid gap-6">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">Fan game · gratuit · sans pub</p>
          <h1 className="font-display text-[clamp(2rem,6vw,3.6rem)] leading-[1.05] font-bold tracking-tight">
            Toutes les cartes depuis 1999. <span className="text-prism">Un booster toutes les {minutes} minutes.</span>
          </h1>
          <p className="max-w-[52ch] text-lg leading-relaxed text-muted">
            Ouvre, collectionne et échange les vraies cartes du jeu, du Set de Base aux séries les plus récentes.
          </p>
          <div className="flex flex-wrap gap-3">
            {player ? (
              <Button size="lg" disabled title="L'ouverture des boosters arrive à la phase 3">
                Ouvrir un booster
              </Button>
            ) : (
              <Button asChild size="lg">
                <Link href="/connexion">Commencer à collectionner</Link>
              </Button>
            )}
            <Button asChild size="lg" variant="secondary">
              <Link href="/a-propos">Comment ça marche</Link>
            </Button>
          </div>
          {player && (
            <p className="text-sm text-muted">
              Salut {player.displayName}. Tu as{" "}
              <strong className="text-fg">
                {player.boosters.available} booster{player.boosters.available > 1 ? "s" : ""}
              </strong>{" "}
              en réserve. L&apos;ouverture arrive avec la prochaine mise à jour.
            </p>
          )}
        </div>

        <div className="relative mx-auto flex w-full max-w-md items-end justify-center py-6" aria-label="Exemples de cartes">
          {HERO_CARDS.map((c, i) => (
            <div
              key={c.image}
              className={
                i === 1
                  ? "relative z-10 w-[46%] -translate-y-4"
                  : `w-[38%] ${i === 0 ? "translate-x-6 -rotate-[9deg]" : "-translate-x-6 rotate-[9deg]"}`
              }
            >
              <TiltCard image={c.image} name={c.name} tier={c.tier} priority />
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="etapes" className="grid gap-6 py-8">
        <h2 id="etapes" className="sr-only">
          Comment on joue
        </h2>
        <ol className="grid gap-4 md:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, body }) => (
            <li key={title} className="grid content-start gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-6">
              <span className="grid size-10 place-items-center rounded-full bg-elev text-coral" aria-hidden="true">
                <Icon className="size-5" />
              </span>
              <h3 className="font-display text-lg font-bold">{title}</h3>
              <p className="leading-relaxed text-muted">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="tiers" className="grid gap-4 py-8">
        <h2 id="tiers" className="font-display text-xl font-bold">
          Six tiers de rareté
        </h2>
        <p className="max-w-[60ch] text-muted">
          Calculés à partir de la rareté officielle de chaque carte. Plus le tier est haut, plus le reflet holo est
          intense.
        </p>
        <ul className="flex flex-wrap gap-2">
          {TIERS.map((t) => (
            <li key={t}>
              <TierBadge tier={t} />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
