import { gameConfig } from "@pokeflex/config";
import { expireDuels, getMyDuels, type DuelSummary } from "@pokeflex/server";
import { Swords, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ChallengeRow } from "@/components/duel/challenge-row";
import { DuelModes } from "@/components/duel/duel-modes";
import { Jetons } from "@/components/jetons";
import { getCurrentPlayerSafe } from "@/lib/player";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Duels",
  description: "Duels quiz en temps réel sur les cartes Pokémon : mise 3 cartes, réponds plus vite et plus juste que ton adversaire.",
};

const RESULT = {
  win: { label: "Victoire", className: "bg-lime/15 text-lime" },
  draw: { label: "Égalité", className: "bg-accent/15 text-accent" },
  loss: { label: "Défaite", className: "bg-coral/15 text-coral" },
} as const;

const when = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3">
      <h2 className="font-display text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

function HistoryRow({ d }: { d: DuelSummary }) {
  const r = d.result ? RESULT[d.result] : null;
  return (
    <li>
      <Link
        href={`/duels/${d.id}`}
        className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 transition-colors hover:border-accent"
      >
        {r && <span className={cn("w-20 shrink-0 rounded-full px-2 py-1 text-center text-xs font-bold", r.className)}>{r.label}</span>}
        <span className="min-w-0 flex-1 truncate text-sm">
          contre <strong>{d.opponent?.name ?? "?"}</strong>
          <span className="block text-xs text-muted">{when.format(new Date(d.createdAt))}</span>
        </span>
        <span className="font-mono text-sm font-tabular">
          {d.myScore} – {d.theirScore}
        </span>
        {d.reward ? <Jetons value={d.reward} signed className="w-14 justify-end text-sm text-[#FFC93C]" /> : <span className="w-14" />}
      </Link>
    </li>
  );
}

export default async function DuelsPage() {
  const player = await getCurrentPlayerSafe();
  if (!player) redirect("/connexion?suite=/duels");
  await expireDuels();
  const mine = await getMyDuels(player.id);
  const played = mine.stats.wins + mine.stats.draws + mine.stats.losses;

  return (
    <div className="grid grid-cols-1 gap-8 py-8 sm:py-12">
      <header className="grid gap-4 rounded-[calc(var(--radius-card)*1.4)] border border-line bg-[radial-gradient(110%_130%_at_0%_0%,color-mix(in_srgb,var(--color-accent)_26%,transparent),transparent_60%),radial-gradient(90%_120%_at_100%_100%,color-mix(in_srgb,var(--color-coral)_18%,transparent),transparent_60%),var(--color-surface)] p-5 sm:grid-cols-[1fr_auto] sm:items-end sm:p-7">
        <div className="grid gap-2">
          <h1 className="flex items-center gap-2.5 font-display text-2xl font-bold sm:text-3xl">
            <Swords aria-hidden="true" className="size-7 text-accent" />
            Duels quiz
          </h1>
          <p className="max-w-[60ch] text-sm text-muted">
            {gameConfig.duels.questionCount} questions sur les cartes misées, {gameConfig.duels.questionTimeMs / 1000} secondes chacune.{" "}
            {gameConfig.duels.pointsPerCorrect} points par bonne réponse, jusqu&apos;à {gameConfig.duels.maxSpeedBonus} de bonus si tu es rapide. Tes cartes te
            reviennent toujours.
          </p>
          <p className="text-xs text-muted">
            Victoire <Jetons value={gameConfig.duels.rewards.win} className="text-fg" /> · égalité{" "}
            <Jetons value={gameConfig.duels.rewards.draw} className="text-fg" /> · défaite <Jetons value={gameConfig.duels.rewards.loss} className="text-fg" /> ·{" "}
            {Math.max(0, mine.rewardedCap - mine.rewardedToday)} duel{mine.rewardedCap - mine.rewardedToday > 1 ? "s" : ""} récompensé
            {mine.rewardedCap - mine.rewardedToday > 1 ? "s" : ""} restant{mine.rewardedCap - mine.rewardedToday > 1 ? "s" : ""} aujourd&apos;hui
          </p>
        </div>
        {played > 0 && (
          <dl className="grid grid-cols-3 gap-2 text-center">
            {(
              [
                ["Victoires", mine.stats.wins, "text-lime"],
                ["Égalités", mine.stats.draws, "text-accent"],
                ["Défaites", mine.stats.losses, "text-coral"],
              ] as const
            ).map(([label, n, color]) => (
              <div key={label} className="rounded-xl border border-line bg-bg/60 px-3 py-2">
                <dt className="text-[11px] text-muted">{label}</dt>
                <dd className={cn("font-display text-xl font-bold", color)}>{n}</dd>
              </div>
            ))}
          </dl>
        )}
      </header>

      {mine.incoming.length > 0 && (
        <Section title="Défis reçus">
          <ul className="grid gap-2">
            {mine.incoming.map((d) => (
              <ChallengeRow key={d.id} duel={d} variant="incoming" />
            ))}
          </ul>
        </Section>
      )}

      {mine.ready.length > 0 && (
        <Section title="Duels prêts">
          <ul className="grid gap-2">
            {mine.ready.map((d) => (
              <ChallengeRow key={d.id} duel={d} variant="ready" />
            ))}
          </ul>
        </Section>
      )}

      <Section title="Jouer">
        <Suspense>
          <DuelModes />
        </Suspense>
      </Section>

      {mine.outgoing.length > 0 && (
        <Section title="Défis envoyés">
          <ul className="grid gap-2">
            {mine.outgoing.map((d) => (
              <ChallengeRow key={d.id} duel={d} variant="outgoing" />
            ))}
          </ul>
        </Section>
      )}

      <Section title="Derniers duels">
        {mine.history.length === 0 ? (
          <div className="grid justify-items-center gap-2 rounded-2xl border border-dashed border-line p-8 text-center">
            <Trophy aria-hidden="true" className="size-8 text-muted" />
            <p className="text-sm text-muted">Pas encore de duel. Lance un entraînement pour te faire la main !</p>
          </div>
        ) : (
          <ul className="grid gap-2">
            {mine.history.map((d) => (
              <HistoryRow key={d.id} d={d} />
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
