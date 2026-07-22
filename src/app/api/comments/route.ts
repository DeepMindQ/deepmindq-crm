import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { apiError, apiSuccess, safeInt, validateBody, sanitize } from '@/lib/apiHelpers'
import { createCommentSchema } from '@/lib/validations'

// ─── GET ────────────────────────────────────────────────────────────────────
// List comments. Params: ?companyId, ?contactId, ?opportunityId, ?parentId, ?limit=50
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    const contactId = searchParams.get('contactId')
    const opportunityId = searchParams.get('opportunityId')
    const parentIdRaw = searchParams.get('parentId')
    const limit = Math.min(200, Math.max(1, safeInt(searchParams.get('limit'), 50, 10)))

    // Build where clause — parentId handling: "null" string → top-level, otherwise specific parent
    const where: Record<string, unknown> = {}
    if (companyId) where.companyId = companyId
    if (contactId) where.contactId = contactId
    if (opportunityId) where.opportunityId = opportunityId
    if (parentIdRaw !== null) {
      where.parentId = parentIdRaw === 'null' ? null : parentIdRaw
    }

    const comments = await db.comment.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
        _count: { select: { replies: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return apiSuccess(comments)
  } catch (error) {
    console.error('Failed to fetch comments:', error)
    return apiError('Failed to fetch comments', 500)
  }
}

// ─── POST ───────────────────────────────────────────────────────────────────
// Create a comment. Auto-sets userId. Parses @mentions for notifications.
export async function POST(request: NextRequest) {
  try {
    const raw = await request.json()
    const parsed = validateBody(createCommentSchema, raw)
    if (parsed instanceof Response) return parsed

    const userId = '1' // Dev mode — in production, extract from session

    const comment = await db.comment.create({
      data: {
        body: sanitize(parsed.body),
        userId,
        companyId: parsed.companyId ?? null,
        contactId: parsed.contactId ?? null,
        opportunityId: parsed.opportunityId ?? null,
        parentId: parsed.parentId ?? null,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    })

    // Parse @mentions and create notifications
    const mentionRegex = /@(\w+)/g
    let match: RegExpExecArray | null
    const mentionedNames = new Set<string>()
    while ((match = mentionRegex.exec(parsed.body)) !== null) {
      mentionedNames.add(match[1])
    }

    if (mentionedNames.size > 0) {
      // Find users whose name starts with any of the mentioned names
      const allUsers = await db.user.findMany({
        select: { id: true, name: true },
      })

      for (const mentionedName of mentionedNames) {
        const targetUser = allUsers.find(
          (u) =>
            u.name.toLowerCase().includes(mentionedName.toLowerCase()) ||
            u.name.split(' ')[0].toLowerCase() === mentionedName.toLowerCase(),
        )
        if (targetUser && targetUser.id !== userId) {
          // Check if we already notified this user for this comment
          await db.notification.create({
            data: {
              userId: targetUser.id,
              title: 'You were mentioned in a comment',
              message: `You were mentioned by in a comment.`,
              type: 'info',
            },
          })
        }
      }
    }

    return apiSuccess(comment, 201)
  } catch (error) {
    console.error('Failed to create comment:', error)
    return apiError('Failed to create comment', 500)
  }
}