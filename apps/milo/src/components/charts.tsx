"use client";

import { useId, useState, type ReactNode } from "react";

import { cn } from "@atlas/ui/cn";

// Milo's charts, drawn in plain HTML and SVG like Dossier's. One measure per
// chart, in Milo's chart colour (--color-chart-milo, light and dark steps
// checked at 3:1 against the card). Thin marks with 4px rounded ends on a
// hairline baseline, a tooltip on hover and focus, only the latest value
// labelled on the chart, and every value in a table under it.

export type Point = { key: string; label: string; value: number };

/** A round step at or above a value: 1, 2, 2.5, 5 or 10 times a power of ten. */
function niceStep(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return [1, 2, 2.5, 5, 10].find((each) => each * magnitude >= value)! * magnitude;
}

/** A round top for an axis from zero: 0 – 1,000 – 2,000, never 0 – 1,137. */
export const niceMax = niceStep;

/** An axis that fits the data on round numbers, three or four steps tall: 70 – 110 for 76 to 105. */
export function niceRange(min: number, max: number): [bottom: number, top: number] {
  if (max <= min) return [Math.max(0, min - 1), max + 1];
  const step = niceStep((max - min) / 3);
  const bottom = Math.max(0, Math.floor(min / step) * step);
  return [bottom, Math.max(bottom + step, Math.ceil(max / step) * step)];
}

function Ticks({ max, format }: { max: number; format: (value: number) => string }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {[1, 0.5, 0].map((share) => (
        <div key={share} className="absolute inset-x-0 border-t border-line" style={{ top: `${(1 - share) * 100}%` }}>
          <span className="absolute -top-2 left-0 bg-card pr-1 text-[11px] leading-none text-muted tabular-nums">{format(max * share)}</span>
        </div>
      ))}
    </div>
  );
}

function Tooltip({ value, label, left }: { value: string; label: string; left: number }) {
  return (
    <div
      role="presentation"
      className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-control bg-inverse px-2.5 py-1.5 text-center whitespace-nowrap text-on-inverse shadow-toast"
      style={{ left: `${Math.min(88, Math.max(12, left))}%` }}
    >
      <div className="text-sm font-semibold tabular-nums">{value}</div>
      <div className="text-[11px] opacity-80">{label}</div>
    </div>
  );
}

function TableView({ caption, points, format, valueLabel }: { caption: string; points: Point[]; format: (value: number) => string; valueLabel: string }) {
  return (
    <details className="text-meta text-muted">
      <summary className="cursor-pointer select-none hover:text-ink">Show as a table</summary>
      <table className="mt-2 w-full text-left text-sm text-ink">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="text-xs text-muted">
            <th className="py-1 font-medium">When</th>
            <th className="py-1 text-right font-medium">{valueLabel}</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.key} className="border-t border-line">
              <td className="py-1">{point.label}</td>
              <td className="py-1 text-right tabular-nums">{format(point.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

/** Columns over time, e.g. workouts per week. */
export function ColumnChart({
  title,
  description,
  points,
  format,
  axisFormat = format,
  valueLabel,
}: {
  title: ReactNode;
  description?: ReactNode;
  points: Point[];
  format: (value: number) => string;
  axisFormat?: (value: number) => string;
  valueLabel: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = niceMax(Math.max(0, ...points.map((point) => point.value)));
  // At most about four dates under the columns, never one crowding the last.
  const every = Math.max(1, Math.ceil(points.length / 4));
  const last = points.length - 1;
  const dated = (i: number) => i === last || (i % every === 0 && last - i >= every);

  return (
    <figure className="flex flex-col gap-4 rounded-panel border border-line-card bg-card p-4 lg:p-6">
      <figcaption className="flex flex-col gap-0.5">
        <span className="font-serif text-[22px] leading-tight">{title}</span>
        {description && <span className="text-meta text-muted">{description}</span>}
      </figcaption>
      <div className="relative ml-9 h-40">
        <Ticks max={max} format={axisFormat} />
        <ol className="absolute inset-0 flex items-end gap-0.5" onPointerLeave={() => setHovered(null)}>
          {points.map((point, i) => {
            const height = (point.value / max) * 100;
            return (
              <li
                key={point.key}
                tabIndex={0}
                aria-label={`${point.label}: ${format(point.value)}`}
                onPointerEnter={() => setHovered(i)}
                onFocus={() => setHovered(i)}
                onBlur={() => setHovered(null)}
                className="group relative flex h-full flex-1 cursor-default items-end justify-center focus:outline-none"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "w-[64%] max-w-6 rounded-t-[4px] bg-[var(--color-chart-milo)] motion-safe:transition-[filter]",
                    hovered === i && "brightness-110",
                    hovered !== null && hovered !== i && "opacity-60",
                    "group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-[var(--color-focus)]",
                  )}
                  style={{ height: point.value > 0 ? `max(${height}%, 2px)` : 0 }}
                />
                {i === last && point.value > 0 && hovered === null && (
                  <span className="absolute left-1/2 -translate-x-1/2 -translate-y-1 text-[11px] font-medium whitespace-nowrap text-ink tabular-nums" style={{ bottom: `${height}%` }}>
                    {format(point.value)}
                  </span>
                )}
                {hovered === i && <Tooltip value={format(point.value)} label={point.label} left={50} />}
              </li>
            );
          })}
        </ol>
      </div>
      <div aria-hidden="true" className="ml-9 flex gap-0.5 text-[11px] text-muted">
        {points.map((point, i) => (
          <span key={point.key} className="flex flex-1 justify-center overflow-visible whitespace-nowrap">
            {dated(i) ? point.label : ""}
          </span>
        ))}
      </div>
      <TableView caption={typeof title === "string" ? title : valueLabel} points={points} format={format} valueLabel={valueLabel} />
    </figure>
  );
}

/** A line over sessions, e.g. an exercise's estimated one-rep max. */
export function LineChart({
  title,
  description,
  points,
  format,
  valueLabel,
}: {
  title: ReactNode;
  description?: ReactNode;
  points: Point[];
  format: (value: number) => string;
  valueLabel: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const gradient = useId();
  const values = points.map((point) => point.value);
  // The axis starts near the data, on a round number, so progress shows.
  const [bottom, top] = niceRange(Math.min(...values), Math.max(...values));
  const x = (i: number) => (points.length === 1 ? 50 : (i / (points.length - 1)) * 100);
  const y = (value: number) => 100 - ((value - bottom) / (top - bottom || 1)) * 100;
  const path = points.map((point, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(point.value)}`).join(" ");
  const last = points.length - 1;

  const nearest = (event: React.PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const share = (event.clientX - box.left) / box.width;
    setHovered(Math.round(Math.min(1, Math.max(0, share)) * last));
  };

  return (
    <figure className="flex flex-col gap-4 rounded-panel border border-line-card bg-card p-4 lg:p-6">
      <figcaption className="flex flex-col gap-0.5">
        <span className="font-serif text-[22px] leading-tight">{title}</span>
        {description && <span className="text-meta text-muted">{description}</span>}
      </figcaption>
      <div className="relative mr-12 ml-10 h-44">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          {[top, (top + bottom) / 2, bottom].map((value) => (
            <div key={value} className="absolute inset-x-0 border-t border-line" style={{ top: `${y(value)}%` }}>
              <span className="absolute -top-2 -left-10 w-9 text-right text-[11px] leading-none text-muted tabular-nums">{format(value)}</span>
            </div>
          ))}
        </div>
        <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
          <defs>
            <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="var(--color-chart-milo)" stopOpacity="0.14" />
              <stop offset="1" stopColor="var(--color-chart-milo)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {points.length > 1 && <path d={`${path} L100,100 L0,100 Z`} fill={`url(#${gradient})`} />}
          <path d={path} fill="none" stroke="var(--color-chart-milo)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
        {hovered !== null && <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-px bg-line-strong" style={{ left: `${x(hovered)}%` }} />}
        {points.map((point, i) =>
          i === last || i === hovered ? (
            <span
              key={point.key}
              aria-hidden="true"
              className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-[var(--color-chart-milo)]"
              style={{ left: `${x(i)}%`, top: `${y(point.value)}%` }}
            />
          ) : null,
        )}
        {hovered === null && points.length > 0 && (
          <span className="absolute translate-x-2 -translate-y-1/2 text-[11px] font-medium whitespace-nowrap text-ink tabular-nums" style={{ left: `${x(last)}%`, top: `${y(points[last]!.value)}%` }}>
            {format(points[last]!.value)}
          </span>
        )}
        <div
          role="img"
          tabIndex={0}
          aria-label={`${valueLabel}: from ${format(values[0] ?? 0)} to ${format(values[last] ?? 0)} over ${points.length} sessions. The table below has every value.`}
          className="absolute inset-0 cursor-crosshair focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-focus)]"
          onPointerMove={nearest}
          onPointerDown={nearest}
          onPointerLeave={() => setHovered(null)}
          onFocus={() => setHovered(last)}
          onBlur={() => setHovered(null)}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") setHovered((i) => Math.max(0, (i ?? last) - 1));
            if (event.key === "ArrowRight") setHovered((i) => Math.min(last, (i ?? last) + 1));
          }}
        />
        {hovered !== null && points[hovered] && (
          <div className="pointer-events-none absolute inset-x-0" style={{ top: `${y(points[hovered].value)}%` }}>
            <Tooltip value={format(points[hovered].value)} label={points[hovered].label} left={x(hovered)} />
          </div>
        )}
      </div>
      <div aria-hidden="true" className="mr-12 ml-10 flex justify-between text-[11px] text-muted">
        <span>{points[0]?.label}</span>
        {points.length > 1 && <span>{points[last]?.label}</span>}
      </div>
      <TableView caption={valueLabel} points={[...points].reverse()} format={format} valueLabel={valueLabel} />
    </figure>
  );
}

/** Horizontal bars, largest first, each with its value: e.g. sets per muscle. */
export function BarList({ title, description, rows, format }: { title: ReactNode; description?: ReactNode; rows: Point[]; format: (value: number) => string }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <figure className="flex flex-col gap-4 rounded-panel border border-line-card bg-card p-4 lg:p-6">
      <figcaption className="flex flex-col gap-0.5">
        <span className="font-serif text-[22px] leading-tight">{title}</span>
        {description && <span className="text-meta text-muted">{description}</span>}
      </figcaption>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">Nothing yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li key={row.key} className="grid grid-cols-[88px_minmax(0,1fr)] items-center gap-3 text-sm">
              <span className="truncate text-muted">{row.label}</span>
              <span className="flex min-w-0 items-center gap-2">
                <span aria-hidden="true" className="h-3 rounded-r-[4px] bg-[var(--color-chart-milo)]" style={{ width: `${(row.value / max) * 85}%` }} />
                <span className="shrink-0 font-medium tabular-nums">{format(row.value)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}
