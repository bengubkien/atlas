"use client";

import { ArrowLeftRight, FileText, LayoutGrid, ListFilter, Plus, Target } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@atlas/ui/components/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@atlas/ui/components/dropdown-menu";
import { Panel, PanelEmpty, PanelList } from "@atlas/ui/components/panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@atlas/ui/components/tabs";

import { GoalDialog } from "@/components/goal-form";
import { TransactionRow } from "@/components/transaction-row";
import { monthOf } from "@/lib/dates";
import type { Money } from "@/lib/local/hooks";
import type { Account, Category, Goal, Recurring, Transaction } from "@/lib/model";

import { BudgetBoard } from "./board";
import { GoalCard } from "./goal-card";
import { MonthControl, useQueryParam } from "./month";
import { SummaryTab } from "./summary-tab";

const trigger = "inline-flex items-center gap-2 whitespace-nowrap";

/** "My finances": the tabs under the cards, with the account filter and the month at the right. */
export function Finances({
  accounts,
  categories,
  recurring,
  transactions,
  goals,
  money,
  month,
  today,
}: {
  accounts: Account[];
  categories: Category[];
  recurring: Recurring[];
  transactions: Transaction[];
  goals: Goal[];
  money: Money;
  month: string;
  today: string;
}) {
  const [accountParam, setAccountParam] = useQueryParam("account");
  const [tab, setTab] = useState("board");
  const [adding, setAdding] = useState(false);

  // An account that's gone (deleted on another device) just means no filter.
  const picked = accounts.find((account) => account.id === accountParam);
  const visibleAccounts = picked ? [picked] : accounts;
  const visible = picked ? transactions.filter((transaction) => transaction.accountId === picked.id) : transactions;
  const visibleGoals = picked ? goals.filter((goal) => goal.accountId === picked.id) : goals;
  const inMonth = visible.filter((transaction) => monthOf(transaction.date) === month);

  return (
    <section aria-labelledby="finances-title">
      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-1 border-b border-line">
          <h2 id="finances-title" className="order-1 pt-2.5 pb-3 font-serif text-[22px] leading-tight">
            My finances
          </h2>
          <TabsList className="order-3 w-full flex-nowrap! gap-x-4 overflow-x-auto sm:gap-x-5 border-b-0 lg:order-2 lg:w-auto lg:gap-x-6">
            <TabsTrigger value="summary">
              <span className={trigger}>
                <FileText size={15} className="hidden sm:block" aria-hidden="true" /> Summary
              </span>
            </TabsTrigger>
            <TabsTrigger value="board">
              <span className={trigger}>
                <LayoutGrid size={15} className="hidden sm:block" aria-hidden="true" /> Budget board
              </span>
            </TabsTrigger>
            <TabsTrigger value="transactions">
              <span className={trigger}>
                <ArrowLeftRight size={15} className="hidden sm:block" aria-hidden="true" /> Transactions
              </span>
            </TabsTrigger>
            <TabsTrigger value="goals">
              <span className={trigger}>
                <Target size={15} className="hidden sm:block" aria-hidden="true" /> Goals
              </span>
            </TabsTrigger>
          </TabsList>
          <div className="order-2 mb-2 ml-auto flex items-center gap-2 lg:order-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="lg" aria-label={picked ? `Filter: ${picked.name}` : "Filter"}>
                  <ListFilter size={16} aria-hidden="true" />
                  <span className="max-w-[9rem] truncate">{picked ? picked.name : "Filter"}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuRadioGroup value={picked?.id ?? "all"} onValueChange={(value) => setAccountParam(value === "all" ? null : value)}>
                  <DropdownMenuRadioItem value="all">All accounts</DropdownMenuRadioItem>
                  {accounts.map((account) => (
                    <DropdownMenuRadioItem key={account.id} value={account.id}>
                      {account.name}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <MonthControl />
          </div>
        </div>

        <TabsContent value="summary" className="pt-5">
          <SummaryTab accounts={visibleAccounts} categories={categories} transactions={visible} money={money} month={month} today={today} />
        </TabsContent>
        <TabsContent value="board" className="pt-5">
          <BudgetBoard
            accounts={accounts}
            categories={categories}
            recurring={recurring}
            transactions={visible}
            goals={visibleGoals}
            allTransactions={transactions}
            month={month}
            today={today}
          />
        </TabsContent>
        <TabsContent value="transactions" className="pt-5">
          <Panel
            title="This month"
            count={inMonth.length}
            action={
              <Link href="/transactions" className="text-sm text-muted hover:text-ink">
                See all
              </Link>
            }
          >
            {inMonth.length === 0 ? (
              <PanelEmpty>Nothing this month.</PanelEmpty>
            ) : (
              <PanelList>
                {inMonth.slice(0, 20).map((transaction) => (
                  <TransactionRow
                    key={transaction.id}
                    transaction={transaction}
                    account={accounts.find((account) => account.id === transaction.accountId)}
                    category={categories.find((category) => category.id === transaction.categoryId)}
                    today={today}
                  />
                ))}
              </PanelList>
            )}
          </Panel>
        </TabsContent>
        <TabsContent value="goals" className="pt-5">
          <div className="flex flex-col items-start gap-4">
            {visibleGoals.length === 0 ? (
              <p className="text-sm text-muted">No goals yet.</p>
            ) : (
              <ul className="grid w-full gap-4 md:grid-cols-2 xl:grid-cols-3">
                {visibleGoals.map((goal) => (
                  <li key={goal.id} className="flex [&>a]:flex-1">
                    <GoalCard goal={goal} account={accounts.find((account) => account.id === goal.accountId)} transactions={transactions} today={today} />
                  </li>
                ))}
              </ul>
            )}
            <Button variant="secondary" size="lg" onClick={() => setAdding(true)}>
              <Plus size={16} aria-hidden="true" />
              Add a goal
            </Button>
            <GoalDialog open={adding} onOpenChange={setAdding} />
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}
