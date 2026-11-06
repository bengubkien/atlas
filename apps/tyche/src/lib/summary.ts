import { addDays, addMonths, datesBetween, firstOfMonth, lastOfMonth, monthOf } from "./dates";
import { change, convert, rateOn, sum, type Converter, type RateBook } from "./money";
import type { Account, Category, Goal, Transaction } from "./model";

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

/** An account's balance at the end of a day (today's, without one). */
export function accountBalance(account: Account, transactions: Transaction[], on = "9999-12-31"): number {
  let balance = account.openingBalance;
  for (const transaction of transactions) {
    if (transaction.accountId === account.id && happened(transaction) && transaction.date >= account.openingDate && transaction.date <= on) balance += transaction.amount;
  }
  return balance;
}

/** Every account's balance together, at the end of a day, at that day's rate. */
export function totalBalance(accounts: Account[], transactions: Transaction[], convertOn: Converter, on: string): { total: number; missing: number } {
  return sum(accounts.filter((account) => !account.deleted && account.openingDate <= on).map((account) => convertOn(accountBalance(account, transactions, on), account.currency, on)));
}

/** The balance at the end of each day of a month, up to today. */
export function dailyBalances(accounts: Account[], transactions: Transaction[], convertOn: Converter, month: string, today: string): { date: string; total: number }[] {
  const last = lastOfMonth(month) < today ? lastOfMonth(month) : today;
  const first = firstOfMonth(month);
  if (first > last) return [];
  const live = accounts.filter((account) => !account.deleted);
  // Each account's balance the day before the month (or from its opening
  // day, if it opened during the month), then each day's changes.
  const running = new Map<string, number>();
  for (const account of live) if (account.openingDate < first) running.set(account.id, accountBalance(account, transactions, addDays(first, -1)));
  const deltas = new Map<string, Map<string, number>>();
  for (const transaction of transactions) {
    if (!happened(transaction) || transaction.date < first || transaction.date > last) continue;
    const account = live.find((candidate) => candidate.id === transaction.accountId);
    if (!account || transaction.date < account.openingDate) continue;
    const day = deltas.get(transaction.date) ?? new Map<string, number>();
    day.set(account.id, (day.get(account.id) ?? 0) + transaction.amount);
    deltas.set(transaction.date, day);
  }
  return datesBetween(first, last).map((date) => {
    for (const account of live) if (account.openingDate === date) running.set(account.id, account.openingBalance);
    for (const [accountId, amount] of deltas.get(date) ?? []) running.set(accountId, (running.get(accountId) ?? 0) + amount);
    const amounts = live.filter((account) => running.has(account.id)).map((account) => convertOn(running.get(account.id)!, account.currency, date));
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
  balance: { total: number; startOfMonth: number; change: number | null; byDay: { date: string; total: number }[] };
  income: { total: number; previous: number; change: number | null; byDay: number[] };
  spending: { total: number; previous: number; change: number | null; shareOfIncome: number | null };
  /** Amounts left out of the totals for want of a rate. */
  missing: number;
};

/** The three cards at the top of the overview, for a month. */
export function overview(accounts: Account[], transactions: Transaction[], convertOn: Converter, month: string, today: string): Overview {
  const end = lastOfMonth(month) < today ? lastOfMonth(month) : today;
  const now = totalBalance(accounts, transactions, convertOn, end);
  const before = totalBalance(accounts, transactions, convertOn, addDays(firstOfMonth(month), -1));
  const flows = monthFlows(accounts, transactions, convertOn, month);
  const previous = monthFlows(accounts, transactions, convertOn, addMonths(month, -1));
  return {
    balance: { total: now.total, startOfMonth: before.total, change: change(before.total, now.total), byDay: dailyBalances(accounts, transactions, convertOn, month, today) },
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
