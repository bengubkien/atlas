"use server";

import { z } from "zod";

import type { ActionResult } from "@atlas/ui/action-result";

import { attempt } from "@/lib/action";
import { addMonths, calendarDate } from "@/lib/dates";
import { formatters } from "@/lib/format";
import { firstError, money, requiredDate, text } from "@/lib/inputs";
import { addMaintenance, editMaintenance, editService, getMaintenance, listVendors, logService } from "@/lib/micasa/api";
import { SEASONS } from "@/lib/micasa/schemas";

const serviceInput = z.object({
  itemId: z.string().min(1),
  date: requiredDate,
  cost: money("The cost"),
  vendor: z.string().trim().default(""),
  notes: text(),
});

/** A vendor typed by name: an existing one, matched whatever the case, or a new one micasa adds. */
async function vendorFields(name: string): Promise<{ vendor_id?: string | null; vendor_name?: string }> {
  if (!name) return {};
  const known = (await listVendors()).find((each) => each.name.toLowerCase() === name.toLowerCase());
  return known ? { vendor_id: known.id } : { vendor_name: name };
}

/**
 * Records a service, or corrects one (`entryId`). A vendor typed by name is
 * matched to an existing one, or added; on a correction, an empty name means
 * you did it yourself.
 */
export async function saveServiceAction(entryId: string | null, raw: z.input<typeof serviceInput>): Promise<ActionResult<{ nextDue: string | null }>> {
  const parsed = serviceInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { itemId, date: servicedAt, cost, vendor, notes } = parsed.data;
  const [item, vendorInput, f] = await Promise.all([getMaintenance(itemId), vendorFields(vendor), formatters()]);

  if (entryId) {
    return attempt(
      async () => {
        await editService(entryId, { serviced_at: servicedAt, cost_cents: cost, notes, ...(vendor ? vendorInput : { vendor_id: null }) } as Parameters<typeof editService>[1]);
        return { nextDue: null };
      },
      "Saved.",
    );
  }

  return attempt(
    async () => {
      await logService({ maintenance_item_id: itemId, serviced_at: servicedAt, cost_cents: cost, notes, ...(vendorInput as { vendor_id?: string; vendor_name?: string }) });
      // micasa keeps "last serviced" at the latest service, which may be an
      // earlier one than this; a fixed due date stays as it was.
      const previous = calendarDate(item.last_serviced_at);
      const latest = previous && previous > servicedAt ? previous : servicedAt;
      const nextDue = item.due_date ? null : item.interval_months > 0 ? addMonths(latest, item.interval_months) : null;
      return { nextDue };
    },
    ({ nextDue }) => (nextDue ? `Logged. Next due ${f.longDate(nextDue)}.` : "Logged."),
  );
}

const itemInput = z.object({
  name: z.string().trim().min(1, "Give it a name."),
  categoryId: z.string().min(1, "Pick a category."),
  every: z.string().trim().default(""),
  dueDate: z.string().default(""),
  applianceId: z.string().default(""),
  season: z.enum(["", ...SEASONS]).default(""),
  cost: money("The usual cost"),
  notes: text(),
});

/** A new maintenance item, or changes to one (`id`): every N months, or once by a date. */
export async function saveMaintenanceAction(id: string | null, raw: z.input<typeof itemInput>): Promise<ActionResult<{ id: string }>> {
  const parsed = itemInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { name, categoryId, every, dueDate, applianceId, season, cost, notes } = parsed.data;

  const months = every ? Number(every) : 0;
  if (!Number.isInteger(months) || months < 0 || months > 120) {
    return { ok: false, error: "How often is a number of months, from 1 to 120." };
  }
  if (!months && !dueDate) return { ok: false, error: "Say how often it's due, or the date it's due once." };

  const input = {
    name,
    category_id: categoryId,
    interval_months: months,
    due_date: months ? null : dueDate,
    appliance_id: applianceId || null,
    season,
    cost_cents: cost,
    notes,
  };
  return attempt(
    async () => ({ id: (id ? await editMaintenance(id, input) : await addMaintenance(input)).id }),
    id ? "Saved." : `Added ${name}.`,
  );
}
