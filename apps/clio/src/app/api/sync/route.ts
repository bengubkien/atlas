import { syncHandler } from "@atlas/sync/server";

import { SCHEMAS } from "@/lib/model";

/** The one endpoint devices sync through (see @atlas/sync/server). proxy.ts has already checked it's you. */
export const POST = syncHandler(SCHEMAS);
