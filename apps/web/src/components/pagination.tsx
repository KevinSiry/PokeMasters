import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { pageNumbers, type PageInfo } from "@/lib/pagination";
import { cn } from "@/lib/utils";

type Target = { href: (page: number) => string; onPage?: never } | { onPage: (page: number) => void; href?: never };

/**
 * Barre de pages : en liens avec `href` (rendu serveur, sans JavaScript), en boutons avec `onPage`
 * (composant client). Sur téléphone, « Page 3 / 9 » remplace les numéros pour tenir dans 360 px.
 */
export function Pagination({ info, label = "Pages", ...target }: { info: Pick<PageInfo, "page" | "pageCount">; label?: string } & Target) {
  if (info.pageCount <= 1) return null;
  const { page, pageCount } = info;
  const arrow = "pf-chip size-11 justify-center p-0 lg:size-10";
  type ItemProps = { className: string; "aria-label": string; "aria-current"?: "page"; rel?: string };
  const item = (to: number, props: ItemProps, children: ReactNode) =>
    target.href ? (
      <Link href={target.href(to)} {...props}>
        {children}
      </Link>
    ) : (
      <button type="button" onClick={() => target.onPage(to)} {...props} rel={undefined}>
        {children}
      </button>
    );
  return (
    <nav aria-label={label} className="flex items-center justify-center gap-1.5">
      {page > 1 ? (
        item(page - 1, { className: arrow, "aria-label": "Page précédente", rel: "prev" }, <ChevronLeft aria-hidden="true" className="size-4" />)
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
              {item(p, { className: "pf-chip min-w-11 justify-center font-mono", "aria-label": `Page ${p}`, "aria-current": p === page ? "page" : undefined }, p)}
            </li>
          ),
        )}
      </ul>
      {page < pageCount ? (
        item(page + 1, { className: arrow, "aria-label": "Page suivante", rel: "next" }, <ChevronRight aria-hidden="true" className="size-4" />)
      ) : (
        <span className={cn(arrow, "opacity-40")} aria-hidden="true">
          <ChevronRight className="size-4" />
        </span>
      )}
    </nav>
  );
}
