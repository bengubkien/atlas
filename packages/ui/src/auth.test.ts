import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { decodeHeaderName, fromOwnPages, guard, viewerFrom } from "./auth";

const env = { ATLAS_OWNER: "Jane@Example.com" };
const you = { "tailscale-user-login": "jane@example.com", "x-forwarded-host": "milo.tail1234.ts.net", host: "milo.tail1234.ts.net" };
const ask = (method: string, headers: Record<string, string>, path = "/api/sync") =>
  guard(new NextRequest(`https://milo.tail1234.ts.net${path}`, { method, headers }), env);

describe("guard", () => {
  it("lets you in through Tailscale, and nobody else", () => {
    expect(ask("GET", you, "/").status).toBe(200);
    expect(ask("GET", { ...you, "tailscale-user-login": "mallory@example.com" }, "/").status).toBe(403);
    expect(ask("GET", {}, "/").headers.get("content-type")).toContain("text/html");
    expect(ask("GET", {}).headers.get("content-type")).toContain("application/json");
  });

  it("lets a change through from the app's own pages, or from a script of yours", () => {
    expect(ask("POST", { ...you, origin: "https://milo.tail1234.ts.net", "sec-fetch-site": "same-origin" }).status).toBe(200);
    expect(ask("POST", { ...you, origin: "https://milo.tail1234.ts.net" }).status).toBe(200);
    expect(ask("POST", you).status).toBe(200);
  });

  it("refuses a change another site sends through your Tailscale", () => {
    for (const headers of <Record<string, string>[]>[
      { origin: "https://evil.example", "sec-fetch-site": "cross-site" },
      { origin: "https://atlas.tail1234.ts.net", "sec-fetch-site": "same-site" },
      { origin: "https://evil.example" },
      { origin: "null" },
    ]) {
      const response = ask("POST", { ...you, ...headers });
      expect(response.status, JSON.stringify(headers)).toBe(403);
    }
    // Reads from another site are fine: the browser keeps their answers from it (CORS).
    expect(ask("GET", { ...you, origin: "https://atlas.tail1234.ts.net", "sec-fetch-site": "same-site" }, "/api/atlas/today").status).toBe(200);
  });

  it("checks where a change comes from even with the sign-in check off", () => {
    const off = { ATLAS_AUTH: "off" };
    expect(guard(new NextRequest("http://localhost:3002/api/sync", { method: "POST", headers: { origin: "https://evil.example" } }), off).status).toBe(403);
    expect(
      guard(new NextRequest("http://localhost:3002/api/sync", { method: "POST", headers: { origin: "http://localhost:3002", host: "localhost:3002" } }), off).status,
    ).toBe(200);
  });
});

describe("fromOwnPages", () => {
  it("allows every read", () => {
    expect(fromOwnPages(new Headers({ origin: "https://evil.example", "sec-fetch-site": "cross-site" }), "get")).toBe(true);
  });
});

describe("viewerFrom", () => {
  it("reads your name as Tailscale sends it", () => {
    const viewer = viewerFrom(new Headers({ ...you, "tailscale-user-name": "=?utf-8?q?Jos=C3=A9_P=C3=A9rez?=" }), env);
    expect(viewer).toEqual({ login: "jane@example.com", name: "José Pérez" });
    expect(decodeHeaderName("Jane Doe")).toBe("Jane Doe");
  });

  it("lets nobody in while ATLAS_OWNER is unset", () => {
    expect(viewerFrom(new Headers(you), {})).toBeNull();
  });
});
