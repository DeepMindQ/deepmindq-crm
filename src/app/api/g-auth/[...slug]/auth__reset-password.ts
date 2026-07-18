import { NextResponse } from "next/server"

// Password reset is disabled — this is a single-owner workspace.

export async function POST() {
  return NextResponse.json({ error: 'Not available' }, { status: 403 });
}