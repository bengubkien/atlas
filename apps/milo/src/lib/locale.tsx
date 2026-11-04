"use client";

import { createContext, use, type ReactNode } from "react";

import { formatDate } from "@atlas/ui/format";

// The suite's locale (ATLAS_LOCALE), for dates and numbers on this device.
// Times are shown in the device's own time zone.

const LocaleContext = createContext("en-US");

export function LocaleProvider({ locale, children }: { locale: string; children: ReactNode }) {
  return <LocaleContext value={locale}>{children}</LocaleContext>;
}

export function useLocale() {
  return use(LocaleContext);
}

/** The local calendar date of a time, YYYY-MM-DD. */
export const localDate = (ms: number) => new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(ms);

/** Formatting for screens: "Tue, Nov 4", "18:05". */
export function useFormat() {
  const locale = useLocale();
  return {
    locale,
    /** "Tue, Nov 4", with the year when it isn't this one. */
    day: (ms: number) =>
      new Intl.DateTimeFormat(locale, {
        weekday: "short",
        day: "numeric",
        month: "short",
        ...(new Date(ms).getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}),
      }).format(ms),
    date: (ms: number) => formatDate(localDate(ms), locale),
    time: (ms: number) => new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(ms),
    number: (value: number, digits = 0) => new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(value),
  };
}
