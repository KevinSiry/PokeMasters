"use client";

import { Check, MessageCircle, UserMinus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { removeFriendAction, respondFriendRequestAction } from "@/app/actions/social";
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

function Identity({ p }: { p: Player }) {
  return (
    <Link href={`/joueurs/${p.handle}`} className="flex min-w-0 flex-1 basis-44 items-center gap-3">
      <PlayerAvatar name={p.name} image={p.image} />
      <span className="grid min-w-0">
        <span className="truncate text-sm font-semibold">{p.name}</span>
        <span className="truncate text-xs text-muted">@{p.handle}</span>
      </span>
    </Link>
  );
}

function useAct() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, done?: () => void) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) toast({ title: res.error ?? "L'action a échoué.", tone: "error" });
      else done?.();
      router.refresh();
    });
  return { pending, act };
}

export function FriendRow({ player }: { player: Player }) {
  const { pending, act } = useAct();
  return (
    <li className="flex items-center gap-2 rounded-2xl border border-line bg-surface p-3">
      <Identity p={player} />
      <Button asChild size="sm" variant="ghost" className="w-9 px-0">
        <Link href={`/messages/${player.handle}`} aria-label={`Écrire à ${player.name}`}>
          <MessageCircle aria-hidden="true" />
        </Link>
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="w-9 px-0"
        aria-label={`Retirer ${player.name} de mes amis`}
        disabled={pending}
        onClick={() =>
          act(
            () => removeFriendAction(player.id),
            () =>
              toast({
                title: `${player.name} retiré de tes amis`,
                tone: "info",
              }),
          )
        }
      >
        <UserMinus aria-hidden="true" />
      </Button>
    </li>
  );
}

export function RequestRow({ player, variant }: { player: Player; variant: "incoming" | "outgoing" }) {
  const { pending, act } = useAct();
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface p-3">
      <Identity p={player} />
      {variant === "incoming" ? (
        <div className="ml-auto flex gap-2">
          <Button
            size="sm"
            disabled={pending}
            onClick={() =>
              act(
                () => respondFriendRequestAction(player.id, true),
                () => {
                  pingSocial(player.id);
                  toast({ title: `${player.name} et toi êtes amis\u00a0!` });
                },
              )
            }
          >
            <Check aria-hidden="true" />
            Accepter
          </Button>
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => act(() => respondFriendRequestAction(player.id, false))}>
            <X aria-hidden="true" />
            Refuser
          </Button>
        </div>
      ) : (
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => act(() => removeFriendAction(player.id))}>
          Annuler
        </Button>
      )}
    </li>
  );
}
