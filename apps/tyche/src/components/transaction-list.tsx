"use client";

import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";

import { Button } from "@atlas/ui/components/button";
import { PageBody, PageHeader } from "@atlas/ui/components/page-header";
import { PanelEmpty } from "@atlas/ui/components/panel";
import { Select } from "@atlas/ui/components/select";

import { addMonths, daysBetween, monthOf } from "@/lib/dates";
import { useMoney, useTransactions } from "@/lib/local/hooks";
import { useLocale } from "@/lib/locale";
import { sum } from "@/lib/money";
import type { Transaction } from "@/lib/model";

import { ExportButton } from "./export-button";
import { Loading } from "./loading";
import { Amount } from "./money";
import { TransactionSearch } from "./search";
import { TransactionDialog } from "./transaction-form";
import { TransactionRow, useLookups } from "./transaction-row";

export type ListKind = "all" | "income" | "expenses" | "pending";

const PAGE = 150;

const COPY: Record<ListKind, { title: string; description: string; file: string }> = {
  all: { title: "All transactions", description: "Everything that came in or went out, newest first.", file: "tyche-transactions" },
  income: { title: "Income", description: "Money that came in. Transfers between your accounts aren't counted.", file: "tyche-income" },
  expenses: { title: "Expenses", description: "Money that went out. Transfers between your accounts aren't counted.", file: "tyche-expenses" },
  pending: { title: "Pending", description: "Bills and pay that haven't gone through yet, soonest first.", file: "tyche-pending" },
};

/** One list of transactions with its filters, totals and day-by-day rows: the four transaction pages share it. */
export function TransactionList({ kind }: { kind: ListKind }) {
  return (
    <Suspense fallback={<Loading />}>
      <List kind={kind} />
    </Suspense>
  );
}

function List({ kind }: { kind: ListKind }) {
  const copy = COPY[kind];
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const locale = useLocale();
  const transactions = useTransactions();
  const money = useMoney();
  const { today, ready, accounts, categories, accountOf } = useLookups();
  const [adding, setAdding] = useState(false);
  const [limit, setLimit] = useState({ key: "", count: PAGE });

  const thisMonth = monthOf(today);
  const m = params.get("m");
  // Pending is about what's waiting, whenever it falls; the others start with this month.
  const month = m === "all" ? null : m && /^\d{4}-\d{2}$/.test(m) ? m : kind === "pending" ? null : thisMonth;
  const accountId = params.get("account") ?? "";
  const categoryId = params.get("category") ?? "";

  const setParam = (name: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const months = useMemo(() => {
    const seen = new Set<string>([thisMonth]);
    if (month) seen.add(month);
    for (const transaction of transactions ?? []) seen.add(monthOf(transaction.date));
    return [...seen].sort().reverse();
  }, [transactions, thisMonth, month]);

  const shown = useMemo(() => {
    const rows = (transactions ?? []).filter((transaction) => {
      if (kind === "income" && (transaction.amount <= 0 || transaction.transferId)) return false;
      if (kind === "expenses" && (transaction.amount >= 0 || transaction.transferId)) return false;
      if (kind === "pending" && transaction.status === "cleared") return false;
      if (month && monthOf(transaction.date) !== month) return false;
      if (accountId && transaction.accountId !== accountId) return false;
      if (categoryId && transaction.categoryId !== categoryId) return false;
      return true;
    });
    return kind === "pending" ? rows.sort((a, b) => a.date.localeCompare(b.date)) : rows;
  }, [transactions, kind, month, accountId, categoryId]);

  const totals = useMemo(() => {
    if (!money) return null;
    const convert = (transaction: Transaction) => {
      const account = accountOf(transaction.accountId);
      return account ? money.convert(transaction.amount, account.currency, transaction.date) : null;
    };
    // Transfers move money between your own accounts: neither in nor out.
    const real = shown.filter((transaction) => !transaction.transferId);
    const incoming = sum(real.filter((transaction) => transaction.amount > 0).map(convert));
    const outgoing = sum(real.filter((transaction) => transaction.amount < 0).map(convert));
    return { in: incoming.total, out: -outgoing.total, missing: incoming.missing + outgoing.missing };
    // accountOf is rebuilt each render; the accounts list is what it reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, money, accounts]);

  if (!transactions || !ready || !money || !totals) return <Loading />;

  const monthName = (value: string) => new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}-01T00:00:00Z`));
  const filtered = Boolean(accountId || categoryId);
  const key = `${kind}|${month}|${accountId}|${categoryId}`;
  const count = limit.key === key ? limit.count : PAGE;
  const visible = shown.slice(0, count);
  const overdue = shown.filter((transaction) => transaction.date < today).length;
  const currency = money.settings.displayCurrency;

  const empty =
    kind === "pending" && !filtered
      ? "Nothing waiting: everything has gone through."
      : `Nothing ${month ? `in ${monthName(month).split(" ")[0]}${month.slice(0, 4) === today.slice(0, 4) ? "" : ` ${month.slice(0, 4)}`}` : "here"}${filtered ? " with these filters" : ""}.`;

  const field = "min-w-0 flex-1 basis-36 sm:flex-none sm:basis-auto";
  const selectClass = "min-h-10 py-1.5 text-sm sm:min-h-9";
  const iconButton = "size-10 px-0 sm:size-9";

  return (
    <>
      <PageHeader
        title={copy.title}
        description={copy.description}
        actions={
          <>
            <TransactionSearch />
            <ExportButton transactions={shown} name={`${copy.file}${month ? `-${month}` : ""}`} />
            {(kind === "income" || kind === "expenses") && (
              <>
                <Button onClick={() => setAdding(true)}>
                  <Plus size={16} aria-hidden="true" />
                  {kind === "income" ? "Add income" : "Add expense"}
                </Button>
                <TransactionDialog open={adding} onOpenChange={setAdding} defaults={{ kind: kind === "income" ? "income" : "expense" }} />
              </>
            )}
          </>
        }
      />
      <PageBody className="gap-5">
        {kind === "pending" && (
          <p className="text-sm text-muted">
            {shown.length === 0 ? "" : overdue === 0 ? `${shown.length} waiting. None is overdue.` : `${shown.length} waiting, ${overdue} of them overdue.`}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex w-full items-center gap-1 sm:w-auto">
            <Button variant="secondary" className={iconButton} aria-label="Earlier month" disabled={!month} onClick={() => month && setParam("m", addMonths(month, -1))}>
              <ChevronLeft size={16} aria-hidden="true" />
            </Button>
            <Select aria-label="Month" className="min-w-0 flex-1 sm:w-44 sm:flex-none" selectClassName={selectClass} value={month ?? "all"} onChange={(event) => setParam("m", event.target.value === thisMonth && kind !== "pending" ? null : event.target.value)}>
              <option value="all">All time</option>
              {months.map((value) => (
                <option key={value} value={value}>
                  {monthName(value)}
                </option>
              ))}
            </Select>
            <Button variant="secondary" className={iconButton} aria-label="Later month" disabled={!month} onClick={() => month && setParam("m", addMonths(month, 1))}>
              <ChevronRight size={16} aria-hidden="true" />
            </Button>
          </div>
          <Select aria-label="Account" className={field} selectClassName={selectClass} value={accountId} onChange={(event) => setParam("account", event.target.value || null)}>
            <option value="">All accounts</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </Select>
          <Select aria-label="Category" className={field} selectClassName={selectClass} value={categoryId} onChange={(event) => setParam("category", event.target.value || null)}>
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1 text-sm">
          <p className="flex flex-wrap gap-x-3 font-medium text-ink">
            {kind !== "expenses" && (
              <span>
                In <Amount cents={totals.in} currency={currency} whole />
              </span>
            )}
            {kind === "all" || kind === "pending" ? <span aria-hidden="true" className="text-muted">·</span> : null}
            {kind !== "income" && (
              <span>
                Out <Amount cents={totals.out} currency={currency} whole />
              </span>
            )}
          </p>
          {totals.missing > 0 && <p className="text-meta text-muted">{totals.missing === 1 ? "One amount has" : `${totals.missing} amounts have`} no exchange rate yet, so it isn&apos;t in these totals.</p>}
        </div>

        {shown.length === 0 ? (
          <div className="rounded-panel border border-line-card bg-card">
            <PanelEmpty>{empty}</PanelEmpty>
          </div>
        ) : (
          <>
            {groupByDay(visible).map(([day, rows]) => (
              <section key={day} aria-label={dayHeading(day, today, locale)} className="flex flex-col gap-2">
                <h2 className="px-1 text-meta font-medium text-muted">{dayHeading(day, today, locale)}</h2>
                <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-panel border border-line-card bg-card">
                  {rows.map((transaction) => (
                    <TransactionRow key={transaction.id} transaction={transaction} account={accountOf(transaction.accountId)} category={categories.find((each) => each.id === transaction.categoryId)} today={today} />
                  ))}
                </ul>
              </section>
            ))}
            {shown.length > count && (
              <Button variant="secondary" className="self-center" onClick={() => setLimit({ key, count: count + PAGE })}>
                Show more ({shown.length - count} left)
              </Button>
            )}
          </>
        )}
      </PageBody>
    </>
  );
}

/** Rows grouped by their date, keeping the order they came in. */
function groupByDay(rows: Transaction[]): [string, Transaction[]][] {
  const groups = new Map<string, Transaction[]>();
  for (const row of rows) groups.set(row.date, [...(groups.get(row.date) ?? []), row]);
  return [...groups];
}

/** "Today", "Yesterday", "Tomorrow", else "Tue, Nov 4" (with the year when it isn't this one). */
function dayHeading(day: string, today: string, locale: string): string {
  const away = daysBetween(today, day);
  if (away === 0) return "Today";
  if (away === -1) return "Yesterday";
  if (away === 1) return "Tomorrow";
  return new Intl.DateTimeFormat(locale, { weekday: "short", month: "short", day: "numeric", ...(day.slice(0, 4) !== today.slice(0, 4) ? { year: "numeric" } : {}), timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));
}

