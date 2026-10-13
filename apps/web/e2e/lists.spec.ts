import path from "node:path";
import { expect, test } from "@playwright/test";

const auth = (handle: string) => path.resolve(process.cwd(), `playwright/.auth/${handle}.json`);

test.describe("favoris et wishlist", () => {
  test.use({ storageState: auth("demo-collection") });
  // Parcours qui modifient la base : joués une seule fois, sur ordinateur, dans l'ordre.
  test.describe.configure({ mode: "serial" });
  test.skip(({ isMobile }) => isMobile, "parcours joué une seule fois, sur ordinateur");

  test("met une carte en favori et dans la wishlist, puis l'en retire", async ({ page }) => {
    await page.goto("/collection?vue=cartes&tri=name");
    await page.locator("main ul li a").first().click();
    await expect(page).toHaveURL(/\/cartes\//);
    const name = (await page.getByRole("heading", { level: 1 }).textContent())!.trim();
    const cardUrl = page.url();

    await page.getByRole("button", { name: "Mettre en favori" }).click();
    await expect(page.getByText("Ajoutée à tes favoris")).toBeVisible();
    await page.getByRole("button", { name: "Ajouter à ma wishlist" }).click();
    await expect(page.getByText("Ajoutée à ta wishlist")).toBeVisible();

    await page.goto("/collection?vue=favoris");
    await expect(page.locator("main ul li").filter({ hasText: name }).first()).toBeVisible();
    await page.goto("/collection?vue=wishlist");
    await expect(page.locator("main ul li").filter({ hasText: name }).first()).toBeVisible();
    await expect(page.getByText("obtenue").first()).toBeVisible();

    await page.goto("/marche?wishlist=1");
    await expect(page.getByRole("link", { name: "Ma wishlist" })).toHaveAttribute("aria-current", "page");

    await page.goto(cardUrl);
    await page.getByRole("button", { name: "Favorite" }).click();
    await expect(page.getByText("Retirée de tes favoris")).toBeVisible();
    await page.getByRole("button", { name: "Dans ma wishlist" }).click();
    await expect(page.getByText("Retirée de ta wishlist")).toBeVisible();
    await page.goto("/collection?vue=favoris");
    await expect(page.getByText("Aucune carte favorite")).toBeVisible();
  });

  test("prévient en direct quand une carte de la wishlist est mise en vente", async ({ page, browser }) => {
    const other = await browser.newContext({ storageState: auth("demo-marchand") });
    const seller = await other.newPage();
    await seller.goto("/collection?vue=cartes&tri=name");
    await seller.locator("main ul li a").first().click();
    await expect(seller).toHaveURL(/\/cartes\//);

    await page.goto(new URL(seller.url()).pathname);
    await page.getByRole("button", { name: "Ajouter à ma wishlist" }).click();
    await expect(page.getByText("Ajoutée à ta wishlist")).toBeVisible();

    await seller.getByRole("button", { name: /Dans ta collection/ }).click();
    await seller.getByRole("button", { name: "Vendre" }).first().click();
    const dialog = seller.getByRole("dialog");
    await dialog.getByRole("spinbutton").fill("77");
    await dialog.getByRole("button", { name: /Mettre en vente/ }).click();
    await expect(seller.getByText("Carte mise en vente")).toBeVisible();

    await expect(page.getByText("Une carte de ta wishlist est en vente")).toBeVisible({ timeout: 10_000 });

    // Remise en état : l'annonce est retirée.
    await seller.goto("/marche/mes-ventes");
    await seller.getByRole("button", { name: "Retirer" }).first().click();
    await expect(seller.getByText("Annonce retirée")).toBeVisible();
    await other.close();
  });
});
