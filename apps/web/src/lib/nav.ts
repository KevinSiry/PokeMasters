/** Navigation principale (en-tête sur ordinateur, barre du bas sur mobile). */
export interface NavItem {
  href: string;
  label: string;
  icon: "home" | "catalogue" | "search" | "booster" | "collection" | "market" | "duel";
  /** Réservé aux joueurs connectés. */
  auth?: boolean;
  /** Absent de la barre du bas pour un joueur connecté (la recherche reste accessible depuis le catalogue). */
  guestOnlyOnMobile?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Accueil", icon: "home" },
  { href: "/catalogue", label: "Catalogue", icon: "catalogue" },
  { href: "/boosters", label: "Boosters", icon: "booster", auth: true },
  { href: "/collection", label: "Collection", icon: "collection", auth: true },
  { href: "/duels", label: "Duels", icon: "duel", auth: true },
  { href: "/marche", label: "Marché", icon: "market" },
  { href: "/recherche", label: "Recherche", icon: "search", guestOnlyOnMobile: true },
];

export function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
