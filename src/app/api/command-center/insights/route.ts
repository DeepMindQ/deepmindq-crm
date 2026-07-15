import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

/* ═══════════════════════════════════════════════════
   AI Command Center — Engine Insights
   Returns intelligence across all 3 engines:
   Company Engine, Email Engine, Capability Engine
   ═══════════════════════════════════════════════════ */

export async function GET() {
  try {
    const [companies, contacts, drafts, queueItems, replies, capabilities, sequences, signals] = await Promise.all([
      db.company.findMany({ take: 100, orderBy: { updatedAt: 'desc' } }),
      db.contact.findMany({ take: 200, orderBy: { updatedAt: 'desc' } }),
      db.draft.findMany({ where: { status: 'pending_review' }, take: 50 }),
      db.sendQueue.findMany({ where: { status: 'pending' }, take: 50 }),
      db.reply.findMany({ take: 50, orderBy: { receivedAt: 'desc' } }),
      db.capabilityAsset.findMany({ where: { isActive: true }, take: 100 }),
      db.emailSequence.findMany({ where: { isActive: true } }),
      db.companySignal.findMany({ where: { isRead: false }, take: 20, orderBy: { createdAt: 'desc' } }),
    ]);

    const safe = (arr: any[] | undefined) => Array.isArray(arr) ? arr : [];

    // ── Company Engine Intelligence ──
    const totalCompanies = safe(companies).length;
    const companiesByStatus: Record<string, number> = {};
    const companiesByIndustry: Record<string, number> = {};
    const companiesByLifecycle: Record<string, number> = {};
    const topScoredCompanies = safe(companies)
      .sort((a: any, b: any) => (b.intelligenceScore || 0) - (a.intelligenceScore || 0))
      .slice(0, 5)
      .map((c: any) => ({ id: c.id, name: c.rawName || c.normalizedName, industry: c.industry, score: c.intelligenceScore || 0, status: c.status, lifecycleStage: c.lifecycleStage }));

    safe(companies).forEach((c: any) => {
      companiesByStatus[c.status] = (companiesByStatus[c.status] || 0) + 1;
      if (c.industry) companiesByIndustry[c.industry] = (companiesByIndustry[c.industry] || 0) + 1;
      companiesByLifecycle[c.lifecycleStage] = (companiesByLifecycle[c.lifecycleStage] || 0) + 1;
    });

    const unreadSignals = safe(signals);
    const criticalSignals = unreadSignals.filter((s: any) => s.severity === 'critical' || s.severity === 'high');

    // ── Email Engine Intelligence ──
    const pendingDrafts = safe(drafts).length;
    const pendingQueue = safe(queueItems).length;
    const totalReplies = safe(replies).length;
    const positiveReplies = safe(replies).filter((r: any) => r.category === 'positive').length;
    const replyRate = totalReplies > 0 ? Math.round((positiveReplies / Math.max(safe(contacts).filter((c: any) => c.status === 'sent').length, 1)) * 100) : 0;

    const contactsByStatus: Record<string, number> = {};
    safe(contacts).forEach((c: any) => { contactsByStatus[c.status] = (contactsByStatus[c.status] || 0) + 1; });

    const avgLeadScore = safe(contacts).length > 0
      ? Math.round(safe(contacts).reduce((sum: number, c: any) => sum + (c.leadScore || 0), 0) / safe(contacts).length)
      : 0;

    const highValueLeads = safe(contacts)
      .filter((c: any) => (c.leadScore || 0) >= 70)
      .sort((a: any, b: any) => (b.leadScore || 0) - (a.leadScore || 0))
      .slice(0, 5)
      .map((c: any) => ({ id: c.id, name: c.rawName || c.normalizedName, email: c.email, score: c.leadScore || 0, company: c.companyId, status: c.status }));

    // ── Capability Engine Intelligence ──
    const totalCapabilities = safe(capabilities).length;
    const capabilitiesByCategory: Record<string, number> = {};
    const capabilitiesByServiceLine: Record<string, number> = {};
    const topCapabilities = safe(capabilities)
      .sort((a: any, b: any) => (b.usedInEmails || 0) - (a.usedInEmails || 0))
      .slice(0, 5)
      .map((c: any) => ({ id: c.id, title: c.title, category: c.category, serviceLine: c.serviceLine, usedInEmails: c.usedInEmails || 0, upvotes: c.upvotes || 0 }));

    safe(capabilities).forEach((c: any) => {
      capabilitiesByCategory[c.category] = (capabilitiesByCategory[c.category] || 0) + 1;
      if (c.serviceLine) capabilitiesByServiceLine[c.serviceLine] = (capabilitiesByServiceLine[c.serviceLine] || 0) + 1;
    });

    const activeSequences = safe(sequences).length;

    // ── AI Recommendations ──
    const recommendations: Array<{ type: string; priority: 'high' | 'medium' | 'low'; engine: string; title: string; description: string; action?: string; actionScreen?: string }> = [];

    if (criticalSignals.length > 0) {
      recommendations.push({
        type: 'signal', priority: 'high', engine: 'company',
        title: `${criticalSignals.length} Critical Signals Detected`,
        description: `Act on ${criticalSignals.length} high-severity company signals (funding, leadership changes, tech shifts).`,
        actionScreen: 'companies',
      });
    }

    if (pendingDrafts > 0) {
      recommendations.push({
        type: 'draft', priority: 'high', engine: 'email',
        title: `${pendingDrafts} Drafts Awaiting Review`,
        description: 'AI-generated drafts need your review before sending. Top-scoring drafts should be prioritized.',
        actionScreen: 'drafts',
      });
    }

    if (pendingQueue > 0) {
      recommendations.push({
        type: 'queue', priority: 'medium', engine: 'email',
        title: `${pendingQueue} Emails in Send Queue`,
        description: 'Emails are scheduled for delivery. Monitor for bounces and replies.',
        actionScreen: 'queue',
      });
    }

    if (highValueLeads.length > 0 && highValueLeads[0].status === 'imported') {
      recommendations.push({
        type: 'lead', priority: 'high', engine: 'email',
        title: `${highValueLeads.length} High-Value Leads Not Yet Contacted`,
        description: `Top lead: ${highValueLeads[0].name} (score: ${highValueLeads[0].score}). Generate drafts for these contacts immediately.`,
        actionScreen: 'leads',
      });
    }

    const engagedCompanies = safe(companies).filter((c: any) => c.status === 'engaged' || c.status === 'active');
    if (engagedCompanies.length > 0) {
      recommendations.push({
        type: 'engagement', priority: 'medium', engine: 'company',
        title: `${engagedCompanies.length} Companies Showing Engagement`,
        description: 'These companies have opened or replied to emails. Deepen research and move to next lifecycle stage.',
        actionScreen: 'companies',
      });
    }

    if (totalCapabilities > 0 && totalCapabilities < 10) {
      recommendations.push({
        type: 'capability', priority: 'medium', engine: 'capability',
        title: 'Build Out Capability Library',
        description: `Only ${totalCapabilities} capabilities loaded. Add case studies, proof points, and objection responses to improve email quality.`,
        actionScreen: 'capabilities',
      });
    }

    if (positiveReplies > 0) {
      recommendations.push({
        type: 'reply', priority: 'high', engine: 'email',
        title: `${positiveReplies} Positive Replies to Process`,
        description: 'Positive responses detected. Review and plan follow-up actions for these warm leads.',
        actionScreen: 'replies',
      });
    }

    // Score improvement suggestion
    if (avgLeadScore < 50) {
      recommendations.push({
        type: 'scoring', priority: 'low', engine: 'company',
        title: 'Lead Scores Are Below Average',
        description: `Average lead score is ${avgLeadScore}/100. Consider enriching company data and updating research to improve scoring.`,
        actionScreen: 'companies',
      });
    }

    return NextResponse.json({
      // Company Engine
      companyEngine: {
        totalCompanies,
        companiesByStatus,
        companiesByIndustry,
        companiesByLifecycle,
        topScoredCompanies,
        unreadSignalCount: unreadSignals.length,
        criticalSignalCount: criticalSignals.length,
        latestSignals: unreadSignals.slice(0, 5).map((s: any) => ({ id: s.id, companyId: s.companyId, type: s.signalType, title: s.title, severity: s.severity, createdAt: s.createdAt })),
      },
      // Email Engine
      emailEngine: {
        totalContacts: safe(contacts).length,
        contactsByStatus,
        pendingDrafts,
        pendingQueue,
        totalReplies,
        positiveReplies,
        replyRate,
        avgLeadScore,
        highValueLeads,
        activeSequences,
      },
      // Capability Engine
      capabilityEngine: {
        totalCapabilities,
        capabilitiesByCategory,
        capabilitiesByServiceLine,
        topCapabilities,
      },
      // AI Recommendations
      recommendations: recommendations.sort((a, b) => {
        const p = { high: 0, medium: 1, low: 2 };
        return p[a.priority] - p[b.priority];
      }),
      // Overall Health Score
      healthScore: Math.min(100, Math.round(
        (Math.min(totalCompanies * 2, 20) + // company coverage
         Math.min(avgLeadScore, 25) + // lead quality
         Math.min(replyRate * 2, 20) + // engagement
         Math.min(totalCapabilities, 15) + // capability maturity
         Math.min(pendingDrafts === 0 ? 10 : 0, 10) + // no backlog
         Math.min(criticalSignals.length === 0 ? 10 : 0, 10)) // no critical signals
      )),
    });
  } catch (error) {
    console.error('[Command Center Insights]', error);
    return NextResponse.json({ error: 'Failed to generate insights' }, { status: 500 });
  }
}