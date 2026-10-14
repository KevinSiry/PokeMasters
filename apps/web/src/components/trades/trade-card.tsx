"use client";

import { FINISH_LABELS_FR } from "@pokeflex/config";
import type { TradeItemView, TradeView } from "@pokeflex/server";
import { ArrowDownLeft, ArrowUpRight, Check, Clock, Loader2, Repeat2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { acceptTradeAction, cancelTradeAction, declineTradeAction } from "@/app/actions/trades";
import { CardImage } from "@/components/card-image";
import { PlayerAvatar } from "@/components/player-avatar";
import { toast } from "@/components/toaster";
import { Button } from "@/components/ui/button";
import { pingTrade } from "@/lib/trades";
import { cn } from "@/lib/utils";

const STATUS: Record<TradeView["status"], { label: string; className: string }> = {
  pending: { label: "En attente", className: "border-accent/50 text-accent" },
  accepted: { label: "Conclu", className: "border-lime/50 text-lime" },
  declined: { label: "Refusé", className: "border-line text-muted" },
  cancelled: { label: "Annulé", className: "border-line text-muted" },
  countered: { label: "Contre-proposition", className: "border-coral/50 text-coral" },
  expired: { label: "Expiré", className: "border-line text-muted" },
  unavailable: { label: "Carte indisponible", className: "border-line text-muted" },
};

const when = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });

function ItemRow({ items, pending }: { items: TradeItemView[]; pending: boolean }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((i) => (
        <li key={i.id} className="w-[4.5rem] sm:w-20">
          <Link href={`/cartes/${i.cardId}`} className="pf-tile group grid gap-1" data-tier={i.tier}>
            <div className={cn("pf-tile-frame relative rounded-[var(--radius-card-image)]", pending && !i.available && "opacity-40 grayscale")}>
              <CardImage image={i.image} name={i.name} />
              {i.finish !== "normal" && (
                <span className="absolute right-1 bottom-1 rounded bg-bg/85 px-1 py-0.5 font-mono text-[9px] font-bold backdrop-blur">
                  {FINISH_LABELS_FR[i.finish]}
                </span>
              )}
            </div>
            <span className="truncate text-[11px] font-semibold">{i.name}</span>
            {pending && !i.available && <span className="text-[10px] leading-tight text-coral">Plus disponible</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Une proposition d'échange : ce que le joueur reçoit, ce qu'il donne, et les actions possibles. */
export function TradeCard({ trade }: { trade: TradeView }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<"accept" | "decline" | "cancel" | null>(null);
  const isPending = trade.status === "pending";
  const blocked = isPending && [...trade.give, ...trade.receive].some((i) => !i.available);
  const other = trade.other;

  function act(kind: "accept" | "decline" | "cancel") {
    setBusy(kind);
    start(async () => {
      const res = kind === "accept" ? await acceptTradeAction(trade.id) : kind === "decline" ? await declineTradeAction(trade.id) : await cancelTradeAction(trade.id);
      setBusy(null);
      if (!res.ok) {
        toast({ title: res.error, tone: "error" });
        router.refresh();
        return;
      }
      pingTrade(trade.id);
      if (kind === "accept") {
        toast({ title: "Échange conclu !", description: "Tes nouvelles cartes sont dans ta collection." });
        const sets = (res.data as { completedSets?: { name: string; bonus: number }[] }).completedSets ?? [];
        for (const s of sets) toast({ title: `Set complété : ${s.name}`, jetons: s.bonus });
      } else {
        toast({ title: kind === "decline" ? "Proposition refusée" : "Proposition annulée", tone: "info" });
      }
      router.refresh();
    });
  }

  const status = STATUS[trade.status];
  return (
    <article
      className={cn(
        "grid gap-4 rounded-[calc(var(--radius-card)*1.2)] border bg-surface p-4 sm:p-5",
        isPending && trade.role === "received" ? "border-accent/50 shadow-[0_0_0_1px_color-mix(in_srgb,var(--color-accent)_25%,transparent)]" : "border-line",
      )}
    >
      <header className="flex flex-wrap items-center gap-3">
        <PlayerAvatar name={other.name} image={other.image} size="sm" />
        <div className="grid min-w-0 flex-1 gap-0.5">
          <p className="truncate text-sm">
            {trade.role === "received" ? (
              <>
                {other.handle ? <Link href={`/joueurs/${other.handle}`} className="font-semibold hover:text-accent">{other.name}</Link> : <span className="font-semibold">{other.name}</span>}
                {trade.isCounter ? " te fait une contre-proposition" : " te propose un échange"}
              </>
            ) : (
              <>
                {trade.isCounter ? "Ta contre-proposition à " : "Ta proposition à "}
                {other.handle ? <Link href={`/joueurs/${other.handle}`} className="font-semibold hover:text-accent">{other.name}</Link> : <span className="font-semibold">{other.name}</span>}
              </>
            )}
          </p>
          <p className="flex items-center gap-1 text-[11px] text-muted">
            <Clock aria-hidden="true" className="size-3" />
            {isPending ? `Expire le ${when.format(new Date(trade.expiresAt))}` : when.format(new Date(trade.closedAt ?? trade.createdAt))}
          </p>
        </div>
        <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold", status.className)}>{status.label}</span>
      </header>

      {trade.message && <p className="rounded-xl bg-elev px-3 py-2 text-sm italic">« {trade.message} »</p>}

      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <section className="grid content-start gap-2 rounded-xl border border-lime/30 bg-lime/5 p-3">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold text-lime">
            <ArrowDownLeft aria-hidden="true" className="size-3.5" />
            Tu reçois
          </h3>
          <ItemRow items={trade.receive} pending={isPending} />
        </section>
        <section className="grid content-start gap-2 rounded-xl border border-coral/30 bg-coral/5 p-3">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold text-coral">
            <ArrowUpRight aria-hidden="true" className="size-3.5" />
            Tu donnes
          </h3>
          <ItemRow items={trade.give} pending={isPending} />
        </section>
      </div>

      {isPending && (
        <footer className="flex flex-wrap items-center gap-2">
          {blocked && <p className="w-full text-xs text-coral">Une carte n&apos;est plus disponible : cet échange ne peut plus être conclu.</p>}
          {trade.role === "received" ? (
            <>
              <Button size="sm" onClick={() => act("accept")} disabled={pending || blocked}>
                {busy === "accept" ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Check aria-hidden="true" />}
                Accepter
              </Button>
              <Button size="sm" variant="secondary" asChild>
                <Link href={`/echanges/nouveau?contre=${trade.id}`}>
                  <Repeat2 aria-hidden="true" />
                  Contre-proposer
                </Link>
              </Button>
              <Button size="sm" variant="ghost" onClick={() => act("decline")} disabled={pending}>
                {busy === "decline" ? <Loader2 aria-hidden="true" className="animate-spin" /> : <X aria-hidden="true" />}
                Refuser
              </Button>
            </>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => act("cancel")} disabled={pending}>
              {busy === "cancel" ? <Loader2 aria-hidden="true" className="animate-spin" /> : <X aria-hidden="true" />}
              Annuler la proposition
            </Button>
          )}
        </footer>
      )}
    </article>
  );
}
