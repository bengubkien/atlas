import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { parseChange, SYNC_BATCH, type Change } from "@/lib/model";
import { applyChanges, changesSince } from "@/server/records";

// The one endpoint the phone syncs through: it sends what changed on it since
// the last sync, and gets back what changed anywhere since the cursor it last
// had. proxy.ts has already checked it's you.

const body = z.object({
  cursor: z.string().max(30).default("0"),
  changes: z.array(z.unknown()).max(SYNC_BATCH).default([]),
});

export async function POST(request: NextRequest) {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "A sync request is { cursor, changes }." }, { status: 400 });

  const changes: Change[] = [];
  for (const [index, raw] of parsed.data.changes.entries()) {
    const change = parseChange(raw);
    if (!change) return NextResponse.json({ error: `Change ${index} isn't a valid record.` }, { status: 400 });
    changes.push(change);
  }

  try {
    const applied = await applyChanges(changes);
    const page = await changesSince(parsed.data.cursor);
    return NextResponse.json({ ...page, applied });
  } catch (error) {
    console.error("sync failed", error);
    return NextResponse.json({ error: "The server couldn't save. Your changes stay on this device." }, { status: 503 });
  }
}
