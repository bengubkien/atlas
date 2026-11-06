"use client";

import { useState, type KeyboardEvent, type ReactNode } from "react";

import { cn } from "../cn";

// Two small charts for StatCards, drawn in plain HTML like the kit's charts:
// thin marks anchored at the baseline, a tooltip on hover and on keyboard
// focus, and every value in a table for screen readers. The picture is hidden
// from them; the table says the same in words. Marks take the app's chart
// colour, and the quiet ones the faint tokens, so colour is never the only
// thing telling them apart (the tooltip has the numbers).

export type SparkPoint = { label: string; value: number };

type SparkProps = {
  points: SparkPoint[];
  /** Turns a value into words: 1234 → "$1,234". */
  format: (value: number) => string;
  /** What the chart shows, for screen readers: "Balance each day this month". */
  label: string;
  className?: string;
};

/** The frame both charts share: columns that fill the width, a tooltip above the active one, and the table. */
function SparkFrame({
  points,
  format,
  label,
  className,
  column,
}: SparkProps & { column: (point: SparkPoint, index: number) => ReactNode }) {
  const [active, setActive] = useState<number | null>(null);
  const last = points.length - 1;

  function onKeyDown(event: KeyboardEvent) {
    const from = active ?? last;
    const to =
      event.key === "ArrowRight" || event.key === "ArrowDown" ? Math.min(last, from + 1)
      : event.key === "ArrowLeft" || event.key === "ArrowUp" ? Math.max(0, from - 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? last
      : null;
    if (to === null) return;
    event.preventDefault();
    setActive(to);
  }

  const point = active === null ? undefined : points[active];
  const text = point ? `${point.label} · ${format(point.value)}` : "";
  return (
    <div className={cn("relative h-11 w-full min-w-0", className)}>
      {/* One tab stop; the arrow keys move between the marks. */}
      <div
        role="group"
        aria-label={label}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onFocus={() => setActive((was) => was ?? last)}
        onBlur={() => setActive(null)}
        onPointerLeave={() => setActive(null)}
        className="flex h-full w-full rounded-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <div aria-hidden="true" className="flex h-full w-full">
          {points.map((each, index) => (
            <div
              key={index}
              onPointerEnter={() => setActive(index)}
              className={cn("flex h-full min-w-0 flex-1 items-end justify-center rounded-[3px]", active === index && "bg-hover")}
            >
              {column(each, index)}
            </div>
          ))}
        </div>
      </div>
      {point && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-control bg-inverse px-2 py-1 text-xs whitespace-nowrap text-on-inverse tabular-nums shadow-toast"
          style={{ left: `${Math.min(88, Math.max(12, ((active! + 0.5) / points.length) * 100))}%` }}
        >
          {text}
        </div>
      )}
      <span className="sr-only" aria-live="polite">
        {text}
      </span>
      <table className="sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">Label</th>
            <th scope="col">Value</th>
          </tr>
        </thead>
        <tbody>
          {points.map((each, index) => (
            <tr key={index}>
              <th scope="row">{each.label}</th>
              <td>{format(each.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** One column of dots per point, taller for bigger values (1 to 5 dots): a month of daily balances. `highlight` colours a range of columns (inclusive) and quiets the rest. */
export function DotColumns({ points, format, label, className, highlight }: SparkProps & { highlight?: [start: number, end: number] }) {
  const values = points.map((each) => each.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  return (
    <SparkFrame
      points={points}
      format={format}
      label={label}
      className={className}
      column={(point, index) => {
        // Flat data gets a middle height, not one dot.
        const count = max === min ? 3 : 1 + Math.round(((point.value - min) / (max - min)) * 4);
        const inside = !highlight || (index >= highlight[0] && index <= highlight[1]);
        return (
          <div className="flex flex-col-reverse items-center gap-0.5 pb-0.5">
            {Array.from({ length: count }, (_, dot) => (
              <span key={dot} className={cn("size-[3px] rounded-full", inside ? "bg-(--color-chart)" : "bg-faint")} />
            ))}
          </div>
        );
      }}
    />
  );
}

/** One thin bar per point, from zero to the biggest value: income by day. A zero is a short quiet tick, so the days still read as a row. */
export function MiniBars({ points, format, label, className }: SparkProps) {
  const max = Math.max(0, ...points.map((each) => each.value));
  return (
    <SparkFrame
      points={points}
      format={format}
      label={label}
      className={className}
      column={(point) =>
        point.value > 0 && max > 0 ? (
          // Leave room above for the rounded end to read as a bar, never a sliver.
          <span
            className="w-[3px] max-w-full rounded-t-[4px] bg-(--color-chart)"
            style={{ height: `max(3px, ${(point.value / max) * 100}%)` }}
          />
        ) : (
          <span className="h-0.5 w-[3px] max-w-full bg-line-strong" />
        )
      }
    />
  );
}
