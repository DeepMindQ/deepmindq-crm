import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    // ── Counts (actual totals, not limited) ──
    const [
      totalCompanies,
      totalContacts,
      companies,
      contacts,
      drafts,
      queueItems,
      replies,
      capabilities,
      sequences,
      signals,
      contactsByStatusRaw,
      companiesByIndustryRaw,
      companiesByStatusRaw,
      companiesByLifecycleRaw,
      capsByCategoryRaw,
      capsByServiceLineRaw,
    ] = await Promise.all([
      db.company.count(),
      db.contact.count(),
      db.company.findMany({ take: 50, orderBy: { intelligenceScore: 'desc' } }),
      db.contact.findMany({ take: 100, orderBy: { leadScore: 'desc' } }),
      db.draft.findMany({ where: { status: 'pending_review' } }),
      db.sendQueue.findMany({ where: { status: 'pending' } }),
      db.reply.findMany({ take: 50, orderBy: { receivedAt: 'desc' } }),
      db.capabilityAsset.findMany({ where: { isActive: true } }),
      db.emailSequence.findMany({ where: { isActive: true } }),
      db.companySignal.findMany({ where: { isRead: false }, take: 20, orderBy: { createdAt: 'desc' } }),
      db.contact.groupBy({ by: ['status'], _count: true }),
      db.company.groupBy({ by: ['industry'], where: { industry: { not: null } }, _count: true, orderBy: { _count: { industry: 'desc' } }, take: 12 }),
      db.company.groupBy({ by: ['status'], _count: true }),
      db.company.groupBy({ by: ['lifecycleStage'], _count: true }),
      db.capabilityAsset.groupBy({ by: ['category'], where: { isActive: true }, _count: true }),
      db.capabilityAsset.groupBy({ by: ['serviceLine'], where: { isActive: true, serviceLine: { not: null } }, _count: true }),
    ]);

    const safe = (arr: any[] | undefined) => Array.isArray(arr) ? arr : [];

    // ── Company Engine ──
    const companiesByStatus: Record<string, number> = {};
    companiesByStatusRaw.forEach((r: any) => { companiesByStatus[r.status] = r._count; });

    const companiesByIndustry: Record<string, number> = {};
    companiesByIndustryRaw.forEach((r: any) => { companiesByIndustry[r.industry] = r._count; });

    const companiesByLifecycle: Record<string, number> = {};
    companiesByLifecycleRaw.forEach((r: any) => { companiesByLifecycle[r.lifecycleStage] = r._count; });

    const topScoredCompanies = safe(companies).slice(0, 5).map((c: any) => ({
      id: c.id, name: c.rawName || c.normalizedName, industry: c.industry,
      score: c.intelligenceScore || 0, status: c.status, lifecycleStage: c.lifecycleStage,
    }));

    const unreadSignals = safe(signals);
    const criticalSignals = unreadSignals.filter((s: any) => s.severity === 'critical' || s.severity === 'high');

    // ── Email Engine ──
    const pendingDrafts = drafts.length;
    const pendingQueue = queueItems.length;
    const totalReplies = replies.length;
    const positiveReplies = replies.filter((r: any) => r.category === 'positive').length;
    const sentCount = contactsByStatusRaw.find((r: any) => r.status === 'sent')?._count || 0;
    const replyRate = sentCount > 0 ? Math.round((positiveReplies / sentCount) * 100) : 0;

    const contactsByStatus: Record<string, number> = {};
    contactsByStatusRaw.forEach((r: any) => { contactsByStatus[r.status] = r._count; });

    const avgLeadScore = totalContacts > 0
      ? Math.round(safe(contacts).reduce((sum: number, c: any) => sum + (c.leadScore || 0), 0) / safe(contacts).length)
      : 0;

    const highValueLeads = safe(contacts).filter((c: any) => (c.leadScore || 0) >= 70).slice(0, 5).map((c: any) => ({
      id: c.id, name: c.rawName, email: c.email, score: c.leadScore, company: c.companyId, status: c.status,
    }));

    // ── Capability Engine ──
    const totalCapabilities = capabilities.length;
    const capabilitiesByCategory: Record<string, number> = {};
    capsByCategoryRaw.forEach((r: any) => { capabilitiesByCategory[r.category] = r._count; });

    const capabilitiesByServiceLine: Record<string, number> = {};
    capsByServiceLineRaw.forEach((r: any) => { capabilitiesByServiceLine[r.serviceLine] = r._count; });

    const topCapabilities = safe(capabilities).sort((a: any, b: any) => (b.usedInEmails || 0) - (a.usedInEmails || 0)).slice(0, 5).map((c: any) => ({
      id: c.id, title: c.title, category: c.category, serviceLine: c.serviceLine,
      usedInEmails: c.usedInEmails || 0, upvotes: c.upvotes || 0,
    }));

    const activeSequences = sequences.length;

    // ── Recommendations ──
    const recommendations: Array<{ type: string; priority: 'high' | 'medium' | 'low'; engine: string; title: string; description: string; actionScreen?: string }> = [];

    if (criticalSignals.length > 0)
      recommendations.push({ type: 'signal', priority: 'high', engine: 'company', title: `${criticalSignals.length} Critical Signals Detected`, description: `Act on ${criticalSignals.length} high-severity company signals (funding, leadership changes, tech shifts).`, actionScreen: 'companies' });
    if (pendingDrafts > 10)
      recommendations.push({ type: 'draft', priority: 'high', engine: 'email', title: `${pendingDrafts} Drafts Awaiting Review`, description: 'AI-generated drafts need your review before sending. Prioritize top-scoring drafts.', actionScreen: 'drafts' });
    if (pendingQueue > 0)
      recommendations.push({ type: 'queue', priority: 'medium', engine: 'email', title: `${pendingQueue} Emails in Send Queue`, description: 'Emails are scheduled for delivery. Monitor for bounces and replies.', actionScreen: 'queue' });
    if (highValueLeads.length > 0)
      recommendations.push({ type: 'lead', priority: 'high', engine: 'email', title: `${highValueLeads.length} High-Value Leads Ready for Outreach`, description: `Top lead: ${highValueLeads[0].name} (score: ${highValueLeads[0].score}). Generate drafts for these contacts.`, actionScreen: 'leads' });
    if (positiveReplies > 0)
      recommendations.push({ type: 'reply', priority: 'high', engine: 'email', title: `${positiveReplies} Positive Replies to Process`, description: 'Positive responses detected. Review and plan follow-up actions for warm leads.', actionScreen: 'replies' });
    if (totalCapabilities < 15)
      recommendations.push({ type: 'capability', priority: 'medium', engine: 'capability', title: 'Build Out Capability Library', description: `Only ${totalCapabilities} capabilities. Add case studies, proof points, and objection responses to improve email quality.`, actionScreen: 'capabilities' });
    if (avgLeadScore < 50)
      recommendations.push({ type: 'scoring', priority: 'low', engine: 'company', title: 'Lead Scores Below Average', description: `Average lead score is ${avgLeadScore}/100. Enrich company data to improve scoring.`, actionScreen: 'companies' });

    // ── Health Score ──
    const healthScore = Math.min(100, Math.round(
      Math.min(totalCompanies / 500, 20) +
      Math.min(avgLeadScore / 5, 25) +
      Math.min(replyRate * 2, 20) +
      Math.min(totalCapabilities / 1, 15) +
      (pendingDrafts === 0 ? 10 : Math.max(10 - pendingDrafts / 50, 0)) +
      (criticalSignals.length === 0 ? 10 : Math.max(10 - criticalSignals.length, 0))
    ));

    return NextResponse.json({
      companyEngine: { totalCompanies, companiesByStatus, companiesByIndustry, companiesByLifecycle, topScoredCompanies, unreadSignalCount: unreadSignals.length, criticalSignalCount: criticalSignals.length, latestSignals: unreadSignals.slice(0, 5).map((s: any) => ({ id: s.id, companyId: s.companyId, type: s.signalType, title: s.title, severity: s.severity, createdAt: s.createdAt })) },
      emailEngine: { totalContacts, contactsByStatus, pendingDrafts, pendingQueue, totalReplies, positiveReplies, replyRate, avgLeadScore, highValueLeads, activeSequences },
      capabilityEngine: { totalCapabilities, capabilitiesByCategory, capabilitiesByServiceLine, topCapabilities },
      recommendations: recommendations.sort((a, b) => ({ high: 0, medium: 1, low: 2 } as any)[a.priority] - ({ high: 0, medium: 1, low: 2 } as any)[b.priority]),
      healthScore,
    });
  } catch (error) {
    console.error('[Command Center Insights]', error);
    return NextResponse.json({ error: 'Failed to generate insights' }, { status: 500 });
  }
}