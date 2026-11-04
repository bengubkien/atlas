import type { Metadata } from "next";

import { PageBody, PageHeader } from "@atlas/ui/components/page-header";
import { Panel } from "@atlas/ui/components/panel";

import { Facts } from "@/components/facts";
import { calendarDate } from "@/lib/dates";
import { formatters } from "@/lib/format";
import { getHouse } from "@/lib/micasa/api";

import { HouseForm } from "./house-form";

export const metadata: Metadata = { title: "Your house" };

const count = (value: number | null | undefined) => (value ? String(value) : "");

export default async function HousePage() {
  const [house, f] = await Promise.all([getHouse(), formatters()]);

  if (!house.id) {
    return (
      <>
        <PageHeader title="Your house" description="Start with the basics. Everything else in Hestia hangs off this house." />
        <PageBody>
          <div className="max-w-[640px] rounded-panel border border-line-card bg-card p-4 lg:p-7">
            <HouseForm house={house} inline />
          </div>
        </PageBody>
      </>
    );
  }

  const renewal = calendarDate(house.insurance_renewal);
  const address = [house.address_line1, house.address_line2, [house.postal_code, house.city].filter(Boolean).join(" "), house.state]
    .filter(Boolean)
    .join(", ");

  return (
    <>
      <PageHeader title={house.nickname || "Your house"} description={address || undefined} actions={<HouseForm house={house} />} />
      <PageBody className="lg:grid lg:grid-cols-2 lg:items-start">
        <Panel title="The house">
          <Facts
            items={[
              ["Built in", count(house.year_built)],
              ["Size", house.square_feet ? `${house.square_feet.toLocaleString(f.locale)} sq ft` : ""],
              ["Lot", house.lot_square_feet ? `${house.lot_square_feet.toLocaleString(f.locale)} sq ft` : ""],
              ["Bedrooms", count(house.bedrooms)],
              ["Bathrooms", count(house.bathrooms)],
              ["Parking", house.parking_type],
              ["Basement", house.basement_type],
            ]}
          />
        </Panel>
        <Panel title="Systems">
          <Facts
            items={[
              ["Heating", house.heating_type],
              ["Cooling", house.cooling_type],
              ["Water", house.water_source],
              ["Sewer", house.sewer_type],
              ["Wiring", house.wiring_type],
              ["Roof", house.roof_type],
              ["Foundation", house.foundation_type],
              ["Exterior", house.exterior_type],
            ]}
          />
        </Panel>
        <Panel title="Costs and cover">
          <Facts
            items={[
              ["Insurance", [house.insurance_carrier, house.insurance_policy].filter(Boolean).join(", ")],
              ["Renews", renewal ? f.longDate(renewal) : ""],
              ["Property tax", f.money(house.property_tax_cents)],
              ["HOA", [house.hoa_name, f.money(house.hoa_fee_cents)].filter(Boolean).join(", ")],
            ]}
          />
        </Panel>
      </PageBody>
    </>
  );
}
