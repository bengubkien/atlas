import type { Metadata } from "next";

import { Badge } from "@atlas/ui/components/badge";
import { PageBody, PageHeader } from "@atlas/ui/components/page-header";
import { Panel, PanelEmpty, PanelList, PanelRow } from "@atlas/ui/components/panel";

import { calendarDate } from "@/lib/dates";
import { formatters } from "@/lib/format";
import { INCIDENT_SEVERITY, INCIDENT_STATUS } from "@/lib/labels";
import { getEverything } from "@/lib/micasa/api";

import { IncidentButtons } from "./incident-buttons";
import { Plus } from "lucide-react";

import { DialogButton } from "@/components/dialogs";

import { IncidentForm } from "./incident-form";

export const metadata: Metadata = { title: "Incidents" };

export default async function IncidentsPage() {
  const [everything, f] = await Promise.all([getEverything(), formatters()]);
  const open = everything.incidents
    .filter((incident) => incident.status !== "resolved")
    .sort(
      (a, b) =>
        INCIDENT_SEVERITY[a.severity].order - INCIDENT_SEVERITY[b.severity].order ||
        (a.date_noticed ?? "").localeCompare(b.date_noticed ?? ""),
    );
  const fixed = everything.incidents
    .filter((incident) => incident.status === "resolved")
    .sort((a, b) => (b.date_resolved ?? "").localeCompare(a.date_resolved ?? ""));

  return (
    <>
      <PageHeader
        title="Incidents"
        description="Things that broke or need fixing, most urgent first."
        actions={
          <DialogButton label="Report an issue" icon={<Plus size={16} aria-hidden="true" />} title="Report an issue" description="Something broke, leaks or needs fixing.">
            <IncidentForm appliances={everything.appliances.map(({ id, name }) => ({ id, name }))} currency={f.currency} today={f.today} />
          </DialogButton>
        }
      />
      <PageBody>
        <Panel title="Open" count={open.length}>
          {open.length === 0 ? (
            <PanelEmpty>Nothing needs fixing.</PanelEmpty>
          ) : (
            <PanelList>
              {open.map((incident) => {
                const noticed = calendarDate(incident.date_noticed);
                return (
                  <PanelRow
                    key={incident.id}
                    title={incident.title}
                    href={`/incidents/${incident.id}`}
                    meta={
                      <span className="inline-flex items-center gap-2">
                        <Badge tone={INCIDENT_SEVERITY[incident.severity].tone}>{INCIDENT_SEVERITY[incident.severity].label}</Badge>
                        {incident.status === "in_progress" && <Badge>{INCIDENT_STATUS.in_progress}</Badge>}
                        {noticed && <span>Noticed {f.fromToday(noticed)}</span>}
                      </span>
                    }
                    detail={[incident.location, incident.appliance, incident.vendor].filter(Boolean).join(" · ")}
                    aside={
                      <IncidentButtons id={incident.id} title={incident.title} status={incident.status as "open" | "in_progress"} />
                    }
                  />
                );
              })}
            </PanelList>
          )}
        </Panel>

        <Panel title="Fixed" count={fixed.length}>
          {fixed.length === 0 ? (
            <PanelEmpty>Issues you mark fixed are kept here.</PanelEmpty>
          ) : (
            <PanelList>
              {fixed.map((incident) => {
                const resolved = calendarDate(incident.date_resolved);
                return (
                  <PanelRow
                    key={incident.id}
                    title={incident.title}
                    href={`/incidents/${incident.id}`}
                    meta={[resolved ? `Fixed ${f.date(resolved)}` : "Fixed", f.money(incident.cost_cents)].filter(Boolean).join(" · ")}
                    detail={[incident.location, incident.vendor].filter(Boolean).join(" · ")}
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
