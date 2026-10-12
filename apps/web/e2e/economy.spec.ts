import path from "node:path";
import { expect, test } from "@playwright/test";

const auth = (handle: string) => path.resolve(process.cwd(), `playwright/.auth/${handle}.json`);

test.describe("économie", () => {
  test.use({ storageState: auth("demo-marchand") });
  // Ces parcours modifient le solde et la collection : un seul projet les joue, dans l'ordre.
  test.describe.configure({ mode: "serial" });
  test.skip(({ isMobile }) => isMobile, "parcours joué une seule fois, sur ordinateur");

  test("le solde de Jetons est affiché et mène à l'historique", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /Jetons, voir l'historique/ }).click();
    await expect(page.getByRole("heading", { name: "Mes Jetons" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Historique" })).toBeVisible();
  });

  test("les quêtes du jour sont visibles sur l'accueil", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Quêtes du jour/ })).toBeVisible();
    await expect(page.getByText("Ouvrir 5 boosters")).toBeVisible();
  });

  test("achète et ouvre un booster de set", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/boosters/sets");
    await page.getByRole("searchbox", { name: "Chercher un set" }).fill("set de base");
    await page.getByRole("link", { name: /Set de Base/ }).first().click();
    await expect(page).toHaveURL(/\/boosters\/sets\/base1$/);
    const before = await page.getByRole("link", { name: /Jetons, voir l'historique/ }).getAttribute("aria-label");
    await page.getByRole("button", { name: /^Ouvrir ·/ }).click();
    await page.getByRole("button", { name: "Tout révéler" }).click();
    await expect(page.getByRole("heading", { name: "Set de Base", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /Jetons, voir l'historique/ })).not.toHaveAttribute("aria-label", before!);
  });

  test("recycle les doublons", async ({ page }) => {
    await page.goto("/collection?vue=cartes");
    await page.getByRole("button", { name: "Recycler les doublons" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Recycler les doublons" })).toBeVisible();
    const confirm = dialog.getByRole("button", { name: /^Recycler \d+ carte/ });
    if ((await confirm.count()) === 0) {
      await expect(dialog.getByText(/Aucun doublon|Choisis au moins/)).toBeVisible();
      return;
    }
    await confirm.click();
    await expect(dialog.getByRole("heading", { name: "Doublons recyclés" })).toBeVisible();
    await expect(dialog.getByText(/Jetons pour \d+ carte/)).toBeVisible();
  });
});
