import { describe, expect, it } from "vitest";
import { cardImageUrl, pokepediaFilePage } from "./card-image";

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
  it("scan Poképédia : miniature dans les grilles, image stockée en grand", () => {
    const original = "https://www.pokepedia.fr/images/b/bf/Carte_Diamant_%26_Perle_1.png";
    expect(cardImageUrl(original, "high")).toBe(original);
    expect(cardImageUrl(original, "low")).toBe(
      "https://www.pokepedia.fr/images/thumb/b/bf/Carte_Diamant_%26_Perle_1.png/245px-Carte_Diamant_%26_Perle_1.png",
    );
    const thumb = "https://www.pokepedia.fr/images/thumb/b/bf/Carte_Diamant_%26_Perle_1.png/600px-Carte_Diamant_%26_Perle_1.png";
    expect(cardImageUrl(thumb, "low")).toBe(
      "https://www.pokepedia.fr/images/thumb/b/bf/Carte_Diamant_%26_Perle_1.png/245px-Carte_Diamant_%26_Perle_1.png",
    );
    expect(pokepediaFilePage(thumb)).toBe("https://www.pokepedia.fr/Fichier:Carte_Diamant_%26_Perle_1.png");
    expect(pokepediaFilePage("https://assets.tcgdex.net/fr/base/base1/4")).toBeNull();
  });
  it("renvoie null sans image", () => {
    expect(cardImageUrl(null, "low")).toBeNull();
    expect(cardImageUrl("", "low")).toBeNull();
  });
});
