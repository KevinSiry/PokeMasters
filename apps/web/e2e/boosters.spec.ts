import path from "node:path";
import { expect, test } from "@playwright/test";

const auth = (handle: string) => path.resolve(process.cwd(), `playwright/.auth/${handle}.json`);

test.describe("boosters et collection", () => {
  test.describe.configure({ mode: "serial" });

  test("un visiteur est envoyé vers la connexion", async ({ page }) => {
    await page.goto("/boosters");
    await expect(page).toHaveURL(/\/connexion\?suite=%2Fboosters|\/connexion\?suite=\/boosters/);
  });

  test.describe("joueur connecté", () => {
    test.use({ storageState: auth("demo-dresseur") });

    test("ouvre un booster et révèle les 5 cartes", async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/boosters");
      await page.getByRole("button", { name: "Ouvrir le booster" }).click();
      for (let i = 0; i < 5; i++) {
        await page.getByRole("button", { name: "Retourner la carte" }).click();
        await page.getByRole("button", { name: /Carte suivante/ }).click();
      }
      await expect(page.getByRole("heading", { name: "Ton booster" })).toBeVisible();
      await expect(page.getByText(/Meilleure carte/)).toBeVisible();
    });

    test("la collection montre les cartes obtenues", async ({ page }) => {
      await page.goto("/collection?vue=cartes");
      await expect(page.getByRole("heading", { name: "Ma collection" })).toBeVisible();
      await expect(page.locator("main ul li a").first()).toBeVisible();
    });
  });

  test.describe("collection remplie", () => {
    test.use({ storageState: auth("demo-collection") });

    test("affiche la progression par set et le Pokédex", async ({ page }) => {
      await page.goto("/collection");
      await expect(page.getByRole("progressbar").first()).toBeVisible();
      await page.getByRole("link", { name: "Pokédex" }).click();
      await expect(page.getByText(/Pokémon sur 151 de Kanto/)).toBeVisible();
    });
  });
});
