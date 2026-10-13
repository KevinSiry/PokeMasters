import { cn } from "@/lib/utils";

const SIZES = {
  xs: "size-6 text-[10px]",
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-16 text-xl",
  xl: "size-24 text-3xl",
} as const;

/** Avatar d'un joueur (image Twitch/Discord ou initiale sur un dégradé). */
export function PlayerAvatar({ name, image, size = "md", className }: { name: string; image: string | null; size?: keyof typeof SIZES; className?: string }) {
  return image ? (
    // eslint-disable-next-line @next/next/no-img-element -- avatar fourni par Twitch/Discord
    <img src={image} alt="" className={cn("shrink-0 rounded-full object-cover", SIZES[size], className)} />
  ) : (
    <span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent-strong/70 to-coral-strong/70 font-display font-bold text-fg",
        SIZES[size],
        className,
      )}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}
