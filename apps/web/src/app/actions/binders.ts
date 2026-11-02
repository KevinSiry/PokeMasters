"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { checkActionRate } from "@/lib/rate-limit";
import {
  addToBinder,
  BinderError,
  createBinder,
  deleteBinder,
  removeFromBinder,
  setCopyLock,
  updateBinder,
} from "@pokeflex/server";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function run<T>(fn: (uid: string) => Promise<T>, label: string): Promise<Result<T>> {
  const session = await auth();
  const uid = session?.user?.id;
  if (!uid) return { ok: false, error: "Connecte-toi pour continuer." };
  const limited = checkActionRate(uid, "lists");
  if (limited) return { ok: false, error: limited };
  try {
    const data = await fn(uid);
    revalidatePath("/", "layout");
    return { ok: true, data };
  } catch (err) {
    if (err instanceof BinderError) return { ok: false, error: err.message };
    console.error(`[classeurs] ${label}`, err);
    return { ok: false, error: "L'action a échoué, réessaie dans un instant." };
  }
}

/** Intention : protéger (cadenas) ou libérer cet exemplaire. */
export async function setCopyLockAction(copyId: string, locked: boolean) {
  return run((uid) => setCopyLock(uid, String(copyId), Boolean(locked)), "cadenas");
}

export async function createBinderAction(name: string) {
  return run((uid) => createBinder(uid, String(name ?? "")), "création");
}

export async function updateBinderAction(binderId: string, patch: { name?: string; isPublic?: boolean }) {
  const clean: { name?: string; isPublic?: boolean } = {};
  if (typeof patch?.name === "string") clean.name = patch.name;
  if (typeof patch?.isPublic === "boolean") clean.isPublic = patch.isPublic;
  return run((uid) => updateBinder(uid, String(binderId), clean), "modification");
}

export async function deleteBinderAction(binderId: string) {
  return run((uid) => deleteBinder(uid, String(binderId)), "suppression");
}

export async function addToBinderAction(binderId: string, copyId: string) {
  return run((uid) => addToBinder(uid, String(binderId), String(copyId)), "rangement");
}

export async function removeFromBinderAction(copyId: string) {
  return run((uid) => removeFromBinder(uid, String(copyId)), "retrait");
}
