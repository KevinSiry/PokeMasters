import { describe, expect, it } from "vitest";
import { categoryCode, finishesOf, localIdSortKey, needsResync, priceEurOf, toCardRecord, typeCode } from "./normalize";
import { cardDetailSchema } from "./schemas";

// Réponse réelle de GET /v2/fr/cards/swsh3-136 (allégée), relevée le 2026-10-12.
const FOUINAR = cardDetailSchema.parse({
  category: "Pokémon",
  id: "swsh3-136",
  illustrator: "tetsuya koizumi",
  image: "https://assets.tcgdex.net/fr/swsh/swsh3/136",
  localId: "136",
  name: "Fouinar",
  rarity: "Peu Commune",
  set: { cardCount: { official: 189, total: 201 }, id: "swsh3", name: "Ténèbres Embrasées" },
  variants: { firstEdition: false, holo: false, normal: true, reverse: true, wPromo: false },
  dexId: [162],
  hp: 110,
  types: ["Incolore"],
  evolveFrom: "Fouinette",
  stage: "Niveau 1",
  attacks: [
    { cost: ["Incolore"], name: "Mode Cool", effect: "Piochez 3 cartes." },
    { cost: ["Incolore"], name: "Éclate-Queue", effect: "Lancez une pièce.", damage: 90 },
  ],
  weaknesses: [{ type: "Combat", value: "×2" }],
  retreat: 1,
  regulationMark: "D",
  pricing: { cardmarket: { avg: 0.07, trend: 0.06, "trend-holo": 0.24 } },
});

describe("codes canoniques", () => {
  it("traduit les types FR et EN, accents compris", () => {
    expect(typeCode("Électrique")).toBe("lightning");
    expect(typeCode("Lightning")).toBe("lightning");
    expect(typeCode("Fée")).toBe("fairy");
    expect(typeCode("Obscurité")).toBe("darkness");
    expect(typeCode("Inconnu")).toBeNull();
  });

  it("traduit les catégories", () => {
    expect(categoryCode("Dresseur")).toBe("trainer");
    expect(categoryCode("Énergie")).toBe("energy");
    expect(categoryCode("Pokémon")).toBe("pokemon");
    expect(categoryCode("Pokemon")).toBe("pokemon");
  });
});

describe("localIdSortKey", () => {
  it("trie les numéros naturellement et place les préfixés après", () => {
    const ids = ["TG12", "10", "2", "001", "SV-P 003"];
    expect([...ids].sort((a, b) => localIdSortKey(a) - localIdSortKey(b))).toEqual(["001", "2", "10", "SV-P 003", "TG12"]);
  });
});

describe("finitions et prix", () => {
  it("lit les variantes, avec normale par défaut", () => {
    expect(finishesOf(FOUINAR)).toEqual({ normal: true, reverse: true, holo: false, firstEdition: false });
    expect(finishesOf({ variants: null })).toEqual({ normal: true, reverse: false, holo: false, firstEdition: false });
  });

  it("prend la tendance Cardmarket, sinon la moyenne", () => {
    expect(priceEurOf(FOUINAR)).toBe(0.06);
    expect(priceEurOf({ pricing: { cardmarket: { avg: 3 } } })).toBe(3);
    expect(priceEurOf({ pricing: null })).toBeNull();
  });
});

describe("toCardRecord", () => {
  it("produit une ligne complète et canonique", () => {
    const r = toCardRecord({ detail: FOUINAR, lang: "fr", nameFr: "Fouinar", nameEn: "Furret" });
    expect(r).toMatchObject({
      id: "swsh3-136",
      setId: "swsh3",
      name: "Fouinar",
      nameEn: "Furret",
      category: "pokemon",
      hp: 110,
      types: ["colorless"],
      typesRaw: ["Incolore"],
      dexIds: [162],
      weaknesses: [{ type: "fighting", value: "×2" }],
      droppable: true,
      imageLang: "fr",
    });
    expect(r.attacks[1]).toEqual({ name: "Éclate-Queue", cost: ["colorless"], damage: "90", effect: "Lancez une pièce." });
  });

  it("utilise l'image anglaise en repli et exclut du tirage une carte sans image", () => {
    const noImage = { ...FOUINAR, image: null };
    const withFallback = toCardRecord({ detail: noImage, lang: "fr", nameFr: "Fouinar", nameEn: null, fallbackImage: "https://x/en/1" });
    expect(withFallback).toMatchObject({ image: "https://x/en/1", imageLang: "en", droppable: true });
    const none = toCardRecord({ detail: noImage, lang: "fr", nameFr: "Fouinar", nameEn: null });
    expect(none).toMatchObject({ image: null, imageLang: null, droppable: false });
  });
});

describe("needsResync", () => {
  // Set 30th-c (Collection Classique 30ᵉ Anniversaire) : publié le 2026-09-16 sans aucune image.
  const cards = [
    { id: "30th-c-025", image: null },
    { id: "30th-c-026", image: null },
  ];
  const noEn = new Map<string, { image?: string | null }>();

  it("réimporte un set absent ou qui a gagné des cartes", () => {
    expect(needsResync(undefined, cards, noEn)).toBe(true);
    expect(needsResync({ cards: 1, withImage: 0 }, cards, noEn)).toBe(true);
  });

  it("ignore un set inchangé, même sans images", () => {
    expect(needsResync({ cards: 2, withImage: 0 }, cards, noEn)).toBe(false);
  });

  it("réimporte quand TCGdex publie enfin les images, en FR ou en EN", () => {
    const fr = [cards[0]!, { id: "30th-c-026", image: "https://assets.tcgdex.net/fr/me/30th-c/026" }];
    expect(needsResync({ cards: 2, withImage: 0 }, fr, noEn)).toBe(true);
    const en = new Map([["30th-c-026", { image: "https://assets.tcgdex.net/en/me/30th-c/026" }]]);
    expect(needsResync({ cards: 2, withImage: 0 }, cards, en)).toBe(true);
    expect(needsResync({ cards: 2, withImage: 1 }, cards, en)).toBe(false);
  });
});
