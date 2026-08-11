import { db } from '@/lib/db'
import { apiError, apiSuccess, apiPaginated, validateBody } from '@/lib/apiHelpers'
import { checkApiAuth } from '@/lib/api-auth'
import { hasPermission, type Permission } from '@/lib/rbac'
import { logger } from '@/lib/logger'
import { safeInt } from '@/lib/apiHelpers'
import { adminUserPatchSchema } from '@/lib/validation-schemas'

// Fields safe to return — never expose passwordHash
const USER_SAFE_SELECT = {
  id: true,
  email: true,
  name: true,
  phone: true,
  company: true,
  designation: true,
  role: true,
  hasPassword: true,
  avatarUrl: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} as const

// ═══════════════════════════════════════════════════════════════
// GET /api/admin/users — List users with pagination
// Query: ?page=1&limit=20&search=xxx&role=xxx&status=xxx
// ═══════════════════════════════════════════════════════════════
export async function GET(request: Request) {
  const { session, errorResponse } = await checkApiAuth(request)
  if (errorResponse) return errorResponse

  // Explicit RBAC: users:manage
  if (!hasPermission(session!.role, 'users:manage' as Permission)) {
    return apiError('Forbidden: users:manage permission required', 403)
  }

  try {
    const { searchParams } = new URL(request.url)
    const page = safeInt(searchParams.get('page'), 1, 1)
    const limit = safeInt(searchParams.get('limit'), 20, 1)
    const search = searchParams.get('search')?.trim() || ''
    const role = searchParams.get('role')?.trim() || ''
    const status = searchParams.get('status')?.trim() || ''

    const where: Record<string, unknown>[] = []

    if (search) {
      where.push({
        OR: [
          { email: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
        ],
      })
    }

    if (role) {
      where.push({ role })
    }

    if (status) {
      // status maps to isActive boolean
      const isActive = status === 'active'
      where.push({ isActive })
    }

    const [users, total] = await Promise.all([
      db.user.findMany({
        where: where.length > 0 ? { AND: where } : undefined,
        select: USER_SAFE_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.user.count({
        where: where.length > 0 ? { AND: where } : undefined,
      }),
    ])

    return apiPaginated(users, total, page, limit)
  } catch (err) {
    logger.error('[api/admin/users] GET error:', { error: err })
    return apiError('Failed to fetch users')
  }
}

// ═══════════════════════════════════════════════════════════════
// PATCH /api/admin/users — Update a user
// Body: { id: string, role?: string, status?: string, name?: string }
// ═══════════════════════════════════════════════════════════════
export async function PATCH(request: Request) {
  const { session, errorResponse } = await checkApiAuth(request)
  if (errorResponse) return errorResponse

  // Explicit RBAC: users:manage
  if (!hasPermission(session!.role, 'users:manage' as Permission)) {
    return apiError('Forbidden: users:manage permission required', 403)
  }

  try {
    const rawBody = await request.json()
    const parsed = validateBody(adminUserPatchSchema, rawBody)
    if (parsed instanceof Response) return parsed
    const { id, role, status, name } = parsed

    // Prevent self-demotion: can't change own role
    if (role && id === session!.id) {
      return apiError('Cannot modify your own role', 403)
    }

    // Prevent role escalation to 'owner' unless current user is 'owner'
    if (role === 'owner' && session!.role !== 'owner') {
      return apiError('Only owners can assign the owner role', 403)
    }

    // Build update payload
    const updateData: Record<string, unknown> = {}
    if (role !== undefined) updateData.role = role
    if (name !== undefined) updateData.name = name
    if (status !== undefined) {
      // Map status strings to isActive boolean
      if (status === 'active') updateData.isActive = true
      else if (status === 'suspended' || status === 'inactive') updateData.isActive = false
      else return apiError('Invalid status. Must be "active", "suspended", or "inactive"', 400)
    }

    if (Object.keys(updateData).length === 0) {
      return apiError('No fields to update', 400)
    }

    const updatedUser = await db.user.update({
      where: { id },
      data: updateData,
      select: USER_SAFE_SELECT,
    })

    logger.info('[api/admin/users] User updated', {
      targetId: id,
      changes: Object.keys(updateData),
      actor: session!.email,
    })

    return apiSuccess(updatedUser)
  } catch (err: unknown) {
    // Prisma throws P2025 when record not found
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2025') {
      return apiError('User not found', 404)
    }
    logger.error('[api/admin/users] PATCH error:', { error: err })
    return apiError('Failed to update user')
  }
}
