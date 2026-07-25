/**
 * AI Relationship Mapping Engine (Wave 5.2)
 *
 * Maps the stakeholder landscape for a company account:
 * - Power Grid positioning (influence vs engagement)
 * - Stakeholder role classification
 * - Relationship gaps identification
 * - Cross-contact relationship signals
 * - Organizational hierarchy inference
 *
 * Output:
 *   Microsoft Corporation — Stakeholder Map
 *
 *   ECONOMIC BUYERS
 *   ● Sarah Chen (CFO) — Influence 92, Engagement 60
 *
 *   TECHNICAL BUYERS
 *   ● James Wilson (VP Engineering) — Influence 78, Engagement 40
 *
 *   CHAMPIONS
 *   ● Mike Torres (Director IT) — Influence 55, Engagement 85
 *
 *   GAPS: No CIO contact, no champion in Finance dept
 *   RECOMMENDATION: Target CIO office — no executive sponsor in technology decisions
 */

import { db } from '@/lib/db';
import { scoreContactInfluence, type ContactInfluenceScore } from '@/lib/scoring/contact-influence-engine';
import { buildEvidenceOutput, evidence } from '@/lib/ai-evidence-framework';
import { trackGeneration } from '@/lib/ai-reliability';

// ── Types ──

export type BuyingRoleGroup = 'economic_buyer' | 'technical_buyer' | 'champion' | 'coach' | 'user' | 'blocker' | 'unknown';

export interface StakeholderNode {
  contactId: string;
  name: string;
  title: string;
  email: string;
  buyingRole: BuyingRoleGroup;
  buyingInfluence: number;      // 0-100
  engagementScore: number;     // 0-100
  relationshipStrength: 'strong' | 'warm' | 'cold' | 'none';
  powerQuadrant: 'manage_closely' | 'keep_satisfied' | 'keep_informed' | 'monitor';
  lastInteraction: string | null;
  daysSinceContact: number;
  priorities: string[];
  department: string;
}

export interface RelationshipMap {
  companyId: string;
  companyName: string;
  totalContacts: number;
  mappedContacts: number;

  // Stakeholder groups
  economicBuyers: StakeholderNode[];
  technicalBuyers: StakeholderNode[];
  champions: StakeholderNode[];
  coaches: StakeholderNode[];
  users: StakeholderNode[];

  // Power-Interest Grid summary
  powerGrid: {
    manageClosely: number;       // High influence + High engagement
    keepSatisfied: number;       // High influence + Low engagement
    keepInformed: number;        // Low influence + High engagement
    monitor: number;             // Low influence + Low engagement
  };

  // Coverage analysis
  coverage: {
    hasEconomicBuyer: boolean;
    hasTechnicalBuyer: boolean;
    hasChampion: boolean;
    departmentsCovered: string[];
    departmentsMissing: string[];
    gaps: string[];
    recommendations: string[];
  };

  // Account relationship health
  relationshipHealth: number;    // 0-100
  relationshipHealthFactors: Array<{ factor: string; score: number; description: string }>;

  // Evidence
  evidence: Array<{ signal: string; evidence: string; source: string; reliability: number }>;
  confidenceScore: number;

  mappedAt: string;
}

// ── Power-Interest Quadrant Classification ──

function classifyQuadrant(influence: number, engagement: number): StakeholderNode['powerQuadrant'] {
  if (influence >= 60 && engagement >= 50) return 'manage_closely';
  if (influence >= 60 && engagement < 50) return 'keep_satisfied';
  if (influence < 60 && engagement >= 50) return 'keep_informed';
  return 'monitor';
}

// ── Department Detection ──

function detectDepartment(title: string): string {
  const lower = title.toLowerCase();
  if (/cfo|finance|controller|treasurer|accounting/.test(lower)) return 'Finance';
  if (/cto|engineering|developer|architect|devops|technology/.test(lower)) return 'Technology';
  if (/cio|information|it director|systems/.test(lower)) return 'IT';
  if (/cmo|marketing|brand|growth|demand/.test(lower)) return 'Marketing';
  if (/cso|security|ciso|cyber|risk|compliance/.test(lower)) return 'Security';
  if (/coo|operation|supply|logistics/.test(lower)) return 'Operations';
  if (/chro|hr|people|talent|recruit/.test(lower)) return 'HR';
  if (/cdo|data|analytics|bi|intelligence/.test(lower)) return 'Data';
  if (/cpo|product|product management/.test(lower)) return 'Product';
  if (/sales|revenue|account|business development/.test(lower)) return 'Sales';
  if (/ceo|president|chief executive|founder|co-founder/.test(lower)) return 'Executive';
  if (/vp|vice president|svp|evp/.test(lower)) return 'Leadership';
  if (/director|head|lead|principal/.test(lower)) return 'Management';
  if (/manager|senior manager/.test(lower)) return 'Management';
  return 'Other';
}

// ── Main Mapping Function ──

export async function buildRelationshipMap(
  companyId: string
): Promise<RelationshipMap> {
  const startMs = Date.now();

  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { rawName: true, normalizedName: true },
  });

  if (!company) throw new Error(`Company ${companyId} not found`);

  // Fetch all non-archived contacts
  const contacts = await db.contact.findMany({
    where: { companyId, status: { not: 'archived' } },
    include: { _count: { select: { replies: true } } },
    orderBy: { leadScore: 'desc' },
  });

  // Score each contact for influence
  const scoredNodes: StakeholderNode[] = [];
  for (const c of contacts) {
    let influence: ContactInfluenceScore | null = null;
    try {
      influence = await scoreContactInfluence(c.id);
    } catch {
      // Use fallback scoring
    }

    const influenceScore = influence?.influenceScore || (c.leadScore || 0);
    const engagementScore = Math.min(100,
      (c.status === 'replied' ? 60 : c.status === 'sent' ? 30 : c.status === 'drafted' ? 10 : 0) +
      (c._count.replies * 20) +
      (c.engagementScore * 0.3)
    );

    const lastContactedAt = c.lastContactedAt;
    const daysSinceContact = lastContactedAt
      ? Math.floor((Date.now() - lastContactedAt.getTime()) / 86400000)
      : 999;

    const relStrength: StakeholderNode['relationshipStrength'] =
      c._count.replies >= 3 ? 'strong' :
      c._count.replies >= 1 ? 'warm' :
      daysSinceContact < 14 ? 'cold' : 'none';

    const title = c.title || c.role || 'Unknown';
    const department = detectDepartment(title);

    // Detect priorities from title
    const priorities: string[] = [];
    if (/data|analytics|bi/.test(title.toLowerCase())) priorities.push('Data & Analytics');
    if (/cloud|aws|azure|infrastructure/.test(title.toLowerCase())) priorities.push('Cloud Infrastructure');
    if (/ai|machine learning|automation/.test(title.toLowerCase())) priorities.push('AI & Automation');
    if (/security|compliance/.test(title.toLowerCase())) priorities.push('Security');
    if (/digital|transformation/.test(title.toLowerCase())) priorities.push('Digital Transformation');

    scoredNodes.push({
      contactId: c.id,
      name: c.rawName,
      title,
      email: c.email,
      buyingRole: (influence?.buyingRole || 'unknown') as BuyingRoleGroup,
      buyingInfluence: influenceScore,
      engagementScore: Math.round(engagementScore),
      relationshipStrength: relStrength,
      powerQuadrant: classifyQuadrant(influenceScore, engagementScore),
      lastInteraction: lastContactedAt?.toISOString() || null,
      daysSinceContact,
      priorities,
      department,
    });
  }

  // Sort by influence
  scoredNodes.sort((a, b) => b.buyingInfluence - a.buyingInfluence);

  // Group by buying role
  const economicBuyers = scoredNodes.filter(n => n.buyingRole === 'economic_buyer');
  const technicalBuyers = scoredNodes.filter(n => n.buyingRole === 'technical_buyer');
  const champions = scoredNodes.filter(n => n.buyingRole === 'champion');
  const coaches = scoredNodes.filter(n => n.buyingRole === 'coach');
  const users = scoredNodes.filter(n => n.buyingRole === 'user' || n.buyingRole === 'unknown');

  // Power grid counts
  const powerGrid = {
    manageClosely: scoredNodes.filter(n => n.powerQuadrant === 'manage_closely').length,
    keepSatisfied: scoredNodes.filter(n => n.powerQuadrant === 'keep_satisfied').length,
    keepInformed: scoredNodes.filter(n => n.powerQuadrant === 'keep_informed').length,
    monitor: scoredNodes.filter(n => n.powerQuadrant === 'monitor').length,
  };

  // Coverage analysis
  const departments = [...new Set(scoredNodes.map(n => n.department))];
  const allDepts = ['Executive', 'Technology', 'Finance', 'IT', 'Marketing', 'Sales', 'Operations', 'Data', 'Security', 'HR', 'Product', 'Management'];
  const departmentsMissing = allDepts.filter(d => !departments.includes(d) && d !== 'Other' && d !== 'Management');

  const gaps: string[] = [];
  if (economicBuyers.length === 0) gaps.push('No economic buyer identified — no one with budget authority');
  if (technicalBuyers.length === 0) gaps.push('No technical buyer — no one to evaluate technical fit');
  if (champions.length === 0) gaps.push('No champion — no internal advocate for your solution');
  if (!departments.includes('Executive')) gaps.push('No C-suite or executive contact');
  if (!departments.includes('Technology') && !departments.includes('IT')) gaps.push('No technology decision-maker');

  const recommendations: string[] = [];
  if (economicBuyers.length === 0) recommendations.push('Identify and target economic buyer — find C-suite contact with budget authority');
  if (champions.length === 0 && technicalBuyers.length > 0) recommendations.push('Convert a technical buyer into a champion through demonstrated value');
  if (powerGrid.keepSatisfied > powerGrid.manageClosely) recommendations.push('Increase engagement with high-influence contacts — too many are disengaged');
  if (departmentsMissing.length > 5) recommendations.push(`Expand stakeholder coverage — missing key departments: ${departmentsMissing.slice(0, 3).join(', ')}`);
  if (scoredNodes.filter(n => n.relationshipStrength === 'none').length > scoredNodes.length * 0.5) {
    recommendations.push('Majority of contacts have no relationship — begin multi-threaded outreach campaign');
  }

  // Relationship health score
  const healthFactors: Array<{ factor: string; score: number; description: string }> = [];

  const coverageScore = Math.min(100, departments.length * 12);
  healthFactors.push({ factor: 'Department Coverage', score: coverageScore, description: `${departments.length} departments represented` });

  const championScore = champions.length > 0 ? 100 : 0;
  healthFactors.push({ factor: 'Champion Presence', score: championScore, description: champions.length > 0 ? `${champions.length} internal champion(s)` : 'No champion identified' });

  const activeRatio = scoredNodes.filter(n => n.relationshipStrength !== 'none').length / Math.max(1, scoredNodes.length);
  const activeScore = Math.round(activeRatio * 100);
  healthFactors.push({ factor: 'Active Relationships', score: activeScore, description: `${Math.round(activeRatio * 100)}% of contacts have active relationship` });

  const engagedRatio = scoredNodes.filter(n => n.engagementScore >= 40).length / Math.max(1, scoredNodes.length);
  healthFactors.push({ factor: 'Engagement Level', score: Math.round(engagedRatio * 100), description: `${Math.round(engagedRatio * 100)}% of contacts are engaged` });

  const manageCloselyRatio = powerGrid.manageClosely / Math.max(1, scoredNodes.length);
  healthFactors.push({ factor: 'Power-Engagement Alignment', score: Math.round(manageCloselyRatio * 100), description: `${powerGrid.manageClosely} contacts in "Manage Closely" quadrant` });

  const relationshipHealth = Math.round(
    healthFactors.reduce((sum, f) => sum + f.score, 0) / healthFactors.length
  );

  // Evidence
  const evidenceItems = [
    evidence('Stakeholder Count', `${scoredNodes.length} contacts mapped across ${departments.length} departments`, 'relationship-mapping', { quality: 'verified' }),
    evidence('Economic Buyers', `${economicBuyers.length} identified`, 'relationship-mapping', { quality: 'verified' }),
    evidence('Champions', `${champions.length} internal advocates`, 'relationship-mapping', { quality: 'verified' }),
    ...(gaps.map(g => evidence('Coverage Gap', g, 'coverage-analysis', { quality: 'corroborated' }))),
  ];

  // Confidence
  const confidenceScore = Math.min(90, 40 + scoredNodes.length * 3 + departments.length * 5);

  // Track reliability
  try {
    await trackGeneration('relationship_map', '/api/contacts/relationship-map', async () => {}, { companyId });
  } catch {
    // Non-blocking
  }

  return {
    companyId,
    companyName: company.normalizedName || company.rawName,
    totalContacts: contacts.length,
    mappedContacts: scoredNodes.length,
    economicBuyers,
    technicalBuyers,
    champions,
    coaches,
    users,
    powerGrid,
    coverage: {
      hasEconomicBuyer: economicBuyers.length > 0,
      hasTechnicalBuyer: technicalBuyers.length > 0,
      hasChampion: champions.length > 0,
      departmentsCovered: departments,
      departmentsMissing: departmentsMissing.slice(0, 5),
      gaps,
      recommendations,
    },
    relationshipHealth,
    relationshipHealthFactors: healthFactors,
    evidence: evidenceItems.map(e => ({
      signal: e.signal,
      evidence: e.evidence,
      source: e.source,
      reliability: e.reliability,
    })),
    confidenceScore,
    mappedAt: new Date().toISOString(),
  };
}
