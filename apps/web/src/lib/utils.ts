import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formate un montant de Jetons à la française (espace fine insécable). */
export function formatJetons(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(n);
}
