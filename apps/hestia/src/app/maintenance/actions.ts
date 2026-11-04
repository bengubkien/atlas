"use server";

import { z } from "zod";

import type { ActionResult } from "@atlas/ui/action-result";
import { parseMoney } from "@atlas/ui/format";

import { attempt } from "@/lib/action";
import { addMonths, calendarDate } from "@/lib/dates";
import { formatters } from "@/lib/format";
import { addMaintenance, getMaintenance, listVendors, logService } from "@/lib/micasa/api";
import { SEASONS } from "@/lib/micasa/schemas";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date.");

const serviceInput = z.object({
  itemId: z.string().min(1),
  date,
  cost: z.string().default(""),
  vendor: z.string().trim().default(""),
  notes: z.string().trim().default(""),
});

/** Cents, or an answer saying the amount isn't one. */
function money(input: string): number | null | { error: string } {
  const cents = parseMoney(input);
  return cents === "invalid" ? { error: "The cost isn't an amount: use digits, like 45.50." } : cents;
}

/** Records a service. A vendor typed by name is matched to an existing one, or added. */
export async function logServiceAction(raw: z.input<typeof serviceInput>): Promise<ActionResult<{ nextDue: string | null }>> {
  const parsed = serviceInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  const { itemId, date: servicedAt, cost, vendor, notes } = parsed.data;

  const cents = money(cost);
  if (cents && typeof cents === "object") return { ok: false, error: cents.error };

  const [item, vendors, f] = await Promise.all([getMaintenance(itemId), listVendors(), formatters()]);
  const known = vendors.find((each) => each.name.toLowerCase() === vendor.toLowerCase());

  return attempt(
    async () => {
      await logService({
        maintenance_item_id: itemId,
        serviced_at: servicedAt,
        cost_cents: cents,
        notes,
        ...(known ? { vendor_id: known.id } : vendor ? { vendor_name: vendor } : {}),
      });
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
  notes: z.string().trim().default(""),
});

/** A new maintenance item: every N months, or once by a date. */
export async function addMaintenanceAction(raw: z.input<typeof itemInput>): Promise<ActionResult<{ id: string }>> {
  const parsed = itemInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  const { name, categoryId, every, dueDate, applianceId, season, notes } = parsed.data;

  const months = every ? Number(every) : 0;
  if (!Number.isInteger(months) || months < 0 || months > 120) {
    return { ok: false, error: "How often is a number of months, from 1 to 120." };
  }
  if (!months && !dueDate) return { ok: false, error: "Say how often it's due, or the date it's due once." };

  return attempt(
    async () => {
      const item = await addMaintenance({
        name,
        category_id: categoryId,
        interval_months: months,
        due_date: months ? null : dueDate,
        appliance_id: applianceId || null,
        season,
        notes,
      });
      return { id: item.id };
    },
    `Added ${name}.`,
  );
}
