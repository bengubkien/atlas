import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Badge } from "@atlas/ui/components/badge";
import { PageBody, PageHeader } from "@atlas/ui/components/page-header";
import { Panel, PanelEmpty } from "@atlas/ui/components/panel";
import { cn } from "@atlas/ui/cn";

import { BackLink } from "@atlas/ui/components/back-link";
import { Facts } from "@/components/facts";
import { calendarDate } from "@/lib/dates";
import { formatters } from "@/lib/format";
import { getEverything, getProject, isNotFound } from "@/lib/micasa/api";

import { Plus } from "lucide-react";

import { DialogButton } from "@/components/dialogs";
import { DocumentsPanel } from "@/components/documents-panel";
import { RecordMenu } from "@/components/record-menu";

import { ProjectForm } from "../project-form";
import { QuoteForm } from "../quote-form";
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
  const vendors = everything.vendors.map((vendor) => vendor.name).sort();

  return (
    <>
      <PageHeader
        before={<BackLink href="/projects" label="Projects" />}
        title={project.title}
        description={project.description || undefined}
        actions={
          <>
            <StatusSelect id={project.id} status={project.status} />
            <RecordMenu entity="project" id={project.id} name={project.title} editTitle="Edit project" after="/projects">
              <ProjectForm project={project} types={everything.project_types} currency={f.currency} />
            </RecordMenu>
          </>
        }
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

        <Panel
          title="Quotes"
          count={quotes.length}
          action={
            <DialogButton label="Add a quote" icon={<Plus size={15} aria-hidden="true" />} title="Add a quote" description={project.title} variant="secondary" size="sm">
              <QuoteForm projectId={project.id} vendors={vendors} today={f.today} currency={f.currency} />
            </DialogButton>
          }
        >
          {quotes.length === 0 ? (
            <PanelEmpty>No quotes yet. Add them as they come in, and they&apos;re compared here side by side.</PanelEmpty>
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
                    <div className="-mt-1 -mr-2 flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{quote.vendor || "Unknown vendor"}</span>
                      <span className="flex items-center gap-1">
                        {isLowest && <Badge tone="success">Lowest</Badge>}
                        <RecordMenu entity="quote" id={quote.id} name={`the quote from ${quote.vendor || "this vendor"}`} editTitle="Edit quote">
                          <QuoteForm projectId={project.id} quote={quote} vendors={vendors} today={f.today} currency={f.currency} />
                        </RecordMenu>
                      </span>
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
        <DocumentsPanel kind="project" id={project.id} documents={everything.documents} empty="Attach plans, permits, photos or the contract." />
      </PageBody>
    </>
  );
}
