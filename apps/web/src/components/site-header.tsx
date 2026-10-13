import { gameConfig } from "@pokeflex/config";
import Link from "next/link";
import { signOut } from "@/auth";
import { BalanceChip } from "@/components/balance-chip";
import { BoosterTimer } from "@/components/booster-timer";
import { Logo } from "@/components/logo";
import { MessagesLink } from "@/components/messages-link";
import { DesktopNav } from "@/components/main-nav";
import { UserMenu } from "@/components/user-menu";
import { Button } from "@/components/ui/button";
import type { CurrentPlayer } from "@/lib/player";

export function SiteHeader({ player }: { player: CurrentPlayer | null }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
        <div className="flex items-center gap-6">
          <Logo />
          <DesktopNav loggedIn={Boolean(player)} />
        </div>
        {player ? (
          <div className="flex items-center gap-2 sm:gap-3">
            <BoosterTimer
              available={player.boosters.available}
              maxStock={player.boosters.maxStock}
              nextAt={player.boosters.nextAt}
              refillIntervalMs={gameConfig.boosters.refillIntervalMs}
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
