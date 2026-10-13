import { FINISH_LABELS_FR } from "@pokeflex/config";
import type { ListingView } from "@pokeflex/server";
import { Check, Gavel, Heart, Timer } from "lucide-react";
import Link from "next/link";
import { CardImage } from "@/components/card-image";
import { Jetons } from "@/components/jetons";
import { Countdown } from "@/components/market/countdown";
import { TIER_ICON } from "@/components/tier-badge";
import { cn } from "@/lib/utils";

/**
 * Vignette d'annonce : carte, finition, prix ou enchère courante, temps restant.
 * `owned` (joueur connecté) : exemplaires de la carte déjà dans sa collection, toutes finitions confondues.
 */
export function ListingTile({ l, mine, wished, owned, priority }: { l: ListingView; mine?: boolean; wished?: boolean; owned?: number; priority?: boolean }) {
  const amount = l.type === "auction" ? (l.currentBid ?? l.price) : l.price;
  return (
    <Link href={`/marche/${l.id}`} className="pf-tile group grid gap-2 rounded-[var(--radius-card)] outline-none" data-tier={l.card.tier}>
      <div className="pf-tile-frame relative rounded-[var(--radius-card)]">
        <CardImage image={l.card.image} name={l.card.name} priority={priority} />
        <span aria-hidden="true" className="pf-tier-pip absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full bg-bg/85 text-[11px] backdrop-blur">
          {TIER_ICON[l.card.tier]}
        </span>
        {l.finish !== "normal" && (
          <span className="absolute bottom-1.5 left-1.5 rounded-full bg-gradient-to-r from-accent-strong to-coral-strong px-2 py-0.5 text-[10px] font-bold">
            {FINISH_LABELS_FR[l.finish]}
          </span>
        )}
        {!mine &&
          (wished ? (
            <span className="absolute right-1.5 bottom-1.5 grid size-6 place-items-center rounded-full bg-bg/85 text-coral backdrop-blur">
              <Heart aria-label="Dans ta wishlist, pas encore obtenue" className="size-3.5 fill-current" />
            </span>
          ) : owned === undefined ? null : owned > 0 ? (
            <span
              className="absolute right-1.5 bottom-1.5 inline-flex items-center gap-0.5 rounded-full bg-bg/85 px-1.5 py-0.5 font-mono text-[10px] font-bold text-lime backdrop-blur"
              title={`Déjà obtenue : ${owned} exemplaire${owned > 1 ? "s" : ""}`}
            >
              <Check aria-hidden="true" className="size-3" strokeWidth={3} />
              <span className="sr-only">Déjà obtenue, exemplaires :</span>×{owned}
            </span>
          ) : (
            <span className="absolute right-1.5 bottom-1.5 rounded-full bg-lime px-1.5 text-[10px] font-black text-bg" title="Pas encore dans ta collection">
              NEW<span className="sr-only"> : pas encore obtenue</span>
            </span>
          ))}
        {l.type === "auction" && l.endsAt && l.status === "active" && (
          <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-bg/85 px-2 py-0.5 text-[11px] backdrop-blur">
            <Timer aria-hidden="true" className="size-3" />
            <Countdown endsAt={l.endsAt} />
          </span>
        )}
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-0.5 px-0.5">
        <span className="truncate text-sm font-semibold group-hover:text-fg">{l.card.name}</span>
        <span className="flex items-center justify-between gap-2">
          <Jetons value={amount} className={cn("text-sm", mine ? "text-fg" : "text-[#FFC93C]")} />
          {l.type === "auction" ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted">
              <Gavel aria-hidden="true" className="size-3" />
              {l.bidCount > 0 ? `${l.bidCount} offre${l.bidCount > 1 ? "s" : ""}` : "départ"}
            </span>
          ) : (
            <span className="text-[11px] text-muted">prix fixe</span>
          )}
        </span>
        <span className="truncate font-mono text-[11px] text-muted">{l.seller.name}</span>
      </div>
    </Link>
  );
}
