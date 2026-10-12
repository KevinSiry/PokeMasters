/** Fournisseurs OAuth configurés (identifiants présents dans l'environnement). */
export const configuredProviders = {
  twitch: Boolean(process.env.AUTH_TWITCH_ID && process.env.AUTH_TWITCH_SECRET),
  discord: Boolean(process.env.AUTH_DISCORD_ID && process.env.AUTH_DISCORD_SECRET),
};

/** Le site tourne sur la machine du joueur (npm start ou Docker Compose), pas sur un vrai domaine. */
function isLocalAppUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    return ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

/**
 * Connexion de développement sans OAuth (comptes de démo du seed).
 * Jamais disponible sur un site public, même si la variable est posée par erreur :
 * un build de production ne l'autorise que si APP_URL pointe sur la machine locale.
 */
export const devLoginEnabled =
  process.env.ALLOW_DEV_LOGIN === "true" && (process.env.NODE_ENV !== "production" || isLocalAppUrl(process.env.APP_URL));
