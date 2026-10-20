import { describe, expect, it } from "vitest";
import { firstParam, ledgerCursor, safeInternalPath } from "./params";

describe("firstParam", () => {
  it("garde la première valeur d'un paramètre répété (?q=a&q=b) au lieu d'un tableau", () => {
    expect(firstParam(["pika", "chu"])).toBe("pika");
    expect(firstParam("dracaufeu")).toBe("dracaufeu");
    expect(firstParam(undefined, "x")).toBe("x");
    expect(firstParam([], "x")).toBe("x");
  });

  it("borne la longueur", () => {
    expect(firstParam("a".repeat(500), "", 80)).toHaveLength(80);
  });
});

describe("safeInternalPath", () => {
  it("garde un chemin interne, avec sa requête", () => {
    expect(safeInternalPath("/echanges/nouveau?avec=sacha")).toBe("/echanges/nouveau?avec=sacha");
    expect(safeInternalPath("/")).toBe("/");
  });

  it("refuse toute redirection vers un autre site", () => {
    for (const evil of ["https://evil.example", "//evil.example", "/\\evil.example", "/\\/evil.example", "\\\\evil.example", "/\tevil", "javascript:alert(1)", ""]) {
      expect(safeInternalPath(evil), evil).toBe("/");
    }
  });

  it("accepte un paramètre répété sans planter", () => {
    expect(safeInternalPath(["/marche", "//evil.example"])).toBe("/marche");
    expect(safeInternalPath(undefined)).toBe("/");
  });
});

describe("ledgerCursor", () => {
  it("lit un identifiant de registre valide", () => {
    expect(ledgerCursor("42")).toBe(42n);
    expect(ledgerCursor("9223372036854775807")).toBe(9223372036854775807n);
  });

  it("ignore un curseur hors des bornes d'un BIGINT au lieu de faire planter la page", () => {
    expect(ledgerCursor("9223372036854775808")).toBeUndefined();
    expect(ledgerCursor("99999999999999999999999")).toBeUndefined();
    expect(ledgerCursor("0")).toBeUndefined();
    expect(ledgerCursor("-3")).toBeUndefined();
    expect(ledgerCursor(["12", "13"])).toBe(12n);
  });
});
