"use client";

import { X } from "lucide-react";
import { Dialog } from "radix-ui";
import type { ReactNode } from "react";

/**
 * A dialog holding a short form: centred on a wide screen, a sheet from the
 * bottom on a phone, where the keyboard and the thumb are. Built on Radix
 * Dialog: focus moves in, Escape and the close button leave.
 */
export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  trigger,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** A line under the title; also what screen readers announce. */
  description?: ReactNode;
  /** The button that opens it, if it's next to the dialog. */
  trigger?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col overflow-y-auto rounded-t-dialog border border-line-popover bg-card px-5 pt-5 pb-[calc(20px+env(safe-area-inset-bottom))] shadow-menu focus:outline-none sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-[min(520px,calc(100vw-32px))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-dialog sm:p-6"
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <Dialog.Title className="font-serif text-[22px] leading-tight">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="text-sm text-muted">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
            </div>
            <Dialog.Close aria-label="Close" className="-mt-1 -mr-2 grid size-9 shrink-0 place-items-center rounded-control text-muted hover:bg-hover hover:text-ink">
              <X size={18} aria-hidden="true" />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
