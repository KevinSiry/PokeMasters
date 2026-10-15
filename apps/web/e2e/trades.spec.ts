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

  test("pagine les cartes et filtre sur la wishlist de l'autre joueur", async ({ page }) => {
    const [fan, seller] = await Promise.all(["demo-collection", "demo-marchand"].map((handle) => prisma.user.findUniqueOrThrow({ where: { handle }, select: { id: true } })));
    // Une carte que le joueur peut échanger, mise dans la wishlist de l'autre le temps du test.
    const mineCopy = await prisma.cardCopy.findFirstOrThrow({
      where: { ownerId: fan!.id, status: "owned", card: { favoritedBy: { none: { userId: fan!.id } }, copies: { none: { ownerId: seller!.id } } } },
      orderBy: { cardId: "asc" },
      select: { cardId: true, card: { select: { name: true } } },
    });
    await prisma.wishlistCard.create({ data: { userId: seller!.id, cardId: mineCopy.cardId } });
    try {
      await page.goto("/echanges/nouveau?avec=demo-marchand");
      const theirs = page.getByRole("tabpanel", { name: "Cartes de Marchand Démo" });
      await expect(theirs.getByText(/page 1 \/ \d+/)).toBeVisible();
      await expect(theirs.locator("li button[aria-pressed]")).toHaveCount(60);
      await theirs.getByRole("button", { name: "Page suivante" }).click();
      await expect(theirs.getByText(/page 2 \/ \d+/)).toBeVisible();

      await page.getByRole("tab", { name: /Tu proposes/ }).click();
      const mine = page.getByRole("tabpanel", { name: "Tes cartes" });
      await expect(mine.getByText(/Marchand Démo recherche 1 carte : tu en as 1 à lui proposer/)).toBeVisible();
      await mine.getByRole("button", { name: /Sa wishlist/ }).click();
      // Une vignette par finition de la carte recherchée.
      const tiles = mine.locator("li button[aria-pressed]");
      const finishes = (await prisma.cardCopy.groupBy({ by: ["finish"], where: { ownerId: fan!.id, cardId: mineCopy.cardId, status: "owned" } })).length;
      await expect(tiles).toHaveCount(finishes);
      for (const name of await tiles.allInnerTexts()) expect(name).toContain(mineCopy.card.name);
    } finally {
      await prisma.wishlistCard.deleteMany({ where: { userId: seller!.id, cardId: mineCopy.cardId } });
    }
  });

  test("filtre ses doublons et les miens", async ({ page }) => {
    const [fan, seller] = await Promise.all(["demo-collection", "demo-marchand"].map((handle) => prisma.user.findUniqueOrThrow({ where: { handle }, select: { id: true } })));
    const free = (ownerId: string) => ({ ownerId, status: "owned" as const, card: { favoritedBy: { none: { userId: ownerId } } } });
    // Une carte de l'autre joueur doublée le temps du test, et une des miennes en un seul exemplaire.
    const theirCopy = await prisma.cardCopy.findFirstOrThrow({ where: free(seller!.id), orderBy: { cardId: "asc" }, select: { cardId: true, finish: true, card: { select: { name: true } } } });
    const extra = await prisma.cardCopy.create({ data: { ownerId: seller!.id, cardId: theirCopy.cardId, finish: theirCopy.finish, obtainedVia: "seed" } });
    const owned = await prisma.cardCopy.findMany({ where: { ownerId: fan!.id }, select: { cardId: true, status: true, card: { select: { name: true, favoritedBy: { where: { userId: fan!.id }, select: { userId: true } } } } } });
    // Nom qui ne désigne, parmi mes cartes, qu'un seul exemplaire échangeable : la recherche ne trouve qu'elle.
    const single = owned.find(
      (c) => c.status === "owned" && c.card.favoritedBy.length === 0 && owned.filter((o) => o.card.name.toLowerCase().includes(c.card.name.toLowerCase())).length === 1,
    )!;
    expect(single).toBeDefined();
    try {
      await page.goto("/echanges/nouveau?avec=demo-marchand");
      const theirs = page.getByRole("tabpanel", { name: "Cartes de Marchand Démo" });
      await theirs.getByRole("button", { name: /Ses doublons/ }).click();
      await expect(theirs.getByRole("button", { name: /Ses doublons/ })).toHaveAttribute("aria-pressed", "true");
      await theirs.getByRole("searchbox").fill(theirCopy.card.name);
      await expect(theirs.locator("li button[aria-pressed]").filter({ hasText: theirCopy.card.name }).first()).toBeVisible();

      await page.getByRole("tab", { name: /Tu proposes/ }).click();
      const mine = page.getByRole("tabpanel", { name: "Tes cartes" });
      await mine.getByRole("searchbox").fill(single.card.name);
      await expect(mine.locator("li button[aria-pressed]").filter({ hasText: single.card.name }).first()).toBeVisible();
      await mine.getByRole("button", { name: /Mes doublons/ }).click();
      await expect(mine.getByText("Aucune carte ne correspond.")).toBeVisible();
    } finally {
      await prisma.cardCopy.delete({ where: { id: extra.id } });
    }
  });
});
