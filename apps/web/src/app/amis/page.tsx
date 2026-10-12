import { getFriends } from "@pokeflex/server";
import { Users } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AddFriend } from "@/components/social/add-friend";
import { FriendRow, RequestRow } from "@/components/social/friend-rows";
import { getCurrentPlayerSafe } from "@/lib/player";

export const metadata: Metadata = { title: "Amis", robots: { index: false } };

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <section className="grid gap-3">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold">
        {title}
        {count !== undefined && <span className="rounded-full bg-elev px-2 py-0.5 font-mono text-xs text-muted">{count}</span>}
      </h2>
      {children}
    </section>
  );
}

export default async function FriendsPage() {
  const player = await getCurrentPlayerSafe();
  if (!player) redirect("/connexion?suite=/amis");
  const { friends, incoming, outgoing } = await getFriends(player.id);

  return (
    <div className="grid grid-cols-1 gap-8 py-8 sm:py-12">
      <header className="grid gap-4 rounded-[calc(var(--radius-card)*1.4)] border border-line bg-[radial-gradient(110%_130%_at_0%_0%,color-mix(in_srgb,var(--color-lime)_16%,transparent),transparent_60%),var(--color-surface)] p-5 sm:p-7">
        <div className="grid gap-1.5">
          <h1 className="flex items-center gap-2.5 font-display text-2xl font-bold sm:text-3xl">
            <Users aria-hidden="true" className="size-7 text-lime" />
            Amis
          </h1>
          <p className="text-sm text-muted">Ajoute des dresseurs pour comparer vos collections, discuter et vous défier.</p>
        </div>
        <AddFriend />
      </header>

      {incoming.length > 0 && (
        <Section title="Demandes reçues" count={incoming.length}>
          <ul className="grid gap-2">
            {incoming.map((p) => (
              <RequestRow key={p.id} player={p} variant="incoming" />
            ))}
          </ul>
        </Section>
      )}

      <Section title="Mes amis" count={friends.length}>
        {friends.length === 0 ? (
          <div className="grid justify-items-center gap-2 rounded-2xl border border-dashed border-line p-8 text-center">
            <Users aria-hidden="true" className="size-8 text-muted" />
            <p className="text-sm text-muted">Pas encore d&apos;ami. Cherche un dresseur par son pseudo ci-dessus&nbsp;!</p>
          </div>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {friends.map((p) => (
              <FriendRow key={p.id} player={p} />
            ))}
          </ul>
        )}
      </Section>

      {outgoing.length > 0 && (
        <Section title="Demandes envoyées" count={outgoing.length}>
          <ul className="grid gap-2">
            {outgoing.map((p) => (
              <RequestRow key={p.id} player={p} variant="outgoing" />
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
