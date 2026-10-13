import type { MetadataRoute } from "next";

const base = process.env.APP_URL ?? "http://localhost:3000";

/** Pages publiques indexables ; l'espace joueur (collection, messages, Jetons…) reste hors des moteurs. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/connexion", "/boosters", "/collection", "/jetons", "/profil", "/amis", "/messages", "/marche/mes-", "/recherche"],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
