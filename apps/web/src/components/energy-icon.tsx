import { Circle, Cog, Droplet, Eye, Flame, Leaf, Moon, Mountain, Sparkles, Star, Zap, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Libellés français des types canoniques (codes stockés en base). */
export const TYPE_LABELS: Record<string, string> = {
  grass: "Plante",
  fire: "Feu",
  water: "Eau",
  lightning: "Électrique",
  psychic: "Psy",
  fighting: "Combat",
  darkness: "Obscurité",
  metal: "Métal",
  fairy: "Fée",
  dragon: "Dragon",
  colorless: "Incolore",
};

const STYLE: Record<string, { icon: LucideIcon; bg: string; fg: string }> = {
  grass: { icon: Leaf, bg: "#3FA34D", fg: "#F2FFF0" },
  fire: { icon: Flame, bg: "#E4572E", fg: "#FFF4EE" },
  water: { icon: Droplet, bg: "#2D8FE0", fg: "#EEF7FF" },
  lightning: { icon: Zap, bg: "#F2C23A", fg: "#3A2B00" },
  psychic: { icon: Eye, bg: "#A65BD6", fg: "#FBF2FF" },
  fighting: { icon: Mountain, bg: "#B5652D", fg: "#FFF3EA" },
  darkness: { icon: Moon, bg: "#30384A", fg: "#E9EEFF" },
  metal: { icon: Cog, bg: "#8C97A6", fg: "#151A22" },
  fairy: { icon: Sparkles, bg: "#E57BB5", fg: "#FFF1F8" },
  dragon: { icon: Star, bg: "#B49A2E", fg: "#1D1700" },
  colorless: { icon: Circle, bg: "#D8D4E6", fg: "#25213A" },
};

/** Pastille d'énergie : couleur + pictogramme, avec libellé accessible. */
export function EnergyIcon({ type, size = 20, className }: { type: string; size?: number; className?: string }) {
  const s = STYLE[type] ?? { icon: Circle, bg: "#555", fg: "#fff" };
  const Icon = s.icon;
  return (
    <span
      role="img"
      aria-label={TYPE_LABELS[type] ?? type}
      title={TYPE_LABELS[type] ?? type}
      className={cn("inline-grid shrink-0 place-items-center rounded-full ring-1 ring-black/30", className)}
      style={{ width: size, height: size, background: s.bg, color: s.fg }}
    >
      <Icon aria-hidden="true" style={{ width: size * 0.6, height: size * 0.6 }} strokeWidth={2.4} />
    </span>
  );
}
