import { describe, expect, it } from "vitest";
import { readSessionToken, resolveUserId, type SessionLookup } from "./auth";

describe("readSessionToken", () => {
  it("lit le cookie de session Auth.js", () => {
    expect(readSessionToken("foo=1; authjs.session-token=abc123; bar=2")).toBe("abc123");
  });

  it("préfère le cookie sécurisé (HTTPS)", () => {
    expect(
      readSessionToken("authjs.session-token=plain; __Secure-authjs.session-token=secure"),
    ).toBe("secure");
  });

  it("décode les valeurs encodées et tolère les cookies malformés", () => {
    expect(readSessionToken("junk; authjs.session-token=a%2Bb")).toBe("a+b");
  });

  it("renvoie null sans cookie", () => {
    expect(readSessionToken(undefined)).toBeNull();
    expect(readSessionToken("other=1")).toBeNull();
  });
});

describe("resolveUserId", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  const lookup = (expires: Date): SessionLookup => ({
    findSession: async (token) => (token === "good" ? { userId: "u1", expires } : null),
  });

  it("renvoie le joueur d'une session valide", async () => {
    const id = await resolveUserId("authjs.session-token=good", lookup(new Date("2026-02-01")), now);
    expect(id).toBe("u1");
  });

  it("refuse une session expirée ou inconnue", async () => {
    expect(
      await resolveUserId("authjs.session-token=good", lookup(new Date("2025-12-01")), now),
    ).toBeNull();
    expect(
      await resolveUserId("authjs.session-token=bad", lookup(new Date("2026-02-01")), now),
    ).toBeNull();
  });
});
