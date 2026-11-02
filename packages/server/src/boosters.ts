/**
 * Ouverture des boosters, entièrement côté serveur.
 * Le tirage est fait et enregistré ici avant toute animation : le client ne fait que révéler.
 */
import { boosterLayoutFor, gameConfig, isRealBoosterSet, TIERS, type Finish, type Tier } from "@pokeflex/config";
import { prisma } from "@pokeflex/db";
import { boosterStatus, consumeBooster, cryptoRng, drawBoosterSlots, drawFinish, nextWeekReset, pickWeeklySet, rollGodPack, weekKey, weeklyBoosterPrice, drawIndex, InsufficientFundsError, type Rng } from "@pokeflex/game";
import { checkSetCompletions, type CompletedSet } from "./completion";
import { applyLedger, lockUser } from "./ledger";
import { removeObtainedFromWishlist } from "./lists";
import { bumpQuest, type QuestProgressed } from "./quests";

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

const setPoolCache = new Map<string, { at: number; pools: Record<Tier, string[]> }>();

/** Pool d'un set précis (boosters de set). */
export async function getSetDropPools(setId: string): Promise<Record<Tier, string[]>> {
  const hit = setPoolCache.get(setId);
  if (hit && Date.now() - hit.at < POOL_TTL_MS) return hit.pools;
  const rows = await prisma.card.findMany({ where: { setId, droppable: true }, select: { id: true, tier: true }, orderBy: { id: "asc" } });
  const pools = Object.fromEntries(TIERS.map((t) => [t, [] as string[]])) as Record<Tier, string[]>;
  for (const r of rows) pools[r.tier].push(r.id);
  // Seuls les sets qui ont des cartes tirables sont mis en cache : un id inventé ne fait pas grossir la mémoire.
  if (rows.length > 0) setPoolCache.set(setId, { at: Date.now(), pools });
  return pools;
}

const serieCache = new Map<string, string | null>();

/** Série d'un set (fixe : mise en cache sans expiration). */
async function setSerie(setId: string): Promise<string | null> {
  if (serieCache.has(setId)) return serieCache.get(setId)!;
  const set = await prisma.set.findUnique({ where: { id: setId }, select: { serieId: true } });
  if (set) serieCache.set(setId, set.serieId);
  return set?.serieId ?? null;
}

let boosterSetsCache: { at: number; ids: Set<string> } | null = null;

/**
 * Sets qui ont un booster : sets qui ont existé en booster, avec assez de cartes tirables dont
 * assez de Pokémon (mis en cache 10 min).
 */
export async function boosterSetIds(): Promise<Set<string>> {
  if (boosterSetsCache && Date.now() - boosterSetsCache.at < POOL_TTL_MS) return boosterSetsCache.ids;
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT "setId" AS id FROM "Card" WHERE droppable GROUP BY "setId"
    HAVING count(*) >= ${gameConfig.setBoosters.minDroppableCards}
       AND count(*) FILTER (WHERE category = 'pokemon') >= ${gameConfig.setBoosters.minPokemonCards}`;
  const ids = new Set(rows.map((r) => r.id).filter(isRealBoosterSet));
  boosterSetsCache = { at: Date.now(), ids };
  return ids;
}

/** Le set a-t-il un booster en vente ? */
export async function hasSetBooster(setId: string): Promise<boolean> {
  return (await boosterSetIds()).has(String(setId));
}

/** Nombre de sets en cache (tests). */
export function cachedSetPoolCount() {
  return setPoolCache.size;
}

export function invalidateDropPools() {
  poolCache = null;
  boosterSetsCache = null;
  setPoolCache.clear();
}

export interface PulledCard {
  copyId: string;
  id: string;
  name: string;
  image: string | null;
  tier: Tier;
  /** Rareté officielle brute (TCGdex), affichée via `rarityLabel`. */
  rarityRaw: string | null;
  finish: Finish;
  lang: "fr" | "en";
  localId: string;
  setName: string;
  isNew: boolean;
  /** Carte déjà dans les favoris du joueur (un doublon d'une favorite) : l'étoile s'affiche cochée à la révélation. */
  favorite: boolean;
}

export interface BoosterResult {
  openingId: string;
  /** God pack : que des grosses raretés. */
  godPack: boolean;
  cards: PulledCard[];
  boosters: { available: number; nextAt: string | null };
  balance: number;
  completedSets: CompletedSet[];
  questsDone: QuestProgressed[];
}

export type BoosterKind = { kind: "free" } | { kind: "set"; setId: string };

export class BoosterError extends Error {
  constructor(
    readonly code: "no_booster" | "empty_catalog" | "insufficient_funds" | "unknown_set",
    message: string,
  ) {
    super(message);
    this.name = "BoosterError";
  }
}

/**
 * Ouvre un booster pour `userId` : gratuit (« Toutes époques », consomme le stock) ou de set (payé en Jetons).
 * Verrouille la ligne du joueur : deux clics simultanés ne consomment pas deux fois le même booster
 * et ne débitent pas deux fois les Jetons.
 */
export async function openBooster(userId: string, what: BoosterKind, rng: Rng = cryptoRng, now = new Date()): Promise<BoosterResult> {
  const pools = what.kind === "free" ? await getDropPools() : await getSetDropPools(what.setId);
  const sizes = Object.fromEntries(TIERS.map((t) => [t, pools[t].length])) as Record<Tier, number>;
  const droppable = TIERS.reduce((n, t) => n + sizes[t], 0);
  if (what.kind === "free" && droppable === 0) {
    throw new BoosterError("empty_catalog", "Le catalogue est vide : lance npm run sync:catalog.");
  }
  if (what.kind === "set" && !(await hasSetBooster(what.setId))) {
    throw new BoosterError("unknown_set", "Ce set n'a pas de booster disponible.");
  }
  const price = what.kind === "set" ? await setBoosterPrice(what.setId, now) : 0;
  const layout = what.kind === "set" ? boosterLayoutFor(await setSerie(what.setId)) : "modern";

  return prisma.$transaction(async (tx) => {
    const user = await lockUser(tx, userId);
    if (!user) throw new BoosterError("no_booster", "Joueur introuvable.");

    let stock = { stock: user.boosterStock, anchorAt: user.boosterAnchorAt };
    let balance = user.balance;
    if (what.kind === "free") {
      try {
        stock = consumeBooster(stock, now, gameConfig.boosters);
      } catch {
        throw new BoosterError("no_booster", "Aucun booster disponible pour l'instant.");
      }
      await tx.user.update({ where: { id: userId }, data: { boosterStock: stock.stock, boosterAnchorAt: stock.anchorAt } });
    }

    const god = rollGodPack(gameConfig.boosters.layouts[layout], gameConfig.boosters.godPack, sizes, rng);
    const slots = drawBoosterSlots(god ?? gameConfig.boosters.layouts[layout], sizes, gameConfig.boosters.tierWeights, rng);
    const tiers = slots.map((s) => s.tier);
    const ids = tiers.map((t) => pools[t][drawIndex(pools[t].length, rng)]!);
    const cards = await tx.card.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, image: true, tier: true, rarityRaw: true, lang: true, localId: true, variants: true, setId: true, set: { select: { name: true } } },
    });
    const byId = new Map(cards.map((c) => [c.id, c]));
    const owned = new Set(
      (
        await tx.cardCopy.findMany({ where: { ownerId: userId, cardId: { in: ids } }, select: { cardId: true }, distinct: ["cardId"] })
      ).map((c) => c.cardId),
    );
    const favorites = new Set(
      (await tx.favoriteCard.findMany({ where: { userId, cardId: { in: ids } }, select: { cardId: true } })).map((f) => f.cardId),
    );
    const finishes = ids.map((id, i) =>
      drawFinish(byId.get(id)?.variants as Partial<Record<Finish, boolean>> | null, slots[i]!.finishWeights ?? gameConfig.finishes.weights, rng),
    );

    const opening = await tx.boosterOpening.create({
      data: {
        userId,
        kind: what.kind === "free" ? "all_eras" : "set",
        setId: what.kind === "set" ? what.setId : null,
        cardIds: ids,
        tiers,
        finishes,
        cost: price,
        godPack: god !== null,
      },
    });
    if (price > 0) {
      try {
        balance = await applyLedger(tx, { userId, delta: -price, reason: "set_booster", refType: "opening", refId: opening.id, meta: { setId: (what as { setId: string }).setId } });
      } catch (err) {
        if (err instanceof InsufficientFundsError) {
          throw new BoosterError("insufficient_funds", `Il te manque ${price - err.balance} Jetons pour ce booster.`);
        }
        throw err;
      }
    }
    const copies = await tx.cardCopy.createManyAndReturn({
      data: ids.map((cardId, i) => ({
        ownerId: userId,
        cardId,
        finish: finishes[i],
        obtainedVia: what.kind === "free" ? "booster" : "set_booster",
        openingId: opening.id,
      })),
      select: { id: true },
    });
    await removeObtainedFromWishlist(tx, userId, ids);

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
        rarityRaw: c.rarityRaw,
        finish: finishes[i]!,
        lang: c.lang,
        localId: c.localId,
        setName: c.set.name,
        isNew,
        favorite: favorites.has(id),
      };
    });

    const completedSets = await checkSetCompletions(tx, userId, cards.map((c) => c.setId));
    if (completedSets.length > 0) {
      balance = completedSets.reduce((b, s) => b + s.bonus, balance);
    }
    const questsDone: QuestProgressed[] = [];
    for (const q of [
      await bumpQuest(tx, userId, "open_boosters", 1, now),
      await bumpQuest(tx, userId, "new_cards", pulled.filter((p) => p.isNew).length, now),
    ]) {
      if (q) questsDone.push(q);
    }

    let boosters: BoosterResult["boosters"];
    if (what.kind === "free") {
      const nextAt =
        stock.stock >= gameConfig.boosters.maxStock
          ? null
          : new Date(stock.anchorAt.getTime() + gameConfig.boosters.refillIntervalMs).toISOString();
      boosters = { available: stock.stock, nextAt };
    } else {
      const status = boosterStatus(stock, now, gameConfig.boosters);
      boosters = { available: status.available, nextAt: status.nextAt?.toISOString() ?? null };
    }
    return { openingId: opening.id, godPack: opening.godPack, cards: pulled, boosters, balance, completedSets, questsDone };
  });
}

/** Raccourci historique : booster gratuit. */
export function openFreeBooster(userId: string, rng: Rng = cryptoRng, now = new Date()) {
  return openBooster(userId, { kind: "free" }, rng, now);
}

export interface BoosterSet {
  id: string;
  name: string;
  logo: string | null;
  serieId: string;
  serieName: string;
  releaseDate: Date | null;
  droppable: number;
  owned: number;
  completed: boolean;
  /** Image (URL de base) de la carte vedette illustrée sur la pochette, comme le Pokémon d'un vrai booster. */
  cover: string | null;
}

/** Sets proposés en booster payant (assez de cartes tirables), avec l'avancement du joueur. */
export async function getBoosterSets(userId: string): Promise<BoosterSet[]> {
  const rows = await prisma.$queryRaw<(Omit<BoosterSet, "droppable" | "owned"> & { droppable: bigint; owned: bigint })[]>`
    SELECT s.id, s.name, s.logo, s."serieId", se.name AS "serieName", s."releaseDate",
           count(c.id) AS droppable,
           count(o."cardId") AS owned,
           EXISTS (SELECT 1 FROM "SetCompletion" sc WHERE sc."userId" = ${userId} AND sc."setId" = s.id) AS completed,
           (SELECT v.image FROM "Card" v
             WHERE v."setId" = s.id AND v.droppable AND v.category = 'pokemon' AND v.image IS NOT NULL
             ORDER BY v.tier DESC, v."sortKey" LIMIT 1) AS cover
    FROM "Set" s
    JOIN "Serie" se ON se.id = s."serieId"
    JOIN "Card" c ON c."setId" = s.id AND c.droppable
    LEFT JOIN (SELECT DISTINCT "cardId" FROM "CardCopy" WHERE "ownerId" = ${userId}) o ON o."cardId" = c.id
    GROUP BY s.id, se.name, se."firstReleaseDate"
    HAVING count(c.id) >= ${gameConfig.setBoosters.minDroppableCards}
       AND count(c.id) FILTER (WHERE c.category = 'pokemon') >= ${gameConfig.setBoosters.minPokemonCards}
    ORDER BY se."firstReleaseDate" DESC NULLS LAST, s."releaseDate" DESC NULLS LAST`;
  return rows.filter((r) => isRealBoosterSet(r.id)).map((r) => ({ ...r, droppable: Number(r.droppable), owned: Number(r.owned) }));
}

/** Pokémon vedette de la pochette « Toutes époques » (n° du Pokédex national) : Pikachu, la mascotte. */
const FREE_PACK_DEX_ID = 25;
const coverCache = new Map<string, { at: number; cover: string | null }>();

/**
 * Carte vedette d'une pochette : la carte Pokémon tirable la plus rare du set (la plus rare des Pikachu
 * pour le booster gratuit), comme le Pokémon mis en avant sur un vrai booster. Mise en cache 10 min.
 */
export async function getPackCover(setId?: string): Promise<string | null> {
  const key = setId ?? "";
  const hit = coverCache.get(key);
  if (hit && Date.now() - hit.at < POOL_TTL_MS) return hit.cover;
  const where = { droppable: true, category: "pokemon" as const, image: { not: null } };
  const orderBy = [{ tier: "desc" as const }, { sortKey: "asc" as const }];
  const card =
    (await prisma.card.findFirst({
      where: setId ? { ...where, setId } : { ...where, dexIds: { has: FREE_PACK_DEX_ID } },
      orderBy,
      select: { image: true },
    })) ?? (setId ? null : await prisma.card.findFirst({ where, orderBy, select: { image: true } }));
  const cover = card?.image ?? null;
  coverCache.set(key, { at: Date.now(), cover });
  return cover;
}

/**
 * Annonce d'un god pack (serveur temps réel) : seulement pour une ouverture récente, du joueur
 * qui la signale, et réellement god pack.
 */
export async function godPackAnnouncement(userId: string, openingId: string, now = new Date()) {
  const o = await prisma.boosterOpening.findUnique({
    where: { id: String(openingId) },
    select: { userId: true, godPack: true, createdAt: true, user: { select: { name: true, handle: true } } },
  });
  if (!o || o.userId !== userId || !o.godPack || now.getTime() - o.createdAt.getTime() > 10 * 60_000) return null;
  return { openingId: String(openingId), name: o.user.name ?? o.user.handle ?? "Un dresseur", handle: o.user.handle };
}

// ───────── Set de la semaine ─────────

export interface WeeklySetInfo {
  week: string;
  setId: string;
  name: string;
  logo: string | null;
  serieId: string;
  price: number;
  /** Prix habituel, barré à l'affichage. */
  fullPrice: number;
  endsAt: string;
}

const weeklyCache = new Map<string, WeeklySetInfo | null>();

/**
 * Set de la semaine : fixé en base à la première demande de la semaine (tirage déterministe
 * parmi les sets qui ont un booster, sans répéter les dernières semaines). Null si aucun set.
 */
export async function getWeeklySet(now = new Date()): Promise<WeeklySetInfo | null> {
  const { timeZone } = gameConfig.quests;
  const week = weekKey(now, timeZone);
  if (weeklyCache.has(week)) return weeklyCache.get(week)!;
  let row = await prisma.weeklySet.findUnique({ where: { week }, select: { setId: true } });
  if (!row) {
    const eligible = [...(await boosterSetIds())];
    const recent = await prisma.weeklySet.findMany({
      orderBy: { week: "desc" },
      take: gameConfig.setBoosters.weekly.noRepeatWeeks,
      select: { setId: true },
    });
    const setId = pickWeeklySet(week, eligible, new Set(recent.map((r) => r.setId)));
    if (!setId) return null;
    // Deux premières visites simultanées : la première écriture gagne, l'autre relit.
    await prisma.weeklySet.createMany({ data: [{ week, setId }], skipDuplicates: true });
    row = await prisma.weeklySet.findUniqueOrThrow({ where: { week }, select: { setId: true } });
  }
  const set = await prisma.set.findUnique({ where: { id: row.setId }, select: { id: true, name: true, logo: true, serieId: true } });
  const full = gameConfig.boosters.setBoosterPrice;
  const info = set
    ? {
        week,
        setId: set.id,
        name: set.name,
        logo: set.logo,
        serieId: set.serieId,
        price: weeklyBoosterPrice(full, gameConfig.setBoosters.weekly.priceFactor),
        fullPrice: full,
        endsAt: nextWeekReset(now, timeZone).toISOString(),
      }
    : null;
  if (weeklyCache.size > 8) weeklyCache.clear();
  weeklyCache.set(week, info);
  return info;
}

/** Prix d'un booster de set : réduit pour le set de la semaine. */
export async function setBoosterPrice(setId: string, now = new Date()): Promise<number> {
  const weekly = await getWeeklySet(now);
  return weekly?.setId === setId ? weekly.price : gameConfig.boosters.setBoosterPrice;
}

/** Vide le cache du set de la semaine (tests). */
export function resetWeeklySetCache() {
  weeklyCache.clear();
}
