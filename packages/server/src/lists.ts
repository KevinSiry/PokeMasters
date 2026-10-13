/**
 * Favoris et wishlist.
 * Favori : une carte de sa collection mise en avant, jamais recyclée par « Recycler les doublons ».
 * Wishlist : une carte recherchée ; sa mise en vente au marché prévient le joueur en direct.
 */
import { gameConfig, type Tier } from "@pokeflex/config";
import { prisma } from "@pokeflex/db";
import { type CardListKind, listFullError, wishlistAlertRecipients } from "@pokeflex/game";
import { type Tx } from "./ledger";

const rules = gameConfig.lists;

export class ListError extends Error {
  constructor(
    readonly code: "not_found" | "not_owned" | "owned" | "full",
    message: string,
  ) {
    super(message);
    this.name = "ListError";
  }
}

const listCardSelect = {
  id: true,
  localId: true,
  name: true,
  image: true,
  tier: true,
  lang: true,
  set: { select: { name: true } },
} as const;

export interface ListCard {
  id: string;
  localId: string;
  name: string;
  image: string | null;
  tier: Tier;
  lang: "fr" | "en";
  setName: string;
  addedAt: Date;
}

async function assertCard(cardId: string) {
  const card = await prisma.card.findUnique({ where: { id: cardId }, select: { id: true } });
  if (!card) throw new ListError("not_found", "Carte introuvable.");
}

async function assertRoom(kind: CardListKind, userId: string) {
  const count = kind === "favorites" ? await prisma.favoriteCard.count({ where: { userId } }) : await prisma.wishlistCard.count({ where: { userId } });
  const err = listFullError(kind, count, rules);
  if (err) throw new ListError("full", err);
}

/** Ajoute ou retire un favori. Seule une carte possédée (au moins un exemplaire) peut devenir favorite. */
export async function setFavorite(userId: string, cardId: string, on: boolean): Promise<{ favorite: boolean }> {
  if (!on) {
    await prisma.favoriteCard.deleteMany({ where: { userId, cardId } });
    return { favorite: false };
  }
  await assertCard(cardId);
  const already = await prisma.favoriteCard.findUnique({ where: { userId_cardId: { userId, cardId } }, select: { cardId: true } });
  if (already) return { favorite: true };
  const owned = await prisma.cardCopy.count({ where: { ownerId: userId, cardId } });
  if (owned === 0) throw new ListError("not_owned", "Seules les cartes de ta collection peuvent être en favori.");
  await assertRoom("favorites", userId);
  await prisma.favoriteCard.createMany({ data: [{ userId, cardId }], skipDuplicates: true });
  return { favorite: true };
}

/** Ajoute ou retire une carte de la wishlist (une carte du catalogue que le joueur n'a pas encore). */
export async function setWishlisted(userId: string, cardId: string, on: boolean): Promise<{ wished: boolean }> {
  if (!on) {
    await prisma.wishlistCard.deleteMany({ where: { userId, cardId } });
    return { wished: false };
  }
  await assertCard(cardId);
  const already = await prisma.wishlistCard.findUnique({ where: { userId_cardId: { userId, cardId } }, select: { cardId: true } });
  if (already) return { wished: true };
  const owned = await prisma.cardCopy.count({ where: { ownerId: userId, cardId } });
  if (owned > 0) throw new ListError("owned", "Tu as déjà cette carte dans ta collection.");
  await assertRoom("wishlist", userId);
  await prisma.wishlistCard.createMany({ data: [{ userId, cardId }], skipDuplicates: true });
  return { wished: true };
}

/** Une carte obtenue (booster, marché) quitte la wishlist, dans la transaction qui la donne au joueur. */
export async function removeObtainedFromWishlist(tx: Tx, userId: string, cardIds: readonly string[]) {
  if (cardIds.length === 0) return;
  await tx.wishlistCard.deleteMany({ where: { userId, cardId: { in: [...new Set(cardIds)] } } });
}

/** État des deux listes pour une carte (fiche carte). */
export async function getCardListState(userId: string, cardId: string) {
  const [favorite, wished] = await Promise.all([
    prisma.favoriteCard.count({ where: { userId, cardId } }),
    prisma.wishlistCard.count({ where: { userId, cardId } }),
  ]);
  return { favorite: favorite > 0, wished: wished > 0 };
}

/** Cartes favorites du joueur (pour protéger leurs exemplaires et marquer les vignettes). */
export async function getFavoriteCardIds(userId: string, db: Tx | typeof prisma = prisma): Promise<Set<string>> {
  const rows = await db.favoriteCard.findMany({ where: { userId }, select: { cardId: true } });
  return new Set(rows.map((r) => r.cardId));
}

export async function getWishlistCardIds(userId: string): Promise<string[]> {
  const rows = await prisma.wishlistCard.findMany({ where: { userId }, select: { cardId: true } });
  return rows.map((r) => r.cardId);
}

/**
 * Nombre d'exemplaires possédés par carte, toutes finitions confondues comme au Pokédex
 * (un exemplaire en vente compte encore). Les cartes absentes de la collection n'ont pas d'entrée.
 */
export async function getOwnedCopyCounts(userId: string, cardIds: string[]): Promise<Map<string, number>> {
  if (cardIds.length === 0) return new Map();
  const counts = await prisma.cardCopy.groupBy({
    by: ["cardId"],
    where: { ownerId: userId, cardId: { in: [...new Set(cardIds)] } },
    _count: { _all: true },
  });
  return new Map(counts.map((c) => [c.cardId, c._count._all]));
}

/** Cartes favorites, les plus récemment ajoutées d'abord, avec le nombre d'exemplaires possédés. */
export async function getFavorites(userId: string): Promise<(ListCard & { copies: number })[]> {
  const rows = await prisma.favoriteCard.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, card: { select: listCardSelect } },
  });
  const byCard = await getOwnedCopyCounts(userId, rows.map((r) => r.card.id));
  return rows.map((r) => ({ ...toListCard(r.card, r.createdAt), copies: byCard.get(r.card.id) ?? 0 }));
}

export interface WishlistEntry extends ListCard {
  /** Annonces actives des autres joueurs, et le prix le plus bas (offre courante pour une enchère). */
  onSale: number;
  lowestPrice: number | null;
}

/** Wishlist du joueur, les plus récemment ajoutées d'abord, avec ce qui est en vente au marché. */
export async function getWishlist(userId: string): Promise<WishlistEntry[]> {
  const rows = await prisma.wishlistCard.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, card: { select: listCardSelect } },
  });
  const ids = rows.map((r) => r.card.id);
  if (ids.length === 0) return [];
  const listings = await prisma.listing.findMany({
    where: { cardId: { in: ids }, status: "active", sellerId: { not: userId } },
    select: { cardId: true, price: true, currentBid: true },
  });
  const sale = new Map<string, { n: number; min: number }>();
  for (const l of listings) {
    const amount = l.currentBid ?? l.price;
    const cur = sale.get(l.cardId);
    sale.set(l.cardId, { n: (cur?.n ?? 0) + 1, min: Math.min(cur?.min ?? amount, amount) });
  }
  return rows.map((r) => ({
    ...toListCard(r.card, r.createdAt),
    onSale: sale.get(r.card.id)?.n ?? 0,
    lowestPrice: sale.get(r.card.id)?.min ?? null,
  }));
}

/** Wishlist montrée sur un profil, selon `config.lists.wishlistVisibility`. Null si le visiteur ne peut pas la voir. */
export async function getProfileWishlist(ownerId: string, viewerId: string | null, take = rules.profileWishlistSize) {
  if (!(await canSeeWishlist(ownerId, viewerId))) return null;
  const [rows, total] = await Promise.all([
    prisma.wishlistCard.findMany({
      where: { userId: ownerId },
      orderBy: { createdAt: "desc" },
      take,
      select: { createdAt: true, card: { select: listCardSelect } },
    }),
    prisma.wishlistCard.count({ where: { userId: ownerId } }),
  ]);
  return { cards: rows.map((r) => toListCard(r.card, r.createdAt)), total };
}

async function canSeeWishlist(ownerId: string, viewerId: string | null): Promise<boolean> {
  if (viewerId === ownerId) return true;
  const visibility: string = rules.wishlistVisibility;
  if (visibility === "public") return true;
  if (visibility !== "friends" || !viewerId) return false;
  const n = await prisma.friendship.count({ where: { userId: ownerId, friendId: viewerId, status: "accepted" } });
  return n > 0;
}

/** Nombre de joueurs qui recherchent cette carte (affiché seulement si les wishlists sont publiques). */
export async function countWishers(cardId: string): Promise<number | null> {
  if (rules.wishlistVisibility !== "public") return null;
  return prisma.wishlistCard.count({ where: { cardId } });
}

/**
 * Alerte wishlist d'une annonce qui vient d'être publiée : vérifie que l'appelant en est le vendeur,
 * qu'elle est active et récente, puis renvoie les joueurs à prévenir (hors blocages).
 */
export async function wishlistAlertForListing(sellerId: string, listingId: string, now = new Date()) {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { id: true, sellerId: true, status: true, createdAt: true, type: true, price: true, finish: true, card: { select: { id: true, name: true } } },
  });
  if (!listing || listing.sellerId !== sellerId || listing.status !== "active") return null;
  if (now.getTime() - listing.createdAt.getTime() > rules.alertMaxAgeMs) return null;
  const [wishers, blocks] = await Promise.all([
    prisma.wishlistCard.findMany({ where: { cardId: listing.card.id }, select: { userId: true } }),
    prisma.block.findMany({ where: { OR: [{ userId: sellerId }, { blockedId: sellerId }] }, select: { userId: true, blockedId: true } }),
  ]);
  const blocked = new Set(blocks.map((b) => (b.userId === sellerId ? b.blockedId : b.userId)));
  return {
    recipients: wishlistAlertRecipients(
      wishers.map((w) => w.userId),
      sellerId,
      blocked,
    ),
    listing: { id: listing.id, type: listing.type, price: listing.price, finish: listing.finish, cardId: listing.card.id, cardName: listing.card.name },
  };
}

function toListCard(c: { id: string; localId: string; name: string; image: string | null; tier: Tier; lang: "fr" | "en"; set: { name: string } }, addedAt: Date): ListCard {
  return { id: c.id, localId: c.localId, name: c.name, image: c.image, tier: c.tier, lang: c.lang, setName: c.set.name, addedAt };
}
