/**
 * Exemplaires protégés et classeurs (idées reprises d'HoloPocket).
 *
 * Un exemplaire protégé (`lockedAt`) ne peut être ni vendu, ni recyclé, ni échangé. Ranger un
 * exemplaire dans un classeur le protège d'office ; le retirer du classeur le libère.
 */
import { gameConfig, type Finish, type Tier } from "@pokeflex/config";
import { prisma } from "@pokeflex/db";

const rules = gameConfig.binders;

export class BinderError extends Error {
  constructor(
    readonly code: "not_found" | "invalid" | "too_many" | "full" | "unavailable" | "in_binder",
    message: string,
  ) {
    super(message);
    this.name = "BinderError";
  }
}

function cleanName(raw: string): string {
  const name = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (name.length === 0) throw new BinderError("invalid", "Donne un nom à ton classeur.");
  if (name.length > rules.nameMaxLength) throw new BinderError("invalid", `${rules.nameMaxLength} caractères au plus.`);
  return name;
}

async function ownBinder(userId: string, binderId: string) {
  const binder = await prisma.binder.findUnique({ where: { id: String(binderId) }, select: { id: true, ownerId: true } });
  if (!binder || binder.ownerId !== userId) throw new BinderError("not_found", "Classeur introuvable.");
  return binder;
}

/** Protège ou libère un exemplaire. Un exemplaire rangé dans un classeur reste protégé. */
export async function setCopyLock(userId: string, copyId: string, locked: boolean): Promise<{ locked: boolean }> {
  const copy = await prisma.cardCopy.findFirst({
    where: { id: String(copyId), ownerId: userId },
    select: { id: true, status: true, binderSlot: { select: { binder: { select: { name: true } } } } },
  });
  if (!copy) throw new BinderError("unavailable", "Cet exemplaire n'est plus dans ta collection.");
  if (locked && copy.status !== "owned") throw new BinderError("unavailable", "Retire d'abord cet exemplaire du marché.");
  if (!locked && copy.binderSlot) {
    throw new BinderError("in_binder", `Cet exemplaire est rangé dans « ${copy.binderSlot.binder.name} » : retire-le du classeur pour le libérer.`);
  }
  await prisma.cardCopy.update({ where: { id: copy.id }, data: { lockedAt: locked ? new Date() : null } });
  return { locked };
}

export interface BinderSummary {
  id: string;
  name: string;
  isPublic: boolean;
  count: number;
  /** Image des premières cartes, pour la vignette. */
  covers: (string | null)[];
  updatedAt: Date;
}

/** Classeurs d'un joueur (les publics seulement si `publicOnly`). */
export async function listBinders(ownerId: string, opts: { publicOnly?: boolean } = {}): Promise<BinderSummary[]> {
  const binders = await prisma.binder.findMany({
    where: { ownerId, ...(opts.publicOnly ? { isPublic: true } : {}) },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      isPublic: true,
      updatedAt: true,
      _count: { select: { slots: true } },
      slots: { orderBy: { position: "asc" }, take: 3, select: { copy: { select: { card: { select: { image: true } } } } } },
    },
  });
  return binders.map((b) => ({
    id: b.id,
    name: b.name,
    isPublic: b.isPublic,
    count: b._count.slots,
    covers: b.slots.map((s) => s.copy.card.image),
    updatedAt: b.updatedAt,
  }));
}

export interface BinderSlotView {
  copyId: string;
  position: number;
  finish: Finish;
  card: { id: string; name: string; image: string | null; tier: Tier; rarityRaw: string | null; localId: string; setName: string };
}

export interface BinderView {
  id: string;
  name: string;
  isPublic: boolean;
  owner: { id: string; handle: string | null; name: string };
  slots: BinderSlotView[];
}

/** Un classeur, visible par son propriétaire, ou par tous s'il est public. */
export async function getBinder(binderId: string, viewerId: string | null): Promise<BinderView | null> {
  const b = await prisma.binder.findUnique({
    where: { id: String(binderId) },
    select: {
      id: true,
      name: true,
      isPublic: true,
      owner: { select: { id: true, handle: true, name: true } },
      slots: {
        orderBy: { position: "asc" },
        select: {
          copyId: true,
          position: true,
          copy: {
            select: {
              finish: true,
              card: { select: { id: true, name: true, image: true, tier: true, rarityRaw: true, localId: true, set: { select: { name: true } } } },
            },
          },
        },
      },
    },
  });
  if (!b || (!b.isPublic && b.owner.id !== viewerId)) return null;
  return {
    id: b.id,
    name: b.name,
    isPublic: b.isPublic,
    owner: { id: b.owner.id, handle: b.owner.handle, name: b.owner.name ?? b.owner.handle ?? "Dresseur" },
    slots: b.slots.map((s) => {
      const { set, ...card } = s.copy.card;
      return { copyId: s.copyId, position: s.position, finish: s.copy.finish, card: { ...card, setName: set.name } };
    }),
  };
}

export async function createBinder(userId: string, rawName: string): Promise<{ id: string }> {
  const name = cleanName(rawName);
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
    const count = await tx.binder.count({ where: { ownerId: userId } });
    if (count >= rules.maxPerUser) throw new BinderError("too_many", `${rules.maxPerUser} classeurs au plus.`);
    return tx.binder.create({ data: { ownerId: userId, name }, select: { id: true } });
  });
}

export async function updateBinder(userId: string, binderId: string, patch: { name?: string; isPublic?: boolean }): Promise<void> {
  await ownBinder(userId, binderId);
  await prisma.binder.update({
    where: { id: String(binderId) },
    data: {
      ...(patch.name !== undefined ? { name: cleanName(patch.name) } : {}),
      ...(patch.isPublic !== undefined ? { isPublic: Boolean(patch.isPublic) } : {}),
    },
  });
}

/** Supprime un classeur : ses exemplaires restent dans la collection, libérés. */
export async function deleteBinder(userId: string, binderId: string): Promise<void> {
  await ownBinder(userId, binderId);
  await prisma.$transaction(async (tx) => {
    const slots = await tx.binderSlot.findMany({ where: { binderId: String(binderId) }, select: { copyId: true } });
    await tx.cardCopy.updateMany({ where: { id: { in: slots.map((s) => s.copyId) } }, data: { lockedAt: null } });
    await tx.binder.delete({ where: { id: String(binderId) } });
  });
}

/** Range un exemplaire à la fin d'un classeur, et le protège. */
export async function addToBinder(userId: string, binderId: string, copyId: string): Promise<{ position: number }> {
  await ownBinder(userId, binderId);
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM "Binder" WHERE id = ${String(binderId)} FOR UPDATE`;
    const copy = await tx.cardCopy.findFirst({
      where: { id: String(copyId), ownerId: userId },
      select: { id: true, status: true, binderSlot: { select: { binderId: true } } },
    });
    if (!copy) throw new BinderError("unavailable", "Cet exemplaire n'est plus dans ta collection.");
    if (copy.status !== "owned") throw new BinderError("unavailable", "Retire d'abord cet exemplaire du marché.");
    if (copy.binderSlot) throw new BinderError("in_binder", "Cet exemplaire est déjà rangé dans un classeur.");
    const agg = await tx.binderSlot.aggregate({ where: { binderId: String(binderId) }, _count: { _all: true }, _max: { position: true } });
    if (agg._count._all >= rules.maxSlots) throw new BinderError("full", `Ce classeur est plein (${rules.maxSlots} cartes).`);
    const position = (agg._max.position ?? -1) + 1;
    await tx.binderSlot.create({ data: { binderId: String(binderId), copyId: copy.id, position } });
    await tx.cardCopy.update({ where: { id: copy.id }, data: { lockedAt: new Date() } });
    await tx.binder.update({ where: { id: String(binderId) }, data: { updatedAt: new Date() } });
    return { position };
  });
}

/** Retire un exemplaire de son classeur et le libère. */
export async function removeFromBinder(userId: string, copyId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const slot = await tx.binderSlot.findUnique({
      where: { copyId: String(copyId) },
      select: { binderId: true, binder: { select: { ownerId: true } } },
    });
    if (!slot || slot.binder.ownerId !== userId) throw new BinderError("not_found", "Cet exemplaire n'est pas dans un de tes classeurs.");
    await tx.binderSlot.delete({ where: { copyId: String(copyId) } });
    await tx.cardCopy.update({ where: { id: String(copyId) }, data: { lockedAt: null } });
    await tx.binder.update({ where: { id: slot.binderId }, data: { updatedAt: new Date() } });
  });
}
