"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { unblockUserAction } from "@/app/actions/social";
import { PlayerAvatar } from "@/components/player-avatar";
import { toast } from "@/components/toaster";
import { Button } from "@/components/ui/button";

interface Player {
  id: string;
  name: string;
  handle: string | null;
  image: string | null;
}

export function BlockedList({ players }: { players: Player[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <section className="grid gap-3" aria-labelledby="bloques">
      <h2 id="bloques" className="font-display text-lg font-bold">
        Joueurs bloqués
      </h2>
      {players.length === 0 ? (
        <p className="text-sm text-muted">Tu n&apos;as bloqué personne.</p>
      ) : (
        <ul className="grid gap-2">
          {players.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
              <PlayerAvatar name={p.name} image={p.image} size="sm" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                {p.name}
                {p.handle && <span className="ml-1.5 font-normal text-muted">@{p.handle}</span>}
              </span>
              <Button
                size="sm"
                variant="secondary"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await unblockUserAction(p.id);
                    toast(res.ok ? { title: `${p.name} est débloqué`, tone: "info" } : { title: res.error, tone: "error" });
                    router.refresh();
                  })
                }
              >
                Débloquer
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
