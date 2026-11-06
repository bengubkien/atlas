"use client";

import Link from "next/link";
import { useState } from "react";

import { Button, buttonClassName } from "@atlas/ui/components/button";
import { ToggleChip } from "@atlas/ui/components/chip";
import { FormDialog } from "@atlas/ui/components/form-dialog";
import { Input } from "@atlas/ui/components/input";
import { SegmentedControl } from "@atlas/ui/components/segmented-control";
import { Select } from "@atlas/ui/components/select";
import { Textarea } from "@atlas/ui/components/textarea";
import { toast } from "@atlas/ui/components/toast";
import { parseMoney } from "@atlas/ui/format";

import { addTransaction, addTransfer, deleteTransaction, lastAccount, markDone, markExpected, restoreTransactions, saveTransaction } from "@/lib/actions";
import { CategoryIcon } from "@/lib/icons";
import { useAccounts, useCategories, useToday } from "@/lib/local/hooks";
import { useLocale } from "@/lib/locale";
import { formatCents } from "@/lib/money";
import type { Account, Transaction, TransactionStatus } from "@/lib/model";

// Adding or changing a transaction: an expense, income, or money moved
// between two of your accounts. The same form is in a dialog (Add on a wide
// screen, and every Edit) and on its own page (Add on a phone).

export type TransactionKind = "expense" | "income" | "transfer";

export type TransactionDefaults = {
  kind?: TransactionKind;
  accountId?: string;
  categoryId?: string | null;
  date?: string;
  status?: TransactionStatus;
  payee?: string;
};

const KINDS = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
  { value: "transfer", label: "Transfer" },
] as const;

const STATUSES = [
  { value: "cleared", label: "Cleared" },
  { value: "pending", label: "Pending" },
  { value: "expected", label: "Expected" },
] as const;

const kindOf = (transaction: Transaction): TransactionKind => (transaction.transferId ? "transfer" : transaction.amount > 0 ? "income" : "expense");

/** Cents from a typed amount, always positive; null when it isn't one. */
function amountFrom(text: string): number | null {
  const cents = parseMoney(text);
  return typeof cents === "number" && cents !== 0 ? Math.abs(cents) : null;
}

/** The form itself. `onDone` is called after saving or deleting. */
export function TransactionForm({
  transaction,
  defaults = {},
  onDone,
  autoFocus = true,
}: {
  /** The one to change; without it, the form adds a new one. */
  transaction?: Transaction;
  defaults?: TransactionDefaults;
  onDone: () => void;
  autoFocus?: boolean;
}) {
  const locale = useLocale();
  const today = useToday();
  const accounts = useAccounts()?.filter((account) => !account.archived || account.id === transaction?.accountId);
  const categories = useCategories();
  const editing = Boolean(transaction);

  const [kind, setKind] = useState<TransactionKind>(transaction ? kindOf(transaction) : (defaults.kind ?? "expense"));
  const [accountId, setAccountId] = useState<string>(transaction?.accountId ?? defaults.accountId ?? "");
  const [toAccountId, setToAccountId] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string | null>(transaction ? transaction.categoryId : (defaults.categoryId ?? null));
  const [status, setStatus] = useState<TransactionStatus>(transaction?.status ?? defaults.status ?? "cleared");
  const [error, setError] = useState<string | null>(null);

  if (!accounts || !categories) return <p className="text-sm text-muted">Opening…</p>;
  if (accounts.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-muted">Add an account first: where the money is, in pesos or dollars.</p>
        <Link href="/accounts/bank?add=1" className={buttonClassName("primary")} onClick={onDone}>
          Add an account
        </Link>
      </div>
    );
  }

  // The account: the one chosen, else the last one used here, else the first.
  const remembered = lastAccount();
  const account: Account = accounts.find((candidate) => candidate.id === accountId) ?? accounts.find((candidate) => candidate.id === remembered) ?? accounts[0]!;
  const others = accounts.filter((candidate) => candidate.id !== account.id);
  const toAccount = others.find((candidate) => candidate.id === toAccountId) ?? others[0];
  const shown = categories.filter((category) => (kind === "income" ? category.group === "income" : category.group !== "income"));
  const bothCurrencies = kind === "transfer" && toAccount && toAccount.currency !== account.currency;

  const save = async (form: FormData) => {
    const amount = amountFrom(String(form.get("amount") ?? ""));
    const date = String(form.get("date") ?? "");
    const payee = String(form.get("payee") ?? "").trim().slice(0, 120);
    const note = String(form.get("note") ?? "").trim().slice(0, 1000);
    if (amount === null) return setError("Enter the amount.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError("Pick the date.");

    if (transaction) {
      const signed = transaction.amount < 0 ? -amount : amount;
      await saveTransaction({ ...transaction, accountId: transaction.transferId ? transaction.accountId : account.id, amount: signed, date, payee: transaction.transferId ? transaction.payee : payee, note, categoryId: transaction.transferId ? null : categoryId, status: transaction.transferId ? transaction.status : status });
      toast("Saved.");
      return onDone();
    }

    if (kind === "transfer") {
      if (!toAccount) return setError("A transfer needs a second account.");
      const received = bothCurrencies ? amountFrom(String(form.get("received") ?? "")) : amount;
      if (received === null) return setError(`Enter what arrived in ${toAccount.name}.`);
      await addTransfer({ from: account, to: toAccount, sent: amount, received, date, note });
      toast(`Moved ${formatCents(amount, account.currency, locale)} to ${toAccount.name}.`);
      return onDone();
    }

    await addTransaction({ accountId: account.id, date, amount: kind === "expense" ? -amount : amount, categoryId, payee, note, status });
    toast(kind === "expense" ? "Expense added." : "Income added.");
    onDone();
  };

  const remove = async () => {
    if (!transaction) return;
    const gone = await deleteTransaction(transaction);
    onDone();
    toast(gone.length > 1 ? "Transfer deleted." : "Deleted.", { action: { label: "Undo", onClick: () => void restoreTransactions(gone) } });
  };

  const markPaid = async () => {
    if (!transaction) return;
    await markDone(transaction, { date: today });
    onDone();
    toast(transaction.amount < 0 ? "Marked paid." : "Marked received.", { action: { label: "Undo", onClick: () => void markExpected(transaction) } });
  };

  return (
    <form action={save} className="flex flex-col gap-4">
      {!editing && (
        <SegmentedControl
          aria-label="Kind"
          options={others.length > 0 ? KINDS : KINDS.filter((option) => option.value !== "transfer")}
          value={kind}
          onValueChange={(value) => {
            setKind(value);
            setCategoryId(null);
          }}
          className="w-full [&>*]:flex-1"
        />
      )}

      <div className={bothCurrencies ? "grid grid-cols-2 gap-3" : "flex flex-col"}>
        <Input
          name="amount"
          label={bothCurrencies ? `Sent (${account.currency})` : `Amount (${account.currency})`}
          inputMode="decimal"
          autoComplete="off"
          required
          autoFocus={autoFocus}
          defaultValue={transaction ? (Math.abs(transaction.amount) / 100).toFixed(2) : undefined}
          inputClassName="h-12 text-[22px] font-medium tabular-nums"
        />
        {bothCurrencies && <Input name="received" label={`Received (${toAccount.currency})`} inputMode="decimal" autoComplete="off" required inputClassName="h-12 text-[22px] font-medium tabular-nums" />}
      </div>

      {!(editing && transaction?.transferId) && (
        <div className={kind === "transfer" ? "grid grid-cols-2 gap-3" : "flex flex-col"}>
          <Select label={kind === "transfer" ? "From" : "Account"} value={account.id} onChange={(event) => setAccountId(event.target.value)}>
            {accounts.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name} ({candidate.currency})
              </option>
            ))}
          </Select>
          {kind === "transfer" && toAccount && (
            <Select label="To" value={toAccount.id} onChange={(event) => setToAccountId(event.target.value)}>
              {others.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name} ({candidate.currency})
                </option>
              ))}
            </Select>
          )}
        </div>
      )}

      {kind !== "transfer" && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-label font-medium">Category</legend>
          <div className="flex flex-wrap gap-2">
            {shown.map((category) => (
              <ToggleChip key={category.id} selected={categoryId === category.id} onClick={() => setCategoryId(categoryId === category.id ? null : category.id)} className="inline-flex items-center gap-1.5">
                <CategoryIcon name={category.icon} size={14} />
                {category.name}
              </ToggleChip>
            ))}
          </div>
        </fieldset>
      )}

      {kind !== "transfer" && (
        <Input name="payee" label={kind === "income" ? "From" : "Paid to"} autoComplete="off" placeholder={kind === "income" ? "Payroll, a client…" : "Whole Foods, the landlord…"} defaultValue={transaction?.payee ?? defaults.payee} />
      )}

      <div className="grid grid-cols-2 gap-3">
        <Input name="date" type="date" label="Date" defaultValue={transaction?.date ?? defaults.date ?? today} required />
        {kind !== "transfer" && (
          <Select label="Status" value={status} onChange={(event) => setStatus(event.target.value as TransactionStatus)}>
            {STATUSES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        )}
      </div>

      <Textarea name="note" label="Note" rows={2} defaultValue={transaction?.note} />

      {error && (
        <p role="alert" className="text-label text-error">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          {transaction && (
            <Button variant="danger-text" onClick={() => void remove()}>
              Delete
            </Button>
          )}
          {transaction?.status === "expected" && !transaction.transferId && (
            <Button variant="secondary" onClick={() => void markPaid()}>
              {transaction.amount < 0 ? "Mark paid today" : "Mark received today"}
            </Button>
          )}
        </div>
        <Button type="submit" size="lg">
          {editing ? "Save" : kind === "transfer" ? "Move money" : "Add"}
        </Button>
      </div>
    </form>
  );
}

/** The form in a dialog: Add (with `trigger`), or Edit (controlled by `open`). */
export function TransactionDialog({
  open,
  onOpenChange,
  transaction,
  defaults,
  trigger,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: Transaction;
  defaults?: TransactionDefaults;
  trigger?: React.ReactNode;
}) {
  const title = !transaction ? "Add transaction" : transaction.transferId ? "Transfer" : transaction.amount > 0 ? "Income" : "Expense";
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={title} description={transaction?.payee || undefined} trigger={trigger}>
      {/* Mounted only while open, so each opening starts from the record as it is now. */}
      {open && <TransactionForm transaction={transaction} defaults={defaults} onDone={() => onOpenChange(false)} />}
    </FormDialog>
  );
}
