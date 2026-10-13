import path from "node:path";
import { prisma } from "@pokeflex/db";
import { expect, test } from "@playwright/test";

const auth = (handle: string) => path.resolve(process.cwd(), `playwright/.auth/${handle}.json`);

test.describe("favoris et wishlist", () => {
  test.use({ storageState: auth("demo-collection") });
  // Parcours qui modifient la base : joués une seule fois, sur ordinateur, dans l'ordre.
  test.describe.configure({ mode: "serial" });
  test.skip(({ isMobile }) => isMobile, "parcours joué une seule fois, sur ordinateur");

  test("met une carte en favori, puis l'en retire", async ({ page }) => {
    await page.goto("/collection?vue=cartes&tri=name");
    await page.locator("main ul li a").first().click();
    await expect(page).toHaveURL(/\/cartes\//);
    const name = (await page.getByRole("heading", { level: 1 }).textContent())!.trim();

    // Carte déjà possédée : pas de wishlist, seulement le favori.
    await expect(page.getByRole("button", { name: "Ajouter à ma wishlist" })).toHaveCount(0);
    await page.getByRole("button", { name: "Mettre en favori" }).click();
    await expect(page.getByText("Ajoutée à tes favoris")).toBeVisible();
    await page.goto("/collection?vue=favoris");
    await expect(page.locator("main ul li").filter({ hasText: name }).first()).toBeVisible();

    await page.goBack();
    await page.getByRole("button", { name: "Favorite" }).click();
    await expect(page.getByText("Retirée de tes favoris")).toBeVisible();
    await page.goto("/collection?vue=favoris");
    await expect(page.getByText("Aucune carte favorite")).toBeVisible();
  });

  test("ajoute une carte manquante à la wishlist, puis l'en retire", async ({ page }) => {
    await page.goto("/catalogue/base1");
    await page.getByRole("button", { name: "Manquantes" }).click();
    await page.locator("main a[data-missing]").first().click();
    await expect(page).toHaveURL(/\/cartes\//);
    const name = (await page.getByRole("heading", { level: 1 }).textContent())!.trim();

    await expect(page.getByRole("button", { name: "Mettre en favori" })).toHaveCount(0);
    await page.getByRole("button", { name: "Ajouter à ma wishlist" }).click();
    await expect(page.getByText("Ajoutée à ta wishlist")).toBeVisible();
    await page.goto("/collection?vue=wishlist");
    await expect(page.locator("main ul li").filter({ hasText: name }).first()).toBeVisible();
    await page.goto("/marche?wishlist=1");
    await expect(page.getByRole("link", { name: "Ma wishlist" })).toHaveAttribute("aria-current", "page");

    await page.goBack();
    await page.goBack();
    await page.getByRole("button", { name: "Dans ma wishlist" }).click();
    await expect(page.getByText("Retirée de ta wishlist")).toBeVisible();
  });

  test("prévient en direct quand une carte de la wishlist est mise en vente", async ({ page, browser }) => {
    // Une carte que demo-marchand possède (libre) et que demo-collection n'a pas.
    const [seller, fan] = await Promise.all(["demo-marchand", "demo-collection"].map((handle) => prisma.user.findUniqueOrThrow({ where: { handle }, select: { id: true } })));
    const copy = await prisma.cardCopy.findFirstOrThrow({
      where: { ownerId: seller!.id, status: "owned", card: { copies: { none: { ownerId: fan!.id } } } },
      orderBy: { cardId: "asc" },
      select: { cardId: true },
    });
    const other = await browser.newContext({ storageState: auth("demo-marchand") });
    const sellerPage = await other.newPage();
    await sellerPage.goto(`/cartes/${copy.cardId}`);

    await page.goto(`/cartes/${copy.cardId}`);
    await page.getByRole("button", { name: "Ajouter à ma wishlist" }).click();
    await expect(page.getByText("Ajoutée à ta wishlist")).toBeVisible();

    await sellerPage.getByRole("button", { name: /Dans ta collection/ }).click();
    await sellerPage.getByRole("button", { name: "Vendre" }).first().click();
    const dialog = sellerPage.getByRole("dialog");
    await dialog.getByRole("spinbutton").fill("77");
    await dialog.getByRole("button", { name: /Mettre en vente/ }).click();
    await expect(sellerPage.getByText("Carte mise en vente")).toBeVisible();

    await expect(page.getByText("Une carte de ta wishlist est en vente")).toBeVisible({ timeout: 10_000 });

    // Remise en état : l'annonce est retirée.
    await sellerPage.goto("/marche/mes-ventes");
    await sellerPage.getByRole("button", { name: "Retirer" }).first().click();
    await expect(sellerPage.getByText("Annonce retirée")).toBeVisible();
    await other.close();
  });
});
