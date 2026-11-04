// How an app looks, as the browser last chose it: the colour scheme and
// whether the sidebar is collapsed. Both live in cookies, so the server
// renders the right one from the first paint, with no flash. Each app keeps
// its own (they're on different addresses), and every one follows the system
// until its switch is used.

export const COLOR_SCHEME_COOKIE = "atlas_theme";
export const SIDEBAR_COOKIE = "atlas_sidebar";

export type ColorScheme = "light" | "dark";

/** The scheme the switch chose; undefined follows the system. */
export function parseColorScheme(value: string | undefined): ColorScheme | undefined {
  return value === "light" || value === "dark" ? value : undefined;
}

/** Whether the sidebar was left collapsed. */
export function parseSidebarCollapsed(value: string | undefined): boolean {
  return value === "collapsed";
}

const YEAR_SECONDS = 365 * 24 * 60 * 60;

/** Remembers a preference for a year, from the browser. */
export function rememberPreference(name: string, value: string): void {
  document.cookie = `${name}=${value}; path=/; max-age=${YEAR_SECONDS}; samesite=lax`;
}
