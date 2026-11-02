import { describe, expect, it } from "vitest";
import {
  listPokepediaScans,
  normalizeCardNumber,
  numberFromFileName,
  pokepediaStoredImage,
  pokepediaThumb,
} from "./pokepedia";

describe("normalizeCardNumber", () => {
  it("ignore les zéros de tête et la casse", () => {
    expect(normalizeCardNumber("SV001")).toBe(normalizeCardNumber("SV1"));
    expect(normalizeCardNumber("H01")).toBe("H1");
    expect(normalizeCardNumber("007")).toBe("7");
    expect(normalizeCardNumber("SM01")).toBe("SM1");
    expect(normalizeCardNumber("24a")).toBe("24A");
  });
});

describe("numberFromFileName", () => {
  it("lit le numéro après le préfixe", () => {
    expect(numberFromFileName("Carte_Diamant_&_Perle_12.png", "Diamant & Perle")).toBe("12");
    expect(numberFromFileName("Carte Promo SM SM01.png", "Promo SM")).toBe("SM1");
    expect(numberFromFileName("Carte_Destinées_Radieuses_SV001.png", "Destinées Radieuses")).toBe("SV1");
  });
  it("ignore les sous-extensions et les variantes", () => {
    expect(numberFromFileName("Carte_Diamant_&_Perle_Tempête_1.png", "Diamant & Perle")).toBeNull();
    expect(numberFromFileName("Carte_Diamant_&_Perle_102_(Calendrier_Compte_à_Rebours).png", "Diamant & Perle")).toBeNull();
    expect(numberFromFileName("Carte_Promo_SWSH_SWSH.png", "Promo SWSH")).toBeNull();
  });
});

describe("miniatures", () => {
  const original = "https://www.pokepedia.fr/images/b/bf/Carte_Diamant_%26_Perle_1.png";
  it("construit l'URL d'une miniature MediaWiki", () => {
    expect(pokepediaThumb(original, 600)).toBe(
      "https://www.pokepedia.fr/images/thumb/b/bf/Carte_Diamant_%26_Perle_1.png/600px-Carte_Diamant_%26_Perle_1.png",
    );
    expect(pokepediaThumb("https://assets.tcgdex.net/fr/x", 600)).toBeNull();
  });
  it("garde l'original léger, réduit les gros scans", () => {
    expect(pokepediaStoredImage(original, 367)).toBe(original);
    expect(pokepediaStoredImage(original, 765)).toContain("/thumb/b/bf/");
  });
});

describe("listPokepediaScans", () => {
  it("suit la pagination et indexe par numéro normalisé", async () => {
    const calls: string[] = [];
    const fake = (async (url: string) => {
      calls.push(url);
      const page2 = url.includes("aicontinue=");
      const body = page2
        ? { query: { allimages: [{ name: "Carte_Promo_DP_DP02.png", url: "https://www.pokepedia.fr/images/a/ab/Carte_Promo_DP_DP02.png", width: 400 }] } }
        : {
            continue: { aicontinue: "Carte_Promo_DP_DP02.png", continue: "-||" },
            query: {
              allimages: [
                { name: "Carte_Promo_DP_DP01.png", url: "https://www.pokepedia.fr/images/c/cd/Carte_Promo_DP_DP01.png", width: 765 },
                { name: "Carte_Promo_DP_DP01_(Jumbo).png", url: "https://www.pokepedia.fr/images/x/xy/j.png", width: 765 },
              ],
            },
          };
      return new Response(JSON.stringify(body), { status: 200 });
    }) as unknown as typeof fetch;
    const scans = await listPokepediaScans("Promo DP", fake);
    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain("aiprefix=Carte_Promo_DP_");
    expect([...scans.keys()]).toEqual(["DP1", "DP2"]);
    expect(scans.get("DP1")).toEqual({ url: "https://www.pokepedia.fr/images/c/cd/Carte_Promo_DP_DP01.png", width: 765 });
  });
});
