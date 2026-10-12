"use server";

import type { ListingType } from "@pokeflex/db";
import { buyListing, cancelListing, createListing, MarketError, placeBid, type CompletedSet } from "@pokeflex/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function run<T>(fn: (uid: string) => Promise<T>, label: string): Promise<Result<T>> {
  const session = await auth();
  const uid = session?.user?.id;
  if (!uid) return { ok: false, error: "Connecte-toi pour utiliser le marché." };
  try {
    const data = await fn(uid);
    revalidatePath("/", "layout");
    return { ok: true, data };
  } catch (err) {
    if (err instanceof MarketError) return { ok: false, error: err.message };
    console.error(`[marche] ${label}`, err);
    return { ok: false, error: "L'action a échoué, réessaie dans un instant." };
  }
}

/** Intention : mettre cet exemplaire en vente. Frais, statut et propriété sont vérifiés par le serveur. */
export async function createListingAction(input: { copyId: string; type: ListingType; price: number; durationMs?: number }) {
  return run(
    (uid) => createListing(uid, { copyId: String(input.copyId), type: input.type, price: Number(input.price), durationMs: input.durationMs === undefined ? undefined : Number(input.durationMs) }),
    "mise en vente",
  );
}

export async function cancelListingAction(listingId: string) {
  return run((uid) => cancelListing(uid, String(listingId)), "retrait");
}

export async function buyListingAction(listingId: string): Promise<Result<{ cardId: string; price: number; balance: number; completedSets: CompletedSet[] }>> {
  return run((uid) => buyListing(uid, String(listingId)), "achat");
}

export async function placeBidAction(listingId: string, amount: number) {
  return run((uid) => placeBid(uid, String(listingId), Number(amount)), "enchère");
}
