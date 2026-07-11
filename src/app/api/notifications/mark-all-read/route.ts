import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { apiError, apiSuccess } from '@/lib/apiHelpers'

// Dev mode: use the first user in the DB
async function getDevUserId(): Promise<string> {
  const user = await db.user.findFirst({ select: { id: true } })
  if (!user) return '1'
  return user.id
}

export async function POST(_request: NextRequest) {
  try {
    const userId = await getDevUserId()
    const result = await db.notification.updateMany({
      where: {
        userId,
        read: false,
      },
      data: { read: true },
    })

    return apiSuccess({ markedCount: result.count })
  } catch (error) {
    console.error('Failed to mark all notifications as read:', error)
    return apiError('Failed to mark all notifications as read', 500)
  }
}