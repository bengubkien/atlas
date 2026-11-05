import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { APP_IDS, APPS } from "./apps";
import { parseToday, todayReport } from "./today";
import { sharedResponse, todayResponse } from "./today-server";

describe("an app's answer to Today", () => {
  it("keeps what fits the shape", () => {
    expect(
      parseToday({
        summary: " 2 things overdue. ",
        items: [
          { title: "Clean the gutters", detail: "Was due Oct 2", href: "/maintenance/1", tone: "overdue" },
          { title: "Dentist", href: "/appointments", tone: "loud", extra: true },
        ],
        more: 3,
      }),
    ).toEqual({
      summary: "2 things overdue.",
      items: [
        { title: "Clean the gutters", detail: "Was due Oct 2", href: "/maintenance/1", tone: "overdue" },
        { title: "Dentist", href: "/appointments" },
      ],
      more: 3,
    });
  });

  it("only links to the app's own pages", () => {
    const hrefs = ["https://evil.example/", "//evil.example/", "/\\evil.example", "javascript:alert(1)", "/ok"];
    const report = parseToday({ summary: "x", items: hrefs.map((href) => ({ title: "t", href })) });
    expect(report?.items.map((item) => item.href)).toEqual(["/ok"]);
  });

  it("refuses anything that isn't an answer", () => {
    for (const value of [null, "text", [], { items: [] }, { summary: "", items: [] }, { summary: "x" }]) {
      expect(parseToday(value)).toBeNull();
    }
    expect(parseToday({ summary: "x", items: [], more: -1 })?.more).toBe(0);
  });

  it("shows five items at most and counts the rest", () => {
    const items = Array.from({ length: 8 }, (_, i) => ({ title: `Item ${i}`, href: `/${i}` }));
    const report = todayReport("Eight things.", items);
    expect(report.items).toHaveLength(5);
    expect(report.more).toBe(3);
    expect(parseToday({ ...report, items })?.items).toHaveLength(5);
  });
});

describe("todayResponse", () => {
  const env = { ATLAS_DOMAIN: "tail1234.ts.net" };
  const ask = (origin?: string) =>
    todayResponse(new Request("https://milo.tail1234.ts.net/api/atlas/today", { headers: origin ? { origin } : {} }), todayReport("Nothing.", []), env);

  it("lets Atlas's page read it, and no other site", async () => {
    const atlas = ask("https://atlas.tail1234.ts.net");
    expect(atlas.headers.get("access-control-allow-origin")).toBe("https://atlas.tail1234.ts.net");
    expect(atlas.headers.get("vary")).toBe("Origin");
    expect(atlas.headers.get("cache-control")).toBe("private, no-store");
    expect(await atlas.json()).toEqual({ summary: "Nothing.", items: [], more: 0 });

    expect(ask("https://evil.example").headers.get("access-control-allow-origin")).toBeNull();
    expect(ask("https://atlas.tail1234.ts.net.evil.example").headers.get("access-control-allow-origin")).toBeNull();
    expect(ask().headers.get("access-control-allow-origin")).toBeNull();
  });
});

describe("Kairos's copy of the app list", () => {
  // Kairos builds on its own with Dossier's tools, so it carries a copy of
  // apps.ts and the accent colours (apps/kairos/src/atlas). They must agree.
  const copy = readFileSync(new URL("../../../apps/kairos/src/atlas/apps.ts", import.meta.url), "utf8");
  const css = readFileSync(new URL("../../../apps/kairos/src/atlas/atlas.css", import.meta.url), "utf8");
  const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

  it("has the same apps, names, taglines, icons and colours", () => {
    expect(copy).toContain(`export const APP_IDS = [${APP_IDS.map((id) => `"${id}"`).join(", ")}] as const;`);
    for (const id of APP_IDS) {
      const { name, tagline, icon } = APPS[id];
      expect(copy).toContain(`${id}: { name: "${name}", tagline: "${tagline}", icon: ${icon.displayName}, accent: "var(--color-accent-${id})" }`);
      const accent = new RegExp(`--color-accent-${id}: (oklch\\([^)]*\\))`);
      expect(css.match(accent)?.[1], id).toBe(styles.match(accent)?.[1]);
    }
  });
});

describe("sharedResponse", () => {
  it("lets only the apps named read it", () => {
    const env = { ATLAS_DOMAIN: "tail1234.ts.net" };
    const ask = (origin: string) => sharedResponse(new Request("https://hygeia.tail1234.ts.net/api/atlas/weights", { headers: { origin } }), { weights: [] }, ["milo"], env);
    expect(ask("https://milo.tail1234.ts.net").headers.get("access-control-allow-origin")).toBe("https://milo.tail1234.ts.net");
    expect(ask("https://atlas.tail1234.ts.net").headers.get("access-control-allow-origin")).toBeNull();
    expect(ask("https://evil.example").headers.get("access-control-allow-origin")).toBeNull();
  });
});
