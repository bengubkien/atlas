"use client";

import { AppShell, type AppShellProps } from "@atlas/ui/shell";

import { NAV } from "@/nav";

/** Hestia in the suite's shell. A client module, because the nav's icons are components. */
export function Shell(props: Omit<AppShellProps, "app" | "nav">) {
  return <AppShell app="hestia" nav={NAV} {...props} />;
}
