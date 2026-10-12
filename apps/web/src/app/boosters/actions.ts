"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { BoosterError, openFreeBooster, type BoosterResult } from "@/lib/boosters";

export type OpenBoosterResponse = { ok: true; result: BoosterResult } | { ok: false; error: string };

/** Intention du joueur : « ouvrir un booster ». Tout le reste est décidé par le serveur. */
export async function openBoosterAction(): Promise<OpenBoosterResponse> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Connecte-toi pour ouvrir des boosters." };
  try {
    const result = await openFreeBooster(session.user.id);
    revalidatePath("/", "layout");
    return { ok: true, result };
  } catch (err) {
    if (err instanceof BoosterError) return { ok: false, error: err.message };
    console.error("[boosters] ouverture impossible", err);
    return { ok: false, error: "L'ouverture a échoué, réessaie dans un instant." };
  }
}
