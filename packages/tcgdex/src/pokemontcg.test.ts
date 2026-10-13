import { describe, expect, it } from "vitest";
import { matchFallbackImages, normalizeCardName, normalizeNumber, ptcgImageBase, type PtcgCard } from "./pokemontcg";

const ptcg = (number: string, name: string, path = `x/${number}`): PtcgCard => ({
  number,
  name,
  images: { small: `https://images.pokemontcg.io/${path}.png`, large: `https://images.pokemontcg.io/${path}_hires.png` },
});

describe("normalisation", () => {
  it("ignore les zéros de tête des numéros", () => {
    expect(normalizeNumber("004")).toBe("4");
    expect(normalizeNumber("SM01")).toBe(normalizeNumber("sm1"));
    expect(normalizeNumber("SV001")).toBe("SV1");
    expect(normalizeNumber("0")).toBe("0");
  });

  it("rapproche les graphies des deux bases", () => {
    expect(normalizeCardName("Mewtwo EX")).toBe(normalizeCardName("Mewtwo-EX"));
    expect(normalizeCardName("Umbreon ☆")).toBe(normalizeCardName("Umbreon ★"));
    expect(normalizeCardName("Gardevoir ex")).toBe(normalizeCardName("Gardevoir ex δ"));
    expect(normalizeCardName("Palkia")).toBe(normalizeCardName("Palkia LV.X"));
    expect(normalizeCardName("Grass Energy")).toBe(normalizeCardName("Basic Grass Energy"));
    expect(normalizeCardName("Pikachu")).not.toBe(normalizeCardName("Raichu"));
  });

  it("garde l'URL de base sans suffixe, seulement sur le CDN Pokémon TCG API", () => {
    expect(ptcgImageBase("https://images.pokemontcg.io/smp/SM01_hires.png")).toBe("https://images.pokemontcg.io/smp/SM01");
    expect(ptcgImageBase("https://images.pokemontcg.io/smp/SM01.png")).toBe("https://images.pokemontcg.io/smp/SM01");
    expect(ptcgImageBase("https://evil.example/smp/SM01.png")).toBeNull();
    expect(ptcgImageBase("pas une url")).toBeNull();
  });
});

describe("matchFallbackImages", () => {
  it("rapproche par numéro en vérifiant le nom", () => {
    const found = matchFallbackImages(
      [
        { id: "smp-SM01", localId: "SM01", nameEn: "Rowlet" },
        { id: "smp-SM02", localId: "SM02", nameEn: "Litten" },
      ],
      [ptcg("SM01", "Rowlet", "smp/SM01"), ptcg("SM02", "Popplio", "smp/SM02")],
    );
    // SM02 porte un autre nom : mieux vaut pas d'image qu'une mauvaise carte.
    expect([...found]).toEqual([["smp-SM01", "https://images.pokemontcg.io/smp/SM01"]]);
  });

  it("ne rapproche par nom que les sets renumérotés, sans réutiliser une carte", () => {
    const missing = [
      { id: "30th-c-019", localId: "019", nameEn: "Darkrai & Cresselia LEGEND" },
      { id: "30th-c-020", localId: "020", nameEn: "Darkrai & Cresselia LEGEND" },
      { id: "30th-c-022", localId: "022", nameEn: "Palkia" },
      { id: "30th-c-099", localId: "099", nameEn: "Inconnu" },
    ];
    const cards = [
      ptcg("99", "Darkrai & Cresselia LEGEND", "me55c/99"),
      ptcg("100", "Darkrai & Cresselia LEGEND", "me55c/100"),
      ptcg("106", "Palkia LV.X", "me55c/106"),
    ];
    expect(matchFallbackImages(missing, cards).size).toBe(0);
    expect(Object.fromEntries(matchFallbackImages(missing, cards, { byName: true }))).toEqual({
      "30th-c-019": "https://images.pokemontcg.io/me55c/99",
      "30th-c-020": "https://images.pokemontcg.io/me55c/100",
      "30th-c-022": "https://images.pokemontcg.io/me55c/106",
    });
  });

  it("ignore une carte sans nom anglais ou sans image", () => {
    const found = matchFallbackImages(
      [
        { id: "a-1", localId: "1", nameEn: null },
        { id: "a-2", localId: "2", nameEn: "Pikachu" },
      ],
      [ptcg("1", "Pikachu"), { number: "2", name: "Pikachu" }],
    );
    expect(found.size).toBe(0);
  });
});
