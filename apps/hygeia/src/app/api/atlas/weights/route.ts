import { currentRecords } from "@atlas/sync/server";
import { sharedResponse } from "@atlas/ui/today/server";

import { WEIGHT } from "@/lib/measures";
import { SCHEMAS, type Measurement } from "@/lib/model";

/** Two years is plenty for what Milo does with it. */
const YEARS = 2;

/**
 * Your body weight over the last two years, oldest first, in kilograms, for
 * Milo (strength for your weight). Only Milo's pages may read it. proxy.ts
 * has already checked it's you.
 */
export async function GET(request: Request) {
  const since = Date.now() - YEARS * 365 * 86_400_000;
  const records = await currentRecords(SCHEMAS, ["measurement"]);
  const weights = records
    .map((change) => change.record as Measurement)
    .filter((reading) => reading.measureId === WEIGHT && reading.at >= since && reading.value > 0)
    .sort((a, b) => a.at - b.at)
    .map((reading) => ({ at: reading.at, kg: reading.value }));
  return sharedResponse(request, { weights }, ["milo"]);
}
