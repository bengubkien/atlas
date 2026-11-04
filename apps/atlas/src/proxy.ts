import type { NextRequest } from "next/server";

import { guard } from "@atlas/ui/auth";

/** Only you, through Tailscale (see @atlas/ui/auth). */
export function proxy(request: NextRequest) {
  return guard(request);
}

export const config = {
  // Everything but Next's own files, the icons and the manifest: nothing
  // private, and browsers fetch them in the background.
  matcher: ["/((?!_next/static|_next/image|icon|apple-icon|manifest.webmanifest).*)"],
};
