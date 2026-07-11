import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { apiError, apiSuccess, validateBody } from '@/lib/apiHelpers'
import { createTeamSchema } from '@/lib/validations'

// ─── GET ────────────────────────────────────────────────────────────────────
// List all teams with member count
export async function GET() {
  try {
    const teams = await db.team.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { members: true } },
      },
    })
    return apiSuccess(teams)
  } catch (error) {
    console.error('Failed to fetch teams:', error)
    return apiError('Failed to fetch teams', 500)
  }
}

// ─── POST ───────────────────────────────────────────────────────────────────
// Create a new team
export async function POST(request: NextRequest) {
  try {
    const raw = await request.json()
    const parsed = validateBody(createTeamSchema, raw)
    if (parsed instanceof Response) return parsed

    const team = await db.team.create({
      data: {
        name: parsed.name,
        description: parsed.description ?? null,
      },
      include: {
        _count: { select: { members: true } },
      },
    })

    return apiSuccess(team, 201)
  } catch (error) {
    console.error('Failed to create team:', error)
    return apiError('Failed to create team', 500)
  }
}