"use server";

import type { ActionResult } from "@atlas/ui/action-result";

import { attempt } from "@/lib/action";
import { deleteRecord, ENTITIES, restoreRecord, type Entity } from "@/lib/micasa/api";

// Deleting any kind of record, and undoing it. micasa keeps a deleted record,
// marked deleted, so Undo brings it back as it was.

const valid = (entity: Entity, id: string) => ENTITIES.includes(entity) && /^[0-9A-HJKMNP-TV-Z]{26}$/.test(id);

export async function deleteRecordAction(entity: Entity, id: string): Promise<ActionResult<null>> {
  if (!valid(entity, id)) return { ok: false, error: "That isn't a record Hestia knows." };
  return attempt(async () => {
    await deleteRecord(entity, id);
    return null;
  });
}

export async function restoreRecordAction(entity: Entity, id: string): Promise<ActionResult<null>> {
  if (!valid(entity, id)) return { ok: false, error: "That isn't a record Hestia knows." };
  return attempt(async () => {
    await restoreRecord(entity, id);
    return null;
  }, "Put back.");
}
