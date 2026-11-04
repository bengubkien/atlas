"use client";

import { Button } from "@atlas/ui/components/button";
import { ScreenMessage } from "@atlas/ui/components/screen-message";

/** When micasa can't be reached or answers something unexpected. */
export default function HestiaError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ScreenMessage title="Hestia couldn't read the house" actions={<Button onClick={reset}>Try again</Button>}>
      <p>Its data comes from micasa, and that didn&apos;t work this time.</p>
      {error.digest && <p className="font-mono text-xs">Reference: {error.digest} (in the app&apos;s log).</p>}
    </ScreenMessage>
  );
}
