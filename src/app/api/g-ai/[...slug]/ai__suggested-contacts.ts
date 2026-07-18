import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { apiError, apiSuccess } from '@/lib/apiHelpers';
import { callLLM } from '@/lib/zai-helpers';
import { getResearchContext, buildResearchContextText } from '@/lib/intelligence-contract';

// ── Types ──

interface SuggestedContact {
  name: string | null;
  role: string;
  whyRelevant: string;
  influence: string;
  priority: number;
  recommendedAction: string;
  source: 'phase3_key_people' | 'phase3_llm_analysis';
}

interface CacheEntry { data: Record<string, unknown>; expiresAt: number; }

// ── In-memory cache (2-hour TTL) ──

const CACHE_TTL_MS = 2 * 60 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

function getCached(companyId: string): Record<string, unknown> | null {
  const entry = cache.get(companyId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { cache.delete(companyId); return null; }
  return entry.data;
}

function setCache(companyId: string, data: Record<string, unknown>) {
  cache.set(companyId, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ── JSON parsing ──

function parseContacts(raw: string): SuggestedContact[] {
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  try {
    const arr = JSON.parse(cleaned);
    if (Array.isArray(arr)) return validateContacts(arr);
  } catch {
    // fall through to regex
  }

  const contacts: SuggestedContact[] = [];
  const re = /\{\s*"role"\s*:\s*"([^"]+)"[\s\S]*?"whyRelevant"\s*:\s*"((?:[^"\\]|\\.)*)"[\s\S]*?"influence"\s*:\s*"([^"]+)"[\s\S]*?"priority"\s*:\s*(\d)[\s\S]*?"recommendedAction"\s*:\s*"((?:[^"\\]|\\.)*)"[\s\S]*?"name"\s*:\s*(?:"((?:[^"\\]|\\.)*)"|null)\s*\}/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(cleaned)) !== null) {
    contacts.push({
      role: match[1],
      whyRelevant: match[2].replace(/\\"/g, '"'),
      influence: match[3],
      priority: Math.min(5, Math.max(1, parseInt(match[4], 10) || 3)),
      recommendedAction: match[5].replace(/\\"/g, '"'),
      name: match[6] ? match[6].replace(/\\"/g, '"') : null,
      source: 'phase3_llm_analysis',
    });
  }
  return validateContacts(contacts);
}

const VALID_INFLUENCE = ['Decision Maker', 'Technical Influencer', 'Business Sponsor', 'Champion', 'Blocker'];

function validateContacts(arr: unknown[]): SuggestedContact[] {
  return arr
    .filter((c): c is Record<string, unknown> => {
      if (typeof c !== 'object' || c === null) return false
      return !!(c as Record<string, unknown>).role
    })
    .map((c: Record<string, unknown>) => ({
      name: typeof c.name === 'string' ? c.name : null,
      role: String(c.role ?? ''),
      whyRelevant: String(c.whyRelevant ?? ''),
      influence: VALID_INFLUENCE.includes(String(c.influence)) ? String(c.influence) : 'Technical Influencer',
      priority: Math.min(5, Math.max(1, typeof c.priority === 'number' ? c.priority : 3)),
      recommendedAction: String(c.recommendedAction ?? ''),
      source: c.source === 'phase3_key_people' ? 'phase3_key_people' as const : 'phase3_llm_analysis' as const,
    }))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 8);
}

// ── Map Phase 3 key people to suggested contacts ──

// Unused placeholder removed — suggestions are built inline

// GET /api/ai/suggested-contacts?companyId=xxx
// REWIRED: Checks Phase 3 keyPeople first, only uses LLM analysis if needed

export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get('companyId');
  if (!companyId) return apiError('companyId query parameter is required', 400);

  const cached = getCached(companyId);
  if (cached) return apiSuccess(cached);

  try {
    const company = await db.company.findUnique({
      where: { id: companyId },
      include: {
        contacts: {
          select: { id: true, rawName: true, title: true, role: true, email: true, leadScore: true },
          orderBy: { leadScore: 'desc' },
          take: 20,
        },
      },
    });

    if (!company) return apiError('Company not found', 404);

    const companyName = company.rawName;

    // ── STEP 1: CONSUME PHASE 3 KEY PEOPLE (no web search) ──
    const ctx = await getResearchContext(companyId);

    let contacts: SuggestedContact[] = [];

    // Direct from Phase 3 research engine key people
    if (ctx.keyPeople.length > 0) {
      contacts = ctx.keyPeople.map(p => ({
        name: p.name || null,
        role: p.title || p.department || 'Unknown Role',
        whyRelevant: `Identified as a key person at ${companyName}${p.department ? ` in ${p.department}` : ''}`,
        influence: determineInfluence(p.title),
        priority: determinePriority(p.title),
        recommendedAction: buildRecommendedAction(p),
        source: 'phase3_key_people' as const,
      }));
    }

    // ── STEP 2: If Phase 3 has enough key people (3+), skip LLM ──
    if (contacts.length < 3 && ctx.researchCard) {
      // Use LLM to analyze Phase 3 research context for additional stakeholders
      // (NOT an independent web search — LLM only analyzes existing data)
      try {
        const researchText = buildResearchContextText(ctx);

        const existingContactSummary = company.contacts.length > 0
          ? company.contacts.map((c) => `  - ${c.rawName} (${c.title || c.role || 'Unknown role'})`).join('\n')
          : 'None';

        const systemPrompt =
          'You are a B2B stakeholder identification expert. Analyze the provided company intelligence to identify key decision-makers. Always respond with valid JSON only.';

        const userPrompt = `Based on the company intelligence about ${companyName}, identify additional key stakeholders who would be relevant for a technology/AI consulting engagement.

IMPORTANT: The intelligence below is from our research engine. Use ONLY this data — do not search the web.

For each stakeholder, determine:
- Name (if found in intelligence, otherwise use role only)
- Role/Title
- Why they're relevant
- Influence level: Decision Maker / Technical Influencer / Business Sponsor / Champion / Blocker
- Priority (1-5)
- Recommended action to engage them

Existing contacts in CRM:
${existingContactSummary}

Company Intelligence:
${researchText}

Return ONLY valid JSON array:
[{
  "name": "Name or null if not found",
  "role": "Chief Information Officer",
  "whyRelevant": "Leads technology strategy...",
  "influence": "Decision Maker",
  "priority": 5,
  "recommendedAction": "Direct executive introduction"
}]

Identify 5-8 stakeholders. Focus on C-suite, VPs, and Directors relevant to technology, digital transformation, and operations.`;

        const raw = await callLLM(systemPrompt, userPrompt);
        const llmContacts = parseContacts(raw);

        // Merge: add LLM contacts that aren't duplicates of Phase 3 key people
        const existingRoles = new Set(contacts.map(c => c.role.toLowerCase()));
        for (const lc of llmContacts) {
          if (!existingRoles.has(lc.role.toLowerCase())) {
            contacts.push(lc);
          }
        }
      } catch (e) {
        console.error('[suggested-contacts] LLM analysis failed:', e);
      }
    }

    // Sort by priority and limit
    contacts = contacts
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 8);

    const response = {
      companyId,
      companyName,
      contacts,
      existingContacts: company.contacts.map((c) => ({
        id: c.id,
        name: c.rawName,
        title: c.title ?? c.role ?? null,
        email: c.email,
        leadScore: c.leadScore,
      })),
      intelligenceSource: 'phase3',
      generatedAt: new Date().toISOString(),
    };

    setCache(companyId, response);
    return apiSuccess(response);
  } catch (e) {
    console.error('[suggested-contacts] Error:', e);
    return apiError('Failed to generate suggested contacts');
  }
}

// ── Helpers ──

function determineInfluence(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('ceo') || t.includes('chief executive') || t.includes('founder') || t.includes('owner')) return 'Decision Maker';
  if (t.includes('cto') || t.includes('chief technology') || t.includes('vp of engineering') || t.includes('head of engineering')) return 'Technical Influencer';
  if (t.includes('cfo') || t.includes('chief financial')) return 'Business Sponsor';
  if (t.includes('cio') || t.includes('chief information')) return 'Decision Maker';
  if (t.includes('vp') || t.includes('vice president')) return 'Business Sponsor';
  if (t.includes('director')) return 'Technical Influencer';
  if (t.includes('manager')) return 'Champion';
  return 'Technical Influencer';
}

function determinePriority(title: string): number {
  const t = title.toLowerCase();
  if (t.includes('ceo') || t.includes('cto') || t.includes('cio') || t.includes('cfo')) return 5;
  if (t.includes('vp') || t.includes('vice president') || t.includes('founder')) return 4;
  if (t.includes('director') || t.includes('head of')) return 3;
  if (t.includes('senior') || t.includes('lead')) return 2;
  return 1;
}

function buildRecommendedAction(person: { title?: string; linkedInUrl?: string; name?: string }): string {
  if (person.linkedInUrl) {
    return `Connect on LinkedIn${person.name ? ` with ${person.name}` : ''} — ${person.title || 'key stakeholder'}`;
  }
  if (person.title?.includes('CEO') || person.title?.includes('CTO')) {
    return 'Request a warm executive introduction through a mutual connection';
  }
  return 'Research further and prepare a personalized outreach message';
}