"use client";

import { Check } from "lucide-react";

import { cn } from "@atlas/ui/cn";

import type { DaySummary } from "@/lib/activity";
import { useLocale } from "@/lib/locale";

// Today's goal as a ring, and the last days as a row of dots. Colour is
// never the only sign: met days hold a tick, partly done ones a dot, and each
// has its words for screen readers.

/** "Mon" for a calendar date, whatever the device's zone (dates are plain days). */
export function weekday(date: string, locale: string, style: "short" | "narrow" = "short"): string {
  const ms = Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)));
  return new Intl.DateTimeFormat(locale, { weekday: style, timeZone: "UTC" }).format(ms);
}

export function GoalRing({ seconds, goalMinutes }: { seconds: number; goalMinutes: number }) {
  const size = 120;
  const stroke = 11;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const share = Math.min(1, seconds / (goalMinutes * 60));
  const minutes = Math.floor(seconds / 60);
  return (
    <div
      role="meter"
      aria-label="Today's goal"
      aria-valuenow={minutes}
      aria-valuemin={0}
      aria-valuemax={goalMinutes}
      aria-valuetext={`${minutes} of ${goalMinutes} minutes`}
      className="relative shrink-0"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} style={{ stroke: "var(--color-track)" }} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - share)}
          className="motion-safe:transition-[stroke-dashoffset] motion-safe:duration-500"
          style={{ stroke: "var(--color-chart)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-serif text-[34px] leading-none tabular-nums">{minutes}</span>
        <span className="mt-1 text-meta text-muted">of {goalMinutes} min</span>
      </div>
    </div>
  );
}

const STANDING_WORDS = { met: "goal met", partly: "some time, short of the goal", none: "nothing" } as const;

export function DaysRow({ days, today }: { days: DaySummary[]; today: string }) {
  const locale = useLocale();
  return (
    <ol aria-label="The last 7 days" className="flex justify-between gap-1">
      {days.map((day) => (
        <li key={day.date} aria-label={`${weekday(day.date, locale, "short")}${day.date === today ? " (today)" : ""}: ${STANDING_WORDS[day.standing]}`} className="flex flex-col items-center gap-1.5">
          <span
            aria-hidden="true"
            className={cn(
              "grid size-8 place-items-center rounded-full border-2",
              day.standing === "met" && "border-(--color-chart) bg-(--color-chart) text-card",
              day.standing === "partly" && "border-(--color-chart)",
              day.standing === "none" && "border-line-strong",
            )}
          >
            {day.standing === "met" && <Check size={16} strokeWidth={3} />}
            {day.standing === "partly" && <span className="size-2 rounded-full bg-(--color-chart)" />}
          </span>
          <span aria-hidden="true" className={cn("text-meta", day.date === today ? "font-semibold text-ink" : "text-muted")}>
            {weekday(day.date, locale, "narrow")}
          </span>
        </li>
      ))}
    </ol>
  );
}
