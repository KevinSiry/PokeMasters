const dateFr = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const eur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

export function formatDateFr(d: Date | null | undefined): string | null {
  return d ? dateFr.format(d) : null;
}

export function formatYear(d: Date | null | undefined): string | null {
  return d ? String(d.getUTCFullYear()) : null;
}

export function formatEur(n: number | null | undefined): string | null {
  return n === null || n === undefined ? null : eur.format(n);
}

/** « 1 carte », « 12 cartes ». */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${new Intl.NumberFormat("fr-FR").format(n)} ${n > 1 ? many : one}`;
}
