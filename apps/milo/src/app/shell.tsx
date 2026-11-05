"use client";

import { Dumbbell } from "lucide-react";
import type { ReactNode } from "react";

import { AppShell, type AppShellProps } from "@atlas/ui/shell";

import { LinksProvider } from "@/lib/links";
import { LocaleProvider } from "@/lib/locale";
import { NAV } from "@/nav";

import { ActiveWorkoutBar } from "./active-workout-bar";
import { Runtime } from "./runtime";

/** Milo in the suite's shell. A client module, because the nav's icons are components. */
export function Shell({ locale, children, ...props }: Omit<AppShellProps, "app" | "nav" | "action"> & { locale: string; children: ReactNode }) {
  return (
    <LocaleProvider locale={locale}>
      <LinksProvider links={props.links}>
        <AppShell app="milo" nav={NAV} action={{ href: "/workout", label: "Workout", icon: Dumbbell }} {...props}>
          <ActiveWorkoutBar />
          {children}
        </AppShell>
      </LinksProvider>
      <Runtime />
    </LocaleProvider>
  );
}
