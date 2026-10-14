"use client";

import { FINISH_LABELS_FR } from "@pokeflex/config";
import type { PlayerRef, TradeableGroup } from "@pokeflex/server";
import { ArrowDownLeft, ArrowUpRight, Check, Heart, Loader2, Search, Send, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { proposeTradeAction } from "@/app/actions/trades";
import { CardImage } from "@/components/card-image";
import { TIER_ICON } from "@/components/tier-badge";
import { toast } from "@/components/toaster";
import { Button } from "@/components/ui/button";
import { pingTrade } from "@/lib/trades";
import { cn } from "@/lib/utils";

const keyOf = (g: { cardId: string; finish: string }) => `${g.cardId}:${g.finish}`;

function Picker({
  groups,
  selected,
  onToggle,
  wishedLabel,
  empty,
  full,
}: {
  groups: TradeableGroup[];
  selected: Set<string>;
  onToggle: (key: string) => void;
  wishedLabel: string;
  empty: string;
  full: boolean;
}) {
  const [q, setQ] = useState("");
  const [onlyWished, setOnlyWished] = useState(false);
  const hasWished = groups.some((g) => g.wished);
  const shown = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase("fr").normalize("NFD").replace(/\p{M}/gu, "");
    return groups.filter(
      (g) =>
        (!onlyWished || g.wished) &&
        (!needle || `${g.name} ${g.setName}`.toLocaleLowerCase("fr").normalize("NFD").replace(/\p{M}/gu, "").includes(needle)),
    );
  }, [groups, q, onlyWished]);

  if (groups.length === 0) return <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">{empty}</p>;

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Filtrer les cartes</span>
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filtrer par nom ou set"
            className="h-10 w-full rounded-full border border-line bg-surface pr-3 pl-9 text-sm outline-none focus:border-accent"
          />
        </label>
        {hasWished && (
          <button type="button" className="pf-chip" aria-pressed={onlyWished} onClick={() => setOnlyWished((v) => !v)}>
            <Heart aria-hidden="true" className="size-3.5 text-coral" />
            {wishedLabel}
          </button>
        )}
      </div>
      {shown.length === 0 ? (
        <p className="p-4 text-center text-sm text-muted">Aucune carte ne correspond.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-4 md:grid-cols-6">
          {shown.map((g) => {
            const key = keyOf(g);
            const on = selected.has(key);
            return (
              <li key={key}>
                <button
                  type="button"
                  aria-pressed={on}
                  disabled={!on && full}
                  onClick={() => onToggle(key)}
                  className="pf-tile group grid w-full gap-1.5 text-left outline-none disabled:opacity-40"
                  data-tier={g.tier}
                >
                  <span
                    className={cn(
                      "pf-tile-frame relative block rounded-[var(--radius-card-image)]",
                      on && "ring-[3px] ring-lime ring-offset-2 ring-offset-bg",
                    )}
                  >
                    <CardImage image={g.image} name={g.name} />
                    <span aria-hidden="true" className="pf-tier-pip absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full bg-bg/85 text-[11px] backdrop-blur">
                      {TIER_ICON[g.tier]}
                    </span>
                    {on && (
                      <span aria-hidden="true" className="absolute top-1.5 left-1.5 grid size-6 place-items-center rounded-full bg-lime text-bg">
                        <Check className="size-4" />
                      </span>
                    )}
                    <span className="absolute inset-x-1.5 bottom-1.5 flex flex-wrap gap-1">
                      {g.finish !== "normal" && (
                        <span className="rounded bg-bg/85 px-1 py-0.5 font-mono text-[9px] font-bold backdrop-blur">{FINISH_LABELS_FR[g.finish]}</span>
                      )}
                      {g.count > 1 && <span className="rounded bg-bg/85 px-1 py-0.5 font-mono text-[9px] font-bold backdrop-blur">×{g.count}</span>}
                    </span>
                  </span>
                  <span className="grid min-w-0 gap-0.5 px-0.5">
                    <span className="truncate text-xs font-semibold">{g.name}</span>
                    <span className="flex min-w-0 items-center gap-1 text-[10px]">
                      {g.wished ? (
                        <span className="inline-flex items-center gap-0.5 text-coral">
                          <Heart aria-hidden="true" className="size-3 fill-current" />
                          Wishlist
                        </span>
                      ) : g.isNew ? (
                        <span className="inline-flex items-center gap-0.5 text-lime">
                          <Sparkles aria-hidden="true" className="size-3" />
                          Nouvelle
                        </span>
                      ) : (
                        <span className="truncate font-mono text-muted">{g.setName}</span>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * Composition d'une offre : cartes demandées à l'autre joueur, cartes proposées en retour, petit mot.
 * Le client n'envoie que les exemplaires choisis ; le serveur revérifie tout.
 */
export function TradeComposer({
  other,
  mine,
  theirs,
  initialGive = [],
  initialTake = [],
  counterOf,
  maxPerSide,
  messageMaxLength,
}: {
  other: PlayerRef;
  mine: TradeableGroup[];
  theirs: TradeableGroup[];
  initialGive?: string[];
  initialTake?: string[];
  counterOf?: string | null;
  maxPerSide: number;
  messageMaxLength: number;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"take" | "give">(initialTake.length > 0 && initialGive.length === 0 ? "give" : "take");
  const [give, setGive] = useState(() => new Set(initialGive.filter((k) => mine.some((g) => keyOf(g) === k))));
  const [take, setTake] = useState(() => new Set(initialTake.filter((k) => theirs.some((g) => keyOf(g) === k))));
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();

  const toggle = (set: Set<string>, update: (s: Set<string>) => void) => (key: string) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else if (next.size < maxPerSide) next.add(key);
    update(next);
  };

  const copyIds = (keys: Set<string>, groups: TradeableGroup[]) => groups.filter((g) => keys.has(keyOf(g))).map((g) => g.copyId);
  const ready = give.size > 0 && take.size > 0;

  function submit() {
    start(async () => {
      const res = await proposeTradeAction({ to: other.id, give: copyIds(give, mine), take: copyIds(take, theirs), message, counterOf: counterOf ?? null });
      if (!res.ok) {
        toast({ title: res.error, tone: "error" });
        return;
      }
      pingTrade(res.data.tradeId);
      toast({ title: counterOf ? "Contre-proposition envoyée" : "Proposition envoyée", description: `${other.name} peut l'accepter, la refuser ou te répondre.` });
      router.push("/echanges");
      router.refresh();
    });
  }

  const tabs = [
    { id: "take" as const, label: "Tu demandes", icon: ArrowDownLeft, count: take.size },
    { id: "give" as const, label: "Tu proposes", icon: ArrowUpRight, count: give.size },
  ];

  return (
    <div className="grid gap-5">
      <div role="tablist" aria-label="Côté de l'échange" className="grid grid-cols-2 gap-1 rounded-full border border-line bg-surface p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex h-10 items-center justify-center gap-2 rounded-full text-sm font-semibold transition-colors",
              tab === t.id ? "bg-elev text-fg shadow-[inset_0_0_0_1px_var(--color-accent)]" : "text-muted hover:text-fg",
            )}
          >
            <t.icon aria-hidden="true" className={cn("size-4", t.id === "take" ? "text-lime" : "text-coral")} />
            {t.label}
            <span className="rounded-full bg-bg px-1.5 font-mono text-[11px]">{t.count}</span>
          </button>
        ))}
      </div>

      <div role="tabpanel" aria-label={tab === "take" ? `Cartes de ${other.name}` : "Tes cartes"}>
        {tab === "take" ? (
          <Picker
            groups={theirs}
            selected={take}
            onToggle={toggle(take, setTake)}
            wishedLabel="Ma wishlist"
            empty={`${other.name} n'a aucune carte échangeable pour l'instant (les favoris et les cartes en vente ne s'échangent pas).`}
            full={take.size >= maxPerSide}
          />
        ) : (
          <Picker
            groups={mine}
            selected={give}
            onToggle={toggle(give, setGive)}
            wishedLabel="Sa wishlist"
            empty="Tu n'as aucune carte échangeable (les favoris et les cartes en vente ne s'échangent pas)."
            full={give.size >= maxPerSide}
          />
        )}
      </div>

      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 grid gap-3 rounded-2xl border border-accent/40 bg-surface/95 p-3 shadow-[0_18px_40px_-12px_rgb(0_0_0/0.8)] backdrop-blur md:bottom-4">
        <p className="text-xs text-muted">
          {ready
            ? `Tu demandes ${take.size} carte${take.size > 1 ? "s" : ""} et tu en proposes ${give.size}. ${maxPerSide} au plus de chaque côté.`
            : take.size === 0
              ? `Choisis au moins une carte de ${other.name}.`
              : "Choisis au moins une de tes cartes à proposer en retour."}
        </p>
        <div className="grid gap-2 sm:flex sm:items-center">
          <label className="min-w-0 sm:flex-1">
            <span className="sr-only">Petit mot (facultatif)</span>
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={messageMaxLength}
              placeholder="Petit mot (facultatif)"
              className="h-10 w-full rounded-full border border-line bg-bg px-4 text-sm outline-none focus:border-accent"
            />
          </label>
          {!ready && take.size > 0 && tab === "take" ? (
            <Button size="sm" variant="secondary" onClick={() => setTab("give")}>
              Choisir mes cartes
            </Button>
          ) : (
            <Button size="sm" onClick={submit} disabled={!ready || pending}>
              {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Send aria-hidden="true" />}
              {counterOf ? "Envoyer la contre-proposition" : "Envoyer la proposition"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
