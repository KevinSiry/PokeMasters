/**
 * Social : profils et vitrine, amis, blocages et signalements, guildes et leur chat,
 * messages privés, classements figés toutes les heures.
 */
import { gameConfig, REPORT_REASONS, type Tier } from "@pokeflex/config";
import { type GuildRole, prisma, type Prisma } from "@pokeflex/db";
import { cleanMessage, guildError, handleError, handleFromName, handleVariant, normalizeGuildTag, rankEntries } from "@pokeflex/game";
import { applyLedger, lockUser, type Tx, withTxRetry } from "./ledger";

const rules = gameConfig.social;

export class SocialError extends Error {
  constructor(
    readonly code: "not_found" | "self" | "invalid" | "taken" | "blocked" | "rate_limited" | "too_many" | "forbidden" | "already" | "full" | "funds",
    message: string,
  ) {
    super(message);
    this.name = "SocialError";
  }
}

export interface PlayerRef {
  id: string;
  name: string;
  handle: string | null;
  image: string | null;
}

const playerSelect = {
  id: true,
  name: true,
  handle: true,
  image: true,
} as const;
const asPlayer = (u: { id: string; name: string | null; handle: string | null; image: string | null }): PlayerRef => ({
  id: u.id,
  name: u.name ?? u.handle ?? "Dresseur",
  handle: u.handle,
  image: u.image,
});

const cleanHandle = (h: string) => h.trim().replace(/^@/, "").toLowerCase();

async function userByHandle(handle: string) {
  const h = cleanHandle(handle);
  if (!h) return null;
  return prisma.user.findFirst({
    where: { handle: { equals: h, mode: "insensitive" } },
    select: playerSelect,
  });
}

// ───────── Pseudos et profils ─────────

/** Donne un pseudo libre au joueur s'il n'en a pas (nouveau compte Twitch/Discord). */
export async function ensureHandle(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { handle: true, name: true },
  });
  if (!user) throw new SocialError("not_found", "Joueur introuvable.");
  if (user.handle) return user.handle;
  const base = handleFromName(user.name, rules);
  for (let n = 1; n < 50; n++) {
    const candidate = n === 1 ? base : handleVariant(base, n, rules);
    const res = await prisma.user
      .updateMany({
        where: { id: userId, handle: null },
        data: { handle: candidate },
      })
      .catch(() => ({ count: 0 }));
    if (res.count === 1) return candidate;
    const again = await prisma.user.findUnique({
      where: { id: userId },
      select: { handle: true },
    });
    if (again?.handle) return again.handle;
  }
  const fallback = handleVariant("dresseur", Math.floor(Math.random() * 1e6), rules);
  await prisma.user.update({
    where: { id: userId },
    data: { handle: fallback },
  });
  return fallback;
}

export async function updateProfile(userId: string, input: { handle?: string; bio?: string | null }) {
  const data: Prisma.UserUpdateInput = {};
  if (input.handle !== undefined) {
    const handle = cleanHandle(input.handle);
    const err = handleError(handle, rules);
    if (err) throw new SocialError("invalid", err);
    const other = await prisma.user.findFirst({
      where: {
        handle: { equals: handle, mode: "insensitive" },
        id: { not: userId },
      },
      select: { id: true },
    });
    if (other) throw new SocialError("taken", "Ce pseudo est déjà pris.");
    data.handle = handle;
  }
  if (input.bio !== undefined) {
    const bio = input.bio ? cleanMessage(input.bio, rules.bioMaxLength) : null;
    if (input.bio && input.bio.trim() && !bio) throw new SocialError("invalid", `Ta présentation doit faire au plus ${rules.bioMaxLength} caractères.`);
    data.bio = bio;
  }
  try {
    await prisma.user.update({ where: { id: userId }, data });
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") throw new SocialError("taken", "Ce pseudo est déjà pris.");
    throw err;
  }
}

/** Vitrine : jusqu'à `showcaseSize` cartes différentes, toutes possédées au moment du choix. */
export async function setShowcase(userId: string, cardIds: readonly string[]) {
  const ids = [...new Set(cardIds.map(String))];
  if (ids.length > rules.showcaseSize) throw new SocialError("too_many", `Ta vitrine contient au plus ${rules.showcaseSize} cartes.`);
  const owned = await prisma.cardCopy.findMany({
    where: { ownerId: userId, cardId: { in: ids } },
    select: { cardId: true },
    distinct: ["cardId"],
  });
  if (owned.length !== ids.length) throw new SocialError("invalid", "Tu ne peux exposer que des cartes que tu possèdes.");
  await prisma.user.update({ where: { id: userId }, data: { showcase: ids } });
}

export interface ShowcaseCard {
  id: string;
  name: string;
  image: string | null;
  tier: Tier;
  setName: string;
}

async function showcaseCards(userId: string, ids: readonly string[]): Promise<ShowcaseCard[]> {
  if (ids.length === 0) return [];
  const cards = await prisma.card.findMany({
    where: { id: { in: [...ids] }, copies: { some: { ownerId: userId } } },
    select: {
      id: true,
      name: true,
      image: true,
      tier: true,
      set: { select: { name: true } },
    },
  });
  const byId = new Map(cards.map((c) => [c.id, c]));
  return ids.flatMap((id) => {
    const c = byId.get(id);
    return c
      ? [
          {
            id: c.id,
            name: c.name,
            image: c.image,
            tier: c.tier as Tier,
            setName: c.set.name,
          },
        ]
      : [];
  });
}

/** Cartes que le joueur peut mettre en vitrine (une ligne par carte, les plus rares d'abord). */
export async function getShowcaseCandidates(userId: string, q = "", take = 60): Promise<ShowcaseCard[]> {
  const query = q.trim();
  const rows = await prisma.$queryRaw<
    {
      id: string;
      name: string;
      image: string | null;
      tier: Tier;
      setName: string;
    }[]
  >`
    SELECT c.id, c.name, c.image, c.tier, s.name AS "setName"
    FROM "Card" c JOIN "Set" s ON s.id = c."setId"
    WHERE EXISTS (SELECT 1 FROM "CardCopy" cc WHERE cc."cardId" = c.id AND cc."ownerId" = ${userId})
      AND (${query} = '' OR c.name ILIKE ${`%${query}%`})
    ORDER BY array_position(ARRAY['mythic','legendary','epic','rare','uncommon','common']::text[], c.tier::text), c.name
    LIMIT ${take}`;
  return rows;
}

export type Relation = "self" | "none" | "friends" | "request_sent" | "request_received" | "blocked" | "blocked_by";

export async function relationBetween(viewerId: string, otherId: string): Promise<Relation> {
  if (viewerId === otherId) return "self";
  const [blocks, links] = await Promise.all([
    prisma.block.findMany({
      where: {
        OR: [
          { userId: viewerId, blockedId: otherId },
          { userId: otherId, blockedId: viewerId },
        ],
      },
      select: { userId: true },
    }),
    prisma.friendship.findMany({
      where: {
        OR: [
          { userId: viewerId, friendId: otherId },
          { userId: otherId, friendId: viewerId },
        ],
      },
      select: { userId: true, status: true },
    }),
  ]);
  if (blocks.some((b) => b.userId === viewerId)) return "blocked";
  if (blocks.length > 0) return "blocked_by";
  if (links.some((l) => l.status === "accepted")) return "friends";
  if (links.some((l) => l.userId === viewerId)) return "request_sent";
  if (links.length > 0) return "request_received";
  return "none";
}

/** Vrai si l'un des deux a bloqué l'autre. */
export async function isBlockedEitherWay(a: string, b: string, db: Tx | typeof prisma = prisma): Promise<boolean> {
  const n = await db.block.count({
    where: {
      OR: [
        { userId: a, blockedId: b },
        { userId: b, blockedId: a },
      ],
    },
  });
  return n > 0;
}

export async function getPublicProfile(handle: string, viewerId?: string | null) {
  const user = await prisma.user.findFirst({
    where: { handle: { equals: cleanHandle(handle), mode: "insensitive" } },
    select: {
      ...playerSelect,
      bio: true,
      showcase: true,
      createdAt: true,
      guildMember: {
        select: {
          role: true,
          guild: { select: { id: true, name: true, tag: true } },
        },
      },
    },
  });
  if (!user) return null;
  const [cards, sets, sales, showcase, friends, relation] = await Promise.all([
    prisma.$queryRaw<{ distinct: bigint; copies: bigint }[]>`
      SELECT count(DISTINCT "cardId") AS distinct, count(*) AS copies FROM "CardCopy" WHERE "ownerId" = ${user.id}`,
    prisma.setCompletion.count({ where: { userId: user.id } }),
    prisma.sale.count({ where: { sellerId: user.id } }),
    showcaseCards(user.id, user.showcase),
    prisma.friendship.count({ where: { userId: user.id, status: "accepted" } }),
    viewerId ? relationBetween(viewerId, user.id) : Promise.resolve(null),
  ]);
  return {
    player: asPlayer(user),
    bio: user.bio,
    joinedAt: user.createdAt.toISOString(),
    guild: user.guildMember ? { ...user.guildMember.guild, role: user.guildMember.role } : null,
    stats: {
      distinctCards: Number(cards[0]?.distinct ?? 0),
      copies: Number(cards[0]?.copies ?? 0),
      setsCompleted: sets,
      friends,
      sales,
    },
    showcase,
    relation,
  };
}

export type PublicProfile = NonNullable<Awaited<ReturnType<typeof getPublicProfile>>>;

/** Joueurs par pseudo ou nom, hors soi-même et hors blocages. */
export async function searchPlayers(viewerId: string | null, q: string, take = 10): Promise<PlayerRef[]> {
  const query = cleanHandle(q);
  if (query.length < 2) return [];
  const rows = await prisma.user.findMany({
    where: {
      handle: { not: null },
      ...(viewerId
        ? {
            id: { not: viewerId },
            blocks: { none: { blockedId: viewerId } },
            blockedBy: { none: { userId: viewerId } },
          }
        : {}),
      OR: [{ handle: { contains: query, mode: "insensitive" } }, { name: { contains: q.trim(), mode: "insensitive" } }],
    },
    select: playerSelect,
    orderBy: { handle: "asc" },
    take,
  });
  return rows.map(asPlayer);
}

// ───────── Amis ─────────

export async function sendFriendRequest(userId: string, handle: string) {
  const target = await userByHandle(handle);
  if (!target) throw new SocialError("not_found", "Aucun joueur ne porte ce pseudo.");
  if (target.id === userId) throw new SocialError("self", "Tu ne peux pas t'ajouter toi-même.");
  return withTxRetry(() =>
    prisma.$transaction(async (tx) => {
      await lockUser(tx, userId);
      if (await isBlockedEitherWay(userId, target.id, tx)) throw new SocialError("blocked", "Impossible d'ajouter ce joueur.");
      const existing = await tx.friendship.findMany({
        where: {
          OR: [
            { userId, friendId: target.id },
            { userId: target.id, friendId: userId },
          ],
        },
      });
      if (existing.some((f) => f.status === "accepted")) throw new SocialError("already", "Vous êtes déjà amis.");
      if (existing.some((f) => f.userId === userId)) throw new SocialError("already", "Ta demande est déjà envoyée.");
      const count = await tx.friendship.count({
        where: { userId, status: "accepted" },
      });
      if (count >= rules.maxFriends) throw new SocialError("too_many", `Tu as déjà ${rules.maxFriends} amis.`);
      // Il m'avait déjà demandé : on accepte directement.
      if (existing.some((f) => f.userId === target.id)) {
        await tx.friendship.update({
          where: { userId_friendId: { userId: target.id, friendId: userId } },
          data: { status: "accepted" },
        });
        await tx.friendship.create({
          data: { userId, friendId: target.id, status: "accepted" },
        });
        return { status: "accepted" as const, target };
      }
      await tx.friendship.create({
        data: { userId, friendId: target.id, status: "pending" },
      });
      return { status: "pending" as const, target };
    }),
  );
}

export async function respondFriendRequest(userId: string, fromId: string, accept: boolean) {
  return prisma.$transaction(async (tx) => {
    const req = await tx.friendship.findUnique({
      where: { userId_friendId: { userId: fromId, friendId: userId } },
    });
    if (!req || req.status !== "pending") throw new SocialError("not_found", "Cette demande n'existe plus.");
    if (!accept) {
      await tx.friendship.delete({
        where: { userId_friendId: { userId: fromId, friendId: userId } },
      });
      return { status: "declined" as const };
    }
    await tx.friendship.update({
      where: { userId_friendId: { userId: fromId, friendId: userId } },
      data: { status: "accepted" },
    });
    await tx.friendship.upsert({
      where: { userId_friendId: { userId, friendId: fromId } },
      create: { userId, friendId: fromId, status: "accepted" },
      update: { status: "accepted" },
    });
    return { status: "accepted" as const };
  });
}

/** Retire un ami, annule une demande envoyée ou refuse une demande reçue. */
export async function removeFriend(userId: string, otherId: string) {
  await prisma.friendship.deleteMany({
    where: {
      OR: [
        { userId, friendId: otherId },
        { userId: otherId, friendId: userId },
      ],
    },
  });
}

export async function getFriends(userId: string) {
  const [out, incoming] = await Promise.all([
    prisma.friendship.findMany({
      where: { userId },
      include: { friend: { select: playerSelect } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.friendship.findMany({
      where: { friendId: userId, status: "pending" },
      include: { user: { select: playerSelect } },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const friends = out.filter((f) => f.status === "accepted").map((f) => asPlayer(f.friend));
  friends.sort((a, b) => a.name.localeCompare(b.name, "fr"));
  return {
    friends,
    incoming: incoming.map((f) => ({
      ...asPlayer(f.user),
      since: f.createdAt.toISOString(),
    })),
    outgoing: out
      .filter((f) => f.status === "pending")
      .map((f) => ({
        ...asPlayer(f.friend),
        since: f.createdAt.toISOString(),
      })),
  };
}

export async function countPendingFriendRequests(userId: string) {
  return prisma.friendship.count({
    where: { friendId: userId, status: "pending" },
  });
}

// ───────── Blocages et signalements ─────────

/** Bloque un joueur : fin de l'amitié, plus de messages, demandes ni défis entre vous. */
export async function blockUser(userId: string, targetId: string) {
  if (userId === targetId) throw new SocialError("self", "Tu ne peux pas te bloquer toi-même.");
  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true },
  });
  if (!target) throw new SocialError("not_found", "Joueur introuvable.");
  await prisma.$transaction([
    prisma.friendship.deleteMany({
      where: {
        OR: [
          { userId, friendId: targetId },
          { userId: targetId, friendId: userId },
        ],
      },
    }),
    prisma.block.upsert({
      where: { userId_blockedId: { userId, blockedId: targetId } },
      create: { userId, blockedId: targetId },
      update: {},
    }),
  ]);
}

export async function unblockUser(userId: string, targetId: string) {
  await prisma.block.deleteMany({ where: { userId, blockedId: targetId } });
}

export async function getBlocked(userId: string): Promise<PlayerRef[]> {
  const rows = await prisma.block.findMany({
    where: { userId },
    include: { blocked: { select: playerSelect } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((b) => asPlayer(b.blocked));
}

export async function reportUser(userId: string, targetId: string, reason: string, details?: string | null, context?: string | null) {
  if (userId === targetId) throw new SocialError("self", "Tu ne peux pas te signaler toi-même.");
  if (!(reason in REPORT_REASONS)) throw new SocialError("invalid", "Choisis un motif.");
  const recent = await prisma.report.count({
    where: {
      reporterId: userId,
      targetId,
      createdAt: { gt: new Date(Date.now() - 60 * 60_000) },
    },
  });
  if (recent > 0) throw new SocialError("already", "Tu as déjà signalé ce joueur récemment, merci !");
  await prisma.report.create({
    data: {
      reporterId: userId,
      targetId,
      reason,
      details: details ? cleanMessage(details, 500) : null,
      context: context?.slice(0, 120) ?? null,
    },
  });
}

// ───────── Messages privés ─────────

async function assertNotFlooding(count: number) {
  if (count >= rules.messageRate.count) throw new SocialError("rate_limited", "Doucement ! Attends quelques secondes avant d'envoyer un autre message.");
}

export interface ChatMessage {
  id: string;
  body: string;
  createdAt: string;
  author: PlayerRef;
}

export interface DirectMessageView extends ChatMessage {
  recipientId: string;
  readAt: string | null;
}

const dmView = (m: {
  id: string;
  body: string;
  createdAt: Date;
  readAt: Date | null;
  recipientId: string;
  sender: {
    id: string;
    name: string | null;
    handle: string | null;
    image: string | null;
  };
}): DirectMessageView => ({
  id: m.id,
  body: m.body,
  createdAt: m.createdAt.toISOString(),
  readAt: m.readAt?.toISOString() ?? null,
  recipientId: m.recipientId,
  author: asPlayer(m.sender),
});

export async function sendDirectMessage(senderId: string, recipientId: string, body: string, now = new Date()): Promise<DirectMessageView> {
  if (senderId === recipientId) throw new SocialError("self", "Tu ne peux pas t'écrire à toi-même.");
  const text = cleanMessage(String(body ?? ""), rules.messageMaxLength);
  if (!text) throw new SocialError("invalid", `Ton message doit faire entre 1 et ${rules.messageMaxLength} caractères.`);
  const recipient = await prisma.user.findUnique({
    where: { id: recipientId },
    select: { id: true },
  });
  if (!recipient) throw new SocialError("not_found", "Joueur introuvable.");
  if (await isBlockedEitherWay(senderId, recipientId)) throw new SocialError("blocked", "Tu ne peux pas écrire à ce joueur.");
  await assertNotFlooding(
    await prisma.directMessage.count({
      where: {
        senderId,
        createdAt: { gt: new Date(now.getTime() - rules.messageRate.windowMs) },
      },
    }),
  );
  const m = await prisma.directMessage.create({
    data: { senderId, recipientId, body: text, createdAt: now },
    include: { sender: { select: playerSelect } },
  });
  return dmView(m);
}

export interface ConversationSummary {
  other: PlayerRef;
  last: { body: string; createdAt: string; mine: boolean };
  unread: number;
}

/** Conversations du joueur, la plus récente d'abord. */
export async function getConversations(userId: string, take = 50): Promise<ConversationSummary[]> {
  const rows = await prisma.$queryRaw<
    {
      otherId: string;
      body: string;
      createdAt: Date;
      senderId: string;
      unread: bigint;
    }[]
  >`
    WITH mine AS (
      SELECT CASE WHEN "senderId" = ${userId} THEN "recipientId" ELSE "senderId" END AS "otherId", *
      FROM "DirectMessage" WHERE "senderId" = ${userId} OR "recipientId" = ${userId}
    ), last AS (
      SELECT DISTINCT ON ("otherId") "otherId", body, "createdAt", "senderId" FROM mine ORDER BY "otherId", "createdAt" DESC
    )
    SELECT l.*, (SELECT count(*) FROM mine m WHERE m."otherId" = l."otherId" AND m."recipientId" = ${userId} AND m."readAt" IS NULL) AS unread
    FROM last l ORDER BY l."createdAt" DESC LIMIT ${take}`;
  const users = await prisma.user.findMany({
    where: { id: { in: rows.map((r) => r.otherId) } },
    select: playerSelect,
  });
  const byId = new Map(users.map((u) => [u.id, asPlayer(u)]));
  return rows.flatMap((r) => {
    const other = byId.get(r.otherId);
    return other
      ? [
          {
            other,
            last: {
              body: r.body,
              createdAt: r.createdAt.toISOString(),
              mine: r.senderId === userId,
            },
            unread: Number(r.unread),
          },
        ]
      : [];
  });
}

export async function getConversation(userId: string, otherId: string, take = 60, before?: Date): Promise<DirectMessageView[]> {
  const rows = await prisma.directMessage.findMany({
    where: {
      OR: [
        { senderId: userId, recipientId: otherId },
        { senderId: otherId, recipientId: userId },
      ],
      ...(before ? { createdAt: { lt: before } } : {}),
    },
    include: { sender: { select: playerSelect } },
    orderBy: { createdAt: "desc" },
    take,
  });
  return rows.reverse().map(dmView);
}

export async function markConversationRead(userId: string, otherId: string, now = new Date()) {
  const res = await prisma.directMessage.updateMany({
    where: { senderId: otherId, recipientId: userId, readAt: null },
    data: { readAt: now },
  });
  return res.count;
}

export async function countUnreadMessages(userId: string) {
  return prisma.directMessage.count({
    where: { recipientId: userId, readAt: null },
  });
}

export async function getPlayerRef(userId: string): Promise<PlayerRef | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: playerSelect,
  });
  return u ? asPlayer(u) : null;
}

export async function getPlayerByHandle(handle: string): Promise<PlayerRef | null> {
  const u = await userByHandle(handle);
  return u ? asPlayer(u) : null;
}

// ───────── Guildes ─────────

export interface GuildSummary {
  id: string;
  name: string;
  tag: string;
  description: string | null;
  members: number;
  createdAt: string;
}

export async function createGuild(userId: string, input: { name: string; tag: string; description?: string | null }) {
  const name = input.name.trim().replace(/\s+/g, " ");
  const err = guildError(name, input.tag);
  if (err) throw new SocialError("invalid", err);
  const tag = normalizeGuildTag(input.tag);
  const description = input.description?.trim() ? cleanMessage(input.description, 280) : null;
  try {
    return await withTxRetry(() =>
      prisma.$transaction(async (tx) => {
        await lockUser(tx, userId);
        if (await tx.guildMember.findUnique({ where: { userId } })) throw new SocialError("already", "Tu fais déjà partie d'une guilde.");
        const guild = await tx.guild.create({
          data: { name, tag, description, ownerId: userId },
        });
        await tx.guildMember.create({
          data: { guildId: guild.id, userId, role: "owner" },
        });
        try {
          await applyLedger(tx, {
            userId,
            delta: -rules.guildCreationCost,
            reason: "guild_create",
            refType: "guild",
            refId: guild.id,
            meta: { name, tag },
          });
        } catch (e) {
          if (e instanceof Error && e.name === "InsufficientFundsError") {
            throw new SocialError("funds", `Créer une guilde coûte ${rules.guildCreationCost} Jetons.`);
          }
          throw e;
        }
        return { id: guild.id, name, tag };
      }),
    );
  } catch (e) {
    if ((e as { code?: string }).code === "P2002" || /Guild_(tag|name)_lower_key/.test(String((e as Error).message))) {
      throw new SocialError("taken", "Ce nom ou ce sigle est déjà pris.");
    }
    throw e;
  }
}

export async function listGuilds(q = "", take = 30): Promise<GuildSummary[]> {
  const query = q.trim();
  const rows = await prisma.guild.findMany({
    where: query
      ? {
          OR: [{ name: { contains: query, mode: "insensitive" } }, { tag: { contains: query, mode: "insensitive" } }],
        }
      : {},
    include: { _count: { select: { members: true } } },
    orderBy: [{ members: { _count: "desc" } }, { createdAt: "asc" }],
    take,
  });
  return rows.map((g) => ({
    id: g.id,
    name: g.name,
    tag: g.tag,
    description: g.description,
    members: g._count.members,
    createdAt: g.createdAt.toISOString(),
  }));
}

export async function getMyGuildId(userId: string): Promise<string | null> {
  const m = await prisma.guildMember.findUnique({
    where: { userId },
    select: { guildId: true },
  });
  return m?.guildId ?? null;
}

export async function getGuild(guildId: string) {
  const g = await prisma.guild.findUnique({
    where: { id: guildId },
    include: {
      members: {
        include: { user: { select: playerSelect } },
        orderBy: { joinedAt: "asc" },
      },
    },
  });
  if (!g) return null;
  const ids = g.members.map((m) => m.userId);
  const cards = ids.length
    ? await prisma.$queryRaw<{ ownerId: string; n: bigint }[]>`
        SELECT "ownerId", count(DISTINCT "cardId") AS n FROM "CardCopy" WHERE "ownerId" = ANY(${ids}::text[]) GROUP BY "ownerId"`
    : [];
  const byOwner = new Map(cards.map((c) => [c.ownerId, Number(c.n)]));
  const order: Record<GuildRole, number> = { owner: 0, officer: 1, member: 2 };
  const members = g.members
    .map((m) => ({
      ...asPlayer(m.user),
      role: m.role,
      joinedAt: m.joinedAt.toISOString(),
      distinctCards: byOwner.get(m.userId) ?? 0,
    }))
    .sort((a, b) => order[a.role] - order[b.role] || b.distinctCards - a.distinctCards);
  return {
    id: g.id,
    name: g.name,
    tag: g.tag,
    description: g.description,
    createdAt: g.createdAt.toISOString(),
    members,
    totalCards: members.reduce((s, m) => s + m.distinctCards, 0),
    maxMembers: rules.guildMaxMembers,
  };
}

export type GuildView = NonNullable<Awaited<ReturnType<typeof getGuild>>>;

export async function joinGuild(userId: string, guildId: string) {
  return withTxRetry(() =>
    prisma.$transaction(async (tx) => {
      await lockUser(tx, userId);
      const [guild] = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Guild" WHERE id = ${guildId} FOR UPDATE`;
      if (!guild) throw new SocialError("not_found", "Cette guilde n'existe plus.");
      if (await tx.guildMember.findUnique({ where: { userId } })) throw new SocialError("already", "Quitte d'abord ta guilde actuelle.");
      const count = await tx.guildMember.count({ where: { guildId } });
      if (count >= rules.guildMaxMembers) throw new SocialError("full", `Cette guilde est complète (${rules.guildMaxMembers} membres).`);
      await tx.guildMember.create({
        data: { guildId, userId, role: "member" },
      });
    }),
  );
}

/** Quitte sa guilde. Le chef passe la main au plus ancien officier (sinon membre) ; seul, la guilde est dissoute. */
export async function leaveGuild(userId: string) {
  return withTxRetry(() =>
    prisma.$transaction(async (tx) => {
      const me = await tx.guildMember.findUnique({ where: { userId } });
      if (!me) throw new SocialError("not_found", "Tu n'es dans aucune guilde.");
      await tx.$queryRaw`SELECT id FROM "Guild" WHERE id = ${me.guildId} FOR UPDATE`;
      await tx.guildMember.delete({ where: { userId } });
      if (me.role !== "owner") return { dissolved: false, guildId: me.guildId };
      const heir = await tx.guildMember.findFirst({
        where: { guildId: me.guildId },
        orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
      });
      if (!heir) {
        await tx.guild.delete({ where: { id: me.guildId } });
        return { dissolved: true, guildId: me.guildId };
      }
      await tx.guildMember.update({
        where: { userId: heir.userId },
        data: { role: "owner" },
      });
      await tx.guild.update({
        where: { id: me.guildId },
        data: { ownerId: heir.userId },
      });
      return { dissolved: false, guildId: me.guildId };
    }),
  );
}

/** Gestion des membres : le chef nomme et révoque les officiers ; chef et officiers excluent les membres. */
export async function manageGuildMember(actorId: string, targetId: string, action: "promote" | "demote" | "kick" | "transfer") {
  if (actorId === targetId) throw new SocialError("self", "Action impossible sur toi-même.");
  return prisma.$transaction(async (tx) => {
    const actor = await tx.guildMember.findUnique({
      where: { userId: actorId },
    });
    const target = await tx.guildMember.findUnique({
      where: { userId: targetId },
    });
    if (!actor || !target || actor.guildId !== target.guildId) throw new SocialError("not_found", "Ce joueur n'est pas dans ta guilde.");
    const isOwner = actor.role === "owner";
    if (action === "kick") {
      if (!(isOwner || (actor.role === "officer" && target.role === "member"))) throw new SocialError("forbidden", "Tu n'as pas le droit d'exclure ce membre.");
      await tx.guildMember.delete({ where: { userId: targetId } });
    } else {
      if (!isOwner) throw new SocialError("forbidden", "Seul le chef de guilde peut faire ça.");
      if (action === "transfer") {
        await tx.guildMember.update({
          where: { userId: actorId },
          data: { role: "officer" },
        });
        await tx.guildMember.update({
          where: { userId: targetId },
          data: { role: "owner" },
        });
        await tx.guild.update({
          where: { id: actor.guildId },
          data: { ownerId: targetId },
        });
      } else {
        await tx.guildMember.update({
          where: { userId: targetId },
          data: { role: action === "promote" ? "officer" : "member" },
        });
      }
    }
    return { guildId: actor.guildId };
  });
}

export async function updateGuildDescription(actorId: string, description: string | null) {
  const me = await prisma.guildMember.findUnique({
    where: { userId: actorId },
  });
  if (!me || me.role === "member") throw new SocialError("forbidden", "Seuls le chef et les officiers peuvent modifier la description.");
  const text = description?.trim() ? cleanMessage(description, 280) : null;
  if (description?.trim() && !text) throw new SocialError("invalid", "La description fait au plus 280 caractères.");
  await prisma.guild.update({
    where: { id: me.guildId },
    data: { description: text },
  });
}

export async function sendGuildMessage(userId: string, body: string, now = new Date()): Promise<ChatMessage & { guildId: string }> {
  const me = await prisma.guildMember.findUnique({
    where: { userId },
    select: { guildId: true },
  });
  if (!me) throw new SocialError("forbidden", "Rejoins une guilde pour discuter avec elle.");
  const text = cleanMessage(String(body ?? ""), rules.messageMaxLength);
  if (!text) throw new SocialError("invalid", `Ton message doit faire entre 1 et ${rules.messageMaxLength} caractères.`);
  await assertNotFlooding(
    await prisma.guildMessage.count({
      where: {
        guildId: me.guildId,
        userId,
        createdAt: { gt: new Date(now.getTime() - rules.messageRate.windowMs) },
      },
    }),
  );
  const m = await prisma.guildMessage.create({
    data: { guildId: me.guildId, userId, body: text, createdAt: now },
    include: { user: { select: playerSelect } },
  });
  return {
    id: m.id,
    guildId: m.guildId,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
    author: asPlayer(m.user),
  };
}

export async function getGuildMessages(guildId: string, take = 60): Promise<ChatMessage[]> {
  const rows = await prisma.guildMessage.findMany({
    where: { guildId },
    include: { user: { select: playerSelect } },
    orderBy: { createdAt: "desc" },
    take,
  });
  return rows.reverse().map((m) => ({
    id: m.id,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
    author: asPlayer(m.user),
  }));
}

// ───────── Classements ─────────

export const LEADERBOARD_KINDS = ["collection", "sets", "market"] as const;
export type LeaderboardKind = (typeof LEADERBOARD_KINDS)[number];

export interface LeaderboardEntry extends PlayerRef {
  rank: number;
  value: number;
}

async function computeLeaderboard(kind: LeaderboardKind, take: number) {
  const rows =
    kind === "collection"
      ? await prisma.$queryRaw<{ userId: string; value: bigint }[]>`
          SELECT "ownerId" AS "userId", count(DISTINCT "cardId") AS value FROM "CardCopy"
          GROUP BY "ownerId" ORDER BY value DESC LIMIT ${take}`
      : kind === "sets"
        ? await prisma.$queryRaw<{ userId: string; value: bigint }[]>`
            SELECT "userId", count(*) AS value FROM "SetCompletion" GROUP BY "userId" ORDER BY value DESC LIMIT ${take}`
        : await prisma.$queryRaw<{ userId: string; value: bigint }[]>`
            SELECT "sellerId" AS "userId", count(*) AS value FROM "Sale" GROUP BY "sellerId" ORDER BY value DESC LIMIT ${take}`;
  const users = await prisma.user.findMany({
    where: { id: { in: rows.map((r) => r.userId) } },
    select: playerSelect,
  });
  const byId = new Map(users.map((u) => [u.id, asPlayer(u)]));
  const entries = rows.flatMap((r) => {
    const p = byId.get(r.userId);
    return p && Number(r.value) > 0 ? [{ ...p, value: Number(r.value) }] : [];
  });
  return rankEntries(entries).map(({ rank, entry }) => ({ ...entry, rank }));
}

/** Fige les classements (tâche horaire du serveur temps réel) et garde deux jours d'historique. */
export async function takeLeaderboardSnapshots(now = new Date()) {
  for (const kind of LEADERBOARD_KINDS) {
    const entries = await computeLeaderboard(kind, rules.leaderboardSize);
    await prisma.leaderboardSnapshot.create({
      data: {
        kind,
        takenAt: now,
        entries: entries as unknown as Prisma.InputJsonArray,
      },
    });
    await prisma.leaderboardSnapshot.deleteMany({
      where: {
        kind,
        takenAt: { lt: new Date(now.getTime() - 48 * 60 * 60_000) },
      },
    });
  }
}

/** Dernier classement figé ; s'il n'y en a pas encore (première installation), on le calcule et on le fige. */
export async function getLeaderboard(kind: LeaderboardKind): Promise<{ takenAt: string; entries: LeaderboardEntry[] }> {
  let snap = await prisma.leaderboardSnapshot.findFirst({
    where: { kind },
    orderBy: { takenAt: "desc" },
  });
  if (!snap) {
    const entries = await computeLeaderboard(kind, rules.leaderboardSize);
    snap = await prisma.leaderboardSnapshot.create({
      data: { kind, entries: entries as unknown as Prisma.InputJsonArray },
    });
  }
  // Rang et score figés, mais pseudo et avatar à jour (et les comptes supprimés disparaissent).
  const frozen = snap.entries as unknown as LeaderboardEntry[];
  const users = await prisma.user.findMany({ where: { id: { in: frozen.map((e) => e.id) } }, select: playerSelect });
  const byId = new Map(users.map((u) => [u.id, asPlayer(u)]));
  const entries = frozen.flatMap((e) => {
    const p = byId.get(e.id);
    return p ? [{ ...p, rank: e.rank, value: e.value }] : [];
  });
  return { takenAt: snap.takenAt.toISOString(), entries };
}

/** Dernier instantané, toutes catégories confondues : sert à la tâche horaire pour savoir s'il faut rafraîchir. */
export async function lastLeaderboardAt(): Promise<Date | null> {
  const s = await prisma.leaderboardSnapshot.findFirst({
    orderBy: { takenAt: "desc" },
    select: { takenAt: true },
  });
  return s?.takenAt ?? null;
}
