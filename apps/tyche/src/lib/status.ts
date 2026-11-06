import type { BadgeTone } from "@atlas/ui/components/badge";

import { daysBetween } from "./dates";
import type { Goal, Transaction } from "./model";

// The words on a transaction or a goal: worked out from what's stored (its
// status, its date, today), never typed in, so "Overdue" always means past
// its date and not paid.

export type Label = { label: string; tone: BadgeTone };

const days = (count: number) => `${count} ${count === 1 ? "day" : "days"}`;

/** A transaction's label, as of a day. `bill` marks expenses that come back (they're "Paid", not "Cleared"). */
export function transactionLabel(transaction: Pick<Transaction, "amount" | "status" | "date" | "transferId" | "recurringId">, today: string): Label {
  if (transaction.transferId) return { label: "Transfer", tone: "neutral" };
  const income = transaction.amount > 0;
  const until = daysBetween(today, transaction.date);

  if (transaction.status === "pending") return { label: "Pending", tone: "warning" };
  if (transaction.status === "cleared") {
    if (income) return { label: "Received", tone: "success" };
    return { label: transaction.recurringId ? "Paid" : "Cleared", tone: "success" };
  }
  // Expected: not through yet.
  if (income) {
    if (until < 0) return { label: `Late · ${days(-until)}`, tone: "warning" };
    return { label: "Expected", tone: "neutral" };
  }
  if (until < 0) return { label: `Overdue · ${days(-until)} late`, tone: "danger" };
  if (until === 0) return { label: "Due today", tone: "warning" };
  if (until <= 7) return { label: `Due in ${days(until)}`, tone: "warning" };
  return { label: `Due in ${days(until)}`, tone: "neutral" };
}

export type GoalStanding = "reached" | "almost" | "on-track" | "behind" | "open";

/**
 * A goal against a straight line from its start to its target date: on
 * track if what's saved is at least where the line is today (with a little
 * slack), almost there from 90%, reached at 100%. Without a target date,
 * it's just in progress.
 */
export function goalStanding(goal: Pick<Goal, "target" | "startDate" | "targetDate">, saved: number, today: string): GoalStanding {
  const share = saved / goal.target;
  if (share >= 1) return "reached";
  if (share >= 0.9) return "almost";
  if (!goal.targetDate) return "open";
  if (today >= goal.targetDate) return "behind";
  const span = daysBetween(goal.startDate, goal.targetDate);
  const gone = Math.max(0, daysBetween(goal.startDate, today));
  const due = span > 0 ? gone / span : 1;
  return share >= due - 0.02 ? "on-track" : "behind";
}

export const GOAL_LABELS: Record<GoalStanding, Label> = {
  reached: { label: "Reached", tone: "success" },
  almost: { label: "Almost there", tone: "success" },
  "on-track": { label: "On track", tone: "info" },
  behind: { label: "Behind", tone: "warning" },
  open: { label: "In progress", tone: "info" },
};
