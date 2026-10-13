import path from "node:path";
import { expect, test } from "@playwright/test";
import { resetDemoSocial } from "./global-setup";

const auth = (handle: string) => path.resolve(process.cwd(), `playwright/.auth/${handle}.json`);

test.describe("social", () => {
  test("un visiteur voit un profil public, mais pas les amis", async ({ page }) => {
    await page.goto("/joueurs/demo-marchand");
    await expect(page.getByRole("heading", { name: /Marchand Démo/ })).toBeVisible();
    await expect(page.getByText("@demo-marchand")).toBeVisible();
    await page.goto("/amis");
    await expect(page).toHaveURL(/\/connexion/);
  });

  test("les classements s'affichent", async ({ page }) => {
    await page.goto("/classements");
    await expect(page.getByRole("heading", { name: "Classements" })).toBeVisible();
    await page.getByRole("navigation", { name: "Catégories" }).getByRole("link", { name: "Marché" }).click();
    await expect(page).toHaveURL(/type=market/);
  });

  test.describe("joueurs connectés", () => {
    test.use({ storageState: auth("demo-dresseur") });
    // Parcours qui modifient la base : joués une seule fois, sur ordinateur, dans l'ordre.
    test.describe.configure({ mode: "serial" });
    test.skip(({ isMobile }) => isMobile, "parcours joué une seule fois, sur ordinateur");
    // Un échec relance tout le groupe (mode serial) : on repart d'un état propre à chaque essai.
    test.beforeAll(resetDemoSocial);

    test("ajoute un ami, qui accepte en direct", async ({ page, browser }) => {
      const other = await browser.newContext({ storageState: auth("demo-marchand") });
      const friend = await other.newPage();
      await friend.goto("/amis");

      await page.goto("/joueurs/demo-marchand");
      await page.getByRole("button", { name: "Ajouter en ami" }).click();
      await expect(page.getByRole("button", { name: "Demande envoyée" })).toBeVisible();

      // Notification en direct chez l'autre joueur, puis acceptation.
      await expect(friend.getByText("Nouvelle demande d'ami")).toBeVisible({ timeout: 10_000 });
      await expect(friend.getByRole("heading", { name: /Demandes reçues/ })).toBeVisible();
      await friend.getByRole("button", { name: "Accepter" }).click();
      await expect(friend.getByText("Dresseur Démo", { exact: true })).toBeVisible();

      await page.reload();
      await page.getByRole("button", { name: "Plus d'actions" }).click();
      await expect(page.getByRole("menuitem", { name: "Retirer des amis" })).toBeVisible();
      await other.close();
    });

    test("envoie un message, reçu et lu en direct", async ({ page, browser }) => {
      const other = await browser.newContext({ storageState: auth("demo-marchand") });
      const friend = await other.newPage();
      await friend.goto("/messages/demo-dresseur");

      await page.goto("/messages/demo-marchand");
      await page.getByPlaceholder("Écrire à Marchand Démo…").fill("Salut ! On échange ?");
      await page.keyboard.press("Enter");
      // Dans le fil seulement : le champ peut encore contenir le texte pendant l'envoi.
      await expect(page.getByRole("log").getByText("Salut ! On échange ?")).toBeVisible();

      await expect(friend.getByRole("log").getByText("Salut ! On échange ?")).toBeVisible({ timeout: 10_000 });
      await friend.getByPlaceholder("Écrire à Dresseur Démo…").fill("Avec plaisir");
      await friend.getByRole("button", { name: "Envoyer" }).click();

      await expect(page.getByRole("log").getByText("Avec plaisir")).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText("Vu", { exact: true })).toBeVisible();
      await other.close();
    });

    test("un joueur bloqué ne peut plus écrire", async ({ page, browser }) => {
      const other = await browser.newContext({ storageState: auth("demo-marchand") });
      const blocker = await other.newPage();
      await blocker.goto("/joueurs/demo-dresseur");
      await blocker.getByRole("button", { name: "Plus d'actions" }).click();
      await blocker.getByRole("menuitem", { name: "Bloquer" }).click();
      await blocker.getByRole("dialog").getByRole("button", { name: "Bloquer" }).click();
      await expect(blocker.getByRole("button", { name: "Débloquer" })).toBeVisible();

      await page.goto("/messages/demo-marchand");
      await expect(page.getByText("Tu ne peux pas écrire à ce joueur.")).toBeVisible();

      await blocker.getByRole("button", { name: "Débloquer" }).click();
      await expect(blocker.getByRole("button", { name: "Ajouter en ami" })).toBeVisible();
      await other.close();
    });
  });
});
