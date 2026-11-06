"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { addMonths } from "@/lib/dates";
import { useToday } from "@/lib/local/hooks";
import { useLocale } from "@/lib/locale";

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/** A query parameter on the current page, and a way to change it without a new history entry. */
export function useQueryParam(name: string): [string | null, (value: string | null) => void] {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const value = params.get(name);
  const set = (next: string | null) => {
    const copy = new URLSearchParams(params);
    if (next === null) copy.delete(name);
    else copy.set(name, next);
    const query = copy.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };
  return [value, set];
}

/** The month on screen (`?m=YYYY-MM`, this month by default) and how to change it. */
export function useMonth(): [month: string, setMonth: (month: string) => void] {
  const today = useToday();
  const [raw, set] = useQueryParam("m");
  const current = today.slice(0, 7);
  const month = raw && MONTH.test(raw) ? raw : current;
  return [month, (next) => set(next === current ? null : next)];
}

/** "November 2026". */
export function useMonthName() {
  const locale = useLocale();
  return (month: string) => new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1));
}

/** "‹ November 2026 ›": steps through the months. */
export function MonthControl() {
  const [month, setMonth] = useMonth();
  const name = useMonthName();
  const step = "grid size-10 place-items-center rounded-control text-muted hover:bg-hover hover:text-ink";
  return (
    <div className="inline-flex items-center rounded-control border border-line-control bg-input shadow-control">
      <button type="button" aria-label="Previous month" className={step} onClick={() => setMonth(addMonths(month, -1))}>
        <ChevronLeft size={16} aria-hidden="true" />
      </button>
      <span className="min-w-[8.5rem] px-1 text-center text-sm font-medium tabular-nums" aria-live="polite">
        {name(month)}
      </span>
      <button type="button" aria-label="Next month" className={step} onClick={() => setMonth(addMonths(month, 1))}>
        <ChevronRight size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
