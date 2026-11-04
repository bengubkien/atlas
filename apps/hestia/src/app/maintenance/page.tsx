import type { Metadata } from "next";

import { PageBody, PageHeader } from "@atlas/ui/components/page-header";
import { Panel, PanelEmpty, PanelList, PanelRow } from "@atlas/ui/components/panel";

import { Due } from "@/components/due";
import { formatters } from "@/lib/format";
import { getEverything } from "@/lib/micasa/api";
import { cadence, schedule, type Standing } from "@/lib/schedule";

import { AddMaintenance } from "./add-maintenance";
import { LogService } from "./log-service";

export const metadata: Metadata = { title: "Maintenance" };

const GROUPS: { standing: Standing; title: string }[] = [
  { standing: "overdue", title: "Overdue" },
  { standing: "soon", title: "Due soon" },
  { standing: "later", title: "Later" },
  { standing: "never", title: "Never logged" },
  { standing: "unscheduled", title: "No schedule" },
];

export default async function MaintenancePage() {
  const [everything, f] = await Promise.all([getEverything(), formatters()]);
  const items = schedule(everything.maintenance, f.today);
  const vendors = everything.vendors.map((vendor) => vendor.name).sort();
  const overdue = items.filter((item) => item.standing === "overdue").length;

  return (
    <>
      <PageHeader
        title="Maintenance"
        description={
          items.length === 0
            ? "Everything the house needs now and then: filters, gutters, the furnace's yearly check."
            : overdue > 0
              ? `${overdue} overdue, soonest first. Log a service when it's done, and its next date moves on.`
              : "Nothing overdue. Log a service when it's done, and its next date moves on."
        }
        actions={
          <AddMaintenance
            categories={everything.maintenance_categories}
            appliances={everything.appliances.map(({ id, name }) => ({ id, name }))}
          />
        }
      />
      <PageBody>
        {items.length === 0 ? (
          <Panel title="Nothing yet">
            <PanelEmpty>Add the first item: what it is, and every how many months it's due.</PanelEmpty>
          </Panel>
        ) : (
          GROUPS.map(({ standing, title }) => {
            const group = items.filter((item) => item.standing === standing);
            if (group.length === 0) return null;
            return (
              <Panel key={standing} title={title} count={group.length}>
                <PanelList>
                  {group.map((item) => (
                    <PanelRow
                      key={item.id}
                      href={`/maintenance/${item.id}`}
                      title={item.name}
                      meta={<Due item={item} f={f} />}
                      detail={[item.category, item.appliance, cadence(item)].filter(Boolean).join(" · ")}
                      aside={<LogService item={item} vendors={vendors} today={f.today} currency={f.currency} />}
                    />
                  ))}
                </PanelList>
              </Panel>
            );
          })
        )}
      </PageBody>
    </>
  );
}
