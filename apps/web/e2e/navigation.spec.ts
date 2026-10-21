import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const auth = (handle: string) => path.resolve(process.cwd(), `playwright/.auth/${handle}.json`);

// Retour arrière « dans le même état » : défilement, filtres et page conservés.
test.describe("retour à la page précédente", () => {
  test.use({ storageState: auth("demo-collection") });

  const scrollY = (page: Page) => page.evaluate(() => Math.round(window.scrollY));

  test("le bouton Retour retrouve les filtres et la position, même si la page est redemandée", async ({ page }) => {
    await page.goto("/catalogue/base1");
    await page.getByRole("searchbox", { name: /Filtrer/ }).fill("a");
    await expect(page).toHaveURL(/filtre=a/);
    await page.getByRole("button", { name: "Pokémon", exact: true }).click();
    await expect(page).toHaveURL(/categorie=pokemon/);

    await page.evaluate(() => window.scrollTo(0, 1200));
    await expect.poll(() => scrollY(page)).toBe(1200);
    // role img : la vignette compte aussi quand le CDN ne répond pas (visuel de remplacement sans <img>).
    const card = page.locator('main a[href^="/cartes/"]').filter({ has: page.getByRole("img") });
    let target = card.first();
    for (const c of await card.all()) {
      if (((await c.boundingBox())?.y ?? -1) > 80) {
        target = c;
        break;
      }
    }
    await target.click();
    await expect(page).toHaveURL(/\/cartes\//);
    // Rechargement : le cache du routeur est vidé, la page du set devra être redemandée au serveur.
    await page.reload();

    await page.getByRole("link", { name: "Retour" }).click();
    await expect(page).toHaveURL(/\/catalogue\/base1\?.*filtre=a/);
    await expect(page.getByRole("searchbox", { name: /Filtrer/ })).toHaveValue("a");
    await expect(page.getByRole("button", { name: "Pokémon", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => scrollY(page)).toBe(1200);
  });

  test("le bouton Retour mène à la page parente quand on arrive directement", async ({ page }) => {
    await page.goto("/cartes/base1-4");
    await page.getByRole("link", { name: "Retour" }).click();
    await expect(page).toHaveURL(/\/catalogue\/base1$/);
    await expect(page.getByRole("heading", { level: 1, name: "Set de Base" })).toBeVisible();
  });
});
