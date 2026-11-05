import "server-only";

import { appLinks } from "./app-urls";
import type { AppId } from "./apps";
import type { TodayReport } from "./today";

type Env = Record<string, string | undefined>;

/**
 * An app's answer to Atlas's GET /api/atlas/today. The launcher's page asks
 * from its own address, so the answer has to say Atlas's address may read it
 * (CORS); no other site may. The app's proxy.ts has already checked it's you.
 */
export function todayResponse(request: Request, report: TodayReport, env: Env = process.env): Response {
  return sharedResponse(request, report, ["atlas"], env);
}

/**
 * An answer one app shares with other apps of the suite (Hygeia's body
 * weights, for Milo): the browser on those apps' pages may read it (CORS),
 * no other site may. As with Today, the browser asks at this app's own
 * address, so Tailscale says who is asking and proxy.ts has checked it.
 */
export function sharedResponse(request: Request, body: unknown, readers: AppId[], env: Env = process.env): Response {
  const headers = new Headers({ "cache-control": "private, no-store", vary: "Origin" });
  const origin = request.headers.get("origin");
  const links = appLinks(env);
  const allowed = readers.map((id) => links[id]).filter((url): url is string => Boolean(url)).map((url) => new URL(url).origin);
  if (origin && allowed.includes(origin)) headers.set("access-control-allow-origin", origin);
  return Response.json(body, { headers });
}
