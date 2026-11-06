import { todayReport, type TodayItem, type TodayReport } from "@atlas/ui/today";

import { addDays, dayOf, daysBetween, monthOf } from "./dates";
import { converter, formatCents, rateBook } from "./money";
import type { Account, Category, Rate, Recurring, Settings, Transaction } from "./model";
import { withOccurrences } from "./recurring";
import { categorySpending, monthFlows } from "./summary";

// Tyche's answer to Atlas's Today (see @atlas/ui/today), from what your
// devices have synced, plus the bills the recurring items make (a phone
// makes them when it opens; the server can't wait for that): bills overdue,
// bills due in the next three days, pay that's late, and categories over
// their budget this month.

export const SOON_DAYS = 3;

export type TodayRecords = {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  recurring: Recurring[];
  rates: Rate[];
  settings: Settings;
};

export function tycheToday(records: TodayRecords, locale: string, now = Date.now()): TodayReport {
  const today = dayOf(now);
  const alive = <T extends { deleted: boolean }>(list: T[]) => list.filter((record) => !record.deleted);
  const accounts = alive(records.accounts);
  const currencyOf = new Map(accounts.map((account) => [account.id, account.currency]));
  const transactions = withOccurrences(alive(records.transactions), alive(records.recurring), today).filter(
    (transaction) => !transaction.deleted && transaction.transferId === null && currencyOf.has(transaction.accountId),
  );
  const money = (transaction: Transaction) => formatCents(Math.abs(transaction.amount), currencyOf.get(transaction.accountId)!, locale);
  const day = (date: string) => new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone: "UTC" }).format(Date.parse(date));
  const days = (count: number) => `${count} ${count === 1 ? "day" : "days"}`;
  const open = (transaction: Transaction) => `/transactions?t=${encodeURIComponent(transaction.id)}`;
  const expected = transactions.filter((transaction) => transaction.status === "expected");
  const byDate = (a: Transaction, b: Transaction) => a.date.localeCompare(b.date);

  const overdue = expected.filter((transaction) => transaction.amount < 0 && transaction.date < today).sort(byDate);
  const soon = expected.filter((transaction) => transaction.amount < 0 && transaction.date >= today && transaction.date <= addDays(today, SOON_DAYS)).sort(byDate);
  const late = expected.filter((transaction) => transaction.amount > 0 && transaction.date < today).sort(byDate);

  const convertOn = converter(rateBook(records.rates, records.settings.rateKind), records.settings.displayCurrency);
  const month = monthOf(today);
  const over = categorySpending(monthFlows(accounts, transactions, convertOn, month), alive(records.categories), rateBook(records.rates, records.settings.rateKind), convertOn.to, today).filter(
    (row) => row.category && row.budget !== null && row.spent > row.budget,
  );

  const items: TodayItem[] = [
    ...overdue.map((transaction) => ({
      title: transaction.payee || "A bill",
      detail: `${money(transaction)}, ${days(daysBetween(transaction.date, today))} overdue`,
      href: open(transaction),
      tone: "overdue" as const,
    })),
    ...soon.map((transaction) => {
      const until = daysBetween(today, transaction.date);
      return {
        title: transaction.payee || "A bill",
        detail: `${money(transaction)}, ${until === 0 ? "due today" : until === 1 ? "due tomorrow" : `due ${day(transaction.date)}`}`,
        href: open(transaction),
        tone: "soon" as const,
      };
    }),
    ...late.map((transaction) => ({
      title: transaction.payee || "Pay",
      detail: `${money(transaction)} expected ${day(transaction.date)}, not in yet`,
      href: open(transaction),
    })),
    ...over.map((row) => {
      // Whole units, unless rounding would make the two look the same ("$8 of $8").
      const whole = Math.round(row.spent / 100) !== Math.round(row.budget! / 100);
      return {
        title: `${row.category!.name} over budget`,
        detail: `${formatCents(row.spent, convertOn.to, locale, { whole })} of ${formatCents(row.budget!, convertOn.to, locale, { whole })}`,
        href: "/budgets",
      };
    }),
  ];

  const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
  const summary =
    overdue.length > 0
      ? `${plural(overdue.length, "bill", "bills")} overdue.`
      : soon.length > 0
        ? `${plural(soon.length, "bill", "bills")} due in the next ${SOON_DAYS} days.`
        : over.length > 0
          ? `${plural(over.length, "category", "categories")} over budget.`
          : `Nothing due in the next ${SOON_DAYS} days.`;
  return todayReport(summary, items);
}
