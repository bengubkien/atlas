import { Contact, FileText, Hammer, House, LayoutDashboard, Refrigerator, TriangleAlert, Wrench } from "lucide-react";

import type { NavGroup } from "@atlas/ui/shell";

/** Hestia's sections. On a phone the first four are tabs and the rest are under More. */
export const NAV: NavGroup[] = [
  {
    items: [
      { href: "/", label: "Overview", icon: LayoutDashboard },
      { href: "/maintenance", label: "Maintenance", icon: Wrench },
      { href: "/projects", label: "Projects", icon: Hammer },
      { href: "/incidents", label: "Incidents", icon: TriangleAlert },
    ],
  },
  {
    label: "Records",
    items: [
      { href: "/appliances", label: "Appliances", icon: Refrigerator },
      { href: "/vendors", label: "Vendors", icon: Contact },
      { href: "/documents", label: "Documents", icon: FileText },
      { href: "/house", label: "Your house", icon: House },
    ],
  },
];
