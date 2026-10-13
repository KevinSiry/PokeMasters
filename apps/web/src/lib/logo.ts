/**
 * Format réellement disponible pour un logo TCGdex. Le client essaie le WebP puis le PNG, mais ce repli
 * n'a lieu qu'après l'hydratation : pour un logo visible dès l'arrivée, on vérifie côté serveur
 * (une fois par logo et par processus) et on rend directement la bonne URL.
 * En cas de doute (réseau lent, CDN injoignable), on garde le comportement par défaut.
 */
const known = new Map<string, Promise<string>>();

export function resolveLogo(base: string | null): Promise<string | null> {
  if (!base) return Promise.resolve(null);
  let found = known.get(base);
  if (!found) {
    found = fetch(`${base}.webp`, { method: "HEAD", signal: AbortSignal.timeout(1500), cache: "no-store" })
      .then((res) => {
        if (res.ok) return base;
        if (res.status === 404) return `${base}.png`;
        throw new Error(`HTTP ${res.status}`);
      })
      .catch(() => {
        known.delete(base);
        return base;
      });
    known.set(base, found);
  }
  return found;
}
