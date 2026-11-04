// micasa's dates are calendar dates (a service on 2 November), stored as
// timestamps. Hestia reads the first ten characters, YYYY-MM-DD, and does its
// arithmetic on those, so no time zone ever moves a date to the day before.

export type CalendarDate = string; // YYYY-MM-DD

/** The calendar date in a micasa timestamp, or null. */
export function calendarDate(value: string | null | undefined): CalendarDate | null {
  if (!value) return null;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  return match ? match[1]! : null;
}

/** Today where you are (the server's TZ). */
export function today(now = new Date()): CalendarDate {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

const toUtc = (date: CalendarDate) => {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
};
const fromUtc = (ms: number): CalendarDate => new Date(ms).toISOString().slice(0, 10);

/**
 * Adds months as micasa does (data.AddMonths): the day is kept, or clamped to
 * the target month's last day, so 31 January + 1 month is 28 or 29 February.
 */
export function addMonths(date: CalendarDate, months: number): CalendarDate {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return fromUtc(target.getTime());
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: CalendarDate, to: CalendarDate): number {
  return Math.round((toUtc(to) - toUtc(from)) / 86_400_000);
}

/**
 * When a maintenance item is next due, as micasa works it out
 * (data.ComputeNextDue): its fixed due date if it has one, else the last
 * service plus its interval; null with neither.
 */
export function nextDue(item: { due_date: string | null; last_serviced_at: string | null; interval_months: number }): CalendarDate | null {
  const due = calendarDate(item.due_date);
  if (due) return due;
  const last = calendarDate(item.last_serviced_at);
  if (!last || item.interval_months <= 0) return null;
  return addMonths(last, item.interval_months);
}
