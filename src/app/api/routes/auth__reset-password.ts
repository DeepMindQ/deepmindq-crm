import { NextResponse } from "next/server"

// Mock reset-password request route — no bcryptjs or next-auth imports

export async function POST() {
  return NextResponse.json({
    success: true,
    data: { message: "Reset email sent" },
  })
}