import { NextResponse } from "next/server";

import { kairosToday, todayResponse } from "@/atlas/today";
import { getSession } from "@/lib/auth/session";
import { messages } from "@/lib/messages";

/**
 * Atlas's patch (see ATLAS.md): what Kairos has for Atlas's Today. Atlas's
 * page asks from its own address, so this can't use route(), which refuses
 * other origins; it checks the session itself, and only reads.
 */
export async function GET(request: Request) {
  if (!(await getSession())) return NextResponse.json({ error: messages.signedOut }, { status: 401 });
  return todayResponse(request, await kairosToday());
}
