import { gameConfig } from "@pokeflex/config";
import { getPlayerByHandle, getTrade, getTradeComposer, TradeError } from "@pokeflex/server";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BackLink } from "@/components/back-link";
import { PlayerAvatar } from "@/components/player-avatar";
import { TradeComposer } from "@/components/trades/trade-composer";
import { getCurrentPlayerSafe } from "@/lib/player";

export const metadata: Metadata = { title: "Proposer un échange", robots: { index: false } };

type SearchParams = Promise<{ avec?: string; carte?: string; contre?: string }>;

export default async function NewTradePage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const player = await getCurrentPlayerSafe();
  if (!player) {
    const qs = new URLSearchParams(Object.entries(sp).filter((e): e is [string, string] => typeof e[1] === "string")).toString();
    redirect(`/connexion?suite=${encodeURIComponent(`/echanges/nouveau${qs ? `?${qs}` : ""}`)}`);
  }

  // Contre-proposition : on repart de l'offre reçue, côtés inversés.
  const counter = sp.contre ? await getTrade(player.id, String(sp.contre)) : null;
  if (sp.contre && (!counter || counter.status !== "pending" || counter.role !== "received")) redirect("/echanges");
  const other = counter ? counter.other : sp.avec ? await getPlayerByHandle(String(sp.avec)) : null;
  if (!other) notFound();
  if (other.id === player.id) redirect("/echanges");

  const initialTake = counter ? counter.receive.map((i) => `${i.cardId}:${i.finish}`) : sp.carte ? [String(sp.carte).slice(0, 40)] : [];
  const initialGive = counter ? counter.give.map((i) => `${i.cardId}:${i.finish}`) : [];

  let composer: Awaited<ReturnType<typeof getTradeComposer>> | null = null;
  let refusal: string | null = null;
  try {
    composer = await getTradeComposer(player.id, other.id, { give: initialGive, take: initialTake });
  } catch (err) {
    if (!(err instanceof TradeError)) throw err;
    refusal = err.message;
  }

  return (
    <div className="grid grid-cols-1 gap-6 py-6 sm:py-10">
      <BackLink href="/echanges" />
      <header className="flex items-center gap-4">
        <PlayerAvatar name={other.name} image={other.image} size="lg" />
        <div className="grid min-w-0 gap-1">
          <h1 className="font-display text-2xl font-bold sm:text-3xl">{counter ? "Contre-proposition" : "Proposer un échange"}</h1>
          <p className="truncate text-sm text-muted">
            avec{" "}
            {other.handle ? (
              <Link href={`/joueurs/${other.handle}`} className="font-semibold text-fg hover:text-accent">
                {other.name}
              </Link>
            ) : (
              other.name
            )}
          </p>
        </div>
      </header>

      {refusal || !composer ? (
        <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">{refusal ?? "Échange impossible."}</p>
      ) : (
        <>
          {composer.pendingOutgoing >= gameConfig.trades.maxPendingOutgoing && !counter && (
            <p className="rounded-xl border border-coral/40 bg-coral/5 p-3 text-sm">
              Tu as déjà {gameConfig.trades.maxPendingOutgoing} propositions en attente : annules-en une dans{" "}
              <Link href="/echanges" className="text-accent hover:underline">
                tes échanges
              </Link>{" "}
              avant d&apos;en envoyer une autre.
            </p>
          )}
          <TradeComposer
            other={other}
            mine={composer.mine}
            theirs={composer.theirs}
            initialGive={composer.selectedMine}
            initialTake={composer.selectedTheirs}
            theirWishlist={composer.theirWishlist}
            counterOf={counter?.id ?? null}
            maxPerSide={gameConfig.trades.maxCardsPerSide}
            messageMaxLength={gameConfig.trades.messageMaxLength}
          />
        </>
      )}
    </div>
  );
}
