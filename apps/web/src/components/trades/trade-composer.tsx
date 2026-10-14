"use client";

import { FINISH_LABELS_FR } from "@pokeflex/config";
import type { PlayerRef, TradeableGroup, TradePickerPage, TradeSide } from "@pokeflex/server";
import { ArrowDownLeft, ArrowUpRight, Check, Heart, Loader2, Search, Send, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState, useTransition } from "react";
import { proposeTradeAction, tradePickerPageAction } from "@/app/actions/trades";
import { CardImage } from "@/components/card-image";
import { Pagination } from "@/components/pagination";
import { TIER_ICON } from "@/components/tier-badge";
import { toast } from "@/components/toaster";
import { Button } from "@/components/ui/button";
import { pingTrade } from "@/lib/trades";
import { cn } from "@/lib/utils";

const keyOf = (g: { cardId: string; finish: string }) => `${g.cardId}:${g.finish}`;

function Picker({
  otherId,
  side,
  initial,
  selected,
  onToggle,
  wishedLabel,
  intro,
  empty,
  full,
}: {
  otherId: string;
  side: TradeSide;
  initial: TradePickerPage;
  selected: Map<string, TradeableGroup>;
  onToggle: (group: TradeableGroup) => void;
  wishedLabel: string;
  intro?: ReactNode;
  empty: string;
  full: boolean;
}) {
  const [q, setQ] = useState("");
  const [onlyWished, setOnlyWished] = useState(false);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(false);
  const top = useRef<HTMLDivElement>(null);
  const request = useRef(0);
  const first = useRef(true);

  // Recherche et pagination côté serveur : une collection complète ne tient pas dans le navigateur.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const id = ++request.current;
    setLoading(true);
    const timer = setTimeout(async () => {
      const res = await tradePickerPageAction({ other: otherId, side, q, onlyWished, page });
      if (id !== request.current) return;
      setLoading(false);
      if (!res.ok) {
        toast({ title: res.error, tone: "error" });
        return;
      }
      setData(res.data);
    }, 250);
    return () => clearTimeout(timer);
  }, [otherId, side, q, onlyWished, page]);

  const goTo = (p: number) => {
    setPage(p);
    top.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  if (initial.total === 0) return <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">{empty}</p>;

  const chosen = [...selected.values()];
  return (
    <div ref={top} className="grid scroll-mt-24 gap-3">
      {intro}
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Filtrer les cartes</span>
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Filtrer par nom ou set"
            className="h-10 w-full rounded-full border border-line bg-surface pr-3 pl-9 text-sm outline-none focus:border-accent"
          />
        </label>
        {(initial.wished > 0 || onlyWished) && (
          <button
            type="button"
            className="pf-chip"
            aria-pressed={onlyWished}
            onClick={() => {
              setOnlyWished((v) => !v);
              setPage(1);
            }}
          >
            <Heart aria-hidden="true" className="size-3.5 text-coral" />
            {wishedLabel}
            <span className="font-mono text-[11px] text-muted">{data.wished}</span>
          </button>
        )}
      </div>
      {chosen.length > 0 && (
        <ul aria-label="Cartes choisies" className="flex flex-wrap gap-1.5">
          {chosen.map((g) => (
            <li key={keyOf(g)}>
              <button type="button" onClick={() => onToggle(g)} className="pf-chip max-w-full text-xs" aria-label={`Retirer ${g.name}`}>
                <Check aria-hidden="true" className="size-3.5 shrink-0 text-lime" />
                <span className="truncate">
                  {g.name}
                  {g.finish !== "normal" && ` · ${FINISH_LABELS_FR[g.finish]}`}
                </span>
                <X aria-hidden="true" className="size-3.5 shrink-0 text-muted" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="flex items-center gap-2 text-xs text-muted" aria-live="polite">
        {loading && <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />}
        {data.total} carte{data.total > 1 ? "s" : ""}
        {data.pageCount > 1 && ` · page ${data.page} / ${data.pageCount}`}
      </p>
      {data.groups.length === 0 ? (
        <p className="p-4 text-center text-sm text-muted">Aucune carte ne correspond.</p>
      ) : (
        <ul className={cn("grid grid-cols-3 gap-x-3 gap-y-4 transition-opacity sm:grid-cols-4 md:grid-cols-6", loading && "opacity-60")}>
          {data.groups.map((g) => {
            const key = keyOf(g);
            const on = selected.has(key);
            return (
              <li key={key}>
                <button
                  type="button"
                  aria-pressed={on}
                  disabled={!on && full}
                  onClick={() => onToggle(g)}
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
      <Pagination info={data} onPage={goTo} label="Pages de cartes" />
    </div>
  );
}

/** Ce que l'autre joueur recherche, et combien de ces cartes le joueur peut lui proposer. */
function WishlistHint({ other, size, matches }: { other: PlayerRef; size: number; matches: number }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-coral/30 bg-coral/5 px-3 py-2 text-sm">
      <Heart aria-hidden="true" className="size-4 shrink-0 fill-current text-coral" />
      <span className="min-w-0">
        {size === 0
          ? `${other.name} n'a encore rien mis dans sa wishlist.`
          : matches === 0
            ? `${other.name} recherche ${size} carte${size > 1 ? "s" : ""}, aucune parmi tes cartes échangeables.`
            : `${other.name} recherche ${size} carte${size > 1 ? "s" : ""} : tu en as ${matches} à lui proposer (filtre « Sa wishlist »).`}
      </span>
      {size > 0 && other.handle && (
        <Link href={`/joueurs/${other.handle}#wishlist`} className="text-accent hover:underline">
          Voir sa wishlist
        </Link>
      )}
    </p>
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
  theirWishlist,
  counterOf,
  maxPerSide,
  messageMaxLength,
}: {
  other: PlayerRef;
  mine: TradePickerPage;
  theirs: TradePickerPage;
  initialGive?: TradeableGroup[];
  initialTake?: TradeableGroup[];
  /** Taille de la wishlist de l'autre joueur, null s'il ne la montre pas. */
  theirWishlist: number | null;
  counterOf?: string | null;
  maxPerSide: number;
  messageMaxLength: number;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"take" | "give">(initialTake.length > 0 && initialGive.length === 0 ? "give" : "take");
  // Les cartes choisies restent retenues d'une page ou d'une recherche à l'autre.
  const [give, setGive] = useState(() => new Map(initialGive.map((g) => [keyOf(g), g])));
  const [take, setTake] = useState(() => new Map(initialTake.map((g) => [keyOf(g), g])));
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();

  const toggle = (update: (fn: (s: Map<string, TradeableGroup>) => Map<string, TradeableGroup>) => void) => (group: TradeableGroup) =>
    update((current) => {
      const next = new Map(current);
      const key = keyOf(group);
      if (next.has(key)) next.delete(key);
      else if (next.size < maxPerSide) next.set(key, group);
      return next;
    });

  const copyIds = (chosen: Map<string, TradeableGroup>) => [...chosen.values()].map((g) => g.copyId);
  const ready = give.size > 0 && take.size > 0;

  function submit() {
    start(async () => {
      const res = await proposeTradeAction({ to: other.id, give: copyIds(give), take: copyIds(take), message, counterOf: counterOf ?? null });
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

      {/* Les deux côtés restent montés : recherche, filtre et page survivent au changement d'onglet. */}
      <div role="tabpanel" aria-label={`Cartes de ${other.name}`} hidden={tab !== "take"}>
        <Picker
          otherId={other.id}
          side="theirs"
          initial={theirs}
          selected={take}
          onToggle={toggle(setTake)}
          wishedLabel="Ma wishlist"
          empty={`${other.name} n'a aucune carte échangeable pour l'instant (les favoris et les cartes en vente ne s'échangent pas).`}
          full={take.size >= maxPerSide}
        />
      </div>
      <div role="tabpanel" aria-label="Tes cartes" hidden={tab !== "give"}>
        <Picker
          otherId={other.id}
          side="mine"
          initial={mine}
          selected={give}
          onToggle={toggle(setGive)}
          wishedLabel="Sa wishlist"
          intro={theirWishlist !== null && <WishlistHint other={other} size={theirWishlist} matches={mine.wishedCards} />}
          empty="Tu n'as aucune carte échangeable (les favoris et les cartes en vente ne s'échangent pas)."
          full={give.size >= maxPerSide}
        />
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
