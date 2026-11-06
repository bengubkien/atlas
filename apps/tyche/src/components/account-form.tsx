"use client";

import { useState } from "react";

import { Button } from "@atlas/ui/components/button";
import { Checkbox } from "@atlas/ui/components/checkbox";
import { FormDialog } from "@atlas/ui/components/form-dialog";
import { Input } from "@atlas/ui/components/input";
import { Select } from "@atlas/ui/components/select";
import { Textarea } from "@atlas/ui/components/textarea";
import { toast } from "@atlas/ui/components/toast";
import { parseMoney } from "@atlas/ui/format";

import { deleteAccount, restoreAccount, saveAccount } from "@/lib/actions";
import { useToday } from "@/lib/local/hooks";
import { ACCOUNT_TYPES, CURRENCIES, type Account, type AccountType, type Currency } from "@/lib/model";

export const ACCOUNT_TYPE_NAMES: Record<AccountType, string> = {
  bank: "Bank account",
  card: "Credit card",
  cash: "Cash",
  wallet: "Wallet (Mercado Pago…)",
  savings: "Savings",
  investment: "Investment",
};

/** Adding or changing an account. */
export function AccountForm({ account, defaultType = "bank", onDone }: { account?: Account; defaultType?: AccountType; onDone: (id?: string) => void }) {
  const today = useToday();
  const [error, setError] = useState<string | null>(null);

  const save = async (form: FormData) => {
    const name = String(form.get("name") ?? "").trim().slice(0, 80);
    const balance = parseMoney(String(form.get("balance") ?? ""));
    const openingDate = String(form.get("openingDate") ?? "");
    if (!name) return setError("Give it a name.");
    if (balance === "invalid") return setError("The balance isn't a number.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(openingDate)) return setError("Pick the day of that balance.");
    const id = await saveAccount({
      ...(account ? { id: account.id } : {}),
      name,
      type: String(form.get("type")) as AccountType,
      currency: String(form.get("currency")) as Currency,
      // A card's balance is what you owe: typed as a positive number, kept negative.
      openingBalance: (balance ?? 0) * (form.get("owed") === "on" ? -1 : 1),
      openingDate,
      archived: form.get("archived") === "on",
      note: String(form.get("note") ?? "").trim().slice(0, 500),
    });
    toast(account ? "Saved." : `${name} added.`);
    onDone(id);
  };

  const remove = async () => {
    if (!account) return;
    const gone = await deleteAccount(account);
    onDone();
    toast(`${account.name} deleted, with its ${gone.transactions.length} transactions.`, { action: { label: "Undo", onClick: () => void restoreAccount(gone) } });
  };

  const owed = account ? account.openingBalance < 0 : false;

  return (
    <form action={save} className="flex flex-col gap-4">
      <Input name="name" label="Name" autoComplete="off" placeholder="Galicia, Mercado Pago, Cash…" defaultValue={account?.name} required autoFocus />
      <div className="grid grid-cols-2 gap-3">
        <Select name="type" label="Kind" defaultValue={account?.type ?? defaultType}>
          {ACCOUNT_TYPES.map((type) => (
            <option key={type} value={type}>
              {ACCOUNT_TYPE_NAMES[type]}
            </option>
          ))}
        </Select>
        <Select name="currency" label="Currency" defaultValue={account?.currency ?? "ARS"} hint={account ? "Its transactions are in it." : undefined} disabled={Boolean(account)}>
          {CURRENCIES.map((currency) => (
            <option key={currency} value={currency}>
              {currency === "ARS" ? "Pesos (ARS)" : "Dollars (USD)"}
            </option>
          ))}
        </Select>
        {/* A disabled select isn't sent with the form: keep its value. */}
        {account && <input type="hidden" name="currency" value={account.currency} />}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input name="balance" label="Balance" inputMode="decimal" autoComplete="off" defaultValue={account ? (Math.abs(account.openingBalance) / 100).toFixed(2) : "0"} />
        <Input name="openingDate" type="date" label="On" defaultValue={account?.openingDate ?? today} required />
      </div>
      <Checkbox name="owed" label="That's what I owe (a card's balance)" defaultChecked={owed} />
      {account && <Checkbox name="archived" label="Archived: keep its history, leave it out of the pickers" defaultChecked={account.archived} />}
      <Textarea name="note" label="Note" rows={2} defaultValue={account?.note} />
      {error && (
        <p role="alert" className="text-label text-error">
          {error}
        </p>
      )}
      <div className="flex items-center justify-between gap-3">
        {account ? (
          <Button variant="danger-text" onClick={() => void remove()}>
            Delete
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" size="lg">
          {account ? "Save" : "Add account"}
        </Button>
      </div>
    </form>
  );
}

export function AccountDialog({
  open,
  onOpenChange,
  account,
  defaultType,
  trigger,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: Account;
  defaultType?: AccountType;
  trigger?: React.ReactNode;
}) {
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={account ? account.name : "Add an account"}
      description={account ? undefined : "Where money is: a bank account, a card, cash, a wallet. One currency each."}
      trigger={trigger}
    >
      {open && <AccountForm account={account} defaultType={defaultType} onDone={() => onOpenChange(false)} />}
    </FormDialog>
  );
}
