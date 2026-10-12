"use client";

import { Coins, Info, LogOut, User } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** Menu du joueur (avatar) : historique des Jetons, à propos, déconnexion. */
export function UserMenu({ name, image, signOutAction }: { name: string; image: string | null; signOutAction: () => Promise<void> }) {
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

  const item = "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm hover:bg-elev [&_svg]:size-4 [&_svg]:text-muted";

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Menu de ${name}`}
        className="grid size-9 place-items-center rounded-full border border-line bg-elev transition-colors hover:border-accent"
      >
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
        className={cn("absolute top-full right-0 z-50 mt-2 w-60 rounded-2xl border border-line bg-surface p-1.5 shadow-[0_18px_40px_-12px_rgb(0_0_0/0.7)]")}
      >
        <p className="flex items-center gap-2 px-3 pt-2 pb-2.5 text-sm font-semibold">
          <User aria-hidden="true" className="size-4 text-muted" />
          <span className="truncate">{name}</span>
        </p>
        <div className="h-px bg-line" />
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
