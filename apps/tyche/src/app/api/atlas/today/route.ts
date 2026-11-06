import { currentRecords } from "@atlas/sync/server";
import { todayResponse } from "@atlas/ui/today/server";

import { DEFAULT_SETTINGS, SCHEMAS, type Account, type Category, type Rate, type Recurring, type Settings, type Transaction } from "@/lib/model";
import { tycheToday } from "@/lib/today";

/** Bills due and overdue, late pay and categories over budget, for Atlas's Today. proxy.ts has already checked it's you. */
export async function GET(request: Request) {
  const records = await currentRecords(SCHEMAS, ["account", "category", "transaction", "recurring", "rate", "settings"]);
  const of = <T,>(kind: string) => records.filter((change) => change.kind === kind).map((change) => change.record as T);
  return todayResponse(
    request,
    tycheToday(
      {
        accounts: of<Account>("account"),
        categories: of<Category>("category"),
        transactions: of<Transaction>("transaction"),
        recurring: of<Recurring>("recurring"),
        rates: of<Rate>("rate"),
        settings: of<Settings>("settings")[0] ?? DEFAULT_SETTINGS,
      },
      process.env.ATLAS_LOCALE || "en-US",
    ),
  );
}
