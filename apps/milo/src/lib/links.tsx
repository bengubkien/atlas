"use client";

import { createContext, use, type ReactNode } from "react";

import type { AppLinks } from "@atlas/ui/apps";

// The other apps' addresses, as the server knows them (ATLAS_DOMAIN), for a
// screen that reads from one of them in the browser (Hygeia's body weight).

const Links = createContext<AppLinks | null>(null);

export function LinksProvider({ links, children }: { links: AppLinks; children: ReactNode }) {
  return <Links value={links}>{children}</Links>;
}

export const useAppLinks = () => use(Links);
