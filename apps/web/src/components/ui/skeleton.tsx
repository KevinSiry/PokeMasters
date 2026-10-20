import { cn } from "@/lib/utils";

/** Bloc gris animé qui tient la place d'un contenu en cours de chargement. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("pf-shimmer rounded-xl", className)} />;
}

/** Grille de vignettes de cartes en chargement (même grille que les vraies vignettes). */
export function CardGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <ul aria-hidden="true" className="pf-card-grid">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="grid gap-1.5">
          <Skeleton className="aspect-[63/88] rounded-[var(--radius-card-image)]" />
          <Skeleton className="h-3.5 w-3/4 rounded-md" />
          <Skeleton className="h-3 w-1/3 rounded-md" />
        </li>
      ))}
    </ul>
  );
}
