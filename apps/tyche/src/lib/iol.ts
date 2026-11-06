import { dayOf } from "./dates";
import { valuationId, type Currency, type Holding, type Valuation } from "./model";

// Reading an IOL (InvertirOnline) account: what it's worth in pesos and in
// dollars, and what's in it. Tyche keeps two investment accounts for IOL,
// one per currency, with fixed IDs, and saves a value for each day it reads
// (see lib/server/iol.ts for the fetching).
//
// IOL's answers, as its docs and other clients describe them (not checked
// against a real account from here):
//   GET /api/v2/estadocuenta → { cuentas: [{ moneda: "peso_Argentino" |
//     "dolar_Estadounidense", disponible, titulosValorizados, total, … }] }
//   GET /api/v2/portafolio/argentina → { activos: [{ cantidad, ultimoPrecio,
//     valorizado, gananciaPorcentaje, titulo: { simbolo, descripcion, tipo,
//     moneda } }] }
// Read loosely: anything that doesn't fit is skipped, not fatal.

export const IOL_ACCOUNTS: Record<Currency, { id: string; name: string }> = {
  ARS: { id: "iol-ars", name: "IOL pesos" },
  USD: { id: "iol-usd", name: "IOL dólares" },
};

const currencyOf = (moneda: unknown): Currency | null => {
  if (typeof moneda !== "string") return null;
  const name = moneda.toLowerCase();
  if (name.includes("peso")) return "ARS";
  if (name.includes("dolar") || name.includes("dólar") || name.includes("usd")) return "USD";
  return null;
};

const numberFrom = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);
const centsFrom = (value: unknown): number | null => {
  const number = numberFrom(value);
  return number === null ? null : Math.round(number * 100);
};
const record = (value: unknown): Record<string, unknown> | null => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null);

/**
 * Each currency's total from the account statement: cash plus securities at
 * their value. Several cuentas in one currency (e.g. different settlement
 * terms) are added up.
 */
export function totalsFromStatement(body: unknown): Partial<Record<Currency, number>> {
  const totals: Partial<Record<Currency, number>> = {};
  const accounts = record(body)?.cuentas;
  if (!Array.isArray(accounts)) return totals;
  for (const raw of accounts) {
    const account = record(raw);
    const currency = currencyOf(account?.moneda);
    if (!account || !currency) continue;
    const total = centsFrom(account.total) ?? (centsFrom(account.disponible) ?? 0) + (centsFrom(account.titulosValorizados) ?? 0);
    totals[currency] = (totals[currency] ?? 0) + total;
  }
  return totals;
}

/** The positions in the portfolio, each in the IOL account of its currency. */
export function holdingsFromPortfolio(body: unknown, date: string, now: number): Holding[] {
  const assets = record(body)?.activos;
  if (!Array.isArray(assets)) return [];
  const holdings: Holding[] = [];
  for (const raw of assets) {
    const asset = record(raw);
    const title = record(asset?.titulo);
    const symbol = typeof title?.simbolo === "string" ? title.simbolo.trim() : "";
    const currency = currencyOf(title?.moneda);
    const quantity = numberFrom(asset?.cantidad);
    const value = centsFrom(asset?.valorizado);
    if (!asset || !title || !symbol || !currency || quantity === null || value === null) continue;
    const gain = numberFrom(asset.gananciaPorcentaje);
    const accountId = IOL_ACCOUNTS[currency].id;
    holdings.push({
      id: `h-${accountId}-${symbol}`,
      updatedAt: now,
      deleted: false,
      accountId,
      date,
      symbol: symbol.slice(0, 40),
      name: typeof title.descripcion === "string" ? title.descripcion.slice(0, 120) : "",
      type: typeof title.tipo === "string" ? title.tipo.slice(0, 40) : "",
      quantity,
      price: centsFrom(asset.ultimoPrecio) ?? 0,
      value,
      // IOL gives it in percent (12.5 for 12.5%).
      gain: gain === null ? null : gain / 100,
    });
  }
  return holdings;
}

/** Today's value records for the IOL accounts, from the statement's totals. */
export function valuationsFrom(totals: Partial<Record<Currency, number>>, now: number): Valuation[] {
  const date = dayOf(now);
  return (Object.entries(totals) as [Currency, number][]).map(([currency, value]) => {
    const accountId = IOL_ACCOUNTS[currency].id;
    return { id: valuationId(accountId, date, "iol"), updatedAt: now, deleted: false, accountId, date, value, source: "iol" };
  });
}
