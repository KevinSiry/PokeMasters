import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { colors, contrastRatio, type ColorToken } from "./theme";

const AA_TEXT = 4.5;
const AA_UI = 3;

/** Paires texte / fond réellement utilisées dans l'interface. */
const textPairs: [ColorToken, ColorToken][] = [
  ["fg", "bg"],
  ["fg", "surface"],
  ["fg", "elev"],
  ["muted", "bg"],
  ["muted", "surface"],
  ["muted", "elev"],
  ["fg", "accent-strong"], // texte des boutons principaux (début du dégradé)
  ["fg", "coral-strong"], // texte des boutons principaux (fin du dégradé)
  ["lime", "surface"], // solde de Jetons
  ["accent", "bg"], // liens
  ["danger", "surface"],
  ["tier-common", "surface"],
  ["tier-uncommon", "surface"],
  ["tier-rare", "surface"],
  ["tier-epic", "surface"],
  ["tier-legendary", "surface"],
  ["tier-mythic", "surface"],
];

describe("contrastes AA", () => {
  it.each(textPairs)("%s sur %s ≥ 4.5:1", (fg, bg) => {
    expect(contrastRatio(colors[fg], colors[bg])).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it("l'anneau de focus se distingue du fond (≥ 3:1)", () => {
    expect(contrastRatio(colors.lime, colors.bg)).toBeGreaterThanOrEqual(AA_UI);
  });
});

describe("globals.css", () => {
  const css = readFileSync(path.join(__dirname, "../app/globals.css"), "utf8");
  it.each(Object.entries(colors))("déclare --color-%s: %s", (name, value) => {
    expect(css).toContain(`--color-${name}: ${value};`);
  });
});
