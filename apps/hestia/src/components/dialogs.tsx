"use client";

import { createContext, useContext, useState, useTransition, type ReactNode } from "react";

import type { ActionResult } from "@atlas/ui/action-result";
import { Button, type ButtonSize, type ButtonVariant } from "@atlas/ui/components/button";
import { FormDialog } from "@atlas/ui/components/form-dialog";
import { toastResult } from "@atlas/ui/components/toast";

// The pieces every form in Hestia shares: a button that opens a form in a
// dialog, a way for the form inside to close it, a submit that shows the
// outcome, and the form's error and buttons.

const CloseDialog = createContext<(() => void) | null>(null);

/** Closes the dialog the form is in; nothing when it isn't in one. */
export const useCloseDialog = () => useContext(CloseDialog) ?? (() => {});
/** Whether the form is in a dialog (a Cancel button makes sense). */
export const useInDialog = () => useContext(CloseDialog) !== null;

/** A form in a dialog, given what it's for. The form starts afresh each time it opens. */
export function DialogForm({
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
  description?: ReactNode;
  trigger?: ReactNode;
  children: ReactNode;
}) {
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={title} description={description} trigger={trigger}>
      <CloseDialog.Provider value={() => onOpenChange(false)}>{open && children}</CloseDialog.Provider>
    </FormDialog>
  );
}

/** A button that opens a form: "Add item", "Add a quote". */
export function DialogButton({
  label,
  icon,
  title,
  description,
  variant = "primary",
  size,
  className,
  ariaLabel,
  children,
}: {
  label: string;
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  /** What the button does, when its label alone doesn't say (a short "Log" in a list). */
  ariaLabel?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <DialogForm
      open={open}
      onOpenChange={setOpen}
      title={title}
      description={description}
      trigger={
        <Button variant={variant} size={size} className={className} aria-label={ariaLabel}>
          {icon}
          {label}
        </Button>
      }
    >
      {children}
    </DialogForm>
  );
}

/**
 * Sends a form's action and shows how it went: on success its toast, the
 * dialog closes and `onDone` runs; on failure the error stays in the form.
 */
export function useSubmit<T>(onDone?: (data: T) => void) {
  const close = useCloseDialog();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const submit = (call: () => Promise<ActionResult<T>>) => {
    setError(null);
    startTransition(async () => {
      const result = toastResult(await call());
      if (result.ok) {
        close();
        onDone?.(result.data);
      } else {
        setError(result.error);
      }
    });
  };
  return { error, pending, submit, setError };
}

/** A form's error, then Cancel (in a dialog) and the button that sends it. */
export function FormFooter({ error, pending, label, pendingLabel }: { error: string | null; pending: boolean; label: string; pendingLabel: string }) {
  const close = useCloseDialog();
  const inDialog = useInDialog();
  return (
    <>
      {error && (
        <p role="alert" className="text-label text-error">
          {error}
        </p>
      )}
      <div className="mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {inDialog && (
          <Button variant="secondary" size="lg" onClick={close}>
            Cancel
          </Button>
        )}
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? pendingLabel : label}
        </Button>
      </div>
    </>
  );
}

/** A form field's value as text: "" for nothing. */
export const field = (form: FormData, key: string) => String(form.get(key) ?? "");
