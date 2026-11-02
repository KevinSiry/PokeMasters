import { FINISH_LABELS_FR, gameConfig, rarityLabel } from "@pokeflex/config";
import { getBinder } from "@pokeflex/server";
import { BookOpen, Lock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/back-link";
import { BinderControls, RemoveFromBinder } from "@/components/binders/binder-controls";
import { CardImage } from "@/components/card-image";
import { Pagination } from "@/components/pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { firstParam } from "@/lib/params";
import { paginate } from "@/lib/pagination";
import { getCurrentPlayerSafe } from "@/lib/player";
import { plural } from "@/lib/format";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ page?: string | string[] }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const player = await getCurrentPlayerSafe();
  const binder = await getBinder((await params).id, player?.id ?? null);
  if (!binder) return { title: "Classeur introuvable" };
  return { title: `${binder.name} — classeur de ${binder.owner.name}`, robots: binder.isPublic ? undefined : { index: false } };
}

export default async function BinderPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const [{ id }, sp, player] = await Promise.all([params, searchParams, getCurrentPlayerSafe()]);
  const binder = await getBinder(id, player?.id ?? null);
  if (!binder) notFound();
  const mine = player?.id === binder.owner.id;
  const size = gameConfig.binders.pageSize;
  const info = paginate(binder.slots.length, firstParam(sp.page), size);
  const slots = binder.slots.slice(info.start, info.end);

  return (
    <div className="grid grid-cols-1 gap-6 py-6 sm:py-10">
      <BackLink href={mine ? "/collection?vue=classeurs" : binder.owner.handle ? `/joueurs/${binder.owner.handle}` : "/"} />
      <header className="grid gap-3">
        <p className="inline-flex items-center gap-1.5 font-mono text-xs tracking-[0.16em] text-muted uppercase">
          <BookOpen aria-hidden="true" className="size-4" />
          Classeur {binder.isPublic ? "public" : "privé"}
        </p>
        <h1 className="font-display text-[clamp(1.8rem,5vw,2.6rem)] leading-tight font-bold">{binder.name}</h1>
        <p className="text-muted">
          {plural(binder.slots.length, "carte")}
          {mine ? (
            <> · rangées ici, elles sont protégées : ni vente, ni recyclage, ni échange.</>
          ) : (
            binder.owner.handle && (
              <>
                {" "}
                · par{" "}
                <Link href={`/joueurs/${binder.owner.handle}`} className="pf-hit relative font-semibold text-accent hover:underline">
                  {binder.owner.name}
                </Link>
              </>
            )
          )}
        </p>
        {mine && <BinderControls id={binder.id} name={binder.name} isPublic={binder.isPublic} />}
      </header>

      {binder.slots.length === 0 ? (
        <EmptyState icon={<BookOpen aria-hidden="true" className="size-7 text-accent" />} title="Classeur vide">
          {mine ? "Ouvre la fiche d'une carte de ta collection et touche « Classeur » pour l'y ranger." : "Ce classeur ne contient encore aucune carte."}
        </EmptyState>
      ) : (
        <section aria-label={`Page ${info.page} du classeur`} className="mx-auto w-full max-w-3xl rounded-[calc(var(--radius-card)*1.4)] border border-line bg-surface p-3 shadow-[inset_0_0_0_6px_rgb(255_255_255/0.02)] sm:p-5">
          <ul className="grid grid-cols-3 gap-2 sm:gap-4">
            {slots.map((s) => (
              <li key={s.copyId} className="relative grid gap-1.5" data-tier={s.card.tier}>
                <Link href={`/cartes/${s.card.id}`} className="pf-tile grid gap-1.5 rounded-[var(--radius-card)] outline-none" data-tier={s.card.tier}>
                  <div className="pf-tile-frame relative rounded-[var(--radius-card-image)]">
                    <CardImage image={s.card.image} name={s.card.name} />
                    {s.finish !== "normal" && (
                      <span className="absolute bottom-1.5 left-1.5 rounded-full bg-gradient-to-r from-accent-strong to-coral-strong px-1.5 text-[10px] font-bold">
                        {FINISH_LABELS_FR[s.finish]}
                      </span>
                    )}
                  </div>
                  <span className="min-w-0 px-0.5">
                    <span className="block truncate text-xs font-semibold sm:text-sm">{s.card.name}</span>
                    <span className="block truncate font-mono text-[10px] text-muted sm:text-[11px]">{rarityLabel(s.card)}</span>
                  </span>
                </Link>
                {mine && <RemoveFromBinder copyId={s.copyId} cardName={s.card.name} />}
              </li>
            ))}
            {Array.from({ length: size - slots.length }, (_, i) => (
              <li key={`vide-${i}`} aria-hidden="true" className="aspect-[63/88] rounded-[var(--radius-card-image)] border border-dashed border-line/70" />
            ))}
          </ul>
          {mine && (
            <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted">
              <Lock aria-hidden="true" className="size-3.5" />
              Retirer une carte du classeur la libère.
            </p>
          )}
        </section>
      )}
      <Pagination info={info} href={(p) => `/classeurs/${binder.id}?page=${p}`} label="Pages du classeur" />
    </div>
  );
}
