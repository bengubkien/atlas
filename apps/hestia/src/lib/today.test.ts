import { describe, expect, it } from "vitest";

import type { Status } from "./micasa/schemas";
import { hestiaToday } from "./today";

const status = (fields: Partial<Status>): Status => ({ overdue: [], upcoming: [], incidents: [], active_projects: [], ...fields });
const item = { id: "01JXYZ", name: "Clean the gutters", category: "Exterior", appliance: "" };

describe("Hestia's answer to Atlas's Today", () => {
  it("lists overdue, urgent, due this week, then other issues", () => {
    const report = hestiaToday(
      status({
        overdue: [{ ...item, next_due: "2026-10-02", days_overdue: 33 }],
        upcoming: [{ ...item, id: "01JABC", name: "Test the smoke alarms", next_due: "2026-11-05", days_until_due: 1 }],
        incidents: [
          { id: "01JI1", title: "Dripping tap", status: "open", severity: "whenever", date_noticed: "2026-11-01" },
          { id: "01JI2", title: "No hot water", status: "in_progress", severity: "urgent", date_noticed: "2026-11-03" },
        ],
      }),
      "en-US",
      "2026-11-04",
    );
    expect(report.summary).toBe("1 thing overdue, 1 due this week, 2 open issues.");
    expect(report.items).toEqual([
      { title: "Clean the gutters", detail: "Was due Oct 2", href: "/maintenance/01JXYZ", tone: "overdue" },
      { title: "No hot water", detail: "Urgent", href: "/incidents", tone: "overdue" },
      { title: "Test the smoke alarms", detail: "Due tomorrow", href: "/maintenance/01JABC", tone: "soon" },
      { title: "Dripping tap", detail: "Open issue", href: "/incidents" },
    ]);
  });

  it("writes the year of a date in another year, and says when nothing's due", () => {
    const old = hestiaToday(status({ overdue: [{ ...item, next_due: "2025-12-01", days_overdue: 338 }] }), "en-US", "2026-11-04");
    expect(old.items[0]?.detail).toBe("Was due Dec 1, 2025");
    expect(hestiaToday(status({}), "en-US", "2026-11-04")).toEqual({ summary: "Nothing needs you this week.", items: [], more: 0 });
  });
});
