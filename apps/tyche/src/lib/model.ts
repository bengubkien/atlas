import { recordBase } from "@atlas/sync/records";
import { z } from "zod";

// Tyche's records, the same on the phone and on the server, synced by
// @atlas/sync: each has an ID made on the device, the time it last changed
// and a deleted flag (recordBase).
//
// Money is whole cents (integers), never floating point. Each account has
// one currency, and its transactions are in it. Calendar dates are
// YYYY-MM-DD; moments are milliseconds.

const base = recordBase;
const name = z.string().trim().min(1).max(80);
const text = (max = 200) => z.string().max(max).default("");
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const id = z.string().min(1).max(128);
/** Up to a hundred billion either way, in cents: room for pesos. */
const cents = z.number().int().min(-1e13).max(1e13);

export const CURRENCIES = ["ARS", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number];
const currency = z.enum(CURRENCIES);

export const ACCOUNT_TYPES = ["bank", "card", "cash", "wallet", "savings", "investment"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const accountSchema = z.object({
  ...base,
  name,
  type: z.enum(ACCOUNT_TYPES),
  currency,
  /** What it held on the day you started counting it here. */
  openingBalance: cents.default(0),
  openingDate: date,
  /** Kept for its history, but out of the lists and the totals' pickers. */
  archived: z.boolean().default(false),
  note: text(500),
});

/** The columns of the budget board, and how categories are grouped. */
export const CATEGORY_GROUPS = ["bills", "daily", "income"] as const;
export type CategoryGroup = (typeof CATEGORY_GROUPS)[number];

export const categorySchema = z.object({
  ...base,
  name,
  group: z.enum(CATEGORY_GROUPS),
  /** One of Tyche's category icons (src/lib/icons.ts), by name. */
  icon: z.string().max(40).default("circle"),
  /** What you mean to spend in a month, if you've set it. */
  budget: z.object({ amount: cents.nonnegative(), currency }).nullable().default(null),
});

/**
 * expected: a bill or pay that hasn't gone through yet (made from a recurring
 * item, or added ahead). pending: a card payment not yet cleared. cleared:
 * it happened.
 */
export const TRANSACTION_STATUSES = ["expected", "pending", "cleared"] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export const transactionSchema = z.object({
  ...base,
  accountId: id,
  date,
  /** Negative is money out, positive money in, in the account's currency. */
  amount: cents,
  categoryId: id.nullable().default(null),
  /** Who was paid or who paid: "Whole Foods", "Payroll". */
  payee: text(120),
  note: text(1000),
  status: z.enum(TRANSACTION_STATUSES).default("cleared"),
  /** Made from this recurring item, for the date it was due (its ID comes from both). */
  recurringId: id.nullable().default(null),
  dueDate: date.nullable().default(null),
  /** The other half of a transfer between two of your accounts. Transfers aren't income or spending. */
  transferId: id.nullable().default(null),
  /** Money put into (or taken out of) a savings goal, on the goal's account. */
  goalId: id.nullable().default(null),
  /** The statement row it came from (step 6c), so importing twice adds nothing. */
  importId: z.string().max(128).nullable().default(null),
});

export const FREQUENCIES = ["weekly", "biweekly", "monthly", "yearly"] as const;
export type Frequency = (typeof FREQUENCIES)[number];

/** A bill or pay that comes back: rent on the 1st, salary every two weeks. */
export const recurringSchema = z.object({
  ...base,
  name,
  accountId: id,
  categoryId: id.nullable().default(null),
  /** Negative for a bill, positive for pay, in the account's currency. */
  amount: cents,
  /** The amount changes each time (electricity): what's shown is a guess until it's paid. */
  estimated: z.boolean().default(false),
  frequency: z.enum(FREQUENCIES),
  /** The first date it's due. Monthly items fall on its day of the month (or a short month's last day). */
  start: date,
  end: date.nullable().default(null),
  /** Paid by itself (a direct debit): it clears on its date without you marking it. */
  autopay: z.boolean().default(false),
  /**
   * A purchase on a card in cuotas: how many. Each month's charge is one
   * occurrence ("Cuota 3 of 6"), and the item ends after the last. Added
   * later: older records have none.
   */
  installments: z.number().int().min(2).max(72).nullable().default(null),
  note: text(500),
});

export const GOAL_KINDS = ["safety", "travel", "purchase", "other"] as const;
export type GoalKind = (typeof GOAL_KINDS)[number];

/**
 * Something you're saving for, kept in one account. What's saved is what you
 * had for it when you started, plus the transactions marked for it on that
 * account; it's in that account's currency.
 */
export const goalSchema = z.object({
  ...base,
  name,
  kind: z.enum(GOAL_KINDS).default("other"),
  accountId: id,
  target: cents.positive(),
  startAmount: cents.nonnegative().default(0),
  startDate: date,
  targetDate: date.nullable().default(null),
  note: text(500),
});

/**
 * What an investment account was worth at the end of a day, typed in or read
 * from IOL. Its balance is the latest value, plus what moved in or out after
 * it: prices change the value without any transaction. A value typed in for a
 * day wins over one read for it; its ID is made from the account, day and
 * source, so each has one record.
 */
export const valuationSchema = z.object({
  ...base,
  accountId: id,
  date,
  /** In the account's currency. */
  value: cents,
  source: z.enum(["typed", "iol"]),
});

/** One position in an investment account, as IOL last reported it; one record per account and symbol. */
export const holdingSchema = z.object({
  ...base,
  accountId: id,
  /** The day it was read. */
  date,
  symbol: z.string().min(1).max(40),
  name: text(120),
  /** As IOL names it: "ACCIONES", "CEDEARS", "FondoComundeInversion"… */
  type: text(40),
  quantity: z.number().min(0).max(1e12),
  /** The last price, and the position's value, in cents of the account's currency. */
  price: cents,
  value: cents,
  /** The gain since bought, as IOL works it out (0.12 is +12%); null when it doesn't say. */
  gain: z.number().min(-100).max(1e6).nullable().default(null),
});

export const RATE_KINDS = ["mep", "blue", "official"] as const;
export type RateKind = (typeof RATE_KINDS)[number];

/**
 * Pesos per dollar on one day. The server saves the day's quotes (selling
 * price) as "fetched"; you can type one in, which wins. A rate's ID is made
 * from its day, kind and source, so each has one record.
 */
export const rateSchema = z.object({
  ...base,
  date,
  kind: z.enum(RATE_KINDS),
  /** Pesos per dollar, in cents of a peso: 1,250.50 is 125050. */
  pesos: cents.positive(),
  source: z.enum(["fetched", "typed"]),
});

export const settingsSchema = z.object({
  ...base,
  /** Totals are shown in this currency, each amount converted at its own day's rate. */
  displayCurrency: currency.default("USD"),
  rateKind: z.enum(RATE_KINDS).default("mep"),
});

export const SCHEMAS = {
  account: accountSchema,
  category: categorySchema,
  transaction: transactionSchema,
  recurring: recurringSchema,
  goal: goalSchema,
  valuation: valuationSchema,
  holding: holdingSchema,
  rate: rateSchema,
  settings: settingsSchema,
};

export type Account = z.infer<typeof accountSchema>;
export type Category = z.infer<typeof categorySchema>;
export type Transaction = z.infer<typeof transactionSchema>;
export type Recurring = z.infer<typeof recurringSchema>;
export type Goal = z.infer<typeof goalSchema>;
export type Valuation = z.infer<typeof valuationSchema>;
export type Holding = z.infer<typeof holdingSchema>;
export type Rate = z.infer<typeof rateSchema>;
export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: Settings = settingsSchema.parse({ id: "settings", updatedAt: 0 });

export { newId } from "@atlas/sync/records";

/** A recurring item's occurrence: one per item and due date, the same on every device. */
export const occurrenceId = (recurringId: string, dueDate: string) => `o-${recurringId}-${dueDate}`;

/** A value's record: one per account, day and source. */
export const valuationId = (accountId: string, date: string, source: Valuation["source"]) => `v-${accountId}-${date}-${source}`;

/** A rate's record: one per day, kind and source. */
export const rateId = (date: string, kind: RateKind, source: Rate["source"]) => `r-${date}-${kind}-${source}`;
