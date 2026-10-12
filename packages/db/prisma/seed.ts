/**
 * Seed de démo : quelques comptes de test.
 * Idempotent (upsert sur le handle). Les collections pré-remplies arriveront en phase 3,
 * une fois le catalogue importé.
 *
 * Lancer : npm run db:seed
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { gameConfig } from "@pokeflex/config";
import { type Prisma, prisma } from "../src/index";

export const DEMO_USERS = [
  { handle: "demo-dresseur", name: "Dresseur Démo", boosterStock: gameConfig.boosters.maxStock },
  { handle: "demo-collection", name: "Collectionneuse Démo", boosterStock: 3 },
  { handle: "demo-marchand", name: "Marchand Démo", boosterStock: 0 },
] as const;

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
  for (const u of DEMO_USERS) {
    await prisma.user.upsert({
      where: { handle: u.handle },
      update: { name: u.name },
      create: {
        handle: u.handle,
        name: u.name,
        boosterStock: u.boosterStock,
        boosterAnchorAt: new Date(),
      },
    });
  }
  console.log(`Seed terminé : ${DEMO_USERS.length} comptes de démo.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
