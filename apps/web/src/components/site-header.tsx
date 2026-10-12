import { gameConfig } from "@pokeflex/config";
import { LogOut } from "lucide-react";
import Link from "next/link";
import { signOut } from "@/auth";
import { BoosterTimer } from "@/components/booster-timer";
import { Logo } from "@/components/logo";
import { DesktopNav } from "@/components/main-nav";
import { Button } from "@/components/ui/button";
import { formatJetons } from "@/lib/utils";
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
            <span
              className="hidden font-mono text-sm text-lime font-tabular sm:inline"
              aria-label={`${formatJetons(player.balance)} Jetons`}
            >
              {formatJetons(player.balance)}&nbsp;J
            </span>
            {player.image ? (
              // eslint-disable-next-line @next/next/no-img-element -- avatar fourni par Twitch/Discord
              <img src={player.image} alt="" className="size-8 rounded-full border border-line" />
            ) : (
              <span aria-hidden="true" className="grid size-8 place-items-center rounded-full bg-elev font-display text-xs">
                {player.displayName.slice(0, 1).toUpperCase()}
              </span>
            )}
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <Button variant="ghost" size="sm" type="submit" aria-label="Se déconnecter" className="px-2.5">
                <LogOut />
              </Button>
            </form>
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
