import { SEEDED } from "@atlas/sync/device";

import { addDays, addMonths, daysBetween, dayInMonth, monthOf } from "./dates";
import { occurrenceId, type Recurring, type Transaction } from "./model";

// Recurring items (rent, salary) and their occurrences. Each device makes the
// occurrences itself, from a month and a half back to a month ahead, as
// `expected` transactions whose ID comes from the item and the date
// (occurrenceId). They're seeded (Device.seed): saved as the oldest possible
// version, so marking one paid anywhere always wins, and two phones making
// the same one agree. One still at that oldest version has never been
// touched, so it can follow the item when the item changes.

/** How far back and ahead occurrences are made. */
export const WINDOW = { back: 45, ahead: 31 };

/** The dates an item is due between two dates, both included. */
export function occurrencesBetween(item: Pick<Recurring, "frequency" | "start" | "end">, from: string, to: string): string[] {
  const last = item.end && item.end < to ? item.end : to;
  const first = item.start > from ? item.start : from;
  if (first > last) return [];
  const dates: string[] = [];

  if (item.frequency === "weekly" || item.frequency === "biweekly") {
    const step = item.frequency === "weekly" ? 7 : 14;
    const skip = Math.max(0, Math.ceil(daysBetween(item.start, first) / step));
    for (let date = addDays(item.start, skip * step); date <= last; date = addDays(date, step)) dates.push(date);
    return dates;
  }

  // Monthly and yearly items keep the start's day, even after a short month:
  // the 31st falls on February's last day, and on March 31st again.
  const day = Number(item.start.slice(8, 10));
  const startMonth = monthOf(item.start);
  const every = item.frequency === "monthly" ? 1 : 12;
  const behind = monthsBetween(startMonth, monthOf(first));
  for (let index = Math.max(0, Math.floor(behind / every)); ; index++) {
    const date = dayInMonth(addMonths(startMonth, index * every), day);
    if (date > last) break;
    if (date >= first) dates.push(date);
  }
  return dates;
}

const monthsBetween = (from: string, to: string) =>
  (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 + Number(to.slice(5, 7)) - Number(from.slice(5, 7));

/** The first date an item is due on or after a day; null once it has ended. */
export function nextDue(item: Pick<Recurring, "frequency" | "start" | "end">, onOrAfter: string): string | null {
  return occurrencesBetween(item, onOrAfter, addDays(onOrAfter, 400))[0] ?? null;
}

/** An occurrence as a transaction: expected, or already cleared for a bill that pays itself and is due. */
export function occurrence(item: Recurring, dueDate: string, today: string): Transaction {
  return {
    id: occurrenceId(item.id, dueDate),
    updatedAt: SEEDED,
    deleted: false,
    accountId: item.accountId,
    date: dueDate,
    amount: item.amount,
    categoryId: item.categoryId,
    payee: item.name,
    note: "",
    status: item.autopay && dueDate <= today ? "cleared" : "expected",
    recurringId: item.id,
    dueDate,
    transferId: null,
    goalId: null,
    importId: null,
  };
}

/** Every occurrence in the window around today, for Device.seed (which skips those already here). */
export function occurrencesAround(items: Recurring[], today: string): Transaction[] {
  const from = addDays(today, -WINDOW.back);
  const to = addDays(today, WINDOW.ahead);
  return items.filter((item) => !item.deleted).flatMap((item) => occurrencesBetween(item, from, to).map((date) => occurrence(item, date, today)));
}

/**
 * The transactions plus the occurrences in the window that aren't among
 * them: what the devices will have once one of them opens. For the server
 * (Today), which can't wait for a phone to make next week's rent.
 */
export function withOccurrences(transactions: Transaction[], items: Recurring[], today: string): Transaction[] {
  const known = new Set(transactions.map((transaction) => transaction.id));
  return [...transactions, ...occurrencesAround(items, today).filter((transaction) => !known.has(transaction.id))];
}

/** Never changed since it was made: it can follow its item. */
const untouched = (transaction: Transaction) => transaction.updatedAt === SEEDED && transaction.status === "expected" && !transaction.deleted;

/**
 * After an item changes (or is deleted): its untouched occurrences from
 * today on that no longer fall on its dates go, and the others take its new
 * amount, account, category and name. Ones you've touched (paid, edited,
 * deleted) stay as they are. New dates are seeded as usual.
 */
export function followItem(item: Recurring, transactions: Transaction[], today: string): { update: Transaction[]; remove: Transaction[] } {
  const ahead = transactions.filter((transaction) => transaction.recurringId === item.id && transaction.date >= today && untouched(transaction));
  if (item.deleted) return { update: [], remove: ahead };
  const dates = new Set(occurrencesBetween(item, today, addDays(today, WINDOW.ahead)));
  const update: Transaction[] = [];
  const remove: Transaction[] = [];
  for (const transaction of ahead) {
    if (!transaction.dueDate || !dates.has(transaction.dueDate)) {
      remove.push(transaction);
      continue;
    }
    const fresh = occurrence(item, transaction.dueDate, today);
    const same = (["accountId", "amount", "categoryId", "payee"] as const).every((key) => fresh[key] === transaction[key]);
    if (!same) update.push({ ...transaction, accountId: fresh.accountId, amount: fresh.amount, categoryId: fresh.categoryId, payee: fresh.payee });
  }
  return { update, remove };
}

/** Bills that pay themselves and are now due: they clear on their date. */
export function autopayDue(transactions: Transaction[], items: Recurring[], today: string): Transaction[] {
  const autopay = new Set(items.filter((item) => item.autopay && !item.deleted).map((item) => item.id));
  return transactions.filter(
    (transaction) => !transaction.deleted && transaction.status === "expected" && transaction.recurringId !== null && autopay.has(transaction.recurringId) && transaction.date <= today,
  );
}
