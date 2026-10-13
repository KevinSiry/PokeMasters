import { describe, expect, it } from "vitest";
import { cardImageUrl } from "./card-image";

describe("cardImageUrl", () => {
  it("ajoute la qualité et l'extension webp", () => {
    expect(cardImageUrl("https://assets.tcgdex.net/fr/base/base1/4", "high")).toBe(
      "https://assets.tcgdex.net/fr/base/base1/4/high.webp",
    );
  });
  it("tolère un slash final", () => {
    expect(cardImageUrl("https://assets.tcgdex.net/fr/base/base1/4/", "low")).toBe(
      "https://assets.tcgdex.net/fr/base/base1/4/low.webp",
    );
  });
  it("image de repli Pokémon TCG API : png, haute définition en _hires", () => {
    expect(cardImageUrl("https://images.pokemontcg.io/smp/SM01", "low")).toBe("https://images.pokemontcg.io/smp/SM01.png");
    expect(cardImageUrl("https://images.pokemontcg.io/smp/SM01", "high")).toBe(
      "https://images.pokemontcg.io/smp/SM01_hires.png",
    );
  });
  it("renvoie null sans image", () => {
    expect(cardImageUrl(null, "low")).toBeNull();
    expect(cardImageUrl("", "low")).toBeNull();
  });
});
