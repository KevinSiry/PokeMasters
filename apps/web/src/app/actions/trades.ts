"use server";

import { acceptTrade, cancelTrade, declineTrade, proposeTrade, TradeError } from "@pokeflex/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { checkActionRate } from "@/lib/rate-limit";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function run<T>(fn: (uid: string) => Promise<T>, label: string): Promise<Result<T>> {
  const session = await auth();
  const uid = session?.user?.id;
  if (!uid) return { ok: false, error: "Connecte-toi pour échanger des cartes." };
  const limited = checkActionRate(uid, "trades");
  if (limited) return { ok: false, error: limited };
  try {
    const data = await fn(uid);
    revalidatePath("/", "layout");
    return { ok: true, data };
  } catch (err) {
    if (err instanceof TradeError) {
      // Une offre devenue indisponible vient d'être close : les pages doivent le montrer.
      if (err.code === "unavailable") revalidatePath("/", "layout");
      return { ok: false, error: err.message };
    }
    console.error(`[echanges] ${label}`, err);
    return { ok: false, error: "L'action a échoué, réessaie dans un instant." };
  }
}

const ids = (list: unknown) => (Array.isArray(list) ? list.slice(0, 20).map((x) => String(x).slice(0, 40)) : []);

/** Intention : proposer un échange. Propriété, disponibilité et favoris sont vérifiés par le serveur. */
export async function proposeTradeAction(input: { to: string; give: string[]; take: string[]; message?: string | null; counterOf?: string | null }) {
  return run(
    (uid) =>
      proposeTrade(uid, {
        to: String(input.to).slice(0, 40),
        give: ids(input.give),
        take: ids(input.take),
        message: input.message === undefined || input.message === null ? null : String(input.message).slice(0, 1000),
        counterOf: input.counterOf ? String(input.counterOf).slice(0, 40) : null,
      }),
    "proposition",
  );
}

export async function acceptTradeAction(tradeId: string) {
  return run((uid) => acceptTrade(uid, String(tradeId)), "acceptation");
}

export async function declineTradeAction(tradeId: string) {
  return run((uid) => declineTrade(uid, String(tradeId)), "refus");
}

export async function cancelTradeAction(tradeId: string) {
  return run((uid) => cancelTrade(uid, String(tradeId)), "annulation");
}
