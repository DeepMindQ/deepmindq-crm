import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { apiError, apiSuccess, validateBody } from '@/lib/apiHelpers'
import { addTeamMemberSchema } from '@/lib/validations'

type RouteContext = { params: Promise<{ id: string }> }

// ─── GET ────────────────────────────────────────────────────────────────────
// List members of a team
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const team = await db.team.findUnique({ where: { id } })
    if (!team) return apiError('Team not found', 404)

    const members = await db.teamMember.findMany({
      where: { teamId: id },
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
      orderBy: { joinedAt: 'asc' },
    })

    return apiSuccess(members)
  } catch (error) {
    console.error('Failed to fetch team members:', error)
    return apiError('Failed to fetch team members', 500)
  }
}

// ─── POST ───────────────────────────────────────────────────────────────────
// Add a member to a team
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const team = await db.team.findUnique({ where: { id } })
    if (!team) return apiError('Team not found', 404)

    const raw = await request.json()
    const parsed = validateBody(addTeamMemberSchema, raw)
    if (parsed instanceof Response) return parsed

    // Verify user exists
    const user = await db.user.findUnique({ where: { id: parsed.userId } })
    if (!user) return apiError('User not found', 404)

    // Check if already a member
    const existing = await db.teamMember.findUnique({
      where: { teamId_userId: { teamId: id, userId: parsed.userId } },
    })
    if (existing) return apiError('User is already a member of this team', 409)

    const member = await db.teamMember.create({
      data: {
        teamId: id,
        userId: parsed.userId,
        role: parsed.role,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    })

    return apiSuccess(member, 201)
  } catch (error) {
    console.error('Failed to add team member:', error)
    return apiError('Failed to add team member', 500)
  }
}

// ─── DELETE ──────────────────────────────────────────────────────────────────
// Remove a member from a team. Query: ?userId=xxx
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) return apiError('userId query parameter is required', 400)

    const team = await db.team.findUnique({ where: { id } })
    if (!team) return apiError('Team not found', 404)

    const member = await db.teamMember.findUnique({
      where: { teamId_userId: { teamId: id, userId } },
    })
    if (!member) return apiError('Member not found', 404)

    await db.teamMember.delete({ where: { id: member.id } })
    return apiSuccess({ success: true })
  } catch (error) {
    console.error('Failed to remove team member:', error)
    return apiError('Failed to remove team member', 500)
  }
}