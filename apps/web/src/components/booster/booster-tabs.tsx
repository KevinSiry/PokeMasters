import { Gift, Library } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Bascule entre boosters gratuits et boosters de set. */
export function BoosterTabs({ current }: { current: "free" | "sets" }) {
  const tab = "flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors [&_svg]:size-4";
  return (
    <nav aria-label="Type de booster" className="mx-auto mt-6 flex w-full max-w-sm gap-1 rounded-full border border-line bg-surface p-1">
      <Link href="/boosters" aria-current={current === "free" ? "page" : undefined} className={cn(tab, current === "free" ? "bg-elev text-fg" : "text-muted hover:text-fg")}>
        <Gift aria-hidden="true" />
        Gratuits
      </Link>
      <Link href="/boosters/sets" aria-current={current === "sets" ? "page" : undefined} className={cn(tab, current === "sets" ? "bg-elev text-fg" : "text-muted hover:text-fg")}>
        <Library aria-hidden="true" />
        Boosters de set
      </Link>
    </nav>
  );
}
