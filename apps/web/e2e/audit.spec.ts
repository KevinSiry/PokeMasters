/**
 * Non-régression de l'audit fonctionnel (2026-10-20) : URL bricolées et redirections.
 */
import path from "node:path";
import { expect, test } from "@playwright/test";

const auth = (handle: string) => path.resolve(process.cwd(), `playwright/.auth/${handle}.json`);

test.describe("URL bricolées", () => {
  // Sans effet sur la base : une seule passe suffit.
  test.skip(({ isMobile }) => isMobile, "vérifié une fois, sur ordinateur");

  for (const url of [
    "/recherche?q=pika&q=chu",
    "/recherche?illustrateur=a&illustrateur=b",
    "/marche?q=a&q=b",
    "/marche?page=2.5",
    "/marche?page=999&tri=price_asc",
    "/marche?tri=a&tri=b&type=fixed&type=auction",
    "/guildes?q=a&q=b",
    "/connexion?suite=/a&suite=/b",
  ]) {
    test(`${url} s'affiche sans erreur`, async ({ page }) => {
      const res = await page.goto(url);
      expect(res?.status()).toBe(200);
    });
  }

  test.describe("joueur connecté", () => {
    test.use({ storageState: auth("demo-collection") });

    test("un curseur d'historique hors bornes n'empêche pas d'afficher les Jetons", async ({ page }) => {
      const res = await page.goto("/jetons?avant=99999999999999999999999");
      expect(res?.status()).toBe(200);
      await expect(page.getByRole("heading", { name: "Mes Jetons" })).toBeVisible();
    });

    test("la page de connexion ne redirige jamais vers un autre site", async ({ request }) => {
      for (const suite of ["/\\evil.example", "//evil.example", "https://evil.example", "/%5Cevil.example"]) {
        const res = await request.get(`/connexion?suite=${encodeURIComponent(suite)}`, { maxRedirects: 0 });
        expect(res.status(), suite).toBeGreaterThanOrEqual(300);
        expect(res.status(), suite).toBeLessThan(400);
        const location = new URL(res.headers().location!, "http://localhost");
        expect(location.hostname, suite).toBe("localhost");
      }
    });

    test("la page de connexion renvoie vers la page demandée", async ({ request }) => {
      const res = await request.get(`/connexion?suite=${encodeURIComponent("/marche?type=fixed")}`, { maxRedirects: 0 });
      expect(res.headers().location).toMatch(/\/marche\?type=fixed$/);
    });
  });
});
