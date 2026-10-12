import { gameConfig } from "@pokeflex/config";
import { prisma } from "@pokeflex/db";
import { boosterStatus } from "@pokeflex/game";
import { unstable_rethrow } from "next/navigation";
import { auth } from "@/auth";

/** Joueur connecté et son état de jeu, ou null. Lecture seule. */
export async function getCurrentPlayer() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, handle: true, image: true, balance: true, boosterStock: true, boosterAnchorAt: true },
  });
  if (!user) return null;
  const status = boosterStatus(
    { stock: user.boosterStock, anchorAt: user.boosterAnchorAt },
    new Date(),
    gameConfig.boosters,
  );
  return {
    id: user.id,
    displayName: user.name ?? user.handle ?? "Dresseur",
    image: user.image,
    balance: user.balance,
    boosters: { available: status.available, maxStock: status.maxStock, nextAt: status.nextAt?.toISOString() ?? null },
  };
}

export type CurrentPlayer = NonNullable<Awaited<ReturnType<typeof getCurrentPlayer>>>;

/**
 * Comme `getCurrentPlayer`, mais renvoie null si la session ne peut pas être lue
 * (base indisponible…) : les pages publiques restent consultables.
 */
export async function getCurrentPlayerSafe(): Promise<CurrentPlayer | null> {
  try {
    return await getCurrentPlayer();
  } catch (err) {
    // Laisse passer les signaux internes de Next.js (rendu dynamique, redirections…).
    unstable_rethrow(err);
    console.error("[player] lecture du joueur impossible", err);
    return null;
  }
}
