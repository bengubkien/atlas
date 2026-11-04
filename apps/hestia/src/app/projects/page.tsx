import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@atlas/ui/components/badge";
import { PageBody, PageHeader } from "@atlas/ui/components/page-header";
import { Panel, PanelEmpty, PanelList, PanelRow } from "@atlas/ui/components/panel";

import { calendarDate } from "@/lib/dates";
import { formatters, type Formatters } from "@/lib/format";
import { ACTIVE_PROJECT_STATUSES, PROJECT_STATUS } from "@/lib/labels";
import { getEverything } from "@/lib/micasa/api";
import type { Project, Quote } from "@/lib/micasa/schemas";

import { AddProject } from "./add-project";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const [everything, f] = await Promise.all([getEverything(), formatters()]);
  const quotesFor = (id: string) => everything.quotes.filter((quote) => quote.project_id === id);
  const active = everything.projects.filter((project) => ACTIVE_PROJECT_STATUSES.includes(project.status));
  const finished = everything.projects
    .filter((project) => !ACTIVE_PROJECT_STATUSES.includes(project.status))
    .sort((a, b) => (b.end_date ?? "").localeCompare(a.end_date ?? ""));

  return (
    <>
      <PageHeader
        title="Projects"
        description="From an idea to done: get quotes, compare them, and move each project along."
        actions={<AddProject types={everything.project_types} currency={f.currency} />}
      />
      <PageBody>
        {/* A board on a wide screen; on a phone, one status under the other. */}
        <div className="flex flex-col gap-6 lg:grid lg:grid-cols-5 lg:items-start lg:gap-3">
          {ACTIVE_PROJECT_STATUSES.map((status) => {
            const column = active.filter((project) => project.status === status);
            return (
              <section key={status} aria-labelledby={`column-${status}`} className="flex min-w-0 flex-col gap-2">
                <h2 id={`column-${status}`} className="flex items-baseline gap-2 px-1 text-sm font-medium">
                  {PROJECT_STATUS[status].label}
                  <span className="text-meta font-normal text-muted">{column.length}</span>
                </h2>
                {column.length === 0 ? (
                  <p className="rounded-card border border-dashed border-line-field px-3 py-4 text-meta text-faint">None</p>
                ) : (
                  column.map((project) => <ProjectCard key={project.id} project={project} quotes={quotesFor(project.id)} f={f} />)
                )}
              </section>
            );
          })}
        </div>

        <Panel title="Finished" count={finished.length}>
          {finished.length === 0 ? (
            <PanelEmpty>Projects you finish or drop end up here.</PanelEmpty>
          ) : (
            <PanelList>
              {finished.map((project) => {
                const end = calendarDate(project.end_date);
                return (
                  <PanelRow
                    key={project.id}
                    href={`/projects/${project.id}`}
                    title={project.title}
                    meta={[project.project_type, end ? f.date(end) : null, f.money(project.actual_cents, { whole: true })].filter(Boolean).join(" · ")}
                    aside={<Badge tone={PROJECT_STATUS[project.status].tone}>{PROJECT_STATUS[project.status].label}</Badge>}
                  />
                );
              })}
            </PanelList>
          )}
        </Panel>
      </PageBody>
    </>
  );
}

function ProjectCard({ project, quotes, f }: { project: Project; quotes: Quote[]; f: Formatters }) {
  const lowest = quotes.length ? Math.min(...quotes.map((quote) => quote.total_cents)) : null;
  return (
    <Link
      href={`/projects/${project.id}`}
      className="flex flex-col gap-1.5 rounded-card border border-line-card bg-card px-3.5 py-3 text-ink shadow-control hover:border-line-strong hover:text-ink"
    >
      <span className="text-sm font-medium text-pretty">{project.title}</span>
      <span className="text-meta text-muted">{project.project_type}</span>
      {(project.budget_cents !== null || quotes.length > 0) && (
        <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
          {project.budget_cents !== null && <span>Budget {f.money(project.budget_cents, { whole: true })}</span>}
          {quotes.length > 0 && (
            <span>
              {quotes.length} {quotes.length === 1 ? "quote" : "quotes"}
              {quotes.length > 1 ? `, from ${f.money(lowest, { whole: true })}` : `, ${f.money(lowest, { whole: true })}`}
            </span>
          )}
        </span>
      )}
    </Link>
  );
}
