"use client";

import { createContext, use } from "react";

import type { NavGroup } from "./nav";

const NavContext = createContext<NavGroup[]>([]);

/** Provided by <AppShell>, so the page bar can show the current section's icon. */
export const NavProvider = NavContext;

export function useNav(): NavGroup[] {
  return use(NavContext);
}
