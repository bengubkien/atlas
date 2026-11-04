import { LayoutGrid } from "lucide-react";

import type { NavGroup } from "@atlas/ui/shell";

/** Atlas's own sections. "Today" joins them once the apps report what's due (phase 5). */
export const NAV: NavGroup[] = [{ items: [{ href: "/", label: "Apps", icon: LayoutGrid }] }];
