import { describe, expect, it } from "vitest";

import { describeSchedule, ordinal } from "./schedule";

describe("ordinal", () => {
  it("writes days with their endings", () => {
    expect([1, 2, 3, 4, 10, 11, 12, 13, 21, 22, 23, 31].map(ordinal)).toEqual(["1st", "2nd", "3rd", "4th", "10th", "11th", "12th", "13th", "21st", "22nd", "23rd", "31st"]);
  });
});

describe("describeSchedule", () => {
  it("says it in words", () => {
    expect(describeSchedule({ frequency: "monthly", start: "2026-09-10" }, "en-US")).toBe("Monthly on the 10th");
    expect(describeSchedule({ frequency: "biweekly", start: "2026-10-10" }, "en-US")).toBe("Every two weeks from Oct 10");
    expect(describeSchedule({ frequency: "weekly", start: "2026-11-02" }, "en-US")).toBe("Weekly on Mondays");
    expect(describeSchedule({ frequency: "yearly", start: "2026-03-05" }, "en-US")).toBe("Yearly on Mar 5");
  });
});
