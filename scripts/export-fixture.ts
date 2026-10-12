/**
 * Exporte un petit échantillon du catalogue importé vers
 * packages/db/prisma/fixtures/catalog.json : le seed s'en sert quand la base n'a
 * pas encore de catalogue (CI, démo hors ligne).
 *
 *   npm run fixture:export -- --sets=base1,sv03.5
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "@pokeflex/db";

const sets = (process.argv.find((a) => a.startsWith("--sets="))?.split("=")[1] ?? "base1,sv03.5").split(",");

async function main() {
  const setRows = await prisma.set.findMany({ where: { id: { in: sets } } });
  const series = await prisma.serie.findMany({ where: { id: { in: setRows.map((s) => s.serieId) } } });
  const cards = await prisma.card.findMany({ where: { setId: { in: sets } }, orderBy: [{ setId: "asc" }, { sortKey: "asc" }] });
  const out = path.resolve(import.meta.dirname, "../packages/db/prisma/fixtures/catalog.json");
  writeFileSync(out, JSON.stringify({ series, sets: setRows, cards }, null, 0));
  console.log(`✓ ${series.length} séries, ${setRows.length} sets, ${cards.length} cartes → ${path.relative(process.cwd(), out)}`);
}

main().finally(() => prisma.$disconnect());
