"use server";

import { z } from "zod";

import type { ActionResult } from "@atlas/ui/action-result";

import { attempt } from "@/lib/action";
import { today } from "@/lib/dates";
import { firstError, money, optionalDate, text } from "@/lib/inputs";
import { addProject, addQuote, editProject, editQuote, getProject, listVendors } from "@/lib/micasa/api";
import { PROJECT_STATUSES } from "@/lib/micasa/schemas";
import { PROJECT_STATUS } from "@/lib/labels";

/** Moves a project along. Finishing one dates its end today, if it had no end date. */
export async function setProjectStatus(id: string, status: (typeof PROJECT_STATUSES)[number]): Promise<ActionResult<null>> {
  if (!PROJECT_STATUSES.includes(status)) return { ok: false, error: "That isn't a status." };
  const project = await getProject(id);
  const finishing = (status === "completed" || status === "abandoned") && !project.end_date;
  return attempt(
    async () => {
      await editProject(id, { status, ...(finishing ? { end_date: today() } : {}) });
      return null;
    },
    `Moved to ${PROJECT_STATUS[status].label}.`,
  );
}

const projectInput = z.object({
  title: z.string().trim().min(1, "Give it a name."),
  typeId: z.string().min(1, "Pick a type."),
  budget: money("The budget"),
  spent: money("What it cost"),
  start: optionalDate,
  end: optionalDate,
  description: text(),
});

/** A new project, which starts as an idea; or changes to one (`id`). */
export async function saveProjectAction(id: string | null, raw: z.input<typeof projectInput>): Promise<ActionResult<{ id: string }>> {
  const parsed = projectInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { title, typeId, budget, spent, start, end, description } = parsed.data;
  if (start && end && end < start) return { ok: false, error: "It can't finish before it starts." };
  return attempt(
    async () => {
      if (!id) return { id: (await addProject({ title, project_type_id: typeId, status: "ideating", budget_cents: budget, description })).id };
      await editProject(id, { title, project_type_id: typeId, budget_cents: budget, actual_cents: spent, start_date: start, end_date: end, description });
      return { id };
    },
    id ? "Saved." : `Added ${title}.`,
  );
}

const quoteInput = z.object({
  projectId: z.string().min(1),
  vendor: z.string().trim().min(1, "Say who it's from."),
  total: money("The total").refine((cents) => cents !== null, "Give the total."),
  labor: money("Labor"),
  materials: money("Materials"),
  received: optionalDate,
  notes: text(),
});

/** A quote for a project, from a vendor you've used or a new one; or changes to one (`id`). */
export async function saveQuoteAction(id: string | null, raw: z.input<typeof quoteInput>): Promise<ActionResult<null>> {
  const parsed = quoteInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { projectId, vendor, total, labor, materials, received, notes } = parsed.data;
  const known = (await listVendors()).find((each) => each.name.toLowerCase() === vendor.toLowerCase());
  const input = {
    project_id: projectId,
    total_cents: total!,
    labor_cents: labor,
    materials_cents: materials,
    received_date: received,
    notes,
    ...(known ? { vendor_id: known.id } : { vendor_name: vendor }),
  };
  return attempt(
    async () => {
      if (id) await editQuote(id, input);
      else await addQuote(input);
      return null;
    },
    id ? "Saved." : `Added the quote from ${known?.name ?? vendor}.`,
  );
}
