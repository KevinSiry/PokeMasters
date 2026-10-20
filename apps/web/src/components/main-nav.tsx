"use client";

import {
  BookOpen,
  GalleryVerticalEnd,
  Home,
  Repeat2,
  Search,
  Shield,
  Sparkles,
  Store,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/logo";
import { NAV_ITEMS, SOCIAL_NAV_ITEMS, isActive, type NavItem } from "@/lib/nav";
import { useBoosterCountdown } from "@/lib/use-booster-countdown";
import { cn } from "@/lib/utils";

const ICONS: Record<NavItem["icon"], LucideIcon> = {
  home: Home,
  catalogue: BookOpen,
  search: Search,
  booster: Sparkles,
  collection: GalleryVerticalEnd,
  market: Store,
  ranking: Trophy,
  trades: Repeat2,
  friends: Users,
  guilds: Shield,
};

function useItems(loggedIn: boolean, items = NAV_ITEMS) {
  return items.filter((i) => !i.auth || loggedIn);
}

export interface SideNavCounts {
  trades: number;
  friends: number;
}

/**
 * Barre latérale des grands écrans (à partir de 1024 px) : rail d'icônes avec libellé dessous,
 * puis icône et libellé côte à côte à partir de 1280 px.
 */
export function SideNav({ loggedIn, boosters, counts }: { loggedIn: boolean; boosters?: BoosterStock | null; counts?: SideNavCounts | null }) {
  const pathname = usePathname();
  const main = useItems(loggedIn);
  const social = useItems(loggedIn, SOCIAL_NAV_ITEMS);

  const link = (item: NavItem) => {
    const Icon = ICONS[item.icon];
    const active = isActive(pathname, item.href);
    const count = item.badge && counts ? counts[item.badge] : 0;
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          aria-current={active ? "page" : undefined}
          aria-label={count > 0 ? `${item.label}, ${count} en attente` : undefined}
          className={cn(
            "group relative flex flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-[11px] font-semibold transition-colors xl:min-h-11 xl:flex-row xl:justify-start xl:gap-3 xl:px-3 xl:text-sm",
            active ? "bg-elev text-fg" : "text-muted hover:bg-elev/60 hover:text-fg",
          )}
        >
          {active && <span aria-hidden="true" className="absolute top-2 bottom-2 left-0 w-1 rounded-full bg-gradient-to-b from-accent to-coral" />}
          <span className="relative grid size-7 place-items-center">
            <Icon aria-hidden="true" className="size-5" />
            {item.icon === "booster" && boosters && <BoosterBadge stock={boosters} />}
            {count > 0 && (
              <span aria-hidden="true" className="absolute -top-1 -right-1.5 grid h-4.5 min-w-4.5 place-items-center rounded-full border-2 border-bg bg-coral px-1 font-mono text-[10px] leading-none font-bold text-bg">
                {count > 9 ? "9+" : count}
              </span>
            )}
          </span>
          {item.label}
        </Link>
      </li>
    );
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[var(--pf-sidebar-w)] flex-col gap-6 overflow-y-auto border-r border-line/70 bg-bg/85 px-2 py-4 backdrop-blur-md lg:flex xl:px-3">
      <div className="flex h-11 items-center justify-center xl:justify-start xl:px-3">
        <Logo textClassName="max-xl:sr-only" />
      </div>
      <nav aria-label="Navigation principale" className="grid gap-6">
        <ul className="grid gap-1">{main.map(link)}</ul>
        {social.length > 0 && (
          <div className="grid gap-1">
            <p className="hidden px-3 font-mono text-[10px] tracking-[0.2em] text-muted uppercase xl:block">Social</p>
            <ul className="grid gap-1">{social.map(link)}</ul>
          </div>
        )}
      </nav>
    </aside>
  );
}

export interface BoosterStock {
  available: number;
  maxStock: number;
  nextAt: string | null;
  refillIntervalMs: number;
}

/** Pastille de l'onglet Boosters : nombre de boosters prêts à ouvrir (projection locale du minuteur). */
function BoosterBadge({ stock }: { stock: BoosterStock }) {
  const { shown } = useBoosterCountdown(stock.available, stock.nextAt, stock.maxStock, stock.refillIntervalMs);
  if (shown <= 0) return null;
  return (
    <span
      aria-hidden="true"
      className="absolute -top-1 -right-0.5 grid h-4.5 min-w-4.5 place-items-center rounded-full border-2 border-bg bg-lime px-1 font-mono text-[10px] leading-none font-bold text-bg"
    >
      {shown}
    </span>
  );
}

/** Barre d'onglets fixée en bas de l'écran sur téléphone et tablette (zone du pouce). */
export function BottomNav({ loggedIn, boosters }: { loggedIn: boolean; boosters?: BoosterStock | null }) {
  const pathname = usePathname();
  const items = useItems(loggedIn).filter((i) => !i.wideOnly && !(loggedIn && i.guestOnlyOnMobile));
  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line/80 bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
    >
      <ul className="mx-auto grid max-w-md" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((item) => {
          const Icon = ICONS[item.icon];
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors",
                  active ? "text-fg" : "text-muted",
                )}
              >
                <span
                  className={cn(
                    "relative grid h-7 w-12 place-items-center rounded-full transition-[background-color,transform] duration-150 group-active:scale-90",
                    active && "bg-gradient-to-r from-accent-strong/60 to-coral-strong/60",
                  )}
                >
                  <Icon aria-hidden="true" className="size-5" />
                  {item.icon === "booster" && boosters && <BoosterBadge stock={boosters} />}
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
