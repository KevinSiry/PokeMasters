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

  test("bascule wishlist et favori depuis la grille du catalogue", async ({ page }) => {
    await page.goto("/catalogue/base1");

    // Carte manquante : le cœur l'ajoute à la wishlist, sans quitter la grille.
    const missingTile = page.locator("main li").filter({ has: page.locator("a[data-missing]") }).first();
    const missingName = (await missingTile.locator("a span.truncate").first().textContent())!.trim();
    const wishToggle = missingTile.locator("button[data-list='wishlist']");
    await wishToggle.click();
    await expect(wishToggle).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("Ajoutée à ta wishlist")).toBeVisible();
    await expect(page).toHaveURL(/\/catalogue\/base1$/);

    // Carte possédée : l'étoile la met en favori.
    const ownedTile = page.locator("main li").filter({ has: page.locator("a.pf-tile:not([data-missing])") }).first();
    const ownedName = (await ownedTile.locator("a span.truncate").first().textContent())!.trim();
    const favToggle = ownedTile.locator("button[data-list='favorite']");
    await favToggle.click();
    await expect(favToggle).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("Ajoutée à tes favoris")).toBeVisible();

    await page.goto("/collection?vue=wishlist");
    await expect(page.locator("main ul li").filter({ hasText: missingName }).first()).toBeVisible();
    await page.goto("/collection?vue=favoris");
    await expect(page.locator("main ul li").filter({ hasText: ownedName }).first()).toBeVisible();

    // L'état est relu au retour sur la grille, et un second appui retire la carte.
    await page.goto("/catalogue/base1");
    const wishOn = page.getByRole("button", { name: `Retirer ${missingName} de ta wishlist` }).first();
    await expect(wishOn).toHaveAttribute("aria-pressed", "true");
    await wishOn.click();
    await expect(page.getByText("Retirée de ta wishlist")).toBeVisible();
    const favOn = page.getByRole("button", { name: `Retirer ${ownedName} de tes favoris` }).first();
    await expect(favOn).toHaveAttribute("aria-pressed", "true");
    await favOn.click();
    await expect(page.getByText("Retirée de tes favoris")).toBeVisible();
    await page.goto("/collection?vue=favoris");
    await expect(page.getByText("Aucune carte favorite")).toBeVisible();
  });

  test("bascule wishlist et favori depuis les résultats de recherche", async ({ page }) => {
    const fan = await prisma.user.findUniqueOrThrow({ where: { handle: "demo-collection" }, select: { id: true } });
    const ownedCard = await prisma.card.findFirstOrThrow({
      where: { droppable: true, copies: { some: { ownerId: fan.id } } },
      orderBy: { id: "asc" },
      select: { name: true },
    });
    const missingCard = await prisma.card.findFirstOrThrow({
      where: { droppable: true, copies: { none: { ownerId: fan.id } } },
      orderBy: { id: "asc" },
      select: { name: true },
    });

    // Carte manquante : le cœur l'ajoute à la wishlist sans quitter la recherche.
    await page.goto(`/recherche?q=${encodeURIComponent(missingCard.name)}`);
    const wishToggle = page.getByRole("button", { name: `Ajouter ${missingCard.name} à ta wishlist` }).first();
    await wishToggle.click();
    await expect(page.getByText("Ajoutée à ta wishlist")).toBeVisible();
    await expect(page).toHaveURL(/\/recherche\?q=/);
    const wishOn = page.getByRole("button", { name: `Retirer ${missingCard.name} de ta wishlist` }).first();
    await expect(wishOn).toHaveAttribute("aria-pressed", "true");
    await wishOn.click();
    await expect(page.getByText("Retirée de ta wishlist")).toBeVisible();

    // Carte possédée : l'étoile la met en favori.
    await page.goto(`/recherche?q=${encodeURIComponent(ownedCard.name)}`);
    await page.getByRole("button", { name: `Mettre ${ownedCard.name} en favori` }).first().click();
    await expect(page.getByText("Ajoutée à tes favoris")).toBeVisible();
    const favOn = page.getByRole("button", { name: `Retirer ${ownedCard.name} de tes favoris` }).first();
    await expect(favOn).toHaveAttribute("aria-pressed", "true");
    await favOn.click();
    await expect(page.getByText("Retirée de tes favoris")).toBeVisible();
    await page.goto("/collection?vue=favoris");
    await expect(page.getByText("Aucune carte favorite")).toBeVisible();
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
