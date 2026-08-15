import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkApiAuth } from '@/lib/api-auth';
import { db } from '@/lib/db';

// ── Validation Schema ──────────────────────────────────
const chatPostSchema = z.object({
  message: z.string().min(1).max(2000),
  context: z.string().max(500).optional(),
});

/**
 * POST /api/advisor/chat
 *
 * Accepts a user message and returns a contextual response
 * composed from real intelligence data in the database.
 * Queries recent signals, organizations, and insights to
 * build a grounded answer.
 */
export async function POST(request: NextRequest) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const body = await request.json();
    const parsed = chatPostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { message, context } = parsed.data;

    // ── Gather real intelligence data from the DB ──
    const [recentSignals, topOrganizations, recentRecommendations] = await Promise.all([
      db.signal.findMany({
        where: { status: { in: ['detected', 'validated', 'analyzed'] } },
        orderBy: { detectedAt: 'desc' },
        take: 10,
        include: { organization: { select: { name: true, industry: true } } },
      }),
      db.organization.findMany({
        where: { trackingStatus: 'active' },
        orderBy: { intelligenceScore: 'desc' },
        take: 5,
        select: {
          id: true,
          name: true,
          industry: true,
          intelligenceScore: true,
          lastSignalAt: true,
        },
      }),
      db.insight.findMany({
        where: { category: 'recommendation', status: 'active' },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { organization: { select: { name: true } } },
      }),
    ]);

    // ── Compose a grounded response based on the data ──
    const sources: Array<{ type: string; id: string; title: string }> = [];

    let response = '';

    if (
      recentSignals.length === 0 &&
      topOrganizations.length === 0 &&
      recentRecommendations.length === 0
    ) {
      response =
        "I don't have any intelligence data available yet. " +
        'Start by importing organization data or connecting your CRM to generate signals, insights, and recommendations. ' +
        'Once data flows in, I can provide contextual guidance on your tracked accounts.';
    } else {
      // Build signal summary
      const signalLines = recentSignals.slice(0, 5).map((s) => {
        sources.push({ type: 'signal', id: s.id, title: s.title });
        return `• **${s.organization.name}** — ${s.title} (${s.signalType}, ${s.severity})`;
      });

      // Build recommendation summary
      const recLines = recentRecommendations.slice(0, 3).map((r) => {
        sources.push({ type: 'recommendation', id: r.id, title: r.title });
        return `• **${r.organization.name}**: ${r.recommendation || r.title}`;
      });

      // Build organization summary
      const orgLines = topOrganizations.slice(0, 3).map((o) => {
        sources.push({ type: 'organization', id: o.id, title: o.name });
        return `• **${o.name}** (${o.industry || 'Unknown industry'}) — Intelligence Score: ${o.intelligenceScore ?? 'N/A'}`;
      });

      const sections: string[] = [];

      if (orgLines.length > 0) {
        sections.push(`**Top Tracked Organizations:**\n${orgLines.join('\n')}`);
      }
      if (signalLines.length > 0) {
        sections.push(`**Recent Signals:**\n${signalLines.join('\n')}`);
      }
      if (recLines.length > 0) {
        sections.push(`**Pending Recommendations:**\n${recLines.join('\n')}`);
      }

      response = sections.join('\n\n');

      // Add contextual guidance based on message keywords
      const lowerMessage = message.toLowerCase();
      if (lowerMessage.includes('recommend') || lowerMessage.includes('suggestion')) {
        response +=
          '\n\n💡 **Suggestion:** Review your pending recommendations above and accept or dismiss them to keep your pipeline focused.';
      } else if (lowerMessage.includes('signal') || lowerMessage.includes('alert')) {
        response +=
          '\n\n💡 **Suggestion:** Prioritize critical and high-severity signals first — they often indicate time-sensitive opportunities.';
      } else if (lowerMessage.includes('pipeline') || lowerMessage.includes('deal')) {
        response +=
          '\n\n💡 **Suggestion:** Cross-reference the intelligence scores above with your current pipeline stages to identify accounts ready for outreach.';
      } else {
        response +=
          '\n\n💡 Ask me about specific organizations, signals, or recommendations for more targeted guidance.';
      }

      if (context) {
        response = `*(Context: ${context})*\n\n${response}`;
      }
    }

    return NextResponse.json({
      data: {
        response,
        sources,
      },
    });
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to generate advisor response' }, { status: 500 });
  }
}
