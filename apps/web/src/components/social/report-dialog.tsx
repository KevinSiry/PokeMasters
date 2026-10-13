"use client";

import { REPORT_REASONS, type ReportReason } from "@pokeflex/config";
import { useState, useTransition } from "react";
import { reportUserAction } from "@/app/actions/social";
import { toast } from "@/components/toaster";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** Signaler un joueur (motif + précisions facultatives). `context` désigne le message signalé, le cas échéant. */
export function ReportDialog({
  open,
  onClose,
  target,
  context,
}: {
  open: boolean;
  onClose: () => void;
  target: { id: string; name: string };
  context?: string;
}) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [pending, start] = useTransition();

  function submit() {
    if (!reason) return;
    start(async () => {
      const res = await reportUserAction(target.id, reason, details, context);
      if (!res.ok) {
        toast({ title: res.error, tone: "error" });
        return;
      }
      toast({
        title: "Signalement envoyé",
        description: "Merci, l'équipe va regarder ça.",
        tone: "info",
      });
      setReason(null);
      setDetails("");
      onClose();
    });
  }

  return (
    <Dialog open={open} onClose={onClose} title={`Signaler ${target.name}`} description="Ton signalement reste anonyme.">
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-semibold">Motif</legend>
        {(Object.entries(REPORT_REASONS) as [ReportReason, string][]).map(([key, label]) => (
          <label
            key={key}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors",
              reason === key ? "border-accent bg-accent/10" : "border-line hover:border-accent/60",
            )}
          >
            <input type="radio" name="reason" value={key} checked={reason === key} onChange={() => setReason(key)} className="accent-[var(--color-accent)]" />
            {label}
          </label>
        ))}
      </fieldset>
      <label className="mt-4 grid gap-1.5 text-sm">
        <span className="font-semibold">Précisions (facultatif)</span>
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          maxLength={500}
          rows={3}
          className="resize-none rounded-xl border border-line bg-bg px-3 py-2 outline-none focus:border-accent"
        />
      </label>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Annuler
        </Button>
        <Button onClick={submit} disabled={!reason || pending}>
          Envoyer
        </Button>
      </div>
    </Dialog>
  );
}
