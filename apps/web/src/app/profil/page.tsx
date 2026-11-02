import { gameConfig, MEDAL_LEVEL_LABELS_FR } from "@pokeflex/config";
import { getBlocked, getPublicProfile, syncMedals } from "@pokeflex/server";
import { ArrowUpRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MedalGrid } from "@/components/medals/medal-grid";
import { Jetons } from "@/components/jetons";
import { BlockedList } from "@/components/social/blocked-list";
import { ProfileForm } from "@/components/social/profile-form";
import { ShowcaseEditor } from "@/components/social/showcase-editor";
import { getCurrentPlayerSafe } from "@/lib/player";

export const metadata: Metadata = {
  title: "Mon profil",
  robots: { index: false },
};

export default async function ProfilePage() {
  const player = await getCurrentPlayerSafe();
  if (!player) redirect("/connexion?suite=/profil");
  const [profile, blocked, medals] = await Promise.all([getPublicProfile(player.handle, player.id), getBlocked(player.id), syncMedals(player.id)]);
  if (!profile) redirect("/");

  return (
    <div className="grid grid-cols-1 gap-8 py-8 sm:py-12">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Mon profil</h1>
          <p className="text-sm text-muted">Ce que les autres dresseurs voient de toi.</p>
        </div>
        <Link href={`/joueurs/${player.handle}`} className="pf-hit relative inline-flex w-fit items-center gap-1 text-sm text-accent hover:underline">
          Voir mon profil public
          <ArrowUpRight aria-hidden="true" className="size-4" />
        </Link>
      </header>

      <ProfileForm
        handle={player.handle}
        bio={profile.bio ?? ""}
        rules={{
          min: gameConfig.social.handleMinLength,
          max: gameConfig.social.handleMaxLength,
          bio: gameConfig.social.bioMaxLength,
        }}
      />

      <section id="medailles" aria-labelledby="medailles-titre" className="grid scroll-mt-24 gap-4">
        <div className="grid gap-1">
          <h2 id="medailles-titre" className="font-display text-lg font-bold">
            Médailles <span className="font-mono text-sm font-normal text-muted">{medals.medals.reduce((n, m) => n + m.level, 0)}/{medals.medals.length * 3}</span>
          </h2>
          <p className="text-sm text-muted">Bronze, argent puis or : chaque palier rapporte des Jetons, une fois.</p>
        </div>
        {medals.awarded.length > 0 && (
          <ul role="status" className="grid gap-1.5 rounded-2xl border border-[#FFC93C]/60 bg-[#FFC93C]/5 p-3 text-sm">
            {medals.awarded.map((a) => (
              <li key={`${a.medalId}:${a.level}`} className="flex flex-wrap items-center gap-x-2">
                <span className="font-semibold">Nouvelle médaille</span>
                <span>
                  {a.label} · {MEDAL_LEVEL_LABELS_FR[a.level]}
                </span>
                <Jetons value={a.reward} signed className="text-xs text-[#FFC93C]" />
              </li>
            ))}
          </ul>
        )}
        <MedalGrid medals={medals.medals} mine fresh={medals.awarded.map((a) => a.medalId)} />
      </section>

      <ShowcaseEditor initial={profile.showcase} max={gameConfig.social.showcaseSize} />

      <BlockedList players={blocked} />
    </div>
  );
}
