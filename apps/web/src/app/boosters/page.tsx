import { gameConfig } from "@pokeflex/config";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BoosterOpening } from "@/components/booster/booster-opening";
import { getCurrentPlayer } from "@/lib/player";

export const metadata: Metadata = { title: "Boosters" };

export default async function BoostersPage() {
  const player = await getCurrentPlayer();
  if (!player) redirect("/connexion?suite=/boosters");
  return (
    <>
      <h1 className="sr-only">Ouvrir un booster</h1>
      <BoosterOpening
        available={player.boosters.available}
        nextAt={player.boosters.nextAt}
        maxStock={player.boosters.maxStock}
        refillIntervalMs={gameConfig.boosters.refillIntervalMs}
      />
    </>
  );
}
