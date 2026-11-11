"use client";

import { Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";

import { BackLink } from "@atlas/ui/components/back-link";
import { Badge } from "@atlas/ui/components/badge";
import { Button } from "@atlas/ui/components/button";
import { LineChart } from "@atlas/ui/components/charts";
import { PageBody, PageHeader } from "@atlas/ui/components/page-header";
import { Panel, PanelEmpty, PanelList } from "@atlas/ui/components/panel";
import { formatDate } from "@atlas/ui/format";

import { ACCOUNT_TYPE_NAMES, AccountDialog } from "@/components/account-form";
import { committed } from "@/components/cuotas";
import { HoldingsPanel, ValueDialog, ValueLine } from "@/components/investments";
import { Loading } from "@/components/loading";
import { Amount, useDateFormat } from "@/components/money";
import { TransactionRow, useLookups } from "@/components/transaction-row";
import { TransactionDialog } from "@/components/transaction-form";
import { addDays, datesBetween } from "@/lib/dates";
import { useMoney, useRecurring, useTransactions, useValuations } from "@/lib/local/hooks";
import { useLocale } from "@/lib/locale";
import { formatCents } from "@/lib/money";
import type { Account, AccountType, Currency, Recurring, Transaction, Valuation } from "@/lib/model";
import { accountBalance, balanceBook } from "@/lib/summary";

export type AccountsPageProps = {
  types: AccountType[];
  title: string;
  description: string;
  defaultType: AccountType;
};

/** One of the three account pages: its accounts, or one account when `?a=` names it. */
export function AccountsPage(props: AccountsPageProps) {
  return (
    <Suspense fallback={<Loading />}>
      <Accounts {...props} />
    </Suspense>
  );
}

function Accounts({ types, title, description, defaultType }: AccountsPageProps) {
  const params = useSearchParams();
  const lookups = useLookups();
  const transactions = useTransactions();
  const valuations = useValuations();
  const recurring = useRecurring();
  const money = useMoney();
  const [adding, setAdding] = useState(false);
  const addParam = params.get("add");

  // The transaction form links here (?add=1) when there are no accounts yet:
  // the dialog is open while the address says so, and closing takes it out.
  const router = useRouter();
  const pathname = usePathname();
  const addOpen = adding || addParam === "1";
  const setAddOpen = (open: boolean) => {
    setAdding(open);
    if (open || addParam !== "1") return;
    const next = new URLSearchParams(params);
    next.delete("add");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  if (!lookups.ready || !transactions || !valuations || !recurring || !money) return <Loading />;

  const own = lookups.accounts.filter((account) => types.includes(account.type));
  const picked = params.get("a");
  const account = picked ? own.find((candidate) => candidate.id === picked) : undefined;

  if (account) return <AccountView account={account} transactions={transactions} valuations={valuations} recurring={recurring} backHref={pathname} backLabel={title} />;

  return (
    <>
      <PageHeader
        title={title}
        description={description}
        actions={
          <Button onClick={() => setAddOpen(true)}>
            <Plus size={16} aria-hidden="true" /> Add account
          </Button>
        }
      />
      <PageBody>
        <Overview accounts={own} transactions={transactions} valuations={valuations} />
        {own.length === 0 ? (
          <Panel title="Accounts">
            <PanelEmpty>No accounts here yet. Add one to start counting what you have.</PanelEmpty>
          </Panel>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {own.map((each) => (
              <AccountCard key={each.id} account={each} transactions={transactions} valuations={valuations} recurring={recurring} />
            ))}
          </ul>
        )}
      </PageBody>
      <AccountDialog open={addOpen} onOpenChange={setAddOpen} defaultType={defaultType} />
    </>
  );
}

/** The total in the display currency, and what each currency holds on its own. */
function Overview({ accounts, transactions, valuations }: { accounts: Account[]; transactions: Transaction[]; valuations: Valuation[] }) {
  const money = useMoney();
  const lookups = useLookups();
  const locale = useLocale();
  if (!money) return null;
  const live = accounts.filter((account) => !account.archived);
  if (live.length === 0) return null;

  const display = money.settings.displayCurrency;
  let total = 0;
  let missing = 0;
  const per = new Map<Currency, number>();
  for (const account of live) {
    const balance = accountBalance(account, transactions, undefined, valuations);
    per.set(account.currency, (per.get(account.currency) ?? 0) + balance);
    const converted = money.convert(balance, account.currency, lookups.today);
    if (converted === null) missing++;
    else total += converted;
  }
  const split = [...per].map(([currency, cents]) => formatCents(cents, currency, locale, { whole: true })).join(" · ");

  return (
    <section aria-label="Total" className="flex flex-col gap-1 rounded-panel border border-line-card bg-card px-4 py-4 lg:px-6 lg:py-5">
      <span className="text-meta text-muted">Total, in {display === "USD" ? "dollars" : "pesos"}</span>
      <Amount cents={total} currency={display} className="font-serif text-[34px] leading-tight" />
      {per.size > 1 && <span className="text-meta text-muted tabular-nums">{split}</span>}
      {missing > 0 && <span className="text-meta text-muted">Some accounts aren&apos;t counted: there&apos;s no exchange rate yet. Settings has one to fetch or type.</span>}
    </section>
  );
}

function AccountCard({ account, transactions, valuations, recurring }: { account: Account; transactions: Transaction[]; valuations: Valuation[]; recurring: Recurring[] }) {
  const money = useMoney();
  const lookups = useLookups();
  const pathname = usePathname();
  const balance = accountBalance(account, transactions, undefined, valuations);
  const ahead = account.type === "card" ? committed(recurring, account.id, lookups.today).amount : 0;
  const converted = money && money.settings.displayCurrency !== account.currency ? money.convert(balance, account.currency, lookups.today) : null;
  return (
    <li>
      <Link
        href={`${pathname}?a=${encodeURIComponent(account.id)}`}
        scroll={false}
        className={`flex h-full min-h-28 flex-col justify-between gap-3 rounded-panel border border-line-card bg-card px-4 py-4 hover:bg-hover lg:px-5 ${account.archived ? "opacity-60" : ""}`}
      >
        <span className="flex flex-col gap-0.5">
          <span className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-medium">{account.name}</span>
            {account.archived && <Badge>Archived</Badge>}
          </span>
          <span className="text-meta text-muted">{ACCOUNT_TYPE_NAMES[account.type]}</span>
        </span>
        <span className="flex flex-col">
          <span className="flex items-baseline gap-2">
            <Amount cents={balance} currency={account.currency} className="font-serif text-[26px] leading-tight" />
            {balance < 0 && <span className="text-meta text-muted">Owed</span>}
          </span>
          {converted !== null && money && <Amount cents={converted} currency={money.settings.displayCurrency} className="text-meta text-muted" />}
          {ahead > 0 && (
            <span className="text-meta text-muted">
              <Amount cents={ahead} currency={account.currency} whole /> in cuotas ahead
            </span>
          )}
        </span>
      </Link>
    </li>
  );
}

const SHOWN = 100;

function AccountView({ account, transactions, valuations, recurring, backHref, backLabel }: { account: Account; transactions: Transaction[]; valuations: Valuation[]; recurring: Recurring[]; backHref: string; backLabel: string }) {
  const lookups = useLookups();
  const locale = useLocale();
  const date = useDateFormat();
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [more, setMore] = useState(false);
  const [valuing, setValuing] = useState(false);
  const { today } = lookups;

  const mine = useMemo(() => transactions.filter((transaction) => transaction.accountId === account.id), [transactions, account.id]);
  const balance = accountBalance(account, transactions, undefined, valuations);
  const investment = account.type === "investment";
  const latest = investment ? balanceBook([account], [], valuations).latestValue(account.id) : undefined;
  const ahead = account.type === "card" ? committed(recurring, account.id, today) : null;
  const days = useMemo(() => datesBetween(addDays(today, -89), today), [today]);
  const values = useMemo(() => days.map((day) => (day < account.openingDate ? null : accountBalance(account, transactions, day, valuations))), [days, account, transactions, valuations]);
  const shown = more ? mine : mine.slice(0, SHOWN);

  return (
    <>
      <PageHeader
        before={<BackLink href={backHref} label={backLabel.toLowerCase()} />}
        title={account.name}
        description={`${ACCOUNT_TYPE_NAMES[account.type]}${account.archived ? " · archived" : ""}${account.note ? ` · ${account.note}` : ""}`}
        actions={
          <Button variant="secondary" onClick={() => setEditing(true)}>
            <Pencil size={15} aria-hidden="true" /> Edit
          </Button>
        }
      />
      <PageBody>
        <section aria-label="Balance" className="flex flex-col gap-1">
          <span className="text-meta text-muted">{balance < 0 ? "Owed" : `Balance on ${date(today)}`}</span>
          <Amount cents={balance} currency={account.currency} className="font-serif text-[40px] leading-tight" />
          {investment && (
            <span className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <ValueLine latest={latest} />
              <Button variant="secondary" size="sm" className="min-h-10" onClick={() => setValuing(true)}>
                Update value
              </Button>
            </span>
          )}
          {ahead && ahead.amount > 0 && (
            <Link href="/bills" className="text-meta text-muted underline underline-offset-2 hover:text-ink">
              Committed in cuotas: {formatCents(ahead.amount, account.currency, locale)} over the next {ahead.months} {ahead.months === 1 ? "month" : "months"}
            </Link>
          )}
        </section>

        {investment && <HoldingsPanel account={account} />}

        {mine.length > 0 || latest ? (
          <LineChart
            title="Balance, last 90 days"
            description={`At the end of each day, in ${account.currency === "USD" ? "dollars" : "pesos"}.`}
            labels={days.map((day) => ({ key: day, label: formatDate(day, locale, { year: false }) }))}
            series={[{ name: account.name, values }]}
            format={(value) => formatCents(Math.round(value), account.currency, locale, { whole: true })}
            valueLabel={`Balance (${account.currency})`}
          />
        ) : null}

        <Panel
          title="Transactions"
          count={mine.length}
          action={
            <Button variant="secondary" size="sm" className="min-h-10" onClick={() => setAdding(true)}>
              <Plus size={15} aria-hidden="true" /> Add a transaction here
            </Button>
          }
        >
          {mine.length === 0 ? (
            <PanelEmpty>Nothing here yet.</PanelEmpty>
          ) : (
            <>
              <PanelList>
                {shown.map((transaction) => (
                  <TransactionRow key={transaction.id} transaction={transaction} account={account} category={lookups.categoryOf(transaction.categoryId)} today={today} showAccount={false} />
                ))}
              </PanelList>
              {!more && mine.length > SHOWN && (
                <div className="border-t border-line px-4 py-3 lg:px-6">
                  <Button variant="secondary" size="sm" className="min-h-10" onClick={() => setMore(true)}>
                    Show more ({mine.length - SHOWN})
                  </Button>
                </div>
              )}
            </>
          )}
        </Panel>
      </PageBody>
      {investment && <ValueDialog account={account} today={today} open={valuing} onOpenChange={setValuing} />}
      <AccountDialog open={editing} onOpenChange={setEditing} account={account} />
      <TransactionDialog open={adding} onOpenChange={setAdding} defaults={{ accountId: account.id }} />
    </>
  );
}
