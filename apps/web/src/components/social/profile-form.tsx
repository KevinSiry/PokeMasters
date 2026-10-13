"use client";

import { AtSign, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateProfileAction } from "@/app/actions/social";
import { toast } from "@/components/toaster";
import { Button } from "@/components/ui/button";

const field = "rounded-xl border border-line bg-bg px-3 outline-none transition-colors focus:border-accent";

/** Pseudo et présentation. Les règles sont vérifiées par le serveur ; ici on guide la saisie. */
export function ProfileForm({ handle, bio, rules }: { handle: string; bio: string; rules: { min: number; max: number; bio: number } }) {
  const router = useRouter();
  const [h, setH] = useState(handle);
  const [b, setB] = useState(bio);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const dirty = h !== handle || b !== bio;

  function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await updateProfileAction({
        handle: h !== handle ? h : undefined,
        bio: b !== bio ? b : undefined,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast({ title: "Profil enregistré" });
      router.refresh();
    });
  }

  return (
    <form onSubmit={save} className="grid gap-5 rounded-[calc(var(--radius-card)*1.2)] border border-line bg-surface p-5 sm:p-6">
      <label className="grid gap-1.5 text-sm">
        <span className="font-semibold">Pseudo</span>
        <span className="relative">
          <AtSign aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <input
            value={h}
            onChange={(e) => setH(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
            minLength={rules.min}
            maxLength={rules.max}
            pattern="[a-z0-9_\-]+"
            autoComplete="off"
            spellCheck={false}
            required
            aria-describedby="handle-hint"
            className={`${field} h-11 w-full pl-9 font-mono`}
          />
        </span>
        <span id="handle-hint" className="text-xs text-muted">
          {rules.min} à {rules.max} caractères : lettres minuscules, chiffres, « - » et « _ ». Ton profil sera sur /joueurs/{h || "…"}
        </span>
      </label>
      <label className="grid gap-1.5 text-sm">
        <span className="flex justify-between font-semibold">
          Présentation
          <span className="font-mono text-xs font-normal text-muted">
            {b.length}/{rules.bio}
          </span>
        </span>
        <textarea
          value={b}
          onChange={(e) => setB(e.target.value)}
          maxLength={rules.bio}
          rows={3}
          placeholder="Ta carte préférée, ton set de cœur, ce que tu recherches…"
          className={`${field} resize-none py-2`}
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-coral">
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" disabled={!dirty || pending}>
          {pending && <Loader2 aria-hidden="true" className="animate-spin" />}
          Enregistrer
        </Button>
      </div>
    </form>
  );
}
