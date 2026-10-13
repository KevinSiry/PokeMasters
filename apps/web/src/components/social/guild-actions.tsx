"use client";

import { LogIn, LogOut, Pencil } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { joinGuildAction, leaveGuildAction, updateGuildDescriptionAction } from "@/app/actions/social";
import { toast } from "@/components/toaster";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { getSocket } from "@/lib/realtime";

type Role = "owner" | "officer" | "member";

export function GuildActions({
  guildId,
  me,
  role,
  inOtherGuild,
  full,
  alone,
  description,
}: {
  guildId: string;
  me: string | null;
  role: Role | null;
  inOtherGuild: boolean;
  full: boolean;
  alone: boolean;
  description: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(description);

  function act(fn: () => Promise<{ ok: boolean; error?: string }>, done: () => void) {
    start(async () => {
      const res = await fn();
      if (!res.ok) {
        toast({ title: res.error ?? "L'action a échoué.", tone: "error" });
        return;
      }
      done();
      getSocket().emit("guild:sync", { userId: me, guildId });
      router.refresh();
    });
  }

  if (!me) {
    return (
      <Button asChild>
        <Link href={`/connexion?suite=/guildes/${guildId}`}>Se connecter pour rejoindre</Link>
      </Button>
    );
  }

  if (!role) {
    return (
      <div className="grid justify-items-start gap-1.5 sm:justify-items-end">
        <Button
          disabled={pending || full || inOtherGuild}
          onClick={() =>
            act(
              () => joinGuildAction(guildId),
              () => toast({ title: "Bienvenue dans la guilde\u00a0!" }),
            )
          }
        >
          <LogIn aria-hidden="true" />
          Rejoindre
        </Button>
        {(full || inOtherGuild) && <span className="text-xs text-muted">{full ? "Guilde complète." : "Quitte d'abord ta guilde actuelle."}</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {role !== "member" && (
        <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
          <Pencil aria-hidden="true" />
          Description
        </Button>
      )}
      <Button variant="secondary" size="sm" onClick={() => setConfirmLeave(true)}>
        <LogOut aria-hidden="true" />
        Quitter
      </Button>

      <Dialog
        open={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        title={"Quitter la guilde\u00a0?"}
        description={
          role === "owner"
            ? alone
              ? "Tu es le dernier membre : la guilde sera dissoute. Les Jetons de fondation ne sont pas rendus."
              : "Le rôle de chef passera au plus ancien officier (ou membre)."
            : "Tu pourras la rejoindre à nouveau s'il reste de la place."
        }
      >
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmLeave(false)}>
            Rester
          </Button>
          <Button
            disabled={pending}
            onClick={() =>
              act(
                () => leaveGuildAction(),
                () => {
                  setConfirmLeave(false);
                  toast({ title: "Tu as quitté la guilde.", tone: "info" });
                  router.push("/guildes");
                },
              )
            }
          >
            Quitter
          </Button>
        </div>
      </Dialog>

      <Dialog open={editing} onClose={() => setEditing(false)} title="Description de la guilde">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={280}
          rows={4}
          className="w-full resize-none rounded-xl border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setEditing(false)}>
            Annuler
          </Button>
          <Button
            disabled={pending}
            onClick={() =>
              act(
                () => updateGuildDescriptionAction(text),
                () => {
                  setEditing(false);
                  toast({ title: "Description mise à jour" });
                },
              )
            }
          >
            Enregistrer
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
