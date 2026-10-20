import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { overflowX, smallTargets } from "./ui-checks";

const auth = (handle: string) => path.resolve(process.cwd(), `playwright/.auth/${handle}.json`);

/** Pages principales vérifiées à chaque largeur (joueur connecté). */
const PAGES = [
  "/",
  "/catalogue",
  "/catalogue/base1",
  "/cartes/base1-4",
  "/recherche?q=dra",
  "/collection",
  "/collection?vue=cartes",
  "/boosters",
  "/boosters/sets",
  "/marche",
  "/marche/mes-ventes",
  "/echanges",
  "/echanges/nouveau?avec=demo-marchand",
  "/classements",
  "/amis",
  "/guildes",
  "/messages",
  "/profil",
  "/jetons",
  "/joueurs/demo-marchand",
];

/** Téléphone Android courant, iPhone, tablette, portable, grand écran. */
const WIDTHS = [360, 390, 768, 1280, 1920];

const visible = async (page: Page, selector: string) => page.locator(selector).first().isVisible();

// Les largeurs sont fixées par chaque test : inutile de les rejouer dans les deux projets.
test.describe("mise en page à toutes les largeurs", () => {
  test.use({ storageState: auth("demo-collection") });
  test.beforeEach(({ isMobile }) => test.skip(isMobile, "largeurs fixées par le test"));

  for (const width of WIDTHS) {
    test(`aucune page ne déborde à ${width} px`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width, height: 900 });
      for (const url of PAGES) {
        await page.goto(url);
        await expect(page.getByRole("banner")).toBeVisible();
        expect(await overflowX(page), url).toBeLessThanOrEqual(0);
      }
    });
  }

  test("barre du bas sur téléphone et tablette, barre latérale sur ordinateur", async ({ page }) => {
    for (const width of [360, 768]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/collection");
      expect(await visible(page, "nav.fixed"), `${width} px`).toBe(true);
      expect(await visible(page, "aside nav"), `${width} px`).toBe(false);
    }
    for (const width of [1024, 1280, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/collection");
      expect(await visible(page, "nav.fixed"), `${width} px`).toBe(false);
      const side = page.locator("aside").getByRole("navigation", { name: "Navigation principale" });
      await expect(side).toBeVisible();
      await expect(side.getByRole("link", { name: "Collection" })).toHaveAttribute("aria-current", "page");
      // Échanges, Amis et Guildes sont à un clic sur ordinateur (dans le menu du joueur sur téléphone).
      await expect(side.getByRole("link", { name: /^Échanges/ })).toBeVisible();
      await expect(side.getByRole("link", { name: /^Amis/ })).toBeVisible();
    }
  });

  test("les éléments de l'en-tête ne se chevauchent pas", async ({ page }) => {
    for (const width of [360, 768, 1024, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      const boxes = await page.evaluate(() =>
        [...document.querySelectorAll("header a[href], header button, header input")]
          .map((el) => el.getBoundingClientRect())
          .filter((r) => r.width > 1 && r.height > 1)
          .map((r) => ({ l: r.left, r: r.right, t: r.top, b: r.bottom })),
      );
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const [a, b] = [boxes[i]!, boxes[j]!];
          const overlap = a.l < b.r - 1 && b.l < a.r - 1 && a.t < b.b - 1 && b.t < a.b - 1;
          expect(overlap, `${width} px : éléments ${i} et ${j} de l'en-tête`).toBe(false);
        }
      }
    }
  });
  test("le contenu s'élargit sur grand écran", async ({ page }) => {
    const columns = async () =>
      page.evaluate(() => getComputedStyle(document.querySelector(".pf-card-grid")!).gridTemplateColumns.split(" ").length);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/catalogue/base1");
    const laptop = await columns();
    await page.setViewportSize({ width: 1920, height: 900 });
    expect(await columns()).toBeGreaterThan(laptop);
  });
});

test.describe("zones tactiles", () => {
  test.use({ storageState: auth("demo-collection") });
  test.beforeEach(({ isMobile }) => test.skip(!isMobile, "écran tactile"));

  test("en-tête, barre du bas et pied de page offrent 44 px au doigt", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 760 });
    for (const url of ["/", "/cartes/base1-4", "/marche"]) {
      await page.goto(url);
      expect(await smallTargets(page, 44, "header, nav.fixed, footer"), url).toEqual([]);
    }
  });

  test("catalogue, fiche, recherche et collection offrent 44 px au doigt", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 760 });
    for (const url of ["/catalogue", "/catalogue/base1", "/cartes/base1-4", "/recherche?q=dra", "/collection", "/collection?vue=cartes", "/collection?vue=pokedex"]) {
      await page.goto(url);
      expect(await smallTargets(page, 44, "main"), url).toEqual([]);
    }
  });

  test.describe("ouverture de booster", () => {
    test.use({ storageState: auth("demo-dresseur") });

    test("boutiques, révélation et récapitulatif offrent 44 px au doigt", async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 760 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      for (const url of ["/boosters/sets", "/boosters/sets/base1"]) {
        await page.goto(url);
        expect(await smallTargets(page, 44, "main"), url).toEqual([]);
      }
      await page.goto("/boosters");
      expect(await smallTargets(page, 44, "main"), "/boosters").toEqual([]);
      await page.getByRole("button", { name: "Ouvrir le booster" }).click();
      await page.getByRole("button", { name: "Retourner la carte" }).click();
      await expect(page.getByRole("button", { name: /Carte suivante/ })).toBeVisible();
      expect(await smallTargets(page, 44, "main"), "révélation").toEqual([]);
      await page.getByRole("button", { name: "Tout révéler" }).click();
      await expect(page.getByRole("heading", { name: "Ton booster" })).toBeVisible();
      expect(await smallTargets(page, 44, "main"), "récapitulatif").toEqual([]);
    });
  });
});
