import { describe, expect, it } from "vitest";

import { addDays, addMonths, dayInMonth, daysBetween, datesBetween, isDate, lastOfMonth } from "./dates";
import { change, convert, converter, formatCents, formatShare, rateBook, rateOn, sum } from "./money";
import type { Rate } from "./model";
import { ratesFromQuotes } from "./rates";

const rate = (date: string, pesos: number, source: Rate["source"] = "fetched", kind: Rate["kind"] = "mep"): Rate => ({
  id: `${date}-${kind}-${source}`,
  updatedAt: 1,
  deleted: false,
  date,
  kind,
  pesos,
  source,
});

describe("dates", () => {
  it("counts days and months across month ends, years and leap years", () => {
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(daysBetween("2026-03-01", "2026-03-31")).toBe(30);
    expect(daysBetween("2026-11-06", "2026-11-01")).toBe(-5);
    expect(addMonths("2026-11", 2)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(lastOfMonth("2026-02")).toBe("2026-02-28");
    expect(lastOfMonth("2028-02")).toBe("2028-02-29");
    expect(dayInMonth("2026-04", 31)).toBe("2026-04-30");
    expect(datesBetween("2026-12-30", "2027-01-02")).toEqual(["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"]);
    expect(isDate("2026-02-29")).toBe(false);
    expect(isDate("2028-02-29")).toBe(true);
  });
});

describe("rates", () => {
  const book = rateBook([rate("2026-11-03", 120000), rate("2026-11-05", 125000), rate("2026-11-05", 124000, "typed"), rate("2026-11-05", 99900, "fetched", "blue")], "mep");

  it("prefers a typed rate over the fetched one for the same day, and keeps kinds apart", () => {
    expect(book.days.map((day) => [day.date, day.pesos, day.source])).toEqual([
      ["2026-11-03", 120000, "fetched"],
      ["2026-11-05", 124000, "typed"],
    ]);
  });

  it("uses a day's rate, else the latest before it, else the earliest", () => {
    expect(rateOn(book, "2026-11-05")?.pesos).toBe(124000);
    expect(rateOn(book, "2026-11-04")).toMatchObject({ pesos: 120000, date: "2026-11-03" });
    expect(rateOn(book, "2026-12-25")?.date).toBe("2026-11-05");
    expect(rateOn(book, "2026-01-01")?.date).toBe("2026-11-03");
    expect(rateOn(rateBook([], "mep"), "2026-11-05")).toBeNull();
  });

  it("converts pesos and dollars in cents, rounding half away from zero", () => {
    const day = { pesos: 125000, date: "2026-11-05", source: "fetched" as const };
    // US$10 at 1,250 pesos a dollar is 12,500 pesos.
    expect(convert(1000, "USD", "ARS", day)).toBe(1250000);
    expect(convert(1250000, "ARS", "USD", day)).toBe(1000);
    // 1 peso is 0.08 cents: rounds to 0; 625 pesos are 50 cents exactly.
    expect(convert(62500, "ARS", "USD", day)).toBe(50);
    expect(convert(-62500, "ARS", "USD", day)).toBe(-50);
    expect(convert(500, "USD", "USD", null)).toBe(500);
    expect(convert(500, "USD", "ARS", null)).toBeNull();
  });

  it("converts each amount at its own day's rate, and counts what it couldn't", () => {
    const toUsd = converter(book, "USD");
    expect(toUsd(1200000, "ARS", "2026-11-03")).toBe(1000);
    expect(toUsd(1240000, "ARS", "2026-11-05")).toBe(1000);
    const none = converter(rateBook([], "mep"), "USD");
    expect(sum([toUsd(1200000, "ARS", "2026-11-03"), none(100, "ARS", "2026-11-03"), 250])).toEqual({ total: 1250, missing: 1 });
  });

  it("reads DolarApi's quotes: selling price, MEP from bolsa, dated by their update", () => {
    const now = Date.parse("2026-11-06T15:00:00Z");
    const rates = ratesFromQuotes(
      [
        { moneda: "USD", casa: "oficial", nombre: "Oficial", compra: 1405, venta: 1455.5, fechaActualizacion: "2026-11-06T14:00:00.000Z" },
        { moneda: "USD", casa: "blue", nombre: "Blue", compra: "1410", venta: "1430", fechaActualizacion: "2026-11-05T20:00:00.000Z" },
        { moneda: "USD", casa: "bolsa", nombre: "Bolsa", compra: 1440, venta: 1449.9, fechaActualizacion: "not a date" },
        { moneda: "USD", casa: "cripto", nombre: "Cripto", compra: 1450, venta: 1470 },
        { casa: "bolsa", venta: 0 },
        "nonsense",
      ],
      now,
    );
    expect(rates.map((r) => [r.kind, r.pesos, r.source])).toEqual([
      ["official", 145550, "fetched"],
      ["blue", 143000, "fetched"],
      ["mep", 144990, "fetched"],
    ]);
    expect(rates[0]!.id).toBe(`r-${rates[0]!.date}-official-fetched`);
    expect(ratesFromQuotes({ casa: "bolsa", venta: 1449 }, now)).toHaveLength(1);
    expect(ratesFromQuotes(null, now)).toEqual([]);
  });
});

describe("formatting", () => {
  it("writes amounts and shares", () => {
    expect(formatCents(125000, "USD", "en-US")).toBe("$1,250.00");
    expect(formatCents(645000, "USD", "en-US", { sign: true })).toBe("+$6,450.00");
    expect(formatCents(-9430, "USD", "en-US")).toBe("-$94.30");
    expect(formatCents(125050, "ARS", "en-US", { whole: true })).toMatch(/ARS\s?1,251/);
    expect(formatShare(0.61, "en-US")).toBe("61%");
    expect(formatShare(0.031, "en-US", { sign: true, digits: 1 })).toBe("+3.1%");
    expect(change(100, 103.1)).toBeCloseTo(0.031);
    expect(change(0, 5)).toBeNull();
  });
});
