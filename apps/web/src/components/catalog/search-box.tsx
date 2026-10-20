import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

/** Champ de recherche (formulaire GET, fonctionne sans JavaScript). */
export function SearchBox({
  defaultValue,
  className,
  autoFocus,
  id = "pf-search",
  size = "md",
}: {
  defaultValue?: string;
  className?: string;
  autoFocus?: boolean;
  id?: string;
  /** « sm » : champ compact de l'en-tête. */
  size?: "sm" | "md";
}) {
  return (
    <form action="/recherche" role="search" className={cn("relative", className)}>
      <label htmlFor={id} className="sr-only">
        Rechercher une carte
      </label>
      <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted" />
      <input
        id={id}
        name="q"
        type="search"
        defaultValue={defaultValue}
        autoFocus={autoFocus}
        autoComplete="off"
        enterKeyHint="search"
        placeholder="Dracaufeu, Charizard, Pikachu…"
        className={cn(
          "w-full rounded-full border border-line bg-surface pr-4 pl-12 text-fg placeholder:text-muted/70 focus:border-accent focus:outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lime",
          size === "sm" ? "h-11 text-sm" : "h-13 text-base",
        )}
      />
    </form>
  );
}
