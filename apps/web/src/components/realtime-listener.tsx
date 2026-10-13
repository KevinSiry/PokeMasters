"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "@/components/toaster";
import { formatJetons } from "@/lib/utils";
import { getSocket, useSocketEvent } from "@/lib/realtime";

interface DirectMessage {
  id: string;
  body: string;
  recipientId: string;
  author: { id: string; name: string; handle: string | null };
}

/**
 * Notifications en direct pour un joueur connecté, sur toutes les pages :
 * message privé, demande d'ami, exclusion de guilde, carte de la wishlist mise en vente, échanges.
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

  useSocketEvent<{ id: string; type: "fixed" | "auction"; price: number; cardName: string }>("wishlist:listed", (l) => {
    toast({
      title: "Une carte de ta wishlist est en vente",
      description: `${l.cardName} · ${l.type === "auction" ? "enchère dès" : "prix"} ${formatJetons(l.price)} Jetons`,
      tone: "info",
      action: { label: "Voir", href: `/marche/${l.id}` },
    });
  });

  useSocketEvent<{ kind: "offer" | "counter" | "accepted" | "declined" | "cancelled"; from: { name: string } }>("trade:update", ({ kind, from }) => {
    router.refresh();
    if (kind === "offer" || kind === "counter") {
      toast({
        title: kind === "counter" ? "Contre-proposition reçue" : "Nouvelle proposition d'échange",
        description: `${from.name} ${kind === "counter" ? "te répond avec une autre offre." : "veut échanger des cartes avec toi."}`,
        tone: "info",
        action: pathname === "/echanges" ? undefined : { label: "Voir", href: "/echanges" },
      });
    } else if (kind === "accepted") {
      toast({ title: "Échange conclu !", description: `${from.name} a accepté ta proposition.`, action: { label: "Voir", href: "/echanges" } });
    } else {
      toast({ title: kind === "declined" ? `${from.name} a refusé ta proposition` : `${from.name} a annulé sa proposition`, tone: "info" });
    }
  });

  return null;
}
