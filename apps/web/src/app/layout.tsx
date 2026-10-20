import "./globals.css";
import { gameConfig } from "@pokeflex/config";
import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { BottomNav, SideNav } from "@/components/main-nav";
import { SiteFooter } from "@/components/site-footer";
import { NavigationProgress } from "@/components/navigation-progress";
import { RealtimeListener } from "@/components/realtime-listener";
import { ScrollRestorer } from "@/components/scroll-restorer";
import { SiteHeader } from "@/components/site-header";
import { Toaster } from "@/components/toaster";
import { getCurrentPlayerSafe } from "@/lib/player";
import { inter, spaceMono, unbounded } from "./fonts";

export const metadata: Metadata = {
  title: { default: "PokeFlex", template: "%s · PokeFlex" },
  description:
    "Fan game gratuit et non officiel : collectionne toutes les cartes Pokémon sorties depuis 1999, un booster toutes les 10 minutes.",
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
};

export const viewport: Viewport = {
  themeColor: "#0B0716",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const player = await getCurrentPlayerSafe();
  const boosters = player && { ...player.boosters, refillIntervalMs: gameConfig.boosters.refillIntervalMs };
  return (
    <html lang="fr" className={`${inter.variable} ${unbounded.variable} ${spaceMono.variable}`}>
      <body>
        <a
          href="#contenu"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-elev focus:px-4 focus:py-2"
        >
          Aller au contenu
        </a>
        <SideNav
          loggedIn={Boolean(player)}
          boosters={boosters}
          counts={player && { trades: player.pendingTrades, friends: player.friendRequests }}
        />
        {/* Sur ordinateur, tout le contenu se décale de la largeur de la barre latérale. */}
        <div className="lg:pl-[var(--pf-sidebar-w)]">
          <SiteHeader player={player} />
          <main id="contenu" className="pf-container">
            {children}
          </main>
          <SiteFooter />
        </div>
        <BottomNav loggedIn={Boolean(player)} boosters={boosters} />
        <Toaster />
        <Suspense fallback={null}>
          <ScrollRestorer />
          <NavigationProgress />
        </Suspense>
        {player && <RealtimeListener me={player.id} />}
      </body>
    </html>
  );
}
