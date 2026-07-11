import { NextRequest } from "next/server"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import { validateBody, apiError, apiSuccess } from "@/lib/apiHelpers"
import { resetPasswordConfirmSchema } from "@/lib/validations"

// POST /api/auth/reset-password/confirm — verify code & set new password
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = validateBody(resetPasswordConfirmSchema, body)
    if (data instanceof Response) return data

    const user = await db.user.findUnique({ where: { email: data.email } })
    if (!user) return apiError("No account found with this email", 404)

    // Find the latest valid verification token
    const tokens = await db.verificationToken.findMany({
      where: {
        identifier: `reset-password:${data.email}`,
        expires: { gt: new Date() },
      },
      orderBy: { expires: "desc" },
    })

    // Try each token (in case multiple were generated)
    let matched = false
    for (const token of tokens) {
      const isValid = await bcrypt.compare(data.code, token.token)
      if (isValid) {
        // Delete used token
        await db.verificationToken.delete({ where: { token: token.token } })
        matched = true
        break
      }
    }

    if (!matched) {
      return apiError("Invalid or expired reset code", 400)
    }

    // Hash new password and update
    const passwordHash = await bcrypt.hash(data.newPassword, 10)
    await db.user.update({
      where: { id: user.id },
      data: { passwordHash },
    })

    return apiSuccess({ message: "Password has been reset successfully" })
  } catch (error) {
    console.error("Reset password confirm error:", error)
    return apiError("Failed to reset password")
  }
}