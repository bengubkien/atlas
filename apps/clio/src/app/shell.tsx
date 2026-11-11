"use client";

import { useSyncRuntime } from "@atlas/sync/react";
import { useEffect, type ReactNode } from "react";

import { AppShell, type AppShellProps } from "@atlas/ui/shell";

import { useDueCount } from "@/lib/local/hooks";
import { thisDevice } from "@/lib/local/device";
import { seedSamples } from "@/lib/local/seed";
import { LocaleProvider } from "@/lib/locale";
import { NAV, PAGES } from "@/nav";

/** Clio in the suite's shell, kept in step with the server (see @atlas/sync). */
export function Shell({ locale, children, ...props }: Omit<AppShellProps, "app" | "nav" | "counts"> & { locale: string; children: ReactNode }) {
  useSyncRuntime(thisDevice, { build: process.env.NEXT_PUBLIC_CLIO_BUILD ?? "dev", pages: PAGES });
  // The sample texts, on first run and whenever a new build changes them.
  useEffect(() => {
    void seedSamples();
  }, []);
  // The words due show on the Review tab.
  const due = useDueCount();
  return (
    <LocaleProvider locale={locale}>
      <AppShell app="clio" nav={NAV} counts={due ? { "/review": due } : undefined} {...props}>
        {children}
      </AppShell>
    </LocaleProvider>
  );
}
