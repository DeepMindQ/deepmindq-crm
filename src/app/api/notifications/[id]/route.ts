import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { apiError, apiSuccess, validateBody } from '@/lib/apiHelpers'
import { markNotificationReadSchema } from '@/lib/validations'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const data = validateBody(markNotificationReadSchema, body)
    if (data instanceof Response) return data

    const existing = await db.notification.findUnique({ where: { id } })
    if (!existing) {
      return apiError('Notification not found', 404)
    }

    const updated = await db.notification.update({
      where: { id },
      data: { read: data.read },
    })

    return apiSuccess(updated)
  } catch (error) {
    console.error('Failed to update notification:', error)
    return apiError('Failed to update notification', 500)
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await db.notification.findUnique({ where: { id } })
    if (!existing) {
      return apiError('Notification not found', 404)
    }

    await db.notification.delete({ where: { id } })

    return apiSuccess({ success: true })
  } catch (error) {
    console.error('Failed to delete notification:', error)
    return apiError('Failed to delete notification', 500)
  }
}