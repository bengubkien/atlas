import type { Metadata } from "next";

import { Plus } from "lucide-react";

import { PageBody, PageHeader } from "@atlas/ui/components/page-header";
import { Panel, PanelEmpty, PanelList, PanelRow } from "@atlas/ui/components/panel";

import { calendarDate } from "@/lib/dates";
import { formatters } from "@/lib/format";
import { getEverything } from "@/lib/micasa/api";
import { DialogButton } from "@/components/dialogs";
import { Warranty } from "@/components/warranty";

import { ApplianceForm } from "./appliance-form";

export const metadata: Metadata = { title: "Appliances" };

export default async function AppliancesPage() {
  const [everything, f] = await Promise.all([getEverything(), formatters()]);
  const appliances = [...everything.appliances].sort((a, b) => a.name.localeCompare(b.name));
  const tasks = (id: string) => everything.maintenance.filter((item) => item.appliance_id === id).length;

  return (
    <>
      <PageHeader
        title="Appliances"
        description="What's in the house, where, its model and serial numbers, and its warranty."
        actions={
          <DialogButton label="Add appliance" icon={<Plus size={16} aria-hidden="true" />} title="Add an appliance">
            <ApplianceForm currency={f.currency} />
          </DialogButton>
        }
      />
      <PageBody>
        <Panel title="All appliances" count={appliances.length}>
          {appliances.length === 0 ? (
            <PanelEmpty>No appliances yet. Add the ones worth keeping track of: their warranty, manual and upkeep.</PanelEmpty>
          ) : (
            <PanelList>
              {appliances.map((appliance) => {
                const bought = calendarDate(appliance.purchase_date);
                const count = tasks(appliance.id);
                return (
                  <PanelRow
                    key={appliance.id}
                    title={appliance.name}
                    href={`/appliances/${appliance.id}`}
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
