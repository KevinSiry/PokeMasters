import { describe, expect, it } from "vitest";
import { shouldRunDailySync } from "./jobs";

describe("shouldRunDailySync", () => {
  const now = new Date("2026-10-12T12:00:00Z");
  it("lance la première synchro", () => expect(shouldRunDailySync(null, now)).toBe(true));
  it("attend 24 h entre deux synchros", () => {
    expect(shouldRunDailySync(new Date("2026-10-12T00:00:00Z"), now)).toBe(false);
    expect(shouldRunDailySync(new Date("2026-10-11T11:59:00Z"), now)).toBe(true);
  });
});
