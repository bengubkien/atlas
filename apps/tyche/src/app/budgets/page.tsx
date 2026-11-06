"use client";

import { CalendarDays, Gauge } from "lucide-react";
import { Suspense, useState } from "react";

import { Button } from "@atlas/ui/components/button";
import { FormDialog } from "@atlas/ui/components/form-dialog";
import { Input } from "@atlas/ui/components/input";
import { Meter, type MeterTone } from "@atlas/ui/components/meter";
import { PageBody, PageHeader } from "@atlas/ui/components/page-header";
import { Panel, PanelEmpty } from "@atlas/ui/components/panel";
import { Select } from "@atlas/ui/components/select";
import { StatCard } from "@atlas/ui/components/stat-card";
import { toast } from "@atlas/ui/components/toast";
import { parseMoney } from "@atlas/ui/format";

import { Loading } from "@/components/loading";
import { MonthControl, useMonth, useMonthName } from "@/components/overview/month";
import { saveCategory } from "@/lib/actions";
import { GROUP_NAMES } from "@/lib/categories";
import { CategoryIcon } from "@/lib/icons";
import { useAccounts, useCategories, useMoney, useToday, useTransactions } from "@/lib/local/hooks";
import { useLocale } from "@/lib/locale";
import { convert, formatCents, rateOn } from "@/lib/money";
import { CURRENCIES, type Category, type Currency } from "@/lib/model";
import { monthFlows } from "@/lib/summary";

export default function BudgetsPage() {
  return (
    <Suspense>
      <Budgets />
    </Suspense>
  );
}

function Budgets() {
  const accounts = useAccounts();
  const categories = useCategories();
  const transactions = useTransactions();
  const money = useMoney();
  const today = useToday();
  const locale = useLocale();
  const [month] = useMonth();
  const monthName = useMonthName();
  if (!accounts || !categories || !transactions || !money) return <Loading />;

  const currency = money.settings.displayCurrency;
  const whole = (cents: number) => formatCents(cents, currency, locale, { whole: true });
  // Whole units, unless that would round an overspend to nothing ("Over by $0").
  const overBy = (cents: number) => formatCents(cents, currency, locale, { whole: cents >= 100 });
  const flows = monthFlows(accounts, transactions, money.convert, month);
  const rate = rateOn(money.rates, today);
  const rows = categories
    .filter((category) => category.group !== "income")
    .map((category) => ({
      category,
      spent: flows.spendingByCategory.get(category.id) ?? 0,
      budget: category.budget ? convert(category.budget.amount, category.budget.currency, currency, rate) : null,
    }));
  const budgeted = rows.reduce((total, row) => total + (row.budget ?? 0), 0);
  const spentInBudgeted = rows.reduce((total, row) => total + (row.budget !== null ? row.spent : 0), 0);
  const unconvertible = rows.some((row) => row.category.budget && row.budget === null);

  return (
    <>
      <PageHeader title="Budget limits" description="What you mean to spend each month, by category." actions={<MonthControl />} />
      <PageBody>
        <div className="grid gap-4 md:grid-cols-2">
          <StatCard icon={Gauge} title="Budgeted" value={whole(budgeted)} caption="Added up across your categories" />
          <StatCard
            icon={CalendarDays}
            title={`Spent in ${monthName(month)}`}
            value={whole(flows.spending)}
            caption={budgeted > 0 ? `${whole(spentInBudgeted)} of it in categories with a budget` : "Set a budget below to compare."}
          >
            {budgeted > 0 && <Meter value={spentInBudgeted} max={budgeted} tone={spentInBudgeted > budgeted ? "danger" : "chart-2"} label="Spent against what's budgeted" />}
          </StatCard>
        </div>
        {unconvertible && <p className="text-meta text-muted">Some budgets in pesos have no exchange rate yet, so they&apos;re left out.</p>}
        {(["bills", "daily"] as const).map((group) => {
          const inGroup = rows.filter((row) => row.category.group === group);
          return (
            <Panel key={group} title={GROUP_NAMES[group]} count={inGroup.length}>
              {inGroup.length === 0 ? (
                <PanelEmpty>No categories here.</PanelEmpty>
              ) : (
                <ul className="flex flex-col divide-y divide-line border-t border-line">
                  {inGroup.map((row) => {
                    const over = row.budget !== null && row.spent > row.budget;
                    const share = row.budget ? row.spent / row.budget : 0;
                    const tone: MeterTone = over ? "danger" : share > 0.9 ? "warning" : "chart-2";
                    return (
                      <li key={row.category.id} className="flex flex-col gap-2 px-4 py-3 lg:px-6">
                        <div className="flex items-center justify-between gap-3">
                          <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                            <CategoryIcon name={row.category.icon} className="shrink-0 text-muted" />
                            <span className="truncate">{row.category.name}</span>
                          </span>
                          <BudgetDialog category={row.category} defaultCurrency={currency} />
                        </div>
                        <p className="text-meta text-muted tabular-nums">
                          {row.budget === null ? (
                            <>{row.spent > 0 ? `${whole(row.spent)} spent, no budget` : "No budget"}</>
                          ) : (
                            <>
                              {whole(row.spent)} of {whole(row.budget)}
                              {over && <span className="font-medium text-error"> · Over by {overBy(row.spent - row.budget)}</span>}
                            </>
                          )}
                        </p>
                        {row.budget !== null && <Meter value={row.spent} max={row.budget} tone={tone} size="sm" label={`${row.category.name} spent against its budget`} />}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          );
        })}
      </PageBody>
    </>
  );
}

/** "Edit" or "Set a budget": a category's monthly budget, in pesos or dollars. */
function BudgetDialog({ category, defaultCurrency }: { category: Category; defaultCurrency: Currency }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (form: FormData) => {
    const amount = parseMoney(String(form.get("amount") ?? ""));
    if (typeof amount !== "number" || amount <= 0) return setError("Type an amount above zero, or pick No budget.");
    await saveCategory({ ...category, budget: { amount, currency: String(form.get("currency")) as Currency } });
    toast(`Budget set for ${category.name}.`);
    setOpen(false);
  };
  const clear = async () => {
    await saveCategory({ ...category, budget: null });
    toast(`${category.name} has no budget now.`);
    setOpen(false);
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setError(null);
      }}
      title={category.name}
      description="What you mean to spend on it each month."
      trigger={
        <Button variant="secondary" size="lg" aria-label={`${category.budget ? "Edit" : "Set a budget for"} ${category.name}`}>
          {category.budget ? "Edit" : "Set a budget"}
        </Button>
      }
    >
      <form action={save} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Input
            name="amount"
            label="Each month"
            inputMode="decimal"
            autoComplete="off"
            defaultValue={category.budget ? (category.budget.amount / 100).toFixed(2) : ""}
            autoFocus
          />
          <Select name="currency" label="Currency" defaultValue={category.budget?.currency ?? defaultCurrency}>
            {CURRENCIES.map((currency) => (
              <option key={currency} value={currency}>
                {currency === "ARS" ? "Pesos (ARS)" : "Dollars (USD)"}
              </option>
            ))}
          </Select>
        </div>
        {error && (
          <p role="alert" className="text-label text-error">
            {error}
          </p>
        )}
        <div className="flex items-center justify-between gap-3">
          {category.budget ? (
            <Button variant="danger-text" onClick={() => void clear()}>
              No budget
            </Button>
          ) : (
            <span />
          )}
          <Button type="submit" size="lg">
            Save
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}
