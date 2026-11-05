import { describe, expect, it } from "vitest";

import { buildCalendar, escapeText, fold } from "./calendar";
import { activeOn, addDays, adherence, at, labFlag, latestWithChange, scheduleDays, slotsFor, symptomCounts, testHistory, testKey, weekday } from "./health";
import { BLOOD_PRESSURE, BUILT_IN_MEASURES, display, mergeMeasures, readingText, standing, WEIGHT } from "./measures";
import { DEFAULT_SETTINGS, doseId, parseChange, type Appointment, type Dose, type LabReport, type LabResult, type Measurement, type Medication } from "./model";

const med = (fields: Partial<Medication> = {}): Medication => ({
  id: "med1",
  updatedAt: 1,
  deleted: false,
  name: "Vitamin D",
  dose: "1000 IU",
  times: ["08:00", "20:00"],
  asNeeded: false,
  days: [],
  startDate: "2026-11-01",
  endDate: null,
  notes: "",
  ...fields,
});
const dose = (date: string, time: string, fields: Partial<Dose> = {}): Dose => ({
  id: doseId("med1", date, time),
  updatedAt: 1,
  deleted: false,
  medicationId: "med1",
  date,
  time,
  takenAt: at(date, time),
  skipped: false,
  ...fields,
});
const reading = (atMs: number, value: number, value2: number | null = null): Measurement => ({
  id: `r${atMs}`,
  updatedAt: 1,
  deleted: false,
  measureId: WEIGHT,
  at: atMs,
  value,
  value2,
  note: "",
});

describe("medications on some days of the week", () => {
  // 2026-11-02 is a Monday.
  const mwf = med({ days: [1, 3, 5], times: ["08:00"] });
  it("are due on their days only, and counted only then", () => {
    expect(weekday("2026-11-02")).toBe(1);
    expect(["2026-11-02", "2026-11-03", "2026-11-04"].map((date) => slotsFor(date, [mwf], []).length)).toEqual([1, 0, 1]);
    expect(activeOn(mwf, "2026-11-03")).toBe(true); // still a current medication on its days off
    const kept = adherence(mwf, [dose("2026-11-02", "08:00")], "2026-11-02", "2026-11-08", at("2026-11-09", "00:00"));
    expect(kept).toEqual({ taken: 1, skipped: 0, missed: 2, due: 3 });
  });
  it("say their days plainly", () => {
    const name = (day: number) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day]!;
    expect([[], [1, 3, 5], [1, 2, 3, 4, 5], [0, 6], [0, 1, 2, 3, 4, 5, 6]].map((days) => scheduleDays(days, name))).toEqual(["Every day", "Mon, Wed, Fri", "Weekdays", "Weekends", "Every day"]);
  });
  it("repeat weekly on their days in the calendar, from the first of them", () => {
    const feed = buildCalendar({ medications: [med({ days: [2, 4], times: ["08:00"], startDate: "2026-11-02" })], appointments: [], now: at("2026-11-02", "09:00") });
    expect(feed).toContain("DTSTART:20261103T080000");
    expect(feed).toContain("RRULE:FREQ=WEEKLY;BYDAY=TU,TH");
    expect(parseChange({ kind: "medication", record: { id: "m", updatedAt: 1, name: "X", times: ["08:00"], startDate: "2026-11-04" } })?.record).toMatchObject({ days: [] });
  });
});

describe("medications", () => {
  it("lays out a day's doses by time, with what was taken", () => {
    const slots = slotsFor("2026-11-04", [med(), med({ id: "med2", name: "Aspirin", times: ["08:00"] })], [dose("2026-11-04", "08:00")]);
    expect(slots.map((slot) => `${slot.time} ${slot.medication.name} ${slot.dose ? "taken" : "-"}`)).toEqual([
      "08:00 Aspirin -",
      "08:00 Vitamin D taken",
      "20:00 Vitamin D -",
    ]);
  });

  it("knows when a medication is on, and leaves out as-needed ones", () => {
    expect(activeOn(med({ endDate: "2026-11-03" }), "2026-11-04")).toBe(false);
    expect(activeOn(med(), "2026-10-31")).toBe(false);
    expect(slotsFor("2026-11-04", [med({ asNeeded: true, times: [] })], [])).toEqual([]);
  });

  it("counts adherence from doses whose time has passed", () => {
    const doses = [dose("2026-11-01", "08:00"), dose("2026-11-01", "20:00"), dose("2026-11-02", "08:00", { takenAt: null, skipped: true })];
    const now = at("2026-11-03", "12:00");
    expect(adherence(med(), doses, "2026-11-01", "2026-11-03", now)).toEqual({ taken: 2, skipped: 1, missed: 2, due: 5 });
  });

  it("gives a scheduled dose the same ID on every device", () => {
    expect(doseId("med1", "2026-11-04", "08:00")).toBe("d-med1-2026-11-04-08:00");
  });
});

describe("measurements", () => {
  const day = 86_400_000;
  it("compares the latest reading with one at least a week before", () => {
    const readings = [reading(0, 80), reading(3 * day, 79.5), reading(8 * day, 79)];
    expect(latestWithChange(readings)).toMatchObject({ latest: { value: 79 }, change: -1 });
    expect(latestWithChange([reading(0, 80)])!.change).toBeNull();
    expect(latestWithChange([])).toBeNull();
  });

  it("shows weight and glucose in your units, everything else as stored", () => {
    const weight = BUILT_IN_MEASURES.find((m) => m.id === WEIGHT)!;
    expect(readingText(weight, { value: 72.4, value2: null }, DEFAULT_SETTINGS, "en-US")).toBe("72.4 kg");
    const lb = { ...DEFAULT_SETTINGS, weightUnit: "lb" as const };
    expect(readingText(weight, { value: 72.4, value2: null }, lb, "en-US")).toBe("159.6 lb");
    expect(display(weight, lb).toStored(159.6)).toBeCloseTo(72.39, 1);
    const bp = BUILT_IN_MEASURES.find((m) => m.id === BLOOD_PRESSURE)!;
    expect(readingText(bp, { value: 118, value2: 76 }, DEFAULT_SETTINGS, "en-US")).toBe("118/76 mmHg");
  });

  it("places a reading against the range, both numbers for blood pressure", () => {
    const bp = BUILT_IN_MEASURES.find((m) => m.id === BLOOD_PRESSURE)!;
    expect(standing(bp, { value: 118, value2: 76 })).toBe("in");
    expect(standing(bp, { value: 118, value2: 85 })).toBe("high");
    expect(standing(BUILT_IN_MEASURES.find((m) => m.id === WEIGHT)!, { value: 80, value2: null })).toBeNull();
  });

  it("lets your edit of a built-in measure win, and hides deleted ones", () => {
    const edited = { ...BUILT_IN_MEASURES[0]!, low: 70, high: 75, updatedAt: 5 };
    const merged = mergeMeasures([edited, { ...BUILT_IN_MEASURES[3]!, deleted: true }]);
    expect(merged.find((m) => m.id === WEIGHT)!.high).toBe(75);
    expect(merged).toHaveLength(BUILT_IN_MEASURES.length - 1);
  });
});

describe("lab results and the journal", () => {
  const report = (id: string, date: string): LabReport => ({ id, updatedAt: 1, deleted: false, date, lab: "Lab", notes: "" });
  const result = (reportId: string, name: string, value: number): LabResult => ({
    id: `${reportId}-${name}`,
    updatedAt: 1,
    deleted: false,
    reportId,
    name,
    value,
    text: "",
    unit: "mg/dL",
    low: null,
    high: 100,
  });

  it("flags results against their range", () => {
    expect(labFlag({ value: 130, low: null, high: 100 })).toBe("high");
    expect(labFlag({ value: 3, low: 4, high: 10 })).toBe("low");
    expect(labFlag({ value: 5, low: 4, high: 10 })).toBe("normal");
    expect(labFlag({ value: null, low: 4, high: 10 })).toBeNull();
  });

  it("follows one test across reports, however its name is written", () => {
    const history = testHistory(
      testKey("LDL cholesterol"),
      [report("r2", "2026-06-01"), report("r1", "2026-01-10")],
      [result("r1", "LDL Cholesterol", 140), result("r2", "ldl  cholesterol", 118), result("r2", "HDL", 50)],
    );
    expect(history.map((point) => point.result.value)).toEqual([140, 118]);
  });

  it("counts symptoms by the days they were written", () => {
    const entry = (date: string, symptoms: string[]) => ({ id: `j-${date}`, updatedAt: 1, deleted: false, date, feeling: 3, symptoms, note: "" });
    expect(symptomCounts([entry("2026-11-01", ["Headache"]), entry("2026-11-02", ["headache", "Cough"])], "2026-11-01", "2026-11-03")).toEqual([
      { symptom: "Headache", days: 2 },
      { symptom: "Cough", days: 1 },
    ]);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("checks records from the other side", () => {
    expect(parseChange({ kind: "journal", record: { id: "j-2026-11-04", updatedAt: 1, date: "2026-11-04", feeling: 9 } })).toBeNull();
    expect(parseChange({ kind: "medication", record: { id: "m", updatedAt: 1, name: "X", times: ["8:00"], startDate: "2026-11-04" } })).toBeNull();
    expect(parseChange({ kind: "medication", record: { id: "m", updatedAt: 1, name: "X", times: ["08:00"], startDate: "2026-11-04" } })).not.toBeNull();
  });
});

describe("the calendar feed", () => {
  const appointment: Appointment = {
    id: "a1",
    updatedAt: 1,
    deleted: false,
    title: "Dentist, check-up; bring X-rays",
    with: "Dr. Ruiz",
    place: "Calle Mayor 1, Madrid",
    at: Date.UTC(2026, 10, 20, 9, 30),
    minutes: 45,
    notes: "",
  };

  it("escapes text and folds long lines at 75 octets", () => {
    expect(escapeText("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
    const long = `SUMMARY:${"ñ".repeat(60)}`;
    const folded = fold(long);
    expect(folded.split("\r\n ").every((part) => new TextEncoder().encode(part).length <= 75)).toBe(true);
    expect(folded.replace(/\r\n /g, "")).toBe(long);
  });

  it("repeats each medication time daily until its end, and dates appointments exactly, with alerts", () => {
    const ics = buildCalendar({
      medications: [med({ endDate: "2026-12-31" }), med({ id: "gone", deleted: true }), med({ id: "prn", asNeeded: true, times: [] })],
      appointments: [appointment],
      now: Date.UTC(2026, 10, 4),
    });
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(3);
    expect(ics).toContain("DTSTART:20261101T080000\r\n");
    expect(ics).toContain("RRULE:FREQ=DAILY;UNTIL=20261231T235900\r\n");
    expect(ics).toContain("SUMMARY:Take Vitamin D (1000 IU)\r\n");
    expect(ics).toContain("DTSTART:20261120T093000Z\r\nDTEND:20261120T101500Z");
    expect(ics).toContain("SUMMARY:Dentist\\, check-up\\; bring X-rays");
    expect(ics).toContain("TRIGGER:-P1D");
    expect(ics).not.toContain("gone");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
});
