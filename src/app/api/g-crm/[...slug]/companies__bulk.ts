import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { csrfMiddleware } from '@/lib/csrf';

/* ═══════════════════════════════════════════════════
   POST — Bulk operations on companies
   Actions: updateStatus, addTag, removeTag, delete, assign
   ═══════════════════════════════════════════════════ */
export async function POST(request: Request) {
  const csrf = csrfMiddleware(request)
  if (!csrf.valid) return csrf.response!
  try {
    const body = await request.json();
    const { action, companyIds } = body as { action: string; companyIds?: string[] };

    if (!action || typeof action !== 'string') {
      return NextResponse.json({ error: 'action is required' }, { status: 400 });
    }

    if (!Array.isArray(companyIds) || companyIds.length === 0) {
      return NextResponse.json(
        { error: 'companyIds must be a non-empty array' },
        { status: 400 }
      );
    }

    if (companyIds.length > 100) {
      return NextResponse.json(
        { error: 'Cannot operate on more than 100 companies at once' },
        { status: 400 }
      );
    }

    // Verify all companies exist
    const existingCompanies = await db.company.findMany({
      where: { id: { in: companyIds } },
      select: { id: true, tags: true },
    });

    const foundIds = new Set(existingCompanies.map((c: any) => c.id));
    const missingIds = companyIds.filter((id: string) => !foundIds.has(id));
    const validIds = companyIds.filter((id: string) => foundIds.has(id));

    if (validIds.length === 0) {
      return NextResponse.json({ error: 'No valid company IDs provided' }, { status: 400 });
    }

    let result: Record<string, any> = {};

    switch (action) {
      /* ── Update Status ── */
      case 'updateStatus': {
        const { status } = body as { status: string };
        if (!status) {
          return NextResponse.json({ error: 'status is required for updateStatus action' }, { status: 400 });
        }

        const validStatuses = ['prospect', 'researching', 'active', 'engaged', 'paused', 'closed_won', 'closed_lost'];
        if (!validStatuses.includes(status)) {
          return NextResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, { status: 400 });
        }

        const updateResult = await db.company.updateMany({
          where: { id: { in: validIds } },
          data: { status, lastActivityAt: new Date() },
        });

        result = { updated: updateResult.count, action: 'updateStatus', status };
        break;
      }

      /* ── Add Tag ── */
      case 'addTag': {
        const { tag } = body as { tag: string };
        if (!tag || typeof tag !== 'string' || tag.trim().length === 0) {
          return NextResponse.json({ error: 'tag is required for addTag action' }, { status: 400 });
        }

        const tagToAdd = tag.trim().toLowerCase();

        // Update each company's tags individually since we need to read-modify-write JSON
        let updatedCount = 0;
        for (const company of existingCompanies) {
          let currentTags: string[] = [];
          try {
            currentTags = JSON.parse((company as any).tags || '[]');
          } catch {
            currentTags = [];
          }

          if (!currentTags.includes(tagToAdd)) {
            currentTags.push(tagToAdd);
            await db.company.update({
              where: { id: (company as any).id },
              data: { tags: JSON.stringify(currentTags) },
            });
            updatedCount++;
          }
        }

        result = { updated: updatedCount, action: 'addTag', tag: tagToAdd };
        break;
      }

      /* ── Remove Tag ── */
      case 'removeTag': {
        const { tag } = body as { tag: string };
        if (!tag || typeof tag !== 'string' || tag.trim().length === 0) {
          return NextResponse.json({ error: 'tag is required for removeTag action' }, { status: 400 });
        }

        const tagToRemove = tag.trim().toLowerCase();

        let updatedCount = 0;
        for (const company of existingCompanies) {
          let currentTags: string[] = [];
          try {
            currentTags = JSON.parse((company as any).tags || '[]');
          } catch {
            currentTags = [];
          }

          const filtered = currentTags.filter((t: string) => t !== tagToRemove);
          if (filtered.length !== currentTags.length) {
            await db.company.update({
              where: { id: (company as any).id },
              data: { tags: JSON.stringify(filtered) },
            });
            updatedCount++;
          }
        }

        result = { updated: updatedCount, action: 'removeTag', tag: tagToRemove };
        break;
      }

      /* ── Delete Companies ── */
      case 'delete': {
        const deleteResult = await db.company.deleteMany({
          where: { id: { in: validIds } },
        });

        result = { deleted: deleteResult.count, action: 'delete' };
        break;
      }

      /* ── Assign User ── */
      case 'assign': {
        const { assignedTo } = body as { assignedTo: string };
        if (!assignedTo || typeof assignedTo !== 'string' || assignedTo.trim().length === 0) {
          return NextResponse.json({ error: 'assignedTo is required for assign action' }, { status: 400 });
        }

        const updateResult = await db.company.updateMany({
          where: { id: { in: validIds } },
          data: { assignedTo: assignedTo.trim() },
        });

        result = { updated: updateResult.count, action: 'assign', assignedTo: assignedTo.trim() };
        break;
      }

      /* ── Cleanup garbage sizeRange values (#27) ── */
      case 'cleanupSizeRange': {
        const VALID_RANGES = ['1-10', '11-50', '51-200', '201-500', '501-1,000', '1,001-5,000', '5,001-10,000', '10,001+'];
        const garbageCompanies = await db.company.findMany({
          where: { id: { in: validIds } },
          select: { id: true, sizeRange: true },
        });
        const updates: { id: string; mapped: string | null }[] = [];
        for (const c of garbageCompanies) {
          const sr = (c as any).sizeRange;
          if (sr && !VALID_RANGES.includes(sr)) {
            const num = parseInt(String(sr).replace(/[^0-9]/g, ''), 10);
            let mapped: string | null = null;
            if (!isNaN(num)) {
              if (num <= 10) mapped = '1-10';
              else if (num <= 50) mapped = '11-50';
              else if (num <= 200) mapped = '51-200';
              else if (num <= 500) mapped = '201-500';
              else if (num <= 1000) mapped = '501-1,000';
              else if (num <= 5000) mapped = '1,001-5,000';
              else if (num <= 10000) mapped = '5,001-10,000';
              else mapped = '10,001+';
            }
            if (mapped) updates.push({ id: c.id, mapped });
          }
        }
        // Batch update using $executeRaw or sequential within transaction
        let cleaned = 0;
        if (updates.length > 0) {
          await db.$transaction(
            updates.map(u => db.company.update({ where: { id: u.id }, data: { sizeRange: u.mapped } }))
          );
          cleaned = updates.length;
        }
        result = { cleaned, action: 'cleanupSizeRange' };
        break;
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}. Valid actions: updateStatus, addTag, removeTag, delete, assign` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      ...result,
      missingIds: missingIds.length > 0 ? missingIds : undefined,
    });
  } catch (error) {
    console.error('Bulk operation error:', error);
    return NextResponse.json({ error: 'Bulk operation failed' }, { status: 500 });
  }
}