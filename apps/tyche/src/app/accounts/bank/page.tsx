"use client";

import { AccountsPage } from "@/components/accounts-page";

export default function Page() {
  return <AccountsPage types={["bank", "card", "wallet", "cash"]} title="Cards and bank" description="Bank accounts, cards, wallets and cash. Each in its own currency." defaultType="bank" />;
}
