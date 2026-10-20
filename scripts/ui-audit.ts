/**
 * Audit d'interface : chaque page principale à 360, 390, 768, 1280 et 1920 px de large.
 * Relève le débordement horizontal, les zones tactiles de moins de 44 px, les contrôles sans libellé
 * et les images sans texte alternatif, puis enregistre une capture pleine page de chacune.
 *
 * Le site doit tourner (npm run build puis npm run start, ou docker compose up) avec les comptes de démo.
 *
 * Usage : npm run audit:ui -- --out <dossier> [--only /marche,/collection] [--widths 360,1280] [--no-shots]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium, type Browser, type Page } from "@playwright/test";
import { prisma } from "@pokeflex/db";
import globalSetup, { AUTH_DIR } from "../apps/web/e2e/global-setup";
import { imagesWithoutAlt, MIN_TOUCH_TARGET, overflowX, smallTargets, unnamedControls, type SmallTarget } from "../apps/web/e2e/ui-checks";

const BASE = process.env.AUDIT_URL ?? `http://localhost:${process.env.E2E_PORT ?? 3000}`;
const WIDTHS = [360, 390, 768, 1280, 1920];

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

interface PageSpec {
  /** Nom de fichier de la capture. */
  name: string;
  url: string;
  /** Compte de démo connecté, sinon visiteur. */
  as?: string;
}

async function pages(): Promise<PageSpec[]> {
  const listing = await prisma.listing.findFirst({ where: { status: "active" }, select: { id: true } });
  const guild = await prisma.guild.findFirst({ select: { id: true } });
  const me = "demo-collection";
  const list: PageSpec[] = [
    { name: "accueil-visiteur", url: "/" },
    { name: "connexion", url: "/connexion" },
    { name: "accueil", url: "/", as: me },
    { name: "catalogue", url: "/catalogue", as: me },
    { name: "set", url: "/catalogue/base1", as: me },
    { name: "carte", url: "/cartes/base1-4", as: me },
    { name: "recherche", url: "/recherche?q=dra", as: me },
    { name: "collection", url: "/collection", as: me },
    { name: "collection-favoris", url: "/collection?vue=favoris", as: me },
    { name: "boosters", url: "/boosters", as: me },
    { name: "boosters-sets", url: "/boosters/sets", as: me },
    { name: "booster-set", url: "/boosters/sets/base1", as: me },
    { name: "marche", url: "/marche", as: me },
    { name: "mes-ventes", url: "/marche/mes-ventes", as: me },
    { name: "mes-encheres", url: "/marche/mes-encheres", as: me },
    { name: "echanges", url: "/echanges", as: me },
    { name: "echange-nouveau", url: "/echanges/nouveau?avec=demo-marchand", as: me },
    { name: "classements", url: "/classements", as: me },
    { name: "amis", url: "/amis", as: me },
    { name: "guildes", url: "/guildes", as: me },
    { name: "messages", url: "/messages", as: me },
    { name: "conversation", url: "/messages/demo-marchand", as: me },
    { name: "profil", url: "/profil", as: me },
    { name: "jetons", url: "/jetons", as: me },
    { name: "joueur", url: "/joueurs/demo-marchand", as: me },
    { name: "a-propos", url: "/a-propos", as: me },
    { name: "introuvable", url: "/page-qui-n-existe-pas", as: me },
  ];
  if (listing) list.push({ name: "annonce", url: `/marche/${listing.id}`, as: me });
  if (guild) list.push({ name: "guilde", url: `/guildes/${guild.id}`, as: me });
  return list;
}

interface Finding {
  overflow: number;
  smallTargets: SmallTarget[];
  unnamed: string[];
  imgNoAlt: number;
}

async function inspect(page: Page, touch: boolean): Promise<Finding> {
  return {
    overflow: await overflowX(page),
    // À la souris, la cible minimale WCAG AA (2.5.8) est de 24 px ; au doigt, on vise 44 px.
    smallTargets: await smallTargets(page, touch ? MIN_TOUCH_TARGET : 24),
    unnamed: await unnamedControls(page),
    imgNoAlt: await imagesWithoutAlt(page),
  };
}

async function main() {
  const out = arg("out");
  if (!out) throw new Error("Précise le dossier des captures : --out <dossier>");
  const only = arg("only")?.split(",");
  const widths = arg("widths")?.split(",").map(Number) ?? WIDTHS;
  const shots = !process.argv.includes("--no-shots");
  mkdirSync(out, { recursive: true });
  await globalSetup();
  const specs = (await pages()).filter((p) => !only || only.some((o) => p.url.startsWith(o)));
  await prisma.$disconnect();

  const browser: Browser = await chromium.launch(
    process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  );
  const report: Record<string, Record<number, Finding>> = {};
  try {
    for (const width of widths) {
      const mobile = width < 768;
      // Téléphones et tablettes : écran tactile.
      const touch = width < 1024;
      for (const as of [undefined, "demo-collection"]) {
        const context = await browser.newContext({
          viewport: { width, height: mobile ? 800 : 900 },
          deviceScaleFactor: mobile ? 2 : 1,
          isMobile: touch,
          hasTouch: touch,
          reducedMotion: "reduce",
          storageState: as ? path.join(AUTH_DIR, `${as}.json`) : undefined,
        });
        // tsx (esbuild) entoure les fonctions nommées d'un appel à __name, absent de la page.
        await context.addInitScript("window.__name = (f) => f;");
        // Le halo de fond est fixe : en capture pleine page, il ne couvrirait que le premier écran.
        await context.addInitScript(() => {
          addEventListener("DOMContentLoaded", () => {
            const style = document.createElement("style");
            style.textContent = "body { background-attachment: scroll !important; }";
            document.head.append(style);
          });
        });
        const page = await context.newPage();
        for (const spec of specs.filter((s) => s.as === as)) {
          await page.goto(BASE + spec.url, { waitUntil: "networkidle" }).catch(() => page.waitForLoadState("load"));
          await page.waitForTimeout(300);
          (report[spec.name] ??= {})[width] = await inspect(page, touch);
          if (shots) {
            await page.screenshot({ path: path.join(out, `${spec.name}-${width}.png`), fullPage: true, animations: "disabled" });
          }
          process.stdout.write(".");
        }
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  process.stdout.write("\n");

  const lines = ["| Page | Largeur | Débordement | Cibles trop petites | Sans libellé | Images sans alt |", "|---|---|---|---|---|---|"];
  for (const [name, byWidth] of Object.entries(report)) {
    for (const [w, f] of Object.entries(byWidth)) {
      lines.push(`| ${name} | ${w} | ${f.overflow > 0 ? `**${f.overflow} px**` : "0"} | ${f.smallTargets.length} | ${f.unnamed.length} | ${f.imgNoAlt} |`);
    }
  }
  writeFileSync(path.join(out, "audit.md"), lines.join("\n") + "\n");
  writeFileSync(path.join(out, "audit.json"), JSON.stringify(report, null, 2));
  console.log(`Rapport : ${path.join(out, "audit.md")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
