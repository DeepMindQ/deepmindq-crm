/**
 * M5 WOW #1 — Executive Intelligence Brief API
 *
 * POST /api/intelligence/executive-brief
 *
 * The primary enterprise demonstration endpoint.
 * Input:  { companyId: string } or { companyName: string }
 * Output: Complete executive intelligence briefing
 *
 * This is the "Analyze Microsoft" experience.
 * Target: <60 seconds response time.
 *
 * Every output carries TRUST metadata.
 * The brief is structured for executive consumption,
 * not JSON API consumption.
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';
import { generateExecutiveBrief } from '@/lib/executive-intelligence-brief';

export async function POST(request: Request) {
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  try {
    const body = await request.json();
    const { companyId, companyName } = body as {
      companyId?: string;
      companyName?: string;
    };

    if (!companyId && !companyName) {
      return NextResponse.json(
        { error: 'Either companyId or companyName is required' },
        { status: 400 }
      );
    }

    // Resolve company
    let resolvedCompanyId = companyId;

    if (!resolvedCompanyId && companyName) {
      // Try exact name match first, then normalized
      const normalizedName = companyName.toLowerCase().trim();
      const company = await db.company.findFirst({
        where: {
          OR: [
            { normalizedName },
            { rawName: { equals: companyName } },
          ],
        },
        select: { id: true },
      });

      if (!company) {
        return NextResponse.json(
          { error: `Company "${companyName}" not found in the database` },
          { status: 404 }
        );
      }

      resolvedCompanyId = company.id;
    }

    // Generate the executive brief
    const brief = await generateExecutiveBrief(resolvedCompanyId!);

    logger.info('[wow-1] Executive brief generated', {
      companyId: resolvedCompanyId,
      companyName: brief.meta.companyName,
      durationMs: brief.meta.durationMs,
      trustGrade: brief.meta.trustGrade,
      signalCount: brief.marketSignals.signals.length,
      contactCount: brief.contactIntelligence.totalContacts,
    });

    return NextResponse.json({
      success: true,
      brief,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('[wow-1] Executive brief generation failed', { error: msg });
    return NextResponse.json(
      { error: 'Failed to generate executive brief', details: msg },
      { status: 500 }
    );
  }
}
