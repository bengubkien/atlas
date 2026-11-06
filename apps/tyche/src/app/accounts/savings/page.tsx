"use client";

import { AccountsPage } from "@/components/accounts-page";

export default function Page() {
  return <AccountsPage types={["savings"]} title="Savings" description="Money you're keeping aside." defaultType="savings" />;
}
