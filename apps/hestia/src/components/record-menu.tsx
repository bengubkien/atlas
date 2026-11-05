"use client";

import { Ellipsis, Pencil, Trash2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";

import { ConfirmDialog } from "@atlas/ui/components/confirm-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@atlas/ui/components/dropdown-menu";
import { toast, toastResult } from "@atlas/ui/components/toast";

import { deleteRecordAction, restoreRecordAction } from "@/app/records/actions";
import type { Entity } from "@/lib/micasa/api";

import { DialogForm } from "./dialogs";

/**
 * A record's "…" menu: Edit, which opens its form (the children), and
 * Delete, which asks first and can be undone from the toast. On a record's
 * own page, `after` is where to go once it's deleted (its list); Undo comes
 * back to the page.
 */
export function RecordMenu({
  entity,
  id,
  name,
  editTitle,
  after,
  children,
}: {
  entity: Entity;
  id: string;
  /** How the record is named in messages: "the fridge", "this quote". */
  name: string;
  editTitle?: string;
  after?: string;
  children?: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const trigger = useRef<HTMLButtonElement>(null);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const remove = async () => {
    const result = await deleteRecordAction(entity, id);
    if (!result.ok) {
      toast(result.error);
      return;
    }
    const from = pathname;
    if (after) router.push(after);
    toast(`Deleted ${name}.`, {
      action: {
        label: "Undo",
        onClick: () =>
          void restoreRecordAction(entity, id).then((restored) => {
            toastResult(restored);
            if (restored.ok && after) router.push(from);
          }),
      },
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          ref={trigger}
          aria-label={`More for ${name}`}
          title="More"
          className="grid size-9 shrink-0 place-items-center rounded-control text-muted hover:bg-hover hover:text-ink"
        >
          <Ellipsis size={18} aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {children && (
            <DropdownMenuItem onSelect={() => setEditing(true)}>
              <Pencil size={15} aria-hidden="true" />
              Edit
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => setConfirming(true)} className="text-error data-[highlighted]:text-error">
            <Trash2 size={15} aria-hidden="true" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {children && (
        <DialogForm open={editing} onOpenChange={setEditing} title={editTitle ?? "Edit"}>
          {children}
        </DialogForm>
      )}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Delete ${name}?`}
        description="You can undo it from the message that follows."
        confirmLabel="Delete"
        onConfirm={() => void remove()}
        returnFocusTo={trigger}
      />
    </>
  );
}
