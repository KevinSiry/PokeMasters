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

interface DuelUpdate {
  duelId: string;
  status: string;
  from?: string;
}

/**
 * Notifications en direct pour un joueur connecté, sur toutes les pages :
 * défi reçu, accepté, refusé ou expiré ; message privé ; demande d'ami.
 * Les compteurs de l'en-tête (messages non lus, demandes d'ami) sont rafraîchis au passage.
 */
export function RealtimeListener({ me }: { me: string }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    getSocket();
  }, []);

  useSocketEvent<DuelUpdate>("duel:update", ({ duelId, status }) => {
    if (pathname === "/duels") router.refresh();
    if (status === "pending") {
      toast({ title: "Nouveau défi !", description: "Un joueur te défie en duel quiz.", tone: "info", action: { label: "Voir", href: "/duels" } });
    } else if (status === "ready") {
      toast({ title: "Défi accepté !", description: "Ton adversaire t'attend dans l'arène.", action: { label: "Entrer", href: `/duels/${duelId}` } });
    } else if (status === "declined") {
      toast({ title: "Défi refusé", description: "Tes cartes misées te sont rendues.", tone: "info" });
    } else if (status === "expired") {
      toast({ title: "Défi expiré", description: "Personne n'a répondu : les cartes misées sont rendues.", tone: "info" });
    }
  });

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
