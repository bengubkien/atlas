import "server-only";

import { formatDate, formatMoney, formatRelativeDays } from "@atlas/ui/format";

import { daysBetween, today, type CalendarDate } from "./dates";
import { getCurrency } from "./micasa/api";

/** The suite's locale for dates and amounts (ATLAS_LOCALE, e.g. es-AR), default en-US. */
export const locale = () => process.env.ATLAS_LOCALE || "en-US";

// micasa saves its currency once, on the first run: read it once per process.
let currency: Promise<string> | null = null;

/** Formatters bound to your locale and to micasa's currency. */
export async function formatters() {
  currency ??= getCurrency().catch((error) => {
    currency = null;
    throw error;
  });
  const code = await currency;
  const l = locale();
  const now = today();
  return {
    currency: code,
    locale: l,
    today: now,
    date: (date: CalendarDate) => formatDate(date, l, { year: date.slice(0, 4) !== now.slice(0, 4) }),
    longDate: (date: CalendarDate) => formatDate(date, l, { month: "long" }),
    money: (cents: number | null | undefined, options?: { whole?: boolean }) => formatMoney(cents, code, l, options),
    /** "in 3 days", "2 weeks ago", from today. */
    fromToday: (date: CalendarDate) => formatRelativeDays(daysBetween(now, date), l),
  };
}

export type Formatters = Awaited<ReturnType<typeof formatters>>;
