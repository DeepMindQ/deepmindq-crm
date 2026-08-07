import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getVectorIndex } from '@/lib/vector-index';
import { CapabilityIntelligenceEngine } from '@/lib/capability-intelligence-engine';
import { logger } from '@/lib/logger';
import { checkApiAuth, requireAdminRole } from '@/lib/api-auth';

/**
 * Parse tags to JSON string for storage.
 */
function tagsToString(tags: string[] | undefined | null): string | null {
  if (!tags || !Array.isArray(tags) || tags.length === 0) return null;
  const cleaned = [...new Set(tags.map(t => t.trim().toLowerCase()).filter(Boolean))];
  return cleaned.length > 0 ? JSON.stringify(cleaned) : null;
}

/**
 * Parse tags from JSON string for response.
 */
function parseTagsField(tagsStr: string | null | undefined): string[] {
  if (!tagsStr) return [];
  try {
    const parsed = JSON.parse(tagsStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return tagsStr.split(',').map(t => t.trim()).filter(Boolean);
  }
}

/* ═══════════════════════════════════════════════════
   GET — List capabilities from the intelligence engine.
   Returns empty array if no capabilities exist (empty engine).
   ═══════════════════════════════════════════════════ */
export async function GET(request: Request) {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || '';
    const tag = searchParams.get('tag') || '';

    const where: Prisma.CapabilityAssetWhereInput = {};
    if (category) {
      where.category = category;
    }
    if (tag) {
      where.tags = { contains: tag.toLowerCase() };
    }

    const capabilities = await db.capabilityAsset.findMany({
      where,
      orderBy: { title: 'asc' },
      take: 100,
    });

    const withTags = capabilities.map(c => ({
      ...c,
      tags: parseTagsField(c.tags),
    }));

    return NextResponse.json(withTags);
  } catch (error) {
    logger.error('Capabilities list error:', { error: error });
    return NextResponse.json(
      { error: 'Failed to load capabilities' },
      { status: 500 }
    );
  }
}

/* ═══════════════════════════════════════════════════
   POST — Create a new capability asset + auto-embed
   ═══════════════════════════════════════════════════ */
export async function POST(request: Request) {
    // ── Authentication Guard ──
  const { session, errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;
  const adminError = requireAdminRole(session!);
  if (adminError) return adminError;

try {
    const body = await request.json();
    const { title, summary, category, serviceLine, targetIndustries, targetRoles,
            problems, evidence, content, tags, targetCompanySizes, parentAssetId,
            solution, accelerator, technology, industry, businessProblem,
            customerOutcome, differentiator, keywords, caseStudyRef, proofPointRef } = body;

    if (!title || !summary || !category) {
      return NextResponse.json({ error: 'title, summary, and category are required' }, { status: 400 });
    }

    if (parentAssetId) {
      const parentExists = await db.capabilityAsset.findUnique({ where: { id: parentAssetId } }).catch(() => null);
      if (!parentExists) {
        return NextResponse.json({ error: 'Parent capability not found' }, { status: 400 });
      }
    }

    const capability = await db.capabilityAsset.create({
      data: {
        title,
        summary,
        category,
        serviceLine: serviceLine || null,
        solution: solution || null,
        accelerator: accelerator || null,
        technology: technology || null,
        industry: industry || null,
        businessProblem: businessProblem || null,
        customerOutcome: customerOutcome || null,
        differentiator: differentiator || null,
        targetIndustries: targetIndustries || null,
        targetRoles: targetRoles || null,
        targetCompanySizes: targetCompanySizes || null,
        problems: problems || null,
        evidence: evidence || null,
        content: content || null,
        keywords: keywords || null,
        caseStudyRef: caseStudyRef || null,
        proofPointRef: proofPointRef || null,
        isActive: body.isActive !== false,
        tags: tagsToString(tags),
        parentAssetId: parentAssetId || null,
        version: 1,
      },
    });

    // Auto-embed so the new capability enters the vector index
    try {
      await CapabilityIntelligenceEngine.embedExisting(capability.id);
    } catch { /* non-blocking: embedding failure doesn't prevent creation */ }

    return NextResponse.json({
      ...capability,
      tags: parseTagsField(capability.tags),
    }, { status: 201 });
  } catch (error) {
    logger.error('Create capability error:', { error: error });
    return NextResponse.json(
      { error: 'Failed to create capability' },
      { status: 500 }
    );
  }
}

/* ═══════════════════════════════════════════════════
   PUT — Update capability + re-embed on version-worthy changes
   ═══════════════════════════════════════════════════ */
export async function PUT(request: Request) {
    // ── Authentication Guard ──
  const { session, errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;
  const adminError = requireAdminRole(session!);
  if (adminError) return adminError;

try {
    const body = await request.json();
    const { id, ...fields } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const current = await db.capabilityAsset.findUnique({ where: { id } });
    if (!current) {
      return NextResponse.json({ error: 'Capability not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    const allowedFields = [
      'title', 'summary', 'category', 'serviceLine', 'solution', 'accelerator',
      'technology', 'industry', 'businessProblem', 'customerOutcome', 'differentiator',
      'targetIndustries', 'targetRoles', 'targetCompanySizes', 'problems',
      'evidence', 'content', 'keywords', 'caseStudyRef', 'proofPointRef',
      'isActive', 'parentAssetId',
    ];
    for (const field of allowedFields) {
      if (fields[field] !== undefined) {
        updateData[field] = fields[field];
      }
    }

    if (fields.tags !== undefined) {
      updateData.tags = tagsToString(fields.tags);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    // Auto-increment version when title, summary, or content changes
    const versionWorthyFields = ['title', 'summary', 'content'];
    const hasVersionChange = versionWorthyFields.some(f =>
      fields[f] !== undefined && String(fields[f] || '') !== String((current as any)[f] || '')
    );
    if (hasVersionChange) {
      updateData.version = ((current as any).version || 0) + 1;
    }

    if (fields.parentAssetId) {
      const parentExists = await db.capabilityAsset.findUnique({ where: { id: fields.parentAssetId } }).catch(() => null);
      if (!parentExists) {
        return NextResponse.json({ error: 'Parent capability not found' }, { status: 400 });
      }
    }

    const capability = await db.capabilityAsset.update({
      where: { id },
      data: updateData,
    });

    // Re-embed on version-worthy changes
    if (hasVersionChange) {
      try {
        await CapabilityIntelligenceEngine.embedExisting(id);
      } catch { /* non-blocking */ }
    }

    return NextResponse.json({
      ...capability,
      tags: parseTagsField(capability.tags),
    });
  } catch (error) {
    logger.error('Update capability error:', { error: error });
    return NextResponse.json(
      { error: 'Failed to update capability' },
      { status: 500 }
    );
  }
}

/* ═══════════════════════════════════════════════════
   PATCH — Bulk Operations
   Body: { ids: string[], action: "activate"|"deactivate"|"delete"|"setCategory", category?: string }
   ═══════════════════════════════════════════════════ */
export async function PATCH(request: Request) {
    // ── Authentication Guard ──
  const { session, errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;
  const adminError = requireAdminRole(session!);
  if (adminError) return adminError;

try {
    const body = await request.json();
    const { ids, action, category } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids array is required' }, { status: 400 });
    }
    if (!action || !['activate', 'deactivate', 'delete', 'setCategory'].includes(action)) {
      return NextResponse.json({ error: 'action must be one of: activate, deactivate, delete, setCategory' }, { status: 400 });
    }
    if (action === 'setCategory' && !category) {
      return NextResponse.json({ error: 'category is required for setCategory action' }, { status: 400 });
    }

    let processed = 0;

    if (action === 'delete') {
      const result = await db.capabilityAsset.deleteMany({ where: { id: { in: ids } } });
      processed = result.count;
    } else if (action === 'activate') {
      const result = await db.capabilityAsset.updateMany({ where: { id: { in: ids } }, data: { isActive: true } });
      processed = result.count;
    } else if (action === 'deactivate') {
      const result = await db.capabilityAsset.updateMany({ where: { id: { in: ids } }, data: { isActive: false } });
      processed = result.count;
    } else if (action === 'setCategory') {
      const result = await db.capabilityAsset.updateMany({ where: { id: { in: ids } }, data: { category } });
      processed = result.count;
    }

    return NextResponse.json({
      success: true,
      action,
      requested: ids.length,
      processed,
    });
  } catch (error) {
    logger.error('Bulk operation error:', { error: error });
    return NextResponse.json(
      { error: 'Bulk operation failed' },
      { status: 500 }
    );
  }
}

/* ═══════════════════════════════════════════════════
   DELETE — Remove a capability
   ═══════════════════════════════════════════════════ */
export async function DELETE(request: Request) {
    // ── Authentication Guard ──
  const { session, errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;
  const adminError = requireAdminRole(session!);
  if (adminError) return adminError;

try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    await db.capabilityAsset.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Delete capability error:', { error: error });
    return NextResponse.json(
      { error: 'Failed to delete capability' },
      { status: 500 }
    );
  }
}
