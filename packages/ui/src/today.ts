// "Today" on the launcher: each app answers GET /api/atlas/today with what
// matters today, in this shape, and Atlas shows the answers together. The
// browser asks each app itself, at the app's own address, so Tailscale tells
// each one who is asking, exactly as when you open it; Atlas never calls the
// other apps from its server. Kairos builds the same shape in its own copy
// (apps/kairos/src/atlas/today.ts), because it can't import this package.

export const TODAY_PATH = "/api/atlas/today";

/** At most this many items per app; the rest are counted in `more`. */
export const TODAY_MAX_ITEMS = 5;

/** How an item reads at a glance: past due, coming up soon, or already done. Without one, it's plain. */
export type TodayTone = "overdue" | "soon" | "done";

export type TodayItem = {
  /** What it is, in a few words: "Clean the gutters", "Metformin 500 mg". */
  title: string;
  /** When or why, shorter still: "Was due Oct 2", "08:00". */
  detail?: string;
  /** Where it opens, as a path in the app: "/maintenance/01J…". */
  href: string;
  tone?: TodayTone;
};

export type TodayReport = {
  /** One sentence for the app: "2 things overdue.", "Nothing due today." */
  summary: string;
  items: TodayItem[];
  /** How many more there are than `items` shows. */
  more: number;
};

const TONES: readonly TodayTone[] = ["overdue", "soon", "done"];

const text = (value: unknown, max: number): string | null =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;

/** Only an app's own pages: a path, never another site. */
const path = (value: unknown): string | null =>
  typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") ? value : null;

/** An app's answer, or null when it isn't one. Items that don't fit the shape are left out. */
export function parseToday(value: unknown): TodayReport | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const summary = text(raw.summary, 200);
  if (!summary || !Array.isArray(raw.items)) return null;

  const items: TodayItem[] = [];
  for (const entry of raw.items.slice(0, TODAY_MAX_ITEMS)) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>;
    const title = text(item.title, 120);
    const href = path(item.href);
    if (!title || !href) continue;
    const detail = text(item.detail, 120);
    const tone = TONES.find((t) => t === item.tone);
    items.push({ title, href, ...(detail ? { detail } : {}), ...(tone ? { tone } : {}) });
  }
  const more = typeof raw.more === "number" && Number.isInteger(raw.more) && raw.more > 0 ? raw.more : 0;
  return { summary, items, more };
}

/** A report from every item an app has: the first few, and how many more. */
export function todayReport(summary: string, items: TodayItem[]): TodayReport {
  return { summary, items: items.slice(0, TODAY_MAX_ITEMS), more: Math.max(0, items.length - TODAY_MAX_ITEMS) };
}
