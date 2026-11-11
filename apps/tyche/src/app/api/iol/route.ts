import { NextResponse } from "next/server";

import { iolStatus, readIolNow } from "@/lib/server/iol";

// IOL's connection, for Settings: whether a login is set, when IOL was last
// read and what went wrong, and "Read now". proxy.ts has already checked
// it's you, and that a POST came from Tyche's own pages.

export function GET() {
  return NextResponse.json(iolStatus(), { headers: { "cache-control": "no-store" } });
}

export async function POST() {
  if (!iolStatus().configured) return NextResponse.json({ ...iolStatus(), error: "No IOL login is set on the server." }, { status: 409 });
  return NextResponse.json(await readIolNow(), { headers: { "cache-control": "no-store" } });
}
