/**
 * Jetons de couleur de la direction « Arcade prisme ».
 * Source de vérité pour les tests de contraste ; `globals.css` doit reprendre
 * exactement ces valeurs (vérifié par `theme.test.ts`).
 */
export const colors = {
  bg: "#0B0716",
  surface: "#170F2A",
  elev: "#231842",
  line: "#2E2152",
  fg: "#F4F1FF",
  muted: "#B3A9D6",
  accent: "#8B6CFF",
  "accent-strong": "#6A45F0",
  coral: "#FF5C85",
  "coral-strong": "#C42A5A",
  lime: "#B8F35C",
  danger: "#FF6B6B",
  "tier-common": "#9AA3B5",
  "tier-uncommon": "#5CC98A",
  "tier-rare": "#4EA8F5",
  "tier-epic": "#B57CF7",
  "tier-legendary": "#F5A524",
  "tier-mythic": "#FFD86B",
} as const;

export type ColorToken = keyof typeof colors;

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`Couleur invalide : ${hex}`);
  const n = parseInt(m[1]!, 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

/** Ratio de contraste WCAG 2.1 entre deux couleurs. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
