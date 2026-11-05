"use client";

import { useSyncInfo, type SyncInfo } from "@atlas/sync/react";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";

import { mergeMeasures } from "../measures";
import {
  DEFAULT_SETTINGS,
  type Appointment,
  type Attachment,
  type Dose,
  type JournalEntry,
  type LabReport,
  type LabResult,
  type Measure,
  type Measurement,
  type Medication,
  type Settings,
  type Spot,
  type Symptom,
} from "../model";
import { thisDevice } from "./device";

// Screens read this device's copy through these hooks; they update by
// themselves when anything changes, here or from a sync. `undefined` means
// still loading (a few milliseconds on first paint).

const alive = <T extends { deleted: boolean }>(records: T[]) => records.filter((record) => !record.deleted);

export function useSettings(): Settings {
  // Defaults first: a record saved before a setting existed doesn't have it.
  const saved = useLiveQuery(() => thisDevice().table("settings").get("settings"), []);
  return { ...DEFAULT_SETTINGS, ...saved };
}

/** The built-in measures and your own. */
export function useMeasures(): Measure[] | undefined {
  const own = useLiveQuery(() => thisDevice().table("measure").toArray(), []);
  return useMemo(() => (own ? mergeMeasures(own) : undefined), [own]);
}

/** Every reading, oldest first. */
export function useMeasurements(): Measurement[] | undefined {
  return useLiveQuery(async () => alive(await thisDevice().table("measurement").toArray()).sort((a, b) => a.at - b.at), []);
}

/** Medications, by name. */
export function useMedications(): Medication[] | undefined {
  return useLiveQuery(async () => alive(await thisDevice().table("medication").toArray()).sort((a, b) => a.name.localeCompare(b.name)), []);
}

export function useDoses(): Dose[] | undefined {
  return useLiveQuery(async () => alive(await thisDevice().table("dose").toArray()), []);
}

/** Journal entries, newest first. */
export function useJournal(): JournalEntry[] | undefined {
  return useLiveQuery(async () => alive(await thisDevice().table("journal").toArray()).sort((a, b) => b.date.localeCompare(a.date)), []);
}

/** Appointments, soonest first. */
export function useAppointments(): Appointment[] | undefined {
  return useLiveQuery(async () => alive(await thisDevice().table("appointment").toArray()).sort((a, b) => a.at - b.at), []);
}

/** Lab reports, newest first. */
export function useLabReports(): LabReport[] | undefined {
  return useLiveQuery(async () => alive(await thisDevice().table("labReport").toArray()).sort((a, b) => b.date.localeCompare(a.date)), []);
}

export function useLabResults(): LabResult[] | undefined {
  return useLiveQuery(async () => alive(await thisDevice().table("labResult").toArray()), []);
}

/** The spots you follow, newest first. */
export function useSpots(): Spot[] | undefined {
  return useLiveQuery(async () => alive(await thisDevice().table("spot").toArray()).sort((a, b) => b.at - a.at), []);
}

/** The files attached to one record, newest first. */
export function useAttachments(ownerId: string): Attachment[] | undefined {
  return useLiveQuery(async () => alive(await thisDevice().table("attachment").where("ownerId").equals(ownerId).toArray()).sort((a, b) => b.at - a.at), [ownerId]);
}

/** Symptoms on the body map, newest first. */
export function useSymptoms(): Symptom[] | undefined {
  return useLiveQuery(async () => alive(await thisDevice().table("symptom").toArray()).sort((a, b) => b.at - a.at), []);
}

export type { SyncInfo };

/** This device's sync state, live. */
export function useSync(): SyncInfo | undefined {
  return useSyncInfo(thisDevice);
}
