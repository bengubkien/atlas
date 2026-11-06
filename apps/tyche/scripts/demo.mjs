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

put("account", { id: "galicia", name: "Galicia", type: "bank", currency: "ARS", openingBalance: 185000000, openingDate: on(1, -2), archived: false, note: "" });
put("account", { id: "mp", name: "Mercado Pago", type: "wallet", currency: "ARS", openingBalance: 32000000, openingDate: on(1, -2), archived: false, note: "" });
put("account", { id: "visa", name: "Visa", type: "card", currency: "ARS", openingBalance: -41000000, openingDate: on(1, -2), archived: false, note: "" });
put("account", { id: "dollars", name: "Dollars", type: "savings", currency: "USD", openingBalance: 1150000, openingDate: on(1, -2), archived: false, note: "" });
put("account", { id: "cedears", name: "CEDEARs", type: "investment", currency: "USD", openingBalance: 420000, openingDate: on(1, -2), archived: false, note: "" });

const recurring = [
  { id: "rent", name: "Rent", accountId: "galicia", categoryId: "c-housing", amount: -95000000, frequency: "monthly", start: on(1, -2), autopay: false },
  { id: "power", name: "Edenor", accountId: "galicia", categoryId: "c-utilities", amount: -4200000, estimated: true, frequency: "monthly", start: on(10, -2), autopay: false },
  { id: "fiber", name: "Personal Fibra", accountId: "visa", categoryId: "c-internet", amount: -2899000, frequency: "monthly", start: on(15, -2), autopay: true },
  { id: "spotify", name: "Spotify", accountId: "visa", categoryId: "c-subscriptions", amount: -479900, frequency: "monthly", start: on(20, -2), autopay: true },
  // Paid every two weeks, the last time four days ago.
  { id: "salary", name: "Payroll", accountId: "galicia", categoryId: "c-salary", amount: 260000000, frequency: "biweekly", start: day(-4 - 14 * 5), autopay: false },
];
for (const item of recurring) put("recurring", { estimated: false, end: null, note: "", ...item });

let n = 0;
const tx = (accountId, date, amount, fields = {}) =>
  put("transaction", { id: `demo-${n++}`, accountId, date, amount, categoryId: null, payee: "", note: "", status: "cleared", recurringId: null, dueDate: null, transferId: null, goalId: null, importId: null, ...fields });
const paid = (item, date, amount = item.amount, status = "cleared") =>
  put("transaction", { id: `o-${item.id}-${date}`, accountId: item.accountId, date, amount, categoryId: item.categoryId, payee: item.name, note: "", status, recurringId: item.id, dueDate: date, transferId: null, goalId: null, importId: null });

// Last two months, paid.
for (const offset of [-2, -1]) {
  paid(recurring[0], on(1, offset));
  paid(recurring[1], on(10, offset), -3900000 - offset * 200000);
  tx("galicia", on(4, offset), -6500000, { categoryId: "c-groceries", payee: "Coto" });
  tx("mp", on(9, offset), -1850000, { categoryId: "c-eating-out", payee: "La Cabrera" });
  tx("mp", on(16, offset), -2400000, { categoryId: "c-groceries", payee: "Carrefour" });
  tx("visa", on(21, offset), -3100000, { categoryId: "c-shopping", payee: "Mercado Libre" });
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
tx("galicia", day(-4), -9430000, { categoryId: "c-groceries", payee: "Coto", note: "Weekly groceries" });
tx("mp", day(-3), -520000, { categoryId: "c-transport", payee: "YPF", note: "Fuel", status: "pending" });
tx("mp", day(-2), -850000, { categoryId: "c-coffee", payee: "Cuervo Café" });
tx("visa", day(-1), -1250000, { categoryId: "c-eating-out", payee: "Don Julio" });
tx("mp", day(0), -310000, { categoryId: "c-coffee", payee: "Lattente" });
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
put("goal", { id: "laptop", name: "New laptop", kind: "purchase", accountId: "cedears", target: 200000, startAmount: 182000, startDate: on(1, -4), targetDate: on(1, 2), note: "" });
const NAMES = { galicia: "Galicia", mp: "Mercado Pago", visa: "Visa", dollars: "Dollars", cedears: "CEDEARs" };
const move = (from, to, sent, received, date, goalId = null) => {
  const out = `demo-${n++}`;
  const into = `demo-${n++}`;
  const common = { date, categoryId: null, note: "", status: "cleared", recurringId: null, dueDate: null, importId: null };
  put("transaction", { ...common, id: out, accountId: from, amount: -sent, payee: NAMES[to], transferId: into, goalId: null });
  put("transaction", { ...common, id: into, accountId: to, amount: received, payee: NAMES[from], transferId: out, goalId });
};
move("galicia", "dollars", 71500000, 50000, on(3, -1), "emergency");
move("galicia", "dollars", 71800000, 50000, on(3), "japan");
move("galicia", "mp", 15000000, 15000000, day(-5));

const response = await fetch(`${server}/api/sync`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cursor: "0", changes }) });
if (!response.ok) throw new Error(`${response.status}: ${await response.text()}`);
console.log(`Sent ${changes.length} records to ${server}.`);
