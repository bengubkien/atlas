import "server-only";

import { applyChanges } from "@atlas/sync/server";

import { ratesFromQuotes } from "../rates";

// Fetches the day's dollar quotes every few hours while the server runs, and
// saves them as `rate` records, which reach the phones like any other change
// (so they convert offline). DolarApi asks for no more than one request
// every three hours per series; one request here gets all of them.
// TYCHE_RATES_URL set to nothing turns this off: rates are then typed in.

const EVERY_MS = 3 * 60 * 60 * 1000;
const FIRST_AFTER_MS = 15_000;

/** Fetches and saves the quotes once; returns how many rates were new or newer. */
export async function refreshRates(url: string, fetcher: typeof fetch = fetch): Promise<number> {
  const response = await fetcher(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(20_000), cache: "no-store" });
  if (!response.ok) throw new Error(`The rates service answered ${response.status}.`);
  const rates = ratesFromQuotes(await response.json());
  if (rates.length === 0) throw new Error("The rates service's answer had no MEP, blue or official quote.");
  return applyChanges(rates.map((record) => ({ kind: "rate", record })));
}

let started = false;

/** Starts fetching, once per process (instrumentation.ts). */
export function startRates() {
  const url = process.env.TYCHE_RATES_URL ?? "https://dolarapi.com/v1/dolares";
  if (started || !url || !process.env.DATABASE_URL) return;
  started = true;
  let failing = false;
  const run = async () => {
    try {
      await refreshRates(url);
      if (failing) console.log("Tyche: exchange rates are being fetched again.");
      failing = false;
    } catch (error) {
      // Said once, not every three hours, while it keeps failing.
      if (!failing) console.error(`Tyche: couldn't fetch exchange rates from ${url}: ${error instanceof Error ? error.message : String(error)}`);
      failing = true;
    }
  };
  setTimeout(() => void run(), FIRST_AFTER_MS).unref();
  setInterval(() => void run(), EVERY_MS).unref();
}
