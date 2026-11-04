import "server-only";

import { appLinks } from "./app-urls";
import type { TodayReport } from "./today";

type Env = Record<string, string | undefined>;

/**
 * An app's answer to Atlas's GET /api/atlas/today. The launcher's page asks
 * from its own address, so the answer has to say Atlas's address may read it
 * (CORS); no other site may. The app's proxy.ts has already checked it's you.
 */
export function todayResponse(request: Request, report: TodayReport, env: Env = process.env): Response {
  const headers = new Headers({ "cache-control": "private, no-store", vary: "Origin" });
  const origin = request.headers.get("origin");
  const atlas = appLinks(env).atlas;
  if (origin && atlas && origin === new URL(atlas).origin) headers.set("access-control-allow-origin", origin);
  return Response.json(report, { headers });
}
