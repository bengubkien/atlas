import "server-only";

import { SEEDED } from "@atlas/sync/device";
import { applyChanges, currentRecords } from "@atlas/sync/server";

import { dayOf } from "../dates";
import { holdingsFromPortfolio, IOL_ACCOUNTS, totalsFromStatement, valuationsFrom } from "../iol";
import { SCHEMAS, type Account, type Currency } from "../model";

// Reads your IOL account every few hours while the server runs, with the
// login in TYCHE_IOL_USERNAME and TYCHE_IOL_PASSWORD (deploy/.env), and saves
// each currency's value for the day and the holdings, which reach the phones
// like any other change. IOL's API has to be switched on for your account
// first (SETUP.md says how). Only reads: Tyche never places an order.
//
// IOL's tokens last 15 minutes; one is kept in memory and refreshed, and a
// new login is made when refreshing fails.

const EVERY_MS = 3 * 60 * 60 * 1000;
const FIRST_AFTER_MS = 20_000;

type Token = { access: string; refresh: string | null; expires: number };

export type IolStatus = { configured: boolean; lastReadAt: number | null; error: string | null };

const status: IolStatus = { configured: false, lastReadAt: null, error: null };
let token: Token | null = null;

const base = () => (process.env.TYCHE_IOL_URL || "https://api.invertironline.com").replace(/\/$/, "");
const login = () => ({ username: process.env.TYCHE_IOL_USERNAME ?? "", password: process.env.TYCHE_IOL_PASSWORD ?? "" });

export const iolStatus = (): IolStatus => ({ ...status, configured: Boolean(login().username && login().password) });

async function requestToken(fields: Record<string, string>, fetcher: typeof fetch): Promise<Token> {
  const response = await fetcher(`${base()}/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams(fields).toString(),
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (response.status === 400 || response.status === 401) throw new Error("IOL refused the login: check TYCHE_IOL_USERNAME and TYCHE_IOL_PASSWORD, and that IOL has switched on API access for you.");
  if (!response.ok) throw new Error(`IOL answered ${response.status} to the login.`);
  const body = (await response.json()) as { access_token?: string; refresh_token?: string; expires_in?: number };
  if (!body.access_token) throw new Error("IOL's login answer had no token.");
  // A minute's margin, so a token isn't used just as it runs out.
  return { access: body.access_token, refresh: body.refresh_token ?? null, expires: Date.now() + Math.max(0, (body.expires_in ?? 900) - 60) * 1000 };
}

async function accessToken(fetcher: typeof fetch): Promise<string> {
  if (token && token.expires > Date.now()) return token.access;
  if (token?.refresh) {
    try {
      token = await requestToken({ grant_type: "refresh_token", refresh_token: token.refresh }, fetcher);
      return token.access;
    } catch {
      token = null;
    }
  }
  token = await requestToken({ grant_type: "password", ...login() }, fetcher);
  return token.access;
}

async function get(path: string, fetcher: typeof fetch): Promise<unknown> {
  const response = await fetcher(`${base()}${path}`, {
    headers: { authorization: `Bearer ${await accessToken(fetcher)}`, accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (response.status === 401) token = null;
  if (!response.ok) throw new Error(`IOL answered ${response.status} for ${path}.`);
  return response.json();
}

/** Reads IOL once and saves what it says; returns how many records were new or newer. */
export async function readIol(fetcher: typeof fetch = fetch, now = Date.now()): Promise<number> {
  const totals = totalsFromStatement(await get("/api/v2/estadocuenta", fetcher));
  const holdings = holdingsFromPortfolio(await get("/api/v2/portafolio/argentina", fetcher), dayOf(now), now);
  const currencies = new Set<Currency>([...(Object.keys(totals) as Currency[]), ...holdings.map((holding) => (holding.accountId === IOL_ACCOUNTS.USD.id ? "USD" : "ARS"))]);
  if (currencies.size === 0) throw new Error("IOL's account statement had no pesos or dollars in it.");

  // The IOL accounts, made once (seeded: a rename or a delete of yours wins).
  const accounts = [...currencies].map((currency): Account => ({
    id: IOL_ACCOUNTS[currency].id,
    updatedAt: SEEDED,
    deleted: false,
    name: IOL_ACCOUNTS[currency].name,
    type: "investment",
    currency,
    openingBalance: 0,
    openingDate: dayOf(now),
    archived: false,
    note: "Read from IOL every few hours.",
  }));

  // Holdings sold since the last read go.
  const kept = new Set(holdings.map((holding) => holding.id));
  const gone = (await currentRecords(SCHEMAS, ["holding"]))
    .filter((change) => change.kind === "holding" && !kept.has(change.record.id))
    .map((change) => ({ kind: "holding" as const, record: { ...change.record, deleted: true, updatedAt: now } }));

  return applyChanges([
    ...accounts.map((record) => ({ kind: "account" as const, record })),
    ...valuationsFrom(totals, now).map((record) => ({ kind: "valuation" as const, record })),
    ...holdings.map((record) => ({ kind: "holding" as const, record })),
    ...gone,
  ]);
}

/** Reads now, and keeps the status the settings screen shows. */
export async function readIolNow(): Promise<IolStatus> {
  try {
    await readIol();
    status.lastReadAt = Date.now();
    status.error = null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Said once in the log, not every three hours, while it keeps failing.
    if (status.error !== message) console.error(`Tyche: couldn't read IOL: ${message}`);
    status.error = message;
  }
  return iolStatus();
}

let started = false;

/** Starts reading, once per process, when the login is set (instrumentation.ts). */
export function startIol() {
  if (started || !iolStatus().configured || !process.env.DATABASE_URL) return;
  started = true;
  setTimeout(() => void readIolNow(), FIRST_AFTER_MS).unref();
  setInterval(() => void readIolNow(), EVERY_MS).unref();
}
