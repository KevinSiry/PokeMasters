import { getTrades, getTradeSuggestions } from "@pokeflex/server";
import { Heart, Repeat2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CardImage } from "@/components/card-image";
import { PlayerAvatar } from "@/components/player-avatar";
import { TradeCard } from "@/components/trades/trade-card";
import { getCurrentPlayerSafe } from "@/lib/player";

export const metadata: Metadata = { title: "Échanges", robots: { index: false } };

function Section({ id, title, count, children }: { id: string; title: string; count?: number; children: React.ReactNode }) {
  return (
    <section className="grid gap-3" aria-labelledby={id}>
      <h2 id={id} className="flex items-center gap-2 font-display text-lg font-bold">
        {title}
        {count !== undefined && <span className="rounded-full bg-elev px-2 py-0.5 font-mono text-xs text-muted">{count}</span>}
      </h2>
      {children}
    </section>
  );
}

export default async function TradesPage() {
  const player = await getCurrentPlayerSafe();
  if (!player) redirect("/connexion?suite=/echanges");
  const [{ received, sent, history }, suggestions] = await Promise.all([getTrades(player.id), getTradeSuggestions(player.id)]);

  return (
    <div className="grid grid-cols-1 gap-8 py-8 sm:py-12">
      <header className="grid gap-1.5 rounded-[calc(var(--radius-card)*1.4)] border border-line bg-[radial-gradient(110%_130%_at_0%_0%,color-mix(in_srgb,var(--color-accent)_22%,transparent),transparent_60%),radial-gradient(90%_120%_at_100%_100%,color-mix(in_srgb,var(--color-lime)_12%,transparent),transparent_60%),var(--color-surface)] p-5 sm:p-7">
        <h1 className="flex items-center gap-2.5 font-display text-2xl font-bold sm:text-3xl">
          <Repeat2 aria-hidden="true" className="size-7 text-accent" />
          Échanges
        </h1>
        <p className="max-w-[60ch] text-sm text-muted">
          Échange tes cartes, carte contre carte, avec les autres dresseurs. Propose un échange depuis le profil d&apos;un joueur ou la fiche d&apos;une carte de ta wishlist.
        </p>
      </header>

      <Section id="recues" title="Propositions reçues" count={received.length}>
        {received.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">Aucune proposition en attente.</p>
        ) : (
          <ul className="grid gap-3">
            {received.map((t) => (
              <li key={t.id}>
                <TradeCard trade={t} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      {suggestions.length > 0 && (
        <Section id="suggestions" title="Ils ont des cartes de ta wishlist">
          <ul className="pf-scroll-x -mx-4 flex snap-x gap-3 px-4 pb-2">
            {suggestions.map((s) => (
              <li key={s.player.id} className="w-56 shrink-0 snap-start">
                <Link
                  href={`/echanges/nouveau?avec=${encodeURIComponent(s.player.handle ?? "")}`}
                  className="grid gap-3 rounded-2xl border border-line bg-surface p-3 transition-colors hover:border-accent"
                >
                  <span className="flex items-center gap-2.5">
                    <PlayerAvatar name={s.player.name} image={s.player.image} size="sm" />
                    <span className="grid min-w-0">
                      <span className="truncate text-sm font-semibold">{s.player.name}</span>
                      <span className="inline-flex items-center gap-1 text-[11px] text-coral">
                        <Heart aria-hidden="true" className="size-3" />
                        {s.matches} carte{s.matches > 1 ? "s" : ""} de ta wishlist
                      </span>
                    </span>
                  </span>
                  <span className="grid grid-cols-4 gap-1.5">
                    {s.cards.map((c) => (
                      <CardImage key={c.id} image={c.image} name={c.name} className="rounded-md" />
                    ))}
                  </span>
                  <span className="text-xs font-semibold text-accent">Proposer un échange</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {sent.length > 0 && (
        <Section id="envoyees" title="Propositions envoyées" count={sent.length}>
          <ul className="grid gap-3">
            {sent.map((t) => (
              <li key={t.id}>
                <TradeCard trade={t} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {history.length > 0 && (
        <Section id="historique" title="Historique">
          <ul className="grid gap-3">
            {history.map((t) => (
              <li key={t.id}>
                <TradeCard trade={t} />
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
