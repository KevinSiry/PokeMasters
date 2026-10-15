import { gameConfig } from "@pokeflex/config";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BoosterOpening } from "@/components/booster/booster-opening";
import { BoosterTabs } from "@/components/booster/booster-tabs";
import { getPackCover } from "@pokeflex/server";
import { getCurrentPlayer } from "@/lib/player";

export const metadata: Metadata = { title: "Boosters" };

export default async function BoostersPage() {
  const player = await getCurrentPlayer();
  if (!player) redirect("/connexion?suite=/boosters");
  const cover = await getPackCover();
  return (
    <>
      <h1 className="sr-only">Ouvrir un booster</h1>
      <BoosterTabs current="free" />
      <BoosterOpening
        available={player.boosters.available}
        nextAt={player.boosters.nextAt}
        maxStock={player.boosters.maxStock}
        refillIntervalMs={gameConfig.boosters.refillIntervalMs}
        balance={player.balance}
        cover={cover}
      />
    </>
  );
}
