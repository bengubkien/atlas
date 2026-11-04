"use client";

import { useSyncRuntime } from "@atlas/sync/react";
import type { ReactNode } from "react";

import { AppShell, type AppShellProps } from "@atlas/ui/shell";

import { thisDevice } from "@/lib/local/device";
import { LocaleProvider } from "@/lib/locale";
import { NAV, PAGES } from "@/nav";

/** Hygeia in the suite's shell, kept in step with the server (see @atlas/sync). */
export function Shell({ locale, children, ...props }: Omit<AppShellProps, "app" | "nav"> & { locale: string; children: ReactNode }) {
  useSyncRuntime(thisDevice, { build: process.env.NEXT_PUBLIC_HYGEIA_BUILD ?? "dev", pages: PAGES });
  return (
    <LocaleProvider locale={locale}>
      <AppShell app="hygeia" nav={NAV} {...props}>
        {children}
      </AppShell>
    </LocaleProvider>
  );
}
