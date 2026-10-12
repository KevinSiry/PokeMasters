/**
 * Serveur temps réel PokeFlex : connexion authentifiée, duels quiz (phase 6),
 * messages privés et chat de guilde (phase 7), tâches de fond.
 */
import { createServer } from "node:http";
import { gameConfig } from "@pokeflex/config";
import { prisma } from "@pokeflex/db";
import { RateLimiter } from "@pokeflex/game";
import {
  abortActiveDuels,
  assertStakeable,
  createQuickDuel,
  DuelError,
  expireDuels,
  finishDuel,
  getDuelParticipants,
  getMyGuildId,
  markConversationRead,
  relationBetween,
  sendDirectMessage,
  sendGuildMessage,
  SocialError,
  startDuel,
} from "@pokeflex/server";
import { Server } from "socket.io";
import { resolveUserId, type SessionLookup } from "./auth";
import { DuelEngine } from "./duel-engine";
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
    res.end(JSON.stringify({ ok: true, connected: io.engine.clientsCount, duels: engine.activeCount, queue: engine.queueSize }));
    return;
  }
  res.writeHead(404).end();
});

interface SocketData {
  userId: string;
}

type Ack = (res: { ok: true; data?: unknown } | { ok: false; error: string }) => void;

interface ClientEvents {
  "duel:join": (duelId: string, ack: Ack) => void;
  "duel:leave": (duelId: string) => void;
  "duel:answer": (p: { duelId: string; index: number; choice: number }, ack: Ack) => void;
  "duel:forfeit": (duelId: string, ack: Ack) => void;
  /** Prévient l'autre joueur qu'un défi a été lancé, accepté, refusé ou annulé (vérifié en base). */
  "duel:ping": (duelId: string) => void;
  "queue:join": (p: { copyIds: string[] }, ack: Ack) => void;
  "queue:leave": () => void;
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
}

const io = new Server<ClientEvents, Record<string, (...args: never[]) => void>, Record<string, never>, SocketData>(httpServer, {
  cors: { origin: webOrigin, credentials: true },
});

const engine = new DuelEngine(
  {
    participants: getDuelParticipants,
    start: (id) => startDuel(id),
    finish: (id, input) => finishDuel(id, input),
    expire: async () => {
      await expireDuels();
    },
    assertStakeable,
    createQuick: (a, b) => createQuickDuel(a, b),
  },
  {
    toUser: (userId, event, payload) => io.to(`user:${userId}`).emit(event, payload as never),
    toDuel: (duelId, event, payload) => io.to(`duel:${duelId}`).emit(event, payload as never),
  },
);

const errorMessage = (err: unknown) =>
  err instanceof DuelError || err instanceof SocialError || err instanceof Error ? err.message : "Une erreur est survenue, réessaie.";

// Premier filet anti-spam en mémoire (la base applique la même règle, pour tous les serveurs).
const chatLimiter = new RateLimiter(gameConfig.social.messageRate.count, gameConfig.social.messageRate.windowMs);
const tooFast = "Doucement ! Attends quelques secondes avant d'envoyer un autre message.";

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
  const joined = new Set<string>();

  socket.on("duel:join", async (duelId, ack) => {
    try {
      if (typeof duelId !== "string") throw new Error("Duel inconnu.");
      // L'état renvoyé couvre ce qui a pu être émis avant l'entrée dans la room.
      const state = await engine.join(userId, duelId);
      await socket.join(`duel:${duelId}`);
      if ("you" in state) joined.add(duelId);
      ack?.({ ok: true, data: state });
    } catch (err) {
      ack?.({ ok: false, error: errorMessage(err) });
    }
  });

  socket.on("duel:leave", (duelId) => {
    if (!joined.delete(duelId)) return;
    void socket.leave(`duel:${duelId}`);
    engine.leave(userId, duelId);
  });

  socket.on("duel:answer", (p, ack) => {
    const res = engine.answer(userId, p?.duelId, Number(p?.index), Number(p?.choice));
    ack?.(res.ok ? { ok: true } : { ok: false, error: res.reason === "late" ? "Trop tard !" : "Réponse refusée." });
  });

  socket.on("duel:forfeit", async (duelId, ack) => {
    try {
      ack?.({ ok: await engine.forfeit(userId, duelId) } as { ok: true });
    } catch (err) {
      ack?.({ ok: false, error: errorMessage(err) });
    }
  });

  socket.on("duel:ping", async (duelId) => {
    const d = await getDuelParticipants(String(duelId)).catch(() => null);
    if (!d || (d.playerAId !== userId && d.playerBId !== userId)) return;
    const other = d.playerAId === userId ? d.playerBId : d.playerAId;
    if (other) io.to(`user:${other}`).emit("duel:update", { duelId: d.id, status: d.status, from: userId } as never);
  });

  socket.on("queue:join", async (p, ack) => {
    try {
      const res = await engine.enqueue(userId, socket.id, Array.isArray(p?.copyIds) ? p.copyIds.map(String) : []);
      ack?.({ ok: true, data: res });
    } catch (err) {
      ack?.({ ok: false, error: errorMessage(err) });
    }
  });

  socket.on("queue:leave", () => engine.dequeue(userId, socket.id));

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

  socket.on("disconnect", () => {
    engine.dequeue(userId, socket.id);
    for (const duelId of joined) engine.leave(userId, duelId);
    joined.clear();
  });
});

// Un redémarrage perd les duels en cours : on les annule et on rend les cartes misées.
void abortActiveDuels().then((n) => {
  if (n > 0) console.log(`[duels] ${n} duel(s) interrompu(s) par le redémarrage, cartes rendues`);
});

const stopJobs = startJobs((expired) => {
  for (const d of expired) {
    for (const id of [d.playerAId, d.playerBId]) if (id) io.to(`user:${id}`).emit("duel:update", { duelId: d.id, status: d.status } as never);
  }
});

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
