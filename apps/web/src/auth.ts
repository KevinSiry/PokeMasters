import { PrismaAdapter } from "@auth/prisma-adapter";
import { gameConfig } from "@pokeflex/config";
import { prisma } from "@pokeflex/db";
import { ensureHandle } from "@pokeflex/server";
import NextAuth, { type DefaultSession } from "next-auth";
import type { Provider } from "next-auth/providers";
import Discord from "next-auth/providers/discord";
import Twitch from "next-auth/providers/twitch";
import { configuredProviders } from "@/lib/env";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}

const providers: Provider[] = [];
// Les identifiants sont lus automatiquement depuis AUTH_TWITCH_ID / AUTH_TWITCH_SECRET, etc.
if (configuredProviders.twitch) providers.push(Twitch);
if (configuredProviders.discord) providers.push(Discord);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  // Sessions en base : révocables, et lisibles par le serveur temps réel.
  session: { strategy: "database", maxAge: 30 * 24 * 60 * 60 },
  providers,
  pages: { signIn: "/connexion" },
  trustHost: true,
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
  events: {
    // Nouveau joueur : pseudo public, stock de boosters de départ, minuteur démarré maintenant.
    async createUser({ user }) {
      if (!user.id) return;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          boosterStock: gameConfig.boosters.initialStock,
          boosterAnchorAt: new Date(),
          balance: gameConfig.economy.startingBalance,
        },
      });
      await ensureHandle(user.id);
    },
  },
});
