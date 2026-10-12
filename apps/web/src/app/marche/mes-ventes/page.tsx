import { FINISH_LABELS_FR } from "@pokeflex/config";
import { closeDueAuctions, getMyListings } from "@pokeflex/server";
import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Jetons } from "@/components/jetons";
import { CancelListing } from "@/components/market/cancel-listing";
import { ListingTile } from "@/components/market/listing-tile";
import { getCurrentPlayer } from "@/lib/player";

export const metadata: Metadata = { title: "Mes ventes" };

const when = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });
const STATUS = { sold: "Vendue", expired: "Sans offre", cancelled: "Retirée", active: "En cours" } as const;

export default async function MySalesPage() {
  const player = await getCurrentPlayer();
  if (!player) redirect("/connexion?suite=/marche/mes-ventes");
  await closeDueAuctions();
  const all = await getMyListings(player.id);
  const active = all.filter((l) => l.status === "active");
  const past = all.filter((l) => l.status !== "active");
  const earned = past.reduce((n, l) => n + (l.soldPrice ?? 0), 0);

  return (
    <div className="grid grid-cols-1 gap-8 py-6 sm:py-10">
      <nav aria-label="Fil d'Ariane">
        <Link href="/marche" className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
          <ChevronLeft aria-hidden="true" className="size-4" />
          Marché
        </Link>
      </nav>
      <header className="grid gap-1">
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Mes ventes</h1>
        <p className="text-sm text-muted">
          {active.length} annonce{active.length > 1 ? "s" : ""} en cours · <Jetons value={earned} className="text-fg" /> gagnés au marché
        </p>
      </header>

      <section aria-labelledby="en-cours" className="grid gap-4">
        <h2 id="en-cours" className="font-display text-lg font-bold">
          En cours
        </h2>
        {active.length === 0 ? (
          <p className="rounded-[var(--radius-card)] border border-dashed border-line p-6 text-sm text-muted">
            Rien en vente. Ouvre une carte de ta collection, puis « Gérer » et « Vendre ».
          </p>
        ) : (
          <ul className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
            {active.map((l) => (
              <li key={l.id} className="grid min-w-0 content-start gap-2">
                <ListingTile l={l} mine />
                {(l.type === "fixed" || l.bidCount === 0) && <CancelListing id={l.id} />}
              </li>
            ))}
          </ul>
        )}
      </section>

      {past.length > 0 && (
        <section aria-labelledby="historique" className="grid gap-3">
          <h2 id="historique" className="font-display text-lg font-bold">
            Historique
          </h2>
          <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
            {past.map((l) => (
              <li key={l.id}>
                <Link href={`/marche/${l.id}`} className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 hover:bg-elev">
                  <div className="grid min-w-0">
                    <span className="truncate text-sm font-semibold">
                      {l.card.name}
                      {l.finish !== "normal" && <span className="text-muted"> · {FINISH_LABELS_FR[l.finish]}</span>}
                    </span>
                    <span className="truncate text-xs text-muted">
                      {STATUS[l.status]}
                      {l.soldTo && <> à {l.soldTo}</>} · {when.format(new Date(l.createdAt))}
                    </span>
                  </div>
                  {l.soldPrice ? <Jetons value={l.soldPrice} signed className="text-sm text-[#FFC93C]" /> : <span className="text-xs text-muted">—</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
