/** Fournisseurs OAuth configurés (identifiants présents dans l'environnement). */
export const configuredProviders = {
  twitch: Boolean(process.env.AUTH_TWITCH_ID && process.env.AUTH_TWITCH_SECRET),
  discord: Boolean(process.env.AUTH_DISCORD_ID && process.env.AUTH_DISCORD_SECRET),
};

/**
 * Connexion de développement sans OAuth (comptes de démo du seed).
 * Jamais disponible en production, même si la variable est posée par erreur.
 */
export const devLoginEnabled =
  process.env.NODE_ENV !== "production" && process.env.ALLOW_DEV_LOGIN === "true";
