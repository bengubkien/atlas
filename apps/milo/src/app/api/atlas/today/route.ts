import { currentRecords } from "@atlas/sync/server";
import { todayResponse } from "@atlas/ui/today/server";

import { SCHEMAS, type Workout, type WorkoutSet } from "@/lib/model";
import { miloToday } from "@/lib/today";

/**
 * Today's training, for Atlas's Today, from what your devices have synced to
 * the server: a workout logged offline shows once the phone has synced it.
 * proxy.ts has already checked it's you.
 */
export async function GET(request: Request) {
  const records = await currentRecords(SCHEMAS, ["workout", "set"]);
  const workouts = records.filter((change) => change.kind === "workout").map((change) => change.record as Workout);
  const sets = records.filter((change) => change.kind === "set").map((change) => change.record as WorkoutSet);
  return todayResponse(request, miloToday(workouts, sets, process.env.ATLAS_LOCALE || "en-US"));
}
