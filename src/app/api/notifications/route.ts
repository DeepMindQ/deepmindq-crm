import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { apiError, apiSuccess, validateBody, safeInt } from '@/lib/apiHelpers'
import { createNotificationSchema } from '@/lib/validations'

// Dev mode: use the first user in the DB
async function getDevUserId(): Promise<string> {
  const user = await db.user.findFirst({ select: { id: true } })
  if (!user) return '1'
  return user.id
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getDevUserId()
    const { searchParams } = new URL(request.url)
    const unreadOnly = searchParams.get('unread') === 'true'
    const type = searchParams.get('type') || ''
    const limit = Math.min(100, Math.max(1, safeInt(searchParams.get('limit'), 20)))
    const offset = Math.max(0, safeInt(searchParams.get('offset'), 0))

    const where: Record<string, unknown> = { userId }

    if (unreadOnly) {
      where.read = false
    }
    if (type) {
      where.type = type
    }

    const [notifications, unreadCount] = await Promise.all([
      db.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.notification.count({
        where: { userId, read: false },
      }),
    ])

    return apiSuccess({ data: notifications, unreadCount })
  } catch (error) {
    console.error('Failed to fetch notifications:', error)
    return apiError('Failed to fetch notifications', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getDevUserId()
    const body = await request.json()
    const data = validateBody(createNotificationSchema, body)
    if (data instanceof Response) return data

    const notification = await db.notification.create({
      data: {
        userId,
        title: data.title,
        message: data.message || null,
        type: data.type,
        link: data.link || null,
        read: false,
      },
    })

    return apiSuccess(notification, 201)
  } catch (error) {
    console.error('Failed to create notification:', error)
    return apiError('Failed to create notification', 500)
  }
}