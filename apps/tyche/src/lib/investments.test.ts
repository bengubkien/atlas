import { describe, expect, it } from "vitest";

import { holdingsFromPortfolio, totalsFromStatement, valuationsFrom } from "./iol";
import type { Account, Recurring, Transaction, Valuation } from "./model";
import { cuotaNumber, cuotasLeft, lastDue, occurrence, occurrencesBetween } from "./recurring";
import { balanceBook, totalBalance } from "./summary";
import { converter, rateBook } from "./money";

const purchase = (fields: Partial<Recurring> = {}): Recurring => ({
  id: "notebook",
  updatedAt: 5,
  deleted: false,
  name: "Notebook",
  accountId: "bbva-visa",
  categoryId: "c-shopping",
  amount: -10000000,
  estimated: false,
  frequency: "monthly",
  start: "2026-09-15",
  end: null,
  autopay: true,
  installments: 6,
  note: "",
  ...fields,
});

describe("cuotas", () => {
  it("fall monthly on the purchase's day and stop after the last", () => {
    expect(occurrencesBetween(purchase(), "2026-01-01", "2027-12-31")).toEqual(["2026-09-15", "2026-10-15", "2026-11-15", "2026-12-15", "2027-01-15", "2027-02-15"]);
    expect(lastDue(purchase())).toBe("2027-02-15");
    // Bought on the 31st: short months take their last day.
    expect(occurrencesBetween(purchase({ start: "2026-12-31", installments: 3 }), "2026-01-01", "2027-12-31")).toEqual(["2026-12-31", "2027-01-31", "2027-02-28"]);
  });

  it("say which cuota each charge is", () => {
    expect(cuotaNumber(purchase(), "2026-11-15")).toBe(3);
    expect(cuotaNumber(purchase(), "2027-03-15")).toBeNull();
    expect(occurrence(purchase(), "2026-11-15", "2026-11-06")).toMatchObject({ note: "Cuota 3 of 6", status: "expected", amount: -10000000 });
    expect(occurrence(purchase(), "2026-10-15", "2026-11-06").status).toBe("cleared");
  });

  it("count what's still to come", () => {
    expect(cuotasLeft(purchase(), "2026-11-06")).toEqual({ count: 4, amount: 40000000, last: "2027-02-15" });
    expect(cuotasLeft(purchase(), "2027-02-15")).toEqual({ count: 0, amount: 0, last: null });
    expect(cuotasLeft(purchase({ installments: null }), "2026-11-06").count).toBe(0);
  });
});

const investment: Account = { id: "iol-ars", updatedAt: 1, deleted: false, name: "IOL pesos", type: "investment", currency: "ARS", openingBalance: 100000, openingDate: "2026-01-01", archived: false, note: "" };
const moved = (date: string, amount: number): Transaction => ({
  id: `${date}-${amount}`,
  updatedAt: 1,
  deleted: false,
  accountId: investment.id,
  date,
  amount,
  categoryId: null,
  payee: "",
  note: "",
  status: "cleared",
  recurringId: null,
  dueDate: null,
  transferId: "x",
  goalId: null,
  importId: null,
});
const value = (date: string, cents: number, source: Valuation["source"]): Valuation => ({ id: `${date}-${source}`, updatedAt: 1, deleted: false, accountId: investment.id, date, value: cents, source });

describe("investment values", () => {
  const transactions = [moved("2026-03-01", 50000), moved("2026-04-05", 10000)];
  const values = [value("2026-04-01", 200000, "iol"), value("2026-04-01", 210000, "typed"), value("2026-05-01", 260000, "iol")];
  const book = balanceBook([investment], transactions, values);

  it("start from the latest value, plus what moved in after it; a typed value wins for its day", () => {
    expect(book.balance(investment, "2026-03-15")).toBe(150000);
    expect(book.balance(investment, "2026-04-01")).toBe(210000);
    expect(book.balance(investment, "2026-04-10")).toBe(220000);
    expect(book.balance(investment, "2026-05-02")).toBe(260000);
    expect(book.balance(investment, "2025-12-31")).toBeNull();
    expect(book.latestValue(investment.id)?.date).toBe("2026-05-01");
  });

  it("count in the total, converted on the day", () => {
    const toUsd = converter(rateBook([{ id: "r", updatedAt: 1, deleted: false, date: "2026-01-01", kind: "mep", pesos: 100000, source: "fetched" }], "mep"), "USD");
    expect(totalBalance([investment], transactions, toUsd, "2026-04-10", values)).toEqual({ total: 220, missing: 0 });
  });
});

describe("reading IOL", () => {
  it("adds up each currency's total, cash plus securities when there's no total", () => {
    const totals = totalsFromStatement({
      cuentas: [
        { numero: "1", tipo: "inversion_Argentina_Pesos", moneda: "peso_Argentino", disponible: 1000.5, titulosValorizados: 250000, total: 251000.5 },
        { numero: "2", tipo: "inversion_Argentina_Pesos", moneda: "peso_Argentino", disponible: 10, titulosValorizados: 90 },
        { numero: "3", tipo: "inversion_Estados_Unidos_Dolares", moneda: "dolar_Estadounidense", disponible: 12.34, titulosValorizados: 1500, total: 1512.34 },
        { moneda: "yen" },
        "nonsense",
      ],
    });
    expect(totals).toEqual({ ARS: 25100050 + 10000, USD: 151234 });
    expect(totalsFromStatement(null)).toEqual({});
  });

  it("puts each holding in the account of its currency, gains as a fraction", () => {
    const holdings = holdingsFromPortfolio(
      {
        pais: "argentina",
        activos: [
          { cantidad: 100, ultimoPrecio: 5432.1, valorizado: 543210, gananciaPorcentaje: 12.5, titulo: { simbolo: "GGAL", descripcion: "Grupo Financiero Galicia", tipo: "ACCIONES", moneda: "peso_Argentino" } },
          { cantidad: 3, ultimoPrecio: 101.5, valorizado: 304.5, titulo: { simbolo: "AL30D", descripcion: "Bono", tipo: "TitulosPublicos", moneda: "dolar_Estadounidense" } },
          { cantidad: 1, titulo: { simbolo: "BAD", moneda: "peso_Argentino" } },
        ],
      },
      "2026-11-06",
      7,
    );
    expect(holdings.map((h) => [h.id, h.accountId, h.quantity, h.price, h.value, h.gain])).toEqual([
      ["h-iol-ars-GGAL", "iol-ars", 100, 543210, 54321000, 0.125],
      ["h-iol-usd-AL30D", "iol-usd", 3, 10150, 30450, null],
    ]);
  });

  it("makes one value a day per IOL account", () => {
    const now = new Date(2026, 10, 6, 15).getTime();
    expect(valuationsFrom({ ARS: 100, USD: 5 }, now).map((v) => [v.id, v.value, v.source])).toEqual([
      ["v-iol-ars-2026-11-06-iol", 100, "iol"],
      ["v-iol-usd-2026-11-06-iol", 5, "iol"],
    ]);
  });
});
