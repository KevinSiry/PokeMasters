"use server";

import {
  blockUser,
  createGuild,
  getConversation,
  getShowcaseCandidates,
  joinGuild,
  leaveGuild,
  manageGuildMember,
  removeFriend,
  reportUser,
  respondFriendRequest,
  searchPlayers,
  sendFriendRequest,
  setShowcase,
  SocialError,
  unblockUser,
  updateGuildDescription,
  updateProfile,
} from "@pokeflex/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function run<T>(fn: (uid: string) => Promise<T>, label: string): Promise<Result<T>> {
  const session = await auth();
  const uid = session?.user?.id;
  if (!uid) return { ok: false, error: "Connecte-toi pour continuer." };
  try {
    const data = await fn(uid);
    revalidatePath("/", "layout");
    return { ok: true, data };
  } catch (err) {
    if (err instanceof SocialError) return { ok: false, error: err.message };
    console.error(`[social] ${label}`, err);
    return { ok: false, error: "L'action a échoué, réessaie dans un instant." };
  }
}

const str = (v: unknown, max = 200) => String(v ?? "").slice(0, max);

// ───── Profil ─────

export async function updateProfileAction(input: { handle?: string; bio?: string | null }) {
  return run(
    (uid) =>
      updateProfile(uid, {
        handle: input.handle === undefined ? undefined : str(input.handle, 40),
        bio: input.bio === undefined ? undefined : input.bio === null ? null : str(input.bio, 400),
      }),
    "profil",
  );
}

export async function setShowcaseAction(cardIds: string[]) {
  return run((uid) => setShowcase(uid, Array.isArray(cardIds) ? cardIds.map(String).slice(0, 12) : []), "vitrine");
}

export async function showcaseCandidatesAction(q: string) {
  return run((uid) => getShowcaseCandidates(uid, str(q, 60)), "cartes de vitrine");
}

// ───── Amis, blocages, signalements ─────

export async function searchPlayersAction(q: string) {
  return run((uid) => searchPlayers(uid, str(q, 40)), "recherche de joueurs");
}

/** Renvoie l'identifiant du joueur visé pour que le client le prévienne en direct. */
export async function sendFriendRequestAction(handle: string) {
  return run(async (uid) => {
    const r = await sendFriendRequest(uid, str(handle, 40));
    return {
      status: r.status,
      target: r.target.id,
      name: r.target.name ?? r.target.handle ?? "",
    };
  }, "demande d'ami");
}

export async function respondFriendRequestAction(fromId: string, accept: boolean) {
  return run((uid) => respondFriendRequest(uid, str(fromId), Boolean(accept)), "réponse d'ami");
}

export async function removeFriendAction(otherId: string) {
  return run((uid) => removeFriend(uid, str(otherId)), "retrait d'ami");
}

export async function blockUserAction(targetId: string) {
  return run((uid) => blockUser(uid, str(targetId)), "blocage");
}

export async function unblockUserAction(targetId: string) {
  return run((uid) => unblockUser(uid, str(targetId)), "déblocage");
}

export async function reportUserAction(targetId: string, reason: string, details?: string, context?: string) {
  return run((uid) => reportUser(uid, str(targetId), str(reason, 20), details ? str(details, 600) : null, context ? str(context, 120) : null), "signalement");
}

// ───── Messages ─────

/** Messages plus anciens d'une conversation (défilement vers le haut). */
export async function olderMessagesAction(otherId: string, before: string) {
  return run((uid) => getConversation(uid, str(otherId), 40, new Date(str(before, 40))), "messages précédents");
}

// ───── Guildes ─────

export async function createGuildAction(input: { name: string; tag: string; description?: string }) {
  return run(
    (uid) =>
      createGuild(uid, {
        name: str(input.name, 60),
        tag: str(input.tag, 10),
        description: input.description ? str(input.description, 400) : null,
      }),
    "création de guilde",
  );
}

export async function joinGuildAction(guildId: string) {
  return run((uid) => joinGuild(uid, str(guildId)), "adhésion");
}

export async function leaveGuildAction() {
  return run((uid) => leaveGuild(uid), "départ de guilde");
}

export async function manageGuildMemberAction(targetId: string, action: "promote" | "demote" | "kick" | "transfer") {
  if (!["promote", "demote", "kick", "transfer"].includes(action)) return { ok: false as const, error: "Action inconnue." };
  return run((uid) => manageGuildMember(uid, str(targetId), action), "gestion de guilde");
}

export async function updateGuildDescriptionAction(description: string) {
  return run((uid) => updateGuildDescription(uid, description ? str(description, 400) : null), "description de guilde");
}
