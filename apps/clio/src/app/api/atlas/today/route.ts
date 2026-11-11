import { currentRecords } from "@atlas/sync/server";
import { todayResponse } from "@atlas/ui/today/server";

import { DEFAULT_SETTINGS, SCHEMAS, type Day, type Settings, type Word } from "@/lib/model";
import { clioToday } from "@/lib/today";

/** Words due for review and today's goal, for Atlas's Today. proxy.ts has already checked it's you. */
export async function GET(request: Request) {
  const records = await currentRecords(SCHEMAS, ["word", "day", "settings"]);
  const of = <T,>(kind: string) => records.filter((change) => change.kind === kind).map((change) => change.record as T);
  return todayResponse(
    request,
    clioToday({
      words: of<Word>("word"),
      days: of<Day>("day"),
      settings: { ...DEFAULT_SETTINGS, ...of<Settings>("settings")[0] },
    }),
  );
}
