import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import type { Account } from "../model";

// IOL's reading against a stand-in IOL and a real, throwaway database: the
// login and its refresh, the accounts made once, values and holdings saved,
// holdings sold since dropped, and a rename of yours kept.

const databaseUrl = inject("databaseUrl");

describe.skipIf(!databaseUrl)("reading IOL into the server", () => {
  let iol: typeof import("./iol");
  let sync: typeof import("@atlas/sync/server");
  const calls: string[] = [];
  let holdings = ["GGAL", "AL30D"];

  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const fakeIol: typeof fetch = async (input, init) => {
    const url = String(input);
    const body = String(init?.body ?? "");
    calls.push(url.endsWith("/token") ? `token:${new URLSearchParams(body).get("grant_type")}` : url.replace("https://iol.test", ""));
    if (url.endsWith("/token")) {
      const form = new URLSearchParams(body);
      if (form.get("grant_type") === "password" && form.get("password") !== "secret") return json({ error: "invalid_grant" }, 400);
      // Already run out, so the next call refreshes.
      return json({ access_token: "a", refresh_token: "r", expires_in: 0 });
    }
    if (url.endsWith("/api/v2/estadocuenta")) {
      return json({ cuentas: [{ moneda: "peso_Argentino", total: 1500.25 }, { moneda: "dolar_Estadounidense", total: 300 }] });
    }
    return json({
      activos: holdings.map((simbolo) => ({ cantidad: 1, ultimoPrecio: 10, valorizado: 10, titulo: { simbolo, moneda: simbolo.endsWith("D") ? "dolar_Estadounidense" : "peso_Argentino" } })),
    });
  };

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl!;
    process.env.TYCHE_IOL_URL = "https://iol.test";
    process.env.TYCHE_IOL_USERNAME = "me";
    process.env.TYCHE_IOL_PASSWORD = "secret";
    iol = await import("./iol");
    sync = await import("@atlas/sync/server");
  });
  afterAll(async () => {
    await sync.closeForTests();
  });

  const records = async (kind: "account" | "valuation" | "holding") =>
    (await sync.currentRecords((await import("../model")).SCHEMAS, [kind])).map((change) => change.record as { id: string; name?: string; value?: number });

  it("logs in, saves today's values and holdings, and makes the two accounts", async () => {
    await iol.readIol(fakeIol, new Date(2026, 10, 6, 12).getTime());
    expect(calls).toEqual(["token:password", "/api/v2/estadocuenta", "token:refresh_token", "/api/v2/portafolio/argentina"]);
    expect((await records("account")).map((a) => a.id).sort()).toEqual(["iol-ars", "iol-usd"]);
    expect((await records("valuation")).map((v) => [v.id, v.value]).sort()).toEqual([
      ["v-iol-ars-2026-11-06-iol", 150025],
      ["v-iol-usd-2026-11-06-iol", 30000],
    ]);
    expect((await records("holding")).map((h) => h.id).sort()).toEqual(["h-iol-ars-GGAL", "h-iol-usd-AL30D"]);
  });

  it("keeps a rename of yours, updates the day's value, and drops what was sold", async () => {
    const renamed: Account = { id: "iol-ars", updatedAt: 99, deleted: false, name: "Mi IOL", type: "investment", currency: "ARS", openingBalance: 0, openingDate: "2026-11-06", archived: false, note: "" };
    await sync.applyChanges([{ kind: "account", record: renamed }]);
    holdings = ["GGAL"];
    await iol.readIol(fakeIol, new Date(2026, 10, 6, 15).getTime());
    expect((await records("account")).find((a) => a.id === "iol-ars")?.name).toBe("Mi IOL");
    expect((await records("holding")).map((h) => h.id)).toEqual(["h-iol-ars-GGAL"]);
    expect(await records("valuation")).toHaveLength(2);
  });

  it("says plainly when IOL refuses the login", async () => {
    process.env.TYCHE_IOL_PASSWORD = "wrong";
    // A fresh module, so no token is kept from before.
    const { vi } = await import("vitest");
    vi.resetModules();
    const fresh = await import("./iol");
    await expect(fresh.readIol(fakeIol)).rejects.toThrow(/refused the login/);
    process.env.TYCHE_IOL_PASSWORD = "secret";
  });
});
