import path from "node:path";
import { prisma } from "@pokeflex/db";
import { expect, test } from "@playwright/test";

const auth = (handle: string) => path.resolve(process.cwd(), `playwright/.auth/${handle}.json`);

test.describe("classeurs et exemplaires protégés", () => {
  test.use({ storageState: auth("demo-collection") });
  test.skip(({ isMobile }) => isMobile, "parcours joué une seule fois, sur ordinateur");

  test("crée un classeur, y range une carte (protégée), puis le supprime", async ({ page }) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { handle: "demo-collection" } });
    const copy = await prisma.cardCopy.findFirstOrThrow({
      where: { ownerId: user.id, status: "owned", lockedAt: null, binderSlot: null },
      select: { id: true, cardId: true },
    });
    const name = `Classeur e2e ${Date.now()}`;

    await page.goto("/collection?vue=classeurs");
    await page.getByLabel("Nom du nouveau classeur").fill(name);
    await page.getByRole("button", { name: "Créer" }).click();
    await expect(page.getByRole("heading", { name })).toBeVisible();
    const binderUrl = page.url();

    await page.goto(`/cartes/${copy.cardId}`);
    await page.getByRole("button", { name: /Dans ta collection/ }).click();
    await page.getByRole("button", { name: "Classeur" }).first().click();
    await page.getByRole("button", { name }).click();
    await expect(page.getByText(`Rangée dans « ${name} »`)).toBeVisible();
    await expect.poll(async () => (await prisma.cardCopy.findFirst({ where: { binderSlot: { binder: { name } } } }))?.lockedAt).not.toBeNull();

    await page.goto(binderUrl);
    await expect(page.getByRole("button", { name: /Retirer .* du classeur/ })).toHaveCount(1);
    await page.getByRole("button", { name: "Supprimer" }).click();
    await page.getByRole("button", { name: "Confirmer la suppression ?" }).click();
    await expect(page).toHaveURL(/vue=classeurs/);
    expect(await prisma.binder.count({ where: { name } })).toBe(0);
  });
});
