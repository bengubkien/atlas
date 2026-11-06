import { cn } from "../cn";

export type MeterTone = "chart" | "chart-2" | "success" | "warning" | "danger";

// The feedback tones are classes, not var(), so Tailwind emits their theme variables.
const fills: Record<MeterTone, string> = {
  chart: "bg-(--color-chart)",
  "chart-2": "bg-(--color-chart-2)",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-error",
};

/** A thin horizontal bar for progress: "61% of income spent", a goal. Past the max it shows full but still reports the real value. */
export function Meter({
  value,
  max = 1,
  label,
  tone = "chart",
  size = "md",
  className,
}: {
  value: number;
  max?: number;
  /** What it measures, for screen readers: "Spent this month". */
  label: string;
  tone?: MeterTone;
  size?: "sm" | "md";
  className?: string;
}) {
  const share = max > 0 && Number.isFinite(value) ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      className={cn("w-full overflow-hidden rounded-full bg-track", size === "sm" ? "h-1" : "h-1.5", className)}
    >
      <div
        className={cn("h-full rounded-full motion-safe:transition-[width] motion-safe:duration-300", fills[tone])}
        style={{ width: `${share * 100}%` }}
      />
    </div>
  );
}
