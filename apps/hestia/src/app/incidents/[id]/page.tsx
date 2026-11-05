import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BackLink } from "@atlas/ui/components/back-link";
import { Badge } from "@atlas/ui/components/badge";
import { PageBody, PageHeader } from "@atlas/ui/components/page-header";
import { Panel } from "@atlas/ui/components/panel";

import { DocumentsPanel } from "@/components/documents-panel";
import { Facts } from "@/components/facts";
import { RecordMenu } from "@/components/record-menu";
import { calendarDate } from "@/lib/dates";
import { formatters } from "@/lib/format";
import { INCIDENT_SEVERITY, INCIDENT_STATUS } from "@/lib/labels";
import { getEverything, getIncident, isNotFound } from "@/lib/micasa/api";

import { IncidentButtons } from "../incident-buttons";
import { IncidentForm } from "../incident-form";

type Props = { params: Promise<{ id: string }> };

async function load(id: string) {
  try {
    return await getIncident(id);
  } catch (error) {
    if (isNotFound(error)) notFound();
    throw error;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: (await load((await params).id)).title };
}

/** An issue: what, where, how urgent, who fixed it and for how much, and its photos and invoices. */
export default async function IncidentPage({ params }: Props) {
  const { id } = await params;
  const [incident, everything, f] = await Promise.all([load(id), getEverything(), formatters()]);
  const noticed = calendarDate(incident.date_noticed);
  const resolved = calendarDate(incident.date_resolved);
  const severity = INCIDENT_SEVERITY[incident.severity];

  return (
    <>
      <PageHeader
        before={<BackLink href="/incidents" label="Incidents" />}
        title={incident.title}
        description={incident.description || undefined}
        actions={
          <>
            {incident.status !== "resolved" && <IncidentButtons id={incident.id} title={incident.title} status={incident.status} />}
            <RecordMenu entity="incident" id={incident.id} name={incident.title} editTitle="Edit issue" after="/incidents">
              <IncidentForm
                incident={incident}
                appliances={everything.appliances.map(({ id: applianceId, name }) => ({ id: applianceId, name }))}
                vendors={everything.vendors.map(({ id: vendorId, name }) => ({ id: vendorId, name })).sort((a, b) => a.name.localeCompare(b.name))}
                currency={f.currency}
                today={f.today}
              />
            </RecordMenu>
          </>
        }
      />
      <PageBody className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
        <Panel title="Details" action={incident.status !== "resolved" ? <Badge tone={severity.tone}>{severity.label}</Badge> : <Badge tone="success">Fixed</Badge>}>
          <Facts
            items={[
              ["Where it's at", INCIDENT_STATUS[incident.status]],
              ["Where", incident.location],
              ["Appliance", incident.appliance],
              ["Noticed", noticed ? f.longDate(noticed) : ""],
              ["Fixed on", resolved ? f.longDate(resolved) : ""],
              ["Fixed by", incident.vendor],
              ["What it cost", f.money(incident.cost_cents)],
              ["Notes", incident.notes],
            ]}
          />
        </Panel>
        <DocumentsPanel kind="incident" id={incident.id} documents={everything.documents} empty="Attach a photo of the damage, or the invoice for the repair." />
      </PageBody>
    </>
  );
}
