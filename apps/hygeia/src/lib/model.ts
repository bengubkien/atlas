import { changeParser, recordBase, type Change as SyncChange } from "@atlas/sync/records";
import { z } from "zod";

// Hygeia's records, the same on the phone and on the server, synced by
// @atlas/sync: each has an ID made on the device, the time it last changed
// and a deleted flag (recordBase).
//
// Body weight is stored in kilograms and glucose in mg/dL; Settings decides
// what's shown. Calendar dates are YYYY-MM-DD; moments are milliseconds.

const base = recordBase;
const name = z.string().trim().min(1).max(80);
const text = (max = 200) => z.string().max(max).default("");
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const clockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const time = z.number().int().nonnegative();
const id = z.string().min(1).max(128);
const amount = z.number().min(-1e9).max(1e9);

/** Something you measure: weight, blood pressure, or your own. */
export const measureSchema = z.object({
  ...base,
  name,
  /** As written after a value: "kg", "mmHg", "bpm". */
  unit: text(16),
  /** Two numbers per reading (blood pressure: systolic and diastolic). */
  pair: z.boolean().default(false),
  decimals: z.number().int().min(0).max(3).default(1),
  /** The healthy or target range, either end open. */
  low: amount.nullable().default(null),
  high: amount.nullable().default(null),
  /** The second number's range, for a pair (diastolic: up to 80). */
  low2: amount.nullable().default(null),
  high2: amount.nullable().default(null),
  /** Offered on Today for a quick reading. */
  pinned: z.boolean().default(false),
  notes: text(2000),
});

export const measurementSchema = z.object({
  ...base,
  measureId: id,
  at: time,
  value: amount,
  value2: amount.nullable().default(null),
  note: text(500),
});

export const medicationSchema = z.object({
  ...base,
  name,
  /** As on the box: "10 mg", "1 tablet". */
  dose: text(60),
  /** When to take it each day, "HH:MM"; empty with asNeeded. */
  times: z.array(clockTime).max(8).default([]),
  asNeeded: z.boolean().default(false),
  startDate: date,
  endDate: date.nullable().default(null),
  notes: text(2000),
});

/**
 * One dose: taken or skipped. A scheduled dose's ID is made from the
 * medication, the day and the time, so marking it on two devices gives one
 * record, not two.
 */
export const doseSchema = z.object({
  ...base,
  medicationId: id,
  date,
  /** The scheduled time, or "" for one taken as needed. */
  time: z.union([clockTime, z.literal("")]),
  takenAt: time.nullable().default(null),
  skipped: z.boolean().default(false),
});

/** One per day ("j-YYYY-MM-DD"): how you feel, symptoms, a note. */
export const journalSchema = z.object({
  ...base,
  date,
  /** 1 (awful) to 5 (great). */
  feeling: z.number().int().min(1).max(5).nullable().default(null),
  symptoms: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  note: text(4000),
});

export const appointmentSchema = z.object({
  ...base,
  title: name,
  /** Who it's with: "Dr. Ruiz". */
  with: text(80),
  place: text(160),
  at: time,
  minutes: z.number().int().min(5).max(24 * 60).default(30),
  notes: text(4000),
});

export const labReportSchema = z.object({
  ...base,
  date,
  /** The laboratory or clinic. */
  lab: text(80),
  notes: text(4000),
});

export const labResultSchema = z.object({
  ...base,
  reportId: id,
  /** The test, as on the report: "LDL cholesterol". */
  name,
  value: amount.nullable().default(null),
  /** A result in words, for tests without a number ("Negative"). */
  text: text(80),
  unit: text(24),
  low: amount.nullable().default(null),
  high: amount.nullable().default(null),
});

export const settingsSchema = z.object({
  ...base,
  weightUnit: z.enum(["kg", "lb"]).default("kg"),
  glucoseUnit: z.enum(["mg/dL", "mmol/L"]).default("mg/dL"),
});

export const SCHEMAS = {
  measure: measureSchema,
  measurement: measurementSchema,
  medication: medicationSchema,
  dose: doseSchema,
  journal: journalSchema,
  appointment: appointmentSchema,
  labReport: labReportSchema,
  labResult: labResultSchema,
  settings: settingsSchema,
} as const;

export type Measure = z.infer<typeof measureSchema>;
export type Measurement = z.infer<typeof measurementSchema>;
export type Medication = z.infer<typeof medicationSchema>;
export type Dose = z.infer<typeof doseSchema>;
export type JournalEntry = z.infer<typeof journalSchema>;
export type Appointment = z.infer<typeof appointmentSchema>;
export type LabReport = z.infer<typeof labReportSchema>;
export type LabResult = z.infer<typeof labResultSchema>;
export type Settings = z.infer<typeof settingsSchema>;

export type Kind = keyof typeof SCHEMAS;
export type Change = SyncChange<typeof SCHEMAS>;
export const parseChange = changeParser(SCHEMAS);

export const DEFAULT_SETTINGS: Settings = { id: "settings", updatedAt: 0, deleted: false, weightUnit: "kg", glucoseUnit: "mg/dL" };

/** The ID of a scheduled dose: the same on every device. */
export const doseId = (medicationId: string, date: string, time: string) => `d-${medicationId}-${date}-${time}`;

/** The ID of a day's journal entry. */
export const journalId = (date: string) => `j-${date}`;

export { newId } from "@atlas/sync/records";
