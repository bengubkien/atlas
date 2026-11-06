"use client";

import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { CommandPalette, SearchButton, useCommandShortcut, type CommandResult } from "@atlas/ui/components/command-palette";

import { useTransactions } from "@/lib/local/hooks";
import type { Transaction } from "@/lib/model";

import { Amount, useDateFormat } from "./money";
import { useLookups } from "./transaction-row";

const LIMIT = 30;
const RECENT = 8;

/** Lower case with the accents taken off, so "cafe" finds "Café". */
const plain = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** "Search transactions…": the box in a page's bar, ⌘K or Ctrl+K anywhere, and the palette it opens. */
export function TransactionSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();
  const pathname = usePathname();
  const transactions = useTransactions();
  const { accountOf, categoryOf } = useLookups();
  const date = useDateFormat();

  useCommandShortcut(() => setOpen(true));

  const found = useMemo(() => {
    if (!transactions) return [];
    const words = plain(query).split(/\s+/).filter(Boolean);
    if (words.length === 0) return transactions.slice(0, RECENT);
    const out: Transaction[] = [];
    for (const transaction of transactions) {
      const abs = Math.abs(transaction.amount);
      const haystack = plain(
        [transaction.payee, transaction.note, categoryOf(transaction.categoryId)?.name, accountOf(transaction.accountId)?.name, `${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`].join("\n"),
      );
      // "94,30" is the same amount as "94.30".
      if (words.every((word) => haystack.includes(/^[\d.,]+$/.test(word) ? word.replace(",", ".") : word))) out.push(transaction);
      if (out.length === LIMIT) break;
    }
    return out;
    // The lookups are rebuilt each render but only change with the data they read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, query]);

  const results: CommandResult[] = found.map((transaction) => {
    const account = accountOf(transaction.accountId);
    const category = categoryOf(transaction.categoryId);
    return {
      id: transaction.id,
      title: transaction.payee || category?.name || (transaction.transferId ? "Transfer" : transaction.amount > 0 ? "Income" : "Expense"),
      meta: [date(transaction.date), account?.name, category?.name].filter(Boolean).join(" · "),
      aside: account && <Amount cents={transaction.amount} currency={account.currency} sign />,
      onSelect: () => {
        // Read at the moment of choosing, so this needs no Suspense around it.
        const next = new URLSearchParams(window.location.search);
        next.set("t", transaction.id);
        router.push(`${pathname}?${next}`, { scroll: false });
      },
    };
  });

  return (
    <>
      <SearchButton label="Search transactions…" onClick={() => setOpen(true)} />
      <CommandPalette
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery("");
        }}
        label="Search transactions"
        placeholder="Search by name, note, category or amount"
        query={query}
        onQueryChange={setQuery}
        results={results}
        empty="No transaction matches that."
      />
    </>
  );
}
