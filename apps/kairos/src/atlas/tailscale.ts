import "server-only";

import type { Session } from "@/lib/auth/session";

// Atlas's patch (see ATLAS.md): signing in with Tailscale, as every Atlas app
// does. Kairos runs behind its own Tailscale sidecar, whose Serve tells it
// which tailnet user sent each request in the Tailscale-User-Login header,
// and drops any value a client sends itself. Kairos listens on 127.0.0.2,
// where Serve is the only way in (deploy/compose.yml says why), so nobody
// else can make that header up.
//
// ATLAS_OWNER (your Tailscale login; several, comma separated) turns it on.
// Unset, Kairos asks for Dossier's password as before.

export const TAILSCALE_LOGIN_HEADER = "tailscale-user-login";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

type Env = Record<string, string | undefined>;

/**
 * Whether a request that changes something came from Kairos's own pages.
 * Dossier's cookie is SameSite, so another site can't use it; Tailscale adds
 * its header to every request from your device, whichever site made it, so
 * that check is done here instead (as Next.js does for Server Actions).
 */
function fromOwnPages(headers: Headers, method: string): boolean {
  if (SAFE_METHODS.has(method)) return true;
  const site = headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return false;
  const origin = headers.get("origin");
  // Browsers say where every change comes from; a request that says nothing
  // is a script of yours, which no other site can make your browser send.
  if (origin === null) return true;
  const host = (headers.get("x-forwarded-host")?.split(",")[0]?.trim() || headers.get("host"))?.toLowerCase();
  try {
    return new URL(origin).host.toLowerCase() === host;
  } catch {
    return false;
  }
}

/** Your Tailscale login, when this request comes from you through Tailscale; otherwise null. */
export function tailscaleOwner(headers: Headers, method = "GET", env: Env = process.env): string | null {
  const owners = (env.ATLAS_OWNER ?? "")
    .split(",")
    .map((login) => login.trim().toLowerCase())
    .filter(Boolean);
  if (owners.length === 0) return null;
  const login = headers.get(TAILSCALE_LOGIN_HEADER)?.trim();
  if (!login || !owners.includes(login.toLowerCase())) return null;
  return fromOwnPages(headers, method) ? login : null;
}

/** A session for you, signed in by Tailscale, for this request only: there's no cookie and nothing to sign out of. */
export function tailscaleSession(headers: Headers, method = "GET", now = new Date(), env: Env = process.env): Session | null {
  if (!tailscaleOwner(headers, method, env)) return null;
  return { persistent: true, issuedAt: now, expiresAt: new Date(now.getTime() + 60_000) };
}
