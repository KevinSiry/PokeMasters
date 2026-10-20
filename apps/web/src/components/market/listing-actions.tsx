"use client";

import { gameConfig } from "@pokeflex/config";
import { minNextBid } from "@pokeflex/game/market";
import { Gavel, ShoppingBag, X } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { buyListingAction, cancelListingAction, placeBidAction } from "@/app/marche/actions";
import { CoinBurst } from "@/components/economy/coin-burst";
import { Jetons } from "@/components/jetons";
import { Countdown } from "@/components/market/countdown";
import { toast } from "@/components/toaster";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { emitBalance } from "@/lib/balance-events";
import { cn, formatJetons } from "@/lib/utils";

interface Props {
  listing: {
    id: string;
    type: "fixed" | "auction";
    status: "active" | "sold" | "expired" | "cancelled";
    price: number;
    currentBid: number | null;
    currentBidderId: string | null;
    buyerId: string | null;
    bidCount: number;
    endsAt: string | null;
    sellerId: string;
    cardId: string;
    cardName: string;
  };
  viewer: { id: string; balance: number } | null;
}

/** Panneau d'action d'une annonce : acheter, enchérir ou retirer selon le visiteur. */
export function ListingActions({ listing: l, viewer }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const [bought, setBought] = useState(false);
  const min = minNextBid(l.price, l.currentBid, gameConfig.market);
  const [amount, setAmount] = useState(min);
  const mine = viewer?.id === l.sellerId;
  const leading = viewer && l.currentBidderId === viewer.id;
  const ended = l.status !== "active";

  useEffect(() => setAmount((a) => Math.max(a, min)), [min]);

  // Les enchères en cours se rafraîchissent seules (nouvelles offres, prolongation).
  useEffect(() => {
    if (l.type !== "auction" || ended) return;
    const t = window.setInterval(() => router.refresh(), 10_000);
    return () => window.clearInterval(t);
  }, [l.type, ended, router]);

  function buy() {
    start(async () => {
      const res = await buyListingAction(l.id);
      if (!res.ok) {
        setConfirm(false);
        toast({ title: "Achat impossible", description: res.error, tone: "error" });
        router.refresh();
        return;
      }
      setConfirm(false);
      setBought(true);
      emitBalance(res.data.balance);
      for (const s of res.data.completedSets) toast({ title: `Set complété : ${s.name}`, jetons: s.bonus });
      router.refresh();
    });
  }

  function bid() {
    start(async () => {
      const res = await placeBidAction(l.id, amount);
      if (!res.ok) {
        toast({ title: "Enchère refusée", description: res.error, tone: "error" });
        router.refresh();
        return;
      }
      emitBalance(res.data.balance);
      toast({
        title: "Tu es le meilleur enchérisseur",
        description: res.data.extended ? "Enchère de dernière minute : la fin est repoussée d'une minute." : "Tes Jetons sont réservés jusqu'à la fin de l'enchère.",
        jetons: -res.data.amount,
      });
      router.refresh();
    });
  }

  function cancel() {
    start(async () => {
      const res = await cancelListingAction(l.id);
      if (!res.ok) return toast({ title: "Retrait impossible", description: res.error, tone: "error" });
      toast({ title: "Annonce retirée", description: "La carte est de retour dans ta collection.", tone: "info" });
      router.push("/marche/mes-ventes");
    });
  }

  // Reste monté quand la page rafraîchie passe l'annonce en « Vendue ».
  const celebration = (
    <Dialog open={bought} onClose={() => setBought(false)} title="Carte achetée !">
      <div className="relative grid justify-items-center gap-3 py-4 text-center">
        <CoinBurst />
        <motion.p className="font-display text-xl font-bold" initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          {l.cardName} rejoint ta collection
        </motion.p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link href={`/cartes/${l.cardId}`}>Voir la carte</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/marche">Retour au marché</Link>
          </Button>
        </div>
      </div>
    </Dialog>
  );

  const box = "grid gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-5";

  if (ended) {
    return (
      <div className={box}>
        <p className="font-display text-lg font-bold">
          {l.status === "sold" ? "Vendue" : l.status === "expired" ? "Enchère terminée sans offre" : "Annonce retirée"}
        </p>
        {l.status === "sold" && (
          <p className="text-sm text-muted">
            Pour <Jetons value={l.currentBid ?? l.price} className="text-fg" />
            {viewer && l.buyerId === viewer.id && " · elle est dans ta collection"}
          </p>
        )}
        <Button asChild variant="secondary">
          <Link href={`/cartes/${l.cardId}`}>Voir la carte</Link>
        </Button>
        {celebration}
      </div>
    );
  }

  if (l.type === "fixed") {
    return (
      <div className={box}>
        <div className="flex items-end justify-between gap-3">
          <div className="grid gap-0.5">
            <span className="text-xs text-muted">Prix fixe</span>
            <Jetons value={l.price} className="text-3xl text-[#FFC93C]" />
          </div>
          {viewer && !mine && <span className="text-xs text-muted">Ton solde : {formatJetons(viewer.balance)}</span>}
        </div>
        {!viewer ? (
          <Button asChild size="lg">
            <Link href={`/connexion?suite=/marche/${l.id}`}>Se connecter pour acheter</Link>
          </Button>
        ) : mine ? (
          <Button variant="secondary" size="lg" onClick={cancel} disabled={pending}>
            <X aria-hidden="true" />
            Retirer l&apos;annonce
          </Button>
        ) : (
          <>
            <Button size="lg" onClick={() => setConfirm(true)} disabled={pending || viewer.balance < l.price}>
              <ShoppingBag aria-hidden="true" />
              {viewer.balance < l.price ? `Il te manque ${formatJetons(l.price - viewer.balance)} Jetons` : "Acheter"}
            </Button>
            <Dialog open={confirm} onClose={() => setConfirm(false)} title="Confirmer l'achat">
              <div className="grid gap-4">
                <p className="text-sm text-muted">
                  Tu achètes <strong className="text-fg">{l.cardName}</strong> pour <Jetons value={l.price} className="text-fg" />. Il te restera{" "}
                  <Jetons value={viewer.balance - l.price} className="text-fg" />.
                </p>
                <Button size="lg" onClick={buy} disabled={pending}>
                  <ShoppingBag aria-hidden="true" />
                  {pending ? "Achat…" : <>Payer <Jetons value={l.price} /></>}
                </Button>
              </div>
            </Dialog>
          </>
        )}
      </div>
    );
  }

  // Enchère
  const steps = [min, min + Math.max(1, Math.ceil(min * 0.1)), min + Math.max(5, Math.ceil(min * 0.25))];
  return (
    <div className={box}>
      <div className="flex items-end justify-between gap-3">
        <div className="grid gap-0.5">
          <span className="text-xs text-muted">{l.currentBid ? `Enchère actuelle · ${l.bidCount} offre${l.bidCount > 1 ? "s" : ""}` : "Prix de départ"}</span>
          <Jetons value={l.currentBid ?? l.price} className="text-3xl text-[#FFC93C]" />
        </div>
        {l.endsAt && (
          <div className="grid justify-items-end gap-0.5">
            <span className="text-xs text-muted">Fin dans</span>
            <Countdown endsAt={l.endsAt} className="text-lg font-bold" onEnd={() => window.setTimeout(() => router.refresh(), 1500)} />
          </div>
        )}
      </div>
      {leading && (
        <p className="rounded-xl bg-lime/10 px-3 py-2 text-sm text-lime">Tu es le meilleur enchérisseur. Tes Jetons sont réservés jusqu&apos;à la fin.</p>
      )}
      {!viewer ? (
        <Button asChild size="lg">
          <Link href={`/connexion?suite=/marche/${l.id}`}>Se connecter pour enchérir</Link>
        </Button>
      ) : mine ? (
        <>
          <p className="text-sm text-muted">C&apos;est ton annonce.</p>
          {l.bidCount === 0 && (
            <Button variant="secondary" onClick={cancel} disabled={pending}>
              <X aria-hidden="true" />
              Retirer l&apos;annonce
            </Button>
          )}
        </>
      ) : (
        <div className="grid gap-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Montants rapides">
            {steps.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setAmount(s)}
                aria-pressed={amount === s}
                className={cn("min-h-11 min-w-11 rounded-full border px-4 font-mono text-sm font-bold lg:min-h-9", amount === s ? "border-[#FFC93C] text-[#FFC93C]" : "border-line text-muted hover:text-fg")}
              >
                {formatJetons(s)}
              </button>
            ))}
          </div>
          <label className="grid gap-1.5 text-sm">
            <span className="text-muted">Ton offre (minimum {formatJetons(min)})</span>
            <input
              type="number"
              inputMode="numeric"
              min={min}
              step={1}
              value={amount}
              onChange={(e) => setAmount(Math.floor(Number(e.target.value) || 0))}
              className="h-12 rounded-full border border-line bg-bg px-5 font-mono text-lg focus:border-accent focus:outline-none"
            />
          </label>
          <Button size="lg" onClick={bid} disabled={pending || amount < min || amount > viewer.balance + (leading ? (l.currentBid ?? 0) : 0)}>
            <Gavel aria-hidden="true" />
            {amount > viewer.balance + (leading ? (l.currentBid ?? 0) : 0) ? "Solde insuffisant" : <>Enchérir <Jetons value={amount} /></>}
          </Button>
          <p className="text-xs text-muted">
            Le montant est réservé sur ton solde ; si quelqu&apos;un surenchérit, il t&apos;est rendu aussitôt. Une offre dans la dernière minute prolonge l&apos;enchère.
          </p>
        </div>
      )}
    </div>
  );
}
