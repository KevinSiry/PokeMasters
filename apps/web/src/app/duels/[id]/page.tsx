import { gameConfig } from "@pokeflex/config";
import { getDuelView } from "@pokeflex/server";
import { ArrowLeft, Check, RotateCcw, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CardImage } from "@/components/card-image";
import { DuelArena } from "@/components/duel/duel-arena";
import { Jetons } from "@/components/jetons";
import { Button } from "@/components/ui/button";
import { getCurrentPlayerSafe } from "@/lib/player";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Duel", robots: { index: false } };

export default async function DuelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const player = await getCurrentPlayerSafe();
  if (!player) redirect(`/connexion?suite=/duels/${id}`);
  const duel = await getDuelView(id);
  if (!duel || (duel.playerA.id !== player.id && duel.playerB?.id !== player.id)) notFound();

  const back = (
    <Link href="/duels" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
      <ArrowLeft aria-hidden="true" className="size-4" />
      Duels
    </Link>
  );

  if (duel.status !== "finished") {
    return (
      <div className="grid gap-2 pt-4">
        {back}
        <DuelArena
          duelId={duel.id}
          me={player.id}
          playerA={duel.playerA}
          playerB={duel.playerB}
          stakes={duel.stakes}
          training={duel.kind === "training"}
        />
      </div>
    );
  }

  // Récapitulatif d'un duel terminé.
  const mine = duel.playerA.id === player.id ? "a" : "b";
  const opp = mine === "a" ? (duel.playerB ?? { id: "bot", name: gameConfig.duels.bot.name, handle: null, image: null }) : duel.playerA;
  const myScore = mine === "a" ? duel.scoreA : duel.scoreB;
  const theirScore = mine === "a" ? duel.scoreB : duel.scoreA;
  const result = duel.outcome === "draw" ? "draw" : duel.outcome === mine ? "win" : "loss";
  const reward = mine === "a" ? duel.rewardA : duel.rewardB;
  const label = { win: "Victoire", draw: "Égalité", loss: "Défaite" }[result];

  return (
    <div className="grid grid-cols-1 gap-6 py-6 sm:py-10">
      {back}
      <header className="grid justify-items-center gap-3 rounded-[calc(var(--radius-card)*1.4)] border border-line bg-surface p-6 text-center">
        <p className={cn("font-display text-4xl font-bold", result === "win" ? "text-prism" : result === "draw" ? "text-accent" : "text-muted")}>{label}</p>
        <p className="text-sm text-muted">
          contre <strong className="text-fg">{opp.name}</strong>
          {duel.forfeitBy && (duel.forfeitBy === player.id ? " · tu as abandonné" : ` · ${opp.name} a abandonné`)}
        </p>
        <p className="font-mono text-3xl font-bold font-tabular">
          {myScore} <span className="text-muted">–</span> {theirScore}
        </p>
        {reward ? <Jetons value={reward} signed className="text-[#FFC93C]" /> : null}
        <div className="flex flex-wrap justify-center gap-2 pt-1">
          {duel.kind !== "training" && opp.handle ? (
            <Button asChild>
              <Link href={`/duels?defi=${encodeURIComponent(opp.handle)}`}>
                <RotateCcw aria-hidden="true" />
                Revanche
              </Link>
            </Button>
          ) : (
            <Button asChild>
              <Link href="/duels">Rejouer</Link>
            </Button>
          )}
        </div>
      </header>

      {duel.recap && duel.recap.length > 0 && (
        <section className="grid gap-3" aria-labelledby="recap">
          <h2 id="recap" className="font-display text-lg font-bold">
            Question par question
          </h2>
          <ol className="grid gap-3">
            {duel.recap.map((q, i) => {
              const my = mine === "a" ? q.a : q.b;
              const their = mine === "a" ? q.b : q.a;
              const myPts = mine === "a" ? q.pointsA : q.pointsB;
              return (
                <li key={i} className="grid gap-3 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-[auto_1fr]">
                  {q.image && (
                    <div className="w-20">
                      <CardImage image={q.image} name="Carte de la question" className="rounded-lg" />
                    </div>
                  )}
                  <div className="grid gap-2">
                    <p className="flex items-start justify-between gap-3 font-semibold">
                      <span>
                        <span className="mr-2 font-mono text-xs text-muted">{i + 1}.</span>
                        {q.prompt}
                      </span>
                      <span className={cn("shrink-0 font-mono text-sm", myPts > 0 ? "text-lime" : "text-muted")}>+{myPts}</span>
                    </p>
                    <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
                      {q.choices.map((c, ci) => (
                        <li
                          key={ci}
                          className={cn(
                            "flex items-center gap-2 rounded-lg border px-2.5 py-1.5",
                            ci === q.answer ? "border-lime/60 bg-lime/10" : ci === my ? "border-coral/60 bg-coral/10" : "border-line",
                          )}
                        >
                          {ci === q.answer ? <Check aria-hidden="true" className="size-4 text-lime" /> : ci === my ? <X aria-hidden="true" className="size-4 text-coral" /> : <span className="size-4" />}
                          <span className="min-w-0 flex-1">{c}</span>
                          {ci === my && <span className="text-[11px] text-muted">toi</span>}
                          {ci === their && <span className="text-[11px] text-muted">{opp.name}</span>}
                        </li>
                      ))}
                    </ul>
                    {my === null && <p className="text-xs text-muted">Pas de réponse dans le temps.</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </div>
  );
}
