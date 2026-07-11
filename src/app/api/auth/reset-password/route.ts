import { NextRequest } from "next/server"
import bcrypt from "bcryptjs"
import crypto from "crypto"
import { db } from "@/lib/db"
import { validateBody, apiError, apiSuccess } from "@/lib/apiHelpers"
import { resetPasswordRequestSchema, resetPasswordConfirmSchema } from "@/lib/validations"

// POST /api/auth/reset-password — request a reset code
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = validateBody(resetPasswordRequestSchema, body)
    if (data instanceof Response) return data

    const user = await db.user.findUnique({ where: { email: data.email } })
    if (!user) {
      // Return success even if user doesn't exist to prevent email enumeration
      return apiSuccess({ message: "If an account exists with this email, a reset code has been generated." })
    }

    // Generate 6-digit code
    const code = crypto.randomInt(100000, 999999).toString()
    const hashedCode = await bcrypt.hash(code, 10)
    const expires = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes

    // Store hashed code in VerificationToken
    await db.verificationToken.create({
      data: {
        identifier: `reset-password:${data.email}`,
        token: hashedCode,
        expires,
      },
    })

    // In production, this would send an email. For now, log the code.
    console.log(`[RESET PASSWORD] Code for ${data.email}: ${code}`)

    return apiSuccess({ message: "If an account exists with this email, a reset code has been generated." })
  } catch (error) {
    console.error("Reset password request error:", error)
    return apiError("Failed to process reset request")
  }
}