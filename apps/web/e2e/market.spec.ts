import path from "node:path";
import { expect, test } from "@playwright/test";

const auth = (handle: string) => path.resolve(process.cwd(), `playwright/.auth/${handle}.json`);

test.describe("marché", () => {
  test("un visiteur voit les annonces et la fiche d'une annonce", async ({ page }) => {
    await page.goto("/marche");
    await expect(page.getByRole("heading", { name: "Marché" })).toBeVisible();
    await page.locator('main a[href^="/marche/c"]').first().click();
    await expect(page.getByRole("heading", { name: "Cote de la carte" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Se connecter pour (acheter|enchérir)/ })).toBeVisible();
  });

  test.describe("joueur connecté", () => {
    test.use({ storageState: auth("demo-collection") });
    // Parcours qui modifient la base : joués une seule fois, sur ordinateur, dans l'ordre.
    test.describe.configure({ mode: "serial" });
    test.skip(({ isMobile }) => isMobile, "parcours joué une seule fois, sur ordinateur");

    test("achète une carte au prix fixe", async ({ page }) => {
      await page.goto("/marche?type=fixed&tri=price_asc");
      await page.locator('main a[href^="/marche/c"]').first().click();
      await expect(page.getByRole("heading", { name: "Cote de la carte" })).toBeVisible();
      await expect(page.getByText(/^(Déjà obtenue ·|Pas encore obtenue$)/)).toBeVisible();
      await page.getByRole("button", { name: "Acheter" }).click();
      await page.getByRole("dialog").getByRole("button", { name: /Payer/ }).click();
      await expect(page.getByRole("heading", { name: "Carte achetée !" })).toBeVisible();
      await page.reload();
      await expect(page.getByRole("link", { name: /Déjà obtenue/ })).toBeVisible();
    });

    test("enchérit sur une enchère", async ({ page }) => {
      await page.goto("/marche?type=auction");
      await page.locator('main a[href^="/marche/c"]').first().click();
      await page.getByRole("button", { name: /^Enchérir/ }).click();
      await expect(page.getByText("Tu es le meilleur enchérisseur.", { exact: false }).first()).toBeVisible();
      await page.goto("/marche/mes-encheres");
      await expect(page.getByText("En tête").first()).toBeVisible();
    });

    test("met une carte en vente depuis sa fiche, puis la retire", async ({ page }) => {
      await page.goto("/collection?vue=cartes");
      await page.locator("main ul li a").first().click();
      await page.getByRole("button", { name: /Dans ta collection/ }).click();
      await page.getByRole("button", { name: "Vendre" }).first().click();
      const dialog = page.getByRole("dialog");
      await dialog.getByRole("spinbutton").fill("42");
      await dialog.getByRole("button", { name: /Mettre en vente/ }).click();
      await expect(page.getByText("Carte mise en vente")).toBeVisible();
      await page.goto("/marche/mes-ventes");
      await page.getByRole("button", { name: "Retirer" }).first().click();
      await expect(page.getByText("Annonce retirée")).toBeVisible();
    });
  });
});
