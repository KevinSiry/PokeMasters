import { expect, test } from "@playwright/test";
import { ENGLISH_CARD, ENGLISH_CARD_NAME, HIDDEN_CARD_IN_BASE, HIDDEN_CARD_NAME, HIDDEN_SET } from "./global-setup";

// Une carte sans image (non tirable) n'apparaît nulle part, et un set qui n'a que ça est masqué.
// Les données sont créées par global-setup.

test.describe("cartes non tirables masquées du catalogue", () => {
  test("un set sans carte tirable n'est pas listé et renvoie 404", async ({ page }) => {
    await page.goto("/catalogue");
    await expect(page.getByRole("link", { name: /Set de Base/ })).toBeVisible();
    await expect(page.getByText("Série masquée")).toHaveCount(0);
    expect((await page.goto(`/catalogue/${HIDDEN_SET}`))?.status()).toBe(404);
  });

  test("une carte non tirable n'est ni dans son set, ni en recherche, ni en fiche", async ({ page }) => {
    await page.goto("/catalogue/base1");
    await expect(page.getByRole("link", { name: /Dracaufeu/ })).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(HIDDEN_CARD_NAME) })).toHaveCount(0);
    await page.goto(`/recherche?q=${encodeURIComponent(HIDDEN_CARD_NAME)}`);
    await expect(page.getByRole("link", { name: new RegExp(HIDDEN_CARD_NAME) })).toHaveCount(0);
    expect((await page.goto(`/cartes/${HIDDEN_CARD_IN_BASE}`))?.status()).toBe(404);
  });

  test("une carte sans version française est cachée, mais sa fiche reste ouverte pour qui la possède", async ({ page }) => {
    await page.goto("/catalogue/base1");
    await expect(page.getByRole("link", { name: /Dracaufeu/ })).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(ENGLISH_CARD_NAME) })).toHaveCount(0);
    await page.goto(`/recherche?q=${ENGLISH_CARD_NAME}`);
    await expect(page.getByRole("link", { name: new RegExp(ENGLISH_CARD_NAME) })).toHaveCount(0);
    expect((await page.goto(`/cartes/${ENGLISH_CARD}`))?.status()).toBe(200);
    await expect(page.getByText("Retirée du catalogue")).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });
});
