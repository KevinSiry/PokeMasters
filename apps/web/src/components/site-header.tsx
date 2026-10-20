import { gameConfig } from "@pokeflex/config";
import Link from "next/link";
import { signOut } from "@/auth";
import { BalanceChip } from "@/components/balance-chip";
import { BoosterTimer } from "@/components/booster-timer";
import { SearchBox } from "@/components/catalog/search-box";
import { Logo } from "@/components/logo";
import { MessagesLink } from "@/components/messages-link";
import { UserMenu } from "@/components/user-menu";
import { Button } from "@/components/ui/button";
import type { CurrentPlayer } from "@/lib/player";

export function SiteHeader({ player }: { player: CurrentPlayer | null }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-bg/80 backdrop-blur-md">
      <div className="pf-container flex h-14 items-center justify-between gap-2 sm:h-16 sm:gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-6">
          {/* Sur ordinateur, le logo est dans la barre latérale ; la recherche prend sa place. */}
          <div className="lg:hidden">
            <Logo compact={Boolean(player)} />
          </div>
          <SearchBox id="pf-header-search" size="sm" className="hidden w-full max-w-md lg:block" />
        </div>
        {player ? (
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
            <BoosterTimer
              available={player.boosters.available}
              maxStock={player.boosters.maxStock}
              nextAt={player.boosters.nextAt}
              refillIntervalMs={gameConfig.boosters.refillIntervalMs}
              // Très petits écrans : l'onglet Boosters de la barre du bas porte déjà le compteur.
              className="max-[359px]:hidden"
            />
            <BalanceChip balance={player.balance} />
            <MessagesLink unread={player.unreadMessages} />
            <UserMenu
              name={player.displayName}
              handle={player.handle}
              image={player.image}
              friendRequests={player.friendRequests}
              pendingTrades={player.pendingTrades}
              signOutAction={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            />
          </div>
        ) : (
          <Button asChild size="sm">
            <Link href="/connexion">Se connecter</Link>
          </Button>
        )}
      </div>
    </header>
  );
}
