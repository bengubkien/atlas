"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { APPS, type AppId, type AppLinks } from "../apps";
import { cn } from "../cn";
import type { ColorScheme } from "../preferences";
import { AppMark } from "./app-mark";
import { AppSwitcher } from "./app-switcher";
import type { NavGroup } from "./nav";
import { NavProvider } from "./nav-context";
import { NavLinks } from "./nav-links";
import { SidebarFrame } from "./sidebar-frame";
import { TabBar } from "./tab-bar";
import { ThemeToggle } from "./theme-toggle";

export type ShellViewer = { name: string; login: string };

export type ShellAction = { href: string; label: string; icon: LucideIcon };

export type AppShellProps = {
  app: AppId;
  nav: NavGroup[];
  /** Where every app is, for the switcher; from appLinks() on the server. */
  links: AppLinks;
  viewer: ShellViewer;
  /** The sidebar collapsed to its icons, as last left. */
  collapsed: boolean;
  /** The scheme the switch chose last, if any. */
  colorScheme?: ColorScheme;
  /** The app's main action, at the top of the sidebar (Dossier's "New application"). */
  action?: ShellAction;
  /** Badges by nav item, e.g. things waiting. */
  counts?: Record<string, number>;
  /** Shown under your name in the sidebar's footer. */
  version?: string;
  children: ReactNode;
};

/** Up to two initials for the avatar, e.g. "Jane Doe" → "JD". */
function initials(name: string): string {
  const parts = name.trim().split(/[\s@._-]+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]!.toUpperCase()).join("") || "?";
}

/**
 * The frame every Atlas app's screens sit in. On a wide screen it's Dossier's:
 * the sidebar on the left and the screen in a panel on the right. On a phone,
 * a top bar with the app's name and the switcher, and the sections in a tab
 * bar at the bottom, within thumb's reach.
 */
export function AppShell({ app, nav, links, viewer, collapsed, colorScheme, action, counts, version, children }: AppShellProps) {
  const info = APPS[app];
  const items = nav.flatMap((group) => group.items);
  const hasTabs = items.length > 1;

  return (
    <NavProvider value={nav}>
      <div className="flex min-h-dvh">
        <a
          href="#main"
          className="fixed top-3 left-3 z-50 -translate-y-[200%] rounded-control bg-primary px-4 py-2.5 text-sm font-medium text-on-primary hover:text-on-primary focus:translate-y-0"
        >
          Skip to content
        </a>

        <SidebarFrame
          initialCollapsed={collapsed}
          brand={
            <>
              <AppMark app={app} />
              <div className="flex min-w-0 flex-col group-data-collapsed/sidebar:hidden">
                <span className="font-serif text-2xl leading-none font-medium tracking-[-0.01em]">{info.name}</span>
                <span className="truncate text-xs text-muted">{info.tagline}</span>
              </div>
            </>
          }
          headerEnd={<AppSwitcher current={app} links={links} />}
        >
          <div className="flex flex-1 flex-col gap-1 p-2 group-data-collapsed/sidebar:px-1">
            {/* Collapsed, the switcher leaves the header for the top of the strip. */}
            <div className="hidden justify-center pb-1 group-data-collapsed/sidebar:flex">
              <AppSwitcher current={app} links={links} className="size-8" />
            </div>
            {action && <ActionLink action={action} />}
            <NavLinks nav={nav} counts={counts} />
          </div>

          <div className="flex flex-col gap-0.5 border-t border-line p-2 group-data-collapsed/sidebar:px-1">
            <ThemeToggle serverScheme={colorScheme} />
          </div>

          <div className="flex items-center gap-2 border-t border-line px-4 py-3 group-data-collapsed/sidebar:flex-col group-data-collapsed/sidebar:px-1">
            <span
              aria-hidden="true"
              title={viewer.name}
              className="grid size-[26px] shrink-0 place-items-center rounded-full bg-primary text-[11px] font-semibold text-on-primary"
            >
              {initials(viewer.name)}
            </span>
            <span className="flex min-w-0 flex-1 flex-col group-data-collapsed/sidebar:hidden">
              <span className="truncate text-xs font-medium">{viewer.name}</span>
              <span className="truncate text-[11px] text-muted" title={viewer.login}>
                Through Tailscale{version ? ` · v${version}` : ""}
              </span>
            </span>
          </div>
        </SidebarFrame>

        <div className="flex min-w-0 flex-1 flex-col lg:bg-paper lg:px-2 lg:pb-2">
          <header className="sticky top-0 z-30 flex items-center gap-2.5 border-b border-line bg-paper/90 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-md lg:hidden">
            <div className="flex min-h-14 min-w-0 flex-1 items-center gap-2.5">
              <AppMark app={app} size={28} />
              <span className="truncate font-serif text-[22px] leading-none font-medium tracking-[-0.01em]">{info.name}</span>
            </div>
            <ThemeToggle serverScheme={colorScheme} variant="icon" />
            <AppSwitcher current={app} links={links} className="-mr-2 size-10 [&>svg]:size-5" />
          </header>

          {/* The screen sits in a panel inset from the shell on a wide screen;
              each screen starts with its page bar, which draws the panel's top edge. */}
          <main
            id="main"
            tabIndex={-1}
            className={cn(
              "relative flex min-w-0 flex-1 flex-col bg-surface focus:outline-none lg:rounded-b-panel lg:border lg:border-t-0 lg:border-line-card",
              hasTabs && "pb-tabbar lg:pb-0",
            )}
          >
            {children}
          </main>
        </div>

        {hasTabs && <TabBar items={items} counts={counts} />}
      </div>
    </NavProvider>
  );
}

function ActionLink({ action: { href, label, icon: Icon } }: { action: ShellAction }) {
  return (
    <Link
      href={href}
      title={label}
      className="mb-2 flex min-h-[34px] items-center gap-1.5 rounded-control bg-primary px-3 text-sm font-semibold text-on-primary shadow-cta hover:bg-primary-hover hover:text-on-primary motion-safe:transition-colors group-data-collapsed/sidebar:justify-center group-data-collapsed/sidebar:px-1.5"
    >
      <Icon size={16} aria-hidden="true" className="shrink-0" />
      <span className="group-data-collapsed/sidebar:sr-only">{label}</span>
    </Link>
  );
}
