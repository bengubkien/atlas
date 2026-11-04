"use client";

import { Grip } from "lucide-react";
import { Popover } from "radix-ui";

import { APP_IDS, APPS, type AppId, type AppLinks } from "../apps";
import { cn } from "../cn";
import { AppMark } from "./app-mark";

/**
 * The button that opens every app in the suite, like Google's: a grid of
 * marks, the current app highlighted. The others open in the same tab, where
 * each has its own address. An app that isn't running shows, dimmed, without
 * a link.
 */
export function AppSwitcher({ current, links, className }: { current: AppId; links: AppLinks; className?: string }) {
  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label="Apps"
        title="Apps"
        className={cn(
          "grid size-7 shrink-0 place-items-center rounded-control text-muted hover:bg-hover hover:text-ink data-[state=open]:bg-hover data-[state=open]:text-ink",
          className,
        )}
      >
        <Grip size={16} aria-hidden="true" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={8}
          collisionPadding={16}
          aria-label="Atlas apps"
          className="z-50 w-[336px] max-w-[calc(100vw-32px)] rounded-dialog border border-line-popover bg-card p-2 shadow-menu focus:outline-none motion-safe:animate-toast-in"
        >
          <p className="px-2 pt-1.5 pb-2 text-xs font-medium text-muted">Atlas</p>
          <ul className="grid grid-cols-3 gap-1">
            {APP_IDS.map((id) => (
              <li key={id}>
                <AppTile id={id} href={links[id]} current={id === current} />
              </li>
            ))}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function AppTile({ id, href, current }: { id: AppId; href: string | null; current: boolean }) {
  const { name } = APPS[id];
  const body = (
    <>
      <AppMark app={id} size={44} />
      <span className="text-control font-medium">{name}</span>
      {!href && <span className="-mt-1 text-[11px] text-muted">Not running</span>}
    </>
  );
  const tile = "flex h-full flex-col items-center gap-2 rounded-card px-1 pt-3 pb-2.5 text-center";

  if (!href) {
    return (
      <span aria-disabled="true" className={cn(tile, "text-muted [&>span:first-child]:opacity-45")}>
        {body}
      </span>
    );
  }
  return (
    <a
      href={href}
      aria-current={current ? "page" : undefined}
      className={cn(tile, "text-ink hover:bg-hover hover:text-ink", current && "bg-selected hover:bg-selected")}
    >
      {body}
    </a>
  );
}
