import Link from "next/link";

import { buttonClassName } from "@atlas/ui/components/button";
import { ScreenMessage } from "@atlas/ui/components/screen-message";

export default function NotFound() {
  return (
    <ScreenMessage title="Not here" actions={<Link href="/" className={buttonClassName("secondary")}>Back to the overview</Link>}>
      <p>That page, or the record it was about, isn&apos;t in Hestia. It may have been deleted.</p>
    </ScreenMessage>
  );
}
