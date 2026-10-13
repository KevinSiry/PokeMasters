"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "@/components/toaster";
import { getSocket, useSocketEvent } from "@/lib/realtime";

interface DirectMessage {
  id: string;
  body: string;
  recipientId: string;
  author: { id: string; name: string; handle: string | null };
}

/**
 * Notifications en direct pour un joueur connecté, sur toutes les pages :
 * message privé, demande d'ami, exclusion de guilde.
 * Les compteurs de l'en-tête (messages non lus, demandes d'ami) sont rafraîchis au passage.
 */
export function RealtimeListener({ me }: { me: string }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    getSocket();
  }, []);

  useSocketEvent<DirectMessage>("dm:new", (m) => {
    if (m.author.id === me) return;
    // La conversation ouverte gère elle-même l'affichage et la lecture.
    const open = m.author.handle && pathname === `/messages/${m.author.handle}`;
    if (open) return;
    router.refresh();
    if (pathname === "/messages") return;
    toast({
      title: `Message de ${m.author.name}`,
      description: m.body.length > 90 ? `${m.body.slice(0, 90)}…` : m.body,
      tone: "info",
      action: m.author.handle ? { label: "Répondre", href: `/messages/${m.author.handle}` } : undefined,
    });
  });

  useSocketEvent("dm:read", () => router.refresh());

  useSocketEvent<{ kind: "friend_request" | "friend_accepted" }>("social:update", ({ kind }) => {
    router.refresh();
    if (kind === "friend_request") {
      toast({ title: "Nouvelle demande d'ami", description: "Un joueur veut t'ajouter à ses amis.", tone: "info", action: { label: "Voir", href: "/amis" } });
    } else {
      toast({ title: "Demande acceptée !", description: "Vous êtes maintenant amis." });
    }
  });

  useSocketEvent<{ guildId: string; kicked: boolean }>("guild:removed", ({ kicked }) => {
    router.refresh();
    if (kicked) toast({ title: "Tu as été exclu de ta guilde.", tone: "info" });
  });

  return null;
}
