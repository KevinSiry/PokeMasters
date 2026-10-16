import { gameConfig } from "@pokeflex/config";
import { describe, expect, it } from "vitest";
import { listFullError, wishlistAlertRecipients } from "./lists";

const rules = gameConfig.lists;

describe("listFullError", () => {
  it("laisse ajouter tant que la liste n'est pas pleine", () => {
    expect(listFullError("favorites", rules.favoritesMax - 1, rules)).toBeNull();
    expect(listFullError("wishlist", 0, rules)).toBeNull();
  });
  it("refuse au-delà du maximum, avec un message propre à chaque liste", () => {
    expect(listFullError("favorites", rules.favoritesMax, rules)).toContain("favorites");
    expect(listFullError("wishlist", 200, { ...rules, wishlistMax: 200 })).toContain("wishlist");
  });
  it("laisse une liste sans maximum grandir sans fin", () => {
    expect(listFullError("wishlist", 100_000, { ...rules, wishlistMax: null })).toBeNull();
  });
});

describe("wishlistAlertRecipients", () => {
  it("exclut le vendeur, les blocages et les doublons", () => {
    expect(wishlistAlertRecipients(["a", "seller", "b", "a", "c"], "seller", new Set(["b"]))).toEqual(["a", "c"]);
  });
  it("renvoie une liste vide sans acheteur intéressé", () => {
    expect(wishlistAlertRecipients([], "seller", new Set())).toEqual([]);
  });
});
