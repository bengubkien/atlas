import type { Formatters } from "@/lib/format";
import type { Scheduled } from "@/lib/schedule";

/**
 * When a maintenance item is due, in words and in colour: overdue in red,
 * soon in amber. `full` spells it out for the item's own page; in a list the
 * group's heading already says "Overdue".
 */
export function Due({ item, f, full = false }: { item: Pick<Scheduled, "next" | "standing">; f: Formatters; full?: boolean }) {
  switch (item.standing) {
    case "overdue":
      return <span className="font-medium text-error">{full ? "Overdue: was" : "Was"} due {f.date(item.next!)}</span>;
    case "soon":
      return <span className="font-medium text-warning">Due {f.fromToday(item.next!)}</span>;
    case "later":
      return <span>Due {f.date(item.next!)}</span>;
    case "never":
      return <span>{full ? "Never logged: log it once, and the next date is counted from it." : "Log it once to start counting"}</span>;
    default:
      return <span>{full ? "No schedule: it has no interval or due date." : "No schedule"}</span>;
  }
}
