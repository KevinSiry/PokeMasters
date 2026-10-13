import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Éléments communs aux images générées au build (icône Apple, image de partage).
 * Dessinées par next/og : pas de fichier binaire à maintenir, couleurs de la direction « Arcade prisme ».
 */
export const BRAND = {
  bg: "#0B0716",
  surface: "#170F2A",
  elev: "#231842",
  line: "#2E2152",
  fg: "#F4F1FF",
  muted: "#B3A9D6",
  accent: "#8B6CFF",
  coral: "#FF5C85",
  lime: "#B8F35C",
};

/** Monogramme « carte inclinée » du logo, à la taille demandée. */
export function Monogram({ size }: { size: number }) {
  return (
    <svg width={size} height={(size * 30) / 26} viewBox="0 0 26 30">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={BRAND.accent} />
          <stop offset="1" stopColor={BRAND.coral} />
        </linearGradient>
      </defs>
      <rect x="5" y="1" width="18" height="26" rx="3.5" transform="rotate(8 14 14)" fill={BRAND.elev} stroke={BRAND.line} />
      <rect x="2" y="3" width="18" height="26" rx="3.5" fill="url(#g)" />
      <path d="M11 9.5l1.6 3.3 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.5 3.6-.5z" fill={BRAND.bg} />
    </svg>
  );
}

/** Space Mono gras (WOFF fourni par Fontsource ; next/og ne lit pas le WOFF2). */
export async function spaceMonoBold(): Promise<ArrayBuffer | null> {
  const file = "@fontsource/space-mono/files/space-mono-latin-700-normal.woff";
  for (const root of [path.join(process.cwd(), "node_modules"), path.join(process.cwd(), "../../node_modules")]) {
    try {
      const buf = await readFile(path.join(root, file));
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
    } catch {
      // Essai suivant : dépendances remontées à la racine du monorepo.
    }
  }
  return null;
}
