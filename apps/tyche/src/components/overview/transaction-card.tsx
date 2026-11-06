"use client";

import { CalendarDays } from "lucide-react";
import Link from "next/link";

import { cn } from "@atlas/ui/cn";

import { Amount, CategoryLabel, StatusBadge, useDateFormat } from "@/components/money";
import { useTransactionHref } from "@/components/transaction-row";
import type { Account, Category, Frequency, Recurring, Transaction } from "@/lib/model";

const FREQUENCY_NAMES: Record<Frequency, string> = { weekly: "Weekly", biweekly: "Every two weeks", monthly: "Monthly", yearly: "Yearly" };

/** A transaction as a card on the board. The whole card opens it (`?t=`). */
export function TransactionCard({
  transaction,
  account,
  category,
  recurring,
  today,
}: {
  transaction: Transaction;
  account: Account | undefined;
  category: Category | undefined;
  recurring: Recurring | undefined;
  today: string;
}) {
  const href = useTransactionHref();
  const date = useDateFormat();
  const expected = transaction.status === "expected";
  const income = transaction.amount > 0;
  const title = transaction.payee || category?.name || (income ? "Income" : "Expense");
  const when = date(transaction.date, { year: false });
  const dateText = expected ? `Due ${when}` : transaction.recurringId && !income ? `Paid ${when}` : when;
  // What the right side of the footer says: the note, else how often it comes back, else where it's from.
  // A cuota's note ("Cuota 3 of 6") is the interesting part of its card.
  const aside = transaction.note || (recurring ? FREQUENCY_NAMES[recurring.frequency] : account?.name);
  return (
    <Link
      href={href(transaction.id)}
      scroll={false}
      className="flex min-w-0 flex-col gap-3 rounded-card border border-line-card bg-card p-4 hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      <span className="flex items-center justify-between gap-2">
        <CategoryLabel category={category} />
        <StatusBadge transaction={transaction} today={today} />
      </span>
      <span className="truncate text-lead text-muted">{title}</span>
      {account && (
        <Amount
          cents={transaction.amount}
          currency={account.currency}
          sign={income}
          className={cn("font-serif text-[28px] leading-none @max-[280px]:text-[22px]", expected && "text-muted")}
        />
      )}
      <span className="flex items-center justify-between gap-3 border-t border-line pt-3 text-meta text-muted">
        <span className="inline-flex shrink-0 items-center gap-1.5">
          <CalendarDays size={14} aria-hidden="true" />
          {dateText}
        </span>
        {aside && <span className="truncate">{aside}</span>}
      </span>
    </Link>
  );
}
