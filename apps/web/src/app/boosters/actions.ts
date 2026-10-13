"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { checkActionRate } from "@/lib/rate-limit";
import { BoosterError, openBooster, openFreeBooster, type BoosterResult } from "@pokeflex/server";

export type OpenBoosterResponse = { ok: true; result: BoosterResult } | { ok: false; error: string };

/** Intention du joueur : « ouvrir un booster ». Tout le reste est décidé par le serveur. */
export async function openBoosterAction(): Promise<OpenBoosterResponse> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Connecte-toi pour ouvrir des boosters." };
  const limited = checkActionRate(session.user.id, "booster");
  if (limited) return { ok: false, error: limited };
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

/** Intention : « acheter et ouvrir un booster de ce set ». Prix, solde et tirage sont décidés par le serveur. */
export async function openSetBoosterAction(setId: string): Promise<OpenBoosterResponse> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Connecte-toi pour ouvrir des boosters." };
  const limited = checkActionRate(session.user.id, "booster");
  if (limited) return { ok: false, error: limited };
  try {
    const result = await openBooster(session.user.id, { kind: "set", setId: String(setId) });
    revalidatePath("/", "layout");
    return { ok: true, result };
  } catch (err) {
    if (err instanceof BoosterError) return { ok: false, error: err.message };
    console.error("[boosters] ouverture de set impossible", err);
    return { ok: false, error: "L'ouverture a échoué, réessaie dans un instant." };
  }
}
