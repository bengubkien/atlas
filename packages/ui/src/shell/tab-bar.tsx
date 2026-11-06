"use client";

import { Ellipsis, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dialog } from "radix-ui";
import { useState, type ReactNode } from "react";

import { cn } from "../cn";
import { isCurrent, type NavItem } from "./nav";

const MAX_TABS = 5;

/**
 * The phone's sections, at the bottom of the screen within thumb's reach. Up
 * to five fit; with more, the first four stay and a "More" tab opens the
 * rest in a sheet from the bottom. Items marked `tab: false` always go there.
 */
export function TabBar({ items, counts }: { items: NavItem[]; counts?: Record<string, number> }) {
  const pathname = usePathname();
  const candidates = items.filter((item) => item.tab !== false);
  let shown = candidates.slice(0, MAX_TABS);
  if (items.some((item) => !shown.includes(item))) shown = candidates.slice(0, MAX_TABS - 1);
  const more = items.filter((item) => !shown.includes(item));

  return (
    <nav
      aria-label="Sections"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-sidebar/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
    >
      <ul className="mx-auto flex max-w-[560px]">
        {shown.map((item) => (
          <li key={item.href} className="flex-1">
            <Tab
              href={item.href}
              label={item.tabLabel ?? item.label}
              icon={<item.icon size={20} aria-hidden="true" strokeWidth={isCurrent(item, pathname) ? 2.25 : 2} />}
              active={isCurrent(item, pathname)}
              count={counts?.[item.href]}
            />
          </li>
        ))}
        {more.length > 0 && (
          <li className="flex-1">
            <MoreTab items={more} pathname={pathname} counts={counts} />
          </li>
        )}
      </ul>
    </nav>
  );
}

const tabClass = (active: boolean) =>
  cn(
    "flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px] font-medium",
    active ? "text-ink hover:text-ink" : "text-muted hover:text-ink",
  );

function TabIcon({ active, count, children }: { active: boolean; count?: number; children: ReactNode }) {
  return (
    <span className={cn("relative grid h-7 w-14 place-items-center rounded-full motion-safe:transition-colors", active && "bg-selected")}>
      {children}
      {count ? (
        <span className="absolute -top-1 right-2 rounded-full bg-primary px-1.5 text-[10px] leading-4 font-semibold text-on-primary">
          {count}
          <span className="sr-only"> waiting</span>
        </span>
      ) : null}
    </span>
  );
}

function Tab({ href, label, icon, active, count }: { href: string; label: string; icon: ReactNode; active: boolean; count?: number }) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={tabClass(active)}>
      <TabIcon active={active} count={count}>
        {icon}
      </TabIcon>
      {label}
    </Link>
  );
}

function MoreTab({ items, pathname, counts }: { items: NavItem[]; pathname: string; counts?: Record<string, number> }) {
  const [open, setOpen] = useState(false);
  const active = items.some((item) => isCurrent(item, pathname));
  const waiting = items.reduce((sum, item) => sum + (counts?.[item.href] ?? 0), 0);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger className={tabClass(active || open)}>
        <TabIcon active={active || open} count={waiting || undefined}>
          <Ellipsis size={20} aria-hidden="true" />
        </TabIcon>
        More
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30 lg:hidden" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 rounded-t-dialog border-t border-line-popover bg-card px-2 pt-2 pb-[calc(8px+env(safe-area-inset-bottom))] shadow-dialog focus:outline-none motion-safe:animate-toast-in lg:hidden">
          <div className="flex items-center justify-between px-3 pt-1 pb-2">
            <Dialog.Title className="text-xs font-medium text-muted">More</Dialog.Title>
            <Dialog.Close aria-label="Close" className="grid size-9 place-items-center rounded-control text-muted hover:bg-hover hover:text-ink">
              <X size={18} aria-hidden="true" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">The rest of this app&apos;s sections.</Dialog.Description>
          <ul className="flex flex-col gap-0.5">
            {items.map((item) => {
              const { href, label, icon: Icon } = item;
              const current = isCurrent(item, pathname);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={() => setOpen(false)}
                    aria-current={current ? "page" : undefined}
                    className={cn(
                      "flex min-h-12 items-center gap-3 rounded-control px-3 text-field font-medium hover:bg-hover hover:text-ink",
                      current ? "bg-hover text-ink" : "text-ink",
                    )}
                  >
                    <Icon size={20} aria-hidden="true" className="text-muted" />
                    {label}
                    {counts?.[href] ? (
                      <span className="ml-auto rounded-full bg-primary px-1.5 text-[11px] leading-[18px] font-semibold text-on-primary">
                        {counts[href]}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
