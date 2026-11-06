"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@atlas/ui/components/button";
import { PageBody, PageHeader } from "@atlas/ui/components/page-header";

import { AccountDialog } from "@/components/account-form";
import { ExportButton } from "@/components/export-button";
import { Loading } from "@/components/loading";
import { TransactionSearch } from "@/components/search";
import { monthOf } from "@/lib/dates";
import { useAccounts, useCategories, useGoals, useMoney, useRecurring, useToday, useTransactions } from "@/lib/local/hooks";
import { overview } from "@/lib/summary";

import { SummaryCards } from "./cards";
import { Finances } from "./finances";
import { useMonth, useMonthName } from "./month";

/** The overview: the month's three numbers over "My finances". */
export function OverviewScreen() {
  const accounts = useAccounts();
  const categories = useCategories();
  const transactions = useTransactions();
  const recurring = useRecurring();
  const goals = useGoals();
  const money = useMoney();
  const today = useToday();
  const [month] = useMonth();
  const monthName = useMonthName();
  const [adding, setAdding] = useState(false);
  if (!accounts || !categories || !transactions || !recurring || !goals || !money) return <Loading />;

  const firstRun = accounts.length === 0;
  const numbers = overview(accounts, transactions, money.convert, month, today);

  return (
    <>
      <PageHeader
        title="Financial overview"
        description={`${monthName(month)} income, spending, savings and goals.`}
        actions={
          <>
            <TransactionSearch />
            <ExportButton transactions={transactions.filter((transaction) => monthOf(transaction.date) === month)} name={`tyche-${month}`} />
          </>
        }
      />
      <PageBody>
        {firstRun ? (
          <section className="flex max-w-[560px] flex-col items-start gap-3 rounded-panel border border-line-card bg-card p-6">
            <h2 className="font-serif text-[22px] leading-tight">Start with an account</h2>
            <p className="text-sm text-muted">An account is where money is: a bank account, a card, cash or a wallet. Add one and its balance, and the rest of this page fills in as you add what you spend and earn.</p>
            <AccountDialog open={adding} onOpenChange={setAdding} trigger={<Button size="lg">Add an account</Button>} />
          </section>
        ) : (
          <>
            <div className="flex flex-col gap-3">
              <SummaryCards overview={numbers} currency={money.settings.displayCurrency} month={month} />
              {numbers.missing > 0 && (
                <p className="text-meta text-muted">
                  Some amounts in pesos have no exchange rate yet, so they&apos;re left out.{" "}
                  <Link href="/settings" className="underline underline-offset-2 hover:text-ink">
                    Add a rate
                  </Link>
                </p>
              )}
            </div>
            <Finances accounts={accounts} categories={categories} recurring={recurring} transactions={transactions} goals={goals} money={money} month={month} today={today} />
          </>
        )}
      </PageBody>
    </>
  );
}
