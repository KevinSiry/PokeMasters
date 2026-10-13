"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { olderMessagesAction } from "@/app/actions/social";
import { type ChatAuthor, type ChatItem, ChatPanel } from "@/components/social/chat-panel";
import { getSocket, request, useSocketEvent } from "@/lib/realtime";

interface Dm extends ChatItem {
  recipientId: string;
}

const merge = (list: Dm[], m: Dm) => (list.some((x) => x.id === m.id) ? list : [...list, m]);

/** Conversation privée en direct : envoi par le serveur temps réel, accusés de lecture. */
export function DmChat({ me, other, initial, maxLength, blocked }: { me: string; other: ChatAuthor; initial: Dm[]; maxLength: number; blocked?: string }) {
  const router = useRouter();
  const [messages, setMessages] = useState<Dm[]>(initial);

  // Ouvrir la conversation vaut lecture.
  useEffect(() => {
    getSocket().emit("dm:read", { with: other.id });
  }, [other.id]);

  useSocketEvent<Dm>("dm:new", (m) => {
    const ours = (m.author.id === other.id && m.recipientId === me) || (m.author.id === me && m.recipientId === other.id);
    if (!ours) return;
    setMessages((all) => merge(all, m));
    if (m.author.id === other.id && document.visibilityState === "visible") getSocket().emit("dm:read", { with: other.id });
    router.refresh();
  });

  useSocketEvent<{ by: string }>("dm:read", ({ by }) => {
    if (by !== other.id) return;
    const now = new Date().toISOString();
    setMessages((all) => all.map((m) => (m.author.id === me && !m.readAt ? { ...m, readAt: now } : m)));
  });

  useEffect(() => {
    const onVisible = () => document.visibilityState === "visible" && getSocket().emit("dm:read", { with: other.id });
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [other.id]);

  return (
    <ChatPanel
      className="flex-1"
      me={me}
      messages={messages}
      maxLength={maxLength}
      placeholder={`Écrire à ${other.name}…`}
      readReceipts
      disabled={blocked}
      contextPrefix="dm"
      emptyState={
        <span>
          Dis bonjour à <strong className="text-fg">{other.name}</strong> !
          <br />
          Parle-lui de ta collection ou d'une carte qui t'intéresse.
        </span>
      }
      onSend={async (body) => {
        const res = await request<Dm>("dm:send", { to: other.id, body });
        if (res.ok && res.data) {
          const m = res.data;
          setMessages((all) => merge(all, m));
          router.refresh();
        }
        return res;
      }}
      onLoadOlder={async () => {
        const first = messages[0];
        if (!first) return false;
        const res = await olderMessagesAction(other.id, first.createdAt);
        if (!res.ok) return true;
        setMessages((all) => [...res.data.filter((m) => !all.some((x) => x.id === m.id)), ...all]);
        return res.data.length >= 40;
      }}
    />
  );
}
