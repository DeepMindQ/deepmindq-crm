import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/* ═══════════════════════════════════════════════════
   Company Mind Map API — Clean Tree Hierarchy
   
   Query params:
     ?companyId=xxx  → Radial tree for one company (all contacts, signals, notes)
     ?search=term    → Search companies (max 20), each with top 3 contacts
     (default)       → Top 30 companies by intelligenceScore, each with top 3 contacts
   
   NO industry hubs. NO cross-company edges.
   Pure parent-child tree: company → contact / signal / note
   ═══════════════════════════════════════════════════ */

interface GraphNode {
  id: string;
  type: 'company' | 'contact' | 'signal' | 'note';
  label: string;
  data: Record<string, unknown>;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
}

interface MindMapResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: {
    totalNodes: number;
    totalEdges: number;
    companies: number;
    contacts: number;
    signals: number;
    notes: number;
  };
  mode: 'focused' | 'search' | 'overview';
  focusedCompanyId?: string;
}

/* ── Shared: build graph nodes/edges for a list of companies ── */
function buildCompanyNodes(
  companies: Array<Record<string, unknown>>,
  contactsMap: Map<string, Array<Record<string, unknown>>>,
  signalsMap: Map<string, Array<Record<string, unknown>>>,
  notesMap: Map<string, Array<Record<string, unknown>>>,
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  for (const c of companies) {
    const cid = c.id as string;
    const name = (c.rawName as string) || (c.normalizedName as string) || 'Unknown';

    // Company node
    nodes.push({
      id: `company-${cid}`,
      type: 'company',
      label: name,
      data: {
        id: cid,
        name,
        industry: c.industry ?? null,
        score: (c.intelligenceScore as number) || 0,
        status: c.status ?? null,
        lifecycleStage: c.lifecycleStage ?? null,
        engagementScore: (c.engagementScore as number) || 0,
        location: c.location ?? null,
        size: c.sizeRange ?? null,
        country: c.country ?? null,
        contactCount: c._count ? (c._count as Record<string, number>).contacts || 0 : 0,
        domain: c.domain ?? null,
      },
    });

    // Contact nodes
    const contacts = contactsMap.get(cid) || [];
    for (const ct of contacts) {
      const ctId = ct.id as string;
      const ctName = (ct.rawName as string) || (ct.normalizedName as string) || (ct.email as string) || 'Unknown';
      nodes.push({
        id: `contact-${ctId}`,
        type: 'contact',
        label: ctName,
        data: {
          id: ctId,
          name: ctName,
          email: ct.email ?? null,
          title: ct.title ?? null,
          role: ct.role ?? null,
          score: (ct.leadScore as number) || 0,
          status: ct.status ?? null,
        },
      });
      edges.push({
        id: `edge-${cid}-${ctId}`,
        source: `company-${cid}`,
        target: `contact-${ctId}`,
        type: 'company-contact',
      });
    }

    // Signal nodes
    const signals = signalsMap.get(cid) || [];
    for (const s of signals) {
      const sId = s.id as string;
      nodes.push({
        id: `signal-${sId}`,
        type: 'signal',
        label: (s.title as string) || 'Signal',
        data: {
          id: sId,
          type: s.signalType ?? null,
          title: s.title ?? null,
          severity: s.severity ?? 'medium',
          source: s.source ?? null,
          createdAt: s.createdAt ?? null,
        },
      });
      edges.push({
        id: `edge-${cid}-${sId}`,
        source: `company-${cid}`,
        target: `signal-${sId}`,
        type: 'company-signal',
      });
    }

    // Note nodes
    const notes = notesMap.get(cid) || [];
    for (const n of notes) {
      const nId = n.id as string;
      nodes.push({
        id: `note-${nId}`,
        type: 'note',
        label: (n.title as string) || (n.category as string) || 'Note',
        data: {
          id: nId,
          title: n.title ?? null,
          category: n.category ?? 'general',
          pinned: (n.pinned as boolean) || false,
          createdAt: n.createdAt ?? null,
        },
      });
      edges.push({
        id: `edge-${cid}-${nId}`,
        source: `company-${cid}`,
        target: `note-${nId}`,
        type: 'company-note',
      });
    }
  }

  return { nodes, edges };
}

/* ═══════════════════════════════════════════════════
   GET handler
   ═══════════════════════════════════════════════════ */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const search = searchParams.get('search');

    let response: MindMapResponse;

    if (companyId) {
      response = await buildFocusedView(companyId);
    } else if (search && search.trim().length > 0) {
      response = await buildSearchView(search.trim());
    } else {
      response = await buildOverviewView();
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Mind Map API]', error);
    return NextResponse.json({ error: 'Failed to build mind map' }, { status: 500 });
  }
}

/* ── Focused view: single company + ALL its children ── */
async function buildFocusedView(companyId: string): Promise<MindMapResponse> {
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: {
      id: true, rawName: true, normalizedName: true, industry: true,
      intelligenceScore: true, engagementScore: true, status: true,
      lifecycleStage: true, location: true, sizeRange: true, domain: true, country: true,
      _count: { select: { contacts: true } },
    },
  });

  if (!company) {
    return { nodes: [], edges: [], stats: { totalNodes: 0, totalEdges: 0, companies: 0, contacts: 0, signals: 0, notes: 0 }, mode: 'focused', focusedCompanyId: companyId };
  }

  const [contacts, signals, notes] = await Promise.all([
    db.contact.findMany({
      where: { companyId },
      orderBy: { leadScore: 'desc' },
      select: { id: true, rawName: true, normalizedName: true, email: true, title: true, role: true, leadScore: true, status: true },
    }),
    db.companySignal.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, companyId: true, signalType: true, title: true, severity: true, source: true, createdAt: true },
    }),
    db.companyNote.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, companyId: true, title: true, category: true, pinned: true, createdAt: true },
    }),
  ]);

  const contactsMap = new Map<string, Array<Record<string, unknown>>>();
  const signalsMap = new Map<string, Array<Record<string, unknown>>>();
  const notesMap = new Map<string, Array<Record<string, unknown>>>();
  contactsMap.set(companyId, contacts as unknown as Array<Record<string, unknown>>);
  signalsMap.set(companyId, signals as unknown as Array<Record<string, unknown>>);
  notesMap.set(companyId, notes as unknown as Array<Record<string, unknown>>);

  const { nodes, edges } = buildCompanyNodes([company as unknown as Record<string, unknown>], contactsMap, signalsMap, notesMap);

  return {
    nodes,
    edges,
    stats: {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      companies: 1,
      contacts: contacts.length,
      signals: signals.length,
      notes: notes.length,
    },
    mode: 'focused',
    focusedCompanyId: companyId,
  };
}

/* ── Search view: matching companies (max 20) + top 3 contacts each ── */
async function buildSearchView(term: string): Promise<MindMapResponse> {
  const companies = await db.company.findMany({
    where: {
      OR: [
        { rawName: { contains: term } },
        { normalizedName: { contains: term } },
        { domain: { contains: term } },
        { industry: { contains: term } },
      ],
    },
    take: 20,
    orderBy: { intelligenceScore: 'desc' },
    select: {
      id: true, rawName: true, normalizedName: true, industry: true,
      intelligenceScore: true, engagementScore: true, status: true,
      lifecycleStage: true, location: true, sizeRange: true, domain: true, country: true,
      _count: { select: { contacts: true } },
    },
  });

  const companyIds = companies.map(c => c.id);

  // Fetch top 3 contacts per company
  const contacts = await db.contact.findMany({
    where: { companyId: { in: companyIds } },
    orderBy: { leadScore: 'desc' },
    select: { id: true, rawName: true, normalizedName: true, email: true, title: true, role: true, leadScore: true, status: true, companyId: true },
  });

  const contactsMap = new Map<string, Array<Record<string, unknown>>>();
  const perCompany = new Map<string, number>();
  for (const ct of contacts) {
    const cid = ct.companyId;
    const count = perCompany.get(cid) || 0;
    if (count >= 3) continue;
    perCompany.set(cid, count + 1);
    if (!contactsMap.has(cid)) contactsMap.set(cid, []);
    contactsMap.get(cid)!.push(ct as unknown as Record<string, unknown>);
  }

  const { nodes, edges } = buildCompanyNodes(
    companies as unknown as Record<string, unknown>[],
    contactsMap,
    new Map(),
    new Map(),
  );

  return {
    nodes,
    edges,
    stats: {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      companies: companies.length,
      contacts: contacts.length,
      signals: 0,
      notes: 0,
    },
    mode: 'search',
  };
}

/* ── Overview: top 30 companies by IQ score + top 3 contacts each ── */
async function buildOverviewView(): Promise<MindMapResponse> {
  const companies = await db.company.findMany({
    take: 30,
    orderBy: { intelligenceScore: 'desc' },
    select: {
      id: true, rawName: true, normalizedName: true, industry: true,
      intelligenceScore: true, engagementScore: true, status: true,
      lifecycleStage: true, location: true, sizeRange: true, domain: true, country: true,
      _count: { select: { contacts: true } },
    },
  });

  const companyIds = companies.map(c => c.id);

  // Fetch top 3 contacts per company
  const contacts = await db.contact.findMany({
    where: { companyId: { in: companyIds } },
    orderBy: { leadScore: 'desc' },
    select: { id: true, rawName: true, normalizedName: true, email: true, title: true, role: true, leadScore: true, status: true, companyId: true },
  });

  // Fetch latest signal per company (max 1 each)
  const signals = await db.companySignal.findMany({
    where: { companyId: { in: companyIds } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, companyId: true, signalType: true, title: true, severity: true, source: true, createdAt: true },
  });

  // Fetch latest note per company (max 1 each)
  const notes = await db.companyNote.findMany({
    where: { companyId: { in: companyIds } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, companyId: true, title: true, category: true, pinned: true, createdAt: true },
  });

  const contactsMap = new Map<string, Array<Record<string, unknown>>>();
  const signalsMap = new Map<string, Array<Record<string, unknown>>>();
  const notesMap = new Map<string, Array<Record<string, unknown>>>();

  // Top 3 contacts per company
  const perCompany = new Map<string, number>();
  for (const ct of contacts) {
    const cid = ct.companyId;
    const count = perCompany.get(cid) || 0;
    if (count >= 3) continue;
    perCompany.set(cid, count + 1);
    if (!contactsMap.has(cid)) contactsMap.set(cid, []);
    contactsMap.get(cid)!.push(ct as unknown as Record<string, unknown>);
  }

  // 1 signal per company (latest)
  const sigSeen = new Set<string>();
  for (const s of signals) {
    if (sigSeen.has(s.companyId)) continue;
    sigSeen.add(s.companyId);
    if (!signalsMap.has(s.companyId)) signalsMap.set(s.companyId, []);
    signalsMap.get(s.companyId)!.push(s as unknown as Record<string, unknown>);
  }

  // 1 note per company (latest)
  const noteSeen = new Set<string>();
  for (const n of notes) {
    if (noteSeen.has(n.companyId)) continue;
    noteSeen.add(n.companyId);
    if (!notesMap.has(n.companyId)) notesMap.set(n.companyId, []);
    notesMap.get(n.companyId)!.push(n as unknown as Record<string, unknown>);
  }

  const { nodes, edges } = buildCompanyNodes(
    companies as unknown as Record<string, unknown>[],
    contactsMap,
    signalsMap,
    notesMap,
  );

  return {
    nodes,
    edges,
    stats: {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      companies: companies.length,
      contacts: contacts.length,
      signals: sigSeen.size,
      notes: noteSeen.size,
    },
    mode: 'overview',
  };
}