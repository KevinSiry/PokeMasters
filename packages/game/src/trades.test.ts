import { gameConfig } from "@pokeflex/config";
import { describe, expect, it } from "vitest";
import { cleanTradeMessage, isTradeExpired, tradeActionError, tradeOfferError } from "./trades";

const rules = gameConfig.trades;

describe("tradeOfferError", () => {
  it("accepte une carte contre une carte", () => {
    expect(tradeOfferError({ give: ["a"], take: ["b"] }, rules)).toBeNull();
  });
  it("refuse un côté vide (pas de don)", () => {
    expect(tradeOfferError({ give: [], take: ["b"] }, rules)).toContain("carte contre carte");
    expect(tradeOfferError({ give: ["a"], take: [] }, rules)).toContain("carte contre carte");
  });
  it("limite le nombre de cartes de chaque côté", () => {
    const many = Array.from({ length: rules.maxCardsPerSide + 1 }, (_, i) => `c${i}`);
    expect(tradeOfferError({ give: many, take: ["x"] }, rules)).toContain(`${rules.maxCardsPerSide} cartes`);
    expect(tradeOfferError({ give: ["x"], take: many }, rules)).toContain(`${rules.maxCardsPerSide} cartes`);
  });
  it("refuse un exemplaire en double", () => {
    expect(tradeOfferError({ give: ["a", "a"], take: ["b"] }, rules)).toContain("deux fois");
    expect(tradeOfferError({ give: ["a"], take: ["a"] }, rules)).toContain("deux fois");
  });
});

describe("cleanTradeMessage", () => {
  it("retire les espaces superflus et renvoie null si vide", () => {
    expect(cleanTradeMessage("  salut \n  toi ", rules)).toBe("salut toi");
    expect(cleanTradeMessage("   ", rules)).toBeNull();
    expect(cleanTradeMessage(undefined, rules)).toBeNull();
  });
  it("tronque à la longueur maximale", () => {
    expect(cleanTradeMessage("x".repeat(rules.messageMaxLength + 50), rules)).toHaveLength(rules.messageMaxLength);
  });
});

describe("tradeActionError", () => {
  const now = new Date("2026-10-13T12:00:00Z");
  const trade = { status: "pending", proposerId: "p", recipientId: "r", expiresAt: new Date("2026-10-14T12:00:00Z") };

  it("laisse le destinataire répondre et l'auteur annuler", () => {
    for (const a of ["accept", "decline", "counter"] as const) expect(tradeActionError(trade, "r", a, now)).toBeNull();
    expect(tradeActionError(trade, "p", "cancel", now)).toBeNull();
  });
  it("interdit à l'auteur de répondre à sa propre offre, et au destinataire de l'annuler", () => {
    expect(tradeActionError(trade, "p", "accept", now)).not.toBeNull();
    expect(tradeActionError(trade, "r", "cancel", now)).not.toBeNull();
  });
  it("ignore les joueurs extérieurs à l'échange", () => {
    expect(tradeActionError(trade, "x", "accept", now)).toBe("Échange introuvable.");
  });
  it("refuse toute action sur une offre close ou expirée", () => {
    expect(tradeActionError({ ...trade, status: "accepted" }, "r", "accept", now)).toContain("plus en attente");
    expect(tradeActionError({ ...trade, expiresAt: now }, "r", "accept", now)).toContain("plus en attente");
  });
});

describe("isTradeExpired", () => {
  it("expire à l'échéance exacte", () => {
    const t = new Date("2026-10-13T12:00:00Z");
    expect(isTradeExpired(t, new Date(t.getTime() - 1))).toBe(false);
    expect(isTradeExpired(t, t)).toBe(true);
  });
});
