import { describe, expect, it } from "vitest";
import { cleanMessage, guildError, handleError, handleFromName, handleVariant, normalizeGuildTag, rankEntries, RateLimiter } from "./social";

const rules = { handleMinLength: 3, handleMaxLength: 20 };

describe("pseudos", () => {
  it("valide les pseudos", () => {
    expect(handleError("sacha", rules)).toBeNull();
    expect(handleError("sa", rules)).toMatch(/au moins/);
    expect(handleError("Sacha", rules)).toMatch(/minuscules/);
    expect(handleError("-sacha", rules)).toMatch(/commencer/);
    expect(handleError("a".repeat(21), rules)).toMatch(/au plus/);
  });

  it("propose un pseudo depuis le nom affiché", () => {
    expect(handleFromName("Sacha Ketchum", rules)).toBe("sacha-ketchum");
    expect(handleFromName("Élodie_42 !", rules)).toBe("elodie-42");
    expect(handleFromName("Zo", rules)).toBe("dresseur-zo");
    expect(handleFromName(null, rules)).toBe("dresseur");
    expect(handleError(handleFromName("Un nom vraiment très très long pour un pseudo", rules), rules)).toBeNull();
  });

  it("numérote un pseudo déjà pris sans dépasser la longueur", () => {
    expect(handleVariant("sacha", 2, rules)).toBe("sacha-2");
    const v = handleVariant("a".repeat(20), 12, rules);
    expect(v).toHaveLength(20);
    expect(v.endsWith("-12")).toBe(true);
  });
});

describe("guildes", () => {
  it("normalise et valide le sigle", () => {
    expect(normalizeGuildTag("fl-ex")).toBe("FLEX");
    expect(guildError("Les Flex", "FX")).toBeNull();
    expect(guildError("Le", "FX")).toMatch(/nom/);
    expect(guildError("Les Flex", "F")).toMatch(/sigle/);
    expect(guildError("Les Flex", "TOOLONG")).toMatch(/sigle/);
  });
});

describe("messages", () => {
  it("nettoie et borne les messages", () => {
    expect(cleanMessage("  salut   toi  ", 500)).toBe("salut toi");
    expect(cleanMessage("a\n\n\n\nb", 500)).toBe("a\n\nb");
    expect(cleanMessage("   ", 500)).toBeNull();
    expect(cleanMessage("x".repeat(501), 500)).toBeNull();
    expect(cleanMessage("bip\u0007", 500)).toBe("bip");
  });

  it("limite le débit par fenêtre glissante", () => {
    const rl = new RateLimiter(3, 10_000);
    expect([0, 1, 2].map((t) => rl.take("a", t))).toEqual([true, true, true]);
    expect(rl.take("a", 5_000)).toBe(false);
    expect(rl.take("b", 5_000)).toBe(true);
    expect(rl.retryIn("a", 5_000)).toBe(5_000);
    expect(rl.take("a", 10_001)).toBe(true);
  });
});

describe("classements", () => {
  it("donne le même rang aux ex aequo", () => {
    const r = rankEntries([
      { id: "a", value: 5 },
      { id: "b", value: 9 },
      { id: "c", value: 5 },
      { id: "d", value: 1 },
    ]);
    expect(r.map((x) => [x.entry.id, x.rank])).toEqual([
      ["b", 1],
      ["a", 2],
      ["c", 2],
      ["d", 4],
    ]);
  });
});
