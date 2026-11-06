// Fills a Tyche server with a made-up month, for trying the screens:
// node apps/tyche/scripts/demo.mjs http://localhost:3005
// It goes through the sync endpoint, like a phone would, so run the server
// with ATLAS_AUTH=off. Dates are around today; amounts are in cents.

const server = process.argv[2] ?? "http://localhost:3005";
const now = Date.now();
const day = (offset) => new Date(now + offset * 86_400_000).toLocaleDateString("en-CA");
const today = day(0);
const month = today.slice(0, 7);
const on = (dayOfMonth, monthOffset = 0) => {
  const [year, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, m - 1 + monthOffset, dayOfMonth));
  return date.toISOString().slice(0, 10);
};
const base = { updatedAt: now, deleted: false };
const changes = [];
const put = (kind, record) => changes.push({ kind, record: { ...base, ...record } });

// Pesos per dollar (MEP), a little higher each week.
for (let offset = -70; offset <= 0; offset++) {
  const date = day(offset);
  put("rate", { id: `r-${date}-mep-fetched`, date, kind: "mep", pesos: Math.round((1430 + offset * 0.6) * 100), source: "fetched" });
}

put("account", { id: "bbva", name: "BBVA", type: "bank", currency: "ARS", openingBalance: 185000000, openingDate: on(1, -2), archived: false, note: "" });
put("account", { id: "mp", name: "Mercado Pago", type: "wallet", currency: "ARS", openingBalance: 32000000, openingDate: on(1, -2), archived: false, note: "" });
put("account", { id: "dollars", name: "Dollars", type: "savings", currency: "USD", openingBalance: 1150000, openingDate: on(1, -2), archived: false, note: "" });
put("account", { id: "naranjax", name: "Naranja X", type: "wallet", currency: "ARS", openingBalance: 8500000, openingDate: on(1, -2), archived: false, note: "" });
put("account", { id: "frasco", name: "Frasco", type: "savings", currency: "ARS", openingBalance: 60000000, openingDate: on(1, -2), archived: false, note: "Naranja X: daily interest" });
put("account", { id: "bbva-visa", name: "BBVA Visa", type: "card", currency: "ARS", openingBalance: -41000000, openingDate: on(1, -2), archived: false, note: "" });
put("account", { id: "bna-mastercard", name: "BNA Mastercard", type: "card", currency: "ARS", openingBalance: 0, openingDate: on(1, -2), archived: false, note: "" });
put("account", { id: "iol-ars", name: "IOL pesos", type: "investment", currency: "ARS", openingBalance: 0, openingDate: on(1, -2), archived: false, note: "" });
put("account", { id: "iol-usd", name: "IOL dólares", type: "investment", currency: "USD", openingBalance: 0, openingDate: on(1, -2), archived: false, note: "" });

const recurring = [
  { id: "rent", name: "Rent", accountId: "bbva", categoryId: "c-housing", amount: -95000000, frequency: "monthly", start: on(1, -2), autopay: false },
  { id: "power", name: "Edenor", accountId: "bbva", categoryId: "c-utilities", amount: -4200000, estimated: true, frequency: "monthly", start: on(10, -2), autopay: false },
  { id: "fiber", name: "Personal Fibra", accountId: "bbva-visa", categoryId: "c-internet", amount: -2899000, frequency: "monthly", start: on(15, -2), autopay: true },
  { id: "spotify", name: "Spotify", accountId: "bbva-visa", categoryId: "c-subscriptions", amount: -479900, frequency: "monthly", start: on(20, -2), autopay: true },
  // Paid every two weeks, the last time four days ago.
  { id: "salary", name: "Payroll", accountId: "bbva", categoryId: "c-salary", amount: 260000000, frequency: "biweekly", start: day(-4 - 14 * 5), autopay: false },
];
// Purchases on the BBVA card in cuotas: the notebook began about two months
// ago, the sofa this month. Cuotas already due are paid (the card pays itself).
const cuotas = [
  { id: "notebook", name: "Notebook", accountId: "bbva-visa", categoryId: "c-shopping", amount: -10000000, installments: 6, start: on(Math.min(Number(today.slice(8, 10)), 28), -2) },
  { id: "sofa", name: "Sofa", accountId: "bbva-visa", categoryId: "c-shopping", amount: -4500000, installments: 12, start: on(5, 0) },
];
for (const item of cuotas) put("recurring", { estimated: false, end: null, note: "", frequency: "monthly", autopay: true, ...item });
for (const item of recurring) put("recurring", { estimated: false, end: null, note: "", ...item });

let n = 0;
const tx = (accountId, date, amount, fields = {}) =>
  put("transaction", { id: `demo-${n++}`, accountId, date, amount, categoryId: null, payee: "", note: "", status: "cleared", recurringId: null, dueDate: null, transferId: null, goalId: null, importId: null, ...fields });
const paid = (item, date, amount = item.amount, status = "cleared", note = "") =>
  put("transaction", { id: `o-${item.id}-${date}`, accountId: item.accountId, date, amount, categoryId: item.categoryId, payee: item.name, note, status, recurringId: item.id, dueDate: date, transferId: null, goalId: null, importId: null });

for (const item of cuotas) {
  for (let k = 0; k < item.installments; k++) {
    const [year, m, d] = item.start.split("-").map(Number);
    const date = new Date(Date.UTC(year, m - 1 + k, d)).toISOString().slice(0, 10);
    if (date > today) break;
    paid(item, date, item.amount, "cleared", `Cuota ${k + 1} of ${item.installments}`);
  }
}

// Last two months, paid.
for (const offset of [-2, -1]) {
  paid(recurring[0], on(1, offset));
  paid(recurring[1], on(10, offset), -3900000 - offset * 200000);
  tx("bbva", on(4, offset), -6500000, { categoryId: "c-groceries", payee: "Coto" });
  tx("mp", on(9, offset), -1850000, { categoryId: "c-eating-out", payee: "La Cabrera" });
  tx("mp", on(16, offset), -2400000, { categoryId: "c-groceries", payee: "Carrefour" });
  tx("bbva-visa", on(21, offset), -3100000, { categoryId: "c-shopping", payee: "Mercado Libre" });
  tx("dollars", on(25, offset), 75000, { categoryId: "c-freelance", payee: "Freelance payment" });
}
// Salary: every two weeks, paid until today.
for (let date = recurring[4].start; date <= today; ) {
  paid(recurring[4], date);
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 14);
  date = next.toISOString().slice(0, 10);
}
// This month so far: rent paid on the 1st; groceries, coffee, transport.
if (on(1) <= today) paid(recurring[0], on(1));
tx("bbva", day(-4), -9430000, { categoryId: "c-groceries", payee: "Coto", note: "Weekly groceries" });
tx("mp", day(-3), -520000, { categoryId: "c-transport", payee: "YPF", note: "Fuel", status: "pending" });
tx("mp", day(-2), -850000, { categoryId: "c-coffee", payee: "Cuervo Café" });
tx("bbva-visa", day(-1), -1250000, { categoryId: "c-eating-out", payee: "Don Julio" });
tx("mp", day(0), -310000, { categoryId: "c-coffee", payee: "Lattente" });
// The Frasco's interest, paid every day; a few days' worth as it shows in the statement.
for (const offset of [-30, -20, -10, -1]) tx("frasco", day(offset), 160000, { categoryId: "c-interest", payee: "Naranja X", note: "Frasco interest" });
// A design invoice, expected later this month.
tx("dollars", on(28), 120000, { categoryId: "c-freelance", payee: "Design invoice #12", status: "expected" });

// Budgets on a few categories (their records win over the ones devices make).
const budget = (id, name, group, icon, amount, currency) => put("category", { id, name, group, icon, budget: { amount, currency } });
budget("c-groceries", "Groceries", "daily", "shopping-basket", 25000000, "ARS");
budget("c-eating-out", "Eating out", "daily", "utensils", 1500000, "ARS");
budget("c-coffee", "Coffee", "daily", "coffee", 1000, "USD");
budget("c-transport", "Transport", "daily", "car", 6000000, "ARS");

// Goals, kept in the dollar account, with money put in by transfers.
put("goal", { id: "emergency", name: "Emergency fund", kind: "safety", accountId: "dollars", target: 1000000, startAmount: 600000, startDate: on(1, -10), targetDate: on(1, 7), note: "" });
put("goal", { id: "japan", name: "Vacation · Japan", kind: "travel", accountId: "dollars", target: 500000, startAmount: 160000, startDate: on(1, -6), targetDate: on(1, 13), note: "" });
put("goal", { id: "laptop", name: "New laptop", kind: "purchase", accountId: "iol-usd", target: 200000, startAmount: 182000, startDate: on(1, -4), targetDate: on(1, 2), note: "" });
const NAMES = { bbva: "BBVA", mp: "Mercado Pago", dollars: "Dollars", "bbva-visa": "BBVA Visa", "bna-mastercard": "BNA Mastercard", "iol-ars": "IOL pesos", "iol-usd": "IOL dólares" };
const move = (from, to, sent, received, date, goalId = null) => {
  const out = `demo-${n++}`;
  const into = `demo-${n++}`;
  const common = { date, categoryId: null, note: "", status: "cleared", recurringId: null, dueDate: null, importId: null };
  put("transaction", { ...common, id: out, accountId: from, amount: -sent, payee: NAMES[to], transferId: into, goalId: null });
  put("transaction", { ...common, id: into, accountId: to, amount: received, payee: NAMES[from], transferId: out, goalId });
};
move("bbva", "dollars", 71500000, 50000, on(3, -1), "emergency");
move("bbva", "dollars", 71800000, 50000, on(3), "japan");
move("bbva", "mp", 15000000, 15000000, day(-5));

// IOL values every week for 70 days, drifting up with some noise, as the server would read them; and today's positions.
const wobble = (i) => Math.sin(i * 1.7) * 0.012 + Math.cos(i * 0.9) * 0.008;
for (let i = 0, offset = -70; offset <= -7; i++, offset += 7) {
  const date = day(offset);
  const growth = 1 + (i / 10) * 0.05 + wobble(i);
  put("valuation", { id: `v-iol-ars-${date}-iol`, accountId: "iol-ars", date, value: Math.round(700000000 * growth), source: "iol" });
  put("valuation", { id: `v-iol-usd-${date}-iol`, accountId: "iol-usd", date, value: Math.round(220000 * (growth + wobble(i + 3))), source: "iol" });
}
// Today's value too, so the balance matches the holdings.
put("valuation", { id: `v-iol-ars-${today}-iol`, accountId: "iol-ars", date: today, value: 760000000, source: "iol" });
put("valuation", { id: `v-iol-usd-${today}-iol`, accountId: "iol-usd", date: today, value: 245000, source: "iol" });
const holding = (accountId, symbol, name, type, quantity, price, gain) =>
  put("holding", { id: `h-${accountId}-${symbol}`, accountId, date: today, symbol, name, type, quantity, price, value: Math.round(quantity * price), gain });
holding("iol-ars", "GGAL", "Grupo Financiero Galicia", "ACCIONES", 400, 615000, 0.125);
holding("iol-ars", "YPFD", "YPF S.A.", "ACCIONES", 60, 5200000, 0.082);
holding("iol-ars", "SPY", "SPDR S&P 500 ETF (CEDEAR)", "CEDEARS", 120, 890000, 0.214);
holding("iol-ars", "MELI", "MercadoLibre (CEDEAR)", "CEDEARS", 35, 1950000, -0.031);
holding("iol-usd", "AL30D", "Bonar 2030 (dólares)", "TitulosPublicos", 2000, 61, 0.047);
holding("iol-usd", "GD30D", "Global 2030 (dólares)", "TitulosPublicos", 1500, 66, -0.012);

const response = await fetch(`${server}/api/sync`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cursor: "0", changes }) });
if (!response.ok) throw new Error(`${response.status}: ${await response.text()}`);
console.log(`Sent ${changes.length} records to ${server}.`);
