import { currentRecords } from "@atlas/sync/server";
import { todayResponse } from "@atlas/ui/today/server";

import { SCHEMAS, type Appointment, type Dose, type Medication } from "@/lib/model";
import { hygeiaToday } from "@/lib/today";

/** Today's doses and appointments, for Atlas's Today. proxy.ts has already checked it's you. */
export async function GET(request: Request) {
  const records = await currentRecords(SCHEMAS, ["medication", "dose", "appointment"]);
  const of = <T,>(kind: string) => records.filter((change) => change.kind === kind).map((change) => change.record as T);
  return todayResponse(
    request,
    hygeiaToday(of<Medication>("medication"), of<Dose>("dose"), of<Appointment>("appointment"), process.env.ATLAS_LOCALE || "en-US"),
  );
}
