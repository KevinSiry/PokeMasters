/**
 * Serveur temps réel PokeFlex : connexion authentifiée, duels quiz (phase 6) et tâches de fond.
 * La messagerie (phase 7) s'y branchera.
 */
import { createServer } from "node:http";
import { prisma } from "@pokeflex/db";
import {
  abortActiveDuels,
  assertStakeable,
  createQuickDuel,
  DuelError,
  expireDuels,
  finishDuel,
  getDuelParticipants,
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
  err instanceof DuelError || err instanceof Error ? err.message : "Une erreur est survenue, réessaie.";

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
