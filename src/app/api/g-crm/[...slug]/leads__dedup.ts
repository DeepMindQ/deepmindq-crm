import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

/* ═══════════════════════════════════════════════════
   L-06: Lead Deduplication & Merge
   
   GET:  Find potential duplicate groups
   POST: Merge leads
   ═══════════════════════════════════════════════════ */

/* ── Jaccard similarity for strings ── */
function jaccard(a: string, b: string): number {
  const setA = new Set(a.toLowerCase().split(/[\s,.\-]+/).filter(Boolean));
  const setB = new Set(b.toLowerCase().split(/[\s,.\-]+/).filter(Boolean));
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const w of setA) {
    if (setB.has(w)) intersection++;
  }
  return intersection / (setA.size + setB.size - intersection);
}

/* ── GET: Find Duplicates ── */
export async function GET() {
  try {
    const groups: { contacts: any[]; matchType: string }[] = [];

    // Phase 1: Find exact email duplicates via groupBy (efficient DB-level)
    const emailGroups = await db.contact.groupBy({
      by: ['email'],
      where: {
        email: { not: '' },
        status: { not: 'duplicate' },
      },
      having: {
        email: { _count: { gt: 1 } },
      },
    });

    for (const group of emailGroups) {
      const contacts = await db.contact.findMany({
        where: { email: group.email, status: { not: 'duplicate' } },
        include: { company: { select: { id: true, rawName: true, domain: true } } },
      });
      if (contacts.length > 1) {
        groups.push({ contacts: contacts as any[], matchType: 'exact' });
      }
    }

    // Phase 2: Fuzzy name+company matches (limited scan to avoid O(n²))
    const recentContacts = await db.contact.findMany({
      where: { status: { not: 'duplicate' } },
      include: { company: { select: { id: true, rawName: true, domain: true } } },
      orderBy: { createdAt: 'desc' },
      take: 500, // Limit scan to recent 500 contacts
    });

    const processed = new Set<string>();
    for (const group of groups) {
      for (const c of group.contacts) processed.add(c.id);
    }

    for (const contact of recentContacts as any[]) {
      if (processed.has(contact.id)) continue;

      const duplicates: any[] = [];
      const name = contact.rawName?.toLowerCase() || '';
      const companyId = contact.companyId;
      const domain = contact.email?.split('@')[1]?.toLowerCase() || '';

      for (const other of recentContacts as any[]) {
        if (other.id === contact.id || processed.has(other.id)) continue;

        const otherName = other.rawName?.toLowerCase() || '';
        const otherDomain = other.email?.split('@')[1]?.toLowerCase() || '';

        // Similar name + same company (likely)
        if (companyId === other.companyId && jaccard(name, otherName) >= 0.7) {
          duplicates.push(other);
          continue;
        }

        // Same domain + similar name (possible)
        if (domain && domain === otherDomain && domain !== '' && jaccard(name, otherName) >= 0.7) {
          duplicates.push(other);
        }
      }

      if (duplicates.length > 0) {
        const hasSameCompany = duplicates.some((d: any) => d.companyId === companyId);
        groups.push({
          contacts: [contact, ...duplicates],
          matchType: hasSameCompany ? 'likely' : 'possible',
        });

        for (const d of duplicates) processed.add(d.id);
        processed.add(contact.id);
      }
    }

    return NextResponse.json({ groups, total: groups.length });
  } catch (error) {
    console.error('Dedup scan error:', error);
    return NextResponse.json({ error: 'Failed to find duplicates' }, { status: 500 });
  }
}

/* ── POST: Merge Leads ── */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { primaryId, secondaryIds, fieldOverrides } = body as {
      primaryId: string;
      secondaryIds: string[];
      fieldOverrides?: Record<string, string>;
    };

    if (!primaryId || !secondaryIds?.length) {
      return NextResponse.json({ error: 'primaryId and secondaryIds required' }, { status: 400 });
    }

    const primary = await db.contact.findUnique({ where: { id: primaryId } });
    if (!primary) {
      return NextResponse.json({ error: 'Primary contact not found' }, { status: 404 });
    }

    const secondaries = await db.contact.findMany({
      where: { id: { in: secondaryIds } },
      include: { drafts: { select: { id: true } }, replies: { select: { id: true } } },
    });

    let mergedCount = 0;

    for (const secondary of secondaries) {
      if (secondary.status === 'duplicate') continue;

      // Merge data: fill empty fields on primary from secondary
      const updateData: any = {};
      const fieldsToMerge = ['title', 'role', 'phone', 'linkedinUrl', 'location', 'editedName'];
      for (const field of fieldsToMerge) {
        const pVal = (primary as any)[field];
        const sVal = (secondary as any)[field];
        if (!pVal && sVal) {
          const override = fieldOverrides?.[field];
          if (override === 'keep_secondary' || !override) {
            updateData[field] = sVal;
          }
        }
      }

      // Batch move drafts from secondary to primary
      const draftIds = secondary.drafts.map(d => d.id);
      if (draftIds.length > 0) {
        await db.draft.updateMany({
          where: { id: { in: draftIds } },
          data: { contactId: primaryId },
        });
      }

      // Batch move replies from secondary to primary
      const replyIds = secondary.replies.map(r => r.id);
      if (replyIds.length > 0) {
        await db.reply.updateMany({
          where: { id: { in: replyIds } },
          data: { contactId: primaryId },
        });
      }

      // Mark secondary as duplicate
      await db.contact.update({
        where: { id: secondary.id },
        data: {
          status: 'duplicate',
          suppressionReason: `Merged into ${primaryId}`,
        },
      });

      // Update primary with merged fields
      if (Object.keys(updateData).length > 0) {
        await db.contact.update({
          where: { id: primaryId },
          data: updateData,
        });
      }

      mergedCount++;
    }

    // Return updated primary
    const updated = await db.contact.findUnique({
      where: { id: primaryId },
      include: { company: { select: { rawName: true, industry: true } } },
    });

    return NextResponse.json({
      success: true,
      mergedCount,
      primary: updated,
    });
  } catch (error) {
    console.error('Merge error:', error);
    return NextResponse.json({ error: 'Merge failed' }, { status: 500 });
  }
}