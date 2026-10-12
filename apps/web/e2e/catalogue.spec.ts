import { expect, test } from "@playwright/test";

// Ces parcours s'appuient sur l'échantillon de catalogue du seed (Set de Base et 151).
test.describe("catalogue public", () => {
  test("liste les séries et les sets", async ({ page }) => {
    await page.goto("/catalogue");
    await expect(page.getByRole("heading", { level: 1, name: "Le catalogue" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Set de Base/ })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("filtre les cartes d'un set", async ({ page }) => {
    await page.goto("/catalogue/base1");
    await expect(page.getByRole("heading", { level: 1, name: "Set de Base" })).toBeVisible();
    await page.getByRole("searchbox", { name: /Filtrer/ }).fill("dracau");
    await expect(page.getByRole("link", { name: /Dracaufeu/ })).toBeVisible();
    await expect(page.getByText(/^1 carte sur 102/)).toBeVisible();
  });

  test("affiche la fiche d'une carte", async ({ page }) => {
    await page.goto("/cartes/base1-4");
    await expect(page.getByRole("heading", { level: 1, name: "Dracaufeu" })).toBeVisible();
    await expect(page.getByText("Danseflamme")).toBeVisible();
    await expect(page.getByRole("link", { name: /Mitsuhiro Arita/ })).toBeVisible();
  });

  test("trouve une carte par son nom anglais", async ({ page }) => {
    await page.goto("/recherche?q=charizard");
    await expect(page.getByRole("link", { name: /Dracaufeu/ }).first()).toBeVisible();
  });

  test("une carte inconnue renvoie 404", async ({ page }) => {
    const res = await page.goto("/cartes/n-existe-pas");
    expect(res?.status()).toBe(404);
  });
});
