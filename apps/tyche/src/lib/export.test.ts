import { describe, expect, it } from "vitest";

import { decimal, text, transactionsCsv } from "./export";
import type { Account, Category, Transaction } from "./model";

const account = { id: "a1", name: "Galicia", currency: "ARS" } as Account;
const category = { id: "c1", name: "Groceries" } as Category;
const lookups = {
  accountOf: (id: string) => (id === "a1" ? account : undefined),
  categoryOf: (id: string | null) => (id === "c1" ? category : undefined),
};
const transaction = (over: Partial<Transaction>) =>
  ({ id: "t", accountId: "a1", date: "2026-11-03", amount: -9430, categoryId: "c1", payee: "Coto", note: "", status: "cleared", transferId: null, ...over }) as Transaction;

describe("transactionsCsv", () => {
  it("starts with the byte order mark and a header, and ends lines with CRLF", () => {
    const csv = transactionsCsv([transaction({})], lookups);
    expect(csv.startsWith("﻿Date,Account,Currency,Amount,Category,Payee,Note,Status,Transfer\r\n")).toBe(true);
    expect(csv.split("\r\n")).toEqual(["﻿Date,Account,Currency,Amount,Category,Payee,Note,Status,Transfer", "2026-11-03,Galicia,ARS,-94.30,Groceries,Coto,,cleared,", ""]);
  });

  it("quotes commas, quotes and line breaks, doubling quotes", () => {
    const csv = transactionsCsv([transaction({ payee: 'Café, "Alto"', note: "one\ntwo" })], lookups);
    expect(csv).toContain('"Café, ""Alto""","one\ntwo"');
  });

  it("keeps typed text from running as a formula in a spreadsheet, but not amounts", () => {
    expect(text("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(text("+54 11")).toBe("'+54 11");
    expect(text("@home")).toBe("'@home");
    expect(text("Coto")).toBe("Coto");
    expect(decimal(-9430)).toBe("-94.30");
  });

  it("marks a transfer", () => {
    const csv = transactionsCsv([transaction({ transferId: "x", categoryId: null, amount: 100000 })], lookups);
    expect(csv).toContain("2026-11-03,Galicia,ARS,1000.00,,Coto,,cleared,yes");
  });

  it("writes only the header for nothing", () => {
    expect(transactionsCsv([], lookups).split("\r\n")).toHaveLength(2);
  });
});

describe("decimal", () => {
  it("writes cents as a dotted decimal", () => {
    expect(decimal(-9430)).toBe("-94.30");
    expect(decimal(5)).toBe("0.05");
    expect(decimal(-5)).toBe("-0.05");
    expect(decimal(0)).toBe("0.00");
  });
});
