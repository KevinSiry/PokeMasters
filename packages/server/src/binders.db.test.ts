/**
 * Exemplaires protégés et classeurs sur Postgres. Ignorés si SKIP_DB_TESTS=1.
 */
import { prisma } from "@pokeflex/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  addToBinder,
  BinderError,
  createBinder,
  deleteBinder,
  getBinder,
  listBinders,
  removeFromBinder,
  setCopyLock,
  updateBinder,
} from "./binders";
import { createListing } from "./market";
import { previewDuplicates, recycleCopy } from "./recycle";
import { proposeTrade } from "./trades";

const skip = process.env.SKIP_DB_TESTS === "1";
const users: string[] = [];
let cardIds: string[] = [];

async function newUser() {
  const u = await prisma.user.create({
    data: { handle: `t-bnd-${Math.random().toString(36).slice(2, 10)}`, name: "Test", boosterStock: 0, boosterAnchorAt: new Date() },
  });
  users.push(u.id);
  return u.id;
}

async function giveCopy(ownerId: string, cardId: string) {
  return (await prisma.cardCopy.create({ data: { ownerId, cardId, obtainedVia: "test" }, select: { id: true } })).id;
}

describe.skipIf(skip)("exemplaires protégés et classeurs (Postgres)", () => {
  beforeAll(async () => {
    cardIds = (await prisma.card.findMany({ where: { droppable: true }, take: 3, orderBy: { id: "asc" }, select: { id: true } })).map((c) => c.id);
    if (cardIds.length < 3) throw new Error("Catalogue vide : lance npm run db:seed");
  });
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: users } } });
  });

  it("un exemplaire protégé ne se vend, ne se recycle ni ne s'échange", async () => {
    const me = await newUser();
    const other = await newUser();
    const copy = await giveCopy(me, cardIds[0]!);
    expect(await setCopyLock(me, copy, true)).toEqual({ locked: true });
    await expect(recycleCopy(me, copy)).rejects.toMatchObject({ code: "locked" });
    await expect(createListing(me, { copyId: copy, type: "fixed", price: 10 })).rejects.toThrow(/protégé/);
    const theirs = await giveCopy(other, cardIds[1]!);
    await expect(proposeTrade(me, { to: other, give: [copy], take: [theirs] })).rejects.toThrow(/protégé/);
    await setCopyLock(me, copy, false);
    expect((await recycleCopy(me, copy)).count).toBe(1);
  });

  it("garde l'exemplaire protégé quand on recycle les doublons", async () => {
    const me = await newUser();
    const a = await giveCopy(me, cardIds[1]!);
    await giveCopy(me, cardIds[1]!);
    await setCopyLock(me, a, true);
    const preview = await previewDuplicates(me);
    expect(preview.reduce((n, p) => n + p.count, 0)).toBe(1);
  });

  it("ranger dans un classeur protège, retirer libère", async () => {
    const me = await newUser();
    const copy = await giveCopy(me, cardIds[2]!);
    const { id } = await createBinder(me, "  Mes   préférées ");
    expect((await listBinders(me))[0]).toMatchObject({ id, name: "Mes préférées", count: 0, isPublic: true });
    expect(await addToBinder(me, id, copy)).toEqual({ position: 0 });
    expect((await prisma.cardCopy.findUniqueOrThrow({ where: { id: copy } })).lockedAt).not.toBeNull();
    await expect(addToBinder(me, id, copy)).rejects.toMatchObject({ code: "in_binder" });
    await expect(setCopyLock(me, copy, false)).rejects.toMatchObject({ code: "in_binder" });
    expect((await getBinder(id, null))!.slots.map((s) => s.copyId)).toEqual([copy]);
    await removeFromBinder(me, copy);
    expect((await prisma.cardCopy.findUniqueOrThrow({ where: { id: copy } })).lockedAt).toBeNull();
  });

  it("un classeur privé n'est visible que par son propriétaire ; le supprimer libère ses cartes", async () => {
    const me = await newUser();
    const other = await newUser();
    const copy = await giveCopy(me, cardIds[0]!);
    const { id } = await createBinder(me, "Secret");
    await addToBinder(me, id, copy);
    await updateBinder(me, id, { isPublic: false });
    expect(await getBinder(id, other)).toBeNull();
    expect(await getBinder(id, me)).not.toBeNull();
    expect(await listBinders(me, { publicOnly: true })).toEqual([]);
    await expect(addToBinder(other, id, copy)).rejects.toBeInstanceOf(BinderError);
    await deleteBinder(me, id);
    expect((await prisma.cardCopy.findUniqueOrThrow({ where: { id: copy } })).lockedAt).toBeNull();
  });

  it("refuse un nom vide", async () => {
    const me = await newUser();
    await expect(createBinder(me, "   ")).rejects.toMatchObject({ code: "invalid" });
  });
});
