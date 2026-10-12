import { gameConfig, TIER_LABELS_FR, type Tier } from "@pokeflex/config";
import type { LedgerReason } from "@pokeflex/db";
import { Gift, Library, Recycle, Swords, Target, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { JetonIcon, Jetons } from "@/components/jetons";
import { Button } from "@/components/ui/button";
import { getLedger, LEDGER_LABELS_FR } from "@pokeflex/server";
import { getCurrentPlayer } from "@/lib/player";
import { cn, formatJetons } from "@/lib/utils";

export const metadata: Metadata = { title: "Mes Jetons" };

const PAGE = 40;
const dayFmt = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: gameConfig.quests.timeZone });
const timeFmt = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: gameConfig.quests.timeZone });

const ICONS: Partial<Record<LedgerReason, typeof Gift>> = {
  recycle: Recycle,
  set_booster: Library,
  set_bonus: Trophy,
  quest: Target,
  duel_win: Swords,
  duel_draw: Swords,
  duel_loss: Swords,
};

function detail(reason: LedgerReason, meta: unknown): string | null {
  const m = (meta ?? {}) as { count?: number; byTier?: Partial<Record<Tier, number>>; name?: string; setId?: string };
  if (reason === "recycle" && m.count) {
    const tiers = Object.entries(m.byTier ?? {})
      .map(([t, n]) => `${n} ${TIER_LABELS_FR[t as Tier]}`)
      .join(", ");
    return `${m.count} carte${m.count > 1 ? "s" : ""}${tiers ? ` (${tiers})` : ""}`;
  }
  if (reason === "set_bonus" && m.name) return m.name;
  return null;
}

type SearchParams = Promise<{ avant?: string }>;

export default async function JetonsPage({ searchParams }: { searchParams: SearchParams }) {
  const player = await getCurrentPlayer();
  if (!player) redirect("/connexion?suite=/jetons");
  const { avant } = await searchParams;
  const before = avant && /^\d+$/.test(avant) ? BigInt(avant) : undefined;
  const entries = await getLedger(player.id, PAGE + 1, before);
  const more = entries.length > PAGE;
  const page = entries.slice(0, PAGE);

  const days = new Map<string, typeof page>();
  for (const e of page) {
    const k = dayFmt.format(e.createdAt);
    days.set(k, [...(days.get(k) ?? []), e]);
  }

  const ways = [
    { icon: Recycle, title: "Recycler", text: `De ${gameConfig.economy.recycleValue.common} à ${gameConfig.economy.recycleValue.mythic} Jetons par carte selon la rareté.`, href: "/collection?vue=cartes&tri=duplicates" },
    { icon: Target, title: "Quêtes du jour", text: "Trois quêtes chaque jour, jusqu'à 50 Jetons chacune.", href: "/#quetes" },
    { icon: Trophy, title: "Compléter un set", text: `${gameConfig.economy.setCompletionBonusPerCard} Jetons par carte officielle du set, une fois.`, href: "/collection" },
    { icon: Swords, title: "Duels", text: "Bientôt : des Jetons à chaque duel quiz.", href: null },
  ];

  return (
    <div className="grid grid-cols-1 gap-8 py-8 sm:py-12">
      <header className="relative grid justify-items-center gap-2 overflow-hidden rounded-[calc(var(--radius-card)*1.4)] border border-line bg-[radial-gradient(90%_120%_at_50%_0%,rgb(255_201_60/0.18),transparent_65%),var(--color-surface)] px-5 py-8 text-center">
        <JetonIcon className="size-14 drop-shadow-[0_8px_24px_rgb(255_201_60/0.45)]" />
        <h1 className="font-display text-sm font-bold tracking-[0.18em] text-muted uppercase">Mes Jetons</h1>
        <p className="font-display text-5xl font-bold font-tabular text-[#FFC93C]">{formatJetons(player.balance)}</p>
        <p className="max-w-[46ch] text-sm text-muted">Monnaie du jeu, sans valeur réelle : elle ne s&apos;achète pas et ne se retire pas.</p>
        <Button asChild className="mt-3">
          <Link href="/boosters/sets">
            <Library aria-hidden="true" />
            Boosters de set · <Jetons value={gameConfig.boosters.setBoosterPrice} />
          </Link>
        </Button>
      </header>

      <section aria-labelledby="gagner" className="grid gap-3">
        <h2 id="gagner" className="font-display text-lg font-bold">
          Gagner des Jetons
        </h2>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ways.map((w) => {
            const body = (
              <>
                <w.icon aria-hidden="true" className="size-5 text-accent" />
                <span className="font-semibold">{w.title}</span>
                <span className="text-sm text-muted">{w.text}</span>
              </>
            );
            return (
              <li key={w.title}>
                {w.href ? (
                  <Link href={w.href} className="grid h-full gap-1.5 rounded-[var(--radius-card)] border border-line bg-surface p-4 transition-colors hover:border-accent">
                    {body}
                  </Link>
                ) : (
                  <div className="grid h-full gap-1.5 rounded-[var(--radius-card)] border border-dashed border-line p-4 opacity-70">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="historique" className="grid gap-4">
        <h2 id="historique" className="font-display text-lg font-bold">
          Historique
        </h2>
        {page.length === 0 ? (
          <p className="rounded-[var(--radius-card)] border border-dashed border-line p-6 text-center text-muted">
            Aucun mouvement pour l&apos;instant. Recycle un doublon pour gagner tes premiers Jetons.
          </p>
        ) : (
          [...days.entries()].map(([day, list]) => (
            <div key={day} className="grid gap-1.5">
              <h3 className="text-xs font-semibold tracking-wide text-muted first-letter:uppercase">{day}</h3>
              <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
                {list.map((e) => {
                  const Icon = ICONS[e.reason] ?? Gift;
                  const d = detail(e.reason, e.meta);
                  return (
                    <li key={String(e.id)} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3">
                      <span aria-hidden="true" className={cn("grid size-9 place-items-center rounded-full", e.delta > 0 ? "bg-[#FFC93C]/12 text-[#FFC93C]" : "bg-elev text-muted")}>
                        <Icon className="size-4" />
                      </span>
                      <div className="grid min-w-0">
                        <span className="truncate text-sm font-semibold">{LEDGER_LABELS_FR[e.reason]}</span>
                        <span className="truncate text-xs text-muted">
                          {timeFmt.format(e.createdAt)}
                          {d && <> · {d}</>}
                        </span>
                      </div>
                      <div className="grid justify-items-end">
                        <Jetons value={e.delta} signed className={cn("text-sm", e.delta > 0 ? "text-[#FFC93C]" : "text-fg")} />
                        <span className="font-mono text-[11px] text-muted">solde {formatJetons(e.balanceAfter)}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
        {more && (
          <Button asChild variant="secondary" className="justify-self-center">
            <Link href={`/jetons?avant=${String(page[page.length - 1]!.id)}`}>Plus ancien</Link>
          </Button>
        )}
      </section>
    </div>
  );
}
