import { dayOf } from "./dates";
import { rateId, type Rate, type RateKind } from "./model";

// The day's dollar quotes, from DolarApi (https://dolarapi.com, GET
// /v1/dolares): a list of quotes, one per market ("casa"), each with a
// buying and a selling price in pesos and when it was last updated. MEP is
// the "bolsa" quote. The selling price is what a dollar costs you.
//
// Read loosely: a quote that doesn't look right is skipped rather than
// failing the rest. (The service's exact field names were taken from its
// docs' examples, not checked against it live from here.)

const KINDS: Record<string, RateKind> = { bolsa: "mep", blue: "blue", oficial: "official" };

const numberFrom = (value: unknown): number | null => {
  const number = typeof value === "string" ? Number(value.replace(",", ".")) : value;
  return typeof number === "number" && Number.isFinite(number) && number > 0 ? number : null;
};

/** Rate records from DolarApi's answer, dated by the day each quote was updated (on this server's clock). */
export function ratesFromQuotes(body: unknown, now = Date.now()): Rate[] {
  const quotes = Array.isArray(body) ? body : body && typeof body === "object" ? [body] : [];
  const rates: Rate[] = [];
  for (const quote of quotes) {
    if (!quote || typeof quote !== "object") continue;
    const { casa, venta, fechaActualizacion } = quote as Record<string, unknown>;
    const kind = typeof casa === "string" ? KINDS[casa.toLowerCase()] : undefined;
    const price = numberFrom(venta);
    if (!kind || price === null) continue;
    const updated = typeof fechaActualizacion === "string" ? Date.parse(fechaActualizacion) : NaN;
    const date = dayOf(Number.isFinite(updated) && updated <= now ? updated : now);
    rates.push({ id: rateId(date, kind, "fetched"), updatedAt: now, deleted: false, date, kind, pesos: Math.round(price * 100), source: "fetched" });
  }
  return rates;
}
