import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

/* ═══════════════════════════════════════════════════
   Company Mind Map API
   Returns companies + contacts + signals + notes
   as a graph structure for interactive visualization
   ═══════════════════════════════════════════════════ */

export async function GET() {
  try {
    const [companies, contacts, signals, notes] = await Promise.all([
      db.company.findMany({ take: 50, orderBy: { intelligenceScore: 'desc' } }),
      db.contact.findMany({ take: 200, orderBy: { leadScore: 'desc' } }),
      db.companySignal.findMany({ take: 50, orderBy: { createdAt: 'desc' } }),
      db.companyNote.findMany({ take: 50, orderBy: { createdAt: 'desc' } }),
    ]);

    const safe = <T>(arr: T | undefined): T[] => Array.isArray(arr) ? arr : [];

    // Build graph nodes
    const nodes: Array<{ id: string; type: 'company' | 'contact' | 'signal' | 'note'; label: string; data: any }> = [];
    const edges: Array<{ id: string; source: string; target: string; label: string; type: string }> = [];

    // Company nodes
    safe(companies).forEach((c: any) => {
      nodes.push({
        id: `company-${c.id}`,
        type: 'company',
        label: c.rawName || c.normalizedName,
        data: {
          id: c.id, name: c.rawName || c.normalizedName, industry: c.industry,
          score: c.intelligenceScore || 0, status: c.status, lifecycleStage: c.lifecycleStage,
          engagementScore: c.engagementScore || 0, location: c.location, size: c.sizeRange,
        },
      });
    });

    // Contact nodes + edges to companies
    const companyIds = new Set(safe(companies).map((c: any) => c.id));
    safe(contacts).forEach((c: any) => {
      if (!companyIds.has(c.companyId)) return;
      const name = c.rawName || c.normalizedName || c.email;
      nodes.push({
        id: `contact-${c.id}`,
        type: 'contact',
        label: name,
        data: {
          id: c.id, name, email: c.email, title: c.title, role: c.role,
          score: c.leadScore || 0, status: c.status,
        },
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
        id: sigId,
        type: 'signal',
        label: s.title,
        data: { id: s.id, type: s.signalType, title: s.title, severity: s.severity, source: s.source, createdAt: s.createdAt },
      });
      edges.push({
        id: `edge-${s.companyId}-${s.id}`,
        source: `company-${s.companyId}`,
        target: sigId,
        label: s.signalType,
        type: 'company-signal',
      });
    });

    // Note nodes + edges
    safe(notes).forEach((n: any) => {
      if (!companyIds.has(n.companyId)) return;
      const noteId = `note-${n.id}`;
      nodes.push({
        id: noteId,
        type: 'note',
        label: n.title || n.category,
        data: { id: n.id, title: n.title, category: n.category, pinned: n.pinned, createdAt: n.createdAt },
      });
      edges.push({
        id: `edge-${n.companyId}-${n.id}`,
        source: `company-${n.companyId}`,
        target: noteId,
        label: n.category,
        type: 'company-note',
      });
    });

    // Cross-company edges (same industry)
    const byIndustry: Record<string, string[]> = {};
    safe(companies).forEach((c: any) => {
      if (c.industry) {
        if (!byIndustry[c.industry]) byIndustry[c.industry] = [];
        byIndustry[c.industry].push(c.id);
      }
    });
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
        companies: safe(companies).length,
        contacts: nodes.filter(n => n.type === 'contact').length,
        signals: nodes.filter(n => n.type === 'signal').length,
        notes: nodes.filter(n => n.type === 'note').length,
        crossCompanyEdges: edges.filter(e => e.type === 'cross-company').length,
      },
    });
  } catch (error) {
    console.error('[Mind Map API]', error);
    return NextResponse.json({ error: 'Failed to build mind map' }, { status: 500 });
  }
}