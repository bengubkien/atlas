import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BackLink } from "@atlas/ui/components/back-link";
import { Badge } from "@atlas/ui/components/badge";
import { PageBody, PageHeader } from "@atlas/ui/components/page-header";
import { Panel, PanelEmpty, PanelList, PanelRow } from "@atlas/ui/components/panel";

import { DocumentsPanel } from "@/components/documents-panel";
import { Due } from "@/components/due";
import { Facts } from "@/components/facts";
import { RecordMenu } from "@/components/record-menu";
import { Warranty } from "@/components/warranty";
import { calendarDate } from "@/lib/dates";
import { formatters } from "@/lib/format";
import { INCIDENT_SEVERITY, INCIDENT_STATUS } from "@/lib/labels";
import { getAppliance, getEverything, isNotFound } from "@/lib/micasa/api";
import { scheduled } from "@/lib/schedule";

import { ApplianceForm } from "../appliance-form";

type Props = { params: Promise<{ id: string }> };

async function load(id: string) {
  try {
    return await getAppliance(id);
  } catch (error) {
    if (isNotFound(error)) notFound();
    throw error;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: (await load((await params).id)).name };
}

/** An appliance: its numbers and warranty, its upkeep, what went wrong with it, and its manual and receipts. */
export default async function AppliancePage({ params }: Props) {
  const { id } = await params;
  const [appliance, everything, f] = await Promise.all([load(id), getEverything(), formatters()]);
  const upkeep = everything.maintenance.filter((item) => item.appliance_id === id).map((item) => scheduled(item, f.today));
  const issues = everything.incidents.filter((incident) => incident.appliance_id === id).sort((a, b) => (b.date_noticed ?? "").localeCompare(a.date_noticed ?? ""));
  const bought = calendarDate(appliance.purchase_date);
  const warranty = calendarDate(appliance.warranty_expiry);

  return (
    <>
      <PageHeader
        before={<BackLink href="/appliances" label="Appliances" />}
        title={appliance.name}
        description={[appliance.brand, appliance.location].filter(Boolean).join(" · ") || undefined}
        actions={
          <RecordMenu entity="appliance" id={appliance.id} name={appliance.name} editTitle="Edit appliance" after="/appliances">
            <ApplianceForm appliance={appliance} currency={f.currency} />
          </RecordMenu>
        }
      />
      <PageBody className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
        <Panel title="Details" action={<Warranty appliance={appliance} f={f} />}>
          <Facts
            items={[
              ["Model", appliance.model_number],
              ["Serial", appliance.serial_number],
              ["Bought", bought ? f.longDate(bought) : ""],
              ["Warranty until", warranty ? f.longDate(warranty) : ""],
              ["Cost", f.money(appliance.cost_cents)],
              ["Notes", appliance.notes],
            ]}
          />
        </Panel>
        <div className="flex min-w-0 flex-col gap-4">
          <Panel title="Upkeep" count={upkeep.length || undefined}>
            {upkeep.length === 0 ? (
              <PanelEmpty>No maintenance for it yet. Add an item in Maintenance and pick this appliance.</PanelEmpty>
            ) : (
              <PanelList>
                {upkeep.map((item) => (
                  <PanelRow key={item.id} title={item.name} href={`/maintenance/${item.id}`} meta={<Due item={item} f={f} />} />
                ))}
              </PanelList>
            )}
          </Panel>
          <Panel title="Issues" count={issues.length || undefined}>
            {issues.length === 0 ? (
              <PanelEmpty>Nothing has gone wrong with it.</PanelEmpty>
            ) : (
              <PanelList>
                {issues.map((incident) => (
                  <PanelRow
                    key={incident.id}
                    title={incident.title}
                    href={`/incidents/${incident.id}`}
                    meta={incident.status === "resolved" ? INCIDENT_STATUS.resolved : INCIDENT_STATUS[incident.status]}
                    aside={incident.status !== "resolved" ? <Badge tone={INCIDENT_SEVERITY[incident.severity].tone}>{INCIDENT_SEVERITY[incident.severity].label}</Badge> : undefined}
                  />
                ))}
              </PanelList>
            )}
          </Panel>
          <DocumentsPanel kind="appliance" id={appliance.id} documents={everything.documents} empty="Attach its manual, the receipt or the warranty card." />
        </div>
      </PageBody>
    </>
  );
}
