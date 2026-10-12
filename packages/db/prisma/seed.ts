/**
 * Seed de démo : quelques comptes de test.
 * Idempotent (upsert sur le handle). Les collections pré-remplies arriveront en phase 3,
 * une fois le catalogue importé.
 *
 * Lancer : npm run db:seed
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { TIERS, gameConfig, type Finish, type Tier } from "@pokeflex/config";
import { drawBoosterTiers, drawFinish, drawIndex, seededRng } from "@pokeflex/game";
import { type Prisma, prisma } from "../src/index";

/** `boosters` : nombre de boosters déjà « ouverts » par le seed pour remplir la collection. */
export const DEMO_USERS = [
  { handle: "demo-dresseur", name: "Dresseur Démo", boosterStock: gameConfig.boosters.maxStock, boosters: 0 },
  { handle: "demo-collection", name: "Collectionneuse Démo", boosterStock: 3, boosters: 120 },
  { handle: "demo-marchand", name: "Marchand Démo", boosterStock: 0, boosters: 60 },
] as const;

/** Remplit la collection d'un compte de démo en simulant des ouvertures (graine fixe : reproductible). */
async function seedCollection(userId: string, boosters: number, seed: number) {
  if (boosters === 0 || (await prisma.cardCopy.count({ where: { ownerId: userId } })) > 0) return 0;
  const cards = await prisma.card.findMany({ where: { droppable: true }, select: { id: true, tier: true, variants: true } });
  const pools = Object.fromEntries(TIERS.map((t) => [t, [] as typeof cards])) as Record<Tier, typeof cards>;
  for (const c of cards) pools[c.tier].push(c);
  const sizes = Object.fromEntries(TIERS.map((t) => [t, pools[t].length])) as Record<Tier, number>;
  if (TIERS.every((t) => sizes[t] === 0)) return 0;
  const rng = seededRng(seed);
  const data: Prisma.CardCopyCreateManyInput[] = [];
  for (let b = 0; b < boosters; b++) {
    for (const tier of drawBoosterTiers(gameConfig.boosters, sizes, rng)) {
      const card = pools[tier][drawIndex(pools[tier].length, rng)]!;
      const finish = drawFinish(card.variants as Partial<Record<Finish, boolean>>, gameConfig.finishes.weights, rng);
      data.push({ ownerId: userId, cardId: card.id, finish, obtainedVia: "seed" });
    }
  }
  await prisma.cardCopy.createMany({ data });
  return data.length;
}

/**
 * Sans catalogue importé (CI, première découverte hors ligne), on charge un échantillon
 * réel (Set de Base et 151) exporté par `npm run fixture:export`.
 */
async function seedCatalogSample() {
  if ((await prisma.card.count()) > 0) return false;
  const file = path.join(import.meta.dirname, "fixtures", "catalog.json");
  const sample = JSON.parse(readFileSync(file, "utf8")) as {
    series: Prisma.SerieCreateManyInput[];
    sets: Prisma.SetCreateManyInput[];
    cards: Prisma.CardCreateManyInput[];
  };
  await prisma.serie.createMany({ data: sample.series, skipDuplicates: true });
  await prisma.set.createMany({ data: sample.sets, skipDuplicates: true });
  await prisma.card.createMany({ data: sample.cards, skipDuplicates: true });
  console.log(`Échantillon de catalogue chargé : ${sample.sets.length} sets, ${sample.cards.length} cartes.`);
  return true;
}

async function main() {
  await seedCatalogSample();
  let seedIndex = 0;
  for (const u of DEMO_USERS) {
    seedIndex++;
    const user = await prisma.user.upsert({
      where: { handle: u.handle },
      update: { name: u.name },
      create: {
        handle: u.handle,
        name: u.name,
        boosterStock: u.boosterStock,
        boosterAnchorAt: new Date(),
      },
    });
    const copies = await seedCollection(user.id, u.boosters, 1000 + seedIndex);
    if (copies) console.log(`  ${u.name} : ${copies} cartes en collection.`);
  }
  console.log(`Seed terminé : ${DEMO_USERS.length} comptes de démo.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
