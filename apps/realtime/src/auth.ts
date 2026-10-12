/**
 * Authentification des connexions WebSocket.
 *
 * Auth.js stocke les sessions en base (stratégie « database ») et pose un cookie
 * contenant le jeton de session. Le navigateur envoie ce cookie lors de la poignée
 * de main Socket.IO ; on le relit ici et on vérifie la session en base.
 */

export const SESSION_COOKIE_NAMES = ["__Secure-authjs.session-token", "authjs.session-token"] as const;

/** Extrait le jeton de session d'un en-tête `Cookie`. */
export function readSessionToken(cookieHeader: string | undefined | null): string | null {
  if (!cookieHeader) return null;
  const cookies = new Map<string, string>();
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const name = part.slice(0, idx).trim();
    const raw = part.slice(idx + 1).trim();
    if (!name) continue;
    try {
      cookies.set(name, decodeURIComponent(raw));
    } catch {
      cookies.set(name, raw);
    }
  }
  for (const name of SESSION_COOKIE_NAMES) {
    const v = cookies.get(name);
    if (v) return v;
  }
  return null;
}

export interface SessionLookup {
  findSession(token: string): Promise<{ userId: string; expires: Date } | null>;
}

/** Renvoie l'id du joueur si la session est valide à l'instant `now`, sinon `null`. */
export async function resolveUserId(
  cookieHeader: string | undefined | null,
  lookup: SessionLookup,
  now: Date = new Date(),
): Promise<string | null> {
  const token = readSessionToken(cookieHeader);
  if (!token) return null;
  const session = await lookup.findSession(token);
  if (!session || session.expires.getTime() <= now.getTime()) return null;
  return session.userId;
}
