import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import type { ExecutiveBriefData } from '@/lib/intelligence-types';
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';

/** Minimal shape of alignment API response used in brief generation */
interface AlignmentSignal {
  title?: string;
  evidence?: Array<{ source?: string }>;
  category?: string;
  freshness?: { lastEnriched?: string };
  evidenceState?: string;
  businessImpact?: string;
}

interface AlignmentNeed {
  title?: string;
  confidence?: number;
}

interface AlignmentAction {
  title?: string;
  priority?: string;
  confidence?: number;
}

interface AlignmentData {
  executiveUnderstanding?: { narrative?: string; headline?: string };
  needs?: AlignmentNeed[];
  positioning?: { message?: string; targetStakeholders?: unknown[]; topCapabilities?: unknown[] };
  signals?: AlignmentSignal[];
  actions?: AlignmentAction[];
}

/* ═══════════════════════════════════════════════════════════════════════════
   GET /api/companies/[id]/brief — Executive Brief Generator
   
   Produces a one-page account intelligence brief that a salesperson
   can share with their VP. Internal adoption mechanism.
   ═══════════════════════════════════════════════════════════════════════════ */

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

try {
    const { id: companyId } = await params;

    const company = await db.company.findUnique({
      where: { id: companyId },
      include: { researchCard: true, _count: { select: { signals: true, contacts: true } } },
    });

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Fetch alignment data from the composition layer
    let alignmentData: AlignmentData | null = null;
    try {
      const alignRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/companies/${companyId}/alignment`);
      if (alignRes.ok) alignmentData = await alignRes.json();
    } catch { /* proceed with partial data */ }

    const contacts = await db.contact.findMany({
      where: { companyId },
      orderBy: { leadScore: 'desc' },
      take: 5,
    });

    // Build the brief
    const brief: ExecutiveBriefData = {
      companyName: company.rawName,
      industry: company.industry ?? undefined,
      generatedAt: new Date().toISOString(),
      intelligenceScore: company.intelligenceScore ?? 0,

      // Current Situation
      currentSituation: alignmentData?.executiveUnderstanding?.narrative
        || `${company.rawName} is a ${company.industry || 'technology'} company${company.country ? ` based in ${company.country}` : ''}. ${company._count.signals} signals detected, ${company._count.contacts} contacts identified.`,

      // Why Now
      whyNow: alignmentData?.executiveUnderstanding?.headline
        || `${company._count.signals} active intelligence signals indicate business activity.`,

      // Opportunity Areas
      opportunityAreas: alignmentData?.needs?.map((n) => `${n.title} (${n.confidence}%)`).slice(0, 5)
        || ['Enrich account to discover opportunity areas'],

      // Recommended Approach
      recommendedApproach: alignmentData?.positioning?.message
        || 'No specific positioning available. Upload capabilities to enable alignment.',

      // Evidence
      evidence: (alignmentData?.signals?.slice(0, 5).map((s) => ({
        title: s.title || 'Signal',
        source: s.evidence?.[0]?.source || s.category || 'Signal analysis',
        date: s.freshness?.lastEnriched,
        state: s.evidenceState || 'inferred',
      })) || []) as Array<{title: string; source: string; date?: string; state: string}>,

      // Next Actions
      nextActions: (alignmentData?.actions?.slice(0, 5).map((a) => ({
        action: a.title || 'Engage',
        priority: a.priority || 'medium',
        confidence: a.confidence || 50,
      })) || []) as Array<{action: string; priority: string; confidence: number}>,

      // Key Stakeholders
      keyStakeholders: ((alignmentData?.positioning?.targetStakeholders?.slice(0, 4) as Array<{role?: string; reason?: string}>)?.map(s => ({ role: s.role || 'Unknown', reason: s.reason || '' })) || 
        contacts.slice(0, 3).map(c => ({
          role: c.title || c.role || 'Unknown',
          reason: `Lead score: ${c.leadScore}`,
        }))),

      // Top Capabilities
      topCapabilities: (alignmentData?.positioning?.topCapabilities || []) as string[],
    };

    return NextResponse.json(brief);
  } catch (error) {
    logger.error('[brief] Error:', { error: error });
    return NextResponse.json({ error: 'Failed to generate brief' }, { status: 500 });
  }
}
