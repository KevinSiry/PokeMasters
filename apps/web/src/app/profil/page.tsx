import { gameConfig } from "@pokeflex/config";
import { getBlocked, getPublicProfile } from "@pokeflex/server";
import { ArrowUpRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
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
  const [profile, blocked] = await Promise.all([getPublicProfile(player.handle, player.id), getBlocked(player.id)]);
  if (!profile) redirect("/");

  return (
    <div className="grid grid-cols-1 gap-8 py-8 sm:py-12">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Mon profil</h1>
          <p className="text-sm text-muted">Ce que les autres dresseurs voient de toi.</p>
        </div>
        <Link href={`/joueurs/${player.handle}`} className="inline-flex items-center gap-1 text-sm text-accent hover:underline">
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

      <ShowcaseEditor initial={profile.showcase} max={gameConfig.social.showcaseSize} />

      <BlockedList players={blocked} />
    </div>
  );
}
