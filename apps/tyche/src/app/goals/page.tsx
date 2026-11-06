"use client";

import { Plus } from "lucide-react";
import { Suspense, useState } from "react";

import { Button } from "@atlas/ui/components/button";
import { PageBody, PageHeader } from "@atlas/ui/components/page-header";

import { GoalDialog } from "@/components/goal-form";
import { Loading } from "@/components/loading";
import { GoalCard } from "@/components/overview/goal-card";
import { useQueryParam } from "@/components/overview/month";
import { useAccounts, useGoals, useToday, useTransactions } from "@/lib/local/hooks";

export default function GoalsPage() {
  return (
    <Suspense>
      <Goals />
    </Suspense>
  );
}

function Goals() {
  const goals = useGoals();
  const accounts = useAccounts();
  const transactions = useTransactions();
  const today = useToday();
  const [openId, setOpenId] = useQueryParam("g");
  const [adding, setAdding] = useState(false);
  if (!goals || !accounts || !transactions) return <Loading />;

  const opened = openId ? goals.find((goal) => goal.id === openId) : undefined;
  const add = (
    <Button onClick={() => setAdding(true)} disabled={accounts.length === 0}>
      <Plus size={16} aria-hidden="true" />
      Add a goal
    </Button>
  );

  return (
    <>
      <PageHeader title="Savings goals" actions={add} />
      <PageBody>
        {goals.length === 0 ? (
          <div className="flex max-w-[560px] flex-col items-start gap-4 rounded-panel border border-line-card bg-card p-6">
            <p className="text-lead text-muted">
              A goal is something you&apos;re saving for: an emergency fund, a trip, a laptop. Pick the account it&apos;s kept in and a target, and move money into it as you go.
            </p>
            {accounts.length === 0 ? <p className="text-sm text-muted">Add an account first, then come back.</p> : add}
          </div>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {goals.map((goal) => (
              <li key={goal.id} className="flex">
                <div className="min-w-0 flex-1 [&>a]:h-full">
                  <GoalCard goal={goal} account={accounts.find((account) => account.id === goal.accountId)} transactions={transactions} today={today} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </PageBody>
      <GoalDialog open={adding} onOpenChange={setAdding} />
      {opened && <GoalDialog open onOpenChange={(open) => !open && setOpenId(null)} goal={opened} />}
    </>
  );
}
