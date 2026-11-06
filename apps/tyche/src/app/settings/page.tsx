"use client";

import { Download, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@atlas/ui/components/button";
import { PageBody, PageHeader } from "@atlas/ui/components/page-header";
import { Panel, PanelEmpty } from "@atlas/ui/components/panel";
import { SegmentedControl } from "@atlas/ui/components/segmented-control";
import { toast } from "@atlas/ui/components/toast";

import { CategoryDialog } from "@/components/category-form";
import { Loading } from "@/components/loading";
import { Amount, useDateFormat } from "@/components/money";
import { RATE_NAMES, RateDialog } from "@/components/rate-form";
import { SyncStatus } from "@/components/sync-status";
import { saveSettings } from "@/lib/actions";
import { GROUP_NAMES } from "@/lib/categories";
import { CategoryIcon } from "@/lib/icons";
import { thisDevice } from "@/lib/local/device";
import { useCategories, useRates, useSettings, useToday } from "@/lib/local/hooks";
import { rateBook } from "@/lib/money";
import { CATEGORY_GROUPS, RATE_KINDS, type Category, type CategoryGroup, type Currency, type RateKind } from "@/lib/model";

const RATE_HINTS: Record<RateKind, string> = {
  mep: "MEP: the dollar bought legally through the stock market.",
  blue: "Blue: the dollar sold on the informal market.",
  official: "Official: the bank's price, the one the state sets.",
};

const SOURCES = { fetched: "From DolarApi", typed: "Typed in" } as const;

export default function SettingsPage() {
  const settings = useSettings();
  const rates = useRates();
  const categories = useCategories();
  const today = useToday();
  const date = useDateFormat();
  const [typing, setTyping] = useState(false);
  const [editing, setEditing] = useState<{ category?: Category; group?: CategoryGroup } | null>(null);

  const books = useMemo(() => (rates ? RATE_KINDS.map((kind) => rateBook(rates, kind)) : []), [rates]);

  if (!rates || !categories) return <Loading />;

  const chosen = books.find((book) => book.kind === settings.rateKind)!;
  const recent = chosen.days.slice(-10).reverse();

  const exportAll = async () => {
    const data = { app: "tyche", exportedAt: new Date().toISOString(), ...(await thisDevice().exportAll()) };
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    link.download = `tyche-${today}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast("Exported.");
  };

  const row = (id: string, title: string, hint: React.ReactNode, control: React.ReactNode) => (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-col gap-0.5">
        <span id={id} className="text-sm font-medium">
          {title}
        </span>
        <span className="text-meta text-muted">{hint}</span>
      </div>
      {control}
    </div>
  );

  return (
    <>
      <PageHeader title="Settings" description="The same on every device you use Tyche on." />
      <PageBody className="max-w-[720px]">
        <Panel title="Money">
          <div className="flex flex-col gap-5 border-t border-line px-4 py-5 lg:px-6">
            {row(
              "display-currency",
              "Show totals in",
              "Each amount is changed at the rate of its own day.",
              <SegmentedControl<Currency>
                aria-labelledby="display-currency"
                value={settings.displayCurrency}
                onValueChange={(displayCurrency) => void saveSettings({ displayCurrency })}
                options={[
                  { value: "USD", label: "Dollars" },
                  { value: "ARS", label: "Pesos" },
                ]}
              />,
            )}
            {row(
              "rate-kind",
              "Rate",
              "Which dollar to use when changing pesos and dollars.",
              <SegmentedControl<RateKind>
                aria-labelledby="rate-kind"
                value={settings.rateKind}
                onValueChange={(rateKind) => void saveSettings({ rateKind })}
                options={RATE_KINDS.map((kind) => ({ value: kind, label: RATE_NAMES[kind] }))}
              />,
            )}
            <ul className="flex flex-col gap-1 text-meta text-muted">
              {RATE_KINDS.map((kind) => (
                <li key={kind}>{RATE_HINTS[kind]}</li>
              ))}
            </ul>
          </div>
        </Panel>

        <Panel
          title="Exchange rates"
          action={
            <Button variant="secondary" size="sm" className="min-h-10" onClick={() => setTyping(true)}>
              <Plus size={15} aria-hidden="true" /> Type a rate
            </Button>
          }
        >
          <div className="flex flex-col gap-4 border-t border-line px-4 py-5 lg:px-6">
            {rates.length === 0 ? (
              <p className="text-sm text-muted">There are no rates yet, so totals in the other currency can&apos;t be worked out until one is fetched or typed.</p>
            ) : (
              <>
                <dl className="grid gap-3 sm:grid-cols-3">
                  {books.map((book) => {
                    const latest = book.days.at(-1);
                    return (
                      <div key={book.kind} className="flex flex-col gap-0.5">
                        <dt className="text-meta text-muted">{RATE_NAMES[book.kind]}</dt>
                        <dd className="text-sm">
                          {latest ? (
                            <>
                              <Amount cents={latest.pesos} currency="ARS" className="font-medium" />
                              <span className="block text-meta text-muted">
                                {date(latest.date)} · {SOURCES[latest.source]}
                              </span>
                            </>
                          ) : (
                            <span className="text-muted">None yet</span>
                          )}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
                <div className="flex flex-col">
                  <h3 className="mb-1 text-label font-medium">Last days, {RATE_NAMES[settings.rateKind]}</h3>
                  {recent.length === 0 ? (
                    <p className="text-sm text-muted">None of this kind yet.</p>
                  ) : (
                    <ul className="flex flex-col divide-y divide-line text-sm">
                      {recent.map((day) => (
                        <li key={day.date} className="flex min-h-10 items-center justify-between gap-3">
                          <span>{date(day.date, { year: true })}</span>
                          <span className="flex items-baseline gap-3">
                            <span className="text-meta text-muted">{SOURCES[day.source]}</span>
                            <Amount cents={day.pesos} currency="ARS" />
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
            <p className="text-meta text-pretty text-muted">
              Quotes come from DolarApi (dolarapi.com) every three hours, while the server can reach it. A rate you type wins over the fetched one for that day.
            </p>
          </div>
        </Panel>

        <Panel
          title="Categories"
          action={
            <Button variant="secondary" size="sm" className="min-h-10" onClick={() => setEditing({})}>
              <Plus size={15} aria-hidden="true" /> Add
            </Button>
          }
        >
          {CATEGORY_GROUPS.map((group) => {
            const inGroup = categories.filter((category) => category.group === group);
            return (
              <div key={group} className="border-t border-line">
                <h3 className="px-4 pt-3 pb-1 text-meta font-medium text-muted lg:px-6">{GROUP_NAMES[group]}</h3>
                {inGroup.length === 0 ? (
                  <PanelEmpty>None here yet.</PanelEmpty>
                ) : (
                  <ul className="flex flex-col pb-1">
                    {inGroup.map((category) => (
                      <li key={category.id}>
                        <button type="button" onClick={() => setEditing({ category })} className="flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left hover:bg-hover lg:px-6">
                          <CategoryIcon name={category.icon} className="shrink-0 text-muted" />
                          <span className="min-w-0 flex-1 truncate text-sm">{category.name}</span>
                          {category.budget && (
                            <span className="text-meta text-muted">
                              <Amount cents={category.budget.amount} currency={category.budget.currency} whole /> a month
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </Panel>

        <Panel title="This device">
          <div className="flex flex-col gap-4 border-t border-line px-4 py-5 lg:px-6">
            <p className="text-sm text-pretty text-muted">
              Tyche keeps everything on this device and works without the server; changes go to the server whenever it can be reached.
            </p>
            <SyncStatus />
            <div>
              <Button variant="secondary" onClick={() => void exportAll()}>
                <Download size={15} aria-hidden="true" /> Export everything
              </Button>
            </div>
          </div>
        </Panel>
      </PageBody>
      <RateDialog open={typing} onOpenChange={setTyping} />
      <CategoryDialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)} category={editing?.category} defaultGroup={editing?.group} />
    </>
  );
}
