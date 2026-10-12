"use client";

import { FINISH_LABELS_FR, type Finish } from "@pokeflex/config";
import { ChevronDown, Recycle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { recycleCopyAction } from "@/app/actions/economy";
import { Jetons } from "@/components/jetons";
import { toast } from "@/components/toaster";
import { emitBalance } from "@/lib/balance-events";
import { cn } from "@/lib/utils";

export interface CopyView {
  id: string;
  finish: Finish;
  status: "owned" | "listed" | "staked";
  obtainedAt: string;
  obtainedVia: string;
}

const VIA: Record<string, string> = { booster: "Booster", set_booster: "Booster de set", market: "Marché", duel: "Duel", seed: "Démo" };
const STATUS: Record<CopyView["status"], string> = { owned: "", listed: "En vente", staked: "Misé en duel" };
const date = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });

/** Exemplaires possédés d'une carte, avec recyclage unitaire (confirmation en deux temps). */
export function MyCopies({ copies, value }: { copies: CopyView[]; value: number }) {
  const router = useRouter();
  const [list, setList] = useState(copies);
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => setList(copies), [copies]);
  useEffect(() => {
    if (!confirming) return;
    const t = window.setTimeout(() => setConfirming(null), 4000);
    return () => window.clearTimeout(t);
  }, [confirming]);

  if (list.length === 0) {
    return <div className="rounded-xl border border-dashed border-line p-3 text-sm text-muted">Tu n&apos;as pas encore cette carte.</div>;
  }

  const byFinish = (Object.keys(FINISH_LABELS_FR) as Finish[]).map((f) => [f, list.filter((c) => c.finish === f).length] as const).filter(([, n]) => n > 0);

  function recycle(id: string) {
    if (confirming !== id) return setConfirming(id);
    setConfirming(null);
    start(async () => {
      const res = await recycleCopyAction(id);
      if (!res.ok) {
        toast({ title: "Recyclage impossible", description: res.error, tone: "error" });
        return;
      }
      setList((l) => l.filter((c) => c.id !== id));
      emitBalance(res.data.balance);
      toast({ title: "Exemplaire recyclé", jetons: res.data.total });
      for (const q of res.data.questsDone) toast({ title: "Quête terminée", description: q.label, tone: "info" });
      router.refresh();
    });
  }

  return (
    <div className="grid rounded-xl border border-lime/40 bg-lime/5 text-sm">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex flex-wrap items-center gap-2 p-3 text-left">
        <span className="font-semibold text-lime">Dans ta collection : ×{list.length}</span>
        {byFinish.map(([f, n]) => (
          <span key={f} className="rounded-full bg-elev px-2 py-0.5 text-xs">
            {FINISH_LABELS_FR[f]} ×{n}
          </span>
        ))}
        <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted">
          Gérer
          <ChevronDown aria-hidden="true" className={cn("size-4 transition-transform", open && "rotate-180")} />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ul
            className="grid overflow-hidden border-t border-lime/20"
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            transition={{ duration: 0.22 }}
          >
            {list.map((c) => {
              const last = list.filter((x) => x.status === "owned").length === 1 && c.status === "owned";
              return (
                <motion.li key={c.id} layout exit={{ opacity: 0, x: -30 }} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5">
                  <span className="rounded-full bg-elev px-2 py-0.5 text-xs font-semibold">{FINISH_LABELS_FR[c.finish]}</span>
                  <span className="text-xs text-muted">
                    {VIA[c.obtainedVia] ?? c.obtainedVia} · {date.format(new Date(c.obtainedAt))}
                  </span>
                  {c.status !== "owned" ? (
                    <span className="ml-auto text-xs text-accent">{STATUS[c.status]}</span>
                  ) : (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => recycle(c.id)}
                      className={cn(
                        "ml-auto inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors disabled:opacity-50",
                        confirming === c.id ? "border-coral bg-coral/15 text-fg" : "border-line hover:border-[#FFC93C]",
                      )}
                    >
                      <Recycle aria-hidden="true" className="size-3.5" />
                      {confirming === c.id ? (last ? "Ton dernier exemplaire, confirmer ?" : "Confirmer ?") : <>Recycler · <Jetons value={value} signed /></>}
                    </button>
                  )}
                </motion.li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
