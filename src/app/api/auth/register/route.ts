import { NextRequest } from "next/server"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import { validateBody, apiError, apiSuccess } from "@/lib/apiHelpers"
import { registerSchema } from "@/lib/validations"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = validateBody(registerSchema, body)
    if (data instanceof Response) return data

    // Check if user already exists
    const existing = await db.user.findUnique({ where: { email: data.email } })
    if (existing) return apiError("An account with this email already exists", 409)

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, 10)

    // Create user
    const user = await db.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    })

    return apiSuccess({ user }, 201)
  } catch (error) {
    console.error("Registration error:", error)
    return apiError("Registration failed. Please try again later.")
  }
}