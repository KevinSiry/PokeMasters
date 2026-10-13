import { prisma } from "@pokeflex/db";
import type { MetadataRoute } from "next";

const base = process.env.APP_URL ?? "http://localhost:3000";

// Lu en base à chaque demande : le catalogue grossit avec chaque synchronisation (rien à générer au build).
export const dynamic = "force-dynamic";

/** Pages publiques, sets et fiches de carte (environ 21 000 URL, sous la limite de 50 000 par fichier). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [sets, cards] = await Promise.all([
    prisma.set.findMany({ select: { id: true, syncedAt: true } }),
    prisma.card.findMany({ select: { id: true, syncedAt: true } }),
  ]);
  const pages: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/catalogue`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/marche`, changeFrequency: "hourly", priority: 0.7 },
    { url: `${base}/classements`, changeFrequency: "hourly", priority: 0.6 },
    { url: `${base}/guildes`, changeFrequency: "daily", priority: 0.5 },
    { url: `${base}/a-propos`, changeFrequency: "monthly", priority: 0.4 },
  ];
  return [
    ...pages,
    ...sets.map((s) => ({ url: `${base}/catalogue/${s.id}`, lastModified: s.syncedAt, changeFrequency: "monthly" as const, priority: 0.8 })),
    ...cards.map((c) => ({ url: `${base}/cartes/${c.id}`, lastModified: c.syncedAt, changeFrequency: "monthly" as const, priority: 0.5 })),
  ];
}
