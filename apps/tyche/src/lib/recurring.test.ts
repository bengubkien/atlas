import { SEEDED } from "@atlas/sync/device";
import { describe, expect, it } from "vitest";

import type { Recurring, Transaction } from "./model";
import { autopayDue, followItem, nextDue, occurrence, occurrencesAround, occurrencesBetween, withOccurrences } from "./recurring";
import { goalStanding, transactionLabel } from "./status";

const item = (fields: Partial<Recurring> = {}): Recurring => ({
  id: "rent",
  updatedAt: 5,
  deleted: false,
  name: "Rent",
  accountId: "bank",
  categoryId: "c-housing",
  amount: -125000,
  estimated: false,
  frequency: "monthly",
  start: "2026-01-31",
  end: null,
  autopay: false,
  installments: null,
  note: "",
  ...fields,
});

describe("recurring dates", () => {
  it("keeps a monthly item on its day, or a short month's last day", () => {
    expect(occurrencesBetween(item(), "2026-01-01", "2026-05-31")).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30", "2026-05-31"]);
    expect(occurrencesBetween(item({ start: "2027-12-31" }), "2028-01-01", "2028-03-01")).toEqual(["2028-01-31", "2028-02-29"]);
  });

  it("starts at the start, stops at the end, and finds the next one", () => {
    expect(occurrencesBetween(item({ start: "2026-03-15", end: "2026-05-15" }), "2026-01-01", "2026-12-31")).toEqual(["2026-03-15", "2026-04-15", "2026-05-15"]);
    expect(nextDue(item({ start: "2026-03-15" }), "2026-11-16")).toBe("2026-12-15");
    expect(nextDue(item({ start: "2026-03-15", end: "2026-05-15" }), "2026-06-01")).toBeNull();
  });

  it("counts weeks and fortnights from the start, and years on the same day", () => {
    expect(occurrencesBetween(item({ frequency: "biweekly", start: "2026-10-10" }), "2026-11-01", "2026-11-30")).toEqual(["2026-11-07", "2026-11-21"]);
    expect(occurrencesBetween(item({ frequency: "weekly", start: "2026-11-02" }), "2026-11-02", "2026-11-20")).toEqual(["2026-11-02", "2026-11-09", "2026-11-16"]);
    expect(occurrencesBetween(item({ frequency: "yearly", start: "2024-02-29" }), "2025-01-01", "2028-12-31")).toEqual(["2025-02-28", "2026-02-28", "2027-02-28", "2028-02-29"]);
  });
});

describe("occurrences", () => {
  const today = "2026-11-06";

  it("are made around today with IDs from the item and date, as the oldest version", () => {
    const made = occurrencesAround([item({ start: "2026-01-01" }), item({ id: "gone", deleted: true })], today);
    expect(made.map((t) => t.id)).toEqual(["o-rent-2026-10-01", "o-rent-2026-11-01", "o-rent-2026-12-01"]);
    expect(made[0]).toMatchObject({ updatedAt: SEEDED, status: "expected", amount: -125000, payee: "Rent", recurringId: "rent", dueDate: "2026-10-01" });
  });

  it("are cleared already for a bill that pays itself once its day has come", () => {
    expect(occurrence(item({ autopay: true }), "2026-11-01", today).status).toBe("cleared");
    expect(occurrence(item({ autopay: true }), "2026-12-01", today).status).toBe("expected");
    const due = [occurrence(item({ autopay: true }), "2026-12-01", today)].map((t) => ({ ...t, date: "2026-11-06" }));
    expect(autopayDue(due, [item({ autopay: true })], today)).toHaveLength(1);
    expect(autopayDue(due, [item()], today)).toHaveLength(0);
  });

  it("fill in what the server hasn't seen yet, without doubling what it has", () => {
    const paid: Transaction = { ...occurrence(item({ start: "2026-01-01" }), "2026-11-01", today), status: "cleared", updatedAt: 99 };
    const all = withOccurrences([paid], [item({ start: "2026-01-01" })], today);
    expect(all.filter((t) => t.id === paid.id)).toEqual([paid]);
    expect(all).toHaveLength(3);
  });

  it("follow their item when it changes, unless you've touched them", () => {
    const rent = item({ start: "2026-01-01" });
    const ahead = occurrence(rent, "2026-12-01", today);
    const paidEarly = { ...occurrence(rent, "2027-01-01", today), status: "cleared" as const, updatedAt: 50 };
    const past = occurrence(rent, "2026-11-01", today);
    expect(followItem({ ...rent, amount: -130000 }, [ahead, paidEarly, past], today)).toEqual({ update: [{ ...ahead, amount: -130000 }], remove: [] });
    // Moved to the 5th: the untouched one on the 1st goes (the 5th is seeded afresh).
    expect(followItem({ ...rent, start: "2026-01-05" }, [ahead, paidEarly], today)).toEqual({ update: [], remove: [ahead] });
    expect(followItem({ ...rent, deleted: true }, [ahead, paidEarly, past], today)).toEqual({ update: [], remove: [ahead] });
  });
});

describe("labels", () => {
  const today = "2026-11-06";
  const base = { transferId: null, recurringId: null };

  it("say how a bill stands, from its date", () => {
    expect(transactionLabel({ ...base, amount: -12800, status: "expected", date: "2026-10-31" }, today)).toEqual({ label: "Overdue · 6 days late", tone: "danger" });
    expect(transactionLabel({ ...base, amount: -12800, status: "expected", date: "2026-11-05" }, today).label).toBe("Overdue · 1 day late");
    expect(transactionLabel({ ...base, amount: -6999, status: "expected", date: "2026-11-10" }, today)).toEqual({ label: "Due in 4 days", tone: "warning" });
    expect(transactionLabel({ ...base, amount: -6999, status: "expected", date: "2026-11-06" }, today).label).toBe("Due today");
    expect(transactionLabel({ ...base, amount: -6999, status: "expected", date: "2026-11-30" }, today)).toEqual({ label: "Due in 24 days", tone: "neutral" });
    expect(transactionLabel({ ...base, recurringId: "rent", amount: -125000, status: "cleared", date: "2026-11-01" }, today)).toEqual({ label: "Paid", tone: "success" });
    expect(transactionLabel({ ...base, amount: -9430, status: "cleared", date: "2026-11-01" }, today).label).toBe("Cleared");
    expect(transactionLabel({ ...base, amount: -5200, status: "pending", date: "2026-11-01" }, today)).toEqual({ label: "Pending", tone: "warning" });
  });

  it("say how pay stands, and name transfers", () => {
    expect(transactionLabel({ ...base, amount: 75000, status: "cleared", date: "2026-11-01" }, today)).toEqual({ label: "Received", tone: "success" });
    expect(transactionLabel({ ...base, amount: 120000, status: "expected", date: "2026-11-28" }, today)).toEqual({ label: "Expected", tone: "neutral" });
    expect(transactionLabel({ ...base, amount: 120000, status: "expected", date: "2026-11-04" }, today)).toEqual({ label: "Late · 2 days", tone: "warning" });
    expect(transactionLabel({ ...base, transferId: "x", amount: 100, status: "cleared", date: "2026-11-01" }, today).label).toBe("Transfer");
  });

  it("put a goal against a straight line to its date", () => {
    const goal = { target: 1000000, startDate: "2026-01-01", targetDate: "2027-01-01" };
    // About 85% of the way through the year.
    expect(goalStanding(goal, 840000, "2026-11-06")).toBe("on-track");
    expect(goalStanding(goal, 500000, "2026-11-06")).toBe("behind");
    expect(goalStanding(goal, 920000, "2026-11-06")).toBe("almost");
    expect(goalStanding(goal, 1000000, "2026-11-06")).toBe("reached");
    expect(goalStanding({ ...goal, targetDate: null }, 100, "2026-11-06")).toBe("open");
    expect(goalStanding(goal, 800000, "2027-02-01")).toBe("behind");
  });
});
