/**
 * Serveur temps réel PokeFlex.
 *
 * Phase 1 : socle uniquement (connexion authentifiée, présence, point de santé).
 * Les duels (phase 6) et la messagerie (phase 7) s'y brancheront.
 */
import { createServer } from "node:http";
import { prisma } from "@pokeflex/db";
import { Server } from "socket.io";
import { resolveUserId, type SessionLookup } from "./auth";

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

const io = new Server<Record<string, never>, { hello: (p: { userId: string }) => void }, Record<string, never>, SocketData>(
  httpServer,
  {
    cors: { origin: webOrigin, credentials: true },
  },
);

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
  // Une room par joueur : permettra de lui pousser des événements depuis n'importe quel onglet.
  void socket.join(`user:${socket.data.userId}`);
  socket.emit("hello", { userId: socket.data.userId });
});

httpServer.listen(port, () => {
  console.log(`[realtime] prêt sur http://localhost:${port} (origine autorisée : ${webOrigin})`);
});

const shutdown = async () => {
  await io.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
