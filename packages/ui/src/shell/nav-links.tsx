"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useSyncExternalStore } from "react";

import { cn } from "../cn";
import { isCurrent, type NavGroup, type NavItem } from "./nav";
import { useSidebarCollapsed } from "./sidebar-frame";

// Which collapsible groups are folded, by label. It's kept in localStorage so
// it survives a reload; when that's blocked it lasts until the page closes.
// Read through useSyncExternalStore, so the server and the first client
// render both show the group open and the saved choice arrives after.
const foldKey = (label: string) => `atlas-nav-folded:${label}`;
const foldedInMemory = new Map<string, boolean>();
const foldListeners = new Set<() => void>();

function readFolded(label: string): boolean {
  try {
    const saved = localStorage.getItem(foldKey(label));
    if (saved !== null) return saved === "1";
  } catch {
    // Blocked storage: fall back to the memory below.
  }
  return foldedInMemory.get(label) ?? false;
}

function writeFolded(label: string, folded: boolean) {
  foldedInMemory.set(label, folded);
  try {
    localStorage.setItem(foldKey(label), folded ? "1" : "0");
  } catch {
    // Not saved, but it still folds for now.
  }
  foldListeners.forEach((listener) => listener());
}

function subscribeFolded(listener: () => void) {
  foldListeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    foldListeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function useFolded(label: string | undefined): [folded: boolean, toggle: () => void] {
  const folded = useSyncExternalStore(
    subscribeFolded,
    () => (label ? readFolded(label) : false),
    () => false,
  );
  return [folded, () => label && writeFolded(label, !folded)];
}

/** The sidebar's navigation, with the current section highlighted (from Dossier). */
export function NavLinks({ nav, counts }: { nav: NavGroup[]; counts?: Record<string, number> }) {
  const pathname = usePathname();
  const collapsed = useSidebarCollapsed();
  return (
    <nav aria-label="Main" className="flex flex-1 flex-col gap-1">
      {nav.map((group, index) => (
        <Group
          key={group.label ?? index}
          group={group}
          pathname={pathname}
          counts={counts}
          collapsed={collapsed}
          bottom={nav.length > 1 && index === nav.length - 1}
        />
      ))}
    </nav>
  );
}

function Group({
  group: { label, items: all, collapsible },
  pathname,
  counts,
  collapsed,
  bottom,
}: {
  group: NavGroup;
  pathname: string;
  counts?: Record<string, number>;
  collapsed: boolean;
  bottom: boolean;
}) {
  // Items marked for the tab bar only (sidebar: false) aren't drawn here.
  const items = all.filter((item) => item.sidebar !== false);
  const [savedFold, toggle] = useFolded(collapsible ? label : undefined);
  const itemsId = useId();
  // Icons only: nothing to fold, and no room to indent.
  const folded = savedFold && !collapsed;
  const foldable = collapsible && label && !collapsed;
  return (
    <div
      className={cn(
        "flex flex-col gap-0.5",
        bottom && cn("mt-auto border-t border-line pt-2", collapsed ? "-mx-1 px-1" : "-mx-2 px-2"),
      )}
    >
      {label &&
        (collapsed ? (
          // Holds the label's place, so the groups stay apart with the labels hidden.
          <div aria-hidden="true" className="mx-2 my-[15px] h-px bg-line-card" />
        ) : foldable ? (
          <button
            type="button"
            onClick={toggle}
            aria-expanded={!folded}
            aria-controls={itemsId}
            className="mt-1.5 mb-1 flex items-center justify-between gap-2 rounded-control px-3 py-1 text-xs font-medium text-muted hover:bg-hover hover:text-ink motion-safe:transition-colors"
          >
            {label}
            <ChevronDown size={14} aria-hidden="true" className={cn("shrink-0 motion-safe:transition-transform", folded && "-rotate-90")} />
          </button>
        ) : (
          <div className="mt-1.5 mb-1 px-3 py-1 text-xs font-medium text-muted">{label}</div>
        ))}
      {!folded && (
        <div id={itemsId} className="flex flex-col gap-0.5">
          {items.map((item, index) => {
            const link = <ItemLink item={item} pathname={pathname} counts={counts} collapsed={collapsed} />;
            if (collapsed || item.depth !== 1) return <div key={item.href} className="contents">{link}</div>;
            // A child hangs off a line running down from its parent's icon, with
            // a short elbow into the row; the last child's line stops at its elbow.
            const first = items[index - 1]?.depth !== 1;
            const last = items[index + 1]?.depth !== 1;
            return (
              <div
                key={item.href}
                className={cn(
                  "relative ml-5 pl-3 before:absolute before:left-0 before:w-px before:bg-line-strong after:absolute after:top-1/2 after:left-0 after:h-px after:w-2.5 after:bg-line-strong",
                  // Each line is the row's height plus the 2px gap below it; the first
                  // reaches up across the gap to its parent, the last stops at its elbow.
                  first ? "before:-top-0.5" : "before:top-0",
                  first && last && "before:h-[calc(50%+2px)]",
                  first && !last && "before:h-[calc(100%+4px)]",
                  !first && last && "before:h-1/2",
                  !first && !last && "before:h-[calc(100%+2px)]",
                )}
              >
                {link}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ItemLink({
  item,
  pathname,
  counts,
  collapsed,
}: {
  item: NavItem;
  pathname: string;
  counts?: Record<string, number>;
  collapsed: boolean;
}) {
  const { href, label, icon: Icon } = item;
  const active = isCurrent(item, pathname);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      title={collapsed ? label : undefined}
      className={cn(
        "flex items-center gap-1.5 rounded-control px-3 py-1.5 text-sm font-medium hover:bg-hover hover:text-ink motion-safe:transition-colors",
        collapsed && "relative justify-center px-1.5",
        active ? "bg-hover text-ink" : "text-muted",
      )}
    >
      <Icon size={16} aria-hidden="true" className="shrink-0" />
      <span className={cn(collapsed && "sr-only")}>{label}</span>
      {counts?.[href] ? (
        <span
          className={cn(
            "ml-auto rounded-full bg-primary px-1.5 text-[11px] leading-[18px] font-semibold text-on-primary",
            collapsed && "absolute ml-0 translate-x-2.5 -translate-y-2",
          )}
        >
          {counts[href]}
          <span className="sr-only"> waiting</span>
        </span>
      ) : null}
    </Link>
  );
}
