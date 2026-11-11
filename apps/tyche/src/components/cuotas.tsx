"use client";

import Link from "next/link";

import { Meter } from "@atlas/ui/components/meter";

import { Amount } from "@/components/money";
import type { Account, Recurring } from "@/lib/model";
import { cuotasLeft } from "@/lib/recurring";
import { useLocale } from "@/lib/locale";
import { formatCents } from "@/lib/money";

/** "Feb 2027" for a calendar date. */
export function monthYear(date: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${date.slice(0, 10)}T00:00:00Z`));
}

/** Purchases in cuotas that still have charges to come. */
export const cuotasOf = (items: Recurring[], today: string) => items.filter((item) => item.installments && cuotasLeft(item, today).count > 0);

/** What's still to come over a card's cuotas: the amount, and the most months any one has left. */
export function committed(items: Recurring[], accountId: string, today: string) {
  let amount = 0;
  let months = 0;
  for (const item of cuotasOf(items, today)) {
    if (item.accountId !== accountId) continue;
    const left = cuotasLeft(item, today);
    amount += left.amount;
    months = Math.max(months, left.count);
  }
  return { amount, months };
}

/** How many cuotas are due on or before a day: the ones not still to come. */
export const cuotaDone = (item: Recurring, today: string): number => Math.max(0, (item.installments ?? 0) - cuotasLeft(item, today).count);

/** One purchase in cuotas: where it stands and what's left. */
export function CuotaItem({ item, account, today, href, quiet = false, date }: { item: Recurring; account: Account | undefined; today: string; href: string; quiet?: boolean; date: (date: string) => string }) {
  const locale = useLocale();
  const total = item.installments ?? 0;
  const done = cuotaDone(item, today);
  const left = cuotasLeft(item, today);
  const where = done > 0 ? `Cuota ${done} of ${total}` : `Starts ${date(item.start)}`;
  return (
    <li>
      <Link href={href} scroll={false} className="flex min-h-16 flex-col gap-2 px-4 py-3 hover:bg-hover lg:px-6">
        <span className="flex items-start gap-3">
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className={quiet ? "truncate text-sm font-medium text-muted" : "truncate text-sm font-medium"}>{item.name}</span>
            <span className="text-meta text-pretty text-muted">{[account?.name, where].filter(Boolean).join(" · ")}</span>
          </span>
          {account && (
            <span className="flex shrink-0 flex-col items-end">
              <Amount cents={item.amount} currency={account.currency} className="text-sm font-medium" />
              <span className="text-meta text-muted">a month</span>
            </span>
          )}
        </span>
        <Meter value={done} max={total} size="sm" label={`${done} of ${total} cuotas paid`} />
        <span className="text-meta text-muted tabular-nums">
          {left.count > 0 && left.last && account
            ? `${formatCents(left.amount, account.currency, locale)} still to come, until ${monthYear(left.last, locale)}`
            : "All cuotas paid."}
        </span>
      </Link>
    </li>
  );
}
