/**
 * Échanges entre joueurs, carte contre carte.
 * Une proposition ne réserve aucun exemplaire : à l'acceptation, une seule transaction verrouille
 * les deux joueurs (dans un ordre fixe) puis l'offre, revérifie chaque exemplaire et les transfère tous,
 * ou aucun. Les finitions suivent l'exemplaire ; une carte reçue quitte la wishlist de celui qui la reçoit.
 */
import { gameConfig, type Finish, type Tier } from "@pokeflex/config";
import { Prisma, prisma, type TradeStatus } from "@pokeflex/db";
import { cleanTradeMessage, tradeActionError, tradeOfferError } from "@pokeflex/game";
import { checkSetCompletions, type CompletedSet } from "./completion";
import { lockUsers, type Tx, withTxRetry } from "./ledger";
import { canSeeWishlist, removeObtainedFromWishlist } from "./lists";
import { isBlockedEitherWay, type PlayerRef } from "./social";

const rules = gameConfig.trades;

export class TradeError extends Error {
  constructor(
    readonly code: "not_found" | "self" | "invalid" | "blocked" | "friends_only" | "too_many" | "not_available" | "favorite" | "closed" | "unavailable",
    message: string,
  ) {
    super(message);
    this.name = "TradeError";
  }
}

const asPlayer = (u: { id: string; name: string | null; handle: string | null; image: string | null }): PlayerRef => ({
  id: u.id,
  name: u.name ?? u.handle ?? "Dresseur",
  handle: u.handle,
  image: u.image,
});
const playerSelect = { id: true, name: true, handle: true, image: true } as const;

/** Vérifie que les deux joueurs peuvent échanger : pas de blocage, et amis si `trades.audience` l'exige. */
async function assertCanTrade(db: Tx | typeof prisma, a: string, b: string) {
  if (await isBlockedEitherWay(a, b, db)) throw new TradeError("blocked", "Échange impossible avec ce joueur.");
  const audience: string = rules.audience;
  if (audience === "friends") {
    const n = await db.friendship.count({ where: { userId: a, friendId: b, status: "accepted" } });
    if (n === 0) throw new TradeError("friends_only", "Les échanges sont réservés à tes amis.");
  }
}

interface TradeRow {
  id: string;
  proposerId: string;
  recipientId: string;
  status: TradeStatus;
  expiresAt: Date;
}

async function lockTrade(tx: Tx, id: string): Promise<TradeRow | null> {
  const [row] = await tx.$queryRaw<TradeRow[]>`
    SELECT id, "proposerId", "recipientId", status, "expiresAt" FROM "Trade" WHERE id = ${id} FOR UPDATE`;
  return row ?? null;
}

function actionOrThrow(t: TradeRow | null, userId: string, action: "accept" | "decline" | "counter" | "cancel", now: Date): TradeRow {
  if (!t) throw new TradeError("not_found", "Échange introuvable.");
  const err = tradeActionError(t, userId, action, now);
  if (err) throw new TradeError(err === "Échange introuvable." ? "not_found" : "closed", err);
  return t;
}

/** Noms des cartes favorites parmi celles données par chaque joueur (une favorite ne s'échange pas). */
async function favoriteConflicts(db: Tx, gives: { userId: string; cardIds: string[] }[]) {
  const or = gives.filter((g) => g.cardIds.length > 0).map((g) => ({ userId: g.userId, cardId: { in: g.cardIds } }));
  if (or.length === 0) return [];
  return db.favoriteCard.findMany({ where: { OR: or }, select: { userId: true, card: { select: { name: true } } } });
}

// ───────── Proposer ─────────

export interface ProposeTradeInput {
  /** Joueur à qui l'on propose l'échange. */
  to: string;
  /** Exemplaires donnés. */
  give: readonly string[];
  /** Exemplaires demandés à l'autre joueur. */
  take: readonly string[];
  message?: string | null;
  /** Offre reçue à laquelle on répond par une contre-proposition. */
  counterOf?: string | null;
}

export async function proposeTrade(userId: string, input: ProposeTradeInput, now = new Date()) {
  const give = [...new Set(input.give.map(String))];
  const take = [...new Set(input.take.map(String))];
  const invalid = tradeOfferError({ give: input.give, take: input.take }, rules);
  if (invalid) throw new TradeError("invalid", invalid);
  if (input.to === userId) throw new TradeError("self", "Tu ne peux pas échanger avec toi-même.");
  const message = cleanTradeMessage(input.message, rules);

  return withTxRetry(() =>
    prisma.$transaction(async (tx) => {
      await lockUsers(tx, [userId, input.to]);
      const other = await tx.user.findUnique({ where: { id: input.to }, select: { id: true } });
      if (!other) throw new TradeError("not_found", "Joueur introuvable.");
      await assertCanTrade(tx, userId, input.to);

      if (input.counterOf) {
        const original = actionOrThrow(await lockTrade(tx, input.counterOf), userId, "counter", now);
        if (original.proposerId !== input.to) throw new TradeError("invalid", "Une contre-proposition s'adresse à l'auteur de l'offre.");
        await tx.trade.update({ where: { id: original.id }, data: { status: "countered", closedAt: now } });
      }

      const pending = await tx.trade.count({ where: { proposerId: userId, status: "pending", expiresAt: { gt: now } } });
      if (pending >= rules.maxPendingOutgoing) {
        throw new TradeError("too_many", `Tu as déjà ${rules.maxPendingOutgoing} propositions en attente : annules-en une ou attends les réponses.`);
      }

      const copies = await tx.cardCopy.findMany({
        where: { id: { in: [...give, ...take] } },
        select: { id: true, ownerId: true, status: true, cardId: true, finish: true },
      });
      const byId = new Map(copies.map((c) => [c.id, c]));
      const check = (ids: string[], owner: string) =>
        ids.map((id) => {
          const c = byId.get(id);
          if (!c || c.ownerId !== owner || c.status !== "owned") {
            throw new TradeError("not_available", owner === userId ? "Un de tes exemplaires n'est plus disponible (vendu, recyclé ou en vente)." : "Une carte demandée n'est plus disponible chez ce joueur.");
          }
          return c;
        });
      const given = check(give, userId);
      const taken = check(take, input.to);

      const favorites = await favoriteConflicts(tx, [
        { userId, cardIds: given.map((c) => c.cardId) },
        { userId: input.to, cardIds: taken.map((c) => c.cardId) },
      ]);
      const mine = favorites.find((f) => f.userId === userId);
      if (mine) throw new TradeError("favorite", `${mine.card.name} est dans tes favoris : retire-la de tes favoris pour l'échanger.`);
      if (favorites.length > 0) throw new TradeError("not_available", "Une carte demandée n'est plus disponible chez ce joueur.");

      const trade = await tx.trade.create({
        data: {
          proposerId: userId,
          recipientId: input.to,
          message,
          counterOfId: input.counterOf ?? null,
          createdAt: now,
          expiresAt: new Date(now.getTime() + rules.offerTtlMs),
          items: {
            create: [
              ...given.map((c) => ({ fromUserId: userId, copyId: c.id, cardId: c.cardId, finish: c.finish })),
              ...taken.map((c) => ({ fromUserId: input.to, copyId: c.id, cardId: c.cardId, finish: c.finish })),
            ],
          },
        },
        select: { id: true },
      });
      return { tradeId: trade.id };
    }),
  );
}

// ───────── Répondre ─────────

export interface AcceptTradeResult {
  tradeId: string;
  /** Cartes reçues par celui qui accepte. */
  received: number;
  completedSets: CompletedSet[];
}

/**
 * Accepte une offre : tous les exemplaires changent de main dans la même transaction.
 * Si l'un d'eux n'est plus disponible, l'offre passe « indisponible » et rien n'est échangé.
 */
export async function acceptTrade(userId: string, tradeId: string, now = new Date()): Promise<AcceptTradeResult> {
  const peek = await prisma.trade.findUnique({ where: { id: tradeId }, select: { proposerId: true, recipientId: true } });
  if (!peek || (peek.proposerId !== userId && peek.recipientId !== userId)) throw new TradeError("not_found", "Échange introuvable.");

  const res = await withTxRetry(() =>
    prisma.$transaction(async (tx) => {
      await lockUsers(tx, [peek.proposerId, peek.recipientId]);
      const t = actionOrThrow(await lockTrade(tx, tradeId), userId, "accept", now);
      await assertCanTrade(tx, t.proposerId, t.recipientId);

      const items = await tx.tradeItem.findMany({
        where: { tradeId },
        select: { copyId: true, fromUserId: true, cardId: true, copy: { select: { ownerId: true, status: true } } },
      });
      const unavailable = items.some((i) => !i.copyId || !i.copy || i.copy.ownerId !== i.fromUserId || i.copy.status !== "owned");
      if (unavailable) {
        await tx.trade.update({ where: { id: tradeId }, data: { status: "unavailable", closedAt: now } });
        return { unavailable: true as const };
      }

      const fromProposer = items.filter((i) => i.fromUserId === t.proposerId);
      const fromRecipient = items.filter((i) => i.fromUserId === t.recipientId);
      const favorites = await favoriteConflicts(tx, [
        { userId: t.proposerId, cardIds: fromProposer.map((i) => i.cardId) },
        { userId: t.recipientId, cardIds: fromRecipient.map((i) => i.cardId) },
      ]);
      const mine = favorites.find((f) => f.userId === userId);
      if (mine) throw new TradeError("favorite", `${mine.card.name} est dans tes favoris : retire-la de tes favoris pour l'échanger.`);
      if (favorites.length > 0) throw new TradeError("favorite", "L'autre joueur a mis une carte de cet échange en favori : elle ne s'échange plus.");

      for (const i of items) {
        const to = i.fromUserId === t.proposerId ? t.recipientId : t.proposerId;
        const moved = await tx.cardCopy.updateMany({
          where: { id: i.copyId!, ownerId: i.fromUserId, status: "owned" },
          data: { ownerId: to, obtainedVia: "trade", obtainedAt: now, openingId: null },
        });
        if (moved.count !== 1) throw new Error(`Exemplaire ${i.copyId} modifié pendant l'échange ${tradeId}`);
      }
      await removeObtainedFromWishlist(tx, t.recipientId, fromProposer.map((i) => i.cardId));
      await removeObtainedFromWishlist(tx, t.proposerId, fromRecipient.map((i) => i.cardId));
      await tx.trade.update({ where: { id: tradeId }, data: { status: "accepted", closedAt: now } });

      const setsOf = async (cardIds: string[]) =>
        (await tx.card.findMany({ where: { id: { in: [...new Set(cardIds)] } }, select: { setId: true } })).map((c) => c.setId);
      const forRecipient = await checkSetCompletions(tx, t.recipientId, await setsOf(fromProposer.map((i) => i.cardId)));
      const forProposer = await checkSetCompletions(tx, t.proposerId, await setsOf(fromRecipient.map((i) => i.cardId)));
      return {
        unavailable: false as const,
        received: fromProposer.length,
        completedSets: userId === t.recipientId ? forRecipient : forProposer,
      };
    }),
  );
  if (res.unavailable) {
    throw new TradeError("unavailable", "Une carte de cet échange n'est plus disponible : la proposition est annulée, rien n'a été échangé.");
  }
  return { tradeId, received: res.received, completedSets: res.completedSets };
}

export async function declineTrade(userId: string, tradeId: string, now = new Date()) {
  return closeTrade(userId, tradeId, "decline", now);
}

export async function cancelTrade(userId: string, tradeId: string, now = new Date()) {
  return closeTrade(userId, tradeId, "cancel", now);
}

async function closeTrade(userId: string, tradeId: string, action: "decline" | "cancel", now: Date) {
  return prisma.$transaction(async (tx) => {
    actionOrThrow(await lockTrade(tx, tradeId), userId, action, now);
    await tx.trade.update({ where: { id: tradeId }, data: { status: action === "decline" ? "declined" : "cancelled", closedAt: now } });
    return { tradeId };
  });
}

// ───────── Lecture ─────────

const cardSelect = {
  id: true,
  name: true,
  image: true,
  tier: true,
  lang: true,
  localId: true,
  set: { select: { name: true } },
} as const;

export interface TradeCardView {
  cardId: string;
  name: string;
  image: string | null;
  tier: Tier;
  lang: "fr" | "en";
  localId: string;
  setName: string;
  finish: Finish;
}

export interface TradeItemView extends TradeCardView {
  id: string;
  /** L'exemplaire est toujours chez son propriétaire et libre (pour une offre en attente). */
  available: boolean;
}

export interface TradeView {
  id: string;
  status: TradeStatus;
  /** "sent" : proposée par le joueur ; "received" : proposée par l'autre joueur. */
  role: "sent" | "received";
  other: PlayerRef;
  message: string | null;
  createdAt: string;
  expiresAt: string;
  closedAt: string | null;
  isCounter: boolean;
  /** Cartes que le joueur donne, et celles qu'il reçoit. */
  give: TradeItemView[];
  receive: TradeItemView[];
}

/** Passe en « expirées » les offres en attente dont l'échéance est passée. */
async function expireTrades(userId: string, now: Date) {
  await prisma.trade.updateMany({
    where: { status: "pending", expiresAt: { lte: now }, OR: [{ proposerId: userId }, { recipientId: userId }] },
    data: { status: "expired", closedAt: now },
  });
}

const tradeInclude = {
  proposer: { select: playerSelect },
  recipient: { select: playerSelect },
  items: { select: { id: true, fromUserId: true, finish: true, copy: { select: { ownerId: true, status: true } }, card: { select: cardSelect } } },
} satisfies Prisma.TradeInclude;

type TradeWithJoins = Prisma.TradeGetPayload<{ include: typeof tradeInclude }>;
function findTrades(where: Prisma.TradeWhereInput, take: number) {
  return prisma.trade.findMany({ where, include: tradeInclude, orderBy: [{ closedAt: "desc" }, { createdAt: "desc" }], take });
}

function toView(t: TradeWithJoins, userId: string): TradeView {
  const role = t.proposerId === userId ? "sent" : "received";
  const items = t.items.map((i) => ({
    fromUserId: i.fromUserId,
    view: {
      id: i.id,
      cardId: i.card.id,
      name: i.card.name,
      image: i.card.image,
      tier: i.card.tier,
      lang: i.card.lang,
      localId: i.card.localId,
      setName: i.card.set.name,
      finish: i.finish,
      available: t.status === "pending" && !!i.copy && i.copy.ownerId === i.fromUserId && i.copy.status === "owned",
    },
  }));
  return {
    id: t.id,
    status: t.status,
    role,
    other: asPlayer(role === "sent" ? t.recipient : t.proposer),
    message: t.message,
    createdAt: t.createdAt.toISOString(),
    expiresAt: t.expiresAt.toISOString(),
    closedAt: t.closedAt?.toISOString() ?? null,
    isCounter: t.counterOfId !== null,
    give: items.filter((i) => i.fromUserId === userId).map((i) => i.view),
    receive: items.filter((i) => i.fromUserId !== userId).map((i) => i.view),
  };
}

/** Offres reçues et envoyées en attente, puis l'historique récent. */
export async function getTrades(userId: string, now = new Date()) {
  await expireTrades(userId, now);
  const [received, sent, history] = await Promise.all([
    findTrades({ recipientId: userId, status: "pending" }, 100),
    findTrades({ proposerId: userId, status: "pending" }, 100),
    findTrades({ OR: [{ proposerId: userId }, { recipientId: userId }], status: { not: "pending" } }, rules.historySize),
  ]);
  const byNewest = (a: TradeView, b: TradeView) => b.createdAt.localeCompare(a.createdAt);
  return {
    received: received.map((t) => toView(t, userId)).sort(byNewest),
    sent: sent.map((t) => toView(t, userId)).sort(byNewest),
    history: history.map((t) => toView(t, userId)),
  };
}

export async function getTrade(userId: string, tradeId: string): Promise<TradeView | null> {
  const t = await prisma.trade.findUnique({ where: { id: tradeId }, include: tradeInclude });
  if (!t || (t.proposerId !== userId && t.recipientId !== userId)) return null;
  return toView(t, userId);
}

/** Offres reçues en attente (pastille de l'en-tête). */
export async function countPendingTrades(userId: string, now = new Date()) {
  return prisma.trade.count({ where: { recipientId: userId, status: "pending", expiresAt: { gt: now } } });
}

// ───────── Préparer une offre ─────────

export interface TradeableGroup extends TradeCardView {
  /** Un exemplaire libre de cette carte dans cette finition (celui qui sera échangé). */
  copyId: string;
  /** Exemplaires libres de cette carte dans cette finition. */
  count: number;
  /** Carte présente dans la wishlist de l'autre joueur. */
  wished: boolean;
  /** Carte que l'autre joueur n'a pas encore (calculé pour les cartes demandées). */
  isNew: boolean;
  /** Doublon : son propriétaire en a au moins deux exemplaires hors vente, toutes finitions confondues. */
  duplicate: boolean;
}

interface GroupFilter {
  /** Recherche sur le nom de la carte et du set (sans accents ni casse). */
  q?: string;
  /** Seulement les cartes que `wisherId` recherche. */
  onlyWished?: boolean;
  /** Seulement les doublons du propriétaire (au moins deux exemplaires de la carte). */
  onlyDuplicates?: boolean;
  /** Seulement ces cartes (sélection initiale d'une contre-proposition ou d'un lien « Échanger »). */
  cardIds?: string[];
}

/**
 * Doublon : le propriétaire garde au moins un autre exemplaire de la carte (toutes finitions), comme pour
 * « Recycler les doublons ». Un exemplaire en vente au marché ne compte pas : il n'est ni échangeable ni recyclable.
 */
const isDuplicate = (ownerId: string) =>
  Prisma.sql`(SELECT count(*) FROM "CardCopy" d WHERE d."ownerId" = ${ownerId} AND d."cardId" = cc."cardId" AND d.status = 'owned') >= 2`;

/** Conditions SQL communes : exemplaires libres (ni en vente ni favoris) et filtres du sélecteur. */
function groupWhere(ownerId: string, wisherId: string | null, f: GroupFilter) {
  const q = f.q?.trim().slice(0, 80) ?? "";
  return Prisma.sql`cc."ownerId" = ${ownerId} AND cc.status = 'owned'
      AND NOT EXISTS (SELECT 1 FROM "FavoriteCard" f WHERE f."userId" = ${ownerId} AND f."cardId" = cc."cardId")
      ${q ? Prisma.sql`AND pf_unaccent(lower(c.name || ' ' || s.name)) LIKE '%' || pf_unaccent(lower(${q})) || '%'` : Prisma.empty}
      ${f.onlyWished ? Prisma.sql`AND EXISTS (SELECT 1 FROM "WishlistCard" w WHERE w."userId" = ${wisherId} AND w."cardId" = cc."cardId")` : Prisma.empty}
      ${f.onlyDuplicates ? Prisma.sql`AND ${isDuplicate(ownerId)}` : Prisma.empty}
      ${f.cardIds ? Prisma.sql`AND cc."cardId" = ANY(${f.cardIds}::text[])` : Prisma.empty}`;
}

/**
 * Exemplaires libres d'un joueur, regroupés par carte et finition : ni en vente ni favoris.
 * Les cartes que `wisherId` recherche viennent en premier, puis les plus rares.
 */
async function tradeableGroups(ownerId: string, wisherId: string | null, newFor: string | null, f: GroupFilter, take: number, skip = 0): Promise<TradeableGroup[]> {
  return prisma.$queryRaw<TradeableGroup[]>`
    SELECT min(cc.id) AS "copyId", cc."cardId", cc.finish, count(*)::int AS count,
      c.name, c.image, c.tier, c.lang, c."localId", s.name AS "setName",
      EXISTS (SELECT 1 FROM "WishlistCard" w WHERE w."userId" = ${wisherId} AND w."cardId" = cc."cardId") AS wished,
      (${newFor}::text IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "CardCopy" o WHERE o."ownerId" = ${newFor} AND o."cardId" = cc."cardId")) AS "isNew",
      ${isDuplicate(ownerId)} AS duplicate
    FROM "CardCopy" cc
    JOIN "Card" c ON c.id = cc."cardId"
    JOIN "Set" s ON s.id = c."setId"
    WHERE ${groupWhere(ownerId, wisherId, f)}
    GROUP BY cc."cardId", cc.finish, c.id, s.name
    ORDER BY wished DESC, array_position(ARRAY['mythic','legendary','epic','rare','uncommon','common']::text[], c.tier::text), c.name, cc.finish, cc."cardId"
    LIMIT ${take} OFFSET ${skip}`;
}

type GroupCounts = { total: number; wished: number; wishedCards: number; duplicates: number };

/** Nombre de groupes (carte × finition) qui passent le filtre, et parmi eux ceux que `wisherId` recherche et les doublons. */
async function countGroups(ownerId: string, wisherId: string | null, f: GroupFilter): Promise<GroupCounts> {
  const [row] = await prisma.$queryRaw<GroupCounts[]>`
    SELECT count(*)::int AS total, count(*) FILTER (WHERE g.wished)::int AS wished,
      count(DISTINCT g."cardId") FILTER (WHERE g.wished)::int AS "wishedCards",
      count(*) FILTER (WHERE g.duplicate)::int AS duplicates
    FROM (
      SELECT cc."cardId", EXISTS (SELECT 1 FROM "WishlistCard" w WHERE w."userId" = ${wisherId} AND w."cardId" = cc."cardId") AS wished,
        ${isDuplicate(ownerId)} AS duplicate
      FROM "CardCopy" cc
      JOIN "Card" c ON c.id = cc."cardId"
      JOIN "Set" s ON s.id = c."setId"
      WHERE ${groupWhere(ownerId, wisherId, f)}
      GROUP BY cc."cardId", cc.finish
    ) g`;
  return row ?? { total: 0, wished: 0, wishedCards: 0, duplicates: 0 };
}

export type TradeSide = "mine" | "theirs";

export interface TradePickerPage {
  groups: TradeableGroup[];
  /** Page renvoyée (1 pour la première, ramenée dans les bornes) et nombre de pages. */
  page: number;
  pageCount: number;
  /** Groupes qui passent le filtre. */
  total: number;
  /** Parmi eux, ceux de la wishlist d'en face (« Ma wishlist » chez l'autre, « Sa wishlist » chez moi). */
  wished: number;
  /** Les mêmes, en cartes distinctes (une carte peut exister en plusieurs finitions). */
  wishedCards: number;
  /** Parmi eux, les doublons de leur propriétaire. */
  duplicates: number;
  /** La wishlist d'en face est connue : le filtre wishlist a un sens. */
  wishlistVisible: boolean;
}

/**
 * Une page du sélecteur de cartes : `theirs` = exemplaires de l'autre joueur (ma wishlist d'abord),
 * `mine` = les miens (sa wishlist d'abord, si elle m'est visible). Les collections complètes se comptent
 * en milliers de cartes : on n'envoie jamais plus d'une page au navigateur.
 */
export async function getTradePickerPage(
  userId: string,
  otherId: string,
  side: TradeSide,
  filter: { q?: string; onlyWished?: boolean; onlyDuplicates?: boolean; page?: number } = {},
  seeTheirs?: boolean,
): Promise<TradePickerPage> {
  if (userId === otherId) throw new TradeError("self", "Tu ne peux pas échanger avec toi-même.");
  if (seeTheirs === undefined) {
    await assertCanTrade(prisma, userId, otherId);
    seeTheirs = await canSeeWishlist(otherId, userId);
  }
  const [ownerId, wisherId, newFor] = side === "theirs" ? [otherId, userId, userId] : [userId, seeTheirs ? otherId : null, null];
  const f: GroupFilter = { q: filter.q, onlyWished: Boolean(filter.onlyWished && wisherId), onlyDuplicates: Boolean(filter.onlyDuplicates) };
  const counts = await countGroups(ownerId, wisherId, f);
  const size = rules.pickerPageSize;
  const pageCount = Math.max(1, Math.ceil(counts.total / size));
  const asked = Math.trunc(Number(filter.page ?? 1));
  const page = Number.isFinite(asked) ? Math.min(Math.max(asked, 1), pageCount) : 1;
  const groups = counts.total === 0 ? [] : await tradeableGroups(ownerId, wisherId, newFor, f, size, (page - 1) * size);
  return { groups, page, pageCount, ...counts, wishlistVisible: wisherId !== null };
}

/**
 * Tout ce qu'il faut pour composer une offre à `otherId` : la première page de chaque côté, la
 * taille de sa wishlist (si elle m'est visible) et les groupes déjà choisis (contre-proposition, lien « Échanger »).
 */
export async function getTradeComposer(userId: string, otherId: string, preselect: { give?: string[]; take?: string[] } = {}) {
  if (userId === otherId) throw new TradeError("self", "Tu ne peux pas échanger avec toi-même.");
  await assertCanTrade(prisma, userId, otherId);
  const seeTheirs = await canSeeWishlist(otherId, userId);
  const cardIdsOf = (keys: string[] = []) => [...new Set(keys.map((k) => k.split(":")[0]!))];
  const pick = async (ownerId: string, wisherId: string | null, newFor: string | null, keys: string[] = []) => {
    if (keys.length === 0) return [];
    const groups = await tradeableGroups(ownerId, wisherId, newFor, { cardIds: cardIdsOf(keys) }, 100);
    // Une clé « carte » sans finition (lien depuis une fiche) prend la première finition disponible.
    return keys.flatMap((k) => groups.find((g) => (k.includes(":") ? `${g.cardId}:${g.finish}` === k : g.cardId === k)) ?? []);
  };
  const [mine, theirs, selectedMine, selectedTheirs, theirWishlist, pending] = await Promise.all([
    getTradePickerPage(userId, otherId, "mine", {}, seeTheirs),
    getTradePickerPage(userId, otherId, "theirs", {}, seeTheirs),
    pick(userId, seeTheirs ? otherId : null, null, preselect.give),
    pick(otherId, userId, userId, preselect.take),
    seeTheirs ? prisma.wishlistCard.count({ where: { userId: otherId } }) : Promise.resolve(null),
    prisma.trade.count({ where: { proposerId: userId, status: "pending", expiresAt: { gt: new Date() } } }),
  ]);
  return { mine, theirs, selectedMine, selectedTheirs, theirWishlist, pendingOutgoing: pending };
}

export interface TradePartner {
  player: PlayerRef;
  /** Cartes de la wishlist du joueur que ce partenaire peut échanger. */
  matches: number;
  cards: { id: string; name: string; image: string | null }[];
}

/** Joueurs qui possèdent (en libre) des cartes de la wishlist du joueur, les plus intéressants d'abord. */
export async function getTradeSuggestions(userId: string, take = 6): Promise<TradePartner[]> {
  const friendsOnly = (rules.audience as string) === "friends";
  const rows = await prisma.$queryRaw<{ ownerId: string; matches: number; cardIds: string[] }[]>`
    SELECT cc."ownerId", count(DISTINCT cc."cardId")::int AS matches, (array_agg(DISTINCT cc."cardId"))[1:4] AS "cardIds"
    FROM "WishlistCard" w
    JOIN "CardCopy" cc ON cc."cardId" = w."cardId" AND cc.status = 'owned' AND cc."ownerId" <> ${userId}
    JOIN "User" u ON u.id = cc."ownerId" AND u.handle IS NOT NULL
    WHERE w."userId" = ${userId}
      AND NOT EXISTS (SELECT 1 FROM "FavoriteCard" f WHERE f."userId" = cc."ownerId" AND f."cardId" = cc."cardId")
      AND NOT EXISTS (SELECT 1 FROM "Block" b WHERE (b."userId" = ${userId} AND b."blockedId" = cc."ownerId") OR (b."userId" = cc."ownerId" AND b."blockedId" = ${userId}))
      AND (${friendsOnly} = false OR EXISTS (SELECT 1 FROM "Friendship" fr WHERE fr."userId" = ${userId} AND fr."friendId" = cc."ownerId" AND fr.status = 'accepted'))
    GROUP BY cc."ownerId"
    ORDER BY matches DESC, cc."ownerId"
    LIMIT ${take}`;
  if (rows.length === 0) return [];
  const [users, cards] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: rows.map((r) => r.ownerId) } }, select: playerSelect }),
    prisma.card.findMany({ where: { id: { in: rows.flatMap((r) => r.cardIds) } }, select: { id: true, name: true, image: true } }),
  ]);
  const userById = new Map(users.map((u) => [u.id, u]));
  const cardById = new Map(cards.map((c) => [c.id, c]));
  return rows.flatMap((r) => {
    const u = userById.get(r.ownerId);
    if (!u) return [];
    return [{ player: asPlayer(u), matches: r.matches, cards: r.cardIds.flatMap((id) => cardById.get(id) ?? []) }];
  });
}

/** Joueurs qui peuvent échanger cette carte avec le visiteur (exemplaire libre, hors favoris et blocages). */
export async function getCardTraders(cardId: string, viewerId: string, take = 8): Promise<(PlayerRef & { copies: number })[]> {
  const friendsOnly = (rules.audience as string) === "friends";
  const rows = await prisma.$queryRaw<{ ownerId: string; copies: number }[]>`
    SELECT cc."ownerId", count(*)::int AS copies
    FROM "CardCopy" cc
    JOIN "User" u ON u.id = cc."ownerId" AND u.handle IS NOT NULL
    WHERE cc."cardId" = ${cardId} AND cc.status = 'owned' AND cc."ownerId" <> ${viewerId}
      AND NOT EXISTS (SELECT 1 FROM "FavoriteCard" f WHERE f."userId" = cc."ownerId" AND f."cardId" = cc."cardId")
      AND NOT EXISTS (SELECT 1 FROM "Block" b WHERE (b."userId" = ${viewerId} AND b."blockedId" = cc."ownerId") OR (b."userId" = cc."ownerId" AND b."blockedId" = ${viewerId}))
      AND (${friendsOnly} = false OR EXISTS (SELECT 1 FROM "Friendship" fr WHERE fr."userId" = ${viewerId} AND fr."friendId" = cc."ownerId" AND fr.status = 'accepted'))
    GROUP BY cc."ownerId"
    ORDER BY copies DESC, cc."ownerId"
    LIMIT ${take}`;
  if (rows.length === 0) return [];
  const users = await prisma.user.findMany({ where: { id: { in: rows.map((r) => r.ownerId) } }, select: playerSelect });
  const byId = new Map(users.map((u) => [u.id, u]));
  return rows.flatMap((r) => {
    const u = byId.get(r.ownerId);
    return u ? [{ ...asPlayer(u), copies: r.copies }] : [];
  });
}

// ───────── Notification en direct ─────────

export type TradeNotice = "offer" | "counter" | "accepted" | "declined" | "cancelled";

/**
 * Notification à envoyer après une action sur un échange (serveur temps réel) : vérifie que
 * `actorId` vient bien d'agir sur cette offre, il y a peu, et renvoie qui prévenir. Null sinon.
 */
export async function tradeNoticeFor(actorId: string, tradeId: string, now = new Date(), maxAgeMs = 2 * 60_000) {
  const t = await prisma.trade.findUnique({
    where: { id: tradeId },
    select: { proposerId: true, recipientId: true, status: true, createdAt: true, closedAt: true, counterOfId: true, proposer: { select: playerSelect }, recipient: { select: playerSelect } },
  });
  if (!t) return null;
  const recent = (d: Date | null) => !!d && now.getTime() - d.getTime() <= maxAgeMs;
  let notice: TradeNotice | null = null;
  let to: string | null = null;
  if (t.status === "pending" && actorId === t.proposerId && recent(t.createdAt)) {
    notice = t.counterOfId ? "counter" : "offer";
    to = t.recipientId;
  } else if ((t.status === "accepted" || t.status === "declined") && actorId === t.recipientId && recent(t.closedAt)) {
    notice = t.status;
    to = t.proposerId;
  } else if (t.status === "cancelled" && actorId === t.proposerId && recent(t.closedAt)) {
    notice = "cancelled";
    to = t.recipientId;
  }
  if (!notice || !to) return null;
  const from = asPlayer(actorId === t.proposerId ? t.proposer : t.recipient);
  return { to, payload: { tradeId, kind: notice, from: { name: from.name, handle: from.handle } } };
}
