"use server";

import { z } from "zod";

import type { ActionResult } from "@atlas/ui/action-result";

import { attempt } from "@/lib/action";
import { today } from "@/lib/dates";
import { addIncident, editIncident } from "@/lib/micasa/api";
import { firstError, money, optionalDate, text } from "@/lib/inputs";
import { INCIDENT_SEVERITIES, INCIDENT_STATUSES } from "@/lib/micasa/schemas";

/** Marks an issue fixed, today. */
export async function resolveIncident(id: string): Promise<ActionResult<null>> {
  return attempt(async () => {
    await editIncident(id, { status: "resolved", date_resolved: today() });
    return null;
  }, "Marked as fixed.");
}

/** Marks an issue as being fixed. */
export async function startIncident(id: string): Promise<ActionResult<null>> {
  return attempt(async () => {
    await editIncident(id, { status: "in_progress" });
    return null;
  }, "Marked as being fixed.");
}

const incidentInput = z.object({
  title: z.string().trim().min(1, "Say what's wrong."),
  severity: z.enum(INCIDENT_SEVERITIES),
  status: z.enum(["", ...INCIDENT_STATUSES]).default(""),
  location: text(200),
  applianceId: z.string().default(""),
  vendorId: z.string().default(""),
  noticed: optionalDate,
  resolved: optionalDate,
  cost: money("What it cost"),
  description: text(),
});

/**
 * Reports an issue (noticed today, open), or changes one (`id`): who fixed
 * it, when, and for how much. Marking it fixed without a date dates it today.
 */
export async function saveIncidentAction(id: string | null, raw: z.input<typeof incidentInput>): Promise<ActionResult<{ id: string }>> {
  const parsed = incidentInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { title, severity, status, location, applianceId, vendorId, noticed, resolved, cost, description } = parsed.data;
  if (!id) {
    return attempt(
      async () => ({
        id: (await addIncident({ title, severity, status: "open", location, description, date_noticed: today(), appliance_id: applianceId || null })).id,
      }),
      "Reported.",
    );
  }
  const fixed = status === "resolved";
  return attempt(
    async () => {
      await editIncident(id, {
        title,
        severity,
        ...(status ? { status } : {}),
        location,
        description,
        appliance_id: applianceId || null,
        vendor_id: vendorId || null,
        ...(noticed ? { date_noticed: noticed } : {}),
        date_resolved: fixed ? (resolved ?? today()) : null,
        cost_cents: cost,
      });
      return { id };
    },
    "Saved.",
  );
}
