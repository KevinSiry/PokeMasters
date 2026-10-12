/** Navigation principale (en-tête sur ordinateur, barre du bas sur mobile). */
export interface NavItem {
  href: string;
  label: string;
  icon: "home" | "catalogue" | "search";
  /** Réservé aux joueurs connectés. */
  auth?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Accueil", icon: "home" },
  { href: "/catalogue", label: "Catalogue", icon: "catalogue" },
  { href: "/recherche", label: "Recherche", icon: "search" },
];

export function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
