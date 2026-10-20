/**
 * Lecture sûre des paramètres d'URL. Next.js donne un tableau quand un paramètre est répété
 * (`?q=a&q=b`) : les pages ne doivent jamais planter sur une URL bricolée.
 */

export type RawParam = string | string[] | undefined;

/** Première valeur d'un paramètre d'URL, bornée en longueur ; `fallback` s'il est absent. */
export function firstParam(raw: RawParam, fallback = "", maxLength = 200): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return typeof v === "string" ? v.slice(0, maxLength) : fallback;
}

/**
 * Chemin interne vers lequel rediriger après connexion, sinon "/". Refuse les URL absolues,
 * `//hote` et `/\hote` (que les navigateurs lisent comme `//hote`), et les caractères de contrôle.
 */
export function safeInternalPath(raw: RawParam): string {
  const path = firstParam(raw, "", 2000);
  // eslint-disable-next-line no-control-regex
  if (!path.startsWith("/") || /[\\\u0000-\u001f\u007f]/.test(path)) return "/";
  try {
    const base = "http://pokeflex.invalid";
    const url = new URL(path, base);
    if (url.origin !== base) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

const INT8_MAX = 9_223_372_036_854_775_807n;

/** Curseur de pagination du registre (`?avant=<id>`) : un entier positif qui tient dans un BIGINT, sinon undefined. */
export function ledgerCursor(raw: RawParam): bigint | undefined {
  const v = firstParam(raw, "", 40);
  if (!/^\d{1,19}$/.test(v)) return undefined;
  const n = BigInt(v);
  return n > 0n && n <= INT8_MAX ? n : undefined;
}
