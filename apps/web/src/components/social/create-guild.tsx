"use client";

import { Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createGuildAction } from "@/app/actions/social";
import { emitBalance } from "@/lib/balance-events";
import { Jetons } from "@/components/jetons";
import { toast } from "@/components/toaster";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

const field = "h-11 rounded-xl border border-line bg-bg px-3 outline-none focus:border-accent";

/** Fonder une guilde (payant en Jetons, débité par le serveur). */
export function CreateGuild({ cost, balance }: { cost: number; balance: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const short = balance < cost;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await createGuildAction({ name, tag, description });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      emitBalance(balance - cost);
      toast({ title: `Guilde [${res.data.tag}] fondée\u00a0!`, jetons: -cost });
      router.push(`/guildes/${res.data.id}`);
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus aria-hidden="true" />
        Fonder une guilde
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Fonder une guilde"
        description={
          <>
            Coût : <Jetons value={cost} className="text-fg" /> · ton solde : <Jetons value={balance} className="text-fg" />
          </>
        }
      >
        <form onSubmit={submit} className="grid gap-4">
          <label className="grid gap-1.5 text-sm">
            <span className="font-semibold">Nom</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              minLength={3}
              maxLength={32}
              required
              className={field}
              placeholder="Les Collectionneurs du Bourg"
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-semibold">Sigle</span>
            <input
              value={tag}
              onChange={(e) => setTag(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
              minLength={2}
              maxLength={5}
              required
              className={`${field} font-mono`}
              placeholder="BOURG"
            />
            <span className="text-xs text-muted">2 à 5 lettres ou chiffres, affiché à côté du nom des membres.</span>
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-semibold">Description (facultatif)</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={280}
              rows={3}
              className="resize-none rounded-xl border border-line bg-bg px-3 py-2 outline-none focus:border-accent"
            />
          </label>
          {(error || short) && (
            <p role="alert" className="text-sm text-coral">
              {error ?? "Solde insuffisant pour fonder une guilde."}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={pending || short}>
              {pending && <Loader2 aria-hidden="true" className="animate-spin" />}
              Fonder pour <Jetons value={cost} />
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
