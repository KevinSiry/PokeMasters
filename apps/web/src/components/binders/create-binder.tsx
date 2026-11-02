"use client";

import { gameConfig } from "@pokeflex/config";
import { Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createBinderAction } from "@/app/actions/binders";
import { toast } from "@/components/toaster";
import { Button } from "@/components/ui/button";

/** Créer un classeur (nom libre). */
export function CreateBinder() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, start] = useTransition();

  return (
    <form
      className="flex max-w-md gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        start(async () => {
          const res = await createBinderAction(name);
          if (!res.ok) return void toast({ title: "Création impossible", description: res.error, tone: "error" });
          setName("");
          router.push(`/classeurs/${res.data.id}`);
        });
      }}
    >
      <label className="min-w-0 flex-1">
        <span className="sr-only">Nom du nouveau classeur</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={gameConfig.binders.nameMaxLength}
          placeholder="Nom du classeur (ex. Mes Dracaufeu)"
          autoComplete="off"
          className="h-11 w-full rounded-xl border border-line bg-bg px-3 outline-none focus:border-accent"
        />
      </label>
      <Button type="submit" disabled={!name.trim() || pending}>
        {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Plus aria-hidden="true" />}
        Créer
      </Button>
    </form>
  );
}
