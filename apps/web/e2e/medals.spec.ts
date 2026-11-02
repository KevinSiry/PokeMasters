import path from "node:path";
import { gameConfig } from "@pokeflex/config";
import { prisma } from "@pokeflex/db";
import { weekKey } from "@pokeflex/game";
import { expect, test } from "@playwright/test";

const auth = (handle: string) => path.resolve(process.cwd(), `playwright/.auth/${handle}.json`);

test.describe("médailles et missions de guilde", () => {
  test.skip(({ isMobile }) => isMobile, "parcours joué une seule fois, sur ordinateur");

  test.describe("profil", () => {
    test.use({ storageState: auth("demo-dresseur") });

    test("affiche les médailles et leur progression", async ({ page }) => {
      await page.goto("/profil");
      await expect(page.getByRole("heading", { name: /Médailles/ })).toBeVisible();
      await expect(page.locator("[data-medal]")).toHaveCount(gameConfig.medals.list.length);
      await page.goto("/joueurs/demo-dresseur");
      await expect(page.locator("[data-medal]")).toHaveCount(gameConfig.medals.list.length);
    });
  });

  test.describe("guilde", () => {
    test.use({ storageState: auth("demo-marchand") });
    let guildId = "";
    const openings: string[] = [];

    test.beforeAll(async () => {
      const me = await prisma.user.findUniqueOrThrow({ where: { handle: "demo-marchand" } });
      await prisma.guildMember.deleteMany({ where: { userId: me.id } });
      await prisma.guild.deleteMany({ where: { name: "Guilde e2e missions" } });
      const guild = await prisma.guild.create({ data: { name: "Guilde e2e missions", tag: "E2EM", ownerId: me.id } });
      guildId = guild.id;
      await prisma.guildMember.create({ data: { guildId, userId: me.id, role: "owner" } });
      await prisma.guildMissionClaim.deleteMany({ where: { userId: me.id, week: weekKey(new Date(), gameConfig.quests.timeZone) } });
      const def = gameConfig.guildMissions.list.find((m) => m.kind === "open_boosters")!;
      for (let i = 0; i < def.min; i++) {
        const o = await prisma.boosterOpening.create({ data: { userId: me.id, kind: "all_eras", cardIds: [], tiers: [], finishes: [] }, select: { id: true } });
        openings.push(o.id);
      }
    });

    test.afterAll(async () => {
      await prisma.boosterOpening.deleteMany({ where: { id: { in: openings } } });
      await prisma.guild.deleteMany({ where: { id: guildId } });
    });

    test("un membre réclame une mission réussie, une seule fois", async ({ page }) => {
      await page.goto(`/guildes/${guildId}`);
      await expect(page.getByRole("heading", { name: /Missions de la semaine/ })).toBeVisible();
      const mission = page.locator('[data-mission="open_boosters"]');
      await mission.getByRole("button", { name: /Réclamer/ }).click();
      await expect(page.getByText("Mission de guilde réussie")).toBeVisible();
      await expect(mission.getByText("Réclamée")).toBeVisible();
      await page.reload();
      await expect(page.locator('[data-mission="open_boosters"]').getByText("Réclamée")).toBeVisible();
    });
  });
});
