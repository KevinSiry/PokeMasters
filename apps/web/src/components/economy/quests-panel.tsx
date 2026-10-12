"use client";

import { Check, Gift, PackageOpen, Recycle, Sparkles, Swords } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { claimQuestAction } from "@/app/actions/economy";
import { CoinBurst } from "@/components/economy/coin-burst";
import { Jetons } from "@/components/jetons";
import { toast } from "@/components/toaster";
import { emitBalance } from "@/lib/balance-events";
import { cn } from "@/lib/utils";

export interface QuestRow {
  id: string;
  kind: string;
  label: string;
  target: number;
  progress: number;
  reward: number;
  claimed: boolean;
}

const ICONS: Record<string, typeof Gift> = { open_boosters: PackageOpen, recycle_cards: Recycle, new_cards: Sparkles, win_duel: Swords };

function useResetIn(resetAt: string) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);
  if (now === null) return null;
  const min = Math.max(0, Math.round((new Date(resetAt).getTime() - now) / 60_000));
  const h = Math.floor(min / 60);
  return h > 0 ? `${h} h ${String(min % 60).padStart(2, "0")}` : `${min} min`;
}

/** Quêtes du jour : progression, récompense à réclamer (avec pluie de pièces), remise à zéro à minuit. */
export function QuestsPanel({ quests, resetAt }: { quests: QuestRow[]; resetAt: string }) {
  const router = useRouter();
  const [list, setList] = useState(quests);
  const [burst, setBurst] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const resetIn = useResetIn(resetAt);

  useEffect(() => setList(quests), [quests]);

  function claim(q: QuestRow) {
    start(async () => {
      const res = await claimQuestAction(q.id);
      if (!res.ok) {
        toast({ title: "Récompense indisponible", description: res.error, tone: "error" });
        return;
      }
      setList((l) => l.map((x) => (x.id === q.id ? { ...x, claimed: true } : x)));
      setBurst(q.id);
      emitBalance(res.data.balance);
      toast({ title: "Quête accomplie", description: q.label, jetons: res.data.reward });
      router.refresh();
    });
  }

  const done = list.filter((q) => q.claimed).length;

  return (
    <section id="quetes" aria-labelledby="quetes-titre" className="grid scroll-mt-24 gap-4 rounded-[calc(var(--radius-card)*1.4)] border border-line bg-surface p-5 sm:p-7">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="quetes-titre" className="font-display text-xl font-bold">
          Quêtes du jour <span className="font-mono text-sm text-muted">{done}/{list.length}</span>
        </h2>
        {resetIn && <p className="text-xs text-muted">Nouvelles quêtes dans <span className="font-mono text-fg">{resetIn}</span></p>}
      </div>
      <ul className="grid gap-2.5">
        {list.map((q) => {
          const Icon = ICONS[q.kind] ?? Gift;
          const complete = q.progress >= q.target;
          return (
            <li
              key={q.id}
              className={cn(
                "relative grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl border p-3 transition-colors sm:gap-4 sm:p-3.5",
                q.claimed ? "border-line/60 opacity-70" : complete ? "border-[#FFC93C]/70 bg-[#FFC93C]/5" : "border-line",
              )}
            >
              <span
                aria-hidden="true"
                className={cn("grid size-10 place-items-center rounded-xl", complete ? "bg-[#FFC93C]/15 text-[#FFC93C]" : "bg-elev text-accent")}
              >
                <Icon className="size-5" />
              </span>
              <div className="grid min-w-0 gap-1.5">
                <p className={cn("text-sm font-semibold", q.claimed && "line-through decoration-muted")}>{q.label}</p>
                <div className="flex items-center gap-2">
                  <div
                    className="h-1.5 flex-1 overflow-hidden rounded-full bg-elev"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={q.target}
                    aria-valuenow={q.progress}
                    aria-label={q.label}
                  >
                    <motion.div
                      className={cn("h-full rounded-full", complete ? "bg-[#FFC93C]" : "bg-gradient-to-r from-accent to-coral")}
                      initial={false}
                      animate={{ width: `${(q.progress / q.target) * 100}%` }}
                    />
                  </div>
                  <span className="font-mono text-xs text-muted">
                    {q.progress}/{q.target}
                  </span>
                </div>
              </div>
              <div className="relative">
                {q.claimed ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-lime">
                    <Check aria-hidden="true" className="size-4" />
                    Réclamée
                  </span>
                ) : complete ? (
                  <motion.button
                    type="button"
                    disabled={pending}
                    onClick={() => claim(q)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#FFC93C] px-3.5 text-xs font-bold text-bg shadow-[0_0_24px_-4px_#FFC93C] disabled:opacity-60"
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 1.4, repeat: Infinity }}
                  >
                    Réclamer <Jetons value={q.reward} />
                  </motion.button>
                ) : (
                  <Jetons value={q.reward} className="text-xs text-muted" />
                )}
                <AnimatePresence>{burst === q.id && <CoinBurst key={q.id} />}</AnimatePresence>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
