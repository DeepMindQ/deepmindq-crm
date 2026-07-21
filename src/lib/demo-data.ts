/**
 * Canonical Demo Data — Single Source of Truth
 *
 * All demo/fallback data across screens and API routes
 * MUST consume from this module. Do NOT define inline
 * DEMO_* constants in screen components or API routes.
 *
 * Excluded from TypeScript compilation (see tsconfig.json).
 */

// ── Demo Company Cards ────────────────────────────────────────────────

export interface DemoCompanyCard {
  id: string;
  name: string;
  industry: string;
  country: string;
  score: number;
  health: number;
  signals: number;
  sources: number;
  reason: string;
  action: string;
  confidence: 'high' | 'medium' | 'low';
  tagline?: string;
  tier?: 'HIGH' | 'MEDIUM' | 'LOW';
}

export const DEMO_COMPANIES: DemoCompanyCard[] = [
  {
    id: 'demo-aramco.com',
    name: 'Saudi Aramco',
    industry: 'Oil & Gas',
    country: 'Saudi Arabia',
    score: 91,
    health: 78,
    signals: 12,
    sources: 8,
    reason: 'AI transformation signals increased 45% in last 60 days',
    action: 'Engage CIO office for AI transformation discussion',
    confidence: 'high',
    tagline: 'AI transformation signals',
    tier: 'HIGH',
  },
  {
    id: 'demo-adnoc.ae',
    name: 'ADNOC',
    industry: 'Oil & Gas',
    country: 'UAE',
    score: 88,
    health: 75,
    signals: 10,
    sources: 7,
    reason: 'Cloud modernization activity detected across multiple sources',
    action: 'Target CIO office for cloud strategy conversation',
    confidence: 'high',
    tagline: 'Cloud modernization activity',
    tier: 'HIGH',
  },
  {
    id: 'demo-stc.com.sa',
    name: 'STC',
    industry: 'Telecommunications',
    country: 'Saudi Arabia',
    score: 86,
    health: 72,
    signals: 9,
    sources: 6,
    reason: 'Data platform investment signals with executive alignment',
    action: 'Engage Digital Transformation team',
    confidence: 'high',
    tagline: 'Data platform investment',
    tier: 'HIGH',
  },
  {
    id: 'demo-emiratesnbd.com',
    name: 'Emirates NBD',
    industry: 'Banking & Finance',
    country: 'UAE',
    score: 82,
    health: 70,
    signals: 8,
    sources: 5,
    reason: 'Digital banking expansion with AI integration focus',
    action: 'Connect with Chief Digital Officer',
    confidence: 'medium',
    tagline: 'Digital banking expansion',
    tier: 'HIGH',
  },
  {
    id: 'demo-neom.com',
    name: 'NEOM',
    industry: 'Technology & Innovation',
    country: 'Saudi Arabia',
    score: 79,
    health: 68,
    signals: 7,
    sources: 5,
    reason: 'Smart city technology procurement signals',
    action: 'Explore partnership through innovation office',
    confidence: 'medium',
    tagline: 'Smart city procurement',
    tier: 'MEDIUM',
  },
];

// ── Intelligence Brief Data ────────────────────────────────────────────

export interface DemoFactor {
  factor: string;
  impact: string;
  category?: string;
}

export interface DemoBriefData {
  company: {
    name: string;
    industry: string;
    location: string;
    sizeRange: string;
    website: string;
  };
  overallScore: number;
  confidence: string;
  summary: string;
  positiveFactors: DemoFactor[];
  negativeFactors: DemoFactor[];
  breakdown: {
    signalQuality: number;
    evidenceQuality: number;
    capabilityFit: number;
    dataCompleteness: number;
  };
  evidenceTimeline: Array<{ date: string; event: string; type: string }>;
  recommendation: {
    target: string;
    conversation: string;
    entryPoint: string;
    reason: string;
  };
  conflicts: Array<{ type: string; severity: string; description: string }>;
  evidenceStats: { total: number; highQuality: number; sources: number; avgRelevance: number };
  capabilityMatch?: { matchPercent: number; recommendedCapability: string };
}

export const DEMO_BRIEF: DemoBriefData = {
  company: {
    name: 'Saudi Aramco',
    industry: 'Oil & Gas',
    location: 'Dhahran, Saudi Arabia',
    sizeRange: '10000+',
    website: 'aramco.com',
  },
  overallScore: 91,
  confidence: 'High',
  summary:
    'Large enterprise showing multiple digital transformation signals with strong alignment to AI modernization capabilities. The organization has publicly committed to cloud-first strategy and is actively building AI/ML teams.',
  positiveFactors: [
    { factor: 'Cloud modernization initiative detected', impact: '+12' },
    { factor: 'AI/ML hiring activity increased 40%', impact: '+10' },
    { factor: 'Technology investment signals confirmed', impact: '+8' },
    { factor: 'Strong capability alignment (94%)', impact: '+8' },
    { factor: 'Multiple independent sources (8 domains)', impact: '+5' },
  ],
  negativeFactors: [
    { factor: 'Limited executive contact intelligence', impact: '-8' },
    { factor: 'One conflicting technology signal detected', impact: '-5' },
  ],
  breakdown: {
    signalQuality: 92,
    evidenceQuality: 89,
    capabilityFit: 94,
    dataCompleteness: 87,
  },
  evidenceTimeline: [
    { date: 'May 2026', event: 'AI transformation announcement detected', type: 'signal' },
    { date: 'Jun 2026', event: 'Cloud engineering hiring increased 40%', type: 'signal' },
    { date: 'Jun 2026', event: 'Technology modernization confirmed by 3 sources', type: 'evidence' },
    { date: 'Jul 2026', event: 'Executive alignment signals detected', type: 'signal' },
    { date: 'Jul 2026', event: 'Vendor evaluation signals identified', type: 'signal' },
  ],
  recommendation: {
    target: 'Chief Digital Officer / CIO',
    conversation: 'AI-led operational transformation assessment',
    entryPoint: 'Digital transformation workshop',
    reason: 'Active cloud transformation signals with executive buy-in indicators',
  },
  conflicts: [
    {
      type: 'SIGNAL_CONTRADICTION',
      severity: 'MEDIUM',
      description: 'Conflicting on-premise and cloud migration signals detected',
    },
  ],
  evidenceStats: { total: 12, highQuality: 8, sources: 8, avgRelevance: 82 },
  capabilityMatch: { matchPercent: 94, recommendedCapability: 'AI Transformation Platform' },
};

// ── Trust Report / Intelligence Reasoning Data ────────────────────────

export interface DemoTrustReportData {
  recommendation: {
    id: string;
    title: string;
    company: string;
    confidenceScore: number;
  };
  overallConfidence: number;
  breakdown: {
    signalQuality: number;
    evidenceQuality: number;
    capabilityFit: number;
    dataCompleteness: number;
    overall: number;
  };
  factors: {
    positiveFactors: DemoFactor[];
    negativeFactors: DemoFactor[];
  };
  aiReasoning: string;
  supportingEvidence: {
    total: number;
    avgRelevance: number;
    validatedSignals: number;
    weakSignals: number;
  };
  evidenceRows: Array<{ source: string; date: string; quality: string; impact: string }>;
  conflicts: Array<{
    conflictType: string;
    severity: string;
    description: string;
  }>;
  missingIntelligence: Array<{
    category: string;
    description: string;
    improvementHint: string;
  }>;
}

export const DEMO_TRUST_REPORT: DemoTrustReportData = {
  recommendation: {
    id: 'demo-001',
    title: 'AI Transformation Platform Opportunity',
    company: 'Saudi Aramco',
    confidenceScore: 87,
  },
  overallConfidence: 87,
  breakdown: {
    signalQuality: 92,
    evidenceQuality: 85,
    capabilityFit: 94,
    dataCompleteness: 78,
    overall: 87,
  },
  factors: {
    positiveFactors: [
      { factor: 'Cloud modernization initiative publicly announced', impact: '+12', category: 'Signal' },
      { factor: 'AI/ML hiring activity increased 40% over 6 months', impact: '+10', category: 'Signal' },
      { factor: 'Technology investment signals confirmed by 3 independent sources', impact: '+8', category: 'Evidence' },
      { factor: 'Strong capability alignment score (94%)', impact: '+8', category: 'Fit' },
      { factor: 'Executive digital transformation mandate detected', impact: '+7', category: 'Signal' },
      { factor: 'Multiple validated signals from diverse sources (8 domains)', impact: '+5', category: 'Evidence' },
    ],
    negativeFactors: [
      { factor: 'Limited executive contact intelligence available', impact: '-8', category: 'Data' },
      { factor: 'One conflicting on-premise technology signal detected', impact: '-5', category: 'Conflict' },
    ],
  },
  aiReasoning: 'Multiple independent signals indicate active digital transformation investment. The company has publicly announced cloud modernization initiatives, shown a 40% increase in AI/ML hiring over the past 6 months, and has technology investment signals confirmed by at least 3 independent sources. Executive-level digital transformation mandates further strengthen confidence. The primary data gaps relate to executive contact intelligence and a minor conflicting on-premise signal that requires human verification.',
  supportingEvidence: {
    total: 12,
    avgRelevance: 84,
    validatedSignals: 9,
    weakSignals: 3,
  },
  evidenceRows: [
    { source: 'LinkedIn Job Postings', date: 'Jun 2026', quality: 'High', impact: '+10' },
    { source: 'Press Release (Official)', date: 'May 2026', quality: 'High', impact: '+12' },
    { source: 'Industry Analyst Report', date: 'Jun 2026', quality: 'High', impact: '+8' },
    { source: 'Technology News Outlet', date: 'Jul 2026', quality: 'Medium', impact: '+5' },
    { source: 'Conference Proceedings', date: 'May 2026', quality: 'Medium', impact: '+4' },
  ],
  conflicts: [
    {
      conflictType: 'SIGNAL_CONTRADICTION',
      severity: 'MEDIUM',
      description: 'Conflicting signals detected between on-premise infrastructure investment and cloud migration narrative. One source indicates continued data center expansion while three others point to cloud-first strategy.',
    },
    {
      conflictType: 'TIMELINE_INCONSISTENCY',
      severity: 'LOW',
      description: 'Hiring data suggests acceleration started Q1 2026, but official announcements reference Q2 2026 as the start date.',
    },
  ],
  missingIntelligence: [
    { category: 'Executive Contacts', description: 'Missing CIO/CDO contact information and decision-making hierarchy', improvementHint: 'Adding executive contacts would improve data completeness by ~15%' },
    { category: 'Financial Signals', description: 'No recent financial signals or budget allocation data', improvementHint: 'Recent financial signals would strengthen evidence quality' },
    { category: 'Technology Confirmation', description: 'Direct technology stack confirmation not yet available', improvementHint: 'A direct technology confirmation would eliminate the on-premise conflict' },
  ],
};

// ── Demo Filter Fallbacks ─────────────────────────────────────────────

export const DEMO_INDUSTRIES = [
  'Technology', 'Financial Services', 'Healthcare', 'IT Services',
  'E-commerce', 'Manufacturing', 'Fintech', 'Aerospace',
];

export const DEMO_COUNTRIES = ['US', 'IN', 'GB', 'CA', 'DE', 'KR', 'NG'];

// ── Helper: Check if a company ID is a demo ID ───────────────────────

const DEMO_ID_PREFIX = 'demo-';

export function isDemoId(id: string | undefined | null): boolean {
  if (!id) return false;
  return id.startsWith(DEMO_ID_PREFIX);
}