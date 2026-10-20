/** Navigation principale (barre latérale sur ordinateur, barre du bas sur téléphone et tablette). */
export interface NavItem {
  href: string;
  label: string;
  icon: "home" | "catalogue" | "search" | "booster" | "collection" | "market" | "ranking" | "trades" | "friends" | "guilds";
  /** Réservé aux joueurs connectés. */
  auth?: boolean;
  /** Absent de la barre du bas pour un joueur connecté (5 onglets au plus ; la recherche reste dans le catalogue). */
  guestOnlyOnMobile?: boolean;
  /** Seulement dans la barre latérale des grands écrans (accessible ailleurs depuis le menu du joueur). */
  wideOnly?: boolean;
  /** Pastille de la barre latérale : propositions d'échange ou demandes d'ami en attente. */
  badge?: "trades" | "friends";
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Accueil", icon: "home" },
  { href: "/catalogue", label: "Catalogue", icon: "catalogue" },
  { href: "/recherche", label: "Recherche", icon: "search", guestOnlyOnMobile: true },
  { href: "/boosters", label: "Boosters", icon: "booster", auth: true },
  { href: "/collection", label: "Collection", icon: "collection", auth: true },
  { href: "/marche", label: "Marché", icon: "market" },
  { href: "/echanges", label: "Échanges", icon: "trades", auth: true, wideOnly: true, badge: "trades" },
  { href: "/classements", label: "Classements", icon: "ranking", wideOnly: true },
];

/** Section « Social » de la barre latérale (joueurs connectés). */
export const SOCIAL_NAV_ITEMS: NavItem[] = [
  { href: "/amis", label: "Amis", icon: "friends", auth: true, wideOnly: true, badge: "friends" },
  { href: "/guildes", label: "Guildes", icon: "guilds", auth: true, wideOnly: true },
];

export function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
