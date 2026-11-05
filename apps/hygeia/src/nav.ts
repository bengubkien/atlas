import { Activity, CalendarClock, FlaskConical, NotebookPen, PersonStanding, Pill, Settings, Sun } from "lucide-react";

import type { NavGroup } from "@atlas/ui/shell";

/** Hygeia's sections. On a phone the first four are tabs; the rest are under More. */
export const NAV: NavGroup[] = [
  {
    items: [
      { href: "/", label: "Today", icon: Sun },
      { href: "/measurements", label: "Measurements", icon: Activity },
      { href: "/medications", label: "Medications", icon: Pill },
      { href: "/journal", label: "Journal", icon: NotebookPen },
      { href: "/body", label: "Body", icon: PersonStanding },
      { href: "/appointments", label: "Appointments", icon: CalendarClock },
      { href: "/labs", label: "Lab results", icon: FlaskConical },
    ],
  },
  { items: [{ href: "/settings", label: "Settings", icon: Settings }] },
];

/** The screens the offline copy keeps (detail views are these pages with ?m=, ?r=, ?t=, ?d=, ?a=). */
export const PAGES = ["/", "/measurements", "/medications", "/journal", "/body", "/appointments", "/labs", "/labs/body", "/settings"];
