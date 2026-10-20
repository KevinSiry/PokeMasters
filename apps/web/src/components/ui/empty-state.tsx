import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * État vide commun : pictogramme, phrase courte, explication et action pour en sortir.
 * Même cadre pointillé partout (collection, marché, échanges, social).
 */
export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid justify-items-center gap-3 rounded-2xl border border-dashed border-line px-5 py-10 text-center", className)}>
      {Icon && (
        <span aria-hidden="true" className="grid size-12 place-items-center rounded-2xl bg-elev text-accent">
          <Icon className="size-6" />
        </span>
      )}
      <p className="font-display text-base font-bold">{title}</p>
      {children && <div className="max-w-[48ch] text-sm text-muted">{children}</div>}
      {action && <div className="mt-1 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}
