import { getConversations } from "@pokeflex/server";
import { redirect } from "next/navigation";
import { ConversationList } from "@/components/social/conversation-list";
import { getCurrentPlayerSafe } from "@/lib/player";

/** Messagerie : liste des conversations à gauche (ordinateur), conversation ouverte à droite. */
export default async function MessagesLayout({ children }: { children: React.ReactNode }) {
  const player = await getCurrentPlayerSafe();
  if (!player) redirect("/connexion?suite=/messages");
  const conversations = await getConversations(player.id);

  return (
    <div className="grid h-[calc(100dvh-7.5rem-env(safe-area-inset-bottom))] min-h-[420px] grid-cols-1 gap-4 py-4 md:h-[calc(100dvh-8rem-env(safe-area-inset-bottom))] md:grid-cols-[300px_1fr] md:py-6 lg:h-[calc(100dvh-6rem)] lg:grid-cols-[340px_1fr]">
      <ConversationList conversations={conversations} />
      {children}
    </div>
  );
}
