import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "../cn";

/** A card with a title, holding a list or a few facts: the building block of overview screens. */
export function Panel({
  title,
  count,
  action,
  children,
  className,
}: {
  title: ReactNode;
  /** A number after the title, e.g. how many are overdue. */
  count?: number;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex min-w-0 flex-col rounded-panel border border-line-card bg-card", className)}>
      <header className="flex min-h-14 items-center justify-between gap-3 px-4 pt-3 pb-2 lg:px-6">
        <h2 className="flex items-baseline gap-2 font-serif text-[22px] leading-tight">
          {title}
          {count !== undefined && <span className="font-sans text-meta text-muted">{count}</span>}
        </h2>
        {action}
      </header>
      {children}
    </section>
  );
}

/** Rows inside a Panel, divided by hairlines. */
export function PanelList({ children }: { children: ReactNode }) {
  return <ul className="flex flex-col divide-y divide-line border-t border-line">{children}</ul>;
}

/** A row: what it is on the left (a title and a line under it), and what to do or know on the right. */
export function PanelRow({
  title,
  meta,
  detail,
  aside,
  href,
}: {
  title: ReactNode;
  /** The line under the title. */
  meta?: ReactNode;
  /** A second line under that, quieter. */
  detail?: ReactNode;
  aside?: ReactNode;
  /** Makes the title a link to the record. */
  href?: string;
}) {
  return (
    <li className="flex min-h-14 items-center gap-3 px-4 py-2.5 lg:px-6">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {href ? (
          <Link href={href} className="truncate text-sm font-medium text-ink hover:text-muted">
            {title}
          </Link>
        ) : (
          <span className="truncate text-sm font-medium">{title}</span>
        )}
        {meta && <span className="truncate text-meta text-muted">{meta}</span>}
        {detail && <span className="truncate text-xs text-muted">{detail}</span>}
      </div>
      {aside && <div className="flex shrink-0 items-center gap-2">{aside}</div>}
    </li>
  );
}

/** What a Panel says when there's nothing in it. */
export function PanelEmpty({ children }: { children: ReactNode }) {
  return <p className="border-t border-line px-4 py-5 text-sm text-muted lg:px-6">{children}</p>;
}
