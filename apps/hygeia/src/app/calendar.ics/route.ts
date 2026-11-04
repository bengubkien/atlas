import type { NextRequest } from "next/server";

import { currentRecords } from "@atlas/sync/server";

import { buildCalendar } from "@/lib/calendar";
import { SCHEMAS, type Appointment, type Medication } from "@/lib/model";

// The calendar feed your phone subscribes to (Settings explains how). Built
// from what the devices have synced; your phone's calendar asks for it over
// Tailscale, which tells proxy.ts it's you, like any other request.

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const records = await currentRecords(SCHEMAS, ["medication", "appointment"]);
  const ics = buildCalendar({
    medications: records.filter((change) => change.kind === "medication").map((change) => change.record as Medication),
    appointments: records.filter((change) => change.kind === "appointment").map((change) => change.record as Appointment),
    host: request.nextUrl.hostname,
  });
  return new Response(ics, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'inline; filename="hygeia.ics"',
      "cache-control": "no-cache",
    },
  });
}
