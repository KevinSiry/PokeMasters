import { TIER_LABELS_FR, rarityLabel, type Tier } from "@pokeflex/config";
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

/**
 * Badge de rareté. Avec `rarityRaw`, affiche la rareté officielle de la carte (« Double Rare »),
 * aux couleurs de son tier ; sans, le nom du tier (groupes de raretés : taux, recyclage…).
 */
export function TierBadge({ tier, rarityRaw, className }: { tier: Tier; rarityRaw?: string | null; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-semibold",
        TIER_TEXT[tier],
        className,
      )}
    >
      <span aria-hidden="true">{TIER_ICON[tier]}</span>
      {rarityRaw === undefined ? TIER_LABELS_FR[tier] : rarityLabel({ tier, rarityRaw })}
    </span>
  );
}
