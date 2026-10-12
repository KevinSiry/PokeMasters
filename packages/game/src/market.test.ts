import { gameConfig } from "@pokeflex/config";
import { describe, expect, it } from "vitest";
import { assertValidPrice, extendForSniping, listingFee, MarketRuleError, minNextBid } from "./market";

const rules = gameConfig.market;

describe("listingFee", () => {
  it("prend 5 % arrondis au Jeton supérieur, au moins 1", () => {
    expect(listingFee(100, rules)).toBe(5);
    expect(listingFee(101, rules)).toBe(6);
    expect(listingFee(1, rules)).toBe(1);
    expect(listingFee(10, rules)).toBe(1);
  });
});

describe("assertValidPrice", () => {
  it("accepte les entiers dans les bornes", () => {
    expect(() => assertValidPrice(1, rules)).not.toThrow();
    expect(() => assertValidPrice(rules.maxPrice, rules)).not.toThrow();
  });
  it("refuse zéro, les décimaux et les montants hors bornes", () => {
    for (const p of [0, -5, 1.5, rules.maxPrice + 1, Number.NaN]) expect(() => assertValidPrice(p, rules)).toThrow(MarketRuleError);
  });
});

describe("minNextBid", () => {
  it("démarre au prix de départ", () => {
    expect(minNextBid(50, null, rules)).toBe(50);
  });
  it("exige au moins +1 ou +5 %", () => {
    expect(minNextBid(50, 10, rules)).toBe(11);
    expect(minNextBid(50, 200, rules)).toBe(210);
    expect(minNextBid(50, 201, rules)).toBe(212);
  });
});

describe("extendForSniping", () => {
  const now = new Date("2026-10-12T20:00:00Z");
  it("ne change rien loin de la fin", () => {
    const ends = new Date(now.getTime() + 10 * 60_000);
    expect(extendForSniping(ends, now, 60_000)).toEqual(ends);
  });
  it("repousse la fin à maintenant + 60 s dans la dernière minute", () => {
    const ends = new Date(now.getTime() + 20_000);
    expect(extendForSniping(ends, now, 60_000)).toEqual(new Date(now.getTime() + 60_000));
  });
});
