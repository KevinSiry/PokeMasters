/**
 * Scans Poképédia de bout en bout sur Postgres : une carte française sans scan TCGdex reçoit
 * le scan de Poképédia et redevient tirable. Ignorés si SKIP_DB_TESTS=1.
 */
import { prisma } from "@pokeflex/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyLanguagePolicy } from "./sync";
import { fillPokepediaImages } from "./pokepedia";

const skip = process.env.SKIP_DB_TESTS === "1";
const SET = "dpp";
const ids = [`${SET}-ZZ01`, `${SET}-ZZ02`];
let setExisted = false;
let serieExisted = false;

const fake = (async (url: string) => {
  const allimages = url.includes("aiprefix=Carte_Promo_DP_")
    ? [{ name: "Carte_Promo_DP_ZZ1.png", url: "https://www.pokepedia.fr/images/c/cd/Carte_Promo_DP_ZZ1.png", width: 765 }]
    : [];
  return new Response(JSON.stringify({ query: { allimages } }), { status: 200 });
}) as unknown as typeof fetch;

describe.skipIf(skip)("scans Poképédia", () => {
  beforeAll(async () => {
    const now = new Date();
    serieExisted = (await prisma.serie.count({ where: { id: "dp" } })) > 0;
    setExisted = (await prisma.set.count({ where: { id: SET } })) > 0;
    await prisma.serie.upsert({ where: { id: "dp" }, create: { id: "dp", name: "Diamant & Perle", lang: "fr", syncedAt: now }, update: {} });
    await prisma.set.upsert({
      where: { id: SET },
      create: { id: SET, serieId: "dp", name: "Promo DP", cardCountOfficial: 2, cardCountTotal: 2, lang: "fr", syncedAt: now },
      update: {},
    });
    const base = { setId: SET, lang: "fr", category: "pokemon", tier: "common", tierReason: "rarity", syncedAt: now } as const;
    await prisma.card.createMany({
      data: [
        { ...base, id: ids[0]!, localId: "ZZ01", name: "Carte A", nameFr: "Carte A", image: "https://assets.tcgdex.net/en/dp/dpp/ZZ01", imageLang: "en", droppable: false },
        { ...base, id: ids[1]!, localId: "ZZ02", name: "Carte B", nameFr: "Carte B", droppable: false },
      ],
      skipDuplicates: true,
    });
  });
  afterAll(async () => {
    await prisma.card.deleteMany({ where: { id: { in: ids } } });
    if (!setExisted) await prisma.set.deleteMany({ where: { id: SET } });
    if (!serieExisted) await prisma.serie.deleteMany({ where: { id: "dp" } });
  });

  it("remplace l'image anglaise par le scan français et rend la carte tirable", async () => {
    const filled = await fillPokepediaImages(prisma, { fetch: fake, onlySets: [SET] });
    expect(filled).toBe(1);
    const a = await prisma.card.findUniqueOrThrow({ where: { id: ids[0]! } });
    expect(a).toMatchObject({ imageLang: "fr", droppable: true });
    expect(a.image).toBe(
      "https://www.pokepedia.fr/images/thumb/c/cd/Carte_Promo_DP_ZZ1.png/600px-Carte_Promo_DP_ZZ1.png",
    );
    // Toujours tirable une fois la règle « 100 % français » appliquée.
    await applyLanguagePolicy(prisma, true);
    expect((await prisma.card.findUniqueOrThrow({ where: { id: ids[0]! } })).droppable).toBe(true);
    // Sans scan chez Poképédia : reste cachée.
    expect((await prisma.card.findUniqueOrThrow({ where: { id: ids[1]! } })).droppable).toBe(false);
  });
});
