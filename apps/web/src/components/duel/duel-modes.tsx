"use client";

import { gameConfig } from "@pokeflex/config";
import { GraduationCap, Loader2, Swords, UserRound, Zap } from "lucide-react";
import { motion } from "motion/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { createChallengeAction, searchOpponentsAction, startTrainingAction } from "@/app/duels/actions";
import { StakePicker } from "@/components/duel/stake-picker";
import { toast } from "@/components/toaster";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { getSocket, request, useSocketEvent } from "@/lib/realtime";
import { cn } from "@/lib/utils";

interface Opponent {
  id: string;
  name: string;
  handle: string | null;
  image: string | null;
}

function Avatar({ name, image, className }: { name: string; image: string | null; className?: string }) {
  return image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={image} alt="" className={cn("size-9 rounded-full object-cover", className)} />
  ) : (
    <span aria-hidden="true" className={cn("grid size-9 place-items-center rounded-full bg-elev font-display text-sm", className)}>
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

const card =
  "group relative grid gap-3 overflow-hidden rounded-[calc(var(--radius-card)*1.2)] border border-line bg-surface p-5 text-left transition-[transform,border-color] hover:-translate-y-0.5 hover:border-accent focus-visible:border-accent";

/** Les trois façons de jouer : duel rapide, défi à un joueur, entraînement. */
export function DuelModes() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<"quick" | "challenge" | null>(null);
  const [stake, setStake] = useState<string[]>([]);
  const [opponent, setOpponent] = useState<Opponent | null>(null);
  const [q, setQ] = useState(params.get("defi") ?? "");
  const [opponents, setOpponents] = useState<Opponent[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ready = stake.length === gameConfig.duels.stakeSize;

  // Lien « Revanche » : /duels?defi=pseudo ouvre directement le défi.
  useEffect(() => {
    if (params.get("defi")) setMode("challenge");
  }, [params]);

  useEffect(() => {
    if (mode !== "challenge") return;
    const t = window.setTimeout(async () => {
      const res = await searchOpponentsAction(q);
      if (res.ok) {
        setOpponents(res.data);
        const exact = res.data.find((o) => o.handle && o.handle.toLowerCase() === q.trim().replace(/^@/, "").toLowerCase());
        if (exact) setOpponent(exact);
      }
    }, 220);
    return () => window.clearTimeout(t);
  }, [q, mode]);

  useSocketEvent<{ duelId: string }>("duel:matched", ({ duelId }) => {
    setSearching(false);
    router.push(`/duels/${duelId}`);
  });
  useSocketEvent<{ message: string }>("queue:error", ({ message }) => {
    setSearching(false);
    setError(message);
  });

  function close() {
    if (searching) getSocket().emit("queue:leave");
    setSearching(false);
    setMode(null);
    setError(null);
  }

  async function findMatch() {
    setError(null);
    setSearching(true);
    const res = await request<{ matched: boolean; duelId?: string; error?: string }>("queue:join", { copyIds: stake });
    if (!res.ok) {
      setSearching(false);
      return setError(res.error);
    }
    if (res.data?.error) {
      setSearching(false);
      return setError(res.data.error);
    }
    if (res.data?.matched && res.data.duelId) router.push(`/duels/${res.data.duelId}`);
  }

  function sendChallenge() {
    if (!opponent?.handle) return;
    setError(null);
    start(async () => {
      const res = await createChallengeAction(opponent.handle!, stake);
      if (!res.ok) return setError(res.error);
      getSocket().emit("duel:ping", res.data.duelId);
      toast({ title: "Défi envoyé !", description: `${opponent.name} a ${gameConfig.duels.challengeTtlMs / 60_000} minutes pour l'accepter.`, tone: "info" });
      setMode(null);
      setStake([]);
      router.refresh();
    });
  }

  function training() {
    start(async () => {
      const res = await startTrainingAction();
      if (!res.ok) return toast({ title: "Entraînement impossible", description: res.error, tone: "error" });
      router.push(`/duels/${res.data.duelId}`);
    });
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <button type="button" className={card} onClick={() => setMode("quick")}>
          <span aria-hidden="true" className="absolute -top-10 -right-10 size-32 rounded-full bg-coral/20 blur-2xl transition-opacity group-hover:opacity-100" />
          <Zap aria-hidden="true" className="size-7 text-coral" />
          <span className="font-display text-lg font-bold">Duel rapide</span>
          <span className="text-sm text-muted">Affronte le premier joueur disponible. Mise 3 cartes, réponds plus vite et plus juste.</span>
        </button>
        <button type="button" className={card} onClick={() => setMode("challenge")}>
          <span aria-hidden="true" className="absolute -top-10 -right-10 size-32 rounded-full bg-accent/25 blur-2xl" />
          <Swords aria-hidden="true" className="size-7 text-accent" />
          <span className="font-display text-lg font-bold">Défier un joueur</span>
          <span className="text-sm text-muted">Choisis ton adversaire par son pseudo. Il a 15 minutes pour relever le défi.</span>
        </button>
        <button type="button" className={card} onClick={training} disabled={pending}>
          <span aria-hidden="true" className="absolute -top-10 -right-10 size-32 rounded-full bg-lime/15 blur-2xl" />
          <GraduationCap aria-hidden="true" className="size-7 text-lime" />
          <span className="font-display text-lg font-bold">Entraînement</span>
          <span className="text-sm text-muted">Contre {gameConfig.duels.bot.name}, sans mise ni Jetons. Idéal pour découvrir les questions.</span>
        </button>
      </div>

      <Dialog
        open={mode === "quick"}
        onClose={close}
        title={searching ? "Recherche d'un adversaire…" : "Duel rapide"}
        description={searching ? "Garde cette fenêtre ouverte : le duel commence dès qu'un joueur est trouvé." : "Choisis les 3 cartes que tu mises. Les questions porteront sur les cartes des deux joueurs."}
      >
        {searching ? (
          <div className="grid justify-items-center gap-5 py-6">
            <motion.div
              className="grid size-24 place-items-center rounded-full bg-gradient-to-br from-accent-strong to-coral-strong"
              animate={{ scale: [1, 1.08, 1], rotate: [0, 8, -8, 0] }}
              transition={{ duration: 1.6, repeat: Infinity }}
            >
              <Swords aria-hidden="true" className="size-10" />
            </motion.div>
            <p className="text-sm text-muted" role="status">
              En attente d&apos;un autre joueur…
            </p>
            <Button variant="secondary" onClick={close}>
              Annuler
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            <StakePicker value={stake} onChange={setStake} />
            {error && <p className="text-sm text-danger" role="alert">{error}</p>}
            <Button size="lg" onClick={findMatch} disabled={!ready}>
              <Zap aria-hidden="true" />
              Chercher un adversaire
            </Button>
          </div>
        )}
      </Dialog>

      <Dialog open={mode === "challenge"} onClose={close} title="Défier un joueur" description="Choisis ton adversaire, puis les 3 cartes que tu mises.">
        <div className="grid gap-4">
          <label className="grid gap-1.5 text-sm">
            <span className="text-muted">Adversaire</span>
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setOpponent(null);
              }}
              placeholder="Pseudo du joueur"
              autoComplete="off"
              className="h-11 rounded-xl border border-line bg-bg px-3 outline-none focus:border-accent"
            />
          </label>
          <ul className="flex gap-2 overflow-x-auto pb-1" aria-label="Joueurs">
            {opponents === null && <li className="text-xs text-muted">Recherche…</li>}
            {opponents?.length === 0 && <li className="text-xs text-muted">Aucun joueur trouvé.</li>}
            {opponents?.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => setOpponent(o)}
                  aria-pressed={opponent?.id === o.id}
                  className={cn(
                    "flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-sm whitespace-nowrap transition-colors",
                    opponent?.id === o.id ? "border-lime bg-lime/10" : "border-line bg-bg hover:border-accent",
                  )}
                >
                  <Avatar name={o.name} image={o.image} className="size-7" />
                  {o.name}
                  {o.handle && <span className="text-xs text-muted">@{o.handle}</span>}
                </button>
              </li>
            ))}
          </ul>
          <StakePicker value={stake} onChange={setStake} />
          {error && <p className="text-sm text-danger" role="alert">{error}</p>}
          <Button size="lg" onClick={sendChallenge} disabled={!ready || !opponent || pending}>
            {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <UserRound aria-hidden="true" />}
            {opponent ? `Défier ${opponent.name}` : "Choisis un adversaire"}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
