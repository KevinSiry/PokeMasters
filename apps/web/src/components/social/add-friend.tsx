"use client";

import { Loader2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { searchPlayersAction, sendFriendRequestAction } from "@/app/actions/social";
import { PlayerAvatar } from "@/components/player-avatar";
import { pingSocial } from "@/components/social/profile-actions";
import { toast } from "@/components/toaster";
import { Button } from "@/components/ui/button";

interface Player {
  id: string;
  name: string;
  handle: string | null;
  image: string | null;
}

/** Ajouter un ami par son pseudo, avec suggestions. */
export function AddFriend() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Player[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = window.setTimeout(async () => {
      const res = await searchPlayersAction(q);
      if (res.ok) setResults(res.data.slice(0, 5));
    }, 200);
    return () => window.clearTimeout(t);
  }, [q]);

  function add(handle: string) {
    setError(null);
    start(async () => {
      const res = await sendFriendRequestAction(handle);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      pingSocial(res.data.target);
      toast(
        res.data.status === "accepted"
          ? { title: `${res.data.name} et toi êtes amis\u00a0!` }
          : {
              title: "Demande d'ami envoyée",
              description: `${res.data.name} doit l'accepter.`,
              tone: "info",
            },
      );
      setQ("");
      setResults([]);
      router.refresh();
    });
  }

  return (
    <form
      className="grid gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim()) add(q.trim());
      }}
    >
      <div className="flex gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Pseudo du joueur à ajouter</span>
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setError(null);
            }}
            placeholder="Pseudo du dresseur"
            autoComplete="off"
            spellCheck={false}
            className="h-11 w-full rounded-xl border border-line bg-bg px-3 outline-none focus:border-accent"
          />
        </label>
        <Button type="submit" disabled={!q.trim() || pending}>
          {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <UserPlus aria-hidden="true" />}
          Ajouter
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-coral">
          {error}
        </p>
      )}
      {results.length > 0 && (
        <ul className="grid gap-1 rounded-xl border border-line bg-bg/70 p-1" aria-label="Suggestions">
          {results.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => p.handle && add(p.handle)}
                disabled={pending}
                className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-elev"
              >
                <PlayerAvatar name={p.name} image={p.image} size="sm" />
                <span className="min-w-0 flex-1 truncate">
                  <strong>{p.name}</strong> <span className="text-muted">@{p.handle}</span>
                </span>
                <UserPlus aria-hidden="true" className="size-4 text-muted" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
