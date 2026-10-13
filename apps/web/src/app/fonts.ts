import localFont from "next/font/local";

/**
 * Polices auto-hébergées (fichiers fournis par Fontsource, sous-ensemble latin qui couvre le français).
 * next/font les précharge et calcule une police de repli aux mêmes métriques : texte affiché tout de suite,
 * sans décalage quand la vraie police arrive.
 */
export const inter = localFont({
  src: "../../../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
  weight: "100 900",
  variable: "--font-inter",
  display: "swap",
});

export const unbounded = localFont({
  src: "../../../../node_modules/@fontsource-variable/unbounded/files/unbounded-latin-wght-normal.woff2",
  weight: "200 900",
  variable: "--font-unbounded",
  display: "swap",
  fallback: ["Arial Black", "system-ui", "sans-serif"],
});

export const spaceMono = localFont({
  src: [
    { path: "../../../../node_modules/@fontsource/space-mono/files/space-mono-latin-400-normal.woff2", weight: "400" },
    { path: "../../../../node_modules/@fontsource/space-mono/files/space-mono-latin-700-normal.woff2", weight: "700" },
  ],
  variable: "--font-space-mono",
  display: "swap",
  // Police des chiffres et des compteurs : pas critique au premier affichage.
  preload: false,
  fallback: ["ui-monospace", "Consolas", "monospace"],
});
