import { NextResponse, type NextRequest } from "next/server";

// Who is asking. Every Atlas app is served by Tailscale Serve from its
// sidecar, which tells the app which tailnet user sent each request in the
// Tailscale-User-* headers (and drops any a client sends itself). The app
// listens only inside the sidecar's network, so nothing else can reach it to
// make those headers up.
//
// - ATLAS_OWNER: your Tailscale login (e.g. you@gmail.com); several, comma
//   separated. Only they get in. Unset, nobody does.
// - ATLAS_AUTH=off: no check, for developing on your own machine. The
//   viewer is then ATLAS_OWNER (or you@localhost) named ATLAS_OWNER_NAME.

export const LOGIN_HEADER = "tailscale-user-login";
export const NAME_HEADER = "tailscale-user-name";

export type Viewer = {
  /** The Tailscale login, e.g. you@gmail.com. */
  login: string;
  /** The name on the Tailscale account, or the login without one. */
  name: string;
};

type Env = Record<string, string | undefined>;

/**
 * Tailscale sends a name that isn't plain ASCII as an RFC 2047 encoded word,
 * e.g. `=?utf-8?q?Jos=C3=A9?=`. Plain names pass through.
 */
export function decodeHeaderName(value: string): string {
  const match = /^=\?utf-8\?([qb])\?(.*)\?=$/i.exec(value.trim());
  if (!match) return fromRawUtf8(value);
  const [, encoding, text = ""] = match;
  try {
    if (encoding!.toLowerCase() === "b") return Buffer.from(text, "base64").toString("utf8");
    const bytes = text.replace(/_/g, " ").replace(/=([0-9a-f]{2})/gi, (_, hex: string) => `%${hex}`);
    return decodeURIComponent(bytes);
  } catch {
    return value;
  }
}

/**
 * A name sent as raw UTF-8 reaches Node as one character per byte ("JosÃ©");
 * read those bytes as UTF-8 again. Anything else is left as it came.
 */
function fromRawUtf8(value: string): string {
  if (!/[\u0080-\u00ff]/.test(value) || /[^\u0000-\u00ff]/.test(value)) return value;
  const decoded = Buffer.from(value, "latin1").toString("utf8");
  return decoded.includes("\uFFFD") ? value : decoded;
}

/** The signed-in owner for these request headers, or null when they may not come in. */
export function viewerFrom(headers: Headers, env: Env = process.env): Viewer | null {
  const owners = (env.ATLAS_OWNER ?? "")
    .split(",")
    .map((login) => login.trim().toLowerCase())
    .filter(Boolean);

  if (env.ATLAS_AUTH === "off") {
    return { login: owners[0] ?? "you@localhost", name: env.ATLAS_OWNER_NAME?.trim() || "You" };
  }

  const login = headers.get(LOGIN_HEADER)?.trim();
  if (!login || !owners.includes(login.toLowerCase())) return null;
  const name = headers.get(NAME_HEADER);
  return { login, name: name ? decodeHeaderName(name) : login };
}

/**
 * For an app's proxy.ts: lets the owner through and turns everyone else away,
 * before any page or API route runs. Pages can read the viewer again with
 * viewerFrom(await headers()).
 */
export function guard(request: NextRequest, env: Env = process.env): NextResponse {
  if (viewerFrom(request.headers, env)) return NextResponse.next();

  const unset = env.ATLAS_AUTH !== "off" && !env.ATLAS_OWNER?.trim();
  const reason = unset
    ? "ATLAS_OWNER isn't set, so this app lets nobody in. Set it to your Tailscale login in deploy/.env and restart."
    : "This app only opens for its owner, through Tailscale.";

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: reason }, { status: 403 });
  }
  return new NextResponse(forbiddenPage(reason), {
    status: 403,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

/** A plain page in the suite's colours; it renders outside the app, without its styles. */
function forbiddenPage(reason: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Not for you</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; min-height: 100dvh; display: grid; place-items: center; padding: 16px; box-sizing: border-box;
    font: 15px/1.55 system-ui, sans-serif; background: light-dark(#eeebe4, #1a1917); color: light-dark(#1d1c1a, #f0ede7); }
  main { max-width: 440px; }
  h1 { font: 400 32px/1.1 Georgia, serif; margin: 0 0 12px; }
  p { margin: 0; color: light-dark(#69655d, #aaa59c); }
</style>
</head>
<body><main><h1>Not for you</h1><p>${reason}</p></main></body>
</html>`;
}
