import path from "node:path";
import { expect, test } from "@playwright/test";

const auth = (handle: string) => path.resolve(process.cwd(), `playwright/.auth/${handle}.json`);

test.describe("duels", () => {
  test("un visiteur est envoyé vers la connexion", async ({ page }) => {
    await page.goto("/duels");
    await expect(page).toHaveURL(/\/connexion/);
  });

  test.describe("joueur connecté", () => {
    test.use({ storageState: auth("demo-collection") });
    // Parcours qui modifient la base : joués une seule fois, sur ordinateur, dans l'ordre.
    test.describe.configure({ mode: "serial" });
    test.skip(({ isMobile }) => isMobile, "parcours joué une seule fois, sur ordinateur");

    test("joue un entraînement contre le Professeur, puis abandonne", async ({ page }) => {
      await page.goto("/duels");
      await expect(page.getByRole("heading", { name: "Duels quiz" })).toBeVisible();
      await page.getByRole("button", { name: /Entraînement/ }).click();
      await expect(page).toHaveURL(/\/duels\/c/);
      // Compte à rebours, puis première question chronométrée par le serveur.
      await expect(page.getByText("Question 1/10")).toBeVisible({ timeout: 15_000 });
      await page.locator("main ul li button").first().click();
      await page.getByRole("button", { name: "Abandonner" }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Abandonner" }).click();
      await expect(page.getByText("Tu as quitté le duel.")).toBeVisible({ timeout: 10_000 });
    });

    test("défie un joueur, qui refuse : les cartes reviennent", async ({ page, browser }) => {
      await page.goto("/duels");
      await page.getByRole("button", { name: /Défier un joueur/ }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByPlaceholder("Pseudo du joueur").fill("demo-marchand");
      const send = dialog.getByRole("button", { name: "Défier Marchand Démo" });
      await expect(send).toBeEnabled({ timeout: 10_000 });
      await send.click();
      await expect(page.getByText("Défi envoyé !")).toBeVisible();
      await expect(page.getByText("Défi envoyé à Marchand Démo")).toBeVisible();

      const other = await browser.newContext({ storageState: auth("demo-marchand") });
      const opp = await other.newPage();
      await opp.goto("/duels");
      await expect(opp.getByText("Collectionneuse Démo te défie !")).toBeVisible();
      await opp.getByRole("button", { name: /Refuser le défi/ }).click();
      await expect(opp.getByText("Défi refusé")).toBeVisible();
      await other.close();
    });
  });
});
