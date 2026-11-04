"use server";

import { z } from "zod";

import type { ActionResult } from "@atlas/ui/action-result";

import { attempt } from "@/lib/action";
import { today } from "@/lib/dates";
import { addIncident, editIncident } from "@/lib/micasa/api";
import { INCIDENT_SEVERITIES } from "@/lib/micasa/schemas";

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
  location: z.string().trim().default(""),
  applianceId: z.string().default(""),
  description: z.string().trim().default(""),
});

export async function reportIncident(raw: z.input<typeof incidentInput>): Promise<ActionResult<{ id: string }>> {
  const parsed = incidentInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  const { title, severity, location, applianceId, description } = parsed.data;
  return attempt(
    async () => {
      const incident = await addIncident({
        title,
        severity,
        status: "open",
        location,
        description,
        date_noticed: today(),
        appliance_id: applianceId || null,
      });
      return { id: incident.id };
    },
    "Reported.",
  );
}
