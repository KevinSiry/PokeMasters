import { closeDueAuctions, getHeldBids, getMyBids } from "@pokeflex/server";
import type { Metadata } from "next";
import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { redirect } from "next/navigation";
import { Jetons } from "@/components/jetons";
import { ListingTile } from "@/components/market/listing-tile";
import { getCurrentPlayer } from "@/lib/player";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Mes enchères" };

export default async function MyBidsPage() {
  const player = await getCurrentPlayer();
  if (!player) redirect("/connexion?suite=/marche/mes-encheres");
  await closeDueAuctions();
  const [list, held] = await Promise.all([getMyBids(player.id), getHeldBids(player.id)]);
  const active = list.filter((l) => l.status === "active");
  const done = list.filter((l) => l.status !== "active");

  const badge = (leading: boolean, status: string) => (
    <span className={cn("rounded-full px-2.5 py-1 text-center text-[11px] font-bold", leading ? "bg-lime/15 text-lime" : "bg-coral/15 text-coral")}>
      {status === "active" ? (leading ? "En tête" : "Surenchéri") : leading ? "Gagnée" : "Perdue"}
    </span>
  );

  return (
    <div className="grid grid-cols-1 gap-8 py-6 sm:py-10">
      <BackLink href="/marche" label="Marché" />
      <header className="grid gap-1">
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Mes enchères</h1>
        <p className="text-sm text-muted">
          <Jetons value={held.amount} className="text-fg" /> réservés sur {held.count} enchère{held.count > 1 ? "s" : ""} où tu es en tête.
        </p>
      </header>
      {list.length === 0 ? (
        <p className="rounded-[var(--radius-card)] border border-dashed border-line p-6 text-sm text-muted">
          Tu n&apos;as encore enchéri nulle part. <Link href="/marche?type=auction" className="text-accent hover:underline">Voir les enchères</Link>
        </p>
      ) : (
        [
          { id: "cours", title: "En cours", items: active },
          { id: "finies", title: "Terminées", items: done },
        ]
          .filter((g) => g.items.length > 0)
          .map((g) => (
            <section key={g.id} aria-labelledby={g.id} className="grid gap-4">
              <h2 id={g.id} className="font-display text-lg font-bold">
                {g.title}
              </h2>
              <ul className="pf-card-grid">
                {g.items.map((l) => (
                  <li key={l.id} className="grid min-w-0 content-start gap-2">
                    <ListingTile l={l} />
                    {badge(l.currentBidderId === player.id, l.status)}
                  </li>
                ))}
              </ul>
            </section>
          ))
      )}
    </div>
  );
}
