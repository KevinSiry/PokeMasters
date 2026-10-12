import { gameConfig } from "@pokeflex/config";
import { describe, expect, it } from "vitest";
import { advanceQuest, nextQuestReset, pickDailyQuests, questDay } from "./quests";

const tz = "Europe/Paris";

describe("questDay", () => {
  it("suit le fuseau de Paris", () => {
    expect(questDay(new Date("2026-10-12T21:59:00Z"), tz)).toBe("2026-10-12");
    expect(questDay(new Date("2026-10-12T22:00:00Z"), tz)).toBe("2026-10-13"); // minuit à Paris (UTC+2)
    expect(questDay(new Date("2026-01-15T23:30:00Z"), tz)).toBe("2026-01-16"); // UTC+1 en hiver
  });
});

describe("nextQuestReset", () => {
  it("tombe à minuit heure de Paris", () => {
    expect(nextQuestReset(new Date("2026-10-12T10:17:33Z"), tz).toISOString()).toBe("2026-10-12T22:00:00.000Z");
    expect(nextQuestReset(new Date("2026-01-15T08:00:00Z"), tz).toISOString()).toBe("2026-01-15T23:00:00.000Z");
  });
  it("gère le passage à l'heure d'hiver", () => {
    // Nuit du 24 au 25 octobre 2026 : minuit du 25 est encore en heure d'été.
    expect(nextQuestReset(new Date("2026-10-24T12:00:00Z"), tz).toISOString()).toBe("2026-10-24T22:00:00.000Z");
    expect(nextQuestReset(new Date("2026-10-25T12:00:00Z"), tz).toISOString()).toBe("2026-10-25T23:00:00.000Z");
  });
});

describe("pickDailyQuests", () => {
  const templates = [
    { kind: "a", target: 1, reward: 1, labelFr: "A", enabled: true },
    { kind: "b", target: 1, reward: 1, labelFr: "B", enabled: true },
    { kind: "c", target: 1, reward: 1, labelFr: "C", enabled: true },
    { kind: "d", target: 1, reward: 1, labelFr: "D", enabled: true },
    { kind: "off", target: 1, reward: 1, labelFr: "Off", enabled: false },
  ];
  it("choisit perDay quêtes actives, toujours les mêmes pour un jour donné", () => {
    const q = pickDailyQuests("2026-10-12", templates, 3);
    expect(q).toHaveLength(3);
    expect(q.map((t) => t.kind)).not.toContain("off");
    expect(pickDailyQuests("2026-10-12", templates, 3)).toEqual(q);
  });
  it("varie d'un jour à l'autre", () => {
    const days = Array.from({ length: 20 }, (_, i) => `2026-11-${String(i + 1).padStart(2, "0")}`);
    const sets = new Set(days.map((d) => pickDailyQuests(d, templates, 3).map((t) => t.kind).join()));
    expect(sets.size).toBeGreaterThan(1);
  });
  it("garde toutes les quêtes actives de la config tant qu'il y en a perDay ou moins", () => {
    const q = pickDailyQuests("2026-10-12", gameConfig.quests.templates, gameConfig.quests.perDay);
    expect(q.map((t) => t.kind)).toEqual(["open_boosters", "recycle_cards", "new_cards"]);
  });
});

describe("advanceQuest", () => {
  it("plafonne à la cible", () => {
    expect(advanceQuest(3, 5, 1)).toBe(4);
    expect(advanceQuest(4, 5, 10)).toBe(5);
    expect(advanceQuest(0, 5, -3)).toBe(0);
  });
});
