// Dates, amounts and "in 3 days", the same way in every app. Pure functions:
// the locale and currency come from the caller (the server's ATLAS_LOCALE,
// and the app's currency).

/** "4 Nov 2026" for a calendar date (YYYY-MM-DD), never shifted by a time zone. */
export function formatDate(date: string, locale: string, { year = true, month = "short" as "short" | "long" } = {}): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month,
    ...(year ? { year: "numeric" } : {}),
    timeZone: "UTC",
  }).format(new Date(`${date.slice(0, 10)}T00:00:00Z`));
}

/** "today", "tomorrow", "in 3 days", "2 weeks ago": how far a date is, in words. */
export function formatRelativeDays(days: number, locale: string): string {
  const words = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const size = Math.abs(days);
  if (size < 14) return words.format(days, "day");
  if (size < 60) return words.format(Math.round(days / 7), "week");
  if (size < 730) return words.format(Math.round(days / 30.44), "month");
  return words.format(Math.round(days / 365.25), "year");
}

/** An amount in cents, e.g. "€45.00", or "€45" with `whole`; null for none. */
export function formatMoney(
  cents: number | null | undefined,
  currency: string,
  locale: string,
  { whole = false } = {},
): string | null {
  if (cents === null || cents === undefined) return null;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    ...(whole ? { maximumFractionDigits: 0, minimumFractionDigits: 0 } : {}),
  }).format(cents / 100);
}

/** Cents from what someone typed: "45", "45.5", "1,234.50" or "1.234,50"; null when empty. */
export function parseMoney(input: string): number | null | "invalid" {
  const text = input.replace(/[^\d.,-]/g, "");
  if (!text) return null;
  // The last "." or "," followed by one or two digits is the decimal point.
  const match = /^(.*?)(?:[.,](\d{1,2}))?$/.exec(text);
  const whole = (match?.[1] ?? "").replace(/[.,]/g, "");
  const fraction = (match?.[2] ?? "").padEnd(2, "0");
  if (!/^\d+$/.test(whole || "0")) return "invalid";
  return Number(whole || "0") * 100 + Number(fraction || "0");
}
