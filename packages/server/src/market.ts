/**
 * Marché entre joueurs : prix fixe et enchères avec réservation des Jetons.
 * Chaque action est une transaction qui verrouille les joueurs concernés (dans un ordre fixe)
 * puis l'annonce : deux achats simultanés donnent une seule vente.
 */
import { gameConfig, type Finish, type Tier } from "@pokeflex/config";
import { type ListingStatus, type ListingType, type Prisma, prisma } from "@pokeflex/db";
import { assertValidPrice, extendForSniping, InsufficientFundsError, listingFee, MarketRuleError, minNextBid } from "@pokeflex/game";
import { checkSetCompletions, type CompletedSet } from "./completion";
import { applyLedger, lockUser, lockUsers, type Tx, withTxRetry } from "./ledger";

const rules = gameConfig.market;

export class MarketError extends Error {
  constructor(
    readonly code:
      | "not_found"
      | "not_available"
      | "own_listing"
      | "too_many"
      | "insufficient_funds"
      | "bid_too_low"
      | "ended"
      | "has_bids"
      | "invalid",
    message: string,
  ) {
    super(message);
    this.name = "MarketError";
  }
}

function money<T>(p: Promise<T>, what: string): Promise<T> {
  return p.catch((err) => {
    if (err instanceof InsufficientFundsError) {
      throw new MarketError("insufficient_funds", `Solde insuffisant pour ${what} : il te manque ${err.needed - err.balance} Jetons.`);
    }
    throw err;
  });
}

interface ListingRow {
  id: string;
  sellerId: string;
  copyId: string | null;
  cardId: string;
  finish: Finish;
  type: ListingType;
  price: number;
  currentBid: number | null;
  currentBidderId: string | null;
  bidCount: number;
  endsAt: Date | null;
  status: ListingStatus;
}

async function lockListing(tx: Tx, id: string): Promise<(ListingRow & { copyId: string }) | null> {
  const [row] = await tx.$queryRaw<ListingRow[]>`
    SELECT id, "sellerId", "copyId", "cardId", finish, type, price, "currentBid", "currentBidderId", "bidCount", "endsAt", status
    FROM "Listing" WHERE id = ${id} FOR UPDATE`;
  if (!row) return null;
  // Un exemplaire en vente ne peut pas être recyclé : une annonce active a toujours son exemplaire.
  if (row.status === "active" && !row.copyId) throw new Error(`Annonce ${id} active sans exemplaire`);
  return row as ListingRow & { copyId: string };
}

// ───────── Mise en vente ─────────

export interface CreateListingInput {
  copyId: string;
  type: ListingType;
  price: number;
  /** Durée d'une enchère, parmi `config.market.auctionDurationsMs`. */
  durationMs?: number;
}

export async function createListing(userId: string, input: CreateListingInput, now = new Date()) {
  try {
    assertValidPrice(input.price, rules);
  } catch (e) {
    if (e instanceof MarketRuleError) throw new MarketError("invalid", e.message);
    throw e;
  }
  if (input.type !== "fixed" && input.type !== "auction") throw new MarketError("invalid", "Type d'annonce inconnu.");
  const durations: readonly number[] = rules.auctionDurationsMs;
  if (input.type === "auction" && !durations.includes(input.durationMs ?? -1)) {
    throw new MarketError("invalid", "Durée d'enchère invalide.");
  }
  const fee = listingFee(input.price, rules);

  return prisma.$transaction(async (tx) => {
    await lockUser(tx, userId);
    const active = await tx.listing.count({ where: { sellerId: userId, status: "active" } });
    if (active >= rules.maxActiveListingsPerUser) {
      throw new MarketError("too_many", `Tu as déjà ${rules.maxActiveListingsPerUser} annonces actives.`);
    }
    const copy = await tx.cardCopy.findFirst({ where: { id: input.copyId, ownerId: userId, status: "owned" }, select: { id: true, cardId: true, finish: true } });
    if (!copy) throw new MarketError("not_available", "Cet exemplaire n'est plus disponible.");
    await tx.cardCopy.update({ where: { id: copy.id }, data: { status: "listed" } });
    const listing = await tx.listing.create({
      data: {
        sellerId: userId,
        copyId: copy.id,
        cardId: copy.cardId,
        finish: copy.finish,
        type: input.type,
        price: input.price,
        endsAt: input.type === "auction" ? new Date(now.getTime() + input.durationMs!) : null,
        fee,
      },
    });
    const balance = await money(
      applyLedger(tx, { userId, delta: -fee, reason: "market_fee", refType: "listing", refId: listing.id }),
      "les frais de mise en vente",
    );
    return { listingId: listing.id, fee, balance };
  });
}

/** Retire une annonce. Une enchère qui a déjà reçu une offre ne peut plus être retirée. */
export async function cancelListing(userId: string, listingId: string) {
  return prisma.$transaction(async (tx) => {
    await lockUser(tx, userId);
    const l = await lockListing(tx, listingId);
    if (!l || l.sellerId !== userId) throw new MarketError("not_found", "Annonce introuvable.");
    if (l.status !== "active") throw new MarketError("not_available", "Cette annonce n'est plus active.");
    if (l.type === "auction" && l.bidCount > 0) throw new MarketError("has_bids", "Une enchère qui a reçu une offre ne peut plus être retirée.");
    await tx.listing.update({ where: { id: l.id }, data: { status: "cancelled", closedAt: new Date() } });
    await tx.cardCopy.update({ where: { id: l.copyId }, data: { status: "owned" } });
    return { ok: true as const };
  });
}

// ───────── Achat au prix fixe ─────────

async function transferCopy(tx: Tx, l: ListingRow & { copyId: string }, buyerId: string, price: number, now: Date): Promise<CompletedSet[]> {
  await tx.cardCopy.update({
    where: { id: l.copyId },
    data: { ownerId: buyerId, status: "owned", obtainedVia: "market", obtainedAt: now, openingId: null },
  });
  await tx.listing.update({ where: { id: l.id }, data: { status: "sold", closedAt: now } });
  await tx.sale.create({ data: { listingId: l.id, cardId: l.cardId, finish: l.finish, price, sellerId: l.sellerId, buyerId } });
  const card = await tx.card.findUniqueOrThrow({ where: { id: l.cardId }, select: { setId: true } });
  return checkSetCompletions(tx, buyerId, [card.setId]);
}

export async function buyListing(buyerId: string, listingId: string, now = new Date()) {
  const peek = await prisma.listing.findUnique({ where: { id: listingId }, select: { sellerId: true } });
  if (!peek) throw new MarketError("not_found", "Annonce introuvable.");
  return withTxRetry(() =>
    prisma.$transaction(async (tx) => {
      await lockUsers(tx, [buyerId, peek.sellerId]);
      const l = await lockListing(tx, listingId);
      if (!l || l.status !== "active" || l.type !== "fixed") throw new MarketError("not_available", "Trop tard : cette carte vient d'être vendue ou retirée.");
      if (l.sellerId === buyerId) throw new MarketError("own_listing", "C'est ta propre annonce.");
      const balance = await money(
        applyLedger(tx, { userId: buyerId, delta: -l.price, reason: "market_purchase", refType: "listing", refId: l.id }),
        "cet achat",
      );
      await applyLedger(tx, { userId: l.sellerId, delta: l.price, reason: "market_sale", refType: "listing", refId: l.id });
      const completedSets = await transferCopy(tx, l, buyerId, l.price, now);
      const bonus = completedSets.reduce((n, s) => n + s.bonus, 0);
      return { cardId: l.cardId, price: l.price, balance: balance + bonus, completedSets };
    }),
  );
}

// ───────── Enchères ─────────

/**
 * Place une enchère. Le montant est réservé sur le solde de l'enchérisseur (`bid_hold`)
 * et l'enchérisseur précédent récupère sa réservation (`bid_release`).
 */
export async function placeBid(bidderId: string, listingId: string, amount: number, now = new Date()) {
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > rules.maxPrice) throw new MarketError("invalid", "Montant invalide.");
  return withTxRetry(() =>
    prisma.$transaction(async (tx) => {
      const peek = await tx.listing.findUnique({ where: { id: listingId }, select: { currentBidderId: true } });
      if (!peek) throw new MarketError("not_found", "Annonce introuvable.");
      await lockUsers(tx, [bidderId, ...(peek.currentBidderId ? [peek.currentBidderId] : [])]);
      const l = await lockListing(tx, listingId);
      if (!l || l.status !== "active" || l.type !== "auction") throw new MarketError("not_available", "Cette enchère n'est plus active.");
      if (l.endsAt && l.endsAt.getTime() <= now.getTime()) throw new MarketError("ended", "Cette enchère est terminée.");
      if (l.sellerId === bidderId) throw new MarketError("own_listing", "Tu ne peux pas enchérir sur ta propre annonce.");
      // L'enchérisseur courant a pu changer entre la lecture et le verrou : on rejoue alors la transaction.
      if (l.currentBidderId !== peek.currentBidderId) throw new Error("could not serialize: enchérisseur modifié");
      const min = minNextBid(l.price, l.currentBid, rules);
      if (amount < min) throw new MarketError("bid_too_low", `L'enchère minimale est de ${min.toLocaleString("fr-FR")} Jetons.`);

      if (l.currentBidderId && l.currentBid) {
        await applyLedger(tx, { userId: l.currentBidderId, delta: l.currentBid, reason: "bid_release", refType: "listing", refId: l.id });
      }
      const balance = await money(applyLedger(tx, { userId: bidderId, delta: -amount, reason: "bid_hold", refType: "listing", refId: l.id }), "cette enchère");
      const endsAt = extendForSniping(l.endsAt!, now, rules.antiSnipingWindowMs);
      await tx.bid.create({ data: { listingId: l.id, bidderId, amount, createdAt: now } });
      await tx.listing.update({
        where: { id: l.id },
        data: { currentBid: amount, currentBidderId: bidderId, bidCount: { increment: 1 }, endsAt },
      });
      return { amount, balance, endsAt: endsAt.toISOString(), extended: endsAt.getTime() !== l.endsAt!.getTime(), outbid: l.currentBidderId };
    }),
  );
}

/** Clôture une enchère échue : l'exemplaire va au meilleur enchérisseur (déjà débité), le vendeur est payé. */
export async function closeAuction(listingId: string, now = new Date()) {
  const peek = await prisma.listing.findUnique({ where: { id: listingId }, select: { sellerId: true, currentBidderId: true } });
  if (!peek) return null;
  return withTxRetry(() =>
    prisma.$transaction(async (tx) => {
      await lockUsers(tx, [peek.sellerId, ...(peek.currentBidderId ? [peek.currentBidderId] : [])]);
      const l = await lockListing(tx, listingId);
      if (!l || l.status !== "active" || l.type !== "auction" || !l.endsAt || l.endsAt.getTime() > now.getTime()) return null;
      if (l.currentBidderId !== peek.currentBidderId) throw new Error("could not serialize: enchérisseur modifié");
      if (!l.currentBidderId || !l.currentBid) {
        await tx.listing.update({ where: { id: l.id }, data: { status: "expired", closedAt: now } });
        await tx.cardCopy.update({ where: { id: l.copyId }, data: { status: "owned" } });
        return { status: "expired" as const };
      }
      await applyLedger(tx, { userId: l.sellerId, delta: l.currentBid, reason: "market_sale", refType: "listing", refId: l.id });
      await transferCopy(tx, l, l.currentBidderId, l.currentBid, now);
      return { status: "sold" as const, buyerId: l.currentBidderId, price: l.currentBid };
    }),
  );
}

/** Clôture toutes les enchères échues (job du serveur temps réel, et rattrapage à l'affichage du marché). */
export async function closeDueAuctions(now = new Date(), limit = 50) {
  const due = await prisma.listing.findMany({
    where: { status: "active", type: "auction", endsAt: { lte: now } },
    select: { id: true },
    orderBy: { endsAt: "asc" },
    take: limit,
  });
  let closed = 0;
  for (const d of due) {
    try {
      if (await closeAuction(d.id, now)) closed++;
    } catch (err) {
      console.error(`[marche] clôture de ${d.id} impossible`, err);
    }
  }
  return closed;
}

// ───────── Lecture ─────────

const listingCardSelect = {
  id: true,
  name: true,
  image: true,
  tier: true,
  lang: true,
  localId: true,
  set: { select: { id: true, name: true } },
} satisfies Prisma.CardSelect;

export interface ListingView {
  id: string;
  type: ListingType;
  status: ListingStatus;
  price: number;
  currentBid: number | null;
  bidCount: number;
  endsAt: string | null;
  createdAt: string;
  finish: Finish;
  seller: { id: string; name: string };
  currentBidderId: string | null;
  /** Acheteur, une fois la carte vendue. */
  buyerId: string | null;
  card: { id: string; name: string; image: string | null; tier: Tier; lang: "fr" | "en"; localId: string; setId: string; setName: string };
}

type ListingWithJoins = Prisma.ListingGetPayload<{
  include: {
    card: { select: typeof listingCardSelect };
    seller: { select: { id: true; name: true; handle: true } };
    sale: { select: { buyerId: true } };
  };
}>;

function toView(l: ListingWithJoins): ListingView {
  return {
    id: l.id,
    type: l.type,
    status: l.status,
    price: l.price,
    currentBid: l.currentBid,
    bidCount: l.bidCount,
    endsAt: l.endsAt?.toISOString() ?? null,
    createdAt: l.createdAt.toISOString(),
    finish: l.finish,
    seller: { id: l.seller.id, name: l.seller.name ?? l.seller.handle ?? "Dresseur" },
    currentBidderId: l.currentBidderId,
    buyerId: l.sale?.buyerId ?? null,
    card: {
      id: l.card.id,
      name: l.card.name,
      image: l.card.image,
      tier: l.card.tier,
      lang: l.card.lang,
      localId: l.card.localId,
      setId: l.card.set.id,
      setName: l.card.set.name,
    },
  };
}

const include = {
  card: { select: listingCardSelect },
  seller: { select: { id: true, name: true, handle: true } },
  sale: { select: { buyerId: true } },
} as const;

export type MarketSort = "recent" | "ending" | "price_asc" | "price_desc";

export interface MarketQuery {
  q?: string;
  tier?: Tier;
  type?: ListingType;
  sort?: MarketSort;
  page?: number;
  perPage?: number;
}

export async function getMarketListings(query: MarketQuery = {}) {
  const perPage = query.perPage ?? 36;
  const page = Math.max(1, query.page ?? 1);
  const q = query.q?.trim();
  let cardIds: string[] | undefined;
  if (q) {
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT DISTINCT c.id FROM "Card" c JOIN "Listing" l ON l."cardId" = c.id AND l.status = 'active'
      WHERE pf_unaccent(lower(coalesce(c."nameFr", '') || ' ' || coalesce(c."nameEn", ''))) LIKE '%' || pf_unaccent(lower(${q})) || '%'
      LIMIT 500`;
    cardIds = rows.map((r) => r.id);
  }
  const where: Prisma.ListingWhereInput = {
    status: "active",
    ...(query.type ? { type: query.type } : {}),
    ...(query.tier ? { card: { tier: query.tier } } : {}),
    ...(cardIds ? { cardId: { in: cardIds } } : {}),
  };
  // Prix « effectif » d'une enchère = offre courante ou prix de départ ; on trie sur le prix affiché côté SQL.
  const orderBy: Prisma.ListingOrderByWithRelationInput[] =
    query.sort === "ending"
      ? [{ endsAt: { sort: "asc", nulls: "last" } }]
      : query.sort === "price_asc"
        ? [{ price: "asc" }]
        : query.sort === "price_desc"
          ? [{ price: "desc" }]
          : [{ createdAt: "desc" }];
  const [rows, total] = await Promise.all([
    prisma.listing.findMany({ where, orderBy, include, skip: (page - 1) * perPage, take: perPage }),
    prisma.listing.count({ where }),
  ]);
  return { listings: rows.map(toView), total, page, pages: Math.max(1, Math.ceil(total / perPage)) };
}

export async function getListing(id: string) {
  const l = await prisma.listing.findUnique({ where: { id }, include });
  if (!l) return null;
  const bids = await prisma.bid.findMany({
    where: { listingId: id },
    orderBy: { amount: "desc" },
    take: 15,
    include: { bidder: { select: { id: true, name: true, handle: true } } },
  });
  return {
    listing: toView(l),
    bids: bids.map((b) => ({ id: b.id, amount: b.amount, at: b.createdAt.toISOString(), bidder: { id: b.bidder.id, name: b.bidder.name ?? b.bidder.handle ?? "Dresseur" } })),
  };
}

/** Annonces actives et ventes récentes d'une carte, avec le prix moyen sur 30 jours. */
export async function getCardMarket(cardId: string, now = new Date()) {
  const since = new Date(now.getTime() - rules.averagePriceWindowMs);
  const [active, sales, agg] = await Promise.all([
    prisma.listing.findMany({ where: { cardId, status: "active" }, include, orderBy: [{ price: "asc" }], take: 6 }),
    prisma.sale.findMany({ where: { cardId }, orderBy: { createdAt: "desc" }, take: 8, select: { id: true, price: true, finish: true, createdAt: true } }),
    prisma.sale.aggregate({ where: { cardId, createdAt: { gte: since } }, _avg: { price: true }, _count: true, _min: { price: true }, _max: { price: true } }),
  ]);
  return {
    active: active.map(toView),
    sales: sales.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() })),
    stats: {
      count: agg._count,
      average: agg._avg.price === null ? null : Math.round(agg._avg.price),
      min: agg._min.price,
      max: agg._max.price,
    },
  };
}

/** Annonces du joueur (actives d'abord) et ses dernières ventes. */
export async function getMyListings(userId: string) {
  const rows = await prisma.listing.findMany({
    where: { sellerId: userId },
    include: { ...include, sale: { select: { buyerId: true, price: true, buyer: { select: { name: true, handle: true } } } } },
    orderBy: [{ createdAt: "desc" }],
    take: 80,
  });
  return rows
    .map((r) => ({ ...toView(r), soldTo: r.sale ? (r.sale.buyer.name ?? r.sale.buyer.handle ?? "Dresseur") : null, soldPrice: r.sale?.price ?? null }))
    .sort((a, b) => Number(b.status === "active") - Number(a.status === "active"));
}

/** Enchères auxquelles le joueur a participé (en cours d'abord). */
export async function getMyBids(userId: string) {
  const ids = await prisma.bid.findMany({ where: { bidderId: userId }, select: { listingId: true }, distinct: ["listingId"], orderBy: { createdAt: "desc" }, take: 60 });
  const rows = await prisma.listing.findMany({ where: { id: { in: ids.map((i) => i.listingId) } }, include });
  return rows
    .map(toView)
    .sort((a, b) => Number(b.status === "active") - Number(a.status === "active") || (a.endsAt ?? "").localeCompare(b.endsAt ?? ""));
}

/** Jetons réservés par les enchères en cours où le joueur est le meilleur enchérisseur. */
export async function getHeldBids(userId: string) {
  const agg = await prisma.listing.aggregate({ where: { status: "active", currentBidderId: userId }, _sum: { currentBid: true }, _count: true });
  return { amount: agg._sum.currentBid ?? 0, count: agg._count };
}
