import type { LucideIcon } from "lucide-react";

// An app's sections, shared by the sidebar, the phone's tab bar and the page
// bar's icon, so they always agree. An app defines them in a client module
// (icons are components, which can't be sent from the server) and hands them
// to <AppShell>.

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Whether the item is the current section; defaults to its own path and below. */
  isActive?: (pathname: string) => boolean;
  /** Shown in the phone's tab bar; true unless set to false. The bar holds five. */
  tab?: boolean;
  /** A shorter name for the tab bar, where there's little room: "Transactions" for "All transactions". */
  tabLabel?: string;
  /** Shown in the sidebar; true unless set to false, e.g. a phone tab for what the sidebar has as its main action button. */
  sidebar?: boolean;
  /** 1 indents the item under the one before it, like a file tree, in the sidebar. The tab bar and the collapsed sidebar ignore it. */
  depth?: 0 | 1;
};

/** The sections in groups; with more than one group, the last sits at the sidebar's bottom. */
export type NavGroup = {
  label?: string;
  items: NavItem[];
  /** The label becomes a button that folds the group (remembered per label). Needs a label; the collapsed sidebar never folds. */
  collapsible?: boolean;
};

export const within = (pathname: string, base: string) =>
  base === "/" ? pathname === "/" : pathname === base || pathname.startsWith(`${base}/`);

export const isCurrent = ({ href, isActive = (path) => within(path, href) }: NavItem, pathname: string) =>
  isActive(pathname);

/** The section a path belongs to, for the page bar's icon; undefined outside them all. */
export function currentSection(nav: NavGroup[], pathname: string): NavItem | undefined {
  return nav.flatMap((group) => group.items).find((item) => isCurrent(item, pathname));
}
