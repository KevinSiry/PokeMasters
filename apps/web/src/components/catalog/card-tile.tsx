import type { Tier } from "@pokeflex/config";
import Link from "next/link";
import { CardImage } from "@/components/card-image";
import { TIER_ICON } from "@/components/tier-badge";
import { cn } from "@/lib/utils";

interface CardTileProps {
  card: { id: string; name: string; image: string | null; tier: Tier; lang: "fr" | "en"; localId?: string };
  subtitle?: string;
  priority?: boolean;
  /** Carte non possédée : affichée en silhouette (Pokédex). */
  missing?: boolean;
  badge?: React.ReactNode;
  href?: string;
  className?: string;
  hideTier?: boolean;
}

/** Vignette de carte cliquable : image basse définition, liseré et pictogramme du tier. */
export function CardTile({ card, subtitle, priority, missing, badge, href, className, hideTier }: CardTileProps) {
  return (
    <Link
      href={href ?? `/cartes/${card.id}`}
      className={cn("pf-tile group grid gap-2 rounded-[var(--radius-card)] outline-none", className)}
      data-tier={hideTier ? undefined : card.tier}
      data-missing={missing || undefined}
    >
      <div className="pf-tile-frame relative rounded-[var(--radius-card)]">
        <CardImage image={card.image} name={card.name} priority={priority} className={cn(missing && "pf-silhouette")} />
        {!hideTier && <span
          aria-hidden="true"
          className="pf-tier-pip absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full bg-bg/85 text-[11px] backdrop-blur"
        >
          {TIER_ICON[card.tier]}
        </span>}
        {card.lang === "en" && (
          <span className="absolute bottom-1.5 left-1.5 rounded bg-bg/85 px-1.5 py-0.5 font-mono text-[10px] font-bold text-muted backdrop-blur">
            EN
          </span>
        )}
        {badge}
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-0.5 px-0.5">
        <span className="truncate text-sm font-semibold group-hover:text-fg">{card.name}</span>
        {subtitle && <span className="truncate font-mono text-[11px] text-muted">{subtitle}</span>}
      </div>
    </Link>
  );
}
