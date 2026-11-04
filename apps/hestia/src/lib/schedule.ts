import { daysBetween, nextDue, type CalendarDate } from "./dates";
import type { MaintenanceItem } from "./micasa/schemas";

// Where each maintenance item stands today, worked out the way micasa does.

/** Within this many days counts as "due soon", as micasa's own status uses. */
export const SOON_DAYS = 30;

/** "never": repeats, but was never logged, so micasa has nothing to count from yet. */
export type Standing = "overdue" | "soon" | "later" | "never" | "unscheduled";

export type Scheduled = MaintenanceItem & {
  next: CalendarDate | null;
  /** Days until it's due; negative once overdue. */
  days: number | null;
  standing: Standing;
};

export function scheduled(item: MaintenanceItem, today: CalendarDate): Scheduled {
  const next = nextDue(item);
  const days = next ? daysBetween(today, next) : null;
  const standing: Standing =
    days === null
      ? item.interval_months > 0
        ? "never"
        : "unscheduled"
      : days < 0
        ? "overdue"
        : days <= SOON_DAYS
          ? "soon"
          : "later";
  return { ...item, next, days, standing };
}

/** Every item, soonest due first; those without a schedule last, by name. */
export function schedule(items: MaintenanceItem[], today: CalendarDate): Scheduled[] {
  return items
    .map((item) => scheduled(item, today))
    .sort((a, b) => {
      if (a.next && b.next) return a.next.localeCompare(b.next) || a.name.localeCompare(b.name);
      if (a.next) return -1;
      if (b.next) return 1;
      return a.name.localeCompare(b.name);
    });
}

/** "Every 6 months", "Every year", "Once"; how often it comes round. */
export function cadence(item: Pick<MaintenanceItem, "interval_months" | "due_date">): string {
  const months = item.interval_months;
  if (months <= 0) return item.due_date ? "Once" : "No schedule";
  if (months === 1) return "Every month";
  if (months === 12) return "Every year";
  if (months % 12 === 0) return `Every ${months / 12} years`;
  return `Every ${months} months`;
}
