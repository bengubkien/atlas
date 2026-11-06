import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CalendarClock,
  Clock,
  Gauge,
  Landmark,
  LayoutDashboard,
  PiggyBank,
  Plus,
  Settings,
  Target,
  TrendingUp,
} from "lucide-react";

import type { NavGroup } from "@atlas/ui/shell";

/**
 * Tyche's sections. On a phone the tabs are Overview, Transactions, Add and
 * Bills; the rest are under More. Add is the sidebar's main button on a wide
 * screen (the shell's action), so it's a tab only.
 */
export const NAV: NavGroup[] = [
  { items: [{ href: "/", label: "Overview", icon: LayoutDashboard }] },
  {
    label: "Transactions",
    collapsible: true,
    items: [
      {
        href: "/transactions",
        label: "All transactions",
        tabLabel: "Transactions",
        icon: ArrowLeftRight,
        // The lists below have their own rows; on a phone they're all the Transactions tab.
        isActive: (path) => path === "/transactions",
      },
      { href: "/transactions/income", label: "Income", icon: ArrowDownLeft, depth: 1, tab: false },
      { href: "/transactions/expenses", label: "Expenses", icon: ArrowUpRight, depth: 1, tab: false },
      { href: "/transactions/pending", label: "Pending", icon: Clock, depth: 1, tab: false },
      { href: "/add", label: "Add", icon: Plus, sidebar: false },
      { href: "/bills", label: "Recurring bills", tabLabel: "Bills", icon: CalendarClock },
    ],
  },
  {
    label: "Accounts",
    collapsible: true,
    items: [
      { href: "/accounts/bank", label: "Cards and bank", icon: Landmark, tab: false },
      { href: "/accounts/savings", label: "Savings", icon: PiggyBank, tab: false },
      { href: "/accounts/investments", label: "Investments", icon: TrendingUp, tab: false },
    ],
  },
  {
    label: "Plan",
    collapsible: true,
    items: [
      { href: "/goals", label: "Savings goals", icon: Target, tab: false },
      { href: "/budgets", label: "Budget limits", icon: Gauge, tab: false },
    ],
  },
  { items: [{ href: "/settings", label: "Settings", icon: Settings, tab: false }] },
];

/** The screens the offline copy keeps (details are these pages with ?t=, ?r=, ?a=, ?g=, ?m=). */
export const PAGES = [
  "/",
  "/transactions",
  "/transactions/income",
  "/transactions/expenses",
  "/transactions/pending",
  "/add",
  "/bills",
  "/accounts/bank",
  "/accounts/savings",
  "/accounts/investments",
  "/goals",
  "/budgets",
  "/settings",
];
