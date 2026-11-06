"use client";

import { ColumnChart } from "@atlas/ui/components/charts";
import { Meter, type MeterTone } from "@atlas/ui/components/meter";
import { Panel, PanelEmpty } from "@atlas/ui/components/panel";

import { CategoryIcon } from "@/lib/icons";
import { addMonths } from "@/lib/dates";
import { useLocale } from "@/lib/locale";
import { formatCents } from "@/lib/money";
import type { Money } from "@/lib/local/hooks";
import type { Account, Category, Transaction } from "@/lib/model";
import { categorySpending, monthFlows } from "@/lib/summary";

/** Each category's spending this month against its budget, and income and spending over the last six months. */
export function SummaryTab({
  accounts,
  categories,
  transactions,
  money,
  month,
  today,
}: {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  money: Money;
  month: string;
  today: string;
}) {
  const locale = useLocale();
  const currency = money.settings.displayCurrency;
  const whole = (cents: number) => formatCents(cents, currency, locale, { whole: true });
  // Whole units, unless that would round an overspend to nothing ("Over by $0").
  const overBy = (cents: number) => formatCents(cents, currency, locale, { whole: cents >= 100 });
  const compact = (cents: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency, notation: "compact", maximumFractionDigits: 1, currencyDisplay: currency === "USD" ? "narrowSymbol" : "code" }).format(cents / 100);

  const rows = categorySpending(monthFlows(accounts, transactions, money.convert, month), categories, money.rates, money.convert.to, today);

  const months = Array.from({ length: 6 }, (_, index) => addMonths(month, index - 5));
  const flows = months.map((each) => monthFlows(accounts, transactions, money.convert, each));
  const label = (each: string) => new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(Date.UTC(Number(each.slice(0, 4)), Number(each.slice(5, 7)) - 1, 1));
  const series = (pick: (flow: (typeof flows)[number]) => number) => months.map((each, index) => ({ key: each, label: label(each), value: pick(flows[index]!) }));

  return (
    <div className="flex flex-col gap-4">
      <Panel title="Spending by category">
        {rows.length === 0 ? (
          <PanelEmpty>No spending this month yet.</PanelEmpty>
        ) : (
          <ul className="flex flex-col divide-y divide-line border-t border-line">
            {rows.map((row) => {
              const over = row.budget !== null && row.spent > row.budget;
              const tone: MeterTone = over ? "danger" : row.budget && row.spent / row.budget > 0.9 ? "warning" : "chart-2";
              return (
                <li key={row.category?.id ?? "none"} className="flex flex-col gap-2 px-4 py-3 lg:px-6">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2 font-medium">
                      <CategoryIcon name={row.category?.icon} className="shrink-0 text-muted" />
                      <span className="truncate">{row.category?.name ?? "No category"}</span>
                    </span>
                    <span className="shrink-0 text-muted tabular-nums">
                      {row.budget === null ? `${whole(row.spent)}, no budget` : `${whole(row.spent)} of ${whole(row.budget)}`}
                      {over && <span className="font-medium text-error"> · Over by {overBy(row.spent - row.budget!)}</span>}
                    </span>
                  </div>
                  {row.budget !== null && <Meter value={row.spent} max={row.budget} tone={tone} size="sm" label={`${row.category?.name ?? "Category"} spent against its budget`} />}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
      <div className="grid gap-4 md:grid-cols-2">
        <ColumnChart title="Income" description="Last six months" points={series((flow) => flow.income)} format={whole} axisFormat={compact} valueLabel="Income" />
        <ColumnChart title="Spending" description="Last six months" points={series((flow) => flow.spending)} format={whole} axisFormat={compact} valueLabel="Spending" series="chart-2" />
      </div>
    </div>
  );
}
