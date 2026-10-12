"use client";

import { MessageCircle } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PlayerAvatar } from "@/components/player-avatar";
import { cn } from "@/lib/utils";

interface Conversation {
  other: {
    id: string;
    name: string;
    handle: string | null;
    image: string | null;
  };
  last: { body: string; createdAt: string; mine: boolean };
  unread: number;
}

const short = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  timeZone: "Europe/Paris",
});
const hour = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});
const when = (iso: string) => {
  const d = new Date(iso);
  return Date.now() - d.getTime() < 20 * 3_600_000 ? hour.format(d) : short.format(d);
};

/** Conversations, la plus récente en haut. Sur mobile, masquée quand une conversation est ouverte. */
export function ConversationList({ conversations }: { conversations: Conversation[] }) {
  const pathname = usePathname();
  const inConversation = pathname !== "/messages";

  return (
    <aside
      className={cn(
        "min-h-0 flex-col overflow-hidden rounded-[calc(var(--radius-card)*1.2)] border border-line bg-surface",
        inConversation ? "hidden md:flex" : "flex",
      )}
      aria-label="Conversations"
    >
      <h1 className="border-b border-line px-4 py-3 font-display text-lg font-bold">Messages</h1>
      {conversations.length === 0 ? (
        <div className="grid flex-1 place-items-center p-6 text-center text-sm text-muted">
          <div className="grid justify-items-center gap-2">
            <MessageCircle aria-hidden="true" className="size-8" />
            Aucune conversation pour l&apos;instant.
            <Link href="/amis" className="text-accent hover:underline">
              Trouver des amis
            </Link>
          </div>
        </div>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {conversations.map((c) => {
            const href = `/messages/${c.other.handle}`;
            const active = pathname === href;
            return (
              <li key={c.other.id}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn("flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition-colors", active ? "bg-elev" : "hover:bg-elev/60")}
                >
                  <PlayerAvatar name={c.other.name} image={c.other.image} />
                  <span className="grid min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={cn("truncate text-sm", c.unread > 0 ? "font-bold" : "font-semibold")}>{c.other.name}</span>
                      <span className="shrink-0 font-mono text-[10px] text-muted">{when(c.last.createdAt)}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className={cn("truncate text-xs", c.unread > 0 ? "text-fg" : "text-muted")}>
                        {c.last.mine && "Toi : "}
                        {c.last.body}
                      </span>
                      {c.unread > 0 && (
                        <span className="ml-auto grid h-4.5 min-w-4.5 shrink-0 place-items-center rounded-full bg-coral px-1 font-mono text-[10px] font-bold text-bg">
                          {c.unread}
                        </span>
                      )}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
