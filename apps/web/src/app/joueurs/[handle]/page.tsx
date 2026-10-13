import { getProfileWishlist, getPublicProfile } from "@pokeflex/server";
import { CalendarDays, Layers, Pencil, Shield, Store, Trophy, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { CardImage } from "@/components/card-image";
import { CardTile } from "@/components/catalog/card-tile";
import { PlayerAvatar } from "@/components/player-avatar";
import { ProfileActions } from "@/components/social/profile-actions";
import { TIER_ICON, TIER_TEXT } from "@/components/tier-badge";
import { Button } from "@/components/ui/button";
import { frenchSpacing } from "@/lib/format";
import { getCurrentPlayerSafe } from "@/lib/player";
import { cn } from "@/lib/utils";

const load = cache((handle: string, viewerId: string | null) => getPublicProfile(decodeURIComponent(handle), viewerId));

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params;
  const profile = await load(handle, null);
  if (!profile) return { title: "Joueur introuvable" };
  return {
    title: `${profile.player.name} (@${profile.player.handle})`,
    description: profile.bio ?? `Profil et vitrine de ${profile.player.name} sur PokeFlex : ${profile.stats.distinctCards} cartes collectionnées.`,
  };
}

const joined = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
  timeZone: "Europe/Paris",
});

export default async function PlayerPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const viewer = await getCurrentPlayerSafe();
  const profile = await load(handle, viewer?.id ?? null);
  if (!profile) notFound();
  const { player, stats } = profile;
  const isMe = profile.relation === "self";
  const wishlist = await getProfileWishlist(player.id, viewer?.id ?? null);

  const statItems = [
    { icon: Layers, label: "Cartes différentes", value: stats.distinctCards },
    { icon: Trophy, label: "Sets complétés", value: stats.setsCompleted },
    { icon: Store, label: "Ventes au marché", value: stats.sales },
    { icon: Users, label: "Amis", value: stats.friends },
  ];

  return (
    <div className="grid grid-cols-1 gap-8 py-8 sm:py-12">
      <header className="relative grid gap-5 overflow-hidden rounded-[calc(var(--radius-card)*1.4)] border border-line bg-[radial-gradient(120%_140%_at_0%_0%,color-mix(in_srgb,var(--color-accent)_24%,transparent),transparent_60%),radial-gradient(90%_120%_at_100%_100%,color-mix(in_srgb,var(--color-coral)_16%,transparent),transparent_60%),var(--color-surface)] p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <PlayerAvatar name={player.name} image={player.image} size="xl" className="ring-4 ring-bg/60 max-sm:size-16 max-sm:text-xl" />
          <div className="grid min-w-0 flex-1 gap-1.5">
            <h1 className="flex flex-wrap items-center gap-2 font-display text-xl font-bold sm:text-3xl">
              <span className="min-w-0 [overflow-wrap:anywhere]">{player.name}</span>
              {profile.guild && (
                <Link
                  href={`/guildes/${profile.guild.id}`}
                  className="rounded-md border border-accent/50 bg-accent/10 px-1.5 py-0.5 font-mono text-xs text-accent hover:bg-accent/20"
                  title={profile.guild.name}
                >
                  [{profile.guild.tag}]
                </Link>
              )}
            </h1>
            <p className="text-sm text-muted">@{player.handle}</p>
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays aria-hidden="true" className="size-3.5" />
                Dresseur depuis {joined.format(new Date(profile.joinedAt))}
              </span>
              {profile.guild && (
                <span className="inline-flex items-center gap-1.5">
                  <Shield aria-hidden="true" className="size-3.5" />
                  {profile.guild.name}
                </span>
              )}
            </p>
          </div>
          {isMe ? (
            <Button asChild variant="secondary" size="sm" className="max-sm:w-full">
              <Link href="/profil">
                <Pencil aria-hidden="true" />
                Modifier mon profil
              </Link>
            </Button>
          ) : viewer && profile.relation ? (
            <ProfileActions
              target={{
                id: player.id,
                name: player.name,
                handle: player.handle!,
              }}
              relation={profile.relation}
            />
          ) : (
            <Button asChild size="sm">
              <Link href={`/connexion?suite=/joueurs/${player.handle}`}>Se connecter pour l&apos;ajouter</Link>
            </Button>
          )}
        </div>
        {profile.bio && <p className="max-w-[65ch] text-sm whitespace-pre-line">{frenchSpacing(profile.bio)}</p>}
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {statItems.map(({ icon: Icon, label, value }) => (
            <div key={label} className="grid gap-0.5 rounded-xl border border-line bg-bg/60 px-3 py-2.5">
              <dt className="flex items-center gap-1.5 text-[11px] text-muted">
                <Icon aria-hidden="true" className="size-3.5" />
                {label}
              </dt>
              <dd className="font-display text-xl font-bold font-tabular">
                {value.toLocaleString("fr-FR")}
              </dd>
            </div>
          ))}
        </dl>
      </header>

      <section className="grid gap-4" aria-labelledby="vitrine">
        <div className="flex items-end justify-between gap-3">
          <h2 id="vitrine" className="font-display text-lg font-bold">
            Vitrine
          </h2>
          {isMe && (
            <Link href="/profil#vitrine" className="text-sm text-accent hover:underline">
              Choisir mes cartes
            </Link>
          )}
        </div>
        {profile.showcase.length === 0 ? (
          <div className="grid justify-items-center gap-2 rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">
            {isMe ? "Ta vitrine est vide : mets en avant tes plus belles cartes\u00a0!" : `${player.name} n'a pas encore garni sa vitrine.`}
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {profile.showcase.map((c) => (
              <li key={c.id}>
                <Link href={`/cartes/${c.id}`} className="group grid gap-2">
                  <div className="transition-transform duration-300 group-hover:-translate-y-1 group-hover:rotate-[-1deg]">
                    <CardImage image={c.image} name={c.name} className="rounded-[var(--radius-card)] shadow-[0_14px_30px_-14px_rgb(0_0_0/0.8)]" />
                  </div>
                  <span className="grid gap-0.5 text-xs">
                    <span className="truncate font-semibold">{c.name}</span>
                    <span className={cn("truncate", TIER_TEXT[c.tier])}>
                      <span aria-hidden="true">{TIER_ICON[c.tier]}</span> {c.setName}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {wishlist && (wishlist.total > 0 || isMe) && (
        <section className="grid gap-4" aria-labelledby="wishlist">
          <div className="flex items-end justify-between gap-3">
            <h2 id="wishlist" className="font-display text-lg font-bold">
              Wishlist <span className="font-mono text-sm font-normal text-muted">{wishlist.total}</span>
            </h2>
            {isMe && (
              <Link href="/collection?vue=wishlist" className="text-sm text-accent hover:underline">
                Gérer ma wishlist
              </Link>
            )}
          </div>
          {wishlist.total === 0 ? (
            <div className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">
              Ta wishlist est vide : ajoute les cartes que tu cherches depuis leur fiche.
            </div>
          ) : (
            <ul className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-6">
              {wishlist.cards.map((c) => (
                <li key={c.id}>
                  <CardTile card={c} subtitle={c.setName} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
