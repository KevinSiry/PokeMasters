"use client";

import { Coins, Info, LogOut, Repeat2, Settings, Shield, Trophy, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** Menu du joueur (avatar) : profil, social, échanges, historique des Jetons, à propos, déconnexion. */
export function UserMenu({
  name,
  handle,
  image,
  friendRequests = 0,
  pendingTrades = 0,
  signOutAction,
}: {
  name: string;
  handle: string;
  image: string | null;
  friendRequests?: number;
  /** Propositions d'échange reçues en attente. */
  pendingTrades?: number;
  signOutAction: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const item = "flex items-center gap-3 rounded-xl px-3 py-3 text-sm sm:py-2.5 hover:bg-elev [&_svg]:size-4 [&_svg]:text-muted";

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Menu de ${name}${friendRequests > 0 ? `, ${friendRequests} demande${friendRequests > 1 ? "s" : ""} d'ami` : ""}${pendingTrades > 0 ? `, ${pendingTrades} proposition${pendingTrades > 1 ? "s" : ""} d'échange` : ""}`}
        className="pf-hit relative grid size-10 place-items-center rounded-full border sm:size-9 border-line bg-elev transition-colors hover:border-accent"
      >
        {friendRequests + pendingTrades > 0 && <span aria-hidden="true" className="absolute -top-0.5 -right-0.5 size-3 rounded-full border-2 border-bg bg-coral" />}
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- avatar fourni par Twitch/Discord
          <img src={image} alt="" className="size-8 rounded-full" />
        ) : (
          <span aria-hidden="true" className="font-display text-xs">
            {name.slice(0, 1).toUpperCase()}
          </span>
        )}
      </button>
      <div
        role="menu"
        hidden={!open}
        className={cn("absolute top-full right-0 z-50 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-2xl sm:w-60 border border-line bg-surface p-1.5 shadow-[0_18px_40px_-12px_rgb(0_0_0/0.7)]")}
      >
        <Link role="menuitem" href={`/joueurs/${handle}`} className="grid rounded-xl px-3 pt-2 pb-2.5 hover:bg-elev" onClick={() => setOpen(false)}>
          <span className="truncate text-sm font-semibold">{name}</span>
          <span className="truncate text-xs text-muted">@{handle} · voir mon profil</span>
        </Link>
        <div className="h-px bg-line" />
        <Link role="menuitem" href="/amis" className={item} onClick={() => setOpen(false)}>
          <Users aria-hidden="true" />
          <span className="flex-1">Amis</span>
          {friendRequests > 0 && <span className="rounded-full bg-coral px-1.5 font-mono text-[11px] font-bold text-bg">{friendRequests}</span>}
        </Link>
        <Link role="menuitem" href="/echanges" className={item} onClick={() => setOpen(false)}>
          <Repeat2 aria-hidden="true" />
          <span className="flex-1">Échanges</span>
          {pendingTrades > 0 && <span className="rounded-full bg-coral px-1.5 font-mono text-[11px] font-bold text-bg">{pendingTrades}</span>}
        </Link>
        <Link role="menuitem" href="/guildes" className={item} onClick={() => setOpen(false)}>
          <Shield aria-hidden="true" />
          Guildes
        </Link>
        <Link role="menuitem" href="/classements" className={item} onClick={() => setOpen(false)}>
          <Trophy aria-hidden="true" />
          Classements
        </Link>
        <div className="h-px bg-line" />
        <Link role="menuitem" href="/profil" className={item} onClick={() => setOpen(false)}>
          <Settings aria-hidden="true" />
          Modifier mon profil
        </Link>
        <Link role="menuitem" href="/jetons" className={item} onClick={() => setOpen(false)}>
          <Coins aria-hidden="true" />
          Mes Jetons
        </Link>
        <Link role="menuitem" href="/a-propos" className={item} onClick={() => setOpen(false)}>
          <Info aria-hidden="true" />À propos
        </Link>
        <form action={signOutAction}>
          <button role="menuitem" type="submit" className={cn(item, "w-full text-left")}>
            <LogOut aria-hidden="true" />
            Se déconnecter
          </button>
        </form>
      </div>
    </div>
  );
}
