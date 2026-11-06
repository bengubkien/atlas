import { thisDevice } from "./local/device";
import { DEFAULT_SETTINGS, newId, rateId, valuationId, type Account, type Category, type Goal, type RateKind, type Recurring, type Settings, type Transaction } from "./model";
import { startingCategories } from "./categories";
import { autopayDue, followItem, occurrencesAround } from "./recurring";

// What you do in Tyche, as changes to this device's copy. Each returns once
// it's saved here; syncing follows by itself.

const empty = { updatedAt: 0, deleted: false };

export type NewTransaction = Omit<Transaction, "id" | "updatedAt" | "deleted" | "recurringId" | "dueDate" | "transferId" | "goalId" | "importId"> &
  Partial<Pick<Transaction, "goalId">>;

/** Adds a transaction; returns its ID. */
export async function addTransaction(fields: NewTransaction): Promise<string> {
  const id = newId();
  await thisDevice().put("transaction", { ...empty, recurringId: null, dueDate: null, transferId: null, goalId: null, importId: null, ...fields, id });
  rememberAccount(fields.accountId);
  return id;
}

/** Saves changes to a transaction. A transfer's other half keeps its date in step. */
export async function saveTransaction(transaction: Transaction): Promise<void> {
  const device = thisDevice();
  const other = transaction.transferId ? await device.table("transaction").get(transaction.transferId) : undefined;
  if (other && !other.deleted && other.date !== transaction.date) {
    await device.save([
      { kind: "transaction", record: transaction },
      { kind: "transaction", record: { ...other, date: transaction.date } },
    ]);
  } else await device.put("transaction", transaction);
}

/** Deletes a transaction (both halves of a transfer). Returns what to pass to `restore` to undo it. */
export async function deleteTransaction(transaction: Transaction): Promise<Transaction[]> {
  const device = thisDevice();
  const other = transaction.transferId ? await device.table("transaction").get(transaction.transferId) : undefined;
  const gone = [transaction, ...(other && !other.deleted ? [other] : [])];
  await device.save(gone.map((record) => ({ kind: "transaction" as const, record: { ...record, deleted: true } })));
  return gone;
}

/** Puts deleted transactions back (the Undo after Delete). */
export function restoreTransactions(transactions: Transaction[]): Promise<void> {
  return thisDevice().save(transactions.map((record) => ({ kind: "transaction" as const, record: { ...record, deleted: false } })));
}

/** Marks a bill paid or pay received: it's cleared, on the day and for the amount given. */
export function markDone(transaction: Transaction, { date, amount }: { date: string; amount?: number }): Promise<void> {
  return thisDevice().put("transaction", { ...transaction, status: "cleared", date, amount: amount ?? transaction.amount });
}

/** Puts a cleared bill back to expected (the Undo after Mark paid). */
export function markExpected(transaction: Transaction): Promise<void> {
  return thisDevice().put("transaction", { ...transaction, status: "expected" });
}

/**
 * Moves money between two of your accounts: out of one, into the other, each
 * in its own currency (buying dollars: pesos out, dollars in, at the rate
 * you got). Neither half is income or spending. `goalId` marks the money
 * going in as put into a goal.
 */
export async function addTransfer({
  from,
  to,
  sent,
  received,
  date,
  note = "",
  goalId = null,
}: {
  from: Account;
  to: Account;
  /** Positive, in `from`'s currency. */
  sent: number;
  /** Positive, in `to`'s currency. */
  received: number;
  date: string;
  note?: string;
  goalId?: string | null;
}): Promise<void> {
  const out = newId();
  const into = newId();
  const common = { ...empty, date, categoryId: null, note, status: "cleared" as const, recurringId: null, dueDate: null, importId: null };
  await thisDevice().save([
    { kind: "transaction", record: { ...common, id: out, accountId: from.id, amount: -Math.abs(sent), payee: to.name, transferId: into, goalId: null } },
    { kind: "transaction", record: { ...common, id: into, accountId: to.id, amount: Math.abs(received), payee: from.name, transferId: out, goalId } },
  ]);
  rememberAccount(from.id);
}

export async function saveAccount(account: Omit<Account, "id" | "updatedAt" | "deleted"> & { id?: string }): Promise<string> {
  const id = account.id ?? newId();
  await thisDevice().put("account", { ...empty, ...account, id });
  return id;
}

/** Deletes an account and its transactions; returns what `restoreAccount` needs to undo it. */
export async function deleteAccount(account: Account): Promise<{ account: Account; transactions: Transaction[] }> {
  const device = thisDevice();
  const transactions = (await device.table("transaction").where("accountId").equals(account.id).toArray()).filter((transaction) => !transaction.deleted);
  await device.save([
    { kind: "account", record: { ...account, deleted: true } },
    ...transactions.map((record) => ({ kind: "transaction" as const, record: { ...record, deleted: true } })),
  ]);
  return { account, transactions };
}

export function restoreAccount({ account, transactions }: { account: Account; transactions: Transaction[] }): Promise<void> {
  return thisDevice().save([
    { kind: "account", record: { ...account, deleted: false } },
    ...transactions.map((record) => ({ kind: "transaction" as const, record: { ...record, deleted: false } })),
  ]);
}

export async function saveCategory(category: Omit<Category, "id" | "updatedAt" | "deleted"> & { id?: string }): Promise<string> {
  const id = category.id ?? newId();
  await thisDevice().put("category", { ...empty, ...category, id });
  return id;
}

/** Deletes a category; its transactions stay, without one. */
export function deleteCategory(category: Category): Promise<void> {
  return thisDevice().put("category", { ...category, deleted: true });
}

/**
 * Saves a recurring item, then brings its occurrences in line: untouched
 * ones ahead follow the change, and new dates are made. (`today` is the
 * device's date.)
 */
export async function saveRecurring(item: Omit<Recurring, "id" | "updatedAt" | "deleted"> & { id?: string }, today: string): Promise<string> {
  const device = thisDevice();
  const record: Recurring = { ...empty, ...item, id: item.id ?? newId() };
  await device.put("recurring", record);
  await keepItemInStep(record, today);
  return record.id;
}

/**
 * Deletes a recurring item and its untouched occurrences from today on
 * (paid ones stay). Returns what `restoreRecurring` needs to undo it.
 */
export async function deleteRecurring(item: Recurring, today: string): Promise<{ item: Recurring; removed: Transaction[] }> {
  const record = { ...item, deleted: true };
  await thisDevice().put("recurring", record);
  return { item, removed: await keepItemInStep(record, today) };
}

/** Puts a deleted recurring item back, with the occurrences its deletion took away. */
export function restoreRecurring({ item, removed }: { item: Recurring; removed: Transaction[] }): Promise<void> {
  return thisDevice().save([
    { kind: "recurring", record: { ...item, deleted: false } },
    ...removed.map((record) => ({ kind: "transaction" as const, record: { ...record, deleted: false } })),
  ]);
}

/** Brings an item's occurrences in line with it; returns those it deleted. */
async function keepItemInStep(item: Recurring, today: string): Promise<Transaction[]> {
  const device = thisDevice();
  const occurrences = await device.table("transaction").where("recurringId").equals(item.id).toArray();
  const { update, remove } = followItem(item, occurrences, today);
  await device.save([
    ...update.map((record) => ({ kind: "transaction" as const, record })),
    ...remove.map((record) => ({ kind: "transaction" as const, record: { ...record, deleted: true } })),
  ]);
  if (!item.deleted) await device.seed(occurrencesAround([item], today).map((record) => ({ kind: "transaction" as const, record })));
  return remove;
}

export async function saveGoal(goal: Omit<Goal, "id" | "updatedAt" | "deleted"> & { id?: string }): Promise<string> {
  const id = goal.id ?? newId();
  await thisDevice().put("goal", { ...empty, ...goal, id });
  return id;
}

/**
 * Deletes a goal; the money stays in its account, and its transactions stay,
 * no longer marked for it. Returns what `restoreGoal` needs to undo it.
 */
export async function deleteGoal(goal: Goal): Promise<{ goal: Goal; marked: Transaction[] }> {
  const device = thisDevice();
  const marked = (await device.table("transaction").where("goalId").equals(goal.id).toArray()).filter((transaction) => !transaction.deleted);
  await device.save([
    { kind: "goal", record: { ...goal, deleted: true } },
    ...marked.map((record) => ({ kind: "transaction" as const, record: { ...record, goalId: null } })),
  ]);
  return { goal, marked };
}

/** Puts a deleted goal back, with its transactions marked for it again. */
export function restoreGoal({ goal, marked }: { goal: Goal; marked: Transaction[] }): Promise<void> {
  return thisDevice().save([
    { kind: "goal", record: { ...goal, deleted: false } },
    ...marked.map((record) => ({ kind: "transaction" as const, record: { ...record, goalId: goal.id } })),
  ]);
}

/**
 * A purchase on a card in cuotas: N monthly charges of the total divided by
 * N, the first on `firstDate` (usually the purchase's day; the card's
 * statement decides the month it's billed in). It's a recurring item that
 * pays itself and ends after the last cuota, so each month's charge appears
 * and clears by itself, and what's still to come shows ahead. Every cuota is
 * the same amount, rounded to the cent, as card statements show them.
 */
export async function addInCuotas(
  { accountId, categoryId, payee, total, installments, firstDate, note = "" }: { accountId: string; categoryId: string | null; payee: string; total: number; installments: number; firstDate: string; note?: string },
  today: string,
): Promise<string> {
  const id = await saveRecurring(
    {
      name: payee || "Purchase in cuotas",
      accountId,
      categoryId,
      amount: -Math.round(Math.abs(total) / installments),
      estimated: false,
      frequency: "monthly",
      start: firstDate,
      end: null,
      autopay: true,
      installments,
      note,
    },
    today,
  );
  rememberAccount(accountId);
  return id;
}

/** An investment's value at the end of a day, typed in; it wins over the one read from IOL for that day. */
export function typeValuation(accountId: string, date: string, value: number): Promise<void> {
  return thisDevice().put("valuation", { ...empty, id: valuationId(accountId, date, "typed"), accountId, date, value, source: "typed" });
}

/** A rate typed in for a day; it wins over the fetched one. */
export function typeRate(date: string, kind: RateKind, pesos: number): Promise<void> {
  return thisDevice().put("rate", { ...empty, id: rateId(date, kind, "typed"), date, kind, pesos, source: "typed" });
}

export async function saveSettings(patch: Partial<Omit<Settings, "id" | "updatedAt" | "deleted">>): Promise<void> {
  const device = thisDevice();
  const saved = await device.table("settings").get("settings");
  await device.put("settings", { ...DEFAULT_SETTINGS, ...saved, ...patch, id: "settings", deleted: false });
}

/**
 * What the device does by itself when it opens, after a sync and each day:
 * makes the starting categories (once, ever: seeded, so ones you've deleted
 * or renamed elsewhere stay that way), makes the recurring items'
 * occurrences around today, and clears bills that pay themselves once due.
 */
export async function keepUp(today: string): Promise<void> {
  const device = thisDevice();
  await device.seed(startingCategories().map((record) => ({ kind: "category" as const, record })));
  const items = (await device.table("recurring").toArray()).filter((item) => !item.deleted);
  await device.seed(occurrencesAround(items, today).map((record) => ({ kind: "transaction" as const, record })));
  const due = autopayDue(await device.table("transaction").where("date").belowOrEqual(today).toArray(), items, today);
  if (due.length > 0) await device.save(due.map((record) => ({ kind: "transaction" as const, record: { ...record, status: "cleared" as const } })));
}

// The account Add starts on: the last one used on this device. A
// convenience for this device only, so it lives in the browser, not in the
// synced settings.

const LAST_ACCOUNT = "tyche-last-account";

export function rememberAccount(accountId: string) {
  try {
    localStorage.setItem(LAST_ACCOUNT, accountId);
  } catch {
    // Private browsing or storage turned off: Add starts on the first account instead.
  }
}

export function lastAccount(): string | null {
  try {
    return localStorage.getItem(LAST_ACCOUNT);
  } catch {
    return null;
  }
}
