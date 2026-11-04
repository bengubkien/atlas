import { doseId, type Dose, type JournalEntry, type LabReport, type LabResult, type Measurement, type Medication } from "./model";

// Numbers and lists about health, from the records alone. Dates are
// calendar days where you are (YYYY-MM-DD).

export type CalendarDate = string;

/** The local calendar date of a moment. */
export const dayOf = (ms: number): CalendarDate => new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(ms);

/** A date some days away. */
export function addDays(date: CalendarDate, days: number): CalendarDate {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** A moment from a local date and an "HH:MM" time. */
export function at(date: CalendarDate, time: string): number {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const [h, min] = time.split(":").map(Number) as [number, number];
  return new Date(y, m - 1, d, h, min).getTime();
}

/** Whether a medication is meant to be taken on a day. */
export function activeOn(medication: Medication, date: CalendarDate): boolean {
  return !medication.deleted && medication.startDate <= date && (medication.endDate === null || date <= medication.endDate);
}

export type Slot = { medication: Medication; time: string; dose: Dose | undefined; id: string };

/** A day's scheduled doses, by time, each with its record if it was taken or skipped. */
export function slotsFor(date: CalendarDate, medications: Medication[], doses: Dose[]): Slot[] {
  const byId = new Map(doses.filter((dose) => !dose.deleted).map((dose) => [dose.id, dose]));
  return medications
    .filter((medication) => !medication.asNeeded && activeOn(medication, date))
    .flatMap((medication) =>
      medication.times.map((time) => {
        const id = doseId(medication.id, date, time);
        return { medication, time, dose: byId.get(id), id };
      }),
    )
    .sort((a, b) => a.time.localeCompare(b.time) || a.medication.name.localeCompare(b.medication.name));
}

export type Adherence = { taken: number; skipped: number; missed: number; due: number };

/**
 * How a medication was kept over the days from `from` to `to` (included):
 * slots taken, skipped and missed, counting only slots whose time has passed.
 */
export function adherence(medication: Medication, doses: Dose[], from: CalendarDate, to: CalendarDate, now = Date.now()): Adherence {
  const result: Adherence = { taken: 0, skipped: 0, missed: 0, due: 0 };
  if (medication.asNeeded) return result;
  for (let date = from; date <= to; date = addDays(date, 1)) {
    if (!activeOn(medication, date)) continue;
    for (const slot of slotsFor(date, [medication], doses)) {
      if (at(date, slot.time) > now) continue;
      result.due += 1;
      if (slot.dose?.takenAt) result.taken += 1;
      else if (slot.dose?.skipped) result.skipped += 1;
      else result.missed += 1;
    }
  }
  return result;
}

/** A measure's readings, oldest first. */
export function readingsOf(measureId: string, measurements: Measurement[]): Measurement[] {
  return measurements.filter((m) => m.measureId === measureId && !m.deleted).sort((a, b) => a.at - b.at);
}

/**
 * The latest reading and how it compares with the last one at least a week
 * before it: the change in the first number, or null without one.
 */
export function latestWithChange(readings: Measurement[]): { latest: Measurement; change: number | null } | null {
  const latest = readings.at(-1);
  if (!latest) return null;
  const weekBefore = [...readings].reverse().find((reading) => reading.at <= latest.at - 7 * 86_400_000);
  return { latest, change: weekBefore ? latest.value - weekBefore.value : null };
}

/** A lab result against its reference range. */
export function labFlag(result: Pick<LabResult, "value" | "low" | "high">): "low" | "high" | "normal" | null {
  if (result.value === null || (result.low === null && result.high === null)) return null;
  if (result.high !== null && result.value > result.high) return "high";
  if (result.low !== null && result.value < result.low) return "low";
  return "normal";
}

/** A test's name, for matching it across reports: "LDL Cholesterol" and "ldl  cholesterol" are one. */
export const testKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");

export type TestPoint = { report: LabReport; result: LabResult };

/** Every result of one test, across reports, oldest first. */
export function testHistory(key: string, reports: LabReport[], results: LabResult[]): TestPoint[] {
  const byId = new Map(reports.filter((report) => !report.deleted).map((report) => [report.id, report]));
  return results
    .filter((result) => !result.deleted && testKey(result.name) === key && byId.has(result.reportId))
    .map((result) => ({ report: byId.get(result.reportId)!, result }))
    .sort((a, b) => a.report.date.localeCompare(b.report.date));
}

/** The symptoms written in the journal between two days, most frequent first. */
export function symptomCounts(entries: JournalEntry[], from: CalendarDate, to: CalendarDate): { symptom: string; days: number }[] {
  const counts = new Map<string, { symptom: string; days: number }>();
  for (const entry of entries) {
    if (entry.deleted || entry.date < from || entry.date > to) continue;
    for (const symptom of new Set(entry.symptoms.map((each) => each.toLowerCase()))) {
      const seen = counts.get(symptom);
      if (seen) seen.days += 1;
      else counts.set(symptom, { symptom: entry.symptoms.find((each) => each.toLowerCase() === symptom)!, days: 1 });
    }
  }
  return [...counts.values()].sort((a, b) => b.days - a.days || a.symptom.localeCompare(b.symptom));
}
