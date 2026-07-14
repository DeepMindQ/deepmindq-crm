import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/* ═══════════════════════════════════════════════════
   AI Command Center — Natural Language Query
   Einstein-style: "Show me high-value companies in fintech"
   "Which leads haven't been contacted yet?"
   "What capabilities match enterprise healthcare?"
   ═══════════════════════════════════════════════════ */

interface QueryResult {
  query: string;
  interpretation: string;
  engine: 'company' | 'email' | 'capability' | 'general';
  data: any;
  summary: string;
}

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();
    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const q = query.toLowerCase();
    let result: QueryResult;

    // ── Company Engine Queries ──
    if (q.includes('compan') && (q.includes('high') || q.includes('score') || q.includes('top') || q.includes('best'))) {
      const companies = await db.company.findMany({ take: 50, orderBy: { intelligenceScore: 'desc' } });
      const safe = Array.isArray(companies) ? companies : [];
      const filtered = safe.filter((c: any) => (c.intelligenceScore || 0) >= 50).slice(0, 10);
      result = {
        query, interpretation: `Finding highest-scoring companies`,
        engine: 'company',
        data: filtered.map((c: any) => ({ id: c.id, name: c.rawName || c.normalizedName, industry: c.industry, score: c.intelligenceScore || 0, status: c.status, location: c.location })),
        summary: `Found ${filtered.length} high-score companies (score >= 50). ${filtered.length > 0 ? `Top: ${filtered[0]?.name} (${filtered[0]?.score})` : 'No companies meet the threshold yet.'}`,
      };
    } else if (q.includes('compan') && (q.includes('signal') || q.includes('alert') || q.includes('news') || q.includes('trigger'))) {
      const signals = await db.companySignal.findMany({ take: 20, orderBy: { createdAt: 'desc' } });
      const safe = Array.isArray(signals) ? signals : [];
      result = {
        query, interpretation: `Fetching recent company signals and alerts`,
        engine: 'company',
        data: safe.map((s: any) => ({ id: s.id, type: s.signalType, title: s.title, severity: s.severity, source: s.source, createdAt: s.createdAt })),
        summary: `${safe.length} recent signals found. ${safe.filter((s: any) => s.severity === 'high' || s.severity === 'critical').length} are high/critical priority.`,
      };
    } else if (q.includes('compan') && (q.includes('industr') || q.includes('sector') || q.includes('vertical'))) {
      const companies = await db.company.findMany({ take: 100 });
      const safe = Array.isArray(companies) ? companies : [];
      const byIndustry: Record<string, any[]> = {};
      safe.forEach((c: any) => {
        const ind = c.industry || 'Unknown';
        if (!byIndustry[ind]) byIndustry[ind] = [];
        byIndustry[ind].push({ id: c.id, name: c.rawName || c.normalizedName, score: c.intelligenceScore || 0, status: c.status });
      });
      const industryBreakdown = Object.entries(byIndustry).map(([industry, comps]) => ({
        industry, count: comps.length, avgScore: Math.round(comps.reduce((s: number, c: any) => s + c.score, 0) / comps.length), topCompany: comps.sort((a: any, b: any) => b.score - a.score)[0]?.name,
      }));
      result = {
        query, interpretation: `Breaking down companies by industry/sector`,
        engine: 'company',
        data: industryBreakdown,
        summary: `${safe.length} companies across ${industryBreakdown.length} industries. ${industryBreakdown.length > 0 ? `Largest sector: ${industryBreakdown.sort((a, b) => b.count - a.count)[0]?.industry} (${industryBreakdown.sort((a, b) => b.count - a.count)[0]?.count} companies)` : 'No data.'}`,
      };
    } else if (q.includes('compan') && (q.includes('engaged') || q.includes('active') || q.includes('warm') || q.includes('hot'))) {
      const companies = await db.company.findMany({ take: 50 });
      const safe = Array.isArray(companies) ? companies : [];
      const engaged = safe.filter((c: any) => c.status === 'engaged' || c.status === 'active');
      result = {
        query, interpretation: `Finding engaged and active companies`,
        engine: 'company',
        data: engaged.map((c: any) => ({ id: c.id, name: c.rawName || c.normalizedName, status: c.status, score: c.intelligenceScore || 0, engagementScore: c.engagementScore || 0, industry: c.industry })),
        summary: `${engaged.length} engaged/active companies out of ${safe.length} total. These are your warmest prospects.`,
      };

    // ── Email Engine Queries ──
    } else if (q.includes('draft') || q.includes('pending') || q.includes('review')) {
      const drafts = await db.draft.findMany({ take: 30, orderBy: { createdAt: 'desc' } });
      const safe = Array.isArray(drafts) ? drafts : [];
      const pending = safe.filter((d: any) => d.status === 'pending_review');
      result = {
        query, interpretation: `Checking email draft status`,
        engine: 'email',
        data: pending.slice(0, 10).map((d: any) => ({ id: d.id, subject: d.subject, confidence: d.confidenceScore, status: d.status, createdAt: d.createdAt })),
        summary: `${pending.length} drafts pending review out of ${safe.length} total. ${pending.filter((d: any) => (d.confidenceScore || 0) >= 80).length} have high confidence scores (>= 80).`,
      };
    } else if (q.includes('reply') || q.includes('response') || q.includes('replied')) {
      const replies = await db.reply.findMany({ take: 30, orderBy: { receivedAt: 'desc' } });
      const safe = Array.isArray(replies) ? replies : [];
      result = {
        query, interpretation: `Analyzing email replies`,
        engine: 'email',
        data: safe.slice(0, 10).map((r: any) => ({ id: r.id, contactId: r.contactId, category: r.category, subject: r.subject, receivedAt: r.receivedAt })),
        summary: `${safe.length} replies found. ${safe.filter((r: any) => r.category === 'positive').length} positive, ${safe.filter((r: any) => r.category === 'negative').length} negative, ${safe.filter((r: any) => r.category === 'out_of_office').length} out-of-office.`,
      };
    } else if (q.includes('bounce') || q.includes('deliver') || q.includes('fail')) {
      const bounces = await db.bounce.findMany({ take: 20, orderBy: { bouncedAt: 'desc' } });
      const safe = Array.isArray(bounces) ? bounces : [];
      result = {
        query, interpretation: `Checking email delivery and bounces`,
        engine: 'email',
        data: safe.slice(0, 10).map((b: any) => ({ id: b.id, contactId: b.contactId, type: b.bounceType, reason: b.reason, bouncedAt: b.bouncedAt })),
        summary: `${safe.length} bounces found. ${safe.filter((b: any) => b.bounceType === 'hard').length} hard bounces (remove these contacts), ${safe.filter((b: any) => b.bounceType === 'soft').length} soft bounces (may retry).`,
      };
    } else if (q.includes('lead') && (q.includes('not') || q.includes('uncontacted') || q.includes('never') || q.includes('yet'))) {
      const contacts = await db.contact.findMany({ take: 200 });
      const safe = Array.isArray(contacts) ? contacts : [];
      const uncontacted = safe.filter((c: any) => c.status === 'imported' || c.status === 'cleaned');
      const sorted = uncontacted.sort((a: any, b: any) => (b.leadScore || 0) - (a.leadScore || 0)).slice(0, 10);
      result = {
        query, interpretation: `Finding leads that haven't been contacted yet`,
        engine: 'email',
        data: sorted.map((c: any) => ({ id: c.id, name: c.rawName || c.normalizedName, email: c.email, score: c.leadScore || 0, company: c.companyId })),
        summary: `${uncontacted.length} leads not yet contacted. Top priority: ${sorted[0]?.name} (score: ${sorted[0]?.leadScore || 0}).`,
      };

    // ── Capability Engine Queries ──
    } else if (q.includes('capabil') && (q.includes('match') || q.includes('suggest') || q.includes('recommend'))) {
      const capabilities = await db.capabilityAsset.findMany({ where: { isActive: true }, take: 50 });
      const safe = Array.isArray(capabilities) ? capabilities : [];
      result = {
        query, interpretation: `Finding best-matching capabilities`,
        engine: 'capability',
        data: safe.sort((a: any, b: any) => (b.upvotes || 0) - (a.upvotes || 0)).slice(0, 10).map((c: any) => ({ id: c.id, title: c.title, category: c.category, serviceLine: c.serviceLine, upvotes: c.upvotes || 0, usedInEmails: c.usedInEmails || 0 })),
        summary: `${safe.length} active capabilities. Top recommended: ${safe[0]?.title} (${safe[0]?.usedInEmails || 0} uses, ${safe[0]?.upvotes || 0} upvotes).`,
      };
    } else if (q.includes('case stud') || q.includes('proof point') || q.includes('evidence')) {
      const capabilities = await db.capabilityAsset.findMany({ where: { isActive: true }, take: 100 });
      const safe = Array.isArray(capabilities) ? capabilities : [];
      const caseStudies = safe.filter((c: any) => c.category === 'case_study');
      const proofPoints = safe.filter((c: any) => c.category === 'proof_point');
      result = {
        query, interpretation: `Finding case studies and proof points`,
        engine: 'capability',
        data: [...caseStudies, ...proofPoints].slice(0, 10).map((c: any) => ({ id: c.id, title: c.title, category: c.category, serviceLine: c.serviceLine, summary: c.summary })),
        summary: `${caseStudies.length} case studies, ${proofPoints.length} proof points available.`,
      };

    // ── General / Fallback ──
    } else {
      // Smart summary for any other query
      const [companies, contacts, drafts, replies] = await Promise.all([
        db.company.findMany({ take: 20 }),
        db.contact.findMany({ take: 50 }),
        db.draft.findMany({ where: { status: 'pending_review' }, take: 10 }),
        db.reply.findMany({ take: 10 }),
      ]);
      const c = Array.isArray(companies) ? companies : [];
      const co = Array.isArray(contacts) ? contacts : [];
      const dr = Array.isArray(drafts) ? drafts : [];
      const re = Array.isArray(replies) ? replies : [];

      result = {
        query, interpretation: `Generating comprehensive platform summary`,
        engine: 'general',
        data: {
          companies: c.length, contacts: co.length, pendingDrafts: dr.length, recentReplies: re.length,
          topCompanies: c.sort((a: any, b: any) => (b.intelligenceScore || 0) - (a.intelligenceScore || 0)).slice(0, 3).map((x: any) => ({ name: x.rawName, score: x.intelligenceScore || 0 })),
          contactsByStatus: co.reduce((acc: any, x: any) => { acc[x.status] = (acc[x.status] || 0) + 1; return acc; }, {}),
        },
        summary: `Platform has ${c.length} companies, ${co.length} contacts, ${dr.length} pending drafts, and ${re.length} recent replies. Ask about specific engines for deeper insights.`,
      };
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Command Center Query]', error);
    return NextResponse.json({ error: 'Query processing failed' }, { status: 500 });
  }
}