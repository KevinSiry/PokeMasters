"use client";

import { gameConfig } from "@pokeflex/config";
import { Eye, EyeOff, Pencil, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { deleteBinderAction, removeFromBinderAction, updateBinderAction } from "@/app/actions/binders";
import { toast } from "@/components/toaster";
import { Button } from "@/components/ui/button";

/** Réglages d'un classeur par son propriétaire : nom, visibilité, suppression. */
export function BinderControls({ id, name, isPublic }: { id: string; name: string; isPublic: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!confirmDelete) return;
    const t = window.setTimeout(() => setConfirmDelete(false), 4000);
    return () => window.clearTimeout(t);
  }, [confirmDelete]);

  function update(patch: { name?: string; isPublic?: boolean }) {
    start(async () => {
      const res = await updateBinderAction(id, patch);
      if (!res.ok) return void toast({ title: "Modification impossible", description: res.error, tone: "error" });
      setEditing(false);
      router.refresh();
    });
  }

  function remove() {
    if (!confirmDelete) return setConfirmDelete(true);
    start(async () => {
      const res = await deleteBinderAction(id);
      if (!res.ok) return void toast({ title: "Suppression impossible", description: res.error, tone: "error" });
      toast({ title: "Classeur supprimé", description: "Ses cartes restent dans ta collection.", tone: "info" });
      router.push("/collection?vue=classeurs");
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {editing ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            update({ name: value });
          }}
        >
          <label>
            <span className="sr-only">Nouveau nom</span>
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              maxLength={gameConfig.binders.nameMaxLength}
              className="h-11 w-56 rounded-xl border border-line bg-bg px-3 outline-none focus:border-accent"
            />
          </label>
          <Button type="submit" disabled={pending || !value.trim()}>
            Enregistrer
          </Button>
        </form>
      ) : (
        <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
          <Pencil aria-hidden="true" />
          Renommer
        </Button>
      )}
      <Button variant="secondary" size="sm" disabled={pending} onClick={() => update({ isPublic: !isPublic })}>
        {isPublic ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        {isPublic ? "Rendre privé" : "Rendre public"}
      </Button>
      <Button variant="ghost" size="sm" disabled={pending} onClick={remove} className={confirmDelete ? "text-coral" : undefined}>
        <Trash2 aria-hidden="true" />
        {confirmDelete ? "Confirmer la suppression ?" : "Supprimer"}
      </Button>
    </div>
  );
}

/** Retirer un exemplaire du classeur (il redevient libre). */
export function RemoveFromBinder({ copyId, cardName }: { copyId: string; cardName: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      aria-label={`Retirer ${cardName} du classeur`}
      onClick={() =>
        start(async () => {
          const res = await removeFromBinderAction(copyId);
          if (!res.ok) return void toast({ title: "Impossible", description: res.error, tone: "error" });
          router.refresh();
        })
      }
      className="pf-hit absolute top-1.5 right-1.5 z-10 grid size-7 place-items-center rounded-full bg-bg/80 text-fg backdrop-blur transition-colors hover:bg-coral disabled:opacity-50"
    >
      <X aria-hidden="true" className="size-4" />
    </button>
  );
}
