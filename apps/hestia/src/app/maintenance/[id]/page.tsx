import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageBody, PageHeader } from "@atlas/ui/components/page-header";
import { Panel, PanelEmpty, PanelList, PanelRow } from "@atlas/ui/components/panel";

import { BackLink } from "@atlas/ui/components/back-link";
import { Due } from "@/components/due";
import { Facts } from "@/components/facts";
import { calendarDate } from "@/lib/dates";
import { formatters } from "@/lib/format";
import { getEverything, getMaintenance, isNotFound } from "@/lib/micasa/api";
import { cadence, scheduled } from "@/lib/schedule";

import { DocumentsPanel } from "@/components/documents-panel";
import { RecordMenu } from "@/components/record-menu";

import { LogService } from "../log-service";
import { MaintenanceForm } from "../maintenance-form";
import { ServiceForm } from "../service-form";

type Props = { params: Promise<{ id: string }> };

async function load(id: string) {
  try {
    return await getMaintenance(id);
  } catch (error) {
    if (isNotFound(error)) notFound();
    throw error;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const item = await load((await params).id);
  return { title: item.name };
}

export default async function MaintenanceItemPage({ params }: Props) {
  const { id } = await params;
  const [raw, everything, f] = await Promise.all([load(id), getEverything(), formatters()]);
  const item = scheduled(raw, f.today);
  const history = everything.service_log
    .filter((entry) => entry.maintenance_item_id === id)
    .sort((a, b) => b.serviced_at.localeCompare(a.serviced_at));
  const spent = history.reduce((sum, entry) => sum + (entry.cost_cents ?? 0), 0);
  const last = calendarDate(raw.last_serviced_at);
  const vendors = everything.vendors.map((vendor) => vendor.name).sort();

  return (
    <>
      <PageHeader
        before={<BackLink href="/maintenance" label="Maintenance" />}
        title={item.name}
        description={<Due item={item} f={f} full />}
        actions={
          <>
            <LogService item={item} vendors={vendors} today={f.today} currency={f.currency} variant="primary" />
            <RecordMenu entity="maintenance" id={raw.id} name={raw.name} editTitle="Edit maintenance item" after="/maintenance">
              <MaintenanceForm
                item={raw}
                categories={everything.maintenance_categories}
                appliances={everything.appliances.map(({ id: applianceId, name }) => ({ id: applianceId, name }))}
                currency={f.currency}
              />
            </RecordMenu>
          </>
        }
      />
      <PageBody className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
        <Panel title="Details">
          <Facts
            items={[
              ["Next due", item.next ? `${f.longDate(item.next)} (${f.fromToday(item.next)})` : item.standing === "never" ? "After the first service" : "No schedule"],
              ["How often", cadence(item)],
              ["Last serviced", last ? f.longDate(last) : "Never logged"],
              ["Category", item.category],
              ["Appliance", item.appliance],
              ["Best season", item.season ? item.season[0]!.toUpperCase() + item.season.slice(1) : ""],
              ["Usual cost", f.money(item.cost_cents)],
              ["Notes", item.notes],
            ]}
          />
        </Panel>
        <div className="flex min-w-0 flex-col gap-4">
        <Panel title="History" count={history.length}>
          {history.length === 0 ? (
            <PanelEmpty>Nothing logged yet. Log a service when it&apos;s done.</PanelEmpty>
          ) : (
            <>
              <PanelList>
                {history.map((entry) => (
                  <PanelRow
                    key={entry.id}
                    title={f.longDate(calendarDate(entry.serviced_at)!)}
                    meta={[entry.vendor || "You", f.money(entry.cost_cents)].filter(Boolean).join(" · ")}
                    detail={entry.notes}
                    aside={
                      <RecordMenu entity="service-log" id={entry.id} name={`the service on ${f.date(calendarDate(entry.serviced_at)!)}`} editTitle="Edit service">
                        <ServiceForm itemId={id} entry={entry} vendors={vendors} today={f.today} currency={f.currency} />
                      </RecordMenu>
                    }
                  />
                ))}
              </PanelList>
              {spent > 0 && (
                <p className="border-t border-line px-4 py-3 text-meta text-muted lg:px-6">
                  {f.money(spent)} in all
                </p>
              )}
            </>
          )}
        </Panel>
        <DocumentsPanel kind="maintenance" id={raw.id} documents={everything.documents} empty="Attach instructions, a part's receipt or a photo." />
        </div>
      </PageBody>
    </>
  );
}
