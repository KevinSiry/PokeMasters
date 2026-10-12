import "@fontsource-variable/inter";
import "@fontsource-variable/unbounded";
import "@fontsource/space-mono/400.css";
import "@fontsource/space-mono/700.css";
import "./globals.css";
import type { Metadata, Viewport } from "next";
import { BottomNav } from "@/components/main-nav";
import { RealtimeListener } from "@/components/realtime-listener";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Toaster } from "@/components/toaster";
import { getCurrentPlayerSafe } from "@/lib/player";

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
  return (
    <html lang="fr">
      <body>
        <a
          href="#contenu"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-elev focus:px-4 focus:py-2"
        >
          Aller au contenu
        </a>
        <SiteHeader player={player} />
        <main id="contenu" className="mx-auto max-w-6xl px-4">
          {children}
        </main>
        <SiteFooter />
        <BottomNav loggedIn={Boolean(player)} />
        <Toaster />
        {player && <RealtimeListener me={player.id} />}
      </body>
    </html>
  );
}
