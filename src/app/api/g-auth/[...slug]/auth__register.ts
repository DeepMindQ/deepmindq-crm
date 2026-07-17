import { NextResponse } from "next/server"

// Registration is disabled — this is a single-owner workspace.

export async function POST() {
  return NextResponse.json({ error: 'Registration is disabled' }, { status: 403 });
}

export async function GET() {
  return NextResponse.json({ error: 'Registration is disabled' }, { status: 403 });
}