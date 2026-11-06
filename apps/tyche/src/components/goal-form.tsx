"use client";

import { useState } from "react";

import { Button } from "@atlas/ui/components/button";
import { ConfirmDialog } from "@atlas/ui/components/confirm-dialog";
import { FormDialog } from "@atlas/ui/components/form-dialog";
import { Input } from "@atlas/ui/components/input";
import { Select } from "@atlas/ui/components/select";
import { Textarea } from "@atlas/ui/components/textarea";
import { toast } from "@atlas/ui/components/toast";
import { parseMoney } from "@atlas/ui/format";

import { addTransfer, deleteGoal, restoreGoal, saveGoal } from "@/lib/actions";
import { useAccounts, useToday } from "@/lib/local/hooks";
import { useLocale } from "@/lib/locale";
import { formatCents } from "@/lib/money";
import { GOAL_KINDS, type Account, type Goal, type GoalKind } from "@/lib/model";

export const GOAL_KIND_NAMES: Record<GoalKind, string> = {
  safety: "Safety",
  travel: "Travel",
  purchase: "Purchase",
  other: "Other",
};

const isDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

function GoalForm({ goal, onDone, onAddMoney }: { goal?: Goal; onDone: () => void; onAddMoney: () => void }) {
  const today = useToday();
  const accounts = useAccounts();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  // A goal lives in one account, so it's in that account's currency; archived accounts aren't offered for new goals.
  const choices = (accounts ?? []).filter((account) => !account.archived || account.id === goal?.accountId);
  const account = choices.find((candidate) => candidate.id === goal?.accountId);

  const save = async (form: FormData) => {
    const name = String(form.get("name") ?? "").trim().slice(0, 80);
    const target = parseMoney(String(form.get("target") ?? ""));
    const startAmount = parseMoney(String(form.get("startAmount") ?? ""));
    const startDate = String(form.get("startDate") ?? "");
    const targetDate = String(form.get("targetDate") ?? "");
    const accountId = String(form.get("accountId") ?? "");
    if (!name) return setError("Give it a name.");
    if (!accountId) return setError("Pick the account it's kept in.");
    if (typeof target !== "number" || target <= 0) return setError("Type how much you want to reach.");
    if (startAmount === "invalid") return setError("What you've saved isn't a number.");
    if (!isDay(startDate)) return setError("Pick the day you started.");
    if (targetDate && (!isDay(targetDate) || targetDate <= startDate)) return setError("The target date has to come after the start.");
    await saveGoal({
      ...(goal ? { id: goal.id } : {}),
      name,
      kind: String(form.get("kind")) as GoalKind,
      accountId,
      target,
      startAmount: Math.max(0, startAmount ?? 0),
      startDate,
      targetDate: targetDate || null,
      note: String(form.get("note") ?? "").trim().slice(0, 500),
    });
    toast(goal ? "Saved." : `${name} added.`);
    onDone();
  };

  const remove = async () => {
    if (!goal) return;
    const gone = await deleteGoal(goal);
    onDone();
    toast(`${goal.name} deleted. The money is still in ${account?.name ?? "its account"}.`, { action: { label: "Undo", onClick: () => void restoreGoal(gone) } });
  };

  return (
    <form action={save} className="flex flex-col gap-4">
      <Input name="name" label="Name" autoComplete="off" placeholder="Emergency fund, a trip…" defaultValue={goal?.name} required autoFocus={!goal} />
      <div className="grid grid-cols-2 gap-3">
        <Select name="kind" label="Kind" defaultValue={goal?.kind ?? "other"}>
          {GOAL_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {GOAL_KIND_NAMES[kind]}
            </option>
          ))}
        </Select>
        <Select
          name="accountId"
          label="Kept in"
          {...(goal ? { value: goal.accountId, onChange: () => {} } : { defaultValue: choices[0]?.id })}
          hint={goal ? undefined : "The goal is in this account's currency."}
          disabled={Boolean(goal)}
        >
          {choices.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.name} ({candidate.currency})
            </option>
          ))}
        </Select>
        {/* A disabled select isn't sent with the form: keep its value. */}
        {goal && <input type="hidden" name="accountId" value={goal.accountId} />}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input name="target" label="Target" inputMode="decimal" autoComplete="off" defaultValue={goal ? (goal.target / 100).toFixed(2) : ""} placeholder="10000" required />
        <Input name="startAmount" label="Already saved" inputMode="decimal" autoComplete="off" defaultValue={goal ? (goal.startAmount / 100).toFixed(2) : "0"} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input name="startDate" type="date" label="Started on" defaultValue={goal?.startDate ?? today} required />
        <Input name="targetDate" type="date" label="Target date" hint="Optional." defaultValue={goal?.targetDate ?? ""} />
      </div>
      <Textarea name="note" label="Note" rows={2} defaultValue={goal?.note} />
      {error && (
        <p role="alert" className="text-label text-error">
          {error}
        </p>
      )}
      <div className="flex items-center justify-between gap-3">
        {goal ? (
          <Button variant="danger-text" onClick={() => setConfirming(true)}>
            Delete
          </Button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          {goal && (
            <Button variant="secondary" size="lg" onClick={onAddMoney}>
              Add money
            </Button>
          )}
          <Button type="submit" size="lg">
            {goal ? "Save" : "Add goal"}
          </Button>
        </div>
      </div>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Delete ${goal?.name ?? "this goal"}?`}
        description={`Only the goal goes. The money stays in ${account?.name ?? "its account"}, and so do its transactions.`}
        confirmLabel="Delete goal"
        onConfirm={() => void remove()}
      />
    </form>
  );
}

/** Adding or changing a goal; an existing one can also take money (Add money). */
export function GoalDialog({
  open,
  onOpenChange,
  goal,
  trigger,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal?: Goal;
  trigger?: React.ReactNode;
}) {
  const [adding, setAdding] = useState(false);
  return (
    <>
      <FormDialog
        open={open}
        onOpenChange={onOpenChange}
        title={goal ? goal.name : "Add a goal"}
        description={goal ? undefined : "Something you're saving for. Money you move into it counts toward it."}
        trigger={trigger}
      >
        {open && <GoalForm goal={goal} onDone={() => onOpenChange(false)} onAddMoney={() => setAdding(true)} />}
      </FormDialog>
      {goal && <AddMoneyDialog open={adding} onOpenChange={setAdding} goal={goal} />}
    </>
  );
}

/** Moves money from another account into the goal's account, marked for the goal. */
export function AddMoneyDialog({ open, onOpenChange, goal }: { open: boolean; onOpenChange: (open: boolean) => void; goal: Goal }) {
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={`Add money to ${goal.name}`} description="Moves it from one of your accounts into the goal's account.">
      {open && <AddMoneyForm goal={goal} onDone={() => onOpenChange(false)} />}
    </FormDialog>
  );
}

function AddMoneyForm({ goal, onDone }: { goal: Goal; onDone: () => void }) {
  const today = useToday();
  const locale = useLocale();
  const accounts = useAccounts();
  const target = accounts?.find((account) => account.id === goal.accountId);
  const sources = (accounts ?? []).filter((account) => account.id !== goal.accountId && !account.archived);
  const [fromId, setFromId] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const from: Account | undefined = sources.find((account) => account.id === fromId) ?? sources[0];
  const differ = Boolean(from && target && from.currency !== target.currency);

  if (!target) return <p className="text-sm text-muted">The goal&apos;s account isn&apos;t here any more.</p>;
  if (sources.length === 0) return <p className="text-sm text-muted">Add another account first: the money has to come from somewhere.</p>;

  const save = async (form: FormData) => {
    if (!from) return;
    const sent = parseMoney(String(form.get("sent") ?? ""));
    const received = differ ? parseMoney(String(form.get("received") ?? "")) : sent;
    const date = String(form.get("date") ?? "");
    if (typeof sent !== "number" || sent <= 0) return setError("Type how much you're sending.");
    if (typeof received !== "number" || received <= 0) return setError("Type how much arrives.");
    if (!isDay(date)) return setError("Pick the day.");
    await addTransfer({ from, to: target, sent, received, date, goalId: goal.id });
    toast(`${formatCents(received, target.currency, locale)} added to ${goal.name}.`);
    onDone();
  };

  return (
    <form action={save} className="flex flex-col gap-4">
      <Select name="from" label="From" value={from?.id} onChange={(event) => setFromId(event.target.value)}>
        {sources.map((account) => (
          <option key={account.id} value={account.id}>
            {account.name} ({account.currency})
          </option>
        ))}
      </Select>
      <div className="grid grid-cols-2 gap-3">
        <Input name="sent" label={differ ? `Amount sent (${from?.currency})` : "Amount"} inputMode="decimal" autoComplete="off" required autoFocus />
        {differ && <Input name="received" label={`Amount received (${target.currency})`} inputMode="decimal" autoComplete="off" required />}
        <Input name="date" type="date" label="Date" defaultValue={today} required />
      </div>
      {error && (
        <p role="alert" className="text-label text-error">
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" size="lg">
          Add money
        </Button>
      </div>
    </form>
  );
}
