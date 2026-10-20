import { gameConfig } from "@pokeflex/config";
import { getGuildSummary, getMyGuildId, listGuilds } from "@pokeflex/server";
import { ChevronRight, Search, Shield, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Jetons } from "@/components/jetons";
import { CreateGuild } from "@/components/social/create-guild";
import { firstParam } from "@/lib/params";
import { getCurrentPlayerSafe } from "@/lib/player";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = {
  title: "Guildes",
  description: "Rejoins une guilde de collectionneurs PokeFlex et discute avec elle en direct.",
};

export default async function GuildsPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const q = firstParam((await searchParams).q, "", 60);
  const player = await getCurrentPlayerSafe();
  const [guilds, myGuildId] = await Promise.all([listGuilds(q), player ? getMyGuildId(player.id) : Promise.resolve(null)]);
  // Ma guilde, même si elle n'est pas parmi les 30 premières affichées.
  const mine = myGuildId ? (guilds.find((g) => g.id === myGuildId) ?? (await getGuildSummary(myGuildId))) : null;

  return (
    <div className="grid grid-cols-1 gap-8 py-8 sm:py-12">
      <header className="grid gap-4 rounded-[calc(var(--radius-card)*1.4)] border border-line bg-[radial-gradient(110%_130%_at_100%_0%,color-mix(in_srgb,var(--color-accent)_22%,transparent),transparent_60%),var(--color-surface)] p-5 sm:grid-cols-[1fr_auto] sm:items-end sm:p-7">
        <div className="grid gap-1.5">
          <h1 className="flex items-center gap-2.5 font-display text-2xl font-bold sm:text-3xl">
            <Shield aria-hidden="true" className="size-7 text-accent" />
            Guildes
          </h1>
          <p className="max-w-[60ch] text-sm text-muted">
            Jusqu&apos;à {gameConfig.social.guildMaxMembers} dresseurs par guilde, un chat en direct et un sigle à côté de ton nom. Fonder une guilde coûte{" "}
            <Jetons value={gameConfig.social.guildCreationCost} className="text-fg" />.
          </p>
        </div>
        {player && !myGuildId && <CreateGuild cost={gameConfig.social.guildCreationCost} balance={player.balance} />}
      </header>

      {mine && (
        <Link
          href={`/guildes/${mine.id}`}
          className="flex items-center gap-4 rounded-2xl border border-accent/60 bg-accent/10 p-4 transition-colors hover:bg-accent/15"
        >
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-bg font-mono text-sm font-bold text-accent">{mine.tag}</span>
          <span className="grid min-w-0 flex-1">
            <span className="text-xs text-muted">Ma guilde</span>
            <span className="truncate font-display text-lg font-bold">{mine.name}</span>
          </span>
          <span className="text-sm text-muted">Ouvrir le chat</span>
          <ChevronRight aria-hidden="true" className="size-5 text-muted" />
        </Link>
      )}

      <section className="grid gap-3" aria-labelledby="toutes">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="toutes" className="font-display text-lg font-bold">
            Toutes les guildes
          </h2>
          <form className="relative w-full sm:w-72">
            <label htmlFor="q" className="sr-only">
              Chercher une guilde
            </label>
            <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <input
              id="q"
              name="q"
              defaultValue={q}
              placeholder="Nom ou sigle…"
              className="h-11 w-full rounded-xl border border-line bg-bg pr-3 pl-9 text-base outline-none focus:border-accent sm:text-sm"
            />
          </form>
        </div>
        {guilds.length === 0 ? (
          <EmptyState icon={<Shield />} title={q ? "Aucune guilde ne correspond." : "Aucune guilde pour l'instant"}>
            {q ? "Essaie un autre nom ou un autre sigle." : "Fonde la première\u00a0!"}
          </EmptyState>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-3">
            {guilds.map((g) => {
              const full = g.members >= gameConfig.social.guildMaxMembers;
              return (
                <li key={g.id}>
                  <Link
                    href={`/guildes/${g.id}`}
                    className="flex h-full items-center gap-3 rounded-2xl border border-line bg-surface p-3.5 transition-colors hover:border-accent"
                  >
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-elev font-mono text-xs font-bold text-accent">{g.tag}</span>
                    <span className="grid min-w-0 flex-1 gap-0.5">
                      <span className="truncate font-semibold">{g.name}</span>
                      {g.description && <span className="line-clamp-1 text-xs text-muted">{g.description}</span>}
                    </span>
                    <span className={cn("inline-flex shrink-0 items-center gap-1 font-mono text-xs", full ? "text-coral" : "text-muted")}>
                      <Users aria-hidden="true" className="size-3.5" />
                      {g.members}/{gameConfig.social.guildMaxMembers}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
