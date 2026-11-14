import { BookOpen, CalendarCheck, Layers, Settings, Star } from "lucide-react";

import type { NavGroup } from "@atlas/ui/shell";

/** Clio's sections. All five fit the phone's tab bar, Settings included, so nothing hides under More. */
export const NAV: NavGroup[] = [
  {
    items: [
      { href: "/", label: "Today", icon: CalendarCheck },
      // The reader belongs to the library: a text opens from it.
      { href: "/library", label: "Library", icon: BookOpen, isActive: (path) => path.startsWith("/library") || path.startsWith("/read") },
      { href: "/review", label: "Review", icon: Layers },
      { href: "/words", label: "Words", icon: Star },
    ],
  },
  { items: [{ href: "/settings", label: "Settings", icon: Settings }] },
];

/** The screens the offline copy keeps (a text opens as /read?t=<id>, so this list stays fixed). */
export const PAGES = ["/", "/library", "/read", "/review", "/words", "/settings"];
