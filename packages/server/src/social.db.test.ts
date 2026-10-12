/**
 * Tests d'intégration du social sur Postgres. Ignorés si SKIP_DB_TESTS=1.
 */
import { gameConfig } from "@pokeflex/config";
import { auditLedger, prisma } from "@pokeflex/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  blockUser,
  createGuild,
  ensureHandle,
  getConversation,
  getConversations,
  getFriends,
  getGuild,
  getLeaderboard,
  getPublicProfile,
  joinGuild,
  leaveGuild,
  manageGuildMember,
  markConversationRead,
  relationBetween,
  reportUser,
  respondFriendRequest,
  sendDirectMessage,
  sendFriendRequest,
  sendGuildMessage,
  setShowcase,
  SocialError,
  takeLeaderboardSnapshots,
  unblockUser,
  updateProfile,
} from "./social";

const skip = process.env.SKIP_DB_TESTS === "1";
const users: string[] = [];
let cardIds: string[] = [];

async function newUser(balance = 0, name = "Test") {
  const handle = `t-soc-${Math.random().toString(36).slice(2, 10)}`;
  const u = await prisma.user.create({
    data: { handle, name, boosterStock: 0, boosterAnchorAt: new Date() },
  });
  users.push(u.id);
  if (balance > 0) {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: u.id }, data: { balance } });
      await tx.ledgerEntry.create({
        data: {
          userId: u.id,
          delta: balance,
          balanceAfter: balance,
          reason: "admin",
        },
      });
    });
  }
  return { id: u.id, handle };
}

const code = async (p: Promise<unknown>) => {
  try {
    await p;
    return null;
  } catch (e) {
    return e instanceof SocialError || (e as { code?: string }).code ? (e as { code: string }).code : String(e);
  }
};

describe.skipIf(skip)("social (Postgres)", () => {
  beforeAll(async () => {
    cardIds = (
      await prisma.card.findMany({
        where: { droppable: true, image: { not: null } },
        orderBy: { id: "asc" },
        take: 8,
        select: { id: true },
      })
    ).map((c) => c.id);
  });
  afterAll(async () => {
    await prisma.guild.deleteMany({ where: { ownerId: { in: users } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
  });

  it("génère un pseudo libre pour un nouveau compte", async () => {
    const a = await prisma.user.create({
      data: { name: "Ondine Azur", boosterAnchorAt: new Date() },
    });
    const b = await prisma.user.create({
      data: { name: "Ondine Azur", boosterAnchorAt: new Date() },
    });
    users.push(a.id, b.id);
    await prisma.user.updateMany({
      where: {
        handle: { in: ["ondine-azur", "ondine-azur-2"] },
        id: { notIn: [a.id, b.id] },
      },
      data: { handle: null },
    });
    const ha = await ensureHandle(a.id);
    const hb = await ensureHandle(b.id);
    expect(ha).toBe("ondine-azur");
    expect(hb).toBe("ondine-azur-2");
    expect(await ensureHandle(a.id)).toBe(ha);
  });

  it("modifie le profil et la vitrine", async () => {
    const a = await newUser();
    const b = await newUser();
    expect(await code(updateProfile(a.id, { handle: b.handle }))).toBe("taken");
    expect(await code(updateProfile(a.id, { handle: "A!" }))).toBe("invalid");
    await updateProfile(a.id, { bio: "  Fan de Salamèche  " });
    expect(await code(setShowcase(a.id, [cardIds[0]!]))).toBe("invalid");
    await prisma.cardCopy.createMany({
      data: cardIds.slice(0, 2).map((cardId) => ({ ownerId: a.id, cardId, obtainedVia: "test" })),
    });
    await setShowcase(a.id, [cardIds[1]!, cardIds[0]!]);
    const p = await getPublicProfile(a.handle, b.id);
    expect(p?.bio).toBe("Fan de Salamèche");
    expect(p?.showcase.map((c) => c.id)).toEqual([cardIds[1], cardIds[0]]);
    expect(p?.stats.distinctCards).toBe(2);
    expect(p?.relation).toBe("none");
  });

  it("demande, accepte et retire un ami", async () => {
    const a = await newUser();
    const b = await newUser();
    expect((await sendFriendRequest(a.id, b.handle)).status).toBe("pending");
    expect(await code(sendFriendRequest(a.id, b.handle))).toBe("already");
    expect(await relationBetween(b.id, a.id)).toBe("request_received");
    expect((await getFriends(b.id)).incoming.map((f) => f.id)).toEqual([a.id]);
    await respondFriendRequest(b.id, a.id, true);
    expect(await relationBetween(a.id, b.id)).toBe("friends");
    expect((await getFriends(a.id)).friends.map((f) => f.id)).toEqual([b.id]);
    // Demande croisée : acceptée directement.
    const c = await newUser();
    await sendFriendRequest(c.id, a.handle);
    expect((await sendFriendRequest(a.id, c.handle)).status).toBe("accepted");
  });

  it("bloque : plus d'amitié, de messages ni de défis", async () => {
    const a = await newUser();
    const b = await newUser();
    await sendFriendRequest(a.id, b.handle);
    await respondFriendRequest(b.id, a.id, true);
    await blockUser(b.id, a.id);
    expect(await relationBetween(b.id, a.id)).toBe("blocked");
    expect(await relationBetween(a.id, b.id)).toBe("blocked_by");
    expect((await getFriends(a.id)).friends).toHaveLength(0);
    expect(await code(sendDirectMessage(a.id, b.id, "coucou"))).toBe("blocked");
    expect(await code(sendFriendRequest(a.id, b.handle))).toBe("blocked");
    await reportUser(b.id, a.id, "insult", "pas sympa");
    expect(await code(reportUser(b.id, a.id, "insult"))).toBe("already");
    await unblockUser(b.id, a.id);
    await sendDirectMessage(a.id, b.id, "pardon");
  });

  it("échange des messages privés, compte les non-lus et limite le débit", async () => {
    const a = await newUser();
    const b = await newUser();
    const t0 = new Date("2026-10-12T12:00:00Z");
    await sendDirectMessage(a.id, b.id, "salut", t0);
    await sendDirectMessage(b.id, a.id, "yo", new Date(t0.getTime() + 1000));
    await sendDirectMessage(a.id, b.id, "un échange ?", new Date(t0.getTime() + 2000));
    expect((await getConversation(b.id, a.id)).map((m) => m.body)).toEqual(["salut", "yo", "un échange ?"]);
    const [conv] = await getConversations(b.id);
    expect(conv?.other.id).toBe(a.id);
    expect(conv?.unread).toBe(2);
    expect(conv?.last.body).toBe("un échange ?");
    expect(await markConversationRead(b.id, a.id)).toBe(2);
    expect((await getConversations(b.id))[0]?.unread).toBe(0);
    expect(await code(sendDirectMessage(a.id, b.id, "   "))).toBe("invalid");
    const now = new Date();
    for (let i = 0; i < gameConfig.social.messageRate.count; i++) await sendDirectMessage(a.id, b.id, `m${i}`, now);
    expect(await code(sendDirectMessage(a.id, b.id, "encore", now))).toBe("rate_limited");
  });

  it("crée une guilde (payante), la rejoint, discute et passe la main", async () => {
    const poor = await newUser(10);
    expect(await code(createGuild(poor.id, { name: "Les Fauchés", tag: "FCH" }))).toBe("funds");
    const owner = await newUser(gameConfig.social.guildCreationCost + 50);
    const tag = `G${Math.random().toString(36).slice(2, 5)}`.toUpperCase();
    const g = await createGuild(owner.id, { name: `Guilde ${tag}`, tag });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: owner.id } })).balance).toBe(50);
    expect(
      await code(
        createGuild((await newUser(5000)).id, {
          name: `guilde ${tag.toLowerCase()}`,
          tag: "ZZZ",
        }),
      ),
    ).toBe("taken");
    const m = await newUser();
    await joinGuild(m.id, g.id);
    expect(await code(joinGuild(m.id, g.id))).toBe("already");
    const msg = await sendGuildMessage(m.id, "Salut la guilde");
    expect(msg.guildId).toBe(g.id);
    expect(await code(manageGuildMember(m.id, owner.id, "kick"))).toBe("forbidden");
    await manageGuildMember(owner.id, m.id, "promote");
    await leaveGuild(owner.id);
    const after = await getGuild(g.id);
    expect(after?.members.map((x) => [x.id, x.role])).toEqual([[m.id, "owner"]]);
    await leaveGuild(m.id);
    expect(await getGuild(g.id)).toBeNull();
    expect((await auditLedger(prisma)).filter((r) => users.includes(r.id))).toEqual([]);
  });

  it("fige les classements", async () => {
    const a = await newUser();
    await prisma.cardCopy.createMany({
      data: cardIds.map((cardId) => ({
        ownerId: a.id,
        cardId,
        obtainedVia: "test",
      })),
    });
    await takeLeaderboardSnapshots();
    const board = await getLeaderboard("collection");
    const me = board.entries.find((e) => e.id === a.id);
    expect(me?.value).toBe(cardIds.length);
    expect(board.entries[0]!.rank).toBe(1);
  });
});
