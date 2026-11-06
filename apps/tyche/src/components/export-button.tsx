"use client";

import { Download } from "lucide-react";

import { Button } from "@atlas/ui/components/button";

import { transactionsCsv } from "@/lib/export";
import type { Transaction } from "@/lib/model";

import { useLookups } from "./transaction-row";

/**
 * "Export": the transactions a screen shows, as a CSV file for a
 * spreadsheet. Below `sm` only the icon shows.
 */
export function ExportButton({ transactions, name }: { transactions: Transaction[]; name: string }) {
  const { accountOf, categoryOf } = useLookups();
  const empty = transactions.length === 0;

  function download() {
    const csv = transactionsCsv(transactions, { accountOf, categoryOf });
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${name}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <Button variant="secondary" onClick={download} disabled={empty} title={empty ? "Nothing to export here." : undefined} aria-label="Export as CSV" className="size-10 px-0 sm:size-auto sm:px-3">
      <Download size={16} aria-hidden="true" />
      <span className="hidden sm:inline">Export</span>
    </Button>
  );
}
