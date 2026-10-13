import { describe, expect, it } from "vitest";
import { buildFrenchNameIndex, frenchNameFor } from "./names";

const index = buildFrenchNameIndex([
  { nameEn: "Charmander", nameFr: "Salamèche", dexIds: [4] },
  { nameEn: "Charmander", nameFr: "Salamèche", dexIds: [4] },
  { nameEn: "Charmander ex", nameFr: "Salamèche-ex", dexIds: [4] },
  { nameEn: "Mr. Mime", nameFr: "M. Mime", dexIds: [122] },
  { nameEn: "Pikachu", nameFr: "Pikachu", dexIds: [25] },
  { nameEn: "Rare Candy", nameFr: "Super Bonbon", dexIds: [] },
  { nameEn: "Rare Candy", nameFr: "Bonbon Rare", dexIds: [] },
  { nameEn: "Rare Candy", nameFr: "Super Bonbon", dexIds: [] },
]);

describe("noms français des cartes anglaises", () => {
  it("reprend le nom français d'une carte au même nom anglais", () => {
    expect(frenchNameFor("Charmander", [4], index)).toBe("Salamèche");
    expect(frenchNameFor("Rare Candy", [], index)).toBe("Super Bonbon");
  });

  it("remplace le nom de l'espèce retrouvée par son numéro de Pokédex", () => {
    expect(frenchNameFor("Charmander V", [4], index)).toBe("Salamèche V");
    expect(frenchNameFor("Team Rocket's Mr. Mime", [122], index)).toBe("Team Rocket's M. Mime");
  });

  it("ne remplace que des mots entiers", () => {
    expect(frenchNameFor("Charmanders", [4], index)).toBeNull();
  });

  it("renvoie null sans correspondance ou quand le nom ne change pas", () => {
    expect(frenchNameFor("Professor's Research", [], index)).toBeNull();
    expect(frenchNameFor("Pikachu V", [25], index)).toBeNull();
    expect(frenchNameFor("Bulbasaur", [1], index)).toBeNull();
  });
});
