import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

/* ═══════════════════════════════════════════════════
   Company Mind Map API
   Returns companies + contacts + signals + notes
   as a graph structure for interactive visualization
   ═══════════════════════════════════════════════════ */

export async function GET() {
  try {
    // Fetch top companies by intelligence score, plus a spread across industries
    const [topCompanies, contacts, signals, notes] = await Promise.all([
      db.company.findMany({
        take: 200,
        orderBy: { intelligenceScore: 'desc' },
        select: {
          id: true, rawName: true, normalizedName: true, industry: true,
          intelligenceScore: true, engagementScore: true, status: true,
          lifecycleStage: true, location: true, sizeRange: true, domain: true, country: true,
          _count: { select: { contacts: true } },
        },
      }),
      db.contact.findMany({
        take: 500,
        orderBy: { leadScore: 'desc' },
        select: { id: true, rawName: true, normalizedName: true, email: true, title: true, role: true, leadScore: true, status: true, companyId: true },
      }),
      db.companySignal.findMany({ take: 80, orderBy: { createdAt: 'desc' }, select: { id: true, companyId: true, signalType: true, title: true, severity: true, source: true, createdAt: true } }),
      db.companyNote.findMany({ take: 60, orderBy: { createdAt: 'desc' }, select: { id: true, companyId: true, title: true, category: true, pinned: true, createdAt: true } }),
    ]);

    const safe = <T>(arr: T | undefined): T[] => Array.isArray(arr) ? arr : [];

    // Build graph nodes
    const nodes: Array<{ id: string; type: 'company' | 'contact' | 'signal' | 'note' | 'industry'; label: string; data: any }> = [];
    const edges: Array<{ id: string; source: string; target: string; label: string; type: string }> = [];

    // Company nodes
    safe(topCompanies).forEach((c: any) => {
      nodes.push({
        id: `company-${c.id}`,
        type: 'company',
        label: c.rawName || c.normalizedName,
        data: {
          id: c.id,
          name: c.rawName || c.normalizedName,
          industry: c.industry,
          score: c.intelligenceScore || 0,
          status: c.status,
          lifecycleStage: c.lifecycleStage,
          engagementScore: c.engagementScore || 0,
          location: c.location,
          size: c.sizeRange,
          country: c.country,
          contactCount: c._count?.contacts || 0,
          domain: c.domain,
        },
      });
    });

    const companyIds = new Set(safe(topCompanies).map((c: any) => c.id));

    // Contact nodes + edges to companies (limit per company to 3 for performance)
    const contactPerCompany = new Map<string, number>();
    safe(contacts).forEach((c: any) => {
      if (!companyIds.has(c.companyId)) return;
      const perCo = contactPerCompany.get(c.companyId) || 0;
      if (perCo >= 3) return;
      contactPerCompany.set(c.companyId, perCo + 1);

      const name = c.rawName || c.normalizedName || c.email;
      nodes.push({
        id: `contact-${c.id}`,
        type: 'contact',
        label: name,
        data: { id: c.id, name, email: c.email, title: c.title, role: c.role, score: c.leadScore || 0, status: c.status },
      });
      edges.push({
        id: `edge-${c.companyId}-${c.id}`,
        source: `company-${c.companyId}`,
        target: `contact-${c.id}`,
        label: 'contact_at',
        type: 'company-contact',
      });
    });

    // Signal nodes + edges
    safe(signals).forEach((s: any) => {
      if (!companyIds.has(s.companyId)) return;
      const sigId = `signal-${s.id}`;
      nodes.push({
        id: sigId, type: 'signal', label: s.title,
        data: { id: s.id, type: s.signalType, title: s.title, severity: s.severity, source: s.source, createdAt: s.createdAt },
      });
      edges.push({ id: `edge-${s.companyId}-${s.id}`, source: `company-${s.companyId}`, target: sigId, label: s.signalType, type: 'company-signal' });
    });

    // Note nodes + edges
    safe(notes).forEach((n: any) => {
      if (!companyIds.has(n.companyId)) return;
      const noteId = `note-${n.id}`;
      nodes.push({
        id: noteId, type: 'note', label: n.title || n.category,
        data: { id: n.id, title: n.title, category: n.category, pinned: n.pinned, createdAt: n.createdAt },
      });
      edges.push({ id: `edge-${n.companyId}-${n.id}`, source: `company-${n.companyId}`, target: noteId, label: n.category, type: 'company-note' });
    });

    // Industry hub nodes — group companies by industry and create hub nodes
    const byIndustry: Record<string, string[]> = {};
    safe(topCompanies).forEach((c: any) => {
      if (c.industry) {
        if (!byIndustry[c.industry]) byIndustry[c.industry] = [];
        byIndustry[c.industry].push(c.id);
      }
    });

    Object.entries(byIndustry).forEach(([industry, ids]) => {
      // Only create hub node for industries with 3+ companies
      if (ids.length < 3) return;
      const hubId = `industry-${industry.replace(/[^a-zA-Z0-9]/g, '_')}`;
      nodes.push({
        id: hubId, type: 'industry', label: industry,
        data: { industry, companyCount: ids.length },
      });
      // Connect first 10 companies to hub
      ids.slice(0, 10).forEach(cid => {
        edges.push({ id: `edge-${hubId}-${cid}`, source: hubId, target: `company-${cid}`, label: 'in_industry', type: 'industry-company' });
      });
    });

    // Cross-company edges (same industry, top 5 per industry)
    let edgeIdx = 0;
    Object.entries(byIndustry).forEach(([industry, ids]) => {
      for (let i = 0; i < Math.min(ids.length, 5); i++) {
        for (let j = i + 1; j < Math.min(ids.length, 5); j++) {
          edges.push({
            id: `cross-${edgeIdx++}`,
            source: `company-${ids[i]}`,
            target: `company-${ids[j]}`,
            label: `same_industry: ${industry}`,
            type: 'cross-company',
          });
        }
      }
    });

    return NextResponse.json({
      nodes,
      edges,
      stats: {
        totalNodes: nodes.length,
        totalEdges: edges.length,
        companies: safe(topCompanies).length,
        contacts: nodes.filter(n => n.type === 'contact').length,
        signals: nodes.filter(n => n.type === 'signal').length,
        notes: nodes.filter(n => n.type === 'note').length,
        industryHubs: nodes.filter(n => n.type === 'industry').length,
        crossCompanyEdges: edges.filter(e => e.type === 'cross-company').length,
      },
    });
  } catch (error) {
    console.error('[Mind Map API]', error);
    return NextResponse.json({ error: 'Failed to build mind map' }, { status: 500 });
  }
}