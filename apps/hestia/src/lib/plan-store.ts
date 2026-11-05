import "server-only";

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { micasaConfig } from "./micasa/run";
import { EMPTY_PLAN, planSchema, type Plan } from "./plan";

// The floor plan is Hestia's only data of its own: micasa has nowhere to keep
// it (its documents belong to projects, appliances and the like, not to the
// house). It's a small JSON file next to micasa's database, in the same
// volume, so the backups take it with the house (deploy/backup).
//
// HESTIA_PLAN_PATH: the file (default: hestia-plan.json beside MICASA_DB_PATH).

export const planPath = () => process.env.HESTIA_PLAN_PATH || path.join(path.dirname(micasaConfig().db), "hestia-plan.json");

/** The plan, or an empty one before any is drawn. A file that doesn't read as a plan is an error, not an empty plan. */
export async function readPlan(): Promise<Plan> {
  let text: string;
  try {
    text = await readFile(/*turbopackIgnore: true*/ planPath(), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return EMPTY_PLAN;
    throw error;
  }
  return planSchema.parse(JSON.parse(text));
}

/** Saves the plan: written beside it first, then moved into place, so a crash never leaves half a file. */
export async function savePlan(plan: Plan): Promise<void> {
  const file = planPath();
  await mkdir(/*turbopackIgnore: true*/ path.dirname(file), { recursive: true });
  const part = `${file}.part`;
  await writeFile(/*turbopackIgnore: true*/ part, JSON.stringify(planSchema.parse(plan), null, 2));
  await rename(/*turbopackIgnore: true*/ part, file);
}
