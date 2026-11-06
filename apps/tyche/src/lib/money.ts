import type { Currency, Rate, RateKind } from "./model";

// Money in cents, and pesos and dollars. Every amount is converted at the
// rate of its own day: a dollar bought in March cost what it cost in March.
// A rate typed in for a day wins over the one fetched for it. With no rate
// for a day, the latest earlier one is used (and the screen can say so);
// before the first rate there's nothing to convert with but the first one.

export type DayRate = {
  /** Pesos per dollar, in cents of a peso. */
  pesos: number;
  /** The day the rate is from, which may be earlier than the day asked about. */
  date: string;
  source: Rate["source"];
};

/** Rates of one kind, ready to look up by day. */
export type RateBook = {
  kind: RateKind;
  /** One per day, oldest first: the typed one when there's both. */
  days: DayRate[];
};

export function rateBook(rates: Rate[], kind: RateKind): RateBook {
  const byDay = new Map<string, DayRate>();
  for (const rate of rates) {
    if (rate.deleted || rate.kind !== kind) continue;
    const seen = byDay.get(rate.date);
    if (!seen || (rate.source === "typed" && seen.source === "fetched")) byDay.set(rate.date, { pesos: rate.pesos, date: rate.date, source: rate.source });
  }
  return { kind, days: [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date)) };
}

/** The rate for a day: that day's, else the latest before it, else the earliest there is; null with none at all. */
export function rateOn(book: RateBook, date: string): DayRate | null {
  const { days } = book;
  if (days.length === 0) return null;
  // Binary search for the last day on or before `date`.
  let low = 0;
  let high = days.length - 1;
  let found = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (days[middle]!.date <= date) {
      found = middle;
      low = middle + 1;
    } else high = middle - 1;
  }
  return days[found === -1 ? 0 : found]!;
}

/** Rounds half away from zero, so -0.5 cents and 0.5 cents round alike. */
const round = (value: number) => Math.sign(value) * Math.round(Math.abs(value));

/**
 * An amount in another currency, at a rate (pesos per dollar, in cents of a
 * peso). Null when it needs a rate and there isn't one.
 */
export function convert(cents: number, from: Currency, to: Currency, rate: DayRate | null): number | null {
  if (from === to) return cents;
  if (!rate) return null;
  return from === "USD" ? round((cents * rate.pesos) / 100) : round((cents * 100) / rate.pesos);
}

/** Converts amounts on their own days into one currency. */
export type Converter = {
  to: Currency;
  /** The amount in `to`, at the rate of `date`; null when there's no rate yet. */
  (cents: number, from: Currency, date: string): number | null;
};

export function converter(book: RateBook, to: Currency): Converter {
  const convertOn = (cents: number, from: Currency, date: string) => convert(cents, from, to, from === to ? null : rateOn(book, date));
  return Object.assign(convertOn, { to });
}

/** Sums what could be converted; `missing` counts amounts that had no rate. */
export function sum(amounts: (number | null)[]): { total: number; missing: number } {
  let total = 0;
  let missing = 0;
  for (const amount of amounts) {
    if (amount === null) missing++;
    else total += amount;
  }
  return { total, missing };
}

/** A change from one amount to another, as a fraction (0.031 is +3.1%); null from nothing. */
export function change(before: number, after: number): number | null {
  if (before === 0) return null;
  return (after - before) / Math.abs(before);
}

/** "$1,250.00", "-$94.30", or with `sign`, "+$6,450.00". ARS shows as "ARS 1.250,00" or "$" depending on the locale. */
export function formatCents(cents: number, currency: Currency, locale: string, { sign = false, whole = false } = {}): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    currencyDisplay: currency === "USD" ? "narrowSymbol" : "code",
    signDisplay: sign ? "exceptZero" : "auto",
    ...(whole ? { maximumFractionDigits: 0, minimumFractionDigits: 0 } : {}),
  }).format(cents / 100);
}

/** "61%", "+3.1%". */
export function formatShare(fraction: number, locale: string, { sign = false, digits = 0 } = {}): string {
  return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: digits, minimumFractionDigits: 0, signDisplay: sign ? "exceptZero" : "auto" }).format(fraction);
}
