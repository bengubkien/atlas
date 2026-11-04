import { thisDevice } from "./local/device";
import { journalId, newId, type Dose, type JournalEntry, type Measurement, type Medication } from "./model";
import type { Slot } from "./health";

// What you do in Hygeia, as changes to this device's copy.

const empty = { updatedAt: 0, deleted: false };

/** Marks a scheduled dose taken, now. */
export function takeDose(slot: Slot, date: string) {
  const dose: Dose = { ...empty, id: slot.id, medicationId: slot.medication.id, date, time: slot.time, takenAt: Date.now(), skipped: false };
  return thisDevice().put("dose", dose);
}

/** Marks a scheduled dose skipped. */
export function skipDose(slot: Slot, date: string) {
  const dose: Dose = { ...empty, id: slot.id, medicationId: slot.medication.id, date, time: slot.time, takenAt: null, skipped: true };
  return thisDevice().put("dose", dose);
}

/** Takes back "taken" or "skipped". */
export function undoDose(slot: Slot) {
  return slot.dose ? thisDevice().remove("dose", [slot.dose.id]) : Promise.resolve();
}

/** Records a dose of an as-needed medication, now. */
export function logAsNeeded(medication: Medication, date: string) {
  const dose: Dose = { ...empty, id: newId(), medicationId: medication.id, date, time: "", takenAt: Date.now(), skipped: false };
  return thisDevice().put("dose", dose);
}

/** Saves a day's journal entry, merging into what's there. */
export async function saveJournal(date: string, patch: Partial<Pick<JournalEntry, "feeling" | "symptoms" | "note">>) {
  const id = journalId(date);
  const existing = await thisDevice().table("journal").get(id);
  const entry: JournalEntry = {
    ...empty,
    feeling: null,
    symptoms: [],
    note: "",
    ...(existing && !existing.deleted ? existing : {}),
    ...patch,
    id,
    date,
    deleted: false,
  };
  return thisDevice().put("journal", entry);
}

/** Adds a reading. */
export function addReading(reading: Omit<Measurement, "id" | "updatedAt" | "deleted">) {
  return thisDevice().put("measurement", { ...empty, id: newId(), ...reading });
}
