import { gameConfig } from "@pokeflex/config";
import { describe, expect, it, vi } from "vitest";
import { checkActionRate } from "./rate-limit";

describe("checkActionRate", () => {
  it("refuse au-delà de la limite, par joueur, puis relâche après la fenêtre", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { count, windowMs } = gameConfig.antiCheat.actionRate.market;
    const t0 = 1_000_000;
    for (let i = 0; i < count; i++) expect(checkActionRate("a", "market", t0 + i)).toBeNull();
    expect(checkActionRate("a", "market", t0 + count)).toMatch(/réessaie dans \d+/);
    expect(checkActionRate("a", "market", t0 + count + 1)).not.toBeNull();
    // Un autre joueur, ou une autre famille d'actions, n'est pas concerné.
    expect(checkActionRate("b", "market", t0 + count)).toBeNull();
    expect(checkActionRate("a", "social", t0 + count)).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(checkActionRate("a", "market", t0 + windowMs + count)).toBeNull();
    warn.mockRestore();
  });
});
