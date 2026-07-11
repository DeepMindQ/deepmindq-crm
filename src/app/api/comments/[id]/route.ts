import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { apiError, apiSuccess, validateBody, sanitize } from '@/lib/apiHelpers'
import { createCommentSchema } from '@/lib/validations'

type RouteContext = { params: Promise<{ id: string }> }

// ─── GET ────────────────────────────────────────────────────────────────────
// Get single comment with its replies
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params

    const comment = await db.comment.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
        replies: {
          include: {
            user: {
              select: { id: true, name: true, email: true, image: true },
            },
            _count: { select: { replies: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!comment) return apiError('Comment not found', 404)
    return apiSuccess(comment)
  } catch (error) {
    console.error('Failed to fetch comment:', error)
    return apiError('Failed to fetch comment', 500)
  }
}

// ─── PATCH ──────────────────────────────────────────────────────────────────
// Update comment body
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const existing = await db.comment.findUnique({ where: { id } })
    if (!existing) return apiError('Comment not found', 404)

    const raw = await request.json()
    const parsed = validateBody(
      createCommentSchema.pick({ body: true }),
      raw,
    )
    if (parsed instanceof Response) return parsed

    const comment = await db.comment.update({
      where: { id },
      data: { body: sanitize(parsed.body) },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    })

    return apiSuccess(comment)
  } catch (error) {
    console.error('Failed to update comment:', error)
    return apiError('Failed to update comment', 500)
  }
}

// ─── DELETE ──────────────────────────────────────────────────────────────────
// Delete comment (and all replies via cascade)
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const existing = await db.comment.findUnique({ where: { id } })
    if (!existing) return apiError('Comment not found', 404)

    await db.comment.delete({ where: { id } })
    return apiSuccess({ success: true })
  } catch (error) {
    console.error('Failed to delete comment:', error)
    return apiError('Failed to delete comment', 500)
  }
}