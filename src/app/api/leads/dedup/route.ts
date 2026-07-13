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
    const contacts = await db.contact.findMany({
      include: {
        company: { select: { id: true, rawName: true, domain: true } },
      },
    });

    const groups: { contacts: any[]; matchType: string }[] = [];
    const processed = new Set<string>();

    for (const contact of contacts as any[]) {
      if (processed.has(contact.id)) continue;

      // Skip already-duplicated contacts
      if (contact.status === 'duplicate') {
        processed.add(contact.id);
        continue;
      }

      const duplicates: any[] = [];
      const email = contact.email?.toLowerCase() || '';
      const name = contact.rawName?.toLowerCase() || '';
      const companyId = contact.companyId;
      const domain = email.split('@')[1] || '';

      for (const other of contacts as any[]) {
        if (other.id === contact.id || processed.has(other.id)) continue;
        if (other.status === 'duplicate') continue;

        const otherEmail = other.email?.toLowerCase() || '';
        const otherName = other.rawName?.toLowerCase() || '';
        const otherDomain = otherEmail.split('@')[1] || '';

        // Exact email match
        if (email && email === otherEmail) {
          duplicates.push(other);
          continue;
        }

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
        // Determine match type
        let matchType = 'possible';
        const hasExact = duplicates.some((d: any) => d.email?.toLowerCase() === email);
        if (hasExact) matchType = 'exact';
        else if (duplicates.some((d: any) => d.companyId === companyId)) matchType = 'likely';

        groups.push({
          contacts: [contact, ...duplicates],
          matchType,
        });

        for (const d of duplicates) {
          processed.add(d.id);
        }
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

    let mergedCount = 0;

    for (const secId of secondaryIds) {
      const secondary = await db.contact.findUnique({
        where: { id: secId },
        include: { drafts: true, replies: true },
      });

      if (!secondary || secondary.status === 'duplicate') continue;

      // Merge data: fill empty fields on primary from secondary
      const updateData: any = {};
      const fieldsToMerge = ['title', 'role', 'phone', 'linkedinUrl', 'location', 'editedName'];
      for (const field of fieldsToMerge) {
        const pVal = (primary as any)[field];
        const sVal = (secondary as any)[field];
        if (!pVal && sVal) {
          // Check field overrides
          const override = fieldOverrides?.[field];
          if (override === 'keep_secondary' || !override) {
            updateData[field] = sVal;
          }
        }
      }

      // Move drafts from secondary to primary
      for (const draft of (secondary.drafts || []) as any[]) {
        await db.draft.update({
          where: { id: draft.id },
          data: { contactId: primaryId },
        });
      }

      // Move replies from secondary to primary
      for (const reply of (secondary.replies || []) as any[]) {
        await db.reply.update({
          where: { id: reply.id },
          data: { contactId: primaryId },
        });
      }

      // Mark secondary as duplicate
      await db.contact.update({
        where: { id: secId },
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