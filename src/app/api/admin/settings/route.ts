import { db } from '@/lib/db'
import { apiError, apiSuccess, validateBody } from '@/lib/apiHelpers'
import { checkApiAuth } from '@/lib/api-auth'
import { hasPermission, type Permission } from '@/lib/rbac'
import { logger } from '@/lib/logger'
import { adminSettingsSchema, adminSettingDeleteSchema } from '@/lib/validation-schemas'

// ═══════════════════════════════════════════════════════════════
// GET /api/admin/settings — List all system settings
// Supports ?search=xxx (searches key & value)
// ═══════════════════════════════════════════════════════════════
export async function GET(request: Request) {
  const { session, errorResponse } = await checkApiAuth(request)
  if (errorResponse) return errorResponse

  // Explicit RBAC: settings:read
  if (!hasPermission(session!.role, 'settings:read' as Permission)) {
    return apiError('Forbidden: settings:read permission required', 403)
  }

  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')?.trim() || ''

    const settings = await db.systemSetting.findMany({
      where: search
        ? {
            OR: [
              { key: { contains: search } },
              { value: { contains: search } },
            ],
          }
        : undefined,
      orderBy: { key: 'asc' },
    })

    return apiSuccess(settings)
  } catch (err) {
    logger.error('[api/admin/settings] GET error:', { error: err })
    return apiError('Failed to fetch settings')
  }
}

// ═══════════════════════════════════════════════════════════════
// POST /api/admin/settings — Upsert a setting
// Body: { key: string, value: string }
// ═══════════════════════════════════════════════════════════════
export async function POST(request: Request) {
  const { session, errorResponse } = await checkApiAuth(request)
  if (errorResponse) return errorResponse

  // Explicit RBAC: settings:write
  if (!hasPermission(session!.role, 'settings:write' as Permission)) {
    return apiError('Forbidden: settings:write permission required', 403)
  }

  try {
    const rawBody = await request.json()
    const parsed = validateBody(adminSettingsSchema, rawBody)
    if (parsed instanceof Response) return parsed
    const { key, value } = parsed

    const setting = await db.systemSetting.upsert({
      where: { key },
      update: { value: String(value) },
      create: { key, value: String(value) },
    })

    logger.info('[api/admin/settings] Setting upserted', { key, actor: session!.email })
    return apiSuccess(setting)
  } catch (err) {
    logger.error('[api/admin/settings] POST error:', { error: err })
    return apiError('Failed to upsert setting')
  }
}

// ═══════════════════════════════════════════════════════════════
// DELETE /api/admin/settings — Delete a setting
// Body: { key: string }
// ═══════════════════════════════════════════════════════════════
export async function DELETE(request: Request) {
  const { session, errorResponse } = await checkApiAuth(request)
  if (errorResponse) return errorResponse

  // Explicit RBAC: settings:write (delete is a write operation)
  if (!hasPermission(session!.role, 'settings:write' as Permission)) {
    return apiError('Forbidden: settings:write permission required', 403)
  }

  try {
    const rawBody = await request.json()
    const parsed = validateBody(adminSettingDeleteSchema, rawBody)
    if (parsed instanceof Response) return parsed
    const { key } = parsed

    await db.systemSetting.delete({
      where: { key },
    })

    logger.info('[api/admin/settings] Setting deleted', { key, actor: session!.email })
    return apiSuccess({ deleted: true, key })
  } catch (err: unknown) {
    // Prisma throws P2025 when record not found
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2025') {
      return apiError('Setting not found', 404)
    }
    logger.error('[api/admin/settings] DELETE error:', { error: err })
    return apiError('Failed to delete setting')
  }
}
