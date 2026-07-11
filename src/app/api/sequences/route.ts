import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { apiError, apiSuccess, safeInt, validateBody } from '@/lib/apiHelpers'
import { createSequenceSchema } from '@/lib/validations'

// ---------------------------------------------------------------------------
// GET /api/sequences — List sequences
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const status = searchParams.get('status') || undefined
    const limit = safeInt(searchParams.get('limit'), 20, 1)
    const offset = safeInt(searchParams.get('offset'), 0, 0)

    const where: Record<string, unknown> = {}
    if (status) where.status = status

    const [sequences, total] = await Promise.all([
      db.emailSequence.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          _count: { select: { steps: true } },
        },
      }),
      db.emailSequence.count({ where }),
    ])

    return apiSuccess({ sequences, total })
  } catch {
    return apiError('Failed to fetch sequences')
  }
}

// ---------------------------------------------------------------------------
// POST /api/sequences — Create sequence
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const data = validateBody(createSequenceSchema, body)
    if (data instanceof Response) return data

    const sequence = await db.emailSequence.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        contactId: data.contactId ?? null,
        companyId: data.companyId ?? null,
      },
    })

    return apiSuccess(sequence, 201)
  } catch {
    return apiError('Failed to create sequence')
  }
}