/**
 * Seed de démo : quelques comptes de test.
 * Idempotent (upsert sur le handle) : collections simulées et Jetons de départ
 * ne sont ajoutés qu'une fois.
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
  { handle: "demo-dresseur", name: "Dresseur Démo", boosterStock: gameConfig.boosters.maxStock, boosters: 0, jetons: 0 },
  { handle: "demo-collection", name: "Collectionneuse Démo", boosterStock: 3, boosters: 120, jetons: 600 },
  { handle: "demo-marchand", name: "Marchand Démo", boosterStock: 0, boosters: 60, jetons: 2500 },
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

/** Jetons de démo, inscrits au registre comme tout mouvement (une seule fois). */
async function seedJetons(userId: string, amount: number) {
  if (amount <= 0 || (await prisma.ledgerEntry.count({ where: { userId } })) > 0) return 0;
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({ where: { id: userId }, data: { balance: { increment: amount } } });
    await tx.ledgerEntry.create({ data: { userId, delta: amount, balanceAfter: user.balance, reason: "seed" } });
  });
  return amount;
}

/**
 * Quelques annonces du marchand de démo (doublons, prix d'après la rareté), pour que le marché
 * ne soit pas vide à la découverte. Les frais sont payés et inscrits au registre comme pour un joueur.
 */
async function seedListings(userId: string) {
  if ((await prisma.listing.count({ where: { sellerId: userId } })) > 0) return 0;
  const copies = await prisma.cardCopy.findMany({
    where: { ownerId: userId, status: "owned" },
    select: { id: true, cardId: true, finish: true, card: { select: { tier: true } } },
    orderBy: { id: "asc" },
  });
  const seen = new Set<string>();
  const dups = copies.filter((c) => (seen.has(c.cardId) ? true : (seen.add(c.cardId), false)));
  const rank = (t: Tier) => TIERS.indexOf(t);
  // Doublons d'abord, puis les cartes les plus rares, pour une vitrine variée.
  const dupIds = new Set(dups.map((d) => d.id));
  const picks = [...copies]
    .sort((a, b) => Number(dupIds.has(b.id)) - Number(dupIds.has(a.id)) || rank(b.card.tier) - rank(a.card.tier))
    .slice(0, 16);
  const { market, economy } = gameConfig;
  let n = 0;
  for (const [i, c] of picks.entries()) {
    const auction = i % 4 === 0;
    const price = Math.max(3, economy.recycleValue[c.card.tier] * (auction ? 2 : 4));
    const fee = Math.max(market.listingFeeMin, Math.ceil(price * market.listingFeeRate));
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({ where: { id: userId }, data: { balance: { decrement: fee } } });
      await tx.cardCopy.update({ where: { id: c.id }, data: { status: "listed" } });
      const listing = await tx.listing.create({
        data: {
          sellerId: userId,
          copyId: c.id,
          cardId: c.cardId,
          finish: c.finish,
          type: auction ? "auction" : "fixed",
          price,
          fee,
          endsAt: auction ? new Date(Date.now() + market.auctionDurationsMs[2]!) : null,
        },
      });
      await tx.ledgerEntry.create({
        data: { userId, delta: -fee, balanceAfter: user.balance, reason: "market_fee", refType: "listing", refId: listing.id },
      });
    });
    n++;
  }
  return n;
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
    const jetons = await seedJetons(user.id, u.jetons);
    if (jetons) console.log(`  ${u.name} : ${jetons} Jetons.`);
    if (u.handle === "demo-marchand") {
      const listed = await seedListings(user.id);
      if (listed) console.log(`  ${u.name} : ${listed} annonces au marché.`);
    }
  }
  console.log(`Seed terminé : ${DEMO_USERS.length} comptes de démo.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
