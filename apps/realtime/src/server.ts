/**
 * Serveur temps réel PokeFlex : connexion authentifiée, messages privés et chat de guilde, échanges,
 * tâches de fond (enchères, catalogue, classements).
 */
import { createServer } from "node:http";
import { gameConfig } from "@pokeflex/config";
import { prisma } from "@pokeflex/db";
import { RateLimiter } from "@pokeflex/game";
import {
  getMyGuildId,
  markConversationRead,
  relationBetween,
  sendDirectMessage,
  sendGuildMessage,
  SocialError,
  tradeNoticeFor,
  wishlistAlertForListing,
} from "@pokeflex/server";
import { Server } from "socket.io";
import { resolveUserId, type SessionLookup } from "./auth";
import { startJobs } from "./jobs";

const port = Number(process.env.REALTIME_PORT ?? 3001);
const webOrigin = process.env.APP_URL ?? "http://localhost:3000";

const sessions: SessionLookup = {
  findSession: (token) =>
    prisma.session.findUnique({
      where: { sessionToken: token },
      select: { userId: true, expires: true },
    }),
};

const httpServer = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, connected: io.engine.clientsCount }));
    return;
  }
  res.writeHead(404).end();
});

interface SocketData {
  userId: string;
}

type Ack = (res: { ok: true; data?: unknown } | { ok: false; error: string }) => void;

interface ClientEvents {
  /** Message privé : enregistré en base puis poussé au destinataire et aux autres onglets de l'expéditeur. */
  "dm:send": (p: { to: string; body: string }, ack: Ack) => void;
  "dm:read": (p: { with: string }) => void;
  /** Ouvre le chat de sa guilde (vérifié en base). */
  "guild:open": (_: unknown, ack: Ack) => void;
  "guild:close": () => void;
  "guild:send": (p: { body: string }, ack: Ack) => void;
  /** Après un changement dans la guilde : rafraîchit les membres, et retire du chat le joueur visé s'il n'en fait plus partie (vérifié en base). */
  "guild:sync": (p: { userId: string; guildId: string }) => void;
  /** Prévient un joueur d'une demande d'ami ou d'une acceptation (vérifié en base). */
  "social:ping": (p: { to: string }) => void;
  /** Après une mise en vente : prévient les joueurs qui ont cette carte dans leur wishlist (vérifié en base). */
  "market:listed": (p: { listingId: string }) => void;
  /** Après une action sur un échange : prévient l'autre joueur (vérifié en base). */
  "trade:ping": (p: { tradeId: string }) => void;
}

const io = new Server<ClientEvents, Record<string, (...args: never[]) => void>, Record<string, never>, SocketData>(httpServer, {
  cors: { origin: webOrigin, credentials: true },
});

const errorMessage = (err: unknown) =>
  err instanceof SocialError || err instanceof Error ? err.message : "Une erreur est survenue, réessaie.";

// Premier filet anti-spam en mémoire (la base applique la même règle, pour tous les serveurs).
const chatLimiter = new RateLimiter(gameConfig.social.messageRate.count, gameConfig.social.messageRate.windowMs);
const tooFast = "Doucement ! Attends quelques secondes avant d'envoyer un autre message.";

// Une annonce (ou une action d'échange) ne déclenche qu'une alerte, même si l'événement est renvoyé.
const alerted = new Set<string>();
function markAlerted(listingId: string): boolean {
  if (alerted.has(listingId)) return false;
  alerted.add(listingId);
  if (alerted.size > 5000) alerted.delete(alerted.values().next().value!);
  return true;
}

// Toute connexion doit porter une session Auth.js valide.
io.use(async (socket, next) => {
  try {
    const userId = await resolveUserId(socket.handshake.headers.cookie, sessions);
    if (!userId) return next(new Error("unauthorized"));
    socket.data.userId = userId;
    next();
  } catch (err) {
    next(err instanceof Error ? err : new Error("auth_failed"));
  }
});

io.on("connection", (socket) => {
  const userId = socket.data.userId;
  // Une room par joueur : on peut lui pousser des événements, quel que soit l'onglet.
  void socket.join(`user:${userId}`);
  socket.emit("hello", { userId } as never);

  // ───── Messages privés ─────
  socket.on("dm:send", async (p, ack) => {
    try {
      if (!chatLimiter.take(`dm:${userId}`, Date.now())) throw new Error(tooFast);
      const msg = await sendDirectMessage(userId, String(p?.to ?? ""), String(p?.body ?? ""));
      io.to(`user:${msg.recipientId}`).to(`user:${userId}`).emit("dm:new", msg as never);
      ack?.({ ok: true, data: msg });
    } catch (err) {
      ack?.({ ok: false, error: errorMessage(err) });
    }
  });

  socket.on("dm:read", async (p) => {
    const other = String(p?.with ?? "");
    const n = await markConversationRead(userId, other).catch(() => 0);
    if (n > 0) {
      io.to(`user:${userId}`).emit("dm:read", { by: userId, with: other } as never);
      io.to(`user:${other}`).emit("dm:read", { by: userId, with: userId } as never);
    }
  });

  // ───── Chat de guilde ─────
  let guildRoom: string | null = null;
  socket.on("guild:open", async (_, ack) => {
    try {
      const guildId = await getMyGuildId(userId);
      if (!guildId) throw new Error("Tu n'es dans aucune guilde.");
      if (guildRoom && guildRoom !== `guild:${guildId}`) await socket.leave(guildRoom);
      guildRoom = `guild:${guildId}`;
      await socket.join(guildRoom);
      ack?.({ ok: true, data: { guildId } });
    } catch (err) {
      ack?.({ ok: false, error: errorMessage(err) });
    }
  });

  socket.on("guild:close", () => {
    if (guildRoom) void socket.leave(guildRoom);
    guildRoom = null;
  });

  socket.on("guild:send", async (p, ack) => {
    try {
      if (!chatLimiter.take(`guild:${userId}`, Date.now())) throw new Error(tooFast);
      const msg = await sendGuildMessage(userId, String(p?.body ?? ""));
      io.to(`guild:${msg.guildId}`).emit("guild:message", msg as never);
      ack?.({ ok: true, data: msg });
    } catch (err) {
      ack?.({ ok: false, error: errorMessage(err) });
    }
  });

  socket.on("guild:sync", async (p) => {
    const target = String(p?.userId ?? "");
    const guildId = String(p?.guildId ?? "");
    const [mine, theirs] = await Promise.all([getMyGuildId(userId), getMyGuildId(target)]).catch(() => [null, null]);
    // Seul un membre (ou l'ancien membre lui-même) peut demander la mise à jour.
    if (mine !== guildId && target !== userId) return;
    // Toujours membre (arrivée, changement de rôle) : les autres rafraîchissent la liste.
    if (theirs === guildId) {
      io.to(`guild:${guildId}`).emit("guild:members", { guildId } as never);
      return;
    }
    io.in(`user:${target}`).socketsLeave(`guild:${guildId}`);
    io.to(`user:${target}`).emit("guild:removed", { guildId, kicked: target !== userId } as never);
    io.to(`guild:${guildId}`).emit("guild:members", { guildId } as never);
  });

  socket.on("social:ping", async (p) => {
    const to = String(p?.to ?? "");
    const relation = await relationBetween(userId, to).catch(() => null);
    if (relation === "request_sent" || relation === "friends") {
      io.to(`user:${to}`).emit("social:update", { kind: relation === "friends" ? "friend_accepted" : "friend_request", from: userId } as never);
    }
  });

  socket.on("trade:ping", async (p) => {
    const tradeId = String(p?.tradeId ?? "");
    if (!tradeId) return;
    const notice = await tradeNoticeFor(userId, tradeId).catch(() => null);
    if (!notice || !markAlerted(`trade:${tradeId}:${notice.payload.kind}`)) return;
    io.to(`user:${notice.to}`).emit("trade:update", notice.payload as never);
  });

  socket.on("market:listed", async (p) => {
    const listingId = String(p?.listingId ?? "");
    if (!listingId || alerted.has(listingId)) return;
    const alert = await wishlistAlertForListing(userId, listingId).catch(() => null);
    if (!alert || !markAlerted(listingId)) return;
    for (const to of alert.recipients) io.to(`user:${to}`).emit("wishlist:listed", alert.listing as never);
  });
});

const stopJobs = startJobs();

httpServer.listen(port, () => {
  console.log(`[realtime] prêt sur http://localhost:${port} (origine autorisée : ${webOrigin})`);
});

const shutdown = async () => {
  stopJobs();
  await io.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
