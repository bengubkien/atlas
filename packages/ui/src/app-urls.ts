import "server-only";

import { APP_IDS, type AppId, type AppLinks } from "./apps";

/**
 * Where each app is reached, from the environment:
 *
 * - ATLAS_DOMAIN: your tailnet's domain, e.g. `tail1234.ts.net`. Each app is
 *   then at `https://<app>.<domain>`, the name its Tailscale sidecar joins as.
 * - ATLAS_APPS: the apps that are running, e.g. `atlas,kairos`. The others are
 *   shown as not running yet. Unset, every app counts as running.
 * - ATLAS_URL_<APP>, e.g. ATLAS_URL_MILO: a different address for one app,
 *   such as http://localhost:3002 while developing.
 */
export function appLinks(env: Record<string, string | undefined> = process.env): AppLinks {
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
