import "server-only";

import { APP_IDS, type AppId, type AppLinks } from "./apps";

// Atlas's patch (see ATLAS.md): where each app is, from the same variables
// every Atlas app reads, as in packages/ui/src/app-urls.ts.
//
// - ATLAS_DOMAIN: your tailnet's domain, e.g. tail1234.ts.net; each app is
//   at https://<app>.<domain>.
// - ATLAS_APPS: the apps that are running; the others show as not running.
// - ATLAS_URL_<APP>: a different address for one app, e.g. while developing.

type Env = Record<string, string | undefined>;

export function appLinks(env: Env = process.env): AppLinks {
  const domain = env.ATLAS_DOMAIN?.trim().replace(/^\.+|\/+$/g, "");
  const running = env.ATLAS_APPS?.trim()
    ? new Set(env.ATLAS_APPS.split(",").map((id) => id.trim().toLowerCase()))
    : null;

  const link = (id: AppId): string | null => {
    if (running && !running.has(id)) return null;
    const own = env[`ATLAS_URL_${id.toUpperCase()}`]?.trim();
    if (own) return own.replace(/\/+$/, "");
    return domain ? `https://${id}.${domain}` : null;
  };

  return Object.fromEntries(APP_IDS.map((id) => [id, link(id)])) as AppLinks;
}
