"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult } from "@atlas/ui/action-result";

import { attempt } from "@/lib/action";
import { addAppliance, addMaintenance, getEverything } from "@/lib/micasa/api";
import { ITEM_TYPE, itemName, planSchema, roomOf, type Plan } from "@/lib/plan";
import { readPlan, savePlan } from "@/lib/plan-store";

/** Saves the plan as drawn in the editor. */
export async function savePlanAction(raw: Plan): Promise<ActionResult<null>> {
  const parsed = planSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "The plan has something Hestia can't save in it." };
  try {
    await savePlan(parsed.data);
  } catch (error) {
    console.error("saving the plan failed", error);
    return { ok: false, error: "The plan didn't save. Try again in a moment." };
  }
  revalidatePath("/plan");
  return { ok: true, data: null, toast: "Plan saved." };
}

async function changeItem(itemId: string, change: (plan: Plan) => Plan): Promise<void> {
  const plan = await readPlan();
  if (!plan.items.some((item) => item.id === itemId)) throw new Error("That thing isn't on the plan any more.");
  await savePlan(change(plan));
}

/**
 * Links a thing on the plan to an appliance: one you have in micasa, or a
 * new one named after it, in the room it's in.
 */
export async function linkApplianceAction(itemId: string, applianceId: string | "new" | null): Promise<ActionResult<null>> {
  const plan = await readPlan();
  const item = plan.items.find((each) => each.id === itemId);
  if (!item) return { ok: false, error: "That thing isn't on the plan any more." };
  return attempt(async () => {
    let id = applianceId;
    if (id === "new") id = (await addAppliance({ name: itemName(item), location: roomOf(item, plan.rooms)?.name ?? "" })).id;
    await changeItem(itemId, (current) => ({ ...current, items: current.items.map((each) => (each.id === itemId ? { ...each, applianceId: id } : each)) }));
    return null;
  }, applianceId === null ? "Unlinked." : applianceId === "new" ? `Added ${itemName(item)} to Appliances.` : "Linked.");
}

/**
 * Adds a thing's usual upkeep as a maintenance item ("Clean the fridge,
 * every 3 months"), for its appliance, or kept with it on the plan.
 */
export async function addSuggestionAction(itemId: string, index: number): Promise<ActionResult<null>> {
  const [plan, everything] = await Promise.all([readPlan(), getEverything()]);
  const item = plan.items.find((each) => each.id === itemId);
  const suggestion = item ? ITEM_TYPE[item.type].suggestions[index] : undefined;
  if (!item || !suggestion) return { ok: false, error: "That suggestion isn't there any more." };
  const category =
    everything.maintenance_categories.find((each) => each.name.toLowerCase() === suggestion.category.toLowerCase()) ?? everything.maintenance_categories[0];
  if (!category) return { ok: false, error: "micasa has no maintenance categories to put it in." };
  const room = roomOf(item, plan.rooms)?.name;
  // Things that aren't appliances get their room in the name, so the list says which sink.
  const name = item.applianceId || ITEM_TYPE[item.type].appliance ? suggestion.name : room ? `${suggestion.name} (${room})` : suggestion.name;
  return attempt(async () => {
    const added = await addMaintenance({ name, category_id: category.id, interval_months: suggestion.months, appliance_id: item.applianceId });
    if (!item.applianceId) {
      await changeItem(itemId, (current) => ({
        ...current,
        items: current.items.map((each) => (each.id === itemId ? { ...each, maintenanceIds: [...each.maintenanceIds, added.id].slice(-30) } : each)),
      }));
    }
    return null;
  }, `Added "${name}", every ${suggestion.months === 1 ? "month" : `${suggestion.months} months`}.`);
}
