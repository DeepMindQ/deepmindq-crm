/**
 * M5 WOW #3 — Meeting Intelligence Brief Service
 *
 * The "Prepare me for my meeting with Siemens CIO" experience.
 *
 * Composes existing engines:
 *   - Conversation Engine (833L) — 4 briefing types, buyer profiles
 *   - Executive Intelligence Brief (Phase 2.1) — company overview
 *   - Relationship Mapping (312L) — buyer committee visualization
 *   - Grounding Engine (579L) — evidence collection
 *   - Recommendation Engine (1,086L) — post-meeting actions
 *
 * Adds M5 productization:
 *   - PDF export capability (HTML-to-PDF via browser print)
 *   - One-click brief generation
 *   - Post-meeting intelligence capture
 *   - TRUST metadata on every output
 *   - Share-ready format
 *
 * Design Principle:
 *   The conversation engine already produces excellent briefs.
 *   This service wraps it with enterprise experience features:
 *   export, share, capture, TRUST, and composition.
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { ConversationEngine } from './engines/conversation-engine';
import type { ConversationResult, BriefingType, MeetingType } from './engines/conversation-engine';

import {
  aggregateTrust,
  platformComputedTrust,
  computeTrustScore,
  type TrustMetadata,
} from './intelligence-sources/trust-metadata';

// ─── Types ──────────────────────────────────────────────────────

export interface MeetingBriefRequest {
  companyId: string;
  contactId?: string;
  meetingType?: MeetingType;
  briefingType?: BriefingType;
  additionalContext?: string;
}

export interface MeetingBriefResponse {
  success: boolean;
  brief: MeetingBrief | null;
  error?: string;
  trust: TrustMetadata;
  trustScore: number;
  trustGrade: string;
  durationMs: number;
}

export interface MeetingBrief {
  // From conversation engine
  conversationResult: ConversationResult;

  // Company context (from executive brief)
  companyContext: {
    companyName: string;
    industry: string | null;
    sizeRange: string | null;
    location: string | null;
    domain: string | null;
  };

  // Executive-ready HTML (for PDF export)
  htmlContent: string;

  // Key contacts in buying committee
  buyingCommittee: Array<{
    name: string;
    title: string | null;
    role: string;
    influenceScore: number;
  }>;

  // Post-meeting capture fields
  postMeetingCapture: {
    briefId: string;
    companyId: string;
    contactId: string | null;
    meetingDate: string;
    attendees: string[];
    keyDecisions: string[];
    actionItems: string[];
    followUps: string[];
    intelligenceCaptured: string[];
  };

  // Metadata
  generatedAt: string;
  shareUrl: string | null;
}

// ─── Main Brief Generation ──────────────────────────────────────

export async function generateMeetingBrief(
  request: MeetingBriefRequest
): Promise<MeetingBriefResponse> {
  const startTime = Date.now();

  try {
    // ── Step 1: Generate conversation engine briefing ──
    const conversationResult = await ConversationEngine.brief({
      companyId: request.companyId,
      contactId: request.contactId || undefined,
      briefingType: request.briefingType || 'meeting_prep',
    });

    if (!conversationResult.success) {
      return {
        success: false,
        brief: null,
        error: conversationResult.error || 'Conversation engine failed',
        trust: {
          source: 'ai_inference',
          confidence: 'low',
          freshness: new Date().toISOString(),
          reasoning: `Briefing generation failed: ${conversationResult.error}`,
        },
        trustScore: 0,
        trustGrade: 'F',
        durationMs: Date.now() - startTime,
      };
    }

    // ── Step 2: Fetch company context ──
    const company = await db.company.findUnique({
      where: { id: request.companyId },
      select: {
        rawName: true, industry: true, sizeRange: true,
        location: true, domain: true,
      },
    });

    // ── Step 3: Fetch buying committee ──
    const contacts = await db.contact.findMany({
      where: { companyId: request.companyId },
      select: {
        rawName: true, title: true, role: true,
        leadScore: true, linkedinUrl: true,
      },
      orderBy: { leadScore: 'desc' },
      take: 8,
    });

    const buyingCommittee = contacts.map(c => ({
      name: c.rawName,
      title: c.title,
      role: c.title || c.role || 'Unknown',
      influenceScore: c.leadScore,
    }));

    // ── Step 4: Build HTML content for export ──
    const htmlContent = buildBriefHTML(conversationResult, company, buyingCommittee);

    // ── Step 5: Build post-meeting capture structure ──
    const postMeetingCapture = {
      briefId: `brief_${Date.now()}`,
      companyId: request.companyId,
      contactId: request.contactId || null,
      meetingDate: new Date().toISOString().split('T')[0],
      attendees: buyingCommittee.map(c => c.name),
      keyDecisions: [],
      actionItems: conversationResult.postMeetingActions || [],
      followUps: [],
      intelligenceCaptured: [],
    };

    // ── Step 6: Compute TRUST ──
    const trustItems: TrustMetadata[] = [
      platformComputedTrust(
        'meeting_brief',
        `Meeting brief generated from ${conversationResult.evidenceCount} evidence points across ${conversationResult.signalContext?.length || 0} signals.`,
        conversationResult.evidenceCount,
        conversationResult.confidenceScore >= 70 ? 'high' : conversationResult.confidenceScore >= 40 ? 'medium' : 'low'
      ),
    ];
    const compositeTrust = aggregateTrust(trustItems);
    const trustScore = computeTrustScore(compositeTrust);

    // ── Step 7: Assemble brief ──
    const brief: MeetingBrief = {
      conversationResult,
      companyContext: {
        companyName: company?.rawName || 'Unknown',
        industry: company?.industry || null,
        sizeRange: company?.sizeRange || null,
        location: company?.location || null,
        domain: company?.domain || null,
      },
      htmlContent,
      buyingCommittee,
      postMeetingCapture,
      generatedAt: new Date().toISOString(),
      shareUrl: null, // Share capability to be implemented with share API
    };

    return {
      success: true,
      brief,
      trust: compositeTrust,
      trustScore: trustScore.score,
      trustGrade: trustScore.grade,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('[wow-3] Meeting brief generation failed', { error: msg });

    return {
      success: false,
      brief: null,
      error: msg,
      trust: {
        source: 'ai_inference',
        confidence: 'low',
        freshness: new Date().toISOString(),
        reasoning: `Meeting brief generation failed: ${msg}`,
      },
      trustScore: 0,
      trustGrade: 'F',
      durationMs: Date.now() - startTime,
    };
  }
}

// ─── Post-Meeting Intelligence Capture ──────────────────────────

export async function capturePostMeetingIntelligence(params: {
  briefId: string;
  companyId: string;
  contactId: string | null;
  keyDecisions: string[];
  actionItems: string[];
  followUps: string[];
  intelligenceCaptured: string[];
  meetingQuality: 'excellent' | 'good' | 'fair' | 'poor';
  nextSteps: string;
}): Promise<{ success: boolean; noteId: string | null }> {
  try {
    // Store as a company note (reuses existing note system)
    const noteContent = [
      `## Post-Meeting Intelligence`,
      ``,
      `**Meeting Quality:** ${params.meetingQuality}`,
      ``,
      `### Key Decisions`,
      ...params.keyDecisions.map(d => `- ${d}`),
      ``,
      `### Action Items`,
      ...params.actionItems.map(a => `- ${a}`),
      ``,
      `### Follow-ups`,
      ...params.followUps.map(f => `- ${f}`),
      ``,
      `### Intelligence Captured`,
      ...params.intelligenceCaptured.map(i => `- ${i}`),
      ``,
      `### Next Steps`,
      params.nextSteps,
    ].join('\n');

    const note = await db.companyNote.create({
      data: {
        companyId: params.companyId,
        title: `Meeting Debrief — ${new Date().toLocaleDateString()}`,
        category: 'meeting',
        body: noteContent,
        author: 'system',
      },
    });

    logger.info('[wow-3] Post-meeting intelligence captured', {
      briefId: params.briefId,
      companyId: params.companyId,
      noteId: note.id,
      decisionsCount: params.keyDecisions.length,
    });

    return { success: true, noteId: note.id };
  } catch (error) {
    logger.error('[wow-3] Failed to capture post-meeting intelligence', { error });
    return { success: false, noteId: null };
  }
}

// ─── HTML Brief Builder ──────────────────────────────────────────

function buildBriefHTML(
  result: ConversationResult,
  company: any,
  buyingCommittee: MeetingBrief['buyingCommittee']
): string {
  const sections: string[] = [];

  // Header
  sections.push(`
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 0 auto; padding: 40px;">
      <h1 style="color: #1a1a2e; border-bottom: 3px solid #4361ee; padding-bottom: 12px;">
        Meeting Brief: ${company?.rawName || result.companyName}
      </h1>
      <p style="color: #666; font-size: 14px;">
        Generated: ${new Date(result.generatedAt).toLocaleString()} |
        Confidence: ${result.confidenceScore}% |
        Evidence: ${result.evidenceCount} sources
      </p>
  `);

  // Meeting Objective
  sections.push(`
    <h2 style="color: #4361ee; margin-top: 32px;">Meeting Objective</h2>
    <p style="font-size: 16px; line-height: 1.6;">${result.meetingObjective}</p>
  `);

  // Company Context
  if (result.companyContext) {
    sections.push(`
      <h2 style="color: #4361ee; margin-top: 32px;">Company Context</h2>
      <p style="font-size: 16px; line-height: 1.6;">${result.companyContext}</p>
    `);
  }

  // Buyer Profile
  sections.push(`
    <h2 style="color: #4361ee; margin-top: 32px;">Buyer Profile</h2>
    <div style="background: #f8f9fa; padding: 16px; border-radius: 8px;">
      <p><strong>${result.buyerProfile.name}</strong> — ${result.buyerProfile.role}</p>
      <p>Seniority: ${result.buyerProfile.seniority.replace('_', ' ')} | Influence: ${result.buyerProfile.influenceScore}/100</p>
      <p>Relationship: ${result.buyerProfile.relationshipStrength} | Style: ${result.buyerProfile.communicationStyle}</p>
      ${result.buyerProfile.detectedPriorities.length > 0 ? `<p>Priorities: ${result.buyerProfile.detectedPriorities.join(', ')}</p>` : ''}
    </div>
  `);

  // Talking Points
  if (result.talkingPoints.length > 0) {
    const pointsHtml = result.talkingPoints.map(tp => `
      <li style="margin-bottom: 8px;">
        <strong>${tp.priority === 'must_cover' ? '🔴' : tp.priority === 'should_cover' ? '🟡' : '🟢'} ${tp.point}</strong>
        <br><span style="color: #666; font-size: 13px;">Evidence: ${tp.evidence} (${tp.source})</span>
      </li>
    `).join('');

    sections.push(`
      <h2 style="color: #4361ee; margin-top: 32px;">Talking Points</h2>
      <ul style="font-size: 15px; line-height: 1.6;">${pointsHtml}</ul>
    `);
  }

  // Questions to Ask
  if (result.questionsToAsk.length > 0) {
    const questionsHtml = result.questionsToAsk.map(q => `
      <li style="margin-bottom: 8px;">
        <strong>"${q.question}"</strong>
        <br><span style="color: #666; font-size: 13px;">Purpose: ${q.purpose} | Timing: ${q.timing}</span>
      </li>
    `).join('');

    sections.push(`
      <h2 style="color: #4361ee; margin-top: 32px;">Questions to Ask</h2>
      <ul style="font-size: 15px; line-height: 1.6;">${questionsHtml}</ul>
    `);
  }

  // Recommended Positioning
  if (result.recommendedPositioning) {
    sections.push(`
      <h2 style="color: #4361ee; margin-top: 32px;">Recommended Positioning</h2>
      <p style="font-size: 16px; line-height: 1.6;">${result.recommendedPositioning}</p>
    ${result.valuePropositionAngle ? `<p style="font-size: 15px; color: #444;">Value Angle: ${result.valuePropositionAngle}</p>` : ''}
    `);
  }

  // Post-Meeting Actions
  if (result.postMeetingActions.length > 0) {
    const actionsHtml = result.postMeetingActions.map(a => `<li>${a}</li>`).join('');
    sections.push(`
      <h2 style="color: #4361ee; margin-top: 32px;">Post-Meeting Actions</h2>
      <ul style="font-size: 15px;">${actionsHtml}</ul>
    `);
  }

  // Buying Committee
  if (buyingCommittee.length > 0) {
    const committeeHtml = buyingCommittee.map(c => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${c.name}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${c.title}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${c.influenceScore}/100</td>
      </tr>
    `).join('');

    sections.push(`
      <h2 style="color: #4361ee; margin-top: 32px;">Buying Committee</h2>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <thead>
          <tr style="background: #f8f9fa;">
            <th style="text-align: left; padding: 8px;">Name</th>
            <th style="text-align: left; padding: 8px;">Title</th>
            <th style="text-align: left; padding: 8px;">Influence</th>
          </tr>
        </thead>
        <tbody>${committeeHtml}</tbody>
      </table>
    `);
  }

  // TRUST Footer
  sections.push(`
    <div style="margin-top: 48px; padding-top: 16px; border-top: 1px solid #ddd; font-size: 12px; color: #888;">
      <p>DeepMindQ Enterprise Intelligence Platform — Confidential</p>
      <p>Evidence: ${result.evidenceCount} sources | Confidence: ${result.confidenceScore}% | Model: ${result.modelUsed}</p>
    </div>
    </div>
  `);

  // Wrap in HTML document
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Meeting Brief — ${company?.rawName || result.companyName}</title>
      <style>
        @media print {
          body { margin: 0; padding: 0; }
          div { max-width: 100% !important; }
        }
      </style>
    </head>
    <body style="background: white; color: #333;">
      ${sections.join('\n')}
    </body>
    </html>
  `;
}
