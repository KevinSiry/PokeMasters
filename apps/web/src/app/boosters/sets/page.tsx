import { boosterSize, gameConfig } from "@pokeflex/config";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BoosterTabs } from "@/components/booster/booster-tabs";
import { SetShop } from "@/components/booster/set-shop";
import { WeeklySetBanner } from "@/components/booster/weekly-set-banner";
import { Jetons } from "@/components/jetons";
import { getBoosterSets, getPackCover, getWeeklySet } from "@pokeflex/server";
import { getCurrentPlayer } from "@/lib/player";

export const metadata: Metadata = { title: "Boosters de set" };

export default async function SetBoostersPage() {
  const player = await getCurrentPlayer();
  if (!player) redirect("/connexion?suite=/boosters/sets");
  const [sets, weekly] = await Promise.all([getBoosterSets(player.id), getWeeklySet()]);
  const weeklyCover = weekly ? await getPackCover(weekly.setId) : null;
  const price = gameConfig.boosters.setBoosterPrice;
  return (
    <div className="grid grid-cols-1 gap-6 pb-10">
      <BoosterTabs current="sets" />
      <header className="grid gap-2 text-center">
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Boosters de set</h1>
        <p className="mx-auto max-w-[52ch] text-muted">
          Cible le set qui te manque : un vrai paquet de ce set ({boosterSize()} cartes, 11 pour l&apos;époque Wizards) pour <Jetons value={price} className="text-fg" />.{" "}
          <span className="whitespace-nowrap">
            Ton solde : <Jetons value={player.balance} className="text-[#FFC93C]" />
          </span>
        </p>
      </header>
      {weekly && <WeeklySetBanner weekly={weekly} cover={weeklyCover} />}
      <SetShop
        sets={sets.map((s) => ({ ...s, releaseDate: s.releaseDate?.toISOString() ?? null }))}
        balance={player.balance}
        price={price}
        weekly={weekly ? { setId: weekly.setId, price: weekly.price } : null}
      />
    </div>
  );
}
