"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { cn } from "@atlas/ui/cn";

import { CategoryIcon } from "@/lib/icons";
import { useAccounts, useCategories, useToday, useTransactions } from "@/lib/local/hooks";
import type { Account, Category, Transaction } from "@/lib/model";

import { Amount, StatusBadge, useDateFormat } from "./money";
import { TransactionDialog } from "./transaction-form";

/** The address of the current page with a transaction open on it (`?t=`), for links. */
export function useTransactionHref() {
  const pathname = usePathname();
  const params = useSearchParams();
  return (id: string) => {
    const next = new URLSearchParams(params);
    next.set("t", id);
    return `${pathname}?${next}`;
  };
}

/**
 * One transaction in a list: its category's icon, who was paid, the
 * category, account and date, its status and its amount. It opens the
 * transaction (`?t=`) on the same page.
 */
export function TransactionRow({
  transaction,
  account,
  category,
  today,
  showAccount = true,
}: {
  transaction: Transaction;
  account: Account | undefined;
  category: Category | undefined;
  today: string;
  showAccount?: boolean;
}) {
  const href = useTransactionHref();
  const date = useDateFormat();
  const title = transaction.payee || category?.name || (transaction.transferId ? "Transfer" : transaction.amount > 0 ? "Income" : "Expense");
  const meta = [transaction.transferId ? "Transfer" : category?.name, showAccount ? account?.name : null, date(transaction.date), transaction.recurringId && transaction.note.startsWith("Cuota") ? transaction.note : null].filter(Boolean).join(" · ");
  return (
    <li>
      <Link href={href(transaction.id)} scroll={false} className="flex min-h-14 items-center gap-3 px-4 py-2.5 hover:bg-hover lg:px-6">
        <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-track text-muted">
          <CategoryIcon name={transaction.transferId ? "repeat" : category?.icon} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-sm font-medium text-ink">{title}</span>
          <span className="text-meta text-pretty text-muted sm:truncate">{meta}</span>
        </span>
        <span className="hidden sm:block">
          <StatusBadge transaction={transaction} today={today} />
        </span>
        {account && (
          <Amount
            cents={transaction.amount}
            currency={account.currency}
            sign
            className={cn("shrink-0 text-sm font-medium", transaction.status === "expected" ? "text-muted" : "text-ink")}
          />
        )}
      </Link>
    </li>
  );
}

/**
 * Opens the transaction named in the address (`?t=<id>`) in its dialog, on
 * whatever page it's on, and takes it out of the address when closed. In
 * the shell, so Today's links and every list share it.
 */
export function OpenTransaction() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const id = params.get("t");
  const transactions = useTransactions();
  const transaction = id ? transactions?.find((candidate) => candidate.id === id) : undefined;

  const close = () => {
    const next = new URLSearchParams(params);
    next.delete("t");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  if (!id || !transaction) return null;
  return <TransactionDialog open onOpenChange={(open) => !open && close()} transaction={transaction} />;
}

/** Lookups every list needs: accounts and categories by ID, and today. */
export function useLookups() {
  const accounts = useAccounts();
  const categories = useCategories();
  const today = useToday();
  return {
    today,
    ready: Boolean(accounts && categories),
    accounts: accounts ?? [],
    categories: categories ?? [],
    accountOf: (id: string) => accounts?.find((account) => account.id === id),
    categoryOf: (id: string | null) => (id ? categories?.find((category) => category.id === id) : undefined),
  };
}
