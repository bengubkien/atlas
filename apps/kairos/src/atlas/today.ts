import "server-only";

import type { AttentionItem } from "@/lib/dashboard";
import { loadDashboard } from "@/lib/dashboard-data";
import { loadSettings } from "@/lib/settings-data";
import { lastKnownTimeZone } from "@/lib/time-zone";

import { appLinks } from "./app-links";

// Atlas's patch (see ATLAS.md): Kairos's answer to Atlas's Today, the
// dashboard's "Worth a look" (interviews today or tomorrow first). The shape
// is Atlas's, from packages/ui/src/today.ts, which Kairos can't import.

type TodayItem = { title: string; detail?: string; href: string; tone?: "overdue" | "soon" | "done" };
type TodayReport = { summary: string; items: TodayItem[]; more: number };

const MAX_ITEMS = 5;

const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;

/** The first sentence of the dashboard's reason, which is enough on the launcher. */
const firstSentence = (text: string) => /^.*?[.!?](?=\s|$)/.exec(text)?.[0].replace(/\.$/, "") ?? text;

export function todayFrom(attention: AttentionItem[]): TodayReport {
  const items = attention.map(
    (item): TodayItem => ({
      title: [item.company, item.role].filter(Boolean).join(", ") || "Untitled application",
      detail: firstSentence(item.reason),
      href: `/applications/${encodeURIComponent(item.id)}${item.tab ? `?tab=${item.tab}` : ""}`,
      ...(item.soon ? { tone: "soon" as const } : {}),
    }),
  );
  const soon = attention.filter((item) => item.soon).length;
  const summary =
    attention.length === 0
      ? "All caught up."
      : `${plural(attention.length, "thing")} worth a look${soon ? `, ${plural(soon, "interview")} today or tomorrow` : ""}.`;
  return { summary, items: items.slice(0, MAX_ITEMS), more: Math.max(0, items.length - MAX_ITEMS) };
}

export async function kairosToday(): Promise<TodayReport> {
  const [settings, timeZone] = await Promise.all([loadSettings(), lastKnownTimeZone()]);
  // Without Gmail's replies: asking Google could keep the launcher waiting.
  const figures = await loadDashboard({ quietDays: settings.quietDays, timeZone });
  return todayFrom(figures.attention);
}

/** The answer, readable from Atlas's address only (CORS), never cached. */
export function todayResponse(request: Request, report: TodayReport): Response {
  const headers = new Headers({ "cache-control": "private, no-store", vary: "Origin" });
  const origin = request.headers.get("origin");
  const atlas = appLinks().atlas;
  if (origin && atlas && origin === new URL(atlas).origin) headers.set("access-control-allow-origin", origin);
  return Response.json(report, { headers });
}
