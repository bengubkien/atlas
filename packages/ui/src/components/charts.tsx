"use client";

import { useId, useState, type ReactNode } from "react";

import { cn } from "../cn";

// The suite's charts, drawn in plain HTML and SVG like Dossier's. Marks take
// the app's chart colours (--color-chart, and --color-chart-2 for a second
// series), which the shell sets from each app's tokens; both steps are
// checked at 3:1 against the card in light and dark. Thin marks with 4px
// rounded ends on a hairline baseline, a tooltip on hover and focus, only the
// latest value labelled on the chart, and every value in a table under it.

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

const SERIES_COLORS = ["var(--color-chart)", "var(--color-chart-2)"];

function Frame({ title, description, legend, children }: { title: ReactNode; description?: ReactNode; legend?: ReactNode; children: ReactNode }) {
  return (
    <figure className="flex min-w-0 flex-col gap-4 rounded-panel border border-line-card bg-card p-4 lg:p-6">
      <figcaption className="flex flex-col gap-0.5">
        <span className="font-serif text-[22px] leading-tight">{title}</span>
        {description && <span className="text-meta text-muted">{description}</span>}
        {legend}
      </figcaption>
      {children}
    </figure>
  );
}

function Tooltip({ rows, label, left }: { rows: { name?: string; value: string; color?: string }[]; label: string; left: number }) {
  return (
    <div
      role="presentation"
      className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-control bg-inverse px-2.5 py-1.5 whitespace-nowrap text-on-inverse shadow-toast"
      style={{ left: `${Math.min(88, Math.max(12, left))}%` }}
    >
      {rows.map((row) => (
        <div key={row.name ?? "value"} className="flex items-center gap-1.5">
          {row.color && <span aria-hidden="true" className="h-0.5 w-3 rounded-full" style={{ backgroundColor: row.color }} />}
          <span className="text-sm font-semibold tabular-nums">{row.value}</span>
          {row.name && <span className="text-[11px] opacity-80">{row.name}</span>}
        </div>
      ))}
      <div className="text-[11px] opacity-80">{label}</div>
    </div>
  );
}

function TableView({ caption, labels, columns }: { caption: string; labels: string[]; columns: { name: string; values: string[] }[] }) {
  return (
    <details className="text-meta text-muted">
      <summary className="cursor-pointer select-none hover:text-ink">Show as a table</summary>
      <table className="mt-2 w-full text-left text-sm text-ink">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="text-xs text-muted">
            <th className="py-1 font-medium">When</th>
            {columns.map((column) => (
              <th key={column.name} className="py-1 text-right font-medium">
                {column.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {labels.map((label, i) => (
            <tr key={`${label}-${i}`} className="border-t border-line">
              <td className="py-1">{label}</td>
              {columns.map((column) => (
                <td key={column.name} className="py-1 text-right tabular-nums">
                  {column.values[i]}
                </td>
              ))}
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
  const last = points.length - 1;
  // At most about four dates under the columns, never one crowding the last.
  const every = Math.max(1, Math.ceil(points.length / 4));
  const dated = (i: number) => i === last || (i % every === 0 && last - i >= every);

  return (
    <Frame title={title} description={description}>
      <div className="relative ml-9 h-40">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          {[1, 0.5, 0].map((share) => (
            <div key={share} className="absolute inset-x-0 border-t border-line" style={{ top: `${(1 - share) * 100}%` }}>
              <span className="absolute -top-2 -left-9 w-8 text-right text-[11px] leading-none text-muted tabular-nums">{axisFormat(max * share)}</span>
            </div>
          ))}
        </div>
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
                    "w-[64%] max-w-6 rounded-t-[4px] bg-[var(--color-chart)] motion-safe:transition-[filter,opacity]",
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
                {hovered === i && <Tooltip rows={[{ value: format(point.value) }]} label={point.label} left={50} />}
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
      <TableView
        caption={valueLabel}
        labels={points.map((point) => point.label)}
        columns={[{ name: valueLabel, values: points.map((point) => format(point.value)) }]}
      />
    </Frame>
  );
}

export type Series = { name: string; values: (number | null)[] };

/**
 * One or two lines over time, e.g. an estimated one-rep max, or blood
 * pressure's two numbers. With two, a legend names them (and labels at the
 * lines' ends); a shaded band can mark a healthy or reference range.
 */
export function LineChart({
  title,
  description,
  labels,
  series,
  format,
  valueLabel,
  band,
}: {
  title: ReactNode;
  description?: ReactNode;
  /** One per point in time, oldest first. */
  labels: { key: string; label: string }[];
  /** One or two; a missing value leaves a gap. */
  series: Series[];
  format: (value: number) => string;
  /** What the values are, for the table and screen readers, e.g. "Weight (kg)". */
  valueLabel: string;
  /** A range to shade; either end may be open. */
  band?: { low: number | null; high: number | null; label?: string };
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const gradient = useId();
  const all = series.flatMap((each) => each.values.filter((value): value is number => value !== null));
  const bounds = [...all, ...(band?.low != null ? [band.low] : []), ...(band?.high != null ? [band.high] : [])];
  const [bottom, top] = niceRange(Math.min(...bounds), Math.max(...bounds));
  const count = labels.length;
  const last = count - 1;
  const x = (i: number) => (count === 1 ? 50 : (i / last) * 100);
  const y = (value: number) => 100 - ((value - bottom) / (top - bottom || 1)) * 100;
  const pathOf = (values: (number | null)[]) => {
    let path = "";
    let open = false;
    values.forEach((value, i) => {
      if (value === null) {
        open = false;
        return;
      }
      path += `${open ? "L" : "M"}${x(i)},${y(value)} `;
      open = true;
    });
    return path.trim();
  };
  const lastIndex = (values: (number | null)[]) => values.reduce<number>((found, value, i) => (value !== null ? i : found), -1);
  const several = series.length > 1;

  const nearest = (event: React.PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const share = (event.clientX - box.left) / box.width;
    setHovered(Math.round(Math.min(1, Math.max(0, share)) * last));
  };

  const legend = several ? (
    <span className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-meta text-muted">
      {series.map((each, i) => (
        <span key={each.name} className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-0.5 w-4 rounded-full" style={{ backgroundColor: SERIES_COLORS[i] }} />
          {each.name}
        </span>
      ))}
    </span>
  ) : undefined;

  if (all.length === 0) {
    return (
      <Frame title={title} description={description}>
        <p className="text-sm text-muted">Nothing yet.</p>
      </Frame>
    );
  }

  return (
    <Frame title={title} description={description} legend={legend}>
      <div className="relative mr-12 ml-10 h-44">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          {band && (
            <div
              className="absolute inset-x-0 bg-track"
              style={{ top: `${band.high != null ? y(band.high) : 0}%`, bottom: `${band.low != null ? 100 - y(band.low) : 0}%` }}
            >
              {band.label && <span className="absolute top-1 right-1 text-[10px] text-muted">{band.label}</span>}
            </div>
          )}
          {[top, (top + bottom) / 2, bottom].map((value) => (
            <div key={value} className="absolute inset-x-0 border-t border-line" style={{ top: `${y(value)}%` }}>
              <span className="absolute -top-2 -left-10 w-9 text-right text-[11px] leading-none text-muted tabular-nums">{format(value)}</span>
            </div>
          ))}
        </div>
        <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
          <defs>
            <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="var(--color-chart)" stopOpacity="0.14" />
              <stop offset="1" stopColor="var(--color-chart)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {!several && !band && count > 1 && series[0]!.values.every((value) => value !== null) && (
            <path d={`${pathOf(series[0]!.values)} L100,100 L0,100 Z`} fill={`url(#${gradient})`} />
          )}
          {series.map((each, i) => (
            <path
              key={each.name}
              d={pathOf(each.values)}
              fill="none"
              stroke={SERIES_COLORS[i]}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
        {hovered !== null && <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-px bg-line-strong" style={{ left: `${x(hovered)}%` }} />}
        {series.map((each, s) =>
          each.values.map((value, i) =>
            value !== null && (i === lastIndex(each.values) || i === hovered) ? (
              <span
                key={`${each.name}-${i}`}
                aria-hidden="true"
                className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card"
                style={{ left: `${x(i)}%`, top: `${y(value)}%`, backgroundColor: SERIES_COLORS[s] }}
              />
            ) : null,
          ),
        )}
        {hovered === null &&
          series.map((each) => {
            const at = lastIndex(each.values);
            const value = each.values[at];
            if (value == null) return null;
            return (
              <span
                key={each.name}
                className="absolute translate-x-2 -translate-y-1/2 text-[11px] font-medium whitespace-nowrap text-ink tabular-nums"
                style={{ left: `${x(at)}%`, top: `${y(value)}%` }}
              >
                {format(value)}
              </span>
            );
          })}
        <div
          role="img"
          tabIndex={0}
          aria-label={`${valueLabel}, ${count} readings from ${labels[0]?.label} to ${labels[last]?.label}. The table below has every value.`}
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
        {hovered !== null && (
          <div className="pointer-events-none absolute inset-x-0" style={{ top: `${y(Math.max(...series.map((each) => each.values[hovered] ?? bottom)))}%` }}>
            <Tooltip
              rows={series
                .map((each, i) => ({ name: several ? each.name : undefined, value: each.values[hovered], color: several ? SERIES_COLORS[i] : undefined }))
                .filter((row): row is { name: string | undefined; value: number; color: string | undefined } => row.value != null)
                .map((row) => ({ ...row, value: format(row.value) }))}
              label={labels[hovered]?.label ?? ""}
              left={x(hovered)}
            />
          </div>
        )}
      </div>
      <div aria-hidden="true" className="mr-12 ml-10 flex justify-between text-[11px] text-muted">
        <span>{labels[0]?.label}</span>
        {count > 1 && <span>{labels[last]?.label}</span>}
      </div>
      <TableView
        caption={valueLabel}
        labels={[...labels].reverse().map((each) => each.label)}
        columns={series.map((each) => ({ name: several ? each.name : valueLabel, values: [...each.values].reverse().map((value) => (value === null ? "–" : format(value))) }))}
      />
    </Frame>
  );
}

/** Horizontal bars, largest first, each with its value: e.g. sets per muscle. */
export function BarList({ title, description, rows, format }: { title: ReactNode; description?: ReactNode; rows: Point[]; format: (value: number) => string }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <Frame title={title} description={description}>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">Nothing yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li key={row.key} className="grid grid-cols-[88px_minmax(0,1fr)] items-center gap-3 text-sm">
              <span className="truncate text-muted">{row.label}</span>
              <span className="flex min-w-0 items-center gap-2">
                <span aria-hidden="true" className="h-3 rounded-r-[4px] bg-[var(--color-chart)]" style={{ width: `${(row.value / max) * 85}%` }} />
                <span className="shrink-0 font-medium tabular-nums">{format(row.value)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Frame>
  );
}
