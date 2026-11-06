"use client";

import { useSyncRuntime } from "@atlas/sync/react";
import { Plus } from "lucide-react";
import { useEffect, type ReactNode } from "react";

import { AppShell, type AppShellProps } from "@atlas/ui/shell";

import { keepUp } from "@/lib/actions";
import { useSync, useToday } from "@/lib/local/hooks";
import { thisDevice } from "@/lib/local/device";
import { LocaleProvider } from "@/lib/locale";
import { NAV, PAGES } from "@/nav";

const ADD = { href: "/add", label: "Add transaction", icon: Plus };

/** Tyche in the suite's shell, kept in step with the server (see @atlas/sync). */
export function Shell({ locale, children, ...props }: Omit<AppShellProps, "app" | "nav" | "action"> & { locale: string; children: ReactNode }) {
  useSyncRuntime(thisDevice, { build: process.env.NEXT_PUBLIC_TYCHE_BUILD ?? "dev", pages: PAGES });
  useKeepUp();
  return (
    <LocaleProvider locale={locale}>
      <AppShell app="tyche" nav={NAV} action={ADD} {...props}>
        {children}
      </AppShell>
    </LocaleProvider>
  );
}

/**
 * Makes this month's bills and the starting categories when the app opens,
 * again after each sync (a recurring item may have come from another
 * device) and when the day changes.
 */
function useKeepUp() {
  const today = useToday();
  const lastSyncAt = useSync()?.lastSyncAt;
  useEffect(() => {
    void keepUp(today);
  }, [today, lastSyncAt]);
}
