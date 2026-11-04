"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { currentSection } from "../shell/nav";
import { useNav } from "../shell/nav-context";

export type PageHeaderProps = {
  title: ReactNode;
  /** A line or two under the bar that says what the screen is for. */
  description?: ReactNode;
  /** Buttons or status at the bar's right end, e.g. "Saved just now" and a primary action. */
  actions?: ReactNode;
  /** Before the title, e.g. a breadcrumb back to the list. Replaces the section's icon. */
  before?: ReactNode;
};

/**
 * The bar across the top of every screen (from Dossier): the section's icon,
 * the screen's title and its actions. On a wide screen it stays in view while
 * the page scrolls; on a phone it scrolls away under the top bar.
 */
export function PageHeader({ title, description, actions, before }: PageHeaderProps) {
  return (
    <>
      <PageBar>
        <div className="flex min-w-0 items-center gap-3">
          {before ?? <PageBarIcon />}
          <h1 className="font-serif text-[32px] leading-[1.1] font-normal tracking-[-0.015em] text-pretty lg:text-title">{title}</h1>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </PageBar>
      {/* The screen's content starts under the bar, after the description if there is one. */}
      {description ? (
        <p className="max-w-[620px] px-4 pt-1 pb-6 text-lead text-pretty text-muted lg:px-10 lg:pb-8">{description}</p>
      ) : (
        <div aria-hidden="true" className="h-5 lg:h-8" />
      )}
    </>
  );
}

/**
 * The bar itself, for screens that fill it some other way (a loading
 * skeleton, an error). On a wide screen it sticks to the top of the window;
 * the shell's colour behind it fills its rounded corners.
 */
export function PageBar({ children }: { children: ReactNode }) {
  return (
    <div className="lg:sticky lg:top-0 lg:z-20 lg:-mx-px lg:bg-paper lg:pt-2">
      <div className="flex min-h-12 flex-wrap items-center justify-between gap-x-6 gap-y-3 bg-surface px-4 pt-6 pb-2 lg:rounded-t-panel lg:border lg:border-b-0 lg:border-line-card lg:px-10 lg:pt-7 lg:pb-4">
        {children}
      </div>
    </div>
  );
}

/** The current section's icon from the sidebar, at the start of the page bar. */
export function PageBarIcon() {
  const nav = useNav();
  // No path outside a router (e.g. in a test): then there's no section to show.
  const pathname = usePathname();
  const Icon = pathname ? currentSection(nav, pathname)?.icon : undefined;
  return Icon ? <Icon size={26} strokeWidth={1.5} aria-hidden="true" className="hidden shrink-0 text-muted lg:block" /> : null;
}

/** The screen's content under its header, with the shell's side margins. */
export function PageBody({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`flex flex-col gap-8 px-4 pb-10 lg:px-10 lg:pb-16 ${className}`}>{children}</div>;
}
