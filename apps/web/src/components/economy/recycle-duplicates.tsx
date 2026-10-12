"use client";

import { TIER_LABELS_FR, type Tier } from "@pokeflex/config";
import { Check, Recycle } from "lucide-react";
import { animate, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { previewDuplicatesAction, recycleDuplicatesAction } from "@/app/actions/economy";
import { CoinBurst } from "@/components/economy/coin-burst";
import { Jetons } from "@/components/jetons";
import { TIER_ICON } from "@/components/tier-badge";
import { toast } from "@/components/toaster";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { emitBalance } from "@/lib/balance-events";
import { cn, formatJetons } from "@/lib/utils";

type Row = { tier: Tier; count: number; value: number };

/** Par défaut on garde les doublons Légendaire et Mythique : ils valent cher au marché. */
const DEFAULT_TIERS: Tier[] = ["common", "uncommon", "rare", "epic"];

function CountUp({ to }: { to: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const c = animate(0, to, { duration: 0.9, ease: "easeOut", onUpdate: (x) => setV(Math.round(x)) });
    return () => c.stop();
  }, [to]);
  return <>{formatJetons(v)}</>;
}

export function RecycleDuplicates() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [selected, setSelected] = useState<Set<Tier>>(new Set(DEFAULT_TIERS));
  const [done, setDone] = useState<{ total: number; count: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function openDialog() {
    setOpen(true);
    setDone(null);
    setError(null);
    setRows(null);
    start(async () => setRows(await previewDuplicatesAction()));
  }

  const chosen = (rows ?? []).filter((r) => selected.has(r.tier) && r.count > 0);
  const count = chosen.reduce((n, r) => n + r.count, 0);
  const total = chosen.reduce((n, r) => n + r.value, 0);
  const anyDup = (rows ?? []).some((r) => r.count > 0);

  function confirm() {
    setError(null);
    start(async () => {
      const res = await recycleDuplicatesAction([...selected]);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDone({ total: res.data.total, count: res.data.count });
      emitBalance(res.data.balance);
      for (const q of res.data.questsDone) toast({ title: "Quête terminée", description: `${q.label} : réclame ta récompense à l'accueil.`, tone: "info" });
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={openDialog}>
        <Recycle aria-hidden="true" />
        Recycler les doublons
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={done ? "Doublons recyclés" : "Recycler les doublons"}
        description={done ? undefined : "Tu gardes toujours un exemplaire de chaque carte, le plus beau (holo, reverse…) en priorité."}
      >
        {done ? (
          <div className="relative grid justify-items-center gap-2 py-6 text-center">
            <CoinBurst />
            <motion.p
              className="font-display text-5xl font-bold text-[#FFC93C]"
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 16 }}
            >
              +<CountUp to={done.total} />
            </motion.p>
            <p className="text-muted">Jetons pour {done.count} carte{done.count > 1 ? "s" : ""} recyclée{done.count > 1 ? "s" : ""}</p>
            <Button className="mt-4" onClick={() => setOpen(false)}>
              Super
            </Button>
          </div>
        ) : rows === null ? (
          <div className="grid gap-2" aria-busy="true">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="pf-shimmer h-12 rounded-xl" />
            ))}
          </div>
        ) : !anyDup ? (
          <p className="rounded-xl bg-elev p-4 text-center text-sm text-muted">Aucun doublon pour l&apos;instant. Ouvre des boosters !</p>
        ) : (
          <>
            <ul className="grid gap-1.5">
              {rows.map((r) => {
                const on = selected.has(r.tier);
                return (
                  <li key={r.tier}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      disabled={r.count === 0}
                      onClick={() =>
                        setSelected((s) => {
                          const n = new Set(s);
                          if (n.has(r.tier)) n.delete(r.tier);
                          else n.add(r.tier);
                          return n;
                        })
                      }
                      data-tier={r.tier}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left text-sm transition-colors disabled:opacity-40",
                        on && r.count > 0 ? "border-[var(--tier)] bg-elev" : "border-line",
                      )}
                    >
                      <span className={cn("grid size-5 shrink-0 place-items-center rounded-md border", on && r.count > 0 ? "border-[var(--tier)] bg-[var(--tier)] text-bg" : "border-line")}>
                        {on && r.count > 0 && <Check aria-hidden="true" className="size-3.5" strokeWidth={3} />}
                      </span>
                      <span aria-hidden="true" className="text-[var(--tier)]">
                        {TIER_ICON[r.tier]}
                      </span>
                      <span className="flex-1 font-semibold">{TIER_LABELS_FR[r.tier]}</span>
                      <span className="font-mono text-xs text-muted">×{r.count}</span>
                      <Jetons value={r.value} className="w-20 justify-end text-xs" />
                    </button>
                  </li>
                );
              })}
            </ul>
            {error && (
              <p role="alert" className="rounded-xl bg-danger/15 px-4 py-2 text-sm text-danger">
                {error}
              </p>
            )}
            <Button size="lg" onClick={confirm} disabled={pending || count === 0}>
              <Recycle aria-hidden="true" />
              {count === 0 ? "Choisis au moins une rareté" : <>Recycler {count} carte{count > 1 ? "s" : ""} · <Jetons value={total} signed /></>}
            </Button>
          </>
        )}
      </Dialog>
    </>
  );
}
