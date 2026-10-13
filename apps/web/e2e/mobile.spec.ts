import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const auth = (handle: string) => path.resolve(process.cwd(), `playwright/.auth/${handle}.json`);

/**
 * Débordement horizontal mesuré contre la largeur de l'écran émulé : sur mobile, le navigateur
 * élargit la fenêtre au contenu (et dézoome toute la page), donc window.innerWidth ne suffit pas.
 */
async function overflowX(page: Page) {
  const width = page.viewportSize()!.width;
  return (await page.evaluate(() => document.documentElement.scrollWidth)) - width;
}

const PAGES = [
  "/",
  "/catalogue",
  "/catalogue/base1",
  "/cartes/base1-4",
  "/recherche?q=dra",
  "/collection",
  "/marche",
  "/classements",
  "/amis",
  "/guildes",
  "/messages",
  "/profil",
  "/jetons",
  "/joueurs/demo-marchand",
];

test.describe("affichage mobile", () => {
  test.describe("joueur connecté", () => {
    // 360 px : la largeur des Android les plus répandus, plus étroite que l'écran émulé par défaut.
    test.use({ storageState: auth("demo-collection"), viewport: { width: 360, height: 760 } });

    for (const url of PAGES) {
      test(`${url} tient dans la largeur de l'écran`, async ({ page }) => {
        await page.goto(url);
        await expect(page.getByRole("banner")).toBeVisible();
        expect(await overflowX(page)).toBeLessThanOrEqual(0);
      });
    }

    test("la barre du bas mène aux pages principales sur téléphone", async ({ page, isMobile }) => {
      test.skip(!isMobile, "barre d'onglets réservée aux petits écrans");
      await page.goto("/");
      const tabs = page.locator("nav.fixed").getByRole("link");
      // Le nombre de boosters prêts s'affiche en pastille devant le libellé « Boosters ».
      await expect(tabs).toHaveText([/^Accueil$/, /^Catalogue$/, /^\d*Boosters$/, /^Collection$/, /^Marché$/]);
      await tabs.filter({ hasText: "Collection" }).click();
      await expect(page).toHaveURL(/\/collection$/);
      await expect(tabs.filter({ hasText: "Collection" })).toHaveAttribute("aria-current", "page");
    });
  });

  test("les pages visiteur tiennent dans la largeur de l'écran", async ({ page }) => {
    for (const url of ["/", "/catalogue", "/marche", "/connexion"]) {
      await page.goto(url);
      expect(await overflowX(page), url).toBeLessThanOrEqual(0);
    }
  });
});
