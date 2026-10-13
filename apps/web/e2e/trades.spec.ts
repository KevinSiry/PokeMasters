import path from "node:path";
import { prisma } from "@pokeflex/db";
import { expect, test } from "@playwright/test";

const auth = (handle: string) => path.resolve(process.cwd(), `playwright/.auth/${handle}.json`);

test.describe("échanges", () => {
  test.use({ storageState: auth("demo-collection") });
  // Parcours qui modifie la base : joué une seule fois, sur ordinateur.
  test.describe.configure({ mode: "serial" });
  test.skip(({ isMobile }) => isMobile, "parcours joué une seule fois, sur ordinateur");

  test("propose un échange, que l'autre joueur accepte en direct", async ({ page, browser }) => {
    const [fan, seller] = await Promise.all(["demo-collection", "demo-marchand"].map((handle) => prisma.user.findUniqueOrThrow({ where: { handle }, select: { id: true } })));
    // Cartes choisies loin de celles des autres parcours (qui prennent les premières par identifiant).
    const free = (ownerId: string) => ({ ownerId, status: "owned" as const, card: { favoritedBy: { none: { userId: ownerId } } } });
    const wanted = await prisma.cardCopy.findFirstOrThrow({ where: free(seller!.id), orderBy: { cardId: "desc" }, select: { cardId: true, card: { select: { name: true } } } });
    const offered = await prisma.cardCopy.findFirstOrThrow({
      where: { ...free(fan!.id), cardId: { not: wanted.cardId } },
      orderBy: { cardId: "desc" },
      select: { cardId: true, card: { select: { name: true } } },
    });

    const other = await browser.newContext({ storageState: auth("demo-marchand") });
    const sellerPage = await other.newPage();
    await sellerPage.goto("/echanges");

    try {
      await page.goto("/joueurs/demo-marchand");
      await page.getByRole("link", { name: "Échanger" }).click();
      await expect(page.getByRole("heading", { name: "Proposer un échange" })).toBeVisible();

      const panel = page.getByRole("tabpanel");
      await panel.getByRole("searchbox").fill(wanted.card.name);
      await panel.getByRole("button").filter({ hasText: wanted.card.name }).first().click();
      await page.getByRole("button", { name: "Choisir mes cartes" }).click();
      await panel.getByRole("searchbox").fill(offered.card.name);
      await panel.getByRole("button").filter({ hasText: offered.card.name }).first().click();
      await page.getByPlaceholder("Petit mot (facultatif)").fill("Échange e2e");
      await page.getByRole("button", { name: "Envoyer la proposition" }).click();
      await expect(page.getByText("Proposition envoyée")).toBeVisible();
      await expect(page).toHaveURL(/\/echanges$/);
      await expect(page.getByRole("heading", { name: /Propositions envoyées/ })).toBeVisible();

      // Notification en direct chez l'autre joueur, puis acceptation.
      await expect(sellerPage.getByText("Nouvelle proposition d'échange")).toBeVisible({ timeout: 10_000 });
      await expect(sellerPage.getByText("« Échange e2e »")).toBeVisible();
      await sellerPage.getByRole("button", { name: "Accepter" }).click();
      await expect(sellerPage.getByText("Échange conclu").first()).toBeVisible();
      await expect(page.getByText("a accepté ta proposition")).toBeVisible({ timeout: 10_000 });

      expect(await prisma.cardCopy.count({ where: { ownerId: fan!.id, cardId: wanted.cardId, obtainedVia: "trade" } })).toBe(1);
      expect(await prisma.cardCopy.count({ where: { ownerId: seller!.id, cardId: offered.cardId, obtainedVia: "trade" } })).toBe(1);
    } finally {
      // Remise en état : chaque carte retourne chez son propriétaire.
      await prisma.cardCopy.updateMany({ where: { ownerId: fan!.id, cardId: wanted.cardId, obtainedVia: "trade" }, data: { ownerId: seller!.id, obtainedVia: "seed" } });
      await prisma.cardCopy.updateMany({ where: { ownerId: seller!.id, cardId: offered.cardId, obtainedVia: "trade" }, data: { ownerId: fan!.id, obtainedVia: "seed" } });
      await other.close();
    }
  });
});
