"use server";

import { ListError, setFavorite, setWishlisted } from "@pokeflex/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { checkActionRate } from "@/lib/rate-limit";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function run<T>(fn: (uid: string) => Promise<T>, label: string): Promise<Result<T>> {
  const session = await auth();
  const uid = session?.user?.id;
  if (!uid) return { ok: false, error: "Connecte-toi pour gérer tes favoris et ta wishlist." };
  const limited = checkActionRate(uid, "lists");
  if (limited) return { ok: false, error: limited };
  try {
    const data = await fn(uid);
    revalidatePath("/", "layout");
    return { ok: true, data };
  } catch (err) {
    if (err instanceof ListError) return { ok: false, error: err.message };
    console.error(`[listes] ${label}`, err);
    return { ok: false, error: "L'action a échoué, réessaie dans un instant." };
  }
}

/** Intention : mettre ou retirer une carte de ses favoris (la possession est vérifiée par le serveur). */
export async function setFavoriteAction(cardId: string, on: boolean) {
  return run((uid) => setFavorite(uid, String(cardId).slice(0, 80), Boolean(on)), "favori");
}

export async function setWishlistedAction(cardId: string, on: boolean) {
  return run((uid) => setWishlisted(uid, String(cardId).slice(0, 80), Boolean(on)), "wishlist");
}
