/**
 * Génère apps/web/public/card-back.webp à partir de la source vectorielle
 * apps/web/src/components/booster/card-back.svg (à relancer après chaque retouche du dessin).
 *
 * Le dos est servi en image matricielle : ses filtres SVG (bruit fractal, flou) coûtent une dizaine de
 * fois plus cher à peindre qu'un bitmap, et le navigateur les repeignait à chaque carte qui arrive sur la
 * pile pendant l'ouverture d'un booster (à-coups sur mobile).
 *
 * Usage : npm run render:card-back
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "apps/web/src/components/booster/card-back.svg");
const target = path.join(root, "apps/web/public/card-back.webp");
/** Assez pour la plus grande carte de l'ouverture (300 px CSS) sur un écran ×3. */
const WIDTH = 900;
const HEIGHT = Math.round((WIDTH * 88) / 63);

async function main() {
  const svg = readFileSync(source, "utf8");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const dataUrl = await page.evaluate(
      async ({ svg, width, height }) => {
        const img = new Image();
        img.src = `data:image/svg+xml,${encodeURIComponent(svg)}`;
        await img.decode();
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
        return canvas.toDataURL("image/webp", 0.9);
      },
      { svg, width: WIDTH, height: HEIGHT },
    );
    writeFileSync(target, Buffer.from(dataUrl.split(",")[1]!, "base64"));
    console.log(`${path.relative(root, target)} : ${WIDTH}×${HEIGHT}`);
  } finally {
    await browser.close();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
