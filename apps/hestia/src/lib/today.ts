import { formatDate, formatRelativeDays } from "@atlas/ui/format";
import { todayReport, type TodayItem, type TodayReport } from "@atlas/ui/today";

import { daysBetween, type CalendarDate } from "./dates";
import type { Status } from "./micasa/schemas";

// Hestia's answer to Atlas's Today (see @atlas/ui/today): what's overdue,
// urgent issues, then what's due in the week ahead and the other open issues.

/** How far ahead Today looks: the coming week. */
export const TODAY_DAYS = 7;

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** From micasa's own status for the next TODAY_DAYS days. */
export function hestiaToday(status: Status, locale: string, today: CalendarDate): TodayReport {
  const urgent = status.incidents.filter((incident) => incident.severity === "urgent");
  const others = status.incidents.filter((incident) => incident.severity !== "urgent");
  const year = (date: string) => date.slice(0, 4) !== today.slice(0, 4);

  const items: TodayItem[] = [
    ...status.overdue.map((item) => ({
      title: item.name,
      detail: `Was due ${formatDate(item.next_due, locale, { year: year(item.next_due) })}`,
      href: `/maintenance/${item.id}`,
      tone: "overdue" as const,
    })),
    ...urgent.map((incident) => ({ title: incident.title, detail: "Urgent", href: "/incidents", tone: "overdue" as const })),
    ...status.upcoming.map((item) => ({
      title: item.name,
      detail: `Due ${formatRelativeDays(daysBetween(today, item.next_due.slice(0, 10)), locale)}`,
      href: `/maintenance/${item.id}`,
      tone: "soon" as const,
    })),
    ...others.map((incident) => ({ title: incident.title, detail: "Open issue", href: "/incidents" })),
  ];

  const parts = [
    status.overdue.length ? `${plural(status.overdue.length, "thing")} overdue` : null,
    status.upcoming.length ? `${status.upcoming.length} due this week` : null,
    status.incidents.length ? plural(status.incidents.length, "open issue") : null,
  ].filter(Boolean);
  const summary = parts.length ? `${parts.join(", ")}.` : "Nothing needs you this week.";
  return todayReport(summary.charAt(0).toUpperCase() + summary.slice(1), items);
}
