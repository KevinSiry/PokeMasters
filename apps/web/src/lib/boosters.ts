/**
 * Ouverture des boosters, entièrement côté serveur.
 * Le tirage est fait et enregistré ici avant toute animation : le client ne fait que révéler.
 */
import { gameConfig, TIERS, type Finish, type Tier } from "@pokeflex/config";
import { prisma } from "@pokeflex/db";
import { consumeBooster, cryptoRng, drawBoosterTiers, drawFinish, drawIndex, type Rng } from "@pokeflex/game";

const POOL_TTL_MS = 10 * 60_000;
let poolCache: { at: number; pools: Record<Tier, string[]> } | null = null;

/** Ids des cartes tirables, groupés par tier (en mémoire, rafraîchis toutes les 10 min). */
export async function getDropPools(): Promise<Record<Tier, string[]>> {
  if (poolCache && Date.now() - poolCache.at < POOL_TTL_MS) return poolCache.pools;
  const rows = await prisma.card.findMany({ where: { droppable: true }, select: { id: true, tier: true }, orderBy: { id: "asc" } });
  const pools = Object.fromEntries(TIERS.map((t) => [t, [] as string[]])) as Record<Tier, string[]>;
  for (const r of rows) pools[r.tier].push(r.id);
  poolCache = { at: Date.now(), pools };
  return pools;
}

export function invalidateDropPools() {
  poolCache = null;
}

export interface PulledCard {
  copyId: string;
  id: string;
  name: string;
  image: string | null;
  tier: Tier;
  finish: Finish;
  lang: "fr" | "en";
  localId: string;
  setName: string;
  isNew: boolean;
}

export interface BoosterResult {
  openingId: string;
  cards: PulledCard[];
  boosters: { available: number; nextAt: string | null };
}

export class BoosterError extends Error {
  constructor(
    readonly code: "no_booster" | "empty_catalog",
    message: string,
  ) {
    super(message);
    this.name = "BoosterError";
  }
}

/**
 * Ouvre un booster gratuit « Toutes époques » pour `userId`.
 * Verrouille la ligne du joueur : deux clics simultanés ne consomment pas deux fois le même booster.
 */
export async function openFreeBooster(userId: string, rng: Rng = cryptoRng, now = new Date()): Promise<BoosterResult> {
  const pools = await getDropPools();
  const sizes = Object.fromEntries(TIERS.map((t) => [t, pools[t].length])) as Record<Tier, number>;
  if (TIERS.every((t) => sizes[t] === 0)) {
    throw new BoosterError("empty_catalog", "Le catalogue est vide : lance npm run sync:catalog.");
  }

  return prisma.$transaction(async (tx) => {
    const [user] = await tx.$queryRaw<{ boosterStock: number; boosterAnchorAt: Date }[]>`
      SELECT "boosterStock", "boosterAnchorAt" FROM "User" WHERE id = ${userId} FOR UPDATE`;
    if (!user) throw new BoosterError("no_booster", "Joueur introuvable.");

    let next;
    try {
      next = consumeBooster({ stock: user.boosterStock, anchorAt: user.boosterAnchorAt }, now, gameConfig.boosters);
    } catch {
      throw new BoosterError("no_booster", "Aucun booster disponible pour l'instant.");
    }
    await tx.user.update({ where: { id: userId }, data: { boosterStock: next.stock, boosterAnchorAt: next.anchorAt } });

    const tiers = drawBoosterTiers(gameConfig.boosters, sizes, rng);
    const ids = tiers.map((t) => pools[t][drawIndex(pools[t].length, rng)]!);
    const cards = await tx.card.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, image: true, tier: true, lang: true, localId: true, variants: true, set: { select: { name: true } } },
    });
    const byId = new Map(cards.map((c) => [c.id, c]));
    const owned = new Set(
      (
        await tx.cardCopy.findMany({ where: { ownerId: userId, cardId: { in: ids } }, select: { cardId: true }, distinct: ["cardId"] })
      ).map((c) => c.cardId),
    );
    const finishes = ids.map((id) =>
      drawFinish(byId.get(id)?.variants as Partial<Record<Finish, boolean>> | null, gameConfig.finishes.weights, rng),
    );

    const opening = await tx.boosterOpening.create({
      data: { userId, kind: "all_eras", cardIds: ids, tiers, finishes },
    });
    const copies = await tx.cardCopy.createManyAndReturn({
      data: ids.map((cardId, i) => ({
        ownerId: userId,
        cardId,
        finish: finishes[i],
        obtainedVia: "booster",
        openingId: opening.id,
      })),
      select: { id: true },
    });

    const seen = new Set<string>();
    const pulled: PulledCard[] = ids.map((id, i) => {
      const c = byId.get(id)!;
      const isNew = !owned.has(id) && !seen.has(id);
      seen.add(id);
      return {
        copyId: copies[i]!.id,
        id,
        name: c.name,
        image: c.image,
        // Le tier du tirage fait foi (la carte a pu changer de tier depuis la mise en cache du pool).
        tier: tiers[i]!,
        finish: finishes[i]!,
        lang: c.lang,
        localId: c.localId,
        setName: c.set.name,
        isNew,
      };
    });

    const stockAfter = next.stock;
    const nextAt =
      stockAfter >= gameConfig.boosters.maxStock
        ? null
        : new Date(next.anchorAt.getTime() + gameConfig.boosters.refillIntervalMs).toISOString();
    return { openingId: opening.id, cards: pulled, boosters: { available: stockAfter, nextAt } };
  });
}
