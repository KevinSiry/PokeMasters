/**
 * Noms français des cartes importées en anglais (pur, sans I/O).
 *
 * TCGdex n'a pas de version française pour certaines cartes (promos, sets récents…) :
 * on déduit leur nom français des cartes bilingues du catalogue.
 * 1. Même nom anglais exact (« Charmander » → « Salamèche », « Rare Candy » → « Super Bonbon »).
 * 2. Sinon, on remplace le nom de l'espèce, retrouvé par numéro de Pokédex
 *    (« Charmander V » → « Salamèche V »).
 */

export interface BilingualName {
  nameEn: string;
  nameFr: string;
  dexIds: readonly number[];
}

export interface FrenchNameIndex {
  exact: ReadonlyMap<string, string>;
  species: ReadonlyMap<number, { en: string; fr: string }>;
}

/** Valeur la plus fréquente ; à égalité, la plus courte (le nom « nu » de l'espèce). */
function mostFrequent(counts: Map<string, number>): string | undefined {
  let best: string | undefined;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount || (count === bestCount && best !== undefined && value.length < best.length)) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

export function buildFrenchNameIndex(cards: Iterable<BilingualName>): FrenchNameIndex {
  const exactCounts = new Map<string, Map<string, number>>();
  const speciesCounts = new Map<number, Map<string, number>>();
  const bump = <K>(map: Map<K, Map<string, number>>, key: K, value: string) => {
    const counts = map.get(key) ?? new Map<string, number>();
    counts.set(value, (counts.get(value) ?? 0) + 1);
    map.set(key, counts);
  };
  for (const c of cards) {
    const en = c.nameEn.trim();
    const fr = c.nameFr.trim();
    if (!en || !fr) continue;
    bump(exactCounts, en, fr);
    if (c.dexIds.length === 1) bump(speciesCounts, c.dexIds[0]!, JSON.stringify([en, fr]));
  }
  const exact = new Map<string, string>();
  for (const [en, counts] of exactCounts) exact.set(en, mostFrequent(counts)!);
  const species = new Map<number, { en: string; fr: string }>();
  for (const [dexId, counts] of speciesCounts) {
    // Le nom de l'espèce est la paire la plus courante (« Charmander » devant « Charmander ex »).
    const [en, fr] = JSON.parse(mostFrequent(counts)!) as [string, string];
    species.set(dexId, { en, fr });
  }
  return { exact, species };
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Nom français déduit, ou `null` si rien ne permet de le trouver. */
export function frenchNameFor(nameEn: string, dexIds: readonly number[], index: FrenchNameIndex): string | null {
  const en = nameEn.trim();
  const exact = index.exact.get(en);
  if (exact) return exact;
  let name = en;
  for (const dexId of dexIds) {
    const sp = index.species.get(dexId);
    if (!sp || sp.en === sp.fr) continue;
    name = name.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(sp.en)}(?![\\p{L}\\p{N}])`, "u"), () => sp.fr);
  }
  return name !== en ? name : null;
}
