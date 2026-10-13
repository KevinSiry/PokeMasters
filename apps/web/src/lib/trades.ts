"use client";

import { getSocket } from "@/lib/realtime";

/** Après une action sur un échange : le serveur temps réel vérifie en base puis prévient l'autre joueur. */
export function pingTrade(tradeId: string) {
  getSocket().emit("trade:ping", { tradeId });
}
