"use client";

import { AccountsPage } from "@/components/accounts-page";

export default function Page() {
  return (
    <AccountsPage
      types={["investment"]}
      title="Investments"
      description="Balances here are updated by hand: add a transaction when the value changes. There are no market prices."
      defaultType="investment"
    />
  );
}
