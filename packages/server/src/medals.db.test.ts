/**
 * Médailles et missions de guilde sur Postgres. Ignorés si SKIP_DB_TESTS=1.
 */
import { gameConfig } from "@pokeflex/config";
import { prisma } from "@pokeflex/db";
import { afterAll, describe, expect, it } from "vitest";
import { claimGuildMission, getGuildMissions, syncMedals } from "./medals";

const skip = process.env.SKIP_DB_TESTS === "1";
const users: string[] = [];
const guilds: string[] = [];

async function newUser() {
  const u = await prisma.user.create({
    data: { handle: `t-med-${Math.random().toString(36).slice(2, 10)}`, name: "Test", boosterStock: 0, boosterAnchorAt: new Date() },
  });
  users.push(u.id);
  return u.id;
}

async function openBoosters(userId: string, n: number) {
  await prisma.boosterOpening.createMany({ data: Array.from({ length: n }, () => ({ userId, kind: "all_eras", cardIds: [], tiers: [], finishes: [] })) });
}

describe.skipIf(skip)("médailles et missions de guilde (Postgres)", () => {
  afterAll(async () => {
    await prisma.guild.deleteMany({ where: { id: { in: guilds } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
  });

  it("verse chaque palier une seule fois", async () => {
    const me = await newUser();
    const opener = gameConfig.medals.list.find((m) => m.id === "opener")!;
    await openBoosters(me, opener.thresholds[1]);
    const first = await syncMedals(me);
    expect(first.awarded.filter((a) => a.medalId === "opener").map((a) => a.level)).toEqual(["bronze", "silver"]);
    expect(first.medals.find((m) => m.id === "opener")).toMatchObject({ level: 2, next: { level: "gold" } });
    const again = await Promise.all([syncMedals(me), syncMedals(me)]);
    expect(again.flatMap((r) => r.awarded)).toEqual([]);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: me } });
    expect(user.balance).toBe(gameConfig.medals.rewards.bronze + gameConfig.medals.rewards.silver);
    expect(await prisma.ledgerEntry.count({ where: { userId: me, reason: "medal" } })).toBe(2);
  });

  it("une mission réussie se réclame une fois par membre et par semaine", async () => {
    const owner = await newUser();
    const mate = await newUser();
    const outsider = await newUser();
    const guild = await prisma.guild.create({ data: { name: `Test ${owner}`, tag: owner.slice(-4).toUpperCase(), ownerId: owner } });
    guilds.push(guild.id);
    await prisma.guildMember.createMany({ data: [{ guildId: guild.id, userId: owner, role: "owner" }, { guildId: guild.id, userId: mate }] });

    const def = gameConfig.guildMissions.list.find((m) => m.kind === "open_boosters")!;
    let view = await getGuildMissions(guild.id, owner);
    const target = view.missions.find((m) => m.kind === "open_boosters")!.target;
    expect(target).toBe(Math.max(def.min, Math.ceil(def.perMember * 2)));
    await expect(claimGuildMission(owner, "open_boosters")).rejects.toMatchObject({ code: "not_done" });

    // Les ouvertures d'avant la semaine ne comptent pas.
    await prisma.boosterOpening.create({ data: { userId: owner, kind: "all_eras", cardIds: [], tiers: [], finishes: [], createdAt: new Date("2020-01-01") } });
    await openBoosters(owner, target - 1);
    await openBoosters(mate, 1);
    view = await getGuildMissions(guild.id, owner);
    expect(view.missions.find((m) => m.kind === "open_boosters")).toMatchObject({ progress: target, claimed: false });

    const results = await Promise.allSettled([claimGuildMission(owner, "open_boosters"), claimGuildMission(owner, "open_boosters")]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await claimGuildMission(mate, "open_boosters")).reward).toBe(def.reward);
    await expect(claimGuildMission(outsider, "open_boosters")).rejects.toMatchObject({ code: "not_member" });
    expect((await getGuildMissions(guild.id, owner)).missions.find((m) => m.kind === "open_boosters")!.claimed).toBe(true);
  });
});
