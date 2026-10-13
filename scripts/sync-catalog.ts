/**
 * Import / synchronisation du catalogue TCGdex (fonctionne sous Windows, macOS et Linux).
 *
 *   npm run sync:catalog                 import complet, reprend un import interrompu
 *   npm run sync:catalog -- --restart    repart de zéro
 *   npm run sync:catalog -- --new-sets   seulement les nouveaux sets (job quotidien)
 *   npm run sync:catalog -- --prices     rotation quotidienne des prix
 *   npm run sync:catalog -- --sets=base1,swsh3   seulement ces sets
 *   npm run sync:catalog -- --retier     recalcule les tiers après une modif de config/rarities.ts
 *   npm run sync:catalog -- --names      redonne un nom français aux cartes importées en anglais
 *   npm run sync:catalog -- --images     images de repli (Pokémon TCG API) pour les cartes sans scan TCGdex
 *
 * Écrit `reports/rarities.md` à la fin.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gameConfig } from "@pokeflex/config";
import { prisma } from "@pokeflex/db";
import { createTcgdexClient, fillFallbackImages, fillFrenchNames, rarityReport, retierCatalog, syncCatalog, type SyncMode } from "@pokeflex/tcgdex";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const value = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];

const mode: SyncMode = flag("prices") ? "prices" : flag("new-sets") ? "new-sets" : "full";
const onlySets = value("sets")?.split(",").map((s) => s.trim()).filter(Boolean);
const concurrency = Number(value("concurrency") ?? gameConfig.catalog.sync.concurrency);
const root = path.resolve(import.meta.dirname, "..");

async function writeReport() {
  const report = await rarityReport(prisma);
  mkdirSync(path.join(root, "reports"), { recursive: true });
  writeFileSync(path.join(root, "reports", "rarities.md"), report);
  console.log("✓ Rapport des raretés : reports/rarities.md");
}

async function main() {
  if (flag("retier")) {
    const changed = await retierCatalog(prisma);
    console.log(`✓ ${changed} cartes ont changé de tier.`);
    await writeReport();
    return;
  }
  if (flag("names")) {
    const changed = await fillFrenchNames(prisma);
    console.log(`✓ ${changed} cartes anglaises ont reçu leur nom français.`);
    return;
  }
  if (flag("images")) {
    const filled = await fillFallbackImages(prisma, { log: console.log });
    console.log(`✓ ${filled} cartes sans scan TCGdex ont reçu une image anglaise.`);
    return;
  }
  const client = createTcgdexClient({
    concurrency,
    maxRetries: gameConfig.catalog.sync.maxRetries,
    retryBaseDelayMs: gameConfig.catalog.sync.retryBaseDelayMs,
    onRetry: ({ url, attempt, reason }) => console.warn(`  ↻ essai ${attempt} pour ${url} (${reason})`),
  });

  // Ctrl+C : on marque le run comme interrompu pour pouvoir le reprendre tout de suite.
  process.once("SIGINT", async () => {
    console.log("\n⏸  Interrompu : relance `npm run sync:catalog` pour reprendre.");
    await prisma.syncRun.updateMany({ where: { finishedAt: null, error: null }, data: { error: "interrompu" } });
    process.exit(130);
  });

  const t0 = Date.now();
  console.log(`PokeFlex : synchronisation du catalogue (${mode}, concurrence ${concurrency})`);
  const stats = await syncCatalog({ prisma, client, mode, onlySets, restart: flag("restart"), log: console.log });
  const mins = ((Date.now() - t0) / 60_000).toFixed(1);
  console.log(
    `✓ Terminé en ${mins} min : ${stats.sets} sets, ${stats.cards} cartes (${stats.cardsEnOnly} en anglais faute de version FR), ${stats.skippedSets} sets sautés.`,
  );
  if (stats.failed.length) {
    console.warn(`! ${stats.failed.length} cartes en échec (relance la commande pour les reprendre) :`);
    for (const f of stats.failed.slice(0, 20)) console.warn(`  - ${f}`);
  }
  await writeReport();
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
