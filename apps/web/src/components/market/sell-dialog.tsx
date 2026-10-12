"use client";

import { FINISH_LABELS_FR, gameConfig, type Finish } from "@pokeflex/config";
import { listingFee } from "@pokeflex/game/market";
import { Gavel, Tag } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createListingAction } from "@/app/marche/actions";
import { Jetons } from "@/components/jetons";
import { toast } from "@/components/toaster";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { emitBalance } from "@/lib/balance-events";
import { cn, formatJetons } from "@/lib/utils";

const DURATIONS = gameConfig.market.auctionDurationsMs.map((ms) => ({ ms, label: `${ms / 3_600_000} h` }));

/** Mise en vente d'un exemplaire : prix fixe ou enchère, frais affichés avant de confirmer. */
export function SellDialog({
  open,
  onClose,
  copy,
  cardName,
  suggested,
  balance,
  onListed,
}: {
  open: boolean;
  onClose: () => void;
  copy: { id: string; finish: Finish };
  cardName: string;
  suggested: number;
  balance: number;
  onListed?: (copyId: string) => void;
}) {
  const router = useRouter();
  const [type, setType] = useState<"fixed" | "auction">("fixed");
  const [price, setPrice] = useState(suggested);
  const [duration, setDuration] = useState(DURATIONS[1]!.ms);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const valid = Number.isInteger(price) && price >= gameConfig.market.minPrice && price <= gameConfig.market.maxPrice;
  const fee = valid ? listingFee(price, gameConfig.market) : 0;

  function submit() {
    setError(null);
    start(async () => {
      const res = await createListingAction({ copyId: copy.id, type, price, durationMs: type === "auction" ? duration : undefined });
      if (!res.ok) return setError(res.error);
      emitBalance(res.data.balance);
      toast({ title: type === "fixed" ? "Carte mise en vente" : "Enchère lancée", description: cardName, jetons: -res.data.fee });
      onListed?.(copy.id);
      onClose();
      router.refresh();
    });
  }

  const seg = "flex flex-1 items-center justify-center gap-2 rounded-full py-2 text-sm font-semibold transition-colors [&_svg]:size-4";
  return (
    <Dialog open={open} onClose={onClose} title={`Vendre ${cardName}`} description={`Exemplaire ${FINISH_LABELS_FR[copy.finish].toLowerCase()}`}>
      <div className="grid gap-5">
        <div className="flex gap-1 rounded-full border border-line bg-bg p-1" role="radiogroup" aria-label="Type de vente">
          <button type="button" role="radio" aria-checked={type === "fixed"} onClick={() => setType("fixed")} className={cn(seg, type === "fixed" ? "bg-elev" : "text-muted")}>
            <Tag aria-hidden="true" />
            Prix fixe
          </button>
          <button type="button" role="radio" aria-checked={type === "auction"} onClick={() => setType("auction")} className={cn(seg, type === "auction" ? "bg-elev" : "text-muted")}>
            <Gavel aria-hidden="true" />
            Enchère
          </button>
        </div>
        <label className="grid gap-1.5 text-sm">
          <span className="text-muted">{type === "fixed" ? "Prix de vente" : "Prix de départ"}</span>
          <input
            type="number"
            inputMode="numeric"
            min={gameConfig.market.minPrice}
            max={gameConfig.market.maxPrice}
            step={1}
            value={price}
            onChange={(e) => setPrice(Math.floor(Number(e.target.value) || 0))}
            className="h-12 rounded-full border border-line bg-bg px-5 font-mono text-lg focus:border-accent focus:outline-none"
          />
          <span className="text-xs text-muted">Suggestion : {formatJetons(suggested)} Jetons d&apos;après la cote et la rareté.</span>
        </label>
        {type === "auction" && (
          <div className="grid gap-1.5 text-sm">
            <span className="text-muted">Durée</span>
            <div className="flex gap-2" role="radiogroup" aria-label="Durée de l'enchère">
              {DURATIONS.map((d) => (
                <button key={d.ms} type="button" role="radio" aria-checked={duration === d.ms} onClick={() => setDuration(d.ms)} className="pf-chip" aria-pressed={duration === d.ms}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="grid gap-1 rounded-xl bg-elev p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Frais de mise en vente ({Math.round(gameConfig.market.listingFeeRate * 100)} %)</span>
            <Jetons value={fee} />
          </div>
          <p className="text-xs text-muted">Débités maintenant et non remboursés. Tu recevras le prix de vente en entier.</p>
        </div>
        {error && (
          <p role="alert" className="rounded-xl bg-danger/15 px-4 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <Button size="lg" onClick={submit} disabled={pending || !valid || fee > balance}>
          {fee > balance ? "Solde insuffisant pour les frais" : type === "fixed" ? <>Mettre en vente · <Jetons value={price} /></> : <>Lancer l&apos;enchère</>}
        </Button>
      </div>
    </Dialog>
  );
}
