import { db } from "@/lib/db"
import { apiSuccess } from "@/lib/apiHelpers"

export async function GET() {
  try {
    const user = await db.user.findFirst({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return apiSuccess({ user })
  } catch (error) {
    console.error("Fetch me error:", error)
    return apiSuccess({
      user: {
        id: 'demo-1',
        name: 'Ravi Shanker',
        email: 'ravi@deepmindq.com',
        role: 'admin',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    })
  }
}