import { TIER_LABELS_FR, type Tier } from "@pokeflex/config";
import { cn } from "@/lib/utils";

/** Chaque tier a une couleur ET une forme : lisible sans distinguer les couleurs. */
export const TIER_ICON: Record<Tier, string> = {
  common: "●",
  uncommon: "◆",
  rare: "★",
  epic: "✦",
  legendary: "♛",
  mythic: "✺",
};

export const TIER_TEXT: Record<Tier, string> = {
  common: "text-tier-common",
  uncommon: "text-tier-uncommon",
  rare: "text-tier-rare",
  epic: "text-tier-epic",
  legendary: "text-tier-legendary",
  mythic: "text-tier-mythic",
};

export function TierBadge({ tier, className }: { tier: Tier; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-semibold",
        TIER_TEXT[tier],
        className,
      )}
    >
      <span aria-hidden="true">{TIER_ICON[tier]}</span>
      {TIER_LABELS_FR[tier]}
    </span>
  );
}
