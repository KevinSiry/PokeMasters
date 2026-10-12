"use client";

import { BookOpen, Home, Search, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, isActive, type NavItem } from "@/lib/nav";
import { cn } from "@/lib/utils";

const ICONS: Record<NavItem["icon"], LucideIcon> = {
  home: Home,
  catalogue: BookOpen,
  search: Search,
};

function useItems(loggedIn: boolean) {
  return NAV_ITEMS.filter((i) => !i.auth || loggedIn);
}

/** Liens de l'en-tête (écrans larges). */
export function DesktopNav({ loggedIn }: { loggedIn: boolean }) {
  const pathname = usePathname();
  const items = useItems(loggedIn).filter((i) => i.href !== "/");
  return (
    <nav aria-label="Navigation principale" className="hidden md:block">
      <ul className="flex items-center gap-1">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative rounded-full px-3.5 py-2 text-sm font-semibold transition-colors",
                  active ? "bg-elev text-fg" : "text-muted hover:text-fg",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Barre d'onglets fixée en bas de l'écran sur mobile (zone du pouce). */
export function BottomNav({ loggedIn }: { loggedIn: boolean }) {
  const pathname = usePathname();
  const items = useItems(loggedIn);
  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line/80 bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
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
                  "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors",
                  active ? "text-fg" : "text-muted",
                )}
              >
                <span
                  className={cn(
                    "grid h-7 w-12 place-items-center rounded-full transition-colors",
                    active && "bg-gradient-to-r from-accent-strong/60 to-coral-strong/60",
                  )}
                >
                  <Icon aria-hidden="true" className="size-5" />
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
