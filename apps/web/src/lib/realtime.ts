"use client";

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

/**
 * Connexion unique au serveur temps réel (Socket.IO), partagée par tous les composants.
 * Le cookie de session Auth.js authentifie la connexion côté serveur.
 */
let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_REALTIME_URL ?? "http://localhost:3001", {
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnectionDelay: 500,
      reconnectionDelayMax: 4000,
    });
  }
  return socket;
}

export type AckResult<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };

/** Émet un événement et attend l'accusé de réception du serveur (avec délai maximal). */
export function request<T = unknown>(event: string, payload: unknown, timeoutMs = 8000): Promise<AckResult<T>> {
  const s = getSocket();
  return new Promise((resolve) => {
    s.timeout(timeoutMs).emit(event, payload, (err: Error | null, res: AckResult<T>) => {
      resolve(err ? { ok: false, error: "Le serveur temps réel ne répond pas. Vérifie ta connexion." } : res);
    });
  });
}

/** Écoute un événement du serveur pendant la vie du composant. */
export function useSocketEvent<T>(event: string, handler: (payload: T) => void) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const s = getSocket();
    const fn = (p: T) => ref.current(p);
    s.on(event, fn);
    return () => {
      s.off(event, fn);
    };
  }, [event]);
}

/** État de la connexion, pour afficher « Reconnexion… ». */
export function useConnection() {
  const [connected, setConnected] = useState(true);
  useEffect(() => {
    const s = getSocket();
    const on = () => setConnected(true);
    const off = () => setConnected(false);
    setConnected(s.connected);
    s.on("connect", on);
    s.on("disconnect", off);
    s.on("connect_error", off);
    return () => {
      s.off("connect", on);
      s.off("disconnect", off);
      s.off("connect_error", off);
    };
  }, []);
  return connected;
}

/** Écart entre l'horloge du serveur et celle du navigateur (ms), pour afficher les chronos justes. */
export function serverOffset(serverNow: number) {
  return serverNow - Date.now();
}
