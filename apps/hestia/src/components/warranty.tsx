import { Badge } from "@atlas/ui/components/badge";

import { calendarDate, daysBetween } from "@/lib/dates";
import type { Formatters } from "@/lib/format";
import type { Appliance } from "@/lib/micasa/schemas";

/** Under warranty, ending soon, or ended. */
export function Warranty({ appliance, f }: { appliance: Appliance; f: Formatters }) {
  const expiry = calendarDate(appliance.warranty_expiry);
  if (!expiry) return null;
  const days = daysBetween(f.today, expiry);
  if (days < 0) return <Badge>Warranty ended {f.date(expiry)}</Badge>;
  if (days <= 90) return <Badge tone="warning">Warranty ends {f.fromToday(expiry)}</Badge>;
  return <Badge tone="success">Under warranty until {f.date(expiry)}</Badge>;
}
