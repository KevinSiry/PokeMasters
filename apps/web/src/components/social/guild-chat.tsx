"use client";

import { useEffect, useState } from "react";
import { type ChatItem, ChatPanel } from "@/components/social/chat-panel";
import { getSocket, request, useConnection, useSocketEvent } from "@/lib/realtime";

const merge = (list: ChatItem[], m: ChatItem) => (list.some((x) => x.id === m.id) ? list : [...list, m]);

/** Chat de guilde en direct (room Socket.IO ouverte après vérification de l'appartenance). */
export function GuildChat({ me, initial, maxLength }: { me: string; initial: ChatItem[]; maxLength: number }) {
  const [messages, setMessages] = useState(initial);
  const connected = useConnection();

  // (Re)joint la room à chaque (re)connexion.
  useEffect(() => {
    if (!connected) return;
    void request("guild:open", undefined);
    return () => {
      getSocket().emit("guild:close");
    };
  }, [connected]);

  useSocketEvent<ChatItem>("guild:message", (m) => setMessages((all) => merge(all, m)));

  return (
    <ChatPanel
      className="flex-1"
      me={me}
      messages={messages}
      maxLength={maxLength}
      placeholder="Écrire à la guilde…"
      showAuthors
      contextPrefix="guild"
      emptyState={"Personne n'a encore rien dit. Lance la discussion\u00a0!"}
      onSend={async (body) => {
        const res = await request<ChatItem>("guild:send", { body });
        if (res.ok && res.data) {
          const m = res.data;
          setMessages((all) => merge(all, m));
        }
        return res;
      }}
    />
  );
}
