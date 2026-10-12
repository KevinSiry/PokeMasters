"use server";

import {
  acceptChallenge,
  createChallenge,
  createTrainingDuel,
  DuelError,
  findOpponents,
  getStakeCandidates,
  withdrawChallenge,
} from "@pokeflex/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function run<T>(fn: (uid: string) => Promise<T>, label: string): Promise<Result<T>> {
  const session = await auth();
  const uid = session?.user?.id;
  if (!uid) return { ok: false, error: "Connecte-toi pour jouer en duel." };
  try {
    const data = await fn(uid);
    revalidatePath("/duels");
    return { ok: true, data };
  } catch (err) {
    if (err instanceof DuelError) return { ok: false, error: err.message };
    console.error(`[duels] ${label}`, err);
    return { ok: false, error: "L'action a échoué, réessaie dans un instant." };
  }
}

const ids = (v: unknown) => (Array.isArray(v) ? v.map(String).slice(0, 10) : []);

/** Intention : défier ce joueur en misant ces cartes. Propriété et disponibilité sont vérifiées par le serveur. */
export async function createChallengeAction(handle: string, copyIds: string[]) {
  return run((uid) => createChallenge(uid, String(handle), ids(copyIds)), "défi");
}

export async function acceptChallengeAction(duelId: string, copyIds: string[]) {
  return run((uid) => acceptChallenge(uid, String(duelId), ids(copyIds)), "acceptation");
}

/** Refuser un défi reçu ou annuler un défi envoyé : les cartes misées sont rendues. */
export async function withdrawChallengeAction(duelId: string) {
  return run((uid) => withdrawChallenge(uid, String(duelId)), "retrait du défi");
}

export async function startTrainingAction() {
  return run((uid) => createTrainingDuel(uid), "entraînement");
}

export async function searchOpponentsAction(q: string) {
  return run((uid) => findOpponents(uid, String(q ?? "").slice(0, 40)), "recherche");
}

export async function stakeCandidatesAction() {
  return run((uid) => getStakeCandidates(uid), "cartes à miser");
}
