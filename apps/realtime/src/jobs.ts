/**
 * Tâches de fond planifiées du serveur temps réel.
 *
 * Synchro quotidienne du catalogue : détection des nouveaux sets puis rotation des prix.
 * On vérifie toutes les heures si la dernière synchro réussie date de plus de 24 h :
 * pas de cron système (rien à installer sous Windows), et redémarrer le serveur ne
 * relance pas une synchro déjà faite dans la journée.
 *
 * Toutes les heures : instantané des classements.
 *
 * Toutes les 15 s : clôture des enchères échues (le marché rattrape aussi à l'affichage)
 * et expiration des défis de duel restés sans réponse.
 */
import { gameConfig } from "@pokeflex/config";
import { prisma } from "@pokeflex/db";
import { closeDueAuctions, expireDuels, lastLeaderboardAt, takeLeaderboardSnapshots } from "@pokeflex/server";
import { createTcgdexClient, syncCatalog } from "@pokeflex/tcgdex";

const DAY = 24 * 60 * 60_000;
const CHECK_EVERY = 60 * 60_000;

export function shouldRunDailySync(lastFinishedAt: Date | null, now: Date): boolean {
  return !lastFinishedAt || now.getTime() - lastFinishedAt.getTime() >= DAY;
}

async function dailyCatalogSync() {
  const last = await prisma.syncRun.findFirst({
    where: { kind: "new-sets", finishedAt: { not: null }, error: null },
    orderBy: { finishedAt: "desc" },
    select: { finishedAt: true },
  });
  // Pas de catalogue du tout : l'import initial se lance à la main (npm run sync:catalog).
  if ((await prisma.card.count()) === 0) return;
  if (!shouldRunDailySync(last?.finishedAt ?? null, new Date())) return;

  const client = createTcgdexClient({
    concurrency: gameConfig.catalog.sync.concurrency,
    maxRetries: gameConfig.catalog.sync.maxRetries,
    retryBaseDelayMs: gameConfig.catalog.sync.retryBaseDelayMs,
  });
  const log = (l: string) => console.log(`[sync] ${l.trim()}`);
  const added = await syncCatalog({ prisma, client, mode: "new-sets", log });
  log(`nouveaux sets : ${added.sets}, cartes : ${added.cards}`);
  const prices = await syncCatalog({ prisma, client, mode: "prices", log });
  log(`prix rafraîchis : ${prices.cards}`);
}

export type ExpiredDuel = Awaited<ReturnType<typeof expireDuels>>[number];

/** Clôture des enchères échues et expiration des défis, toutes les 15 secondes. */
function startSweeper(onDuelsExpired: (duels: ExpiredDuel[]) => void) {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const closed = await closeDueAuctions();
      if (closed > 0) console.log(`[marche] ${closed} enchère(s) clôturée(s)`);
    } catch (err) {
      console.error("[marche] clôture des enchères impossible", err instanceof Error ? err.message : err);
    }
    try {
      const expired = await expireDuels();
      if (expired.length > 0) onDuelsExpired(expired);
    } catch (err) {
      console.error("[duels] expiration des défis impossible", err instanceof Error ? err.message : err);
    } finally {
      running = false;
    }
  };
  const timer = setInterval(tick, 15_000);
  void tick();
  return () => clearInterval(timer);
}

export function shouldSnapshotLeaderboards(last: Date | null, now: Date, everyMs: number): boolean {
  return !last || now.getTime() - last.getTime() >= everyMs;
}

/** Classements figés toutes les heures (vérification toutes les 5 minutes, survit aux redémarrages). */
function startLeaderboards() {
  const tick = async () => {
    try {
      if (!shouldSnapshotLeaderboards(await lastLeaderboardAt(), new Date(), gameConfig.social.leaderboardRefreshMs)) return;
      await takeLeaderboardSnapshots();
      console.log("[classements] instantané pris");
    } catch (err) {
      console.error("[classements] instantané impossible", err instanceof Error ? err.message : err);
    }
  };
  const first = setTimeout(tick, 5_000);
  const timer = setInterval(tick, 5 * 60_000);
  return () => {
    clearTimeout(first);
    clearInterval(timer);
  };
}

export function startJobs(onDuelsExpired: (duels: ExpiredDuel[]) => void = () => {}) {
  const stopSweeper = startSweeper(onDuelsExpired);
  const stopBoards = startLeaderboards();
  const stopAuctions = () => {
    stopSweeper();
    stopBoards();
  };
  if (process.env.CATALOG_AUTO_SYNC === "false") return stopAuctions;
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await dailyCatalogSync();
    } catch (err) {
      console.error("[sync] échec de la synchro quotidienne", err instanceof Error ? err.message : err);
    } finally {
      running = false;
    }
  };
  const first = setTimeout(tick, 30_000);
  const timer = setInterval(tick, CHECK_EVERY);
  return () => {
    stopAuctions();
    clearTimeout(first);
    clearInterval(timer);
  };
}
