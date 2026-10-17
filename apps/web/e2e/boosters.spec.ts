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

    test("ouvre un booster et révèle les 5 cartes", async ({ page, isMobile }) => {
      // Sur mobile, le parcours animé complet (déchirure, sortie des cartes) ; sur ordinateur, animations réduites.
      if (!isMobile) await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/boosters");
      await page.getByRole("button", { name: "Ouvrir le booster" }).click();
      if (isMobile) await page.getByRole("button", { name: "Déchirer le booster" }).click();
      for (let i = 0; i < 5; i++) {
        await page.getByRole("button", { name: "Retourner la carte" }).click();
        if (i === 0) {
          // Favori dès la révélation : l'étoile se coche sans faire passer à la carte suivante.
          const star = page.getByRole("button", { name: /^(Mettre .+ en favori|Retirer .+ de tes favoris)$/ });
          const wasOn = (await star.getAttribute("aria-pressed")) === "true";
          await star.click();
          await expect(star).toHaveAttribute("aria-pressed", String(!wasOn));
          await expect(page.getByRole("button", { name: /Carte suivante/ })).toBeVisible();
          if (wasOn) await star.click();
        }
        await page.getByRole("button", { name: /Carte suivante/ }).click();
      }
      await expect(page.getByRole("heading", { name: "Ton booster" })).toBeVisible();
      await expect(page.getByText(/Meilleure carte/)).toBeVisible();
      await expect(page.getByRole("button", { name: /^Retirer .+ de tes favoris$/ }).first()).toBeVisible();
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

    test("pagine la grille de cartes sans perdre le tri", async ({ page }) => {
      await page.goto("/collection?vue=cartes&tri=name");
      await expect(page.getByText(/^Cartes 1 à 60 sur \d/)).toBeVisible();
      await expect(page.locator("main ul.grid > li")).toHaveCount(60);
      const first = await page.locator("main ul.grid > li").first().textContent();
      await page.getByRole("link", { name: "Page suivante" }).click();
      await expect(page).toHaveURL(/tri=name&page=2/);
      await expect(page.getByText(/^Cartes 61 à /)).toBeVisible();
      expect(await page.locator("main ul.grid > li").first().textContent()).not.toBe(first);
      await expect(page.getByRole("link", { name: "Page précédente" })).toBeVisible();
    });
  });
});
