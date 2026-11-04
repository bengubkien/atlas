import { describe, expect, it } from "vitest";

import { addMonths, calendarDate, daysBetween, nextDue } from "./dates";

describe("dates", () => {
  it("reads the calendar date from micasa's timestamps", () => {
    expect(calendarDate("2026-11-02T00:00:00Z")).toBe("2026-11-02");
    expect(calendarDate("2026-07-17T21:16:11.841805237Z")).toBe("2026-07-17");
    expect(calendarDate(null)).toBeNull();
  });

  it("adds months like micasa, keeping the day or clamping it to the month's end", () => {
    expect(addMonths("2026-03-15", 6)).toBe("2026-09-15");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2024-01-31", 1)).toBe("2024-02-29");
    expect(addMonths("2026-11-30", 3)).toBe("2027-02-28");
    expect(addMonths("2026-12-10", 12)).toBe("2027-12-10");
  });

  it("counts days between dates", () => {
    expect(daysBetween("2026-11-04", "2026-11-05")).toBe(1);
    expect(daysBetween("2026-11-04", "2026-10-30")).toBe(-5);
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2); // across a clock change
  });

  it("prefers a fixed due date, then the last service plus the interval", () => {
    expect(nextDue({ due_date: "2026-12-01T00:00:00Z", last_serviced_at: "2026-01-01T00:00:00Z", interval_months: 1 })).toBe("2026-12-01");
    expect(nextDue({ due_date: null, last_serviced_at: "2026-05-10T09:00:00Z", interval_months: 6 })).toBe("2026-11-10");
    expect(nextDue({ due_date: null, last_serviced_at: null, interval_months: 6 })).toBeNull();
    expect(nextDue({ due_date: null, last_serviced_at: "2026-05-10T09:00:00Z", interval_months: 0 })).toBeNull();
  });
});
