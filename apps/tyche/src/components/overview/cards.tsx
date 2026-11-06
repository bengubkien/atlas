"use client";

import { ArrowUpRight, CalendarDays, CreditCard, Wallet } from "lucide-react";
import Link from "next/link";

import { cn } from "@atlas/ui/cn";
import { Meter } from "@atlas/ui/components/meter";
import { DotColumns, MiniBars } from "@atlas/ui/components/sparks";
import { StatCard, type Trend } from "@atlas/ui/components/stat-card";

import { useDateFormat } from "@/components/money";
import { useLocale } from "@/lib/locale";
import { formatCents, formatShare } from "@/lib/money";
import type { Currency } from "@/lib/model";
import type { Overview } from "@/lib/summary";

const link = "relative grid size-8 place-items-center rounded-full border border-line-field text-muted after:absolute after:-inset-1 hover:text-ink";

function trendOf(change: number | null, locale: string): Trend | undefined {
  if (change === null) return undefined;
  // Under a tenth of a percent reads as no change.
  const flat = Math.abs(change) < 0.0005;
  return { label: formatShare(change, locale, { sign: true, digits: 1 }), direction: flat ? "flat" : change > 0 ? "up" : "down", good: change > 0 };
}

/** The three cards at the top: balance, this month's income and spending, in the display currency. */
export function SummaryCards({ overview, currency, month }: { overview: Overview; currency: Currency; month: string }) {
  const locale = useLocale();
  const date = useDateFormat();
  const money = (cents: number) => formatCents(cents, currency, locale, { whole: true });
  const days = overview.balance.recent;
  // This month's days are the last of them; they're the ones in colour.
  const thisMonth = overview.balance.byDay.length;
  const incomeChange = overview.income.change;
  const share = overview.spending.shareOfIncome;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <StatCard icon={Wallet} title="Balance" value={money(overview.balance.total)} caption="Total balance" trend={trendOf(overview.balance.change, locale)}>
        {days.length > 0 && (
          <DotColumns
            label="Balance at the end of each day, the last 30 days; this month's in colour"
            points={days.map((day) => ({ label: date(day.date, { year: false }), value: day.total }))}
            format={money}
            highlight={[Math.max(0, days.length - thisMonth), days.length - 1]}
          />
        )}
      </StatCard>

      <StatCard
        icon={CalendarDays}
        title="Monthly income"
        value={money(overview.income.total)}
        caption={
          incomeChange === null ? (
            "No income last month"
          ) : (
            <>
              <span className={cn(incomeChange > 0 && "text-success", incomeChange < 0 && "text-error")}>{formatShare(incomeChange, locale, { sign: true, digits: 1 })}</span> vs last month
            </>
          )
        }
        action={
          <Link href="/transactions/income" aria-label="Income" className={link}>
            <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
        }
      >
        <MiniBars
          label="Income each day this month"
          points={overview.income.byDay.map((value, index) => ({ label: date(`${month}-${String(index + 1).padStart(2, "0")}`, { year: false }), value }))}
          format={money}
        />
      </StatCard>

      <StatCard
        icon={CreditCard}
        title="Spending"
        value={money(overview.spending.total)}
        caption={share === null ? "No income this month" : `${formatShare(share, locale)} of income spent`}
        action={
          <Link href="/transactions/expenses" aria-label="Expenses" className={link}>
            <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
        }
      >
        <Meter value={share ?? 0} max={1} tone="chart-2" label="Share of income spent" />
      </StatCard>
    </div>
  );
}
