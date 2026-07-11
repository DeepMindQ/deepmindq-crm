import { NextResponse } from "next/server"

// Mock reset-password confirm route — no bcryptjs or next-auth imports

export async function POST() {
  return NextResponse.json({
    success: true,
    data: { message: "Password reset confirmed" },
  })
}