"use server";

import { z } from "zod";

import type { ActionResult } from "@atlas/ui/action-result";
import { parseMoney } from "@atlas/ui/format";

import { attempt } from "@/lib/action";
import { today } from "@/lib/dates";
import { addProject, editProject, getProject } from "@/lib/micasa/api";
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
  budget: z.string().default(""),
  description: z.string().trim().default(""),
});

export async function addProjectAction(raw: z.input<typeof projectInput>): Promise<ActionResult<{ id: string }>> {
  const parsed = projectInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  const budget = parseMoney(parsed.data.budget);
  if (budget === "invalid") return { ok: false, error: "The budget isn't an amount: use digits, like 2500." };
  return attempt(
    async () => {
      const project = await addProject({
        title: parsed.data.title,
        project_type_id: parsed.data.typeId,
        status: "ideating",
        budget_cents: budget,
        description: parsed.data.description,
      });
      return { id: project.id };
    },
    `Added ${parsed.data.title}.`,
  );
}
