import { describe, expect, it } from "vitest";
import { cryptoRng, seededRng, weightedPick } from "./rng";

describe("seededRng", () => {
  it("est déterministe pour une même graine", () => {
    const a = seededRng(42);
    const b = seededRng(42);
    const seqA = Array.from({ length: 20 }, () => a.int(1000));
    const seqB = Array.from({ length: 20 }, () => b.int(1000));
    expect(seqA).toEqual(seqB);
  });

  it("reste dans les bornes", () => {
    const r = seededRng(7);
    for (let i = 0; i < 10_000; i++) {
      const v = r.int(6);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(6);
    }
  });

  it("refuse une borne invalide", () => {
    expect(() => seededRng(1).int(0)).toThrow(RangeError);
    expect(() => cryptoRng.int(1.5)).toThrow(RangeError);
  });
});

describe("weightedPick", () => {
  it("respecte les poids à ±1 % sur 200 000 tirages", () => {
    const weights = { a: 550, b: 270, c: 120, d: 45, e: 13, f: 2 };
    const total = 1000;
    const rng = seededRng(2026);
    const counts: Record<string, number> = {};
    const n = 200_000;
    for (let i = 0; i < n; i++) {
      const k = weightedPick(weights, rng);
      counts[k] = (counts[k] ?? 0) + 1;
    }
    for (const [k, w] of Object.entries(weights)) {
      expect(Math.abs((counts[k] ?? 0) / n - w / total)).toBeLessThan(0.01);
    }
  });

  it("ignore les poids nuls", () => {
    const rng = seededRng(1);
    for (let i = 0; i < 1000; i++) expect(weightedPick({ a: 0, b: 3 }, rng)).toBe("b");
  });

  it("échoue sans poids positif", () => {
    expect(() => weightedPick({ a: 0 }, seededRng(1))).toThrow();
  });
});
