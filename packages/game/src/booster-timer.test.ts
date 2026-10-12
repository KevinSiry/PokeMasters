import { describe, expect, it } from "vitest";
import {
  NoBoosterAvailableError,
  boosterStatus,
  consumeBooster,
  materializeBoosters,
} from "./booster-timer";

const MIN = 60_000;
const cfg = { refillIntervalMs: 10 * MIN, maxStock: 6 };
const t0 = new Date("2026-01-01T12:00:00Z");
const at = (minutes: number) => new Date(t0.getTime() + minutes * MIN);

describe("materializeBoosters", () => {
  it("crédite un booster par intervalle écoulé et garde le reste de l'intervalle", () => {
    const s = materializeBoosters({ stock: 0, anchorAt: t0 }, at(25), cfg);
    expect(s.stock).toBe(2);
    expect(s.anchorAt).toEqual(at(20));
  });

  it("plafonne le stock et met le minuteur en pause", () => {
    const s = materializeBoosters({ stock: 4, anchorAt: t0 }, at(600), cfg);
    expect(s).toEqual({ stock: 6, anchorAt: at(600) });
  });

  it("ignore une ancre dans le futur (horloge décalée)", () => {
    const s = materializeBoosters({ stock: 2, anchorAt: at(5) }, t0, cfg);
    expect(s.stock).toBe(2);
  });

  it("ramène un stock invalide dans les bornes", () => {
    expect(materializeBoosters({ stock: 99, anchorAt: t0 }, t0, cfg).stock).toBe(6);
    expect(materializeBoosters({ stock: -3, anchorAt: t0 }, t0, cfg).stock).toBe(0);
  });
});

describe("boosterStatus", () => {
  it("annonce la prochaine recharge", () => {
    const st = boosterStatus({ stock: 1, anchorAt: t0 }, at(3), cfg);
    expect(st).toEqual({ available: 1, maxStock: 6, nextAt: at(10) });
  });

  it("n'annonce rien quand le stock est plein", () => {
    expect(boosterStatus({ stock: 6, anchorAt: t0 }, at(3), cfg).nextAt).toBeNull();
  });
});

describe("consumeBooster", () => {
  it("décrémente sans réinitialiser la recharge en cours", () => {
    const s = consumeBooster({ stock: 2, anchorAt: t0 }, at(7), cfg);
    expect(s).toEqual({ stock: 1, anchorAt: t0 });
    // la recharge tombe toujours à t0 + 10 min
    expect(boosterStatus(s, at(10), cfg).available).toBe(2);
  });

  it("redémarre la recharge quand on consomme depuis un stock plein", () => {
    const s = consumeBooster({ stock: 6, anchorAt: t0 }, at(100), cfg);
    expect(s).toEqual({ stock: 5, anchorAt: at(100) });
    expect(boosterStatus(s, at(109), cfg).available).toBe(5);
    expect(boosterStatus(s, at(110), cfg).available).toBe(6);
  });

  it("refuse quand aucun booster n'est disponible", () => {
    expect(() => consumeBooster({ stock: 0, anchorAt: t0 }, at(9), cfg)).toThrow(
      NoBoosterAvailableError,
    );
  });

  it("ne permet jamais plus d'un booster par intervalle sur la durée", () => {
    let state = { stock: 0, anchorAt: t0 };
    let opened = 0;
    // un joueur qui tente d'ouvrir toutes les minutes pendant 24 h
    for (let m = 1; m <= 24 * 60; m++) {
      try {
        state = consumeBooster(state, at(m), cfg);
        opened++;
      } catch (e) {
        expect(e).toBeInstanceOf(NoBoosterAvailableError);
      }
    }
    expect(opened).toBe(144);
  });
});
