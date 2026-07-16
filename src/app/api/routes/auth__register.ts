import { NextResponse } from "next/server"

// Mock register route — no bcryptjs or next-auth imports

export async function POST() {
  return NextResponse.json({
    success: true,
    data: { id: "demo-1", name: "User", email: "" },
  })
}