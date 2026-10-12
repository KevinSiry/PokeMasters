"use client";

import { gameConfig } from "@pokeflex/config";
import { Check, Loader2, Swords, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { acceptChallengeAction, withdrawChallengeAction } from "@/app/duels/actions";
import { StakePicker } from "@/components/duel/stake-picker";
import { Countdown } from "@/components/market/countdown";
import { toast } from "@/components/toaster";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { getSocket } from "@/lib/realtime";
import { cn } from "@/lib/utils";

export interface ChallengeRowData {
  id: string;
  opponent: { name: string; handle: string | null; image: string | null } | null;
  expiresAt: string | null;
  kind: string;
}

function Avatar({ name, image }: { name: string; image: string | null }) {
  return image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={image} alt="" className="size-10 rounded-full object-cover" />
  ) : (
    <span aria-hidden="true" className="grid size-10 place-items-center rounded-full bg-elev font-display">
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

/** Un défi reçu (accepter / refuser), envoyé (annuler) ou prêt (entrer dans l'arène). */
export function ChallengeRow({ duel, variant }: { duel: ChallengeRowData; variant: "incoming" | "outgoing" | "ready" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [stake, setStake] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const name = duel.opponent?.name ?? gameConfig.duels.bot.name;

  function accept() {
    setError(null);
    start(async () => {
      const res = await acceptChallengeAction(duel.id, stake);
      if (!res.ok) return setError(res.error);
      getSocket().emit("duel:ping", duel.id);
      router.push(`/duels/${duel.id}`);
    });
  }

  function withdraw() {
    start(async () => {
      const res = await withdrawChallengeAction(duel.id);
      if (!res.ok) return toast({ title: "Action impossible", description: res.error, tone: "error" });
      getSocket().emit("duel:ping", duel.id);
      toast({ title: variant === "incoming" ? "Défi refusé" : "Défi annulé", description: "Les cartes misées sont rendues.", tone: "info" });
      router.refresh();
    });
  }

  return (
    <li
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-2xl border bg-surface p-3.5",
        variant === "incoming" ? "border-coral/60 shadow-[0_0_0_1px_color-mix(in_srgb,var(--color-coral)_25%,transparent)]" : "border-line",
      )}
    >
      <Avatar name={name} image={duel.opponent?.image ?? null} />
      <div className="grid min-w-0 flex-1 gap-0.5">
        <p className="truncate text-sm font-semibold">
          {variant === "incoming" ? `${name} te défie !` : variant === "outgoing" ? `Défi envoyé à ${name}` : `Duel contre ${name}`}
        </p>
        <p className="text-xs text-muted">
          {variant === "ready" ? (
            "Les mises sont posées : entre dans l'arène."
          ) : duel.expiresAt ? (
            <>
              Expire dans <Countdown endsAt={duel.expiresAt} onEnd={() => router.refresh()} />
            </>
          ) : null}
        </p>
      </div>
      <div className="flex gap-2">
        {variant === "incoming" && (
          <>
            <Button size="sm" variant="ghost" onClick={withdraw} disabled={pending} aria-label={`Refuser le défi de ${name}`}>
              <X aria-hidden="true" />
              Refuser
            </Button>
            <Button size="sm" onClick={() => setOpen(true)} disabled={pending}>
              <Swords aria-hidden="true" />
              Relever
            </Button>
          </>
        )}
        {variant === "outgoing" && (
          <Button size="sm" variant="secondary" onClick={withdraw} disabled={pending}>
            Annuler
          </Button>
        )}
        {variant === "ready" && (
          <Button asChild size="sm">
            <Link href={`/duels/${duel.id}`}>
              <Swords aria-hidden="true" />
              Entrer
            </Link>
          </Button>
        )}
      </div>
      {variant === "incoming" && (
        <Dialog open={open} onClose={() => setOpen(false)} title={`Relever le défi de ${name}`} description="Choisis les 3 cartes que tu mises. Le duel commence dès que vous êtes tous les deux dans l'arène.">
          <div className="grid gap-4">
            <StakePicker value={stake} onChange={setStake} />
            {error && <p className="text-sm text-danger" role="alert">{error}</p>}
            <Button size="lg" onClick={accept} disabled={stake.length !== gameConfig.duels.stakeSize || pending}>
              {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Check aria-hidden="true" />}
              Accepter et entrer dans l&apos;arène
            </Button>
          </div>
        </Dialog>
      )}
    </li>
  );
}
