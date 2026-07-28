import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

/* ═══════════════════════════════════════════════════════════════════════════
   GET /api/companies/[id]/alignment — Read-Only Composition Layer
   
   This endpoint does NOT generate new intelligence.
   It combines existing signals, capabilities, and company data
   into a business-language alignment response.
   
   Architecture-ready for Phase B Intelligence Engine upgrades.
   UI/API contract remains compatible when deeper intelligence plugs in.
   
   Response shaped around user's decision:
   "Why should I approach this account and why are we a fit?"
   ═══════════════════════════════════════════════════════════════════════════ */

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: companyId } = await params;

    // 1. Fetch company
    const company = await db.company.findUnique({
      where: { id: companyId },
      include: {
        researchCard: true,
        _count: {
          select: { signals: true, contacts: true, notes: true },
        },
      },
    });

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // 2. Fetch company signals
    const signals = await db.companySignal.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });

    // 3. Fetch active capabilities
    const capabilities = await db.capabilityAsset.findMany({
      where: { isActive: true },
    });

    // 4. Fetch top contacts for this company
    const contacts = await db.contact.findMany({
      where: { companyId },
      orderBy: { leadScore: 'desc' },
      take: 10,
    });

    // ── Composition: Signals → Detected Business Needs ──
    const businessNeeds = composeBusinessNeeds(signals, company);

    // ── Composition: Needs + Capabilities → Capability Matches ──
    const capabilityMatches = composeCapabilityMatches(
      businessNeeds,
      capabilities,
      signals,
      company
    );

    // ── Composition: Matches + Company context → Recommended Positioning ──
    const recommendedPositioning = composePositioning(
      company,
      businessNeeds,
      capabilityMatches,
      contacts
    );

    // ── Technology Intelligence from research card + signals ──
    const technologyProfile = composeTechnologyProfile(company, signals);

    // ── Actions derived from signals + matches ──
    const recommendedActions = composeActions(
      company,
      signals,
      capabilityMatches,
      contacts
    );

    return NextResponse.json({
      company: company.rawName,
      industry: company.industry,
      domain: company.domain,
      intelligenceScore: company.intelligenceScore ?? 0,

      // Business needs detected from signals
      needs: businessNeeds,

      // How our capabilities match their needs
      capabilityMatches,

      // Strategic positioning recommendation
      recommendedPositioning,

      // Technology stack intelligence
      technology: technologyProfile,

      // Concrete next steps
      actions: recommendedActions,

      // Metadata
      signalCount: signals.length,
      capabilityCount: capabilities.length,
      contactCount: contacts.length,
      generatedAt: new Date().toISOString(),

      // Phase B compatibility: these fields will be populated by
      // the future Intelligence Engine (Evidence Engine, Knowledge Graph, etc.)
      // Today they are derived from existing data.
      _meta: {
        source: 'composition_layer',
        version: '1.0',
        futureReady: true,
      },
    });
  } catch (error) {
    console.error('[alignment] Error:', error);
    return NextResponse.json(
      { error: 'Failed to compose alignment' },
      { status: 500 }
    );
  }
}

/* ═══════════════════════════════════════════════════
   Signal → Business Need Mapping
   ═══════════════════════════════════════════════════ */

const SIGNAL_TO_NEED_MAP: Record<string, string[]> = {
  funding: ['Growth capital available', 'Expanding operations', 'Scaling infrastructure'],
  hiring: ['Talent acquisition', 'Team expansion', 'Skill gaps to fill'],
  leadership_change: ['Strategic direction shift', 'New decision makers', 'Organizational change'],
  tech_change: ['Technology modernization', 'Digital transformation', 'Platform migration'],
  news: ['Market visibility', 'Brand momentum', 'Industry positioning'],
  mention: ['Market awareness', 'Competitive activity', 'Partnership opportunity'],
  partnership: ['Channel development', 'Integration needs', 'Co-sell potential'],
  expansion: ['Geographic growth', 'New market entry', 'Localization needs'],
};

function composeBusinessNeeds(
  signals: any[],
  company: any
): Array<{
  need: string;
  confidence: number;
  signalTypes: string[];
  signalCount: number;
  evidence: string[];
  detectedAt: string;
}> {
  if (signals.length === 0) return [];

  const needMap = new Map<string, { signals: any[]; types: Set<string> }>();

  for (const signal of signals) {
    const mappedNeeds = SIGNAL_TO_NEED_MAP[signal.signalType] || [];
    for (const need of mappedNeeds) {
      if (!needMap.has(need)) {
        needMap.set(need, { signals: [], types: new Set() });
      }
      const entry = needMap.get(need)!;
      entry.signals.push(signal);
      entry.types.add(signal.signalType);
    }

    // Also map the signal title directly if no mapping exists
    if (mappedNeeds.length === 0 && signal.title) {
      const need = signal.title;
      if (!needMap.has(need)) {
        needMap.set(need, { signals: [], types: new Set() });
      }
      const entry = needMap.get(need)!;
      entry.signals.push(signal);
      entry.types.add(signal.signalType);
    }
  }

  return Array.from(needMap.entries())
    .map(([need, data]) => ({
      need,
      confidence: Math.min(
        95,
        40 + (data.signals.length * 15) + (data.types.size * 10)
      ),
      signalTypes: Array.from(data.types),
      signalCount: data.signals.length,
      evidence: data.signals.map(s =>
        s.description || `${s.signalType}: ${s.title}`
      ),
      detectedAt: data.signals[0]?.createdAt || new Date().toISOString(),
    }))
    .sort((a, b) => b.confidence - a.confidence);
}

/* ═══════════════════════════════════════════════════
   Needs + Capabilities → Match Scoring
   ═══════════════════════════════════════════════════ */

function composeCapabilityMatches(
  needs: Array<{ need: string; confidence: number; evidence: string[] }>,
  capabilities: any[],
  signals: any[],
  company: any
): Array<{
  capability: string;
  capabilityId: string;
  category: string;
  matchConfidence: number;
  matchedNeeds: string[];
  supportingEvidence: string[];
  summary: string;
}> {
  if (capabilities.length === 0 || needs.length === 0) return [];

  // Simple keyword/semantic matching between needs and capabilities
  // Phase B will replace this with Knowledge Graph + vector similarity
  const matches: Array<{
    capability: string;
    capabilityId: string;
    category: string;
    matchConfidence: number;
    matchedNeeds: string[];
    supportingEvidence: string[];
    summary: string;
  }> = [];

  for (const cap of capabilities) {
    const capText = [
      cap.title, cap.summary, cap.solution, cap.technology,
      cap.industry, cap.businessProblem, cap.customerOutcome,
      cap.differentiator, cap.keywords, cap.problems,
      cap.targetIndustries, cap.technology,
    ].filter(Boolean).join(' ').toLowerCase();

    const companyText = [
      company.industry, company.domain, company.sizeRange,
      company.country, company.location,
    ].filter(Boolean).join(' ').toLowerCase();

    const signalText = signals
      .map(s => `${s.title} ${s.description} ${s.signalType}`)
      .filter(Boolean)
      .join(' ').toLowerCase();

    let bestMatchScore = 0;
    const matchedNeeds: string[] = [];
    const allEvidence: string[] = [];

    for (const need of needs) {
      const needWords = need.need.toLowerCase().split(/\s+/);
      const overlapCount = needWords.filter(w =>
        w.length > 3 && (capText.includes(w) || signalText.includes(w))
      ).length;

      const needText = need.need.toLowerCase();
      const directMatch = capText.includes(needText) || signalText.includes(needText);
      const partialMatch = overlapCount >= 2;

      let score = 0;
      if (directMatch) score = 85 + need.confidence * 0.1;
      else if (partialMatch) score = 50 + (overlapCount / needWords.length) * 30 + need.confidence * 0.05;

      // Industry alignment boost
      if (cap.targetIndustries && company.industry) {
        if (cap.targetIndustries.toLowerCase().includes(company.industry.toLowerCase())) {
          score += 10;
          allEvidence.push(`Industry alignment: ${cap.targetIndustries}`);
        }
      }

      if (score > 30) {
        bestMatchScore = Math.max(bestMatchScore, score);
        matchedNeeds.push(need.need);
        allEvidence.push(...need.evidence.slice(0, 2));
      }
    }

    if (bestMatchScore > 30) {
      matches.push({
        capability: cap.title,
        capabilityId: cap.id,
        category: cap.category,
        matchConfidence: Math.min(99, Math.round(bestMatchScore)),
        matchedNeeds,
        supportingEvidence: [...new Set(allEvidence)].slice(0, 5),
        summary: cap.summary || '',
      });
    }
  }

  return matches.sort((a, b) => b.matchConfidence - a.matchConfidence);
}

/* ═══════════════════════════════════════════════════
   Positioning Recommendation
   ═══════════════════════════════════════════════════ */

function composePositioning(
  company: any,
  needs: Array<{ need: string; confidence: number }>,
  matches: Array<{ capability: string; matchedNeeds: string[]; matchConfidence: number }>,
  contacts: any[]
): {
  message: string;
  angle: string;
  targetStakeholders: Array<{ role: string; reason: string }>;
  strengthScore: number;
  topMatches: string[];
} {
  if (matches.length === 0) {
    return {
      message: 'No capability alignment detected yet. Upload capabilities to enable positioning intelligence.',
      angle: 'general',
      targetStakeholders: [],
      strengthScore: 0,
      topMatches: [],
    };
  }

  const topMatches = matches.slice(0, 3);
  const avgConfidence = topMatches.reduce((sum, m) => sum + m.matchConfidence, 0) / topMatches.length;

  const topCapability = topMatches[0].capability;
  const allNeeds = [...new Set(topMatches.flatMap(m => m.matchedNeeds))];

  const message = `Position as a ${topCapability.toLowerCase()} partner for ${company.rawName}. ` +
    (allNeeds.length > 0
      ? `Their current needs around ${allNeeds[0].toLowerCase()} indicate strong alignment.`
      : '');

  const angles = ['technical-advisor', 'strategic-partner', 'cost-optimizer', 'innovation-driver'];
  const angle = avgConfidence > 75 ? 'strategic-partner' : avgConfidence > 55 ? 'technical-advisor' : 'cost-optimizer';

  const stakeholders: Array<{ role: string; reason: string }> = [];
  if (contacts.length > 0) {
    const seen = new Set<string>();
    for (const c of contacts.slice(0, 5)) {
      const role = c.title || c.role || 'Unknown';
      if (!seen.has(role)) {
        seen.add(role);
        stakeholders.push({
          role,
          reason: c.leadScore > 70
            ? `High scoring contact (${c.leadScore})`
            : 'Identified stakeholder',
        });
      }
    }
  }

  return {
    message,
    angle,
    targetStakeholders: stakeholders.slice(0, 4),
    strengthScore: Math.round(avgConfidence),
    topMatches: topMatches.map(m => m.capability),
  };
}

/* ═══════════════════════════════════════════════════
   Technology Profile from Research Card + Signals
   ═══════════════════════════════════════════════════ */

function composeTechnologyProfile(
  company: any,
  signals: any[]
): {
  knownTech: string[];
  techSignals: Array<{ signal: string; type: string; date: string; confidence: number }>;
  digitalMaturity: string;
  techDescription: string | null;
} {
  const techStack: string[] = [];
  const techSignals: Array<{ signal: string; type: string; date: string; confidence: number }> = [];

  // Extract tech from research card
  if (company.researchCard?.techStack) {
    const techStr = company.researchCard.techStack;
    if (Array.isArray(techStr)) {
      techStack.push(...techStr);
    } else if (typeof techStr === 'string') {
      techStack.push(...techStr.split(',').map(t => t.trim()).filter(Boolean));
    }
  }

  if (company.researchCard?.techLandscape) {
    const landscape = company.researchCard.techLandscape;
    if (typeof landscape === 'string') {
      techStack.push(...landscape.split(',').map(t => t.trim()).filter(Boolean));
    }
  }

  // Extract tech signals
  for (const signal of signals) {
    if (signal.signalType === 'tech_change') {
      techSignals.push({
        signal: signal.title,
        type: signal.signalType,
        date: signal.createdAt,
        confidence: signal.severity === 'high' ? 80 : signal.severity === 'medium' ? 60 : 40,
      });
    }
  }

  // Determine digital maturity
  const maturity = company.researchCard?.digitalMaturity || (
    techStack.length > 10 ? 'advanced' :
    techStack.length > 5 ? 'high' :
    techStack.length > 2 ? 'medium' : 'low'
  );

  return {
    knownTech: [...new Set(techStack)],
    techSignals,
    digitalMaturity: maturity as string,
    techDescription: company.researchCard?.techLandscape || null,
  };
}

/* ═══════════════════════════════════════════════════
   Actions derived from signals + matches + contacts
   ═══════════════════════════════════════════════════ */

function composeActions(
  company: any,
  signals: any[],
  matches: Array<{ capability: string; matchedNeeds: string[]; matchConfidence: number }>,
  contacts: any[]
): Array<{
  action: string;
  type: 'engage' | 'research' | 'prepare' | 'monitor';
  priority: 'high' | 'medium' | 'low';
  reason: string;
  capability?: string;
  contact?: string;
  confidence: number;
}> {
  const actions: Array<{
    action: string;
    type: 'engage' | 'research' | 'prepare' | 'monitor';
    priority: 'high' | 'medium' | 'low';
    reason: string;
    capability?: string;
    contact?: string;
    confidence: number;
  }> = [];

  // High-severity signals → immediate actions
  for (const signal of signals.filter(s => s.severity === 'high' || s.severity === 'critical')) {
    actions.push({
      action: `Follow up on: ${signal.title}`,
      type: 'engage',
      priority: signal.severity === 'critical' ? 'high' : 'medium',
      reason: `High-severity ${signal.signalType.replace('_', ' ')} signal detected`,
      confidence: 80,
    });
  }

  // Top capability match → engagement action
  if (matches.length > 0) {
    const topMatch = matches[0];
    actions.push({
      action: `Position "${topMatch.capability}" to ${company.rawName}`,
      type: 'engage',
      priority: topMatch.matchConfidence > 70 ? 'high' : 'medium',
      reason: `${topMatch.matchConfidence}% confidence alignment on: ${topMatch.matchedNeeds.join(', ')}`,
      capability: topMatch.capability,
      confidence: topMatch.matchConfidence,
    });

    // Secondary match → prepare action
    if (matches.length > 1) {
      actions.push({
        action: `Prepare "${matches[1].capability}" case study for outreach`,
        type: 'prepare',
        priority: 'medium',
        reason: `${matches[1].matchConfidence}% match on: ${matches[1].matchedNeeds.join(', ')}`,
        capability: matches[1].capability,
        confidence: matches[1].matchConfidence,
      });
    }
  }

  // High-score contacts → engage
  for (const contact of contacts.filter(c => c.leadScore >= 70)) {
    actions.push({
      action: `Reach out to ${contact.rawName} (${contact.title || contact.role || 'stakeholder'})`,
      type: 'engage',
      priority: contact.leadScore >= 85 ? 'high' : 'medium',
      reason: `High lead score (${contact.leadScore}), direct access to decision maker`,
      contact: contact.rawName,
      confidence: contact.leadScore,
    });
  }

  // No signals → research action
  if (signals.length === 0) {
    actions.push({
      action: `Enrich ${company.rawName} with intelligence analysis`,
      type: 'research',
      priority: 'medium',
      reason: 'No signals detected — run enrichment to discover opportunities',
      confidence: 50,
    });
  }

  // No matches → upload capabilities
  if (matches.length === 0 && signals.length > 0) {
    actions.push({
      action: 'Upload capabilities to enable alignment scoring',
      type: 'prepare',
      priority: 'low',
      reason: 'Signals detected but no capabilities in the library to match against',
      confidence: 40,
    });
  }

  // Monitor action for active signals
  if (signals.length > 0) {
    const recentSignals = signals.filter(s => {
      const age = Date.now() - new Date(s.createdAt).getTime();
      return age < 7 * 24 * 60 * 60 * 1000; // last 7 days
    });
    if (recentSignals.length > 3) {
      actions.push({
        action: `Monitor ${company.rawName} — ${recentSignals.length} active signals in the last 7 days`,
        type: 'monitor',
        priority: 'low',
        reason: 'High signal velocity indicates active change — watch for timing windows',
        confidence: 60,
      });
    }
  }

  return actions
    .sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    })
    .slice(0, 8);
}
