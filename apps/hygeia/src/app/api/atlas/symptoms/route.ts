import { currentRecords } from "@atlas/sync/server";
import { sharedResponse } from "@atlas/ui/today/server";

import { SCHEMAS, type Symptom } from "@/lib/model";

/** What Milo looks at: the last two weeks. */
const DAYS = 14;

/**
 * What's been sore lately, for Milo: each symptom of the last two weeks
 * (where, what, how bad, when), newest first, so it can warn about the
 * exercises that load that place. Only Milo's pages may read it. proxy.ts
 * has already checked it's you.
 */
export async function GET(request: Request) {
  const since = Date.now() - DAYS * 86_400_000;
  const symptoms = (await currentRecords(SCHEMAS, ["symptom"]))
    .map((change) => change.record as Symptom)
    .filter((symptom) => symptom.at >= since && symptom.at <= Date.now())
    .sort((a, b) => b.at - a.at)
    .map(({ area, kind, severity, at }) => ({ area, kind, severity, at }));
  return sharedResponse(request, { symptoms }, ["milo"]);
}
