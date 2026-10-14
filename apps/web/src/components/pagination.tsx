import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { pageNumbers, type PageInfo } from "@/lib/pagination";
import { cn } from "@/lib/utils";

/**
 * Barre de pages en liens (rendu serveur, sans JavaScript). Sur téléphone, « Page 3 / 9 » remplace
 * les numéros pour tenir dans 360 px.
 */
export function Pagination({ info, href, label = "Pages" }: { info: PageInfo; href: (page: number) => string; label?: string }) {
  if (info.pageCount <= 1) return null;
  const { page, pageCount } = info;
  const arrow = "pf-chip size-10 justify-center p-0";
  return (
    <nav aria-label={label} className="flex items-center justify-center gap-1.5">
      {page > 1 ? (
        <Link href={href(page - 1)} className={arrow} aria-label="Page précédente" rel="prev">
          <ChevronLeft aria-hidden="true" className="size-4" />
        </Link>
      ) : (
        <span className={cn(arrow, "opacity-40")} aria-hidden="true">
          <ChevronLeft className="size-4" />
        </span>
      )}
      <span className="px-2 font-mono text-sm text-muted sm:hidden">
        Page {page} / {pageCount}
      </span>
      <ul className="hidden items-center gap-1.5 sm:flex">
        {pageNumbers(page, pageCount).map((p, i) =>
          p === null ? (
            <li key={`gap-${i}`} aria-hidden="true" className="px-1 text-muted">
              …
            </li>
          ) : (
            <li key={p}>
              <Link href={href(p)} className="pf-chip min-w-10 justify-center font-mono" aria-current={p === page ? "page" : undefined} aria-label={`Page ${p}`}>
                {p}
              </Link>
            </li>
          ),
        )}
      </ul>
      {page < pageCount ? (
        <Link href={href(page + 1)} className={arrow} aria-label="Page suivante" rel="next">
          <ChevronRight aria-hidden="true" className="size-4" />
        </Link>
      ) : (
        <span className={cn(arrow, "opacity-40")} aria-hidden="true">
          <ChevronRight className="size-4" />
        </span>
      )}
    </nav>
  );
}
