"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Fenêtre modale basée sur <dialog> (piège du focus, Échap et arrière-plan inerte fournis par le navigateur).
 * Bas d'écran sur mobile, centrée sur ordinateur.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="pf-dialog-title"
      className={cn(
        "pf-dialog m-0 mt-auto w-full max-w-none rounded-t-[1.75rem] border border-line bg-surface p-0 text-fg backdrop:bg-black/70 backdrop:backdrop-blur-sm sm:m-auto sm:max-w-lg sm:rounded-[1.75rem]",
        className,
      )}
    >
      <div className="grid gap-5 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="grid gap-1">
            <h2 id="pf-dialog-title" className="font-display text-xl font-bold">
              {title}
            </h2>
            {description && <div className="text-sm text-muted">{description}</div>}
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" className="grid size-9 shrink-0 place-items-center rounded-full text-muted hover:bg-elev hover:text-fg">
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
