"use server";

import { z } from "zod";

import type { ActionResult } from "@atlas/ui/action-result";

import { attempt } from "@/lib/action";
import { firstError, money, optionalDate, text } from "@/lib/inputs";
import { addAppliance, editAppliance } from "@/lib/micasa/api";

const applianceInput = z.object({
  name: z.string().trim().min(1, "Give it a name."),
  brand: text(200),
  model: text(200),
  serial: text(200),
  location: text(200),
  bought: optionalDate,
  warranty: optionalDate,
  cost: money("What it cost"),
  notes: text(),
});

/** A new appliance (then its page opens), or changes to one (`id`). */
export async function saveApplianceAction(id: string | null, raw: z.input<typeof applianceInput>): Promise<ActionResult<{ id: string }>> {
  const parsed = applianceInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { name, brand, model, serial, location, bought, warranty, cost, notes } = parsed.data;
  const input = {
    name,
    brand,
    model_number: model,
    serial_number: serial,
    location,
    purchase_date: bought,
    warranty_expiry: warranty,
    cost_cents: cost,
    notes,
  };
  return attempt(async () => ({ id: (id ? await editAppliance(id, input) : await addAppliance(input)).id }), id ? "Saved." : `Added ${name}.`);
}
