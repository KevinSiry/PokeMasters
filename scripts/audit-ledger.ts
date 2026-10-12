/**
 * Vérifie le registre des Jetons : pour chaque joueur, SUM(delta) = balance
 * et le dernier balanceAfter = balance. Code de sortie 1 en cas d'écart.
 *
 * Lancer : npm run audit:ledger
 */
import { auditLedger, prisma } from "@pokeflex/db";

async function main() {
  const [{ users, entries }] = await prisma.$queryRaw<{ users: bigint; entries: bigint }[]>`
    SELECT (SELECT count(*) FROM "User") AS users, (SELECT count(*) FROM "LedgerEntry") AS entries`;
  const bad = await auditLedger(prisma);
  console.log(`${users} joueurs, ${entries} mouvements vérifiés.`);
  if (bad.length === 0) {
    console.log("Registre cohérent : chaque solde est égal à la somme de ses mouvements.");
    return;
  }
  console.error(`${bad.length} solde(s) incohérent(s) :`);
  for (const b of bad) {
    console.error(`  ${b.handle ?? b.id} : solde ${b.balance}, somme du registre ${b.sum ?? 0}, dernier solde inscrit ${b.last_after ?? "aucun"}`);
  }
  process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
