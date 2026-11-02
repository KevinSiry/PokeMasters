"use client";

import { Check, Handshake, PackageOpen, Sparkles, Store, Target } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { claimGuildMissionAction } from "@/app/actions/economy";
import { CoinBurst } from "@/components/economy/coin-burst";
import { Jetons } from "@/components/jetons";
import { toast } from "@/components/toaster";
import { emitBalance } from "@/lib/balance-events";
import { cn } from "@/lib/utils";

export interface GuildMissionRow {
  kind: string;
  label: string;
  progress: number;
  target: number;
  reward: number;
  claimed: boolean;
}

const ICONS: Record<string, typeof Target> = { open_boosters: PackageOpen, rarities_completed: Sparkles, sales: Store, trades: Handshake };

function useResetIn(resetAt: string) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);
  if (now === null) return null;
  const min = Math.max(0, Math.round((new Date(resetAt).getTime() - now) / 60_000));
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  return d > 0 ? `${d} j ${h} h` : h > 0 ? `${h} h ${String(min % 60).padStart(2, "0")}` : `${min} min`;
}

/** Missions collectives de la semaine ; seuls les membres peuvent réclamer. */
export function GuildMissions({ missions, resetAt, member }: { missions: GuildMissionRow[]; resetAt: string; member: boolean }) {
  const router = useRouter();
  const [list, setList] = useState(missions);
  const [burst, setBurst] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const resetIn = useResetIn(resetAt);

  useEffect(() => setList(missions), [missions]);

  function claim(m: GuildMissionRow) {
    start(async () => {
      const res = await claimGuildMissionAction(m.kind);
      if (!res.ok) {
        toast({ title: "Récompense indisponible", description: res.error, tone: "error" });
        return;
      }
      setList((l) => l.map((x) => (x.kind === m.kind ? { ...x, claimed: true } : x)));
      setBurst(m.kind);
      emitBalance(res.data.balance);
      toast({ title: "Mission de guilde réussie", description: m.label, jetons: res.data.reward });
      router.refresh();
    });
  }

  const done = list.filter((m) => m.progress >= m.target).length;

  return (
    <section aria-labelledby="missions-titre" className="grid gap-4 rounded-[calc(var(--radius-card)*1.2)] border border-line bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="missions-titre" className="font-display text-lg font-bold">
          Missions de la semaine <span className="font-mono text-sm text-muted">{done}/{list.length}</span>
        </h2>
        {resetIn && (
          <p className="text-xs text-muted">
            Nouvelles missions dans <span className="font-mono text-fg">{resetIn}</span>
          </p>
        )}
      </div>
      <p className="text-xs text-muted">
        Objectifs communs : l&apos;activité de tous les membres compte. Chaque membre réclame sa récompense une fois par semaine.
      </p>
      <ul className="grid gap-2.5 sm:grid-cols-2">
        {list.map((m) => {
          const Icon = ICONS[m.kind] ?? Target;
          const complete = m.progress >= m.target;
          return (
            <li
              key={m.kind}
              data-mission={m.kind}
              className={cn(
                "relative grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl border p-3",
                m.claimed ? "border-line/60 opacity-70" : complete ? "border-[#FFC93C]/70 bg-[#FFC93C]/5" : "border-line",
              )}
            >
              <span aria-hidden="true" className={cn("grid size-10 place-items-center rounded-xl", complete ? "bg-[#FFC93C]/15 text-[#FFC93C]" : "bg-elev text-accent")}>
                <Icon className="size-5" />
              </span>
              <div className="grid min-w-0 gap-1.5">
                <p className="truncate text-sm font-semibold">{m.label}</p>
                <div className="flex items-center gap-2">
                  <div
                    className="h-1.5 flex-1 overflow-hidden rounded-full bg-elev"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={m.target}
                    aria-valuenow={m.progress}
                    aria-label={m.label}
                  >
                    <div className={cn("h-full rounded-full", complete ? "bg-[#FFC93C]" : "bg-gradient-to-r from-accent to-coral")} style={{ width: `${(m.progress / m.target) * 100}%` }} />
                  </div>
                  <span className="font-mono text-xs text-muted">
                    {m.progress}/{m.target}
                  </span>
                </div>
              </div>
              <div className="relative">
                {m.claimed ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-lime">
                    <Check aria-hidden="true" className="size-4" />
                    Réclamée
                  </span>
                ) : complete && member ? (
                  <span className="relative inline-grid">
                    {/* Halo pulsé derrière le bouton : le bouton reste immobile, plus facile à toucher. */}
                    <motion.span
                      aria-hidden="true"
                      className="absolute inset-0 rounded-full bg-[#FFC93C]/40"
                      animate={{ scale: [1, 1.12, 1], opacity: [0.6, 0, 0.6] }}
                      transition={{ duration: 1.6, repeat: Infinity }}
                    />
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => claim(m)}
                      className="relative inline-flex h-9 items-center gap-1.5 rounded-full bg-[#FFC93C] px-3 text-xs font-bold text-bg shadow-[0_0_24px_-4px_#FFC93C] disabled:opacity-60"
                    >
                      Réclamer <Jetons value={m.reward} />
                    </button>
                  </span>
                ) : (
                  <Jetons value={m.reward} className="text-xs text-muted" />
                )}
                <AnimatePresence>{burst === m.kind && <CoinBurst key={m.kind} />}</AnimatePresence>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
