import { Fragment, type ReactNode } from "react";
import Link from "next/link";

export type Crumb = { label: ReactNode; href?: string };

export function Crumbs({ items }: { items: Crumb[] }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="inline-flex items-center gap-2.5 font-mono text-[11px] tracking-[.2em] uppercase"
    >
      <span className="h-px w-7 bg-muted" aria-hidden />
      <ol className="inline-flex items-center gap-2">
        {items.map((c, i) => {
          const isLast = i === items.length - 1;
          return (
            <Fragment key={i}>
              {i > 0 && (
                <li aria-hidden className="text-muted">
                  ·
                </li>
              )}
              <li>
                {c.href && !isLast ? (
                  <Link
                    href={c.href}
                    className="text-muted hover:text-ink transition-colors underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-1 focus-visible:outline-ink"
                  >
                    {c.label}
                  </Link>
                ) : (
                  <span
                    className={isLast ? "text-ink" : "text-muted"}
                    aria-current={isLast ? "page" : undefined}
                  >
                    {c.label}
                  </span>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
