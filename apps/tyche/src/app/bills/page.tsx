"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { Badge } from "@atlas/ui/components/badge";
import { Button } from "@atlas/ui/components/button";
import { PageBody, PageHeader } from "@atlas/ui/components/page-header";
import { Panel, PanelEmpty, PanelList } from "@atlas/ui/components/panel";
import { toast } from "@atlas/ui/components/toast";

import { CuotaItem } from "@/components/cuotas";
import { Loading } from "@/components/loading";
import { Amount, CategoryLabel, StatusBadge, useDateFormat } from "@/components/money";
import { RecurringDialog } from "@/components/recurring-form";
import { useLookups, useTransactionHref } from "@/components/transaction-row";
import { markDone, markExpected } from "@/lib/actions";
import { addDays } from "@/lib/dates";
import { useRecurring, useTransactions } from "@/lib/local/hooks";
import { useLocale } from "@/lib/locale";
import type { Recurring, Transaction } from "@/lib/model";
import { cuotasLeft, nextDue } from "@/lib/recurring";
import { describeSchedule } from "@/lib/schedule";

export default function BillsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Bills />
    </Suspense>
  );
}

function Bills() {
  const items = useRecurring();
  const transactions = useTransactions();
  const lookups = useLookups();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [adding, setAdding] = useState(false);
  const { today } = lookups;

  if (!items || !transactions || !lookups.ready) return <Loading />;

  const openId = params.get("r");
  const open = openId ? items.find((item) => item.id === openId) : undefined;
  const closeItem = () => {
    const next = new URLSearchParams(params);
    next.delete("r");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const known = new Set(items.map((item) => item.id));
  const until = addDays(today, 30);
  const coming = transactions
    .filter((transaction) => transaction.recurringId && known.has(transaction.recurringId) && transaction.status === "expected" && transaction.date <= until)
    .sort((a, b) => a.date.localeCompare(b.date));

  // Purchases in cuotas have their own panel; they end after the last cuota.
  const plain = items.filter((item) => !item.installments);
  const inCuotas = items.filter((item) => item.installments && cuotasLeft(item, today).count > 0);
  const active = plain.filter((item) => !item.end || item.end >= today);
  const ended = [...plain.filter((item) => item.end && item.end < today), ...items.filter((item) => item.installments && cuotasLeft(item, today).count === 0)];
  const bills = active.filter((item) => item.amount < 0);
  const pay = active.filter((item) => item.amount > 0);

  return (
    <>
      <PageHeader
        title="Recurring bills"
        description="Bills and pay that come back. Each month's appear by themselves, to mark paid."
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus size={16} aria-hidden="true" /> Add
          </Button>
        }
      />
      <PageBody>
        <Panel title="Coming up" count={coming.length}>
          {coming.length === 0 ? (
            <PanelEmpty>{items.length === 0 ? "Nothing yet. Add a bill or pay that comes back, and its dates show up here." : "Nothing due in the next 30 days."}</PanelEmpty>
          ) : (
            <PanelList>
              {coming.map((transaction) => (
                <Occurrence
                  key={transaction.id}
                  transaction={transaction}
                  lookups={lookups}
                  autopay={Boolean(items?.find((item) => item.id === transaction.recurringId)?.autopay)}
                />
              ))}
            </PanelList>
          )}
        </Panel>

        <div className="grid items-start gap-8 lg:grid-cols-2">
          <Panel title="Bills" count={bills.length}>
            {bills.length === 0 ? <PanelEmpty>No bills yet.</PanelEmpty> : <ItemList items={bills} lookups={lookups} />}
          </Panel>
          <Panel title="Pay" count={pay.length}>
            {pay.length === 0 ? <PanelEmpty>No pay yet.</PanelEmpty> : <ItemList items={pay} lookups={lookups} />}
          </Panel>
        </div>

        {inCuotas.length > 0 && (
          <Panel title="In cuotas" count={inCuotas.length}>
            <PanelList>
              {inCuotas.map((item) => (
                <CuotaRow key={item.id} item={item} lookups={lookups} />
              ))}
            </PanelList>
          </Panel>
        )}

        {ended.length > 0 && (
          <Panel title="Ended" count={ended.length}>
            <ItemList items={ended} lookups={lookups} quiet />
          </Panel>
        )}
      </PageBody>

      <RecurringDialog open={adding} onOpenChange={setAdding} />
      {open && <RecurringDialog open onOpenChange={(next) => !next && closeItem()} item={open} />}
    </>
  );
}

type Lookups = ReturnType<typeof useLookups>;

/** One bill or pay coming up. One that pays itself (a direct debit, a cuota) clears on its date, so there's nothing to mark. */
function Occurrence({ transaction, lookups, autopay }: { transaction: Transaction; lookups: Lookups; autopay: boolean }) {
  const href = useTransactionHref();
  const date = useDateFormat();
  const account = lookups.accountOf(transaction.accountId);
  const income = transaction.amount > 0;

  const done = async () => {
    await markDone(transaction, { date: lookups.today });
    toast(income ? `${transaction.payee} received.` : `${transaction.payee} paid.`, { action: { label: "Undo", onClick: () => void markExpected(transaction) } });
  };

  return (
    <li className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 lg:px-6">
      <Link href={href(transaction.id)} scroll={false} className="flex min-w-0 flex-1 basis-48 flex-col gap-0.5 hover:text-muted">
        <span className="truncate text-sm font-medium">{transaction.payee}</span>
        <span className="truncate text-meta text-muted">{[date(transaction.date), transaction.note].filter(Boolean).join(" · ")}</span>
      </Link>
      <StatusBadge transaction={transaction} today={lookups.today} />
      {account && <Amount cents={transaction.amount} currency={account.currency} sign className="text-sm font-medium" />}
      {autopay ? (
        <span className="min-w-[96px] text-right text-meta text-muted">Pays itself</span>
      ) : (
        <Button variant="secondary" size="sm" className="min-h-10" onClick={() => void done()}>
          {income ? "Mark received" : "Mark paid"}
        </Button>
      )}
    </li>
  );
}

function CuotaRow({ item, lookups }: { item: Recurring; lookups: Lookups }) {
  const date = useDateFormat();
  const pathname = usePathname();
  const params = useSearchParams();
  const next = new URLSearchParams(params);
  next.set("r", item.id);
  return <CuotaItem item={item} account={lookups.accountOf(item.accountId)} today={lookups.today} href={`${pathname}?${next}`} date={date} />;
}

function ItemList({ items, lookups, quiet = false }: { items: Recurring[]; lookups: Lookups; quiet?: boolean }) {
  return (
    <PanelList>
      {items.map((item) => (
        <Item key={item.id} item={item} lookups={lookups} quiet={quiet} />
      ))}
    </PanelList>
  );
}

function Item({ item, lookups, quiet }: { item: Recurring; lookups: Lookups; quiet: boolean }) {
  const locale = useLocale();
  const date = useDateFormat();
  const pathname = usePathname();
  const params = useSearchParams();
  const account = lookups.accountOf(item.accountId);
  const category = lookups.categoryOf(item.categoryId);
  const due = quiet ? null : nextDue(item, lookups.today);
  const next = new URLSearchParams(params);
  next.set("r", item.id);
  const meta = [describeSchedule(item, locale), due ? `Next ${date(due)}` : item.end ? `Ended ${date(item.end, { year: true })}` : item.installments ? `${item.installments} cuotas, all paid` : null, account?.name].filter(Boolean).join(" · ");

  return (
    <li>
      <Link href={`${pathname}?${next}`} scroll={false} className="flex min-h-16 items-center gap-3 px-4 py-2.5 hover:bg-hover lg:px-6">
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <CategoryLabel category={category} />
          <span className={quiet ? "truncate text-sm font-medium text-muted" : "truncate text-sm font-medium"}>{item.name}</span>
          <span className="text-meta text-pretty text-muted">{meta}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          {account && (
            <span className="flex items-baseline gap-1.5 text-sm font-medium">
              {item.estimated && <span className="text-meta font-normal text-muted">About</span>}
              <Amount cents={item.amount} currency={account.currency} sign />
            </span>
          )}
          {item.autopay && <Badge>Pays itself</Badge>}
        </span>
      </Link>
    </li>
  );
}
