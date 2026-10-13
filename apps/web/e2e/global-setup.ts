/**
 * Prépare des sessions de démo pour les parcours connectés : on crée directement une
 * session Auth.js en base (la connexion de démo est désactivée en production).
 */
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "@pokeflex/db";

export const AUTH_DIR = path.resolve(process.cwd(), "playwright/.auth");
const port = Number(process.env.E2E_PORT ?? 3000);

export default async function globalSetup() {
  mkdirSync(AUTH_DIR, { recursive: true });
  for (const handle of ["demo-dresseur", "demo-collection", "demo-marchand"]) {
    const user = await prisma.user.findUnique({ where: { handle } });
    if (!user) throw new Error(`Compte ${handle} absent : lance npm run db:seed avant les tests e2e.`);
    if (handle === "demo-dresseur") {
      await prisma.user.update({ where: { id: user.id }, data: { boosterStock: 6, boosterAnchorAt: new Date() } });
    }
    if (handle !== "demo-dresseur" && user.balance < 1000) {
      // Les parcours économie et marché dépensent des Jetons : on recharge, inscrit au registre comme tout mouvement.
      await prisma.$transaction(async (tx) => {
        const u = await tx.user.update({ where: { id: user.id }, data: { balance: { increment: 1000 } } });
        await tx.ledgerEntry.create({ data: { userId: user.id, delta: 1000, balanceAfter: u.balance, reason: "admin" } });
      });
    }
    const token = randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await prisma.session.create({ data: { sessionToken: token, userId: user.id, expires } });
    writeFileSync(
      path.join(AUTH_DIR, `${handle}.json`),
      JSON.stringify({
        cookies: [
          { name: "authjs.session-token", value: token, domain: "localhost", path: "/", expires: expires.getTime() / 1000, httpOnly: true, secure: false, sameSite: "Lax" },
        ],
        origins: [],
      }),
    );
  }
  // Parcours social rejouables : amitiés, blocages et messages entre comptes de démo remis à zéro.
  const demo = (await prisma.user.findMany({ where: { handle: { startsWith: "demo-" } }, select: { id: true } })).map((u) => u.id);
  await prisma.$transaction([
    prisma.friendship.deleteMany({ where: { userId: { in: demo }, friendId: { in: demo } } }),
    prisma.block.deleteMany({ where: { userId: { in: demo }, blockedId: { in: demo } } }),
    prisma.directMessage.deleteMany({ where: { senderId: { in: demo }, recipientId: { in: demo } } }),
    // Parcours favoris et wishlist rejouables.
    prisma.favoriteCard.deleteMany({ where: { userId: { in: demo } } }),
    prisma.wishlistCard.deleteMany({ where: { userId: { in: demo } } }),
    // Parcours échanges rejouable.
    prisma.trade.deleteMany({ where: { proposerId: { in: demo }, recipientId: { in: demo } } }),
  ]);
  await prisma.$disconnect();
  void port;
}
