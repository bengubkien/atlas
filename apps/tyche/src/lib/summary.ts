import { addDays, addMonths, datesBetween, firstOfMonth, lastOfMonth, monthOf } from "./dates";
import { change, convert, rateOn, sum, type Converter, type RateBook } from "./money";
import type { Account, Category, Goal, Transaction, Valuation } from "./model";

// The numbers on the overview, worked out from this device's copy. Totals
// are in the display currency, each amount converted at its own day's rate;
// `missing` counts amounts that couldn't be (no rate yet), so a screen can
// say a total leaves some out instead of quietly being wrong.
//
// What counts: a transaction that happened (cleared or pending), not one
// only expected. Income and spending leave out transfers between your own
// accounts (buying dollars isn't spending).

export const happened = (transaction: Transaction) => !transaction.deleted && transaction.status !== "expected";
export const isFlow = (transaction: Transaction) => happened(transaction) && transaction.transferId === null;

/**
 * Balances by account and day, worked out once for many questions. An
 * account's balance at the end of a day is its latest value on or before
 * that day (an investment's, typed in or read from IOL; a value typed for a
 * day wins over one read for it), plus what moved in or out after it; with no
 * value, its opening balance plus everything from its opening day. Null
 * before an account has either.
 */
export function balanceBook(accounts: Account[], transactions: Transaction[], valuations: Valuation[] = []) {
  type Line = { dates: string[]; sums: number[] };
  const lines = new Map<string, Line>();
  const values = new Map<string, Valuation[]>();
  const byId = new Map(accounts.map((account) => [account.id, account]));
  const moved = new Map<string, Transaction[]>();
  for (const transaction of transactions) {
    const account = byId.get(transaction.accountId);
    if (!account || !happened(transaction)) continue;
    moved.set(account.id, [...(moved.get(account.id) ?? []), transaction]);
  }
  for (const [accountId, list] of moved) {
    list.sort((a, b) => a.date.localeCompare(b.date));
    // sums[i] is everything up to and including dates[i].
    let running = 0;
    lines.set(accountId, { dates: list.map((t) => t.date), sums: list.map((t) => (running += t.amount)) });
  }
  for (const valuation of valuations) {
    if (valuation.deleted || !byId.has(valuation.accountId)) continue;
    const list = values.get(valuation.accountId) ?? [];
    const same = list.findIndex((other) => other.date === valuation.date);
    if (same === -1) list.push(valuation);
    else if (valuation.source === "typed") list[same] = valuation;
    values.set(valuation.accountId, list);
  }
  for (const list of values.values()) list.sort((a, b) => a.date.localeCompare(b.date));

  /** Everything moved in or out of an account up to the end of a day. */
  const upTo = (accountId: string, date: string): number => {
    const line = lines.get(accountId);
    if (!line) return 0;
    let low = 0;
    let high = line.dates.length - 1;
    let found = -1;
    while (low <= high) {
      const middle = (low + high) >> 1;
      if (line.dates[middle]! <= date) {
        found = middle;
        low = middle + 1;
      } else high = middle - 1;
    }
    return found === -1 ? 0 : line.sums[found]!;
  };

  return {
    balance(account: Account, on: string): number | null {
      const known = values.get(account.id)?.filter((valuation) => valuation.date <= on).at(-1);
      if (known) return known.value + upTo(account.id, on) - upTo(account.id, known.date);
      if (account.openingDate > on) return null;
      return account.openingBalance + upTo(account.id, on) - upTo(account.id, addDays(account.openingDate, -1));
    },
    /** The latest value of an account, if it has any. */
    latestValue: (accountId: string): Valuation | undefined => values.get(accountId)?.at(-1),
  };
}

/** An account's balance at the end of a day (today's, without one). */
export function accountBalance(account: Account, transactions: Transaction[], on = "9999-12-31", valuations: Valuation[] = []): number {
  return balanceBook([account], transactions, valuations).balance(account, on) ?? account.openingBalance;
}

/** Every account's balance together, at the end of a day, at that day's rate. */
export function totalBalance(accounts: Account[], transactions: Transaction[], convertOn: Converter, on: string, valuations: Valuation[] = []): { total: number; missing: number } {
  const book = balanceBook(accounts, transactions, valuations);
  return sum(
    accounts.flatMap((account) => {
      const balance = account.deleted ? null : book.balance(account, on);
      return balance === null ? [] : [convertOn(balance, account.currency, on)];
    }),
  );
}

/** The balance at the end of each day of a month, up to today. */
export function dailyBalances(
  accounts: Account[],
  transactions: Transaction[],
  convertOn: Converter,
  month: string,
  today: string,
  valuations: Valuation[] = [],
): { date: string; total: number }[] {
  const last = lastOfMonth(month) < today ? lastOfMonth(month) : today;
  const first = firstOfMonth(month);
  if (first > last) return [];
  const live = accounts.filter((account) => !account.deleted);
  const book = balanceBook(live, transactions, valuations);
  return datesBetween(first, last).map((date) => {
    const amounts = live.flatMap((account) => {
      const balance = book.balance(account, date);
      return balance === null ? [] : [convertOn(balance, account.currency, date)];
    });
    return { date, total: sum(amounts).total };
  });
}

export type MonthFlows = {
  income: number;
  spending: number;
  /** Income on each day of the month, from the 1st. */
  incomeByDay: number[];
  /** Spending by category ID ("" for none), positive. */
  spendingByCategory: Map<string, number>;
  missing: number;
};

/** A month's income and spending (spending as a positive number). */
export function monthFlows(accounts: Account[], transactions: Transaction[], convertOn: Converter, month: string): MonthFlows {
  const currencyOf = new Map(accounts.map((account) => [account.id, account.currency]));
  const days = Number(lastOfMonth(month).slice(8, 10));
  const flows: MonthFlows = { income: 0, spending: 0, incomeByDay: Array.from({ length: days }, () => 0), spendingByCategory: new Map(), missing: 0 };
  for (const transaction of transactions) {
    if (!isFlow(transaction) || monthOf(transaction.date) !== month) continue;
    const currency = currencyOf.get(transaction.accountId);
    if (!currency) continue;
    const amount = convertOn(transaction.amount, currency, transaction.date);
    if (amount === null) {
      flows.missing++;
      continue;
    }
    if (amount > 0) {
      flows.income += amount;
      flows.incomeByDay[Number(transaction.date.slice(8, 10)) - 1]! += amount;
    } else {
      flows.spending -= amount;
      const key = transaction.categoryId ?? "";
      flows.spendingByCategory.set(key, (flows.spendingByCategory.get(key) ?? 0) - amount);
    }
  }
  return flows;
}

export type Overview = {
  balance: {
    total: number;
    startOfMonth: number;
    change: number | null;
    /** The month's days, up to today. */
    byDay: { date: string; total: number }[];
    /** The last 30 of those days and the month before's, so early in a month there's still a picture. */
    recent: { date: string; total: number }[];
  };
  income: { total: number; previous: number; change: number | null; byDay: number[] };
  spending: { total: number; previous: number; change: number | null; shareOfIncome: number | null };
  /** Amounts left out of the totals for want of a rate. */
  missing: number;
};

/** The three cards at the top of the overview, for a month. */
export function overview(accounts: Account[], transactions: Transaction[], convertOn: Converter, month: string, today: string, valuations: Valuation[] = []): Overview {
  const end = lastOfMonth(month) < today ? lastOfMonth(month) : today;
  const now = totalBalance(accounts, transactions, convertOn, end, valuations);
  const before = totalBalance(accounts, transactions, convertOn, addDays(firstOfMonth(month), -1), valuations);
  const flows = monthFlows(accounts, transactions, convertOn, month);
  const previous = monthFlows(accounts, transactions, convertOn, addMonths(month, -1));
  const byDay = dailyBalances(accounts, transactions, convertOn, month, today, valuations);
  const recent = [...dailyBalances(accounts, transactions, convertOn, addMonths(month, -1), today, valuations), ...byDay].slice(-30);
  return {
    balance: { total: now.total, startOfMonth: before.total, change: change(before.total, now.total), byDay, recent },
    income: { total: flows.income, previous: previous.income, change: change(previous.income, flows.income), byDay: flows.incomeByDay },
    spending: {
      total: flows.spending,
      previous: previous.spending,
      change: change(previous.spending, flows.spending),
      shareOfIncome: flows.income > 0 ? flows.spending / flows.income : null,
    },
    missing: now.missing + flows.missing,
  };
}

/** What a goal has: what you started with plus what's been put in (or taken out) for it. */
export function goalSaved(goal: Goal, transactions: Transaction[]): number {
  let saved = goal.startAmount;
  for (const transaction of transactions) if (transaction.goalId === goal.id && happened(transaction)) saved += transaction.amount;
  return saved;
}

export type Board = { bills: Transaction[]; daily: Transaction[]; goals: Goal[]; income: Transaction[] };

const byDate = (a: Transaction, b: Transaction) => a.date.localeCompare(b.date);
const byDateDesc = (a: Transaction, b: Transaction) => b.date.localeCompare(a.date);

/**
 * The budget board's four columns for a month. Bills and fixed: what comes
 * back, overdue first, then by due date, then paid. Daily spending: the rest
 * of the spending, newest first. Income: expected first (soonest first),
 * then received (newest first). Goals: by target date.
 */
export function board(transactions: Transaction[], categories: Category[], goals: Goal[], month: string, today: string): Board {
  const groupOf = new Map(categories.map((category) => [category.id, category.group]));
  const inMonth = transactions.filter((transaction) => !transaction.deleted && transaction.transferId === null && transaction.goalId === null && monthOf(transaction.date) === month);
  const isBill = (transaction: Transaction) => transaction.recurringId !== null || (transaction.categoryId !== null && groupOf.get(transaction.categoryId) === "bills");

  const spending = inMonth.filter((transaction) => transaction.amount < 0);
  const bills = spending.filter(isBill);
  const overdue = bills.filter((transaction) => transaction.status === "expected" && transaction.date < today).sort(byDate);
  const upcoming = bills.filter((transaction) => transaction.status === "expected" && transaction.date >= today).sort(byDate);
  const done = bills.filter((transaction) => transaction.status !== "expected").sort(byDateDesc);

  const daily = spending.filter((transaction) => !isBill(transaction));
  const income = inMonth.filter((transaction) => transaction.amount > 0);

  return {
    bills: [...overdue, ...upcoming, ...done],
    daily: [...daily.filter((transaction) => transaction.status === "expected").sort(byDate), ...daily.filter((transaction) => transaction.status !== "expected").sort(byDateDesc)],
    goals: goals.filter((goal) => !goal.deleted).sort((a, b) => (a.targetDate ?? "9999").localeCompare(b.targetDate ?? "9999") || a.name.localeCompare(b.name)),
    income: [...income.filter((transaction) => transaction.status === "expected").sort(byDate), ...income.filter((transaction) => transaction.status !== "expected").sort(byDateDesc)],
  };
}

export type CategorySpending = { category: Category | null; spent: number; budget: number | null };

/** Each category's spending in a month against its budget, both in the display currency; biggest first. */
export function categorySpending(flows: MonthFlows, categories: Category[], rates: RateBook, display: Converter["to"], today: string): CategorySpending[] {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const rows: CategorySpending[] = [];
  const rate = rateOn(rates, today);
  for (const category of categories) {
    if (category.deleted || category.group === "income") continue;
    const spent = flows.spendingByCategory.get(category.id) ?? 0;
    const budget = category.budget ? convert(category.budget.amount, category.budget.currency, display, rate) : null;
    if (spent > 0 || budget) rows.push({ category, spent, budget });
  }
  const uncategorised = flows.spendingByCategory.get("") ?? 0;
  if (uncategorised > 0) rows.push({ category: null, spent: uncategorised, budget: null });
  for (const [id, spent] of flows.spendingByCategory) if (id && !byId.has(id)) rows.push({ category: null, spent, budget: null });
  return rows.sort((a, b) => b.spent - a.spent);
}
