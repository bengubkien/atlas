import type { Account, Category, Transaction } from "./model";

// A CSV of transactions, for a spreadsheet. Excel needs the byte order mark
// to read accents as UTF-8, and CRLF line ends; amounts are plain decimals
// with a dot so any locale's spreadsheet can read them.

export const CSV_HEADER = ["Date", "Account", "Currency", "Amount", "Category", "Payee", "Note", "Status", "Transfer"] as const;

/** Cents as a plain decimal: -9430 is "-94.30". Integer maths, so no float noise. */
export function decimal(cents: number): string {
  const abs = Math.abs(cents);
  return `${cents < 0 ? "-" : ""}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** Quotes a field that has a comma, a quote or a line break in it; quotes inside are doubled. */
export function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/**
 * Text you typed (a payee, a note, a name), made safe to open in a
 * spreadsheet: one starting with = + - @ (or a tab or return) would run as a
 * formula there, so it's written after a quote mark, which shows it as text.
 * Matters once statements are imported: their text isn't yours.
 */
export function text(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

export function transactionsCsv(
  transactions: Transaction[],
  { accountOf, categoryOf }: { accountOf: (id: string) => Account | undefined; categoryOf: (id: string | null) => Category | undefined },
): string {
  const rows = transactions.map((transaction) => {
    const account = accountOf(transaction.accountId);
    return [
      transaction.date,
      text(account?.name ?? ""),
      account?.currency ?? "",
      decimal(transaction.amount),
      text(categoryOf(transaction.categoryId)?.name ?? ""),
      text(transaction.payee),
      text(transaction.note),
      transaction.status,
      transaction.transferId ? "yes" : "",
    ];
  });
  const lines = [CSV_HEADER as readonly string[], ...rows].map((row) => row.map(csvField).join(","));
  return `﻿${lines.join("\r\n")}\r\n`;
}
