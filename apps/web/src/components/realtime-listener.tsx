"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "@/components/toaster";
import { getSocket, useSocketEvent } from "@/lib/realtime";

interface DuelUpdate {
  duelId: string;
  status: string;
  from?: string;
}

/**
 * Notifications en direct pour un joueur connecté, sur toutes les pages :
 * défi reçu, accepté, refusé ou expiré.
 */
export function RealtimeListener() {
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

  return null;
}
