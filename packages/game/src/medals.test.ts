import { describe, expect, it } from "vitest";
import { medalLevel, medalsToAward, missionTarget, nextWeekReset, weekKey, weekStart } from "./medals";

const TZ = "Europe/Paris";

describe("médailles", () => {
  it("compte les paliers atteints", () => {
    expect(medalLevel(0, [1, 5, 20])).toBe(0);
    expect(medalLevel(1, [1, 5, 20])).toBe(1);
    expect(medalLevel(19, [1, 5, 20])).toBe(2);
    expect(medalLevel(500, [1, 5, 20])).toBe(3);
  });

  it("ne renvoie que les paliers nouveaux, y compris plusieurs d'un coup", () => {
    const defs = [
      { id: "a", metric: "m1", thresholds: [1, 5, 20] },
      { id: "b", metric: "m2", thresholds: [10, 20, 30] },
    ];
    expect(medalsToAward(defs, { m1: 6, m2: 0 }, new Set(["a:bronze"]))).toEqual([{ medalId: "a", level: "silver" }]);
    expect(medalsToAward(defs, { m1: 0, m2: 30 }, new Set())).toEqual([
      { medalId: "b", level: "bronze" },
      { medalId: "b", level: "silver" },
      { medalId: "b", level: "gold" },
    ]);
  });
});

describe("semaine de guilde", () => {
  it("commence le lundi à minuit, heure de Paris", () => {
    // Dimanche 1er novembre 2026, 23 h 30 à Paris (UTC+1) : encore la semaine du 26 octobre.
    expect(weekKey(new Date("2026-11-01T22:30:00Z"), TZ)).toBe("2026-10-26");
    // Lundi 2 novembre, 0 h 10 à Paris.
    const monday = new Date("2026-11-01T23:10:00Z");
    expect(weekKey(monday, TZ)).toBe("2026-11-02");
    expect(weekStart(monday, TZ).toISOString()).toBe("2026-11-01T23:00:00.000Z");
    expect(nextWeekReset(monday, TZ).toISOString()).toBe("2026-11-08T23:00:00.000Z");
  });

  it("gère le passage à l'heure d'hiver", () => {
    // Semaine du 19 octobre 2026 (heure d'été) : reset le lundi 26 à minuit, heure d'hiver.
    const now = new Date("2026-10-24T10:00:00Z");
    expect(weekStart(now, TZ).toISOString()).toBe("2026-10-18T22:00:00.000Z");
    expect(nextWeekReset(now, TZ).toISOString()).toBe("2026-10-25T23:00:00.000Z");
  });

  it("adapte la cible au nombre de membres", () => {
    expect(missionTarget({ perMember: 10, min: 20 }, 1)).toBe(20);
    expect(missionTarget({ perMember: 10, min: 20 }, 7)).toBe(70);
    expect(missionTarget({ perMember: 0.5, min: 2 }, 5)).toBe(3);
  });
});
