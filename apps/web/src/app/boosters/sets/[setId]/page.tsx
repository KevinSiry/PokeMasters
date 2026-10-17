import { gameConfig } from "@pokeflex/config";
import { prisma } from "@pokeflex/db";
import { getPackCover } from "@pokeflex/server";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { BackLink } from "@/components/back-link";
import { BoosterOpening } from "@/components/booster/booster-opening";
import { getCurrentPlayer } from "@/lib/player";

type Params = Promise<{ setId: string }>;

async function getEligibleSet(setId: string) {
  const set = await prisma.set.findUnique({ where: { id: setId }, select: { id: true, name: true, logo: true } });
  if (!set) return null;
  const droppable = await prisma.card.count({ where: { setId, droppable: true } });
  return droppable >= gameConfig.setBoosters.minDroppableCards ? set : null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const set = await prisma.set.findUnique({ where: { id: (await params).setId }, select: { name: true } });
  return { title: set ? `Booster ${set.name}` : "Booster de set" };
}

export default async function SetBoosterPage({ params }: { params: Params }) {
  const { setId } = await params;
  const player = await getCurrentPlayer();
  if (!player) redirect(`/connexion?suite=/boosters/sets/${encodeURIComponent(setId)}`);
  const set = await getEligibleSet(setId);
  if (!set) notFound();
  const cover = await getPackCover(set.id);
  return (
    <>
      <h1 className="sr-only">Booster {set.name}</h1>
      <BackLink href="/boosters/sets" className="mt-5" />
      <BoosterOpening
        available={player.boosters.available}
        nextAt={player.boosters.nextAt}
        maxStock={player.boosters.maxStock}
        refillIntervalMs={gameConfig.boosters.refillIntervalMs}
        balance={player.balance}
        set={{ id: set.id, name: set.name, logo: set.logo, price: gameConfig.boosters.setBoosterPrice }}
        cover={cover}
      />
    </>
  );
}
