"use client";

import { useSyncInfo, type SyncInfo } from "@atlas/sync/react";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";

import { useNow } from "@atlas/ui/use-now";

import { dayOf } from "../dates";
import { converter, rateBook, type Converter, type RateBook } from "../money";
import { DEFAULT_SETTINGS, type Account, type Category, type Goal, type Holding, type Rate, type Recurring, type Settings, type Transaction, type Valuation } from "../model";
import { thisDevice } from "./device";

// Screens read this device's copy through these hooks; they update by
// themselves when anything changes, here or from a sync. `undefined` means
// still loading (a few milliseconds on first paint).

const alive = <T extends { deleted: boolean }>(records: T[]) => records.filter((record) => !record.deleted);

export function useSettings(): Settings {
  // Defaults first: a record saved before a setting existed doesn't have it.
  const saved = useLiveQuery(() => thisDevice().table("settings").get("settings"), []);
  return { ...DEFAULT_SETTINGS, ...saved };
}

/** Accounts, archived ones last, then by name. */
export function useAccounts(): Account[] | undefined {
  return useLiveQuery(
    async () => alive(await thisDevice().table("account").toArray()).sort((a, b) => Number(a.archived) - Number(b.archived) || a.name.localeCompare(b.name)),
    [],
  );
}

/** Categories, by name. */
export function useCategories(): Category[] | undefined {
  return useLiveQuery(async () => alive(await thisDevice().table("category").toArray()).sort((a, b) => a.name.localeCompare(b.name)), []);
}

/** Every transaction, newest first. */
export function useTransactions(): Transaction[] | undefined {
  return useLiveQuery(async () => alive(await thisDevice().table("transaction").toArray()).sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt - a.updatedAt), []);
}

/** Recurring items, by name. */
export function useRecurring(): Recurring[] | undefined {
  return useLiveQuery(async () => alive(await thisDevice().table("recurring").toArray()).sort((a, b) => a.name.localeCompare(b.name)), []);
}

/** Savings goals, by target date (none last). */
export function useGoals(): Goal[] | undefined {
  return useLiveQuery(
    async () => alive(await thisDevice().table("goal").toArray()).sort((a, b) => (a.targetDate ?? "9999").localeCompare(b.targetDate ?? "9999") || a.name.localeCompare(b.name)),
    [],
  );
}

/** Investment values, oldest first. */
export function useValuations(): Valuation[] | undefined {
  return useLiveQuery(async () => alive(await thisDevice().table("valuation").toArray()).sort((a, b) => a.date.localeCompare(b.date)), []);
}

/** An account's holdings (from IOL), biggest first. */
export function useHoldings(accountId: string): Holding[] | undefined {
  return useLiveQuery(
    async () => alive(await thisDevice().table("holding").where("accountId").equals(accountId).toArray()).sort((a, b) => b.value - a.value),
    [accountId],
  );
}

export function useRates(): Rate[] | undefined {
  return useLiveQuery(async () => alive(await thisDevice().table("rate").toArray()), []);
}

/** Today's date on this device; it changes at midnight while the screen is open. */
export function useToday(): string {
  return dayOf(useNow(60_000));
}

export type Money = {
  settings: Settings;
  /** The chosen kind of rate (MEP by default), by day. */
  rates: RateBook;
  /** Converts an amount on its day into the display currency. */
  convert: Converter;
};

/** What every screen with totals needs: the settings, the rates, and a converter to the display currency. */
export function useMoney(): Money | undefined {
  const settings = useSettings();
  const rates = useRates();
  return useMemo(() => {
    if (!rates) return undefined;
    const book = rateBook(rates, settings.rateKind);
    return { settings, rates: book, convert: converter(book, settings.displayCurrency) };
  }, [rates, settings]);
}

export type { SyncInfo };

/** This device's sync state, live. */
export function useSync(): SyncInfo | undefined {
  return useSyncInfo(thisDevice);
}
