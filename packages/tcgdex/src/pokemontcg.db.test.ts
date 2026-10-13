/**
 * Images de repli de bout en bout sur Postgres : synchro avec un faux TCGdex et un faux
 * jeu de données Pokémon TCG API. Ignorés si SKIP_DB_TESTS=1.
 */
import { prisma } from "@pokeflex/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { TcgdexClient } from "./client";
import { syncCatalog } from "./sync";

const skip = process.env.SKIP_DB_TESTS === "1";
// Set réel de la table de correspondance, absent de l'échantillon de catalogue.
const SET = "smp";
const ids = [`${SET}-ZZ1`, `${SET}-ZZ2`];
const startedAt = new Date();
let setExisted = false;
let serieExisted = false;

function fakeClient(scanned: Set<string>): TcgdexClient {
  const summary = (id: string, i: number) => ({
    id,
    localId: `ZZ${i + 1}`,
    name: i === 0 ? "Rowlet" : "Litten",
    image: scanned.has(id) ? `https://assets.tcgdex.net/en/sm/smp/ZZ${i + 1}` : null,
  });
  const set = {
    id: SET,
    name: "SM Black Star Promos",
    releaseDate: "2016-11-04",
    serie: { id: "sm", name: "Sun & Moon" },
    cardCount: { total: 2, official: 2 },
    cards: ids.map(summary),
  };
  return {
    series: async () => [{ id: "sm", name: "Sun & Moon" }],
    sets: async (lang: "fr" | "en") => (lang === "en" ? [set] : []),
    cards: async (lang: "fr" | "en") => (lang === "en" ? ids.map(summary) : []),
    set: async (lang: "fr" | "en") => (lang === "en" ? set : null),
    card: async (lang: "fr" | "en", id: string) =>
      lang === "en"
        ? { ...summary(id, ids.indexOf(id)), category: "Pokemon", rarity: "Promo", set: { id: SET } }
        : null,
  } as unknown as TcgdexClient;
}

const ptcgFetch = (async (url: string) => {
  const body = url.endsWith(`/${SET}.json`)
    ? [
        { number: "ZZ1", name: "Rowlet", images: { large: "https://images.pokemontcg.io/smp/ZZ1_hires.png" } },
        { number: "ZZ2", name: "Litten", images: { large: "https://images.pokemontcg.io/smp/ZZ2_hires.png" } },
      ]
    : [];
  return new Response(JSON.stringify(body), { status: 200 });
}) as unknown as typeof fetch;

describe.skipIf(skip)("images de repli dans la synchro", () => {
  beforeAll(async () => {
    setExisted = (await prisma.set.count({ where: { id: SET } })) > 0;
    serieExisted = (await prisma.serie.count({ where: { id: "sm" } })) > 0;
  });
  afterAll(async () => {
    await prisma.card.deleteMany({ where: { id: { in: ids } } });
    if (!setExisted) await prisma.set.deleteMany({ where: { id: SET } });
    if (!serieExisted) await prisma.serie.deleteMany({ where: { id: "sm" } });
    await prisma.syncRun.deleteMany({ where: { startedAt: { gte: startedAt } } });
  });

  const card = (id: string) =>
    prisma.card.findUniqueOrThrow({ where: { id }, select: { image: true, imageLang: true, droppable: true } });

  it("complète une carte sans scan TCGdex et la rend tirable", async () => {
    await syncCatalog({ prisma, client: fakeClient(new Set([ids[0]!])), mode: "full", onlySets: [SET], restart: true, fetch: ptcgFetch });
    expect(await card(ids[0]!)).toEqual({ image: "https://assets.tcgdex.net/en/sm/smp/ZZ1", imageLang: "en", droppable: true });
    expect(await card(ids[1]!)).toEqual({ image: "https://images.pokemontcg.io/smp/ZZ2", imageLang: "en", droppable: true });
  });

  it("garde l'image de repli quand le set est réimporté sans scan", async () => {
    const failing = (async () => new Response("", { status: 503 })) as unknown as typeof fetch;
    await syncCatalog({ prisma, client: fakeClient(new Set([ids[0]!])), mode: "full", onlySets: [SET], restart: true, fetch: failing });
    expect((await card(ids[1]!)).image).toBe("https://images.pokemontcg.io/smp/ZZ2");
  });

  it("reprend le scan TCGdex dès qu'il est publié", async () => {
    await syncCatalog({ prisma, client: fakeClient(new Set(ids)), mode: "new-sets", onlySets: [SET], fetch: ptcgFetch });
    expect((await card(ids[1]!)).image).toBe("https://assets.tcgdex.net/en/sm/smp/ZZ2");
  });
});
