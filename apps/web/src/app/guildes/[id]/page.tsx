import { gameConfig } from "@pokeflex/config";
import { getGuild, getGuildMessages, getMyGuildId } from "@pokeflex/server";
import { Layers, Users } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { BackLink } from "@/components/back-link";
import { GuildActions } from "@/components/social/guild-actions";
import { GuildChat } from "@/components/social/guild-chat";
import { GuildMembers } from "@/components/social/guild-members";
import { frenchSpacing } from "@/lib/format";
import { getCurrentPlayerSafe } from "@/lib/player";

const load = cache((id: string) => getGuild(id));

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const g = await load((await params).id);
  return g
    ? {
        title: `[${g.tag}] ${g.name}`,
        description: g.description ?? `Guilde PokeFlex de ${g.members.length} dresseurs.`,
      }
    : { title: "Guilde introuvable" };
}

export default async function GuildPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [guild, player] = await Promise.all([load(id), getCurrentPlayerSafe()]);
  if (!guild) notFound();
  const myGuildId = player ? await getMyGuildId(player.id) : null;
  const me = player ? guild.members.find((m) => m.id === player.id) : undefined;
  const messages = me ? await getGuildMessages(guild.id) : [];

  return (
    <div className="grid grid-cols-1 gap-6 py-6 sm:py-10">
      <BackLink href="/guildes" />
      <header className="grid gap-4 rounded-[calc(var(--radius-card)*1.4)] border border-line bg-[radial-gradient(110%_130%_at_0%_0%,color-mix(in_srgb,var(--color-accent)_24%,transparent),transparent_60%),var(--color-surface)] p-5 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:p-7">
        <span className="grid size-16 place-items-center rounded-2xl border border-accent/50 bg-bg font-mono text-lg font-bold text-accent">{guild.tag}</span>
        <div className="grid gap-1.5">
          <h1 className="font-display text-2xl font-bold sm:text-3xl">{guild.name}</h1>
          {guild.description && <p className="max-w-[65ch] text-sm whitespace-pre-line text-muted">{frenchSpacing(guild.description)}</p>}
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            <span className="inline-flex items-center gap-1.5">
              <Users aria-hidden="true" className="size-3.5" />
              {guild.members.length}/{guild.maxMembers} membres
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Layers aria-hidden="true" className="size-3.5" />
              {guild.totalCards.toLocaleString("fr-FR")} cartes différentes à eux tous
            </span>
          </p>
        </div>
        <GuildActions
          guildId={guild.id}
          me={player?.id ?? null}
          role={me?.role ?? null}
          inOtherGuild={Boolean(myGuildId && myGuildId !== guild.id)}
          full={guild.members.length >= guild.maxMembers}
          alone={guild.members.length === 1}
          description={guild.description ?? ""}
        />
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {me && player ? (
          <section
            className="flex h-[min(70dvh,640px)] min-h-[380px] flex-col overflow-hidden rounded-[calc(var(--radius-card)*1.2)] border border-line bg-surface"
            aria-label="Chat de la guilde"
          >
            <h2 className="border-b border-line px-4 py-3 font-display font-bold">Chat de la guilde</h2>
            <GuildChat me={player.id} initial={messages} maxLength={gameConfig.social.messageMaxLength} />
          </section>
        ) : (
          <section className="grid place-items-center rounded-[calc(var(--radius-card)*1.2)] border border-dashed border-line p-8 text-center text-sm text-muted">
            Le chat est réservé aux membres de la guilde.
          </section>
        )}
        <GuildMembers guildId={guild.id} members={guild.members} me={player?.id ?? null} myRole={me?.role ?? null} />
      </div>
    </div>
  );
}
