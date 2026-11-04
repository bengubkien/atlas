import { todayResponse } from "@atlas/ui/today/server";

import { today } from "@/lib/dates";
import { locale } from "@/lib/format";
import { getStatus } from "@/lib/micasa/api";
import { hestiaToday, TODAY_DAYS } from "@/lib/today";

/** What the house needs this week, for Atlas's Today. proxy.ts has already checked it's you. */
export async function GET(request: Request) {
  return todayResponse(request, hestiaToday(await getStatus(TODAY_DAYS), locale(), today()));
}
