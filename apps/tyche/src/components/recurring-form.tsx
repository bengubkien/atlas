"use client";

import { useState } from "react";

import { Button } from "@atlas/ui/components/button";
import { Checkbox } from "@atlas/ui/components/checkbox";
import { FormDialog } from "@atlas/ui/components/form-dialog";
import { Input } from "@atlas/ui/components/input";
import { SegmentedControl } from "@atlas/ui/components/segmented-control";
import { Select } from "@atlas/ui/components/select";
import { Textarea } from "@atlas/ui/components/textarea";
import { ConfirmDialog } from "@atlas/ui/components/confirm-dialog";
import { toast } from "@atlas/ui/components/toast";
import { parseMoney } from "@atlas/ui/format";

import { deleteRecurring, lastAccount, restoreRecurring, saveRecurring } from "@/lib/actions";
import { GROUP_NAMES } from "@/lib/categories";
import { isDate } from "@/lib/dates";
import { useAccounts, useCategories, useToday } from "@/lib/local/hooks";
import { FREQUENCIES, type Frequency, type Recurring } from "@/lib/model";

const FREQUENCY_NAMES: Record<Frequency, string> = {
  weekly: "Weekly",
  biweekly: "Every two weeks",
  monthly: "Monthly",
  yearly: "Yearly",
};

type Direction = "bill" | "pay";

/** Adding or changing a bill or pay that comes back. `onDone` is called after saving or deleting. */
export function RecurringForm({ item, onDone }: { item?: Recurring; onDone: () => void }) {
  const today = useToday();
  const accounts = useAccounts();
  const categories = useCategories();
  const [direction, setDirection] = useState<Direction>(item && item.amount > 0 ? "pay" : "bill");
  const [categoryId, setCategoryId] = useState<string>(item?.categoryId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const usable = (accounts ?? []).filter((account) => !account.archived || account.id === item?.accountId);
  // Pay is income; a bill is anything you spend: fixed bills and daily spending.
  const groups = direction === "pay" ? ["income"] : ["bills", "daily"];
  const offered = (categories ?? []).filter((category) => groups.includes(category.group));
  const chosen = offered.some((category) => category.id === categoryId) ? categoryId : "";

  const save = async (form: FormData) => {
    const name = String(form.get("name") ?? "").trim().slice(0, 80);
    const amount = parseMoney(String(form.get("amount") ?? ""));
    const start = String(form.get("start") ?? "");
    const end = String(form.get("end") ?? "");
    const accountId = String(form.get("accountId") ?? "");
    if (!name) return setError("Give it a name.");
    if (typeof amount !== "number" || amount === 0) return setError("Type an amount above zero.");
    if (!accountId) return setError("Pick an account.");
    if (!isDate(start)) return setError("Pick the first date.");
    if (end && (!isDate(end) || end < start)) return setError("The last date can't be before the first.");
    await saveRecurring(
      {
        ...(item ? { id: item.id } : {}),
        name,
        accountId,
        categoryId: chosen || null,
        amount: direction === "bill" ? -Math.abs(amount) : Math.abs(amount),
        estimated: form.get("estimated") === "on",
        frequency: String(form.get("frequency")) as Frequency,
        start,
        end: end || null,
        autopay: form.get("autopay") === "on",
        note: String(form.get("note") ?? "").trim().slice(0, 500),
      },
      today,
    );
    toast(item ? "Saved." : `${name} added.`);
    onDone();
  };

  const remove = async () => {
    if (!item) return;
    const gone = await deleteRecurring(item, today);
    onDone();
    toast(`${item.name} deleted.`, { action: { label: "Undo", onClick: () => void restoreRecurring(gone) } });
  };

  if (!accounts || !categories) return null;
  if (usable.length === 0) return <p className="text-sm text-muted">Add an account first, so there&apos;s somewhere for it to go.</p>;

  return (
    <form action={save} className="flex flex-col gap-4">
      <SegmentedControl<Direction>
        aria-label="Bill or pay"
        value={direction}
        onValueChange={setDirection}
        options={[
          { value: "bill", label: "Bill" },
          { value: "pay", label: "Pay" },
        ]}
      />
      <Input name="name" label="Name" autoComplete="off" placeholder={direction === "bill" ? "Rent, electricity…" : "Payroll, a client…"} defaultValue={item?.name} required autoFocus={!item} />
      <Input name="amount" label="Amount" inputMode="decimal" autoComplete="off" defaultValue={item ? (Math.abs(item.amount) / 100).toFixed(2) : ""} required />
      <Checkbox name="estimated" label="The amount changes each time" hint="What's shown is a guess until you mark it paid." defaultChecked={item?.estimated} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Select name="accountId" label="Account" defaultValue={item?.accountId ?? usable.find((account) => account.id === lastAccount())?.id ?? usable.find((account) => account.type === "bank")?.id ?? usable[0]?.id}>
          {usable.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name} ({account.currency})
            </option>
          ))}
        </Select>
        <Select name="categoryId" label="Category" value={chosen} onChange={(event) => setCategoryId(event.target.value)}>
          <option value="">No category</option>
          {groups.map((group) => (
            <optgroup key={group} label={GROUP_NAMES[group as keyof typeof GROUP_NAMES]}>
              {offered
                .filter((category) => category.group === group)
                .map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </Select>
      </div>
      <Select name="frequency" label="How often" defaultValue={item?.frequency ?? "monthly"}>
        {FREQUENCIES.map((frequency) => (
          <option key={frequency} value={frequency}>
            {FREQUENCY_NAMES[frequency]}
          </option>
        ))}
      </Select>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input name="start" type="date" label="First date" defaultValue={item?.start ?? today} required />
        <Input name="end" type="date" label="Last date" hint="Leave empty if it doesn't end." defaultValue={item?.end ?? ""} />
      </div>
      <Checkbox name="autopay" label="Paid automatically (direct debit)" defaultChecked={item?.autopay} />
      <Textarea name="note" label="Note" rows={2} defaultValue={item?.note} />
      {error && (
        <p role="alert" className="text-label text-error">
          {error}
        </p>
      )}
      <div className="flex items-center justify-between gap-3">
        {item ? (
          <Button variant="danger-text" onClick={() => setConfirming(true)}>
            Delete
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" size="lg">
          {item ? "Save" : "Add"}
        </Button>
      </div>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Delete ${item?.name ?? "it"}?`}
        description="Paid ones stay; the ones still to come go."
        confirmLabel="Delete"
        onConfirm={() => void remove()}
      />
    </form>
  );
}

export function RecurringDialog({
  open,
  onOpenChange,
  item,
  trigger,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: Recurring;
  trigger?: React.ReactNode;
}) {
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={item ? item.name : "Add a bill or pay"}
      description={item ? undefined : "Something that comes back: rent, a subscription, your pay."}
      trigger={trigger}
    >
      {open && <RecurringForm item={item} onDone={() => onOpenChange(false)} />}
    </FormDialog>
  );
}
