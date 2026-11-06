"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { PageBody, PageHeader } from "@atlas/ui/components/page-header";

import { Loading } from "@/components/loading";
import { TransactionForm, type TransactionDefaults, type TransactionKind } from "@/components/transaction-form";
import { isDate } from "@/lib/dates";

export default function AddPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Add />
    </Suspense>
  );
}

function Add() {
  const router = useRouter();
  const params = useSearchParams();
  const kind = params.get("kind");
  const date = params.get("date");
  const defaults: TransactionDefaults = {
    ...(kind === "expense" || kind === "income" || kind === "transfer" ? { kind: kind as TransactionKind } : {}),
    ...(date && isDate(date) ? { date } : {}),
  };

  // Back to where Add was opened from; a fresh tab has no history, so Overview.
  const done = () => (window.history.length > 1 ? router.back() : router.replace("/"));

  return (
    <>
      <PageHeader title="Add" />
      <PageBody>
        <div className="rounded-panel border border-line-card bg-card p-4 lg:max-w-xl lg:p-6">
          <TransactionForm defaults={defaults} onDone={done} />
        </div>
      </PageBody>
    </>
  );
}
