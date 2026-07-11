import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { apiError, apiSuccess, validateBody } from '@/lib/apiHelpers'
import { createTeamSchema } from '@/lib/validations'

type RouteContext = { params: Promise<{ id: string }> }

// ─── GET ────────────────────────────────────────────────────────────────────
// Get single team with members
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const team = await db.team.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
      },
    })

    if (!team) return apiError('Team not found', 404)
    return apiSuccess(team)
  } catch (error) {
    console.error('Failed to fetch team:', error)
    return apiError('Failed to fetch team', 500)
  }
}

// ─── PATCH ──────────────────────────────────────────────────────────────────
// Update team name/description
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const existing = await db.team.findUnique({ where: { id } })
    if (!existing) return apiError('Team not found', 404)

    const raw = await request.json()
    const parsed = validateBody(createTeamSchema.partial(), raw)
    if (parsed instanceof Response) return parsed

    const team = await db.team.update({
      where: { id },
      data: {
        ...(parsed.name && { name: parsed.name }),
        ...(parsed.description !== undefined && { description: parsed.description ?? null }),
      },
      include: {
        _count: { select: { members: true } },
      },
    })

    return apiSuccess(team)
  } catch (error) {
    console.error('Failed to update team:', error)
    return apiError('Failed to update team', 500)
  }
}

// ─── DELETE ──────────────────────────────────────────────────────────────────
// Delete team (cascades to members)
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const existing = await db.team.findUnique({ where: { id } })
    if (!existing) return apiError('Team not found', 404)

    await db.team.delete({ where: { id } })
    return apiSuccess({ success: true })
  } catch (error) {
    console.error('Failed to delete team:', error)
    return apiError('Failed to delete team', 500)
  }
}