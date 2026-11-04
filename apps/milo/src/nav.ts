import { CalendarCheck, Dumbbell, History, ListChecks, PersonStanding, Settings, TrendingUp } from "lucide-react";

import type { NavGroup } from "@atlas/ui/shell";

/** Milo's sections. On a phone the first four are tabs; Routines, Exercises and Settings are under More (Today starts a routine too). */
export const NAV: NavGroup[] = [
  {
    items: [
      { href: "/", label: "Today", icon: CalendarCheck },
      { href: "/history", label: "History", icon: History },
      { href: "/muscles", label: "Muscles", icon: PersonStanding },
      { href: "/progress", label: "Progress", icon: TrendingUp },
      { href: "/routines", label: "Routines", icon: ListChecks },
      { href: "/exercises", label: "Exercises", icon: Dumbbell },
    ],
  },
  { items: [{ href: "/settings", label: "Settings", icon: Settings }] },
];
