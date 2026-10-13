/**
 * Règles sociales pures : pseudos, guildes, messages, anti-spam, classements.
 */

export interface HandleRules {
  handleMinLength: number;
  handleMaxLength: number;
}

const strip = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "");

/** Pseudo valide : minuscules, chiffres, « - » et « _ », sans tiret en bord. Renvoie un message d'erreur ou null. */
export function handleError(handle: string, rules: HandleRules): string | null {
  if (handle.length < rules.handleMinLength) return `Ton pseudo doit faire au moins ${rules.handleMinLength} caractères.`;
  if (handle.length > rules.handleMaxLength) return `Ton pseudo doit faire au plus ${rules.handleMaxLength} caractères.`;
  if (!/^[a-z0-9_-]+$/.test(handle)) return "Lettres minuscules sans accent, chiffres, « - » et « _ » uniquement.";
  if (/^[-_]|[-_]$/.test(handle)) return "Ton pseudo ne peut pas commencer ni finir par « - » ou « _ ».";
  return null;
}

/** Pseudo proposé à partir d'un nom affiché (« Sacha Ketchum » → « sacha-ketchum »). */
export function handleFromName(name: string | null | undefined, rules: HandleRules): string {
  const base = strip(name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, rules.handleMaxLength)
    .replace(/-+$/, "");
  return base.length >= rules.handleMinLength ? base : `dresseur${base ? `-${base}` : ""}`.slice(0, rules.handleMaxLength);
}

/** Variante numérotée d'un pseudo déjà pris, sans dépasser la longueur maximale. */
export function handleVariant(handle: string, n: number, rules: HandleRules): string {
  const suffix = `-${n}`;
  return `${handle.slice(0, rules.handleMaxLength - suffix.length).replace(/[-_]+$/, "")}${suffix}`;
}

/** Sigle de guilde : 2 à 5 lettres ou chiffres, affiché en majuscules. */
export function normalizeGuildTag(tag: string): string {
  return strip(tag)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export function guildError(name: string, tag: string): string | null {
  if (name.trim().length < 3 || name.trim().length > 32) return "Le nom de la guilde doit faire entre 3 et 32 caractères.";
  const t = normalizeGuildTag(tag);
  if (t.length < 2 || t.length > 5) return "Le sigle doit faire entre 2 et 5 lettres ou chiffres.";
  return null;
}

/** Message nettoyé (espaces superflus, caractères de contrôle) ou null s'il est vide ou trop long. */
export function cleanMessage(body: string, maxLength: number): string | null {
  const text = body
    // eslint-disable-next-line no-control-regex -- on retire justement les caractères de contrôle
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!text || text.length > maxLength) return null;
  return text;
}

/** Limiteur à fenêtre glissante (en mémoire, par clé). */
export class RateLimiter {
  private hits = new Map<string, number[]>();

  constructor(
    private count: number,
    private windowMs: number,
  ) {}

  /** Vrai si l'action est permise maintenant (et la compte). */
  take(key: string, now: number): boolean {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.count) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }

  /** Millisecondes avant la prochaine action permise (0 si possible tout de suite). */
  retryIn(key: string, now: number): number {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length < this.count) return 0;
    return this.windowMs - (now - recent[0]!);
  }
}

export interface RankedEntry<T> {
  rank: number;
  entry: T;
}

/** Classement « à la compétition » : ex aequo au même rang, le suivant saute (1, 2, 2, 4). */
export function rankEntries<T extends { value: number }>(entries: readonly T[]): RankedEntry<T>[] {
  const sorted = [...entries].sort((a, b) => b.value - a.value);
  let rank = 0;
  let prev: number | null = null;
  return sorted.map((entry, i) => {
    if (entry.value !== prev) {
      rank = i + 1;
      prev = entry.value;
    }
    return { rank, entry };
  });
}
