import { expect, test } from "@playwright/test";

test.describe("pages publiques", () => {
  test("l'accueil présente le jeu et invite à se connecter", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Toutes les cartes depuis 1999");
    await expect(page.getByRole("link", { name: "Commencer à collectionner" })).toBeVisible();
    await expect(page.getByText("Mythique")).toBeVisible();
  });

  test("le pied de page porte les mentions de fan game", async ({ page }) => {
    await page.goto("/");
    const footer = page.getByRole("contentinfo");
    await expect(footer).toContainText("non officiel et non commercial");
    await expect(footer).toContainText("The Pokémon Company");
    await expect(footer.getByRole("link", { name: "TCGdex" })).toHaveAttribute("href", "https://tcgdex.dev");
  });

  test("la page À propos détaille les mentions", async ({ page }) => {
    await page.goto("/a-propos");
    await expect(page.getByRole("heading", { name: "À propos de PokeFlex" })).toBeVisible();
    await expect(page.getByRole("main").getByText("aucune valeur réelle")).toBeVisible();
  });

  test("la page de connexion s'affiche", async ({ page }) => {
    await page.goto("/connexion");
    await expect(page.getByRole("heading", { name: "Connexion" })).toBeVisible();
  });

  test("une adresse inconnue renvoie la page 404", async ({ page }) => {
    const res = await page.goto("/cette-page-n-existe-pas");
    expect(res?.status()).toBe(404);
    await expect(page.getByText("Cette carte n'existe pas")).toBeVisible();
  });

  test("le contenu ne déborde pas horizontalement", async ({ page }) => {
    await page.goto("/");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe("référencement", () => {
  test("robots.txt exclut l'espace joueur et pointe vers le sitemap", async ({ request }) => {
    const body = await (await request.get("/robots.txt")).text();
    expect(body).toContain("Disallow: /collection");
    expect(body).toMatch(/Sitemap: .*\/sitemap\.xml/);
  });

  test("le sitemap liste les sets et les fiches de carte", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.ok()).toBe(true);
    const body = await res.text();
    expect(body).toContain("/catalogue/base1</loc>");
    expect(body).toContain("/cartes/base1-4</loc>");
  });

  test("l'image de partage est générée", async ({ page, request }) => {
    await page.goto("/");
    const og = await page.locator('meta[property="og:image"]').getAttribute("content");
    expect(og).toBeTruthy();
    const res = await request.get(new URL(og!).pathname + new URL(og!).search);
    expect(res.headers()["content-type"]).toBe("image/png");
  });
});
