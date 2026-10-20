import { randomBytes } from "node:crypto";
import { prisma } from "@pokeflex/db";
import { NextResponse, type NextRequest } from "next/server";
import { devLoginEnabled } from "@/lib/env";
import { safeInternalPath } from "@/lib/params";

const SESSION_DAYS = 30;

/**
 * Connexion de développement : ouvre une session Auth.js pour un compte de démo,
 * sans passer par Twitch ou Discord. Désactivée en production (voir lib/env.ts).
 */
export async function POST(req: NextRequest) {
  if (!devLoginEnabled) return new NextResponse("Not found", { status: 404 });

  const form = await req.formData();
  const handle = String(form.get("handle") ?? "");
  const user = await prisma.user.findUnique({ where: { handle } });
  if (!user) return new NextResponse("Compte de démo inconnu : lance `npm run db:seed`.", { status: 400 });

  const sessionToken = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.session.create({ data: { sessionToken, userId: user.id, expires } });

  const target = safeInternalPath(String(form.get("suite") ?? "/"));
  const res = NextResponse.redirect(new URL(target, req.url), { status: 303 });
  res.cookies.set("authjs.session-token", sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: false,
    expires,
  });
  return res;
}
