import type { Metadata } from "next";

import { Badge } from "@atlas/ui/components/badge";
import { PageBody, PageHeader } from "@atlas/ui/components/page-header";
import { Panel, PanelEmpty, PanelList, PanelRow } from "@atlas/ui/components/panel";

import { calendarDate, daysBetween } from "@/lib/dates";
import { formatters, type Formatters } from "@/lib/format";
import { getEverything } from "@/lib/micasa/api";
import type { Appliance } from "@/lib/micasa/schemas";

export const metadata: Metadata = { title: "Appliances" };

/** Under warranty, ending soon, or ended. */
function Warranty({ appliance, f }: { appliance: Appliance; f: Formatters }) {
  const expiry = calendarDate(appliance.warranty_expiry);
  if (!expiry) return null;
  const days = daysBetween(f.today, expiry);
  if (days < 0) return <Badge>Warranty ended {f.date(expiry)}</Badge>;
  if (days <= 90) return <Badge tone="warning">Warranty ends {f.fromToday(expiry)}</Badge>;
  return <Badge tone="success">Under warranty until {f.date(expiry)}</Badge>;
}

export default async function AppliancesPage() {
  const [everything, f] = await Promise.all([getEverything(), formatters()]);
  const appliances = [...everything.appliances].sort((a, b) => a.name.localeCompare(b.name));
  const tasks = (id: string) => everything.maintenance.filter((item) => item.appliance_id === id).length;

  return (
    <>
      <PageHeader title="Appliances" description="What's in the house, where, its model and serial numbers, and its warranty." />
      <PageBody>
        <Panel title="All appliances" count={appliances.length}>
          {appliances.length === 0 ? (
            <PanelEmpty>No appliances yet.</PanelEmpty>
          ) : (
            <PanelList>
              {appliances.map((appliance) => {
                const bought = calendarDate(appliance.purchase_date);
                const count = tasks(appliance.id);
                return (
                  <PanelRow
                    key={appliance.id}
                    title={appliance.name}
                    meta={[appliance.brand, appliance.model_number, appliance.location].filter(Boolean).join(" · ")}
                    detail={[
                      appliance.serial_number ? `Serial ${appliance.serial_number}` : null,
                      bought ? `Bought ${f.date(bought)}` : null,
                      count ? `${count} maintenance ${count === 1 ? "item" : "items"}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    aside={<Warranty appliance={appliance} f={f} />}
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
