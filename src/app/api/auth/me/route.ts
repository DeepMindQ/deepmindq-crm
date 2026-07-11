import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { apiError, apiSuccess } from "@/lib/apiHelpers"

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return apiError("Unauthorized", 401)
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        image: true,
        role: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!user) return apiError("User not found", 404)

    return apiSuccess({ user })
  } catch (error) {
    console.error("Fetch me error:", error)
    return apiError("Failed to fetch user profile")
  }
}