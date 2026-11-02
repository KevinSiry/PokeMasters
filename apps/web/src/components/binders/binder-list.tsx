import type { BinderSummary } from "@pokeflex/server";
import { BookOpen, EyeOff } from "lucide-react";
import Link from "next/link";
import { CardImage } from "@/components/card-image";
import { plural } from "@/lib/format";

/** Vignettes de classeurs : trois premières cartes en éventail, nom et nombre de cartes. */
export function BinderList({ binders, showPrivacy }: { binders: BinderSummary[]; showPrivacy?: boolean }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {binders.map((b) => (
        <li key={b.id}>
          <Link
            href={`/classeurs/${b.id}`}
            className="group grid gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-3 transition-colors hover:border-accent"
          >
            <div className="relative grid h-28 place-items-center overflow-hidden rounded-xl bg-elev sm:h-32">
              {b.covers.length === 0 ? (
                <BookOpen aria-hidden="true" className="size-8 text-muted" />
              ) : (
                <div className="flex -space-x-8">
                  {b.covers.map((img, i) => (
                    <div key={i} className="w-16 sm:w-20" style={{ transform: `rotate(${(i - (b.covers.length - 1) / 2) * 8}deg)` }}>
                      <CardImage image={img} name="" />
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="grid min-w-0 gap-0.5">
              <span className="truncate text-sm font-semibold">{b.name}</span>
              <span className="inline-flex items-center gap-1 text-xs text-muted">
                {plural(b.count, "carte")}
                {showPrivacy && !b.isPublic && (
                  <>
                    {" · "}
                    <EyeOff aria-hidden="true" className="size-3" /> privé
                  </>
                )}
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
