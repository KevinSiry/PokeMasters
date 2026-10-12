import { getLeaderboard, LEADERBOARD_KINDS, type LeaderboardEntry, type LeaderboardKind } from "@pokeflex/server";
import { Crown, Layers, Swords, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PlayerAvatar } from "@/components/player-avatar";
import { getCurrentPlayerSafe } from "@/lib/player";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Classements",
  description: "Les meilleurs dresseurs de PokeFlex : plus grandes collections, sets complétés et victoires en duel.",
};

const KINDS: Record<
  LeaderboardKind,
  {
    label: string;
    unit: (n: number) => string;
    icon: typeof Trophy;
    blurb: string;
  }
> = {
  collection: {
    label: "Collection",
    unit: (n) => `carte${n > 1 ? "s" : ""}`,
    icon: Layers,
    blurb: "Cartes différentes possédées.",
  },
  sets: {
    label: "Sets",
    unit: (n) => `set${n > 1 ? "s" : ""}`,
    icon: Trophy,
    blurb: "Sets entièrement complétés.",
  },
  duels: {
    label: "Duels",
    unit: (n) => `victoire${n > 1 ? "s" : ""}`,
    icon: Swords,
    blurb: "Victoires en duel (hors entraînement).",
  },
};

const hour = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

const PODIUM = [
  { place: 2, height: "h-20", ring: "ring-[#C9D3E6]", text: "text-[#C9D3E6]" },
  { place: 1, height: "h-28", ring: "ring-[#FFC93C]", text: "text-[#FFC93C]" },
  { place: 3, height: "h-14", ring: "ring-[#E39B5B]", text: "text-[#E39B5B]" },
] as const;

function Podium({ entries, kind }: { entries: LeaderboardEntry[]; kind: LeaderboardKind }) {
  return (
    <ol className="grid grid-cols-3 items-end gap-2 sm:gap-4" aria-label="Podium">
      {PODIUM.map(({ place, height, ring, text }) => {
        const e = entries[place - 1];
        return (
          <li key={place} className={cn("grid justify-items-center gap-2 text-center", place === 1 ? "order-2" : place === 2 ? "order-1" : "order-3")}>
            {e ? (
              <Link href={`/joueurs/${e.handle}`} className="grid min-w-0 justify-items-center gap-1.5">
                {place === 1 && <Crown aria-hidden="true" className="size-6 text-[#FFC93C]" />}
                <PlayerAvatar name={e.name} image={e.image} size={place === 1 ? "lg" : "md"} className={cn("ring-4", ring)} />
                <span className="w-full truncate text-sm font-semibold">{e.name}</span>
                <span className="font-mono text-xs text-muted">
                  {e.value.toLocaleString("fr-FR")} {KINDS[kind].unit(e.value)}
                </span>
              </Link>
            ) : (
              <span className="text-xs text-muted">—</span>
            )}
            <div
              className={cn("grid w-full place-items-center rounded-t-xl border border-b-0 border-line bg-elev font-display text-2xl font-bold", height, text)}
            >
              {place}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default async function LeaderboardsPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams;
  const kind: LeaderboardKind = (LEADERBOARD_KINDS as readonly string[]).includes(type ?? "") ? (type as LeaderboardKind) : "collection";
  const [board, player] = await Promise.all([getLeaderboard(kind), getCurrentPlayerSafe()]);
  const mine = player ? board.entries.find((e) => e.id === player.id) : undefined;
  const meta = KINDS[kind];

  return (
    <div className="grid grid-cols-1 gap-8 py-8 sm:py-12">
      <header className="grid gap-4">
        <div className="grid gap-1.5">
          <h1 className="flex items-center gap-2.5 font-display text-2xl font-bold sm:text-3xl">
            <Trophy aria-hidden="true" className="size-7 text-[#FFC93C]" />
            Classements
          </h1>
          <p className="text-sm text-muted">
            {meta.blurb} Mis à jour toutes les heures (dernier calcul à {hour.format(new Date(board.takenAt))}).
          </p>
        </div>
        <nav aria-label="Catégories" className="flex gap-1 rounded-full border border-line bg-surface p-1 sm:w-fit">
          {LEADERBOARD_KINDS.map((k) => {
            const Icon = KINDS[k].icon;
            const active = k === kind;
            return (
              <Link
                key={k}
                href={k === "collection" ? "/classements" : `/classements?type=${k}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                  active ? "bg-gradient-to-r from-accent-strong to-coral-strong text-fg" : "text-muted hover:text-fg",
                )}
              >
                <Icon aria-hidden="true" className="size-4" />
                {KINDS[k].label}
              </Link>
            );
          })}
        </nav>
      </header>

      {board.entries.length === 0 ? (
        <div className="grid justify-items-center gap-2 rounded-2xl border border-dashed border-line p-10 text-center text-sm text-muted">
          <Trophy aria-hidden="true" className="size-8" />
          Personne n&apos;est encore classé ici. La première place est à prendre&nbsp;!
        </div>
      ) : (
        <>
          <Podium entries={board.entries} kind={kind} />

          {player && (
            <p className={cn("rounded-2xl border p-4 text-sm", mine ? "border-accent/60 bg-accent/10" : "border-line bg-surface text-muted")}>
              {mine ? (
                <>
                  Tu es{" "}
                  <strong className="font-display text-lg text-fg">
                    {mine.rank}
                    <sup>{mine.rank === 1 ? "er" : "e"}</sup>
                  </strong>{" "}
                  avec {mine.value.toLocaleString("fr-FR")} {meta.unit(mine.value)}.
                </>
              ) : (
                `Tu n'es pas encore dans les ${board.entries.length >= 100 ? "100 premiers" : "classés"} : à toi de jouer\u00a0!`
              )}
            </p>
          )}

          {board.entries.length > 3 && (
            <ol className="grid gap-1.5" start={4}>
              {board.entries.slice(3).map((e) => (
                <li key={e.id}>
                  <Link
                    href={`/joueurs/${e.handle}`}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition-colors hover:border-accent",
                      e.id === player?.id ? "border-accent/60 bg-accent/10" : "border-line bg-surface",
                    )}
                  >
                    <span className="w-8 text-center font-mono text-sm text-muted">{e.rank}</span>
                    <PlayerAvatar name={e.name} image={e.image} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                      {e.name}
                      <span className="ml-1.5 font-normal text-muted">@{e.handle}</span>
                    </span>
                    <span className="font-mono text-sm font-tabular">{e.value.toLocaleString("fr-FR")}</span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  );
}
