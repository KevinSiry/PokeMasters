/**
 * Synchronisation du catalogue TCGdex vers la base locale.
 *
 * - `full`     : tous les sets, toutes les cartes (import initial). Reprenable : un run
 *                interrompu reprend après le dernier set terminé.
 * - `new-sets` : seulement les sets absents de la base, dont le nombre de cartes a changé
 *                ou pour lesquels TCGdex a publié de nouvelles images (job quotidien).
 * - `prices`   : rafraîchit prix et tiers d'une fraction du catalogue (rotation quotidienne).
 *
 * Idempotent : chaque carte est écrite par upsert, relancer ne crée pas de doublon.
 */
import { RARITY_TIERS, gameConfig } from "@pokeflex/config";
import { Prisma, type PrismaClient } from "@pokeflex/db";
import { computeTier } from "@pokeflex/game";
import type { TcgdexClient, TcgdexLang } from "./client";
import { isExcludedSerie, needsResync, toCardRecord, toSetRecord, type CardRecord } from "./normalize";
import type { CardSummary, SetDetail } from "./schemas";

export type SyncMode = "full" | "new-sets" | "prices";

export interface SyncOptions {
  prisma: PrismaClient;
  client: TcgdexClient;
  mode: SyncMode;
  /** Limiter à certains sets (débogage, tests). */
  onlySets?: string[];
  /** Ignorer un run interrompu et repartir de zéro. */
  restart?: boolean;
  log?: (line: string) => void;
  now?: () => Date;
}

export interface SyncStats {
  sets: number;
  cards: number;
  cardsEnOnly: number;
  failed: string[];
  skippedSets: number;
}

const STALE_RUN_MS = 10 * 60_000;

function cardData(rec: CardRecord, now: Date) {
  const { tier, reason } = computeTier(
    { rarityRaw: rec.rarityRaw, priceEur: rec.priceEur },
    RARITY_TIERS,
    gameConfig.rarity.priceBumpEur,
  );
  const { priceEur, ...rest } = rec;
  return {
    ...rest,
    variants: { ...rest.variants } as Prisma.InputJsonObject,
    tier,
    tierReason: reason,
    priceEurTrend: priceEur !== null ? new Prisma.Decimal(priceEur.toFixed(2)) : null,
    priceUpdatedAt: priceEur !== null ? now : null,
    syncedAt: now,
  };
}

export async function syncCatalog(opts: SyncOptions): Promise<SyncStats & { runId?: string }> {
  const { prisma, client, mode } = opts;
  const log = opts.log ?? (() => {});
  const now = opts.now ?? (() => new Date());
  if (mode === "prices") return syncPrices(opts);

  // Une seule synchro à la fois : un run non terminé et actif récemment bloque le suivant.
  const running = await prisma.syncRun.findFirst({
    where: { kind: { in: ["full", "new-sets"] }, finishedAt: null },
    orderBy: { startedAt: "desc" },
  });
  // Un run interrompu proprement (Ctrl+C, erreur) porte `error` et peut être repris tout de suite.
  if (running && !running.error && now().getTime() - running.updatedAt.getTime() < STALE_RUN_MS && !opts.restart) {
    throw new Error(`Une synchronisation est déjà en cours (run ${running.id}).`);
  }

  // Reprise : on repart du dernier run « full » interrompu.
  let run = mode === "full" && running?.kind === "full" && !opts.restart ? running : null;
  const doneSets = new Set<string>(
    run ? (((run.cursor as { doneSets?: string[] } | null)?.doneSets ?? []) as string[]) : [],
  );
  if (run) {
    log(`↻ Reprise du run ${run.id} : ${doneSets.size} sets déjà importés.`);
    await prisma.syncRun.update({ where: { id: run.id }, data: { error: null } });
  }
  run ??= await prisma.syncRun.create({ data: { kind: mode, cursor: { doneSets: [] } } });

  const stats: SyncStats = { sets: 0, cards: 0, cardsEnOnly: 0, failed: [], skippedSets: 0 };

  try {
    log("• Lecture des listes de séries, sets et cartes (FR et EN)…");
    const [seriesFr, seriesEn, setsFr, setsEn, cardsEn] = await Promise.all([
      client.series("fr"),
      client.series("en"),
      client.sets("fr"),
      client.sets("en"),
      client.cards("en"),
    ]);
    const serieNames = new Map<string, { name: string; logo: string | null; lang: "fr" | "en" }>(
      seriesEn.map((s) => [s.id, { name: s.name, logo: s.logo ?? null, lang: "en" }]),
    );
    for (const s of seriesFr) serieNames.set(s.id, { name: s.name, logo: s.logo ?? null, lang: "fr" as const });
    const setNameEn = new Map(setsEn.map((s) => [s.id, s.name]));
    const enCards = new Map(cardsEn.map((c) => [c.id, c]));

    const frIds = new Set(setsFr.map((s) => s.id));
    let setIds = [...setsFr.map((s) => s.id), ...setsEn.map((s) => s.id).filter((id) => !frIds.has(id))];
    if (opts.onlySets?.length) setIds = setIds.filter((id) => opts.onlySets!.includes(id));

    const existing = new Map<string, { cards: number; withImage: number }>();
    if (mode === "new-sets") {
      const counts = await prisma.card.groupBy({ by: ["setId"], _count: { _all: true, image: true } });
      for (const c of counts) existing.set(c.setId, { cards: c._count._all, withImage: c._count.image });
    }

    let index = 0;
    for (const setId of setIds) {
      index++;
      if (doneSets.has(setId)) {
        stats.skippedSets++;
        continue;
      }
      const started = Date.now();
      const [detailFr, detailEn] = await Promise.all([
        frIds.has(setId) ? client.set("fr", setId) : Promise.resolve(null),
        client.set("en", setId),
      ]);
      const detail: SetDetail | null = detailFr ?? detailEn;
      if (!detail) {
        log(`  ! ${setId} introuvable, ignoré`);
        continue;
      }
      if (isExcludedSerie(detail.serie.id)) {
        stats.skippedSets++;
        continue;
      }

      // Union des cartes FR et EN du set : une carte absente en FR est importée en anglais.
      const frCards = new Map((detailFr?.cards ?? []).map((c) => [c.id, c]));
      const allCards: { summary: CardSummary; lang: TcgdexLang }[] = [
        ...(detailFr?.cards ?? []).map((c) => ({ summary: c, lang: "fr" as const })),
        ...(detailEn?.cards ?? []).filter((c) => !frCards.has(c.id)).map((c) => ({ summary: c, lang: "en" as const })),
      ];

      if (mode === "new-sets" && !needsResync(existing.get(setId), allCards.map((c) => c.summary), enCards)) {
        stats.skippedSets++;
        continue;
      }

      const serie = serieNames.get(detail.serie.id) ?? { name: detail.serie.name, logo: null, lang: "en" as const };
      await prisma.serie.upsert({
        where: { id: detail.serie.id },
        create: { id: detail.serie.id, name: serie.name, logo: serie.logo, lang: serie.lang, syncedAt: now() },
        update: { name: serie.name, logo: serie.logo, lang: serie.lang, syncedAt: now() },
      });
      const setRecord = toSetRecord(detail, detailFr ? "fr" : "en", setNameEn.get(setId) ?? null);
      // Beaucoup de vieux sets n'ont pas de logo FR : on reprend le logo anglais.
      setRecord.logo ??= detailEn?.logo ?? null;
      setRecord.symbol ??= detailEn?.symbol ?? null;
      await prisma.set.upsert({
        where: { id: setId },
        create: { ...setRecord, syncedAt: now() },
        update: { ...setRecord, syncedAt: now() },
      });

      const results = await Promise.all(
        allCards.map(async ({ summary, lang }) => {
          try {
            const other: TcgdexLang = lang === "fr" ? "en" : "fr";
            let cardLang: TcgdexLang = lang;
            let card = await client.card(lang, summary.id);
            if (!card) {
              card = await client.card(other, summary.id);
              cardLang = other;
            }
            if (!card) throw new Error("introuvable en FR et en EN");
            const en = enCards.get(summary.id);
            const rec = toCardRecord({
              detail: { ...card, set: { ...card.set, id: setId } },
              lang: cardLang,
              nameFr: cardLang === "fr" ? card.name : null,
              nameEn: en?.name ?? (cardLang === "en" ? card.name : null),
              fallbackImage: en?.image ?? null,
            });
            const data = cardData(rec, now());
            await prisma.card.upsert({ where: { id: rec.id }, create: data, update: data });
            return cardLang;
          } catch (err) {
            stats.failed.push(`${summary.id}: ${err instanceof Error ? err.message : String(err)}`);
            return null;
          }
        }),
      );
      const ok = results.filter(Boolean).length;
      stats.cards += ok;
      stats.cardsEnOnly += results.filter((l) => l === "en").length;
      stats.sets++;
      doneSets.add(setId);
      await prisma.syncRun.update({
        where: { id: run.id },
        data: { cursor: { doneSets: [...doneSets] }, stats: { ...stats, failed: stats.failed.length } },
      });
      const secs = ((Date.now() - started) / 1000).toFixed(1);
      log(
        `  [${index}/${setIds.length}] ${setId.padEnd(10)} ${detail.name} : ${ok}/${allCards.length} cartes${detailFr ? "" : " (EN)"} en ${secs}s`,
      );
    }

    // Date de la première sortie de chaque série, pour les ordonner chronologiquement.
    await prisma.$executeRaw`
      UPDATE "Serie" s SET "firstReleaseDate" = sub.d
      FROM (SELECT "serieId", min("releaseDate") AS d FROM "Set" GROUP BY "serieId") sub
      WHERE sub."serieId" = s.id`;

    await prisma.syncRun.update({
      where: { id: run.id },
      data: { finishedAt: now(), stats: { ...stats, failed: stats.failed.slice(0, 200) } },
    });
    return stats;
  } catch (err) {
    await prisma.syncRun.update({
      where: { id: run.id },
      data: { error: err instanceof Error ? err.message : String(err), stats: { ...stats, failed: stats.failed.length } },
    });
    throw err;
  }
}

/** Index du jour dans la rotation des prix (0 … n-1). */
export function rotationBucket(date: Date, buckets: number): number {
  return Math.floor(date.getTime() / 86_400_000) % buckets;
}

/** Hache un id de carte dans [0, buckets) de façon stable. */
export function bucketOf(id: string, buckets: number): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % buckets;
}

async function syncPrices(opts: SyncOptions): Promise<SyncStats> {
  const { prisma, client } = opts;
  const log = opts.log ?? (() => {});
  const now = opts.now ?? (() => new Date());
  const buckets = Math.max(1, Math.round(1 / gameConfig.catalog.sync.dailyPriceRefreshFraction));
  const today = rotationBucket(now(), buckets);
  const run = await prisma.syncRun.create({ data: { kind: "prices" } });
  const stats: SyncStats = { sets: 0, cards: 0, cardsEnOnly: 0, failed: [], skippedSets: 0 };

  const all = await prisma.card.findMany({
    select: { id: true, lang: true, rarityRaw: true },
    where: opts.onlySets?.length ? { setId: { in: opts.onlySets } } : undefined,
  });
  const todays = all.filter((c) => bucketOf(c.id, buckets) === today);
  log(`• Rotation des prix : ${todays.length} cartes (tranche ${today + 1}/${buckets}).`);

  await Promise.all(
    todays.map(async (c) => {
      try {
        const card = await client.card(c.lang, c.id);
        if (!card) return;
        const price = card.pricing?.cardmarket?.trend ?? card.pricing?.cardmarket?.avg ?? null;
        const { tier, reason } = computeTier(
          { rarityRaw: c.rarityRaw, priceEur: price },
          RARITY_TIERS,
          gameConfig.rarity.priceBumpEur,
        );
        await prisma.card.update({
          where: { id: c.id },
          data: {
            tier,
            tierReason: reason,
            priceEurTrend: price !== null && price > 0 ? new Prisma.Decimal(price.toFixed(2)) : null,
            priceUpdatedAt: now(),
          },
        });
        stats.cards++;
      } catch (err) {
        stats.failed.push(`${c.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }),
  );
  await prisma.syncRun.update({
    where: { id: run.id },
    data: { finishedAt: now(), stats: { ...stats, failed: stats.failed.slice(0, 200) } },
  });
  return stats;
}

/** Recalcule le tier de toutes les cartes (après une modification de `config/rarities.ts`). */
export async function retierCatalog(prisma: PrismaClient): Promise<number> {
  const cards = await prisma.card.findMany({ select: { id: true, rarityRaw: true, priceEurTrend: true, tier: true } });
  let changed = 0;
  for (const c of cards) {
    const { tier, reason } = computeTier(
      { rarityRaw: c.rarityRaw, priceEur: c.priceEurTrend ? Number(c.priceEurTrend) : null },
      RARITY_TIERS,
      gameConfig.rarity.priceBumpEur,
    );
    if (tier !== c.tier) {
      await prisma.card.update({ where: { id: c.id }, data: { tier, tierReason: reason } });
      changed++;
    }
  }
  return changed;
}

/** Rapport Markdown des raretés rencontrées, pour valider `config/rarities.ts`. */
export async function rarityReport(prisma: PrismaClient): Promise<string> {
  const rows = await prisma.$queryRaw<
    { rarityRaw: string | null; lang: string; cards: bigint; bumped: bigint; fallback: bigint; sample: string; tier: string }[]
  >`
    SELECT "rarityRaw", lang::text, count(*) AS cards,
           count(*) FILTER (WHERE "tierReason" = 'price_bump') AS bumped,
           count(*) FILTER (WHERE "tierReason" = 'fallback') AS fallback,
           min(id) AS sample,
           mode() WITHIN GROUP (ORDER BY tier) ::text AS tier
    FROM "Card" GROUP BY "rarityRaw", lang ORDER BY count(*) DESC`;
  const tiers = await prisma.$queryRaw<{ tier: string; cards: bigint; droppable: bigint }[]>`
    SELECT tier::text, count(*) AS cards, count(*) FILTER (WHERE droppable) AS droppable
    FROM "Card" GROUP BY tier ORDER BY min(array_position(ARRAY['common','uncommon','rare','epic','legendary','mythic'], tier::text))`;
  const lines = [
    "# Raretés du catalogue",
    "",
    `Généré le ${new Date().toISOString().slice(0, 10)} par \`npm run sync:catalog\`. La correspondance vit dans \`config/rarities.ts\`.`,
    "",
    "## Répartition par tier",
    "",
    "| Tier | Cartes | Tirables |",
    "|---|---:|---:|",
    ...tiers.map((t) => `| ${t.tier} | ${t.cards} | ${t.droppable} |`),
    "",
    "## Raretés TCGdex",
    "",
    "Une ligne « non classée » tombe sur le tier par défaut : à ajouter dans `config/rarities.ts`.",
    "",
    "| Rareté TCGdex | Langue | Cartes | Tier | Montées par le prix | Exemple |",
    "|---|---|---:|---|---:|---|",
    ...rows.map((r) => {
      const label = r.rarityRaw ?? "(aucune)";
      const mapped = r.rarityRaw !== null && RARITY_TIERS[r.rarityRaw] !== undefined;
      return `| ${label}${mapped ? "" : " **(non classée)**"} | ${r.lang} | ${r.cards} | ${mapped ? RARITY_TIERS[r.rarityRaw!] : r.tier} | ${r.bumped} | ${r.sample} |`;
    }),
    "",
  ];
  return lines.join("\n");
}
