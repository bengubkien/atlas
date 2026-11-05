import type { Metadata } from "next";
import { Globe, Mail, Phone, Plus } from "lucide-react";

import { PageBody, PageHeader } from "@atlas/ui/components/page-header";
import { Panel, PanelEmpty, PanelList, PanelRow } from "@atlas/ui/components/panel";

import { calendarDate } from "@/lib/dates";
import { formatters } from "@/lib/format";
import { getEverything } from "@/lib/micasa/api";
import { DialogButton } from "@/components/dialogs";
import { RecordMenu } from "@/components/record-menu";

import { VendorForm } from "./vendor-form";

export const metadata: Metadata = { title: "Vendors" };

const contact = "grid size-9 place-items-center rounded-control text-muted hover:bg-hover hover:text-ink";

/** A website as a link, with https:// added when it was saved without one. */
const site = (url: string) => (/^https?:\/\//i.test(url) ? url : `https://${url}`);

export default async function VendorsPage() {
  const [everything, f] = await Promise.all([getEverything(), formatters()]);
  const vendors = [...everything.vendors].sort((a, b) => a.name.localeCompare(b.name));

  /** How many jobs, quotes and repairs a vendor had, and the latest job's date. */
  const work = (id: string) => {
    const services = everything.service_log.filter((entry) => entry.vendor_id === id);
    const quotes = everything.quotes.filter((quote) => quote.vendor_id === id).length;
    const repairs = everything.incidents.filter((incident) => incident.vendor_id === id).length;
    const latest = services.map((entry) => calendarDate(entry.serviced_at)!).sort().at(-1);
    return { jobs: services.length, quotes, repairs, latest };
  };

  return (
    <>
      <PageHeader
        title="Vendors"
        description="Everyone who's worked on the house or quoted for it, and how to reach them."
        actions={
          <DialogButton label="Add vendor" icon={<Plus size={16} aria-hidden="true" />} title="Add a vendor">
            <VendorForm />
          </DialogButton>
        }
      />
      <PageBody>
        <Panel title="All vendors" count={vendors.length}>
          {vendors.length === 0 ? (
            <PanelEmpty>Add one here, or they&apos;re added when you log a service or a quote with their name.</PanelEmpty>
          ) : (
            <PanelList>
              {vendors.map((vendor) => {
                const { jobs, quotes, repairs, latest } = work(vendor.id);
                const plural = (n: number, one: string, many: string) => (n ? `${n} ${n === 1 ? one : many}` : null);
                return (
                  <PanelRow
                    key={vendor.id}
                    title={vendor.name}
                    meta={[vendor.contact_name, vendor.phone].filter(Boolean).join(" · ")}
                    detail={[
                      plural(jobs, "job", "jobs"),
                      plural(quotes, "quote", "quotes"),
                      plural(repairs, "repair", "repairs"),
                      latest ? `last ${f.date(latest)}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    aside={
                      <>
                        {vendor.phone && (
                          <a href={`tel:${vendor.phone.replace(/[^\d+]/g, "")}`} aria-label={`Call ${vendor.name}`} title="Call" className={contact}>
                            <Phone size={17} aria-hidden="true" />
                          </a>
                        )}
                        {vendor.email && (
                          <a href={`mailto:${vendor.email}`} aria-label={`Email ${vendor.name}`} title="Email" className={contact}>
                            <Mail size={17} aria-hidden="true" />
                          </a>
                        )}
                        {vendor.website && (
                          <a href={site(vendor.website)} target="_blank" rel="noreferrer" aria-label={`${vendor.name}'s website`} title="Website" className={contact}>
                            <Globe size={17} aria-hidden="true" />
                          </a>
                        )}
                        <RecordMenu entity="vendor" id={vendor.id} name={vendor.name} editTitle="Edit vendor">
                          <VendorForm vendor={vendor} />
                        </RecordMenu>
                      </>
                    }
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
