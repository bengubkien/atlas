import { describe, expect, it } from "vitest";

import { converter, rateBook } from "./money";
import type { Account, Category, Goal, Rate, Recurring, Transaction } from "./model";
import { accountBalance, board, categorySpending, dailyBalances, goalSaved, monthFlows, overview } from "./summary";
import { tycheToday } from "./today";
import { DEFAULT_SETTINGS } from "./model";

const account = (id: string, currency: Account["currency"], openingBalance: number, openingDate = "2026-01-01"): Account => ({
  id,
  updatedAt: 1,
  deleted: false,
  name: id,
  type: "bank",
  currency,
  openingBalance,
  openingDate,
  archived: false,
  note: "",
});

let next = 0;
const tx = (accountId: string, date: string, amount: number, fields: Partial<Transaction> = {}): Transaction => ({
  id: `t${next++}`,
  updatedAt: 10,
  deleted: false,
  accountId,
  date,
  amount,
  categoryId: null,
  payee: "",
  note: "",
  status: "cleared",
  recurringId: null,
  dueDate: null,
  transferId: null,
  goalId: null,
  importId: null,
  ...fields,
});

const category = (id: string, group: Category["group"], budget: Category["budget"] = null): Category => ({ id, updatedAt: 1, deleted: false, name: id, group, icon: "circle", budget });
const rate = (date: string, pesos: number): Rate => ({ id: date, updatedAt: 1, deleted: false, date, kind: "mep", pesos, source: "fetched" });

// Pesos at 1,000 a dollar in October, 1,250 from November.
const rates = rateBook([rate("2026-10-01", 100000), rate("2026-11-01", 125000)], "mep");
const toUsd = converter(rates, "USD");
const usd = account("usd", "USD", 500000);
const ars = account("ars", "ARS", 100000000);

describe("balances and flows", () => {
  const transfer = [
    tx("ars", "2026-11-03", -12500000, { transferId: "in" }),
    tx("usd", "2026-11-03", 10000, { id: "in", transferId: "x" }),
  ];
  const transactions = [
    tx("usd", "2026-10-15", 300000),
    tx("usd", "2026-11-01", 645000, { categoryId: "salary" }),
    tx("ars", "2026-11-02", -1250000, { categoryId: "groceries" }),
    tx("usd", "2026-11-04", -5000, { status: "pending", categoryId: "coffee" }),
    tx("usd", "2026-11-20", -125000, { status: "expected", recurringId: "rent", categoryId: "housing" }),
    tx("usd", "2026-11-05", -999, { deleted: true }),
    tx("usd", "2025-12-31", -777, {}),
    ...transfer,
  ];

  it("counts what happened, from the opening day, not what's only expected", () => {
    expect(accountBalance(usd, transactions)).toBe(500000 + 300000 + 645000 - 5000 + 10000);
    expect(accountBalance(usd, transactions, "2026-10-31")).toBe(800000);
  });

  it("leaves transfers out of income and spending, converting each amount on its day", () => {
    const flows = monthFlows([usd, ars], transactions, toUsd, "2026-11");
    expect(flows.income).toBe(645000);
    // 12,500 pesos at 1,250 is $10, plus $50 of coffee.
    expect(flows.spending).toBe(1000 + 5000);
    expect(flows.incomeByDay[0]).toBe(645000);
    expect(flows.spendingByCategory.get("groceries")).toBe(1000);
  });

  it("gives the overview's three numbers, with the change from last month", () => {
    const view = overview([usd, ars], transactions, toUsd, "2026-11", "2026-11-06");
    // Oct 31: $8,000, and 1,000,000 pesos at 1,000 a dollar: $9,000.
    expect(view.balance.startOfMonth).toBe(800000 + 100000);
    expect(view.income.previous).toBe(300000);
    expect(view.income.change).toBeCloseTo(645000 / 300000 - 1);
    expect(view.spending.shareOfIncome).toBeCloseTo(6000 / 645000);
    expect(view.balance.byDay).toHaveLength(6);
    expect(view.missing).toBe(0);
  });

  it("draws the month's balance day by day, with an account opened mid-month from its day", () => {
    const late = account("late", "USD", 20000, "2026-11-04");
    const days = dailyBalances([usd, late], [tx("usd", "2026-11-02", -10000), tx("late", "2026-11-05", 5000)], toUsd, "2026-11", "2026-11-06");
    expect(days.map((d) => d.total)).toEqual([500000, 490000, 490000, 510000, 515000, 515000]);
  });

  it("says when amounts couldn't be converted", () => {
    const view = overview([usd, ars], transactions, converter(rateBook([], "mep"), "USD"), "2026-11", "2026-11-06");
    expect(view.missing).toBeGreaterThan(0);
  });
});

describe("the budget board", () => {
  const categories = [category("housing", "bills"), category("groceries", "daily", { amount: 30000, currency: "USD" }), category("salary", "income")];
  const today = "2026-11-06";
  const transactions = [
    tx("usd", "2026-11-01", -125000, { recurringId: "rent", categoryId: "housing", id: "rent" }),
    tx("usd", "2026-11-03", -12800, { status: "expected", recurringId: "power", id: "power-late" }),
    tx("usd", "2026-11-10", -6999, { status: "expected", categoryId: "housing", id: "internet" }),
    tx("usd", "2026-10-31", -12800, { status: "expected", recurringId: "power", id: "older-late" }),
    tx("usd", "2026-11-02", -9430, { categoryId: "groceries", id: "food" }),
    tx("usd", "2026-11-05", -850, { id: "coffee" }),
    tx("usd", "2026-11-01", 645000, { id: "pay" }),
    tx("usd", "2026-11-28", 120000, { status: "expected", id: "invoice" }),
    tx("usd", "2026-11-04", 50000, { id: "to-goal", goalId: "g" }),
    tx("usd", "2026-12-01", -125000, { status: "expected", recurringId: "rent", id: "next-rent" }),
  ];

  it("puts overdue bills first, then due ones, then paid; spending newest first; expected pay first", () => {
    const columns = board(transactions, categories, [], "2026-11", today);
    expect(columns.bills.map((t) => t.id)).toEqual(["power-late", "internet", "rent"]);
    expect(columns.daily.map((t) => t.id)).toEqual(["coffee", "food"]);
    expect(columns.income.map((t) => t.id)).toEqual(["invoice", "pay"]);
  });

  it("weighs categories against their budgets in the display currency", () => {
    const rows = categorySpending(monthFlows([usd], transactions, toUsd, "2026-11"), categories, rates, "USD", today);
    expect(rows.find((row) => row.category?.id === "groceries")).toMatchObject({ spent: 9430, budget: 30000 });
    expect(rows.find((row) => row.category === null)?.spent).toBe(850);
  });

  it("adds up a goal from its start and what's been put in", () => {
    const goal: Goal = { id: "g", updatedAt: 1, deleted: false, name: "Japan", kind: "travel", accountId: "usd", target: 500000, startAmount: 160000, startDate: "2026-01-01", targetDate: "2026-12-01", note: "" };
    expect(goalSaved(goal, transactions)).toBe(210000);
  });
});

describe("Today", () => {
  it("lists overdue bills first, then bills due soon, late pay and categories over budget", () => {
    const now = new Date(2026, 10, 6, 12).getTime();
    const rent: Recurring = {
      id: "rent",
      updatedAt: 5,
      deleted: false,
      name: "Rent",
      accountId: "usd",
      categoryId: null,
      amount: -125000,
      estimated: false,
      frequency: "monthly",
      start: "2026-01-08",
      end: null,
      autopay: false,
      note: "",
    };
    const report = tycheToday(
      {
        accounts: [usd],
        categories: [category("groceries", "daily", { amount: 5000, currency: "USD" })],
        transactions: [
          tx("usd", "2026-11-01", -12800, { status: "expected", payee: "Electric", id: "power" }),
          tx("usd", "2026-11-04", 120000, { status: "expected", payee: "Design invoice", id: "invoice" }),
          tx("usd", "2026-11-02", -9430, { categoryId: "groceries" }),
          // Rent for October was paid; the server has it.
          tx("usd", "2026-10-08", -125000, { recurringId: "rent", id: "o-rent-2026-10-08", dueDate: "2026-10-08" }),
        ],
        recurring: [rent],
        rates: [],
        settings: DEFAULT_SETTINGS,
      },
      "en-US",
      now,
    );
    expect(report.summary).toBe("1 bill overdue.");
    expect(report.items.map((item) => [item.title, item.tone ?? ""])).toEqual([
      ["Electric", "overdue"],
      // November's rent, made from the recurring item: no phone has made it yet.
      ["Rent", "soon"],
      ["Design invoice", ""],
      ["groceries over budget", ""],
    ]);
    expect(report.items[0]!.detail).toBe("$128.00, 5 days overdue");
    expect(report.items[0]!.href).toBe("/transactions?t=power");
    expect(report.items[1]!.detail).toBe("$1,250.00, due Nov 8");
  });
});
