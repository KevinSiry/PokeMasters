/**
 * Seed de démo : quelques comptes de test.
 * Idempotent (upsert sur le handle). Les collections pré-remplies arriveront en phase 3,
 * une fois le catalogue importé.
 *
 * Lancer : npm run db:seed
 */
import { gameConfig } from "@pokeflex/config";
import { prisma } from "../src/index";

export const DEMO_USERS = [
  { handle: "demo-dresseur", name: "Dresseur Démo", boosterStock: gameConfig.boosters.maxStock },
  { handle: "demo-collection", name: "Collectionneuse Démo", boosterStock: 3 },
  { handle: "demo-marchand", name: "Marchand Démo", boosterStock: 0 },
] as const;

async function main() {
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
