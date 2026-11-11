import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApplicationStatus } from "@/generated/prisma/enums";
import type { AttentionItem } from "@/lib/dashboard";
import { proxy } from "@/proxy";

import { appLinks } from "./app-links";
import { tailscaleOwner, tailscaleSession } from "./tailscale";
import { todayFrom, todayResponse } from "./today";

vi.mock("@/lib/env", () => ({
  env: { DOSSIER_SECRET: "a".repeat(32), DOSSIER_PASSWORD: "correct horse" },
}));

// Atlas's patch (see ATLAS.md): signing in with Tailscale, the switcher's
// addresses, and the answer to Atlas's Today.

const owner = { ATLAS_OWNER: "Jane@Example.com, other@example.com" };
const from = (headers: Record<string, string>) => new Headers(headers);

describe("signing in with Tailscale", () => {
  it("lets in the owner's login, whatever its case", () => {
    expect(tailscaleOwner(from({ "tailscale-user-login": "jane@example.com" }), "GET", owner)).toBe("jane@example.com");
    expect(tailscaleOwner(from({ "tailscale-user-login": "OTHER@example.com" }), "GET", owner)).toBe("OTHER@example.com");
  });

  it("turns away other logins, no login, and everyone while ATLAS_OWNER is unset", () => {
    expect(tailscaleOwner(from({ "tailscale-user-login": "mallory@example.com" }), "GET", owner)).toBeNull();
    expect(tailscaleOwner(from({}), "GET", owner)).toBeNull();
    expect(tailscaleOwner(from({ "tailscale-user-login": "jane@example.com" }), "GET", {})).toBeNull();
    expect(tailscaleOwner(from({ "tailscale-user-login": "jane@example.com" }), "GET", { ATLAS_OWNER: " , " })).toBeNull();
  });

  it("counts a change only when it comes from Kairos's own pages", () => {
    const you = { "tailscale-user-login": "jane@example.com", "x-forwarded-host": "kairos.tail1234.ts.net", host: "127.0.0.2:3000" };
    const post = (headers: Record<string, string>) => tailscaleOwner(from({ ...you, ...headers }), "POST", owner);

    expect(post({ origin: "https://kairos.tail1234.ts.net", "sec-fetch-site": "same-origin" })).toBe("jane@example.com");
    expect(post({ origin: "https://kairos.tail1234.ts.net" })).toBe("jane@example.com");
    // Another site, or another Atlas app, sending a form or a fetch through your Tailscale.
    expect(post({ origin: "https://evil.example", "sec-fetch-site": "cross-site" })).toBeNull();
    expect(post({ origin: "https://atlas.tail1234.ts.net", "sec-fetch-site": "same-site" })).toBeNull();
    expect(post({ origin: "https://evil.example" })).toBeNull();
    expect(post({ origin: "null" })).toBeNull();
    // A browser always says where a change comes from; without that, it's a script of yours.
    expect(post({})).toBe("jane@example.com");
  });

  it("lets reads and visits through from anywhere: Atlas's links and Today", () => {
    const headers = from({ "tailscale-user-login": "jane@example.com", origin: "https://atlas.tail1234.ts.net", "sec-fetch-site": "same-site" });
    expect(tailscaleOwner(headers, "GET", owner)).toBe("jane@example.com");
  });

  describe("in the proxy", () => {
    afterEach(() => vi.unstubAllEnvs());
    const ask = (path: string, headers: Record<string, string>, method = "GET") =>
      proxy(new NextRequest(`https://kairos.tail1234.ts.net${path}`, { method, headers }));

    it("lets you in without Dossier's sign-in page", async () => {
      vi.stubEnv("ATLAS_OWNER", "jane@example.com");
      const page = await ask("/applications", { "tailscale-user-login": "jane@example.com" });
      expect(page.headers.get("location")).toBeNull();
      expect(page.headers.get("content-security-policy")).toContain("script-src");

      const api = await ask("/api/atlas/today", { "tailscale-user-login": "jane@example.com" });
      expect(api.status).toBe(200);
    });

    it("sends anyone else to the sign-in page, and refuses a change from another site", async () => {
      vi.stubEnv("ATLAS_OWNER", "jane@example.com");
      const stranger = await ask("/applications", { "tailscale-user-login": "mallory@example.com" });
      expect(stranger.headers.get("location")).toBe("https://kairos.tail1234.ts.net/login?next=%2Fapplications");

      const forged = await ask(
        "/api/applications",
        { "tailscale-user-login": "jane@example.com", origin: "https://evil.example", "sec-fetch-site": "cross-site" },
        "POST",
      );
      expect(forged.status).toBe(401);
    });

    it("changes nothing while ATLAS_OWNER is unset", async () => {
      const page = await ask("/", { "tailscale-user-login": "jane@example.com" });
      expect(page.headers.get("location")).toBe("https://kairos.tail1234.ts.net/login");
    });
  });

  it("makes a session that lasts for the request", () => {
    const now = new Date("2026-11-04T12:00:00Z");
    const session = tailscaleSession(from({ "tailscale-user-login": "jane@example.com" }), "GET", now, owner);
    expect(session).toEqual({ persistent: true, issuedAt: now, expiresAt: new Date("2026-11-04T12:01:00Z") });
    expect(tailscaleSession(from({}), "GET", now, owner)).toBeNull();
  });
});

describe("the switcher's addresses", () => {
  it("puts each running app at its name on the tailnet, and the others nowhere", () => {
    expect(appLinks({ ATLAS_DOMAIN: "tail1234.ts.net", ATLAS_APPS: "atlas,kairos,milo" })).toEqual({
      atlas: "https://atlas.tail1234.ts.net",
      kairos: "https://kairos.tail1234.ts.net",
      hestia: null,
      milo: "https://milo.tail1234.ts.net",
      hygeia: null,
      tyche: null,
      clio: null,
    });
  });

  it("takes an app's own address over the domain", () => {
    expect(appLinks({ ATLAS_DOMAIN: "tail1234.ts.net", ATLAS_URL_ATLAS: "http://localhost:3000/" }).atlas).toBe("http://localhost:3000");
    expect(appLinks({}).hestia).toBeNull();
  });
});

describe("Atlas's Today", () => {
  const item = (overrides: Partial<AttentionItem>): AttentionItem => ({
    id: "app1",
    company: "Acme",
    role: "Engineer",
    status: ApplicationStatus.INTERVIEW,
    reason: "Interview today at 10:30. Worth re-reading your tailored letter first.",
    action: "Open",
    ...overrides,
  });

  it("lists what's worth a look, interviews soon marked, in a sentence each", () => {
    const report = todayFrom([
      item({ soon: true }),
      item({ id: "app2", company: "Globex", role: "", reason: "No news for 9 days. A short, friendly follow-up could help." }),
      item({ id: "app 3", tab: "conversation", reason: "A reply is waiting: Thanks for applying!" }),
    ]);
    expect(report.summary).toBe("3 things worth a look, 1 interview today or tomorrow.");
    expect(report.items).toEqual([
      { title: "Acme, Engineer", detail: "Interview today at 10:30", href: "/applications/app1", tone: "soon" },
      { title: "Globex", detail: "No news for 9 days", href: "/applications/app2" },
      { title: "Acme, Engineer", detail: "A reply is waiting: Thanks for applying!", href: "/applications/app%203?tab=conversation" },
    ]);
    expect(report.more).toBe(0);
  });

  it("shows five and counts the rest", () => {
    const report = todayFrom(Array.from({ length: 7 }, (_, i) => item({ id: `a${i}` })));
    expect(report.items).toHaveLength(5);
    expect(report.more).toBe(2);
    expect(todayFrom([]).summary).toBe("All caught up.");
  });

  describe("the answer", () => {
    afterEach(() => vi.unstubAllEnvs());

    it("may be read by Atlas's page only", async () => {
      vi.stubEnv("ATLAS_DOMAIN", "tail1234.ts.net");
      const ask = (origin?: string) =>
        todayResponse(new NextRequest("https://kairos.tail1234.ts.net/api/atlas/today", { headers: origin ? { origin } : {} }), todayFrom([]));

      const atlas = ask("https://atlas.tail1234.ts.net");
      expect(atlas.headers.get("access-control-allow-origin")).toBe("https://atlas.tail1234.ts.net");
      expect(atlas.headers.get("cache-control")).toBe("private, no-store");
      expect(await atlas.json()).toEqual({ summary: "All caught up.", items: [], more: 0 });

      expect(ask("https://evil.example").headers.get("access-control-allow-origin")).toBeNull();
      expect(ask().headers.get("access-control-allow-origin")).toBeNull();
    });
  });
});
