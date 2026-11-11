"use client";

import { X } from "lucide-react";
import { Dialog, Popover } from "radix-ui";
import { useMemo, useSyncExternalStore, type ReactNode } from "react";

import { cn } from "@atlas/ui/cn";

// The reader's sheets: from the bottom on a phone, where the thumb is, and
// on a desktop either a popover beside the word that opened it (`anchor`)
// or a dialog in the middle. Both are Radix's: focus moves in and stays
// in, Escape and the close button leave, and focus goes back to the word.

const WIDE = "(min-width: 1024px) and (pointer: fine)";

function subscribeWide(listener: () => void) {
  const query = window.matchMedia(WIDE);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

/** A desktop with a mouse: popovers there, sheets everywhere else. */
export function useWide(): boolean {
  return useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE).matches, () => false);
}

const sheetClass =
  "fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col overflow-y-auto rounded-t-dialog border border-line-popover bg-card px-5 pt-3 pb-[calc(20px+env(safe-area-inset-bottom))] shadow-menu focus:outline-none sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-[min(520px,calc(100vw-32px))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-dialog sm:p-6";

function Header({ title, label, Close }: { title: ReactNode; label: string; Close: typeof Dialog.Close }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">{title}</div>
      <Close aria-label={`Close ${label}`} className="-mt-1 -mr-2 grid size-10 shrink-0 place-items-center rounded-control text-muted hover:bg-hover hover:text-ink">
        <X size={18} aria-hidden="true" />
      </Close>
    </div>
  );
}

export function Sheet({
  open,
  onOpenChange,
  label,
  title,
  anchor,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What screen readers call it: "学习, the word". */
  label: string;
  /** Drawn at the top, beside the close button. */
  title: ReactNode;
  /** On a desktop, open beside this element instead of in the middle. */
  anchor?: HTMLElement | null;
  children: ReactNode;
}) {
  const wide = useWide();
  const virtual = useMemo(() => (anchor ? { current: anchor } : null), [anchor]);
  // Back to the word that opened it (Radix would look for a trigger, and there's none).
  const returnFocus = (event: Event) => {
    if (!anchor?.isConnected) return;
    event.preventDefault();
    anchor.focus({ preventScroll: true });
  };

  if (wide && virtual) {
    return (
      <Popover.Root open={open} onOpenChange={onOpenChange} modal>
        <Popover.Anchor virtualRef={virtual} />
        <Popover.Portal>
          <Popover.Content
            role="dialog"
            aria-label={label}
            side="bottom"
            align="center"
            sideOffset={8}
            collisionPadding={16}
            onCloseAutoFocus={returnFocus}
            className="z-50 flex max-h-[min(560px,var(--radix-popover-content-available-height))] w-[380px] flex-col overflow-y-auto rounded-dialog border border-line-popover bg-card p-5 shadow-menu focus:outline-none"
          >
            <Header title={title} label={label} Close={Popover.Close as typeof Dialog.Close} />
            {children}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    );
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
        <Dialog.Content aria-describedby={undefined} onCloseAutoFocus={returnFocus} className={cn(sheetClass)}>
          {/* A handle, so it reads as a sheet that can be put away. */}
          <div aria-hidden="true" className="mx-auto mb-2 h-1 w-10 shrink-0 rounded-full bg-line-strong sm:hidden" />
          <Dialog.Title className="sr-only">{label}</Dialog.Title>
          <Header title={title} label={label} Close={Dialog.Close} />
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
