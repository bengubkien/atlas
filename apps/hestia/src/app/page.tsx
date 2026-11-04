import Link from "next/link";

import { Badge } from "@atlas/ui/components/badge";
import { buttonClassName } from "@atlas/ui/components/button";
import { PageBody, PageHeader } from "@atlas/ui/components/page-header";
import { Panel, PanelEmpty, PanelList, PanelRow } from "@atlas/ui/components/panel";

import { formatters } from "@/lib/format";
import { INCIDENT_SEVERITY, PROJECT_STATUS } from "@/lib/labels";
import { getEverything, getStatus } from "@/lib/micasa/api";
import { SOON_DAYS } from "@/lib/schedule";

import { LogService } from "./maintenance/log-service";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export default async function OverviewPage() {
  // micasa's own summary of what needs attention, and everything else for names.
  const [status, everything, f] = await Promise.all([getStatus(SOON_DAYS), getEverything(), formatters()]);
  const vendors = everything.vendors.map((vendor) => vendor.name).sort();
  const house = everything.house;

  const summary = [
    status.overdue.length ? `${plural(status.overdue.length, "thing")} overdue` : null,
    status.upcoming.length ? `${status.upcoming.length} due in the next ${SOON_DAYS} days` : null,
    status.incidents.length ? `${plural(status.incidents.length, "open issue")}` : null,
  ].filter(Boolean);

  return (
    <>
      <PageHeader
        title={house.nickname || "Your home"}
        description={summary.length ? `${summary.join(", ")}.` : "Nothing needs you right now."}
      />
      <PageBody>
        {!house.id && (
          <div className="flex flex-col items-start gap-3 rounded-panel border border-line-card bg-card p-5 lg:flex-row lg:items-center lg:justify-between lg:p-6">
            <div className="flex flex-col gap-1">
              <h2 className="font-serif text-[22px] leading-tight">Tell Hestia about your house</h2>
              <p className="text-sm text-muted">Its name and address, when it was built, its size.</p>
            </div>
            <Link href="/house" className={buttonClassName("primary", "lg")}>
              Set up your house
            </Link>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
          <Panel title="Overdue" count={status.overdue.length}>
            {status.overdue.length === 0 ? (
              <PanelEmpty>Nothing overdue.</PanelEmpty>
            ) : (
              <PanelList>
                {status.overdue.map((item) => (
                  <PanelRow
                    key={item.id}
                    href={`/maintenance/${item.id}`}
                    title={item.name}
                    meta={<span className="font-medium text-error">Was due {f.date(item.next_due)}</span>}
                    detail={[item.category, item.appliance].filter(Boolean).join(" · ")}
                    aside={<LogService item={item} vendors={vendors} today={f.today} currency={f.currency} />}
                  />
                ))}
              </PanelList>
            )}
          </Panel>

          <Panel title="Coming up" count={status.upcoming.length}>
            {status.upcoming.length === 0 ? (
              <PanelEmpty>Nothing due in the next {SOON_DAYS} days.</PanelEmpty>
            ) : (
              <PanelList>
                {status.upcoming.map((item) => (
                  <PanelRow
                    key={item.id}
                    href={`/maintenance/${item.id}`}
                    title={item.name}
                    meta={`Due ${f.fromToday(item.next_due)}, ${f.date(item.next_due)}`}
                    detail={[item.category, item.appliance].filter(Boolean).join(" · ")}
                    aside={<LogService item={item} vendors={vendors} today={f.today} currency={f.currency} />}
                  />
                ))}
              </PanelList>
            )}
          </Panel>

          <Panel title="Open issues" count={status.incidents.length} action={<Link href="/incidents" className="text-meta text-muted hover:text-ink">All</Link>}>
            {status.incidents.length === 0 ? (
              <PanelEmpty>Nothing needs fixing.</PanelEmpty>
            ) : (
              <PanelList>
                {status.incidents.map((incident) => (
                  <PanelRow
                    key={incident.id}
                    href="/incidents"
                    title={incident.title}
                    meta={`Noticed ${f.fromToday(incident.date_noticed)}`}
                    aside={<Badge tone={INCIDENT_SEVERITY[incident.severity].tone}>{INCIDENT_SEVERITY[incident.severity].label}</Badge>}
                  />
                ))}
              </PanelList>
            )}
          </Panel>

          <Panel title="Active projects" count={status.active_projects.length} action={<Link href="/projects" className="text-meta text-muted hover:text-ink">All</Link>}>
            {status.active_projects.length === 0 ? (
              <PanelEmpty>No project underway.</PanelEmpty>
            ) : (
              <PanelList>
                {status.active_projects.map((project) => (
                  <PanelRow
                    key={project.id}
                    href={`/projects/${project.id}`}
                    title={project.title}
                    meta={project.start_date ? `Started ${f.date(project.start_date)}` : undefined}
                    aside={<Badge tone={PROJECT_STATUS[project.status].tone}>{PROJECT_STATUS[project.status].label}</Badge>}
                  />
                ))}
              </PanelList>
            )}
          </Panel>
        </div>
      </PageBody>
    </>
  );
}
