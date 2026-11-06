import { ArrowDown, ArrowRight, ArrowUp, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "../cn";

export type Trend = { label: string; direction: "up" | "down" | "flat"; good?: boolean };

const arrows = { up: ArrowUp, down: ArrowDown, flat: ArrowRight };
const words = { up: "Up", down: "Down", flat: "No change" };

/** A small chip with an arrow and a change: "+4%". The arrow and words carry the meaning; the colour only says good or bad. */
function TrendChip({ label, direction, good }: Trend) {
  const Arrow = arrows[direction];
  const tone = direction === "flat" || good === undefined ? "text-muted" : good ? "text-success" : "text-error";
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border border-line-field px-2 py-0.5 text-[11px] leading-4 font-medium whitespace-nowrap tabular-nums", tone)}>
      <Arrow size={12} aria-hidden="true" />
      <span className="sr-only">{words[direction]} </span>
      {label}
    </span>
  );
}

/** A summary tile for the top of an overview: a title, one big figure, a line under it and, at the bottom, a chart or a Meter. */
export function StatCard({
  icon: Icon,
  title,
  value,
  caption,
  trend,
  action,
  children,
  className,
}: {
  icon: LucideIcon;
  title: ReactNode;
  value: ReactNode;
  caption?: ReactNode;
  trend?: Trend;
  /** Shown where the trend would be; the trend wins if both are given. */
  action?: ReactNode;
  /** A chart or Meter, pushed to the bottom so tiles in a row line up. */
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex h-full min-w-0 flex-col rounded-panel border border-line-card bg-card p-4 lg:p-6", className)}>
      <header className="flex min-h-7 items-center justify-between gap-3">
        <h2 className="flex min-w-0 items-center gap-2 text-sm font-medium">
          <Icon size={16} aria-hidden="true" className="shrink-0 text-muted" />
          <span className="truncate">{title}</span>
        </h2>
        {trend ? <TrendChip {...trend} /> : action}
      </header>
      <div className="mt-3 font-serif text-[40px] leading-none tabular-nums">{value}</div>
      {caption && <p className="mt-2 text-meta text-muted">{caption}</p>}
      {children && <div className="mt-auto pt-4">{children}</div>}
    </section>
  );
}
