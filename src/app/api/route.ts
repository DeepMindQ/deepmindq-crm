import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { status: "ok", version: "1.0", timestamp: new Date().toISOString() },
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    }
  );
}