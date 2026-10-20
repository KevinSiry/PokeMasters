"use client";

import { MessageCircle } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Accès aux messages privés, avec le nombre de messages non lus (mis à jour en direct par RealtimeListener). */
export function MessagesLink({ unread }: { unread: number }) {
  const pathname = usePathname();
  const active = pathname.startsWith("/messages");
  return (
    <Link
      href="/messages"
      aria-label={unread > 0 ? `Messages, ${unread} non lu${unread > 1 ? "s" : ""}` : "Messages"}
      aria-current={active ? "page" : undefined}
      className={cn(
        "pf-hit relative grid size-10 place-items-center sm:size-9 rounded-full border border-line bg-elev text-muted transition-colors hover:border-accent hover:text-fg",
        active && "border-accent text-fg",
      )}
    >
      <MessageCircle aria-hidden="true" className="size-4" />
      {unread > 0 && (
        <span
          aria-hidden="true"
          className="absolute -top-1 -right-1 grid h-4.5 min-w-4.5 place-items-center rounded-full bg-coral px-1 font-mono text-[10px] font-bold text-bg"
        >
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
