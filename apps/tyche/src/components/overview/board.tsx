"use client";

import { Banknote, MoreHorizontal, PiggyBank, Receipt, ShoppingBasket, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { cn } from "@atlas/ui/cn";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@atlas/ui/components/dropdown-menu";
import { SegmentedControl } from "@atlas/ui/components/segmented-control";

import { GoalDialog } from "@/components/goal-form";
import { TransactionDialog, type TransactionKind } from "@/components/transaction-form";
import { GROUP_NAMES } from "@/lib/categories";
import type { Account, Category, Goal, Recurring, Transaction } from "@/lib/model";
import { board } from "@/lib/summary";

import { GoalCard } from "./goal-card";
import { TransactionCard } from "./transaction-card";

type ColumnKey = "bills" | "daily" | "goals" | "income";

const COLUMNS: { key: ColumnKey; title: string; short: string; icon: LucideIcon; kind?: TransactionKind; all: string }[] = [
  { key: "bills", title: GROUP_NAMES.bills, short: "Bills", icon: Receipt, kind: "expense", all: "/bills" },
  { key: "daily", title: GROUP_NAMES.daily, short: "Daily", icon: ShoppingBasket, kind: "expense", all: "/transactions/expenses" },
  { key: "goals", title: "Savings goals", short: "Goals", icon: PiggyBank, all: "/goals" },
  { key: "income", title: GROUP_NAMES.income, short: "Income", icon: Banknote, kind: "income", all: "/transactions/income" },
];

const SHOWN = 3;

/** The reference's four columns of cards for a month. On a phone one column shows at a time, picked at the top. */
export function BudgetBoard({
  accounts,
  categories,
  recurring,
  transactions,
  goals,
  allTransactions,
  month,
  today,
}: {
  accounts: Account[];
  categories: Category[];
  recurring: Recurring[];
  /** The month's candidates (already filtered to an account, if one is picked). */
  transactions: Transaction[];
  goals: Goal[];
  /** Everything, for what a goal has saved (money put in counts whatever the filter). */
  allTransactions: Transaction[];
  month: string;
  today: string;
}) {
  const [picked, setPicked] = useState<ColumnKey>("bills");
  const data = board(transactions, categories, goals, month, today);
  const accountOf = (id: string) => accounts.find((account) => account.id === id);
  const categoryOf = (id: string | null) => (id ? categories.find((category) => category.id === id) : undefined);
  const recurringOf = (id: string | null) => (id ? recurring.find((item) => item.id === id) : undefined);

  const cards = (key: ColumnKey) => {
    if (key === "goals") return data.goals.map((goal) => <GoalCard key={goal.id} goal={goal} account={accountOf(goal.accountId)} transactions={allTransactions} today={today} />);
    return data[key].map((transaction) => (
      <TransactionCard
        key={transaction.id}
        transaction={transaction}
        account={accountOf(transaction.accountId)}
        category={categoryOf(transaction.categoryId)}
        recurring={recurringOf(transaction.recurringId)}
        today={today}
      />
    ));
  };

  return (
    <div className="flex flex-col gap-4">
      <SegmentedControl
        aria-label="Column"
        className="w-full md:hidden [&>button]:flex-1"
        options={COLUMNS.map((column) => ({ value: column.key, label: column.short }))}
        value={picked}
        onValueChange={setPicked}
      />
      <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((column) => (
          <Column key={column.key} column={column} cards={cards(column.key)} today={today} className={picked === column.key ? "flex" : "hidden md:flex"} />
        ))}
      </div>
    </div>
  );
}

function Column({ column, cards, today, className }: { column: (typeof COLUMNS)[number]; cards: React.ReactNode[]; today: string; className?: string }) {
  const [adding, setAdding] = useState(false);
  const Icon = column.icon;
  const goals = column.key === "goals";
  return (
    <section aria-label={column.title} className={cn("@container min-w-0 flex-col gap-3 rounded-panel border border-line-card bg-track/50 p-3", className)}>
      <header className="flex min-h-10 items-center justify-between gap-2 px-1">
        <h3 className="flex min-w-0 items-center gap-2 text-sm font-medium">
          <Icon size={16} aria-hidden="true" className="shrink-0 text-muted" />
          <span className="truncate">{column.title}</span>
          <span className="rounded-full bg-track px-2 text-meta text-muted tabular-nums">{cards.length}</span>
        </h3>
        <DropdownMenu>
          <DropdownMenuTrigger aria-label={`${column.title}: more`} className="grid size-10 shrink-0 place-items-center rounded-control text-muted hover:bg-hover hover:text-ink">
            <MoreHorizontal size={18} aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={() => setAdding(true)}>{goals ? "Add a goal" : column.key === "income" ? "Add income" : "Add an expense"}</DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={column.all}>View all</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      {cards.length === 0 ? (
        <p className="px-1 pb-2 text-sm text-muted">{goals ? "No goals yet." : "Nothing this month."}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {cards.slice(0, SHOWN).map((card, index) => (
            <li key={index} className="flex flex-col [&>a]:flex-1">
              {card}
            </li>
          ))}
        </ul>
      )}
      {cards.length > SHOWN && (
        <Link href={column.all} className="px-1 pb-1 text-sm text-muted hover:text-ink">
          View all {cards.length}
        </Link>
      )}
      {goals ? <GoalDialog open={adding} onOpenChange={setAdding} /> : <TransactionDialog open={adding} onOpenChange={setAdding} defaults={{ kind: column.kind, date: today }} />}
    </section>
  );
}
