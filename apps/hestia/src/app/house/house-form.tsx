"use client";

import { Input } from "@atlas/ui/components/input";

import { FormFooter, useSubmit } from "@/components/dialogs";
import { centsText } from "@/lib/inputs";
import type { House } from "@/lib/micasa/schemas";

import { saveHouseAction, type HouseSection } from "./actions";

type Field = { name: keyof House & string; label: string; placeholder?: string; type?: "date" | "money" | "number" | "decimal"; autoComplete?: string; required?: boolean };

/** Each part of the house's profile, field by field, in rows. */
const SECTIONS: Record<HouseSection, Field[][]> = {
  basics: [
    [{ name: "nickname", label: "Name", placeholder: "The house on Elm Street", required: true }],
    [{ name: "address_line1", label: "Address", autoComplete: "street-address" }],
    [
      { name: "city", label: "City", autoComplete: "address-level2" },
      { name: "state", label: "State or region", autoComplete: "address-level1" },
      { name: "postal_code", label: "Postal code", autoComplete: "postal-code" },
    ],
    [
      { name: "year_built", label: "Built in", type: "number" },
      { name: "bedrooms", label: "Bedrooms", type: "number" },
      { name: "bathrooms", label: "Bathrooms", type: "decimal" },
    ],
    [
      { name: "square_feet", label: "Square feet", type: "number" },
      { name: "lot_square_feet", label: "Lot, square feet", type: "number" },
    ],
  ],
  systems: [
    [
      { name: "heating_type", label: "Heating", placeholder: "Gas boiler" },
      { name: "cooling_type", label: "Cooling", placeholder: "Split units" },
    ],
    [
      { name: "water_source", label: "Water", placeholder: "Mains" },
      { name: "sewer_type", label: "Sewer", placeholder: "Mains" },
    ],
    [
      { name: "wiring_type", label: "Wiring", placeholder: "Copper, 2010" },
      { name: "roof_type", label: "Roof", placeholder: "Clay tiles" },
    ],
    [
      { name: "foundation_type", label: "Foundation" },
      { name: "exterior_type", label: "Exterior", placeholder: "Brick" },
    ],
    [
      { name: "parking_type", label: "Parking", placeholder: "Garage space" },
      { name: "basement_type", label: "Basement", placeholder: "None" },
    ],
  ],
  costs: [
    [
      { name: "insurance_carrier", label: "Insurer" },
      { name: "insurance_policy", label: "Policy number" },
    ],
    [{ name: "insurance_renewal", label: "Renews on", type: "date" }],
    [
      { name: "property_tax_cents", label: "Property tax, a year", type: "money" },
      { name: "hoa_fee_cents", label: "Community fee", type: "money" },
    ],
    [{ name: "hoa_name", label: "Community or HOA" }],
  ],
};

/** What a saved value looks like in its field: "" for nothing, cents as an amount, dates as YYYY-MM-DD. */
function shown(house: House, field: Field): string {
  const value = house[field.name];
  if (value === null || value === undefined || value === 0) return "";
  if (field.type === "money") return centsText(value as number);
  if (field.type === "date") return String(value).slice(0, 10);
  return String(value);
}

/** One part of the house's profile: the basics (also the first-run form), its systems, or its costs and cover. */
export function HouseForm({ house, section, currency }: { house: House; section: HouseSection; currency?: string }) {
  const { error, pending, submit } = useSubmit();
  const rows = SECTIONS[section];
  const action = (form: FormData) =>
    submit(() => saveHouseAction(section, Object.fromEntries(rows.flat().map((field) => [field.name, String(form.get(field.name) ?? "")]))));

  return (
    <form action={action} className="flex flex-col gap-4">
      {rows.map((row) => (
        <div key={row[0]!.name} className={row.length === 3 ? "grid gap-4 sm:grid-cols-3" : row.length === 2 ? "grid gap-4 sm:grid-cols-2" : "contents"}>
          {row.map((field) => (
            <Input
              key={field.name}
              name={field.name}
              label={field.label}
              placeholder={field.placeholder}
              required={field.required}
              type={field.type === "date" ? "date" : "text"}
              inputMode={field.type === "number" ? "numeric" : field.type === "decimal" || field.type === "money" ? "decimal" : undefined}
              hint={field.type === "money" && currency ? `In ${currency}.` : undefined}
              defaultValue={shown(house, field)}
              autoComplete={field.autoComplete ?? "off"}
            />
          ))}
        </div>
      ))}
      <FormFooter error={error} pending={pending} label="Save" pendingLabel="Saving…" />
    </form>
  );
}
