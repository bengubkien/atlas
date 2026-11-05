"use server";

import { z } from "zod";

import type { ActionResult } from "@atlas/ui/action-result";

import { attempt } from "@/lib/action";
import { firstError, money, optionalDate, text } from "@/lib/inputs";
import { saveHouse } from "@/lib/micasa/api";

const number = (label: string, { decimals = false, max = 1_000_000 } = {}) =>
  z
    .string()
    .trim()
    .default("")
    .transform((value, context) => {
      if (!value) return null;
      const parsed = Number(value.replace(",", "."));
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > max || (!decimals && !Number.isInteger(parsed))) {
        context.addIssue({ code: "custom", message: `${label} isn't a number Hestia can save.` });
        return z.NEVER;
      }
      return parsed;
    });

const short = text(200);

/** The house profile in three parts, each with its own form: what's in one is all it saves. */
const SECTIONS = {
  basics: z.object({
    nickname: z.string().trim().min(1, "Give the house a name, like its street."),
    address_line1: short,
    city: short,
    state: short,
    postal_code: short,
    year_built: number("The year it was built", { max: 3000 }),
    square_feet: number("The size"),
    lot_square_feet: number("The lot's size", { max: 100_000_000 }),
    bedrooms: number("Bedrooms", { max: 100 }),
    bathrooms: number("Bathrooms", { decimals: true, max: 100 }),
  }),
  systems: z.object({
    heating_type: short,
    cooling_type: short,
    water_source: short,
    sewer_type: short,
    wiring_type: short,
    roof_type: short,
    foundation_type: short,
    exterior_type: short,
    parking_type: short,
    basement_type: short,
  }),
  costs: z.object({
    insurance_carrier: short,
    insurance_policy: short,
    insurance_renewal: optionalDate,
    property_tax_cents: money("The property tax"),
    hoa_name: short,
    hoa_fee_cents: money("The HOA fee"),
  }),
};

export type HouseSection = keyof typeof SECTIONS;

export async function saveHouseAction(section: HouseSection, raw: Record<string, string>): Promise<ActionResult<null>> {
  const schema = SECTIONS[section];
  if (!schema) return { ok: false, error: "That isn't part of the house." };
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  return attempt(async () => {
    await saveHouse(parsed.data);
    return null;
  }, "Saved.");
}
