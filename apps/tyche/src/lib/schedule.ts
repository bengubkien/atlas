import { formatDate } from "@atlas/ui/format";

import type { Recurring } from "./model";

// How often a recurring item comes back, in words: "Monthly on the 10th".

const WEEKDAYS = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];

/** 1st, 2nd, 3rd, 4th… 11th, 12th, 13th, 21st. */
export function ordinal(day: number): string {
  const last = day % 100;
  if (last >= 11 && last <= 13) return `${day}th`;
  return `${day}${({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[day % 10] ?? "th"}`;
}

/** The weekday of a calendar date (0 is Sunday), worked out in UTC like lib/dates. */
const weekdayOf = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();

export function describeSchedule(item: Pick<Recurring, "frequency" | "start">, locale: string): string {
  const day = Number(item.start.slice(8, 10));
  switch (item.frequency) {
    case "weekly":
      return `Weekly on ${WEEKDAYS[weekdayOf(item.start)]}`;
    case "biweekly":
      return `Every two weeks from ${formatDate(item.start, locale, { year: false })}`;
    case "monthly":
      return `Monthly on the ${ordinal(day)}`;
    case "yearly":
      return `Yearly on ${formatDate(item.start, locale, { year: false })}`;
  }
}
