import { Suspense } from "react";

import { OverviewScreen } from "@/components/overview/screen";

export default function Page() {
  // The month and the account filter live in the address, which needs a Suspense boundary.
  return (
    <Suspense>
      <OverviewScreen />
    </Suspense>
  );
}
