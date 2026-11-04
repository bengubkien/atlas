import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Badge } from "@atlas/ui/components/badge";
import { PageBody, PageHeader } from "@atlas/ui/components/page-header";
import { Panel, PanelEmpty } from "@atlas/ui/components/panel";
import { cn } from "@atlas/ui/cn";

import { BackLink } from "@/components/back-link";
import { Facts } from "@/components/facts";
import { calendarDate } from "@/lib/dates";
import { formatters } from "@/lib/format";
import { getEverything, getProject, isNotFound } from "@/lib/micasa/api";

import { StatusSelect } from "../status-select";

type Props = { params: Promise<{ id: string }> };

async function load(id: string) {
  try {
    return await getProject(id);
  } catch (error) {
    if (isNotFound(error)) notFound();
    throw error;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: (await load((await params).id)).title };
}

export default async function ProjectPage({ params }: Props) {
  const { id } = await params;
  const [project, everything, f] = await Promise.all([load(id), getEverything(), formatters()]);
  const quotes = everything.quotes.filter((quote) => quote.project_id === id).sort((a, b) => a.total_cents - b.total_cents);
  const lowest = quotes[0]?.total_cents;
  const start = calendarDate(project.start_date);
  const end = calendarDate(project.end_date);

  return (
    <>
      <PageHeader
        before={<BackLink href="/projects" label="Projects" />}
        title={project.title}
        description={project.description || undefined}
        actions={<StatusSelect id={project.id} status={project.status} />}
      />
      <PageBody>
        <Panel title="Details">
          <Facts
            items={[
              ["Type", project.project_type],
              ["Budget", f.money(project.budget_cents)],
              ["Spent", f.money(project.actual_cents)],
              ["Started", start ? f.longDate(start) : ""],
              ["Finished", end ? f.longDate(end) : ""],
            ]}
          />
        </Panel>

        <Panel title="Quotes" count={quotes.length}>
          {quotes.length === 0 ? (
            <PanelEmpty>No quotes yet. They&apos;re compared here side by side once you have some.</PanelEmpty>
          ) : (
            <ul className="grid gap-3 border-t border-line p-4 sm:grid-cols-2 lg:grid-cols-3 lg:p-6">
              {quotes.map((quote) => {
                const isLowest = quotes.length > 1 && quote.total_cents === lowest;
                const overBudget = project.budget_cents !== null ? quote.total_cents - project.budget_cents : null;
                const received = calendarDate(quote.received_date);
                return (
                  <li
                    key={quote.id}
                    className={cn(
                      "flex flex-col gap-3 rounded-card border bg-surface p-4",
                      isLowest ? "border-line-strong" : "border-line-card",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium">{quote.vendor || "Unknown vendor"}</span>
                      {isLowest && <Badge tone="success">Lowest</Badge>}
                    </div>
                    <span className="font-serif text-[28px] leading-none">{f.money(quote.total_cents, { whole: true })}</span>
                    <dl className="flex flex-col gap-1 text-meta">
                      {quote.labor_cents !== null && (
                        <div className="flex justify-between gap-2">
                          <dt className="text-muted">Labor</dt>
                          <dd className="font-mono text-xs">{f.money(quote.labor_cents)}</dd>
                        </div>
                      )}
                      {quote.materials_cents !== null && (
                        <div className="flex justify-between gap-2">
                          <dt className="text-muted">Materials</dt>
                          <dd className="font-mono text-xs">{f.money(quote.materials_cents)}</dd>
                        </div>
                      )}
                      {overBudget !== null && (
                        <div className="flex justify-between gap-2">
                          <dt className="text-muted">Against budget</dt>
                          <dd className={cn("font-mono text-xs", overBudget > 0 ? "text-error" : "text-success")}>
                            {overBudget > 0 ? `${f.money(overBudget)} over` : `${f.money(-overBudget)} under`}
                          </dd>
                        </div>
                      )}
                      {received && (
                        <div className="flex justify-between gap-2">
                          <dt className="text-muted">Received</dt>
                          <dd>{f.date(received)}</dd>
                        </div>
                      )}
                    </dl>
                    {quote.notes && <p className="text-meta text-pretty text-muted">{quote.notes}</p>}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </PageBody>
    </>
  );
}
