import { describe, expect, it } from "vitest";

import { at } from "./health";
import { doseId, type Appointment, type Dose, type Medication } from "./model";
import { hygeiaToday } from "./today";

const med = (fields: Partial<Medication> = {}): Medication => ({
  id: "med1",
  updatedAt: 1,
  deleted: false,
  name: "Metformin",
  dose: "500 mg",
  times: ["08:00", "20:00"],
  asNeeded: false,
  startDate: "2026-11-01",
  endDate: null,
  notes: "",
  ...fields,
});
const taken = (medicationId: string, date: string, time: string, fields: Partial<Dose> = {}): Dose => ({
  id: doseId(medicationId, date, time),
  updatedAt: 1,
  deleted: false,
  medicationId,
  date,
  time,
  takenAt: at(date, time),
  skipped: false,
  ...fields,
});
const visit = (fields: Partial<Appointment>): Appointment => ({
  id: "ap1",
  updatedAt: 1,
  deleted: false,
  title: "Check-up",
  with: "Dr. Ruiz",
  place: "",
  at: at("2026-11-04", "15:30"),
  minutes: 30,
  notes: "",
  ...fields,
});

const noon = at("2026-11-04", "12:00");

describe("Hygeia's answer to Atlas's Today", () => {
  it("lists late doses first, then today's appointments, the doses to come, and tomorrow's", () => {
    const report = hygeiaToday(
      [med(), med({ id: "med2", name: "Vitamin D", dose: "", times: ["13:00"] })],
      [],
      [visit({}), visit({ id: "ap2", title: "Dentist", with: "", at: at("2026-11-05", "09:00") })],
      "en-US",
      noon,
    );
    expect(report.summary).toBe("0 of 3 doses taken today. An appointment today.");
    expect(report.items).toEqual([
      { title: "Metformin 500 mg", detail: "8:00 AM, not taken yet", href: "/", tone: "overdue" },
      { title: "Check-up", detail: "Today 3:30 PM, Dr. Ruiz", href: "/appointments", tone: "soon" },
      { title: "Vitamin D", detail: "1:00 PM", href: "/", tone: "soon" },
      { title: "Metformin 500 mg", detail: "8:00 PM", href: "/" },
      { title: "Dentist", detail: "Tomorrow 9:00 AM", href: "/appointments" },
    ]);
  });

  it("leaves out doses taken or skipped, and counts the taken ones", () => {
    const report = hygeiaToday(
      [med()],
      [taken("med1", "2026-11-04", "08:00"), taken("med1", "2026-11-04", "20:00", { takenAt: null, skipped: true })],
      [],
      "en-US",
      noon,
    );
    expect(report.summary).toBe("1 of 2 doses taken today.");
    expect(report.items).toEqual([]);
  });

  it("ignores as-needed and finished medications, past and deleted appointments", () => {
    const report = hygeiaToday(
      [med({ asNeeded: true, times: [] }), med({ id: "med3", endDate: "2026-11-03" })],
      [],
      [visit({ at: at("2026-11-04", "09:00") }), visit({ id: "ap3", deleted: true }), visit({ id: "ap4", at: at("2026-11-06", "09:00") })],
      "en-US",
      noon,
    );
    expect(report).toEqual({ summary: "No doses today.", items: [], more: 0 });
  });
});
