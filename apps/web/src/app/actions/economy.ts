"use server";

import type { Tier } from "@pokeflex/config";
import { InsufficientFundsError } from "@pokeflex/game";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { claimQuest, QuestError } from "@/lib/economy/quests";
import { previewDuplicates, recycleCopy, recycleDuplicates, RecycleError, type RecycleResult } from "@/lib/economy/recycle";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function userId() {
  const session = await auth();
  return session?.user?.id ?? null;
}

async function run<T>(fn: (uid: string) => Promise<T>, label: string): Promise<Result<T>> {
  const uid = await userId();
  if (!uid) return { ok: false, error: "Connecte-toi pour continuer." };
  try {
    const data = await fn(uid);
    revalidatePath("/", "layout");
    return { ok: true, data };
  } catch (err) {
    if (err instanceof RecycleError || err instanceof QuestError) return { ok: false, error: err.message };
    if (err instanceof InsufficientFundsError) return { ok: false, error: "Solde insuffisant." };
    console.error(`[economie] ${label}`, err);
    return { ok: false, error: "L'action a échoué, réessaie dans un instant." };
  }
}

/** Intention : recycler cet exemplaire. Le serveur vérifie qu'il t'appartient et qu'il est disponible. */
export async function recycleCopyAction(copyId: string): Promise<Result<RecycleResult>> {
  return run((uid) => recycleCopy(uid, String(copyId)), "recyclage");
}

export async function previewDuplicatesAction() {
  const uid = await userId();
  if (!uid) return null;
  return previewDuplicates(uid);
}

/** Intention : recycler mes doublons de ces tiers. La liste des exemplaires est recalculée côté serveur. */
export async function recycleDuplicatesAction(tiers: Tier[]): Promise<Result<RecycleResult>> {
  return run((uid) => recycleDuplicates(uid, Array.isArray(tiers) ? tiers : []), "recyclage des doublons");
}

export async function claimQuestAction(questId: string): Promise<Result<{ reward: number; balance: number }>> {
  return run((uid) => claimQuest(uid, String(questId)), "quête");
}
