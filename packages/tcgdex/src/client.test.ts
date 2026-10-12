import { describe, expect, it } from "vitest";
import { TcgdexError, createLimiter, createTcgdexClient } from "./client";

function fakeFetch(responses: (() => Response)[]) {
  const calls: string[] = [];
  const fn = (async (url: string) => {
    calls.push(url);
    const next = responses.shift();
    if (!next) throw new Error("plus de réponse");
    return next();
  }) as unknown as typeof fetch;
  return { fn, calls };
}

const json = (body: unknown, status = 200) => () => new Response(JSON.stringify(body), { status });
const noSleep = async () => {};

describe("createTcgdexClient", () => {
  it("réessaie sur 429 et 5xx puis réussit", async () => {
    const { fn, calls } = fakeFetch([json({}, 503), json({}, 429), json([{ id: "base", name: "Base" }])]);
    const client = createTcgdexClient({ fetch: fn, sleep: noSleep });
    await expect(client.series("fr")).resolves.toEqual([{ id: "base", name: "Base" }]);
    expect(calls).toHaveLength(3);
  });

  it("renvoie null sur 404 ou corps vide", async () => {
    const { fn } = fakeFetch([json({}, 404), () => new Response("", { status: 200 })]);
    const client = createTcgdexClient({ fetch: fn, sleep: noSleep });
    await expect(client.card("fr", "x-1")).resolves.toBeNull();
    await expect(client.card("fr", "x-2")).resolves.toBeNull();
  });

  it("abandonne après le nombre maximal d'essais", async () => {
    const { fn, calls } = fakeFetch(Array.from({ length: 3 }, () => () => { throw new Error("ECONNRESET"); }));
    const client = createTcgdexClient({ fetch: fn, sleep: noSleep, maxRetries: 2 });
    await expect(client.sets("fr")).rejects.toBeInstanceOf(TcgdexError);
    expect(calls).toHaveLength(3);
  });

  it("ne réessaie pas une erreur 4xx", async () => {
    const { fn, calls } = fakeFetch([json({}, 400)]);
    const client = createTcgdexClient({ fetch: fn, sleep: noSleep });
    await expect(client.sets("fr")).rejects.toBeInstanceOf(TcgdexError);
    expect(calls).toHaveLength(1);
  });

  it("signale une réponse qui ne respecte pas le schéma", async () => {
    const { fn } = fakeFetch([json({ id: 42 })]);
    const client = createTcgdexClient({ fetch: fn, sleep: noSleep });
    await expect(client.card("fr", "x")).rejects.toThrow(/Réponse inattendue/);
  });
});

describe("createLimiter", () => {
  it("ne dépasse jamais la concurrence demandée", async () => {
    const limit = createLimiter(2);
    let active = 0;
    let peak = 0;
    await Promise.all(
      Array.from({ length: 10 }, () =>
        limit(async () => {
          active++;
          peak = Math.max(peak, active);
          await new Promise((r) => setTimeout(r, 2));
          active--;
        }),
      ),
    );
    expect(peak).toBe(2);
  });
});
