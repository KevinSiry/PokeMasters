"use client";

import type { Tier } from "@pokeflex/config";
import { ChevronLeft, ChevronRight, Loader2, Plus, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { setShowcaseAction, showcaseCandidatesAction } from "@/app/actions/social";
import { CardImage } from "@/components/card-image";
import { TIER_ICON, TIER_TEXT } from "@/components/tier-badge";
import { toast } from "@/components/toaster";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Card {
  id: string;
  name: string;
  image: string | null;
  tier: Tier;
  setName: string;
}

/** Choix et ordre des cartes de la vitrine, parmi celles que le joueur possède. */
export function ShowcaseEditor({ initial, max }: { initial: Card[]; max: number }) {
  const router = useRouter();
  const [cards, setCards] = useState<Card[]>(initial);
  const [q, setQ] = useState("");
  const [candidates, setCandidates] = useState<Card[] | null>(null);
  const [pending, start] = useTransition();
  const dirty = cards.map((c) => c.id).join() !== initial.map((c) => c.id).join();
  const full = cards.length >= max;

  useEffect(() => {
    const t = window.setTimeout(async () => {
      const res = await showcaseCandidatesAction(q);
      if (res.ok) setCandidates(res.data);
    }, 200);
    return () => window.clearTimeout(t);
  }, [q]);

  const move = (i: number, d: -1 | 1) =>
    setCards((all) => {
      const next = [...all];
      const j = i + d;
      if (j < 0 || j >= next.length) return all;
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });

  function save() {
    start(async () => {
      const res = await setShowcaseAction(cards.map((c) => c.id));
      if (!res.ok) {
        toast({ title: res.error, tone: "error" });
        return;
      }
      toast({ title: "Vitrine enregistrée" });
      router.refresh();
    });
  }

  return (
    <section
      id="vitrine"
      className="grid scroll-mt-24 gap-4 rounded-[calc(var(--radius-card)*1.2)] border border-line bg-surface p-5 sm:p-6"
      aria-labelledby="vitrine-titre"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <h2 id="vitrine-titre" className="font-display text-lg font-bold">
            Vitrine
          </h2>
          <p className="text-sm text-muted">Jusqu&apos;à {max} cartes, affichées dans cet ordre sur ton profil.</p>
        </div>
        <Button onClick={save} disabled={!dirty || pending}>
          {pending && <Loader2 aria-hidden="true" className="animate-spin" />}
          Enregistrer la vitrine
        </Button>
      </div>

      <ol className="grid grid-cols-3 gap-3 sm:grid-cols-6" aria-label="Cartes en vitrine">
        {Array.from({ length: max }, (_, i) => {
          const c = cards[i];
          return (
            <li key={c?.id ?? `vide-${i}`} className="relative">
              {c ? (
                <div className="group grid gap-1.5">
                  <CardImage image={c.image} name={c.name} className="rounded-[var(--radius-card-image)]" />
                  <div className="absolute inset-x-1 top-1 flex justify-between opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      aria-label={`Avancer ${c.name}`}
                      className="grid size-7 place-items-center rounded-full bg-bg/85 disabled:opacity-0"
                    >
                      <ChevronLeft aria-hidden="true" className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setCards((all) => all.filter((x) => x.id !== c.id))}
                      aria-label={`Retirer ${c.name}`}
                      className="grid size-7 place-items-center rounded-full bg-bg/85 text-coral"
                    >
                      <X aria-hidden="true" className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(i, 1)}
                      disabled={i === cards.length - 1}
                      aria-label={`Reculer ${c.name}`}
                      className="grid size-7 place-items-center rounded-full bg-bg/85 disabled:opacity-0"
                    >
                      <ChevronRight aria-hidden="true" className="size-4" />
                    </button>
                  </div>
                  <span className="truncate text-xs font-semibold">{c.name}</span>
                </div>
              ) : (
                <div className="grid aspect-[63/88] place-items-center rounded-[var(--radius-card-image)] border-2 border-dashed border-line text-muted">
                  <span className="font-mono text-sm">{i + 1}</span>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <div className="grid gap-3 border-t border-line pt-4">
        <label className="relative">
          <span className="sr-only">Chercher une carte de ma collection</span>
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Chercher dans ma collection…"
            className="h-11 w-full rounded-xl border border-line bg-bg pr-3 pl-9 outline-none focus:border-accent"
          />
        </label>
        {candidates === null ? (
          <p className="text-sm text-muted">Chargement de ta collection…</p>
        ) : candidates.length === 0 ? (
          <p className="text-sm text-muted">{q ? "Aucune carte trouvée." : "Ouvre des boosters pour remplir ta vitrine\u00a0!"}</p>
        ) : (
          <ul className="grid max-h-80 grid-cols-1 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
            {candidates.map((c) => {
              const chosen = cards.some((x) => x.id === c.id);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    disabled={chosen || full}
                    onClick={() => setCards((all) => [...all, c])}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border border-line px-2.5 py-2 text-left text-sm transition-colors hover:border-accent disabled:cursor-not-allowed",
                      chosen ? "border-accent/60 bg-accent/10" : full && "opacity-50",
                    )}
                  >
                    <span className="w-8 shrink-0">
                      <CardImage image={c.image} name={c.name} className="rounded-[var(--radius-card-image)]" />
                    </span>
                    <span className="grid min-w-0 flex-1">
                      <span className="truncate font-semibold">{c.name}</span>
                      <span className={cn("truncate text-xs", TIER_TEXT[c.tier])}>
                        <span aria-hidden="true">{TIER_ICON[c.tier]}</span> {c.setName}
                      </span>
                    </span>
                    {chosen ? <span className="text-xs text-accent">En vitrine</span> : <Plus aria-hidden="true" className="size-4 text-muted" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
