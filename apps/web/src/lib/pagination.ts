/** Cartes par page dans les grilles de la collection : multiple de 3, 4, 5 et 6 (colonnes de la grille). */
export const COLLECTION_PAGE_SIZE = 60;

export interface PageInfo {
  /** Page courante, 1 pour la première, ramenée dans les bornes. */
  page: number;
  pageCount: number;
  total: number;
  /** Index de la première et de la dernière (exclue) ligne de la page. */
  start: number;
  end: number;
}

/** Lit un numéro de page venu de l'URL (« ?page=3 ») et le borne au nombre de pages. */
export function paginate(total: number, rawPage: string | number | undefined, pageSize = COLLECTION_PAGE_SIZE): PageInfo {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const asked = Math.trunc(Number(rawPage));
  const page = Number.isFinite(asked) ? Math.min(Math.max(asked, 1), pageCount) : 1;
  const start = (page - 1) * pageSize;
  return { page, pageCount, total, start, end: Math.min(start + pageSize, total) };
}

/** Numéros à afficher dans la barre de pages : première, dernière et voisines de la courante ; null = ellipse. */
export function pageNumbers(page: number, pageCount: number, around = 1): (number | null)[] {
  const keep = new Set([1, pageCount]);
  for (let p = page - around; p <= page + around; p++) if (p >= 1 && p <= pageCount) keep.add(p);
  const sorted = [...keep].sort((a, b) => a - b);
  const out: (number | null)[] = [];
  for (const p of sorted) {
    const prev = out.at(-1);
    if (typeof prev === "number" && p - prev === 2) out.push(prev + 1);
    else if (typeof prev === "number" && p - prev > 2) out.push(null);
    out.push(p);
  }
  return out;
}
