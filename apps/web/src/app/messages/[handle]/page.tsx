import { gameConfig } from "@pokeflex/config";
import { getConversation, getPlayerByHandle, relationBetween } from "@pokeflex/server";
import { ArrowLeft, Swords } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PlayerAvatar } from "@/components/player-avatar";
import { DmChat } from "@/components/social/dm-chat";
import { Button } from "@/components/ui/button";
import { getCurrentPlayerSafe } from "@/lib/player";

export const metadata: Metadata = {
  title: "Messages",
  robots: { index: false },
};

export default async function ConversationPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const player = await getCurrentPlayerSafe();
  if (!player) redirect(`/connexion?suite=/messages/${handle}`);
  const other = await getPlayerByHandle(decodeURIComponent(handle));
  if (!other) notFound();
  if (other.id === player.id) redirect("/messages");
  const [relation, messages] = await Promise.all([relationBetween(player.id, other.id), getConversation(player.id, other.id)]);
  const blocked = relation === "blocked" ? `Tu as bloqué ${other.name}.` : relation === "blocked_by" ? "Tu ne peux pas écrire à ce joueur." : undefined;

  return (
    <section
      className="flex min-h-0 flex-col overflow-hidden rounded-[calc(var(--radius-card)*1.2)] border border-line bg-surface"
      aria-label={`Conversation avec ${other.name}`}
    >
      <header className="flex items-center gap-3 border-b border-line px-3 py-2.5">
        <Link
          href="/messages"
          aria-label="Toutes les conversations"
          className="grid size-9 place-items-center rounded-full text-muted hover:bg-elev hover:text-fg md:hidden"
        >
          <ArrowLeft aria-hidden="true" className="size-5" />
        </Link>
        <Link href={`/joueurs/${other.handle}`} className="flex min-w-0 flex-1 items-center gap-3">
          <PlayerAvatar name={other.name} image={other.image} size="sm" />
          <span className="grid min-w-0">
            <span className="truncate text-sm font-semibold">{other.name}</span>
            <span className="truncate text-xs text-muted">@{other.handle}</span>
          </span>
        </Link>
        {!blocked && (
          <Button asChild size="sm" variant="secondary">
            <Link href={`/duels?defi=${encodeURIComponent(other.handle ?? "")}`}>
              <Swords aria-hidden="true" />
              <span className="hidden sm:inline">Défier</span>
            </Link>
          </Button>
        )}
      </header>
      <DmChat key={other.id} me={player.id} other={other} initial={messages} maxLength={gameConfig.social.messageMaxLength} blocked={blocked} />
    </section>
  );
}
