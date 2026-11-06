// Calendar dates as "YYYY-MM-DD" strings, worked out in UTC so a day is
// always 24 hours (no daylight saving surprises). Months are "YYYY-MM".

const DAY = 86_400_000;

const toMs = (date: string) => Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)));
const fromMs = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** The local calendar date of a moment, on this device (or server, by its TZ). */
export const dayOf = (ms: number) => new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(ms);

export const addDays = (date: string, days: number) => fromMs(toMs(date) + days * DAY);

/** Whole days from `from` to `to`: positive when `to` is later. */
export const daysBetween = (from: string, to: string) => Math.round((toMs(to) - toMs(from)) / DAY);

export const monthOf = (date: string) => date.slice(0, 7);

/** How many days a month has. */
export function daysInMonth(month: string): number {
  const year = Number(month.slice(0, 4));
  const index = Number(month.slice(5, 7));
  return new Date(Date.UTC(year, index, 0)).getUTCDate();
}

export const firstOfMonth = (month: string) => `${month}-01`;
export const lastOfMonth = (month: string) => `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;

/** The month `count` months after (or before, if negative) this one. */
export function addMonths(month: string, count: number): string {
  const total = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 + count;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/** A day of a month, or the month's last day when it's shorter (the 31st in February is the 28th or 29th). */
export function dayInMonth(month: string, day: number): string {
  return `${month}-${String(Math.min(day, daysInMonth(month))).padStart(2, "0")}`;
}

/** Every date from one to another, both included. */
export function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) out.push(date);
  return out;
}

export const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && fromMs(toMs(value)) === value;
