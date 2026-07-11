import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { apiSuccess, apiError, validateBody } from '@/lib/apiHelpers'
import { assignTagsSchema } from '@/lib/validations'

// POST /api/tags/assign — sync tags on an entity (add new, remove missing)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const data = validateBody(assignTagsSchema, body)
    if (data instanceof Response) return data

    const { tagIds, entity, entityId } = data
    const whereField = entity === 'company' ? 'companyId' : 'contactId'

    // Validate entity exists
    if (entity === 'company') {
      const company = await db.company.findUnique({ where: { id: entityId } })
      if (!company) return apiError('Company not found', 404)
    } else {
      const contact = await db.contact.findUnique({ where: { id: entityId } })
      if (!contact) return apiError('Contact not found', 404)
    }

    // Validate all tag IDs exist
    const existingTags = await db.tag.findMany({
      where: { id: { in: tagIds } },
      select: { id: true },
    })
    const validTagIds = new Set(existingTags.map((t) => t.id))

    // Remove assignments for tags NOT in the list
    await db.tagAssignment.deleteMany({
      where: {
        [whereField]: entityId,
        ...(tagIds.length > 0 && { tagId: { notIn: tagIds } }),
      },
    })

    // Create new assignments for tags not already assigned
    if (tagIds.length > 0) {
      // Find existing assignments
      const currentAssignments = await db.tagAssignment.findMany({
        where: { [whereField]: entityId },
        select: { tagId: true },
      })
      const currentTagIds = new Set(currentAssignments.map((a) => a.tagId))

      const toCreate = tagIds.filter(
        (id) => validTagIds.has(id) && !currentTagIds.has(id),
      )

      if (toCreate.length > 0) {
        await db.tagAssignment.createMany({
          data: toCreate.map((tagId) => ({
            tagId,
            [whereField]: entityId,
          })),
        })
      }
    }

    // Fetch updated tag list for the entity
    const assignments = await db.tagAssignment.findMany({
      where: { [whereField]: entityId },
      include: { tag: true },
      orderBy: { createdAt: 'asc' },
    })

    return apiSuccess({
      data: assignments.map((a) => ({
        id: a.id,
        tagId: a.tagId,
        tag: a.tag,
      })),
    })
  } catch (error) {
    console.error('[POST /api/tags/assign]', error)
    return apiError('Failed to assign tags')
  }
}
