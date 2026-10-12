import { PrismaClient } from "@prisma/client";

export * from "@prisma/client";
export * from "./audit";

// Un seul client par process (le rechargement à chaud de Next.js recréerait sinon des connexions).
const globalForPrisma = globalThis as unknown as { __pokeflexPrisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.__pokeflexPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.__pokeflexPrisma = prisma;
