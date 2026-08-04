/**
 * DeepMindQ — Golden Document Dataset for Enterprise Testing
 * Milestone 3 — Section 3.4: Golden Dataset Fixtures
 *
 * Provides realistic document/intelligence records for AI testing,
 * hallucination detection, and knowledge graph validation.
 */

export interface GoldenDocument {
  id: string;
  title: string;
  source: string;
  sourceType: 'news' | 'filing' | 'social' | 'press_release' | 'research' | 'internal';
  content: string;
  summary: string;
  entities: string[];
  sentiment: 'positive' | 'negative' | 'neutral';
  confidence: number; // 0-100
  publishedAt: string;
  companyId: string;
  tags: string[];
  isVerified: boolean;
  citationUrl: string | null;
}

export const GOLDEN_DOCUMENTS: GoldenDocument[] = [
  {
    id: 'doc-001',
    title: 'TechCorp India Raises $50M Series C for AI Expansion',
    source: 'Economic Times',
    sourceType: 'news',
    content: 'Bangalore-based TechCorp India has raised $50 million in Series C funding led by Sequoia Capital India. The company plans to use the funds to expand its AI-powered enterprise intelligence platform across Southeast Asian markets. CEO Rajesh Mehta stated that the funding will help scale their go-to-market operations and invest in R&D for next-generation AI models.',
    summary: 'TechCorp India secured $50M Series C to expand AI platform in Southeast Asia.',
    entities: ['TechCorp India', 'Sequoia Capital India', 'Rajesh Mehta'],
    sentiment: 'positive',
    confidence: 95,
    publishedAt: '2026-07-28T06:00:00Z',
    companyId: 'company-techcorp',
    tags: ['funding', 'ai', 'expansion', 'series-c'],
    isVerified: true,
    citationUrl: 'https://economictimes.indiatimes.com/techcorp-raises-50m',
  },
  {
    id: 'doc-002',
    title: 'GlobalFin Corp Reports Q2 Revenue Growth of 23%',
    source: 'SEC Filing 10-Q',
    sourceType: 'filing',
    content: 'GlobalFin Corporation reported Q2 2026 total revenue of $2.3 billion, representing a 23% year-over-year increase. The company attributed growth to expansion of its digital banking platform and increased enterprise client acquisition. Operating margin improved to 31.2% from 28.7% in the prior year period.',
    summary: 'GlobalFin Q2 revenue reached $2.3B, up 23% YoY, driven by digital banking expansion.',
    entities: ['GlobalFin Corp', 'SEC'],
    sentiment: 'positive',
    confidence: 98,
    publishedAt: '2026-07-15T12:00:00Z',
    companyId: 'company-globalfin',
    tags: ['earnings', 'revenue', 'financial', 'quarterly'],
    isVerified: true,
    citationUrl: 'https://sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001234567',
  },
  {
    id: 'doc-003',
    title: 'HealthBridge Solutions Acquires MedTech startup',
    source: 'Press Release',
    sourceType: 'press_release',
    content: 'HealthBridge Solutions announced the acquisition of MedTech Analytics, a health data startup, for an undisclosed amount. The acquisition will strengthen HealthBridge\'s data analytics capabilities and expand its presence in the South Indian healthcare market. Integration is expected to complete by Q4 2026.',
    summary: 'HealthBridge acquired MedTech Analytics to strengthen healthcare data capabilities.',
    entities: ['HealthBridge Solutions', 'MedTech Analytics'],
    sentiment: 'positive',
    confidence: 85,
    publishedAt: '2026-07-01T08:00:00Z',
    companyId: 'company-healthbridge',
    tags: ['acquisition', 'healthcare', 'analytics', 'growth'],
    isVerified: true,
    citationUrl: 'https://healthbridge.in/press/medtech-acquisition',
  },
  {
    id: 'doc-004',
    title: 'InnovateAI Launches Next-Gen Conversational AI Platform',
    source: 'TechCrunch India',
    sourceType: 'news',
    content: 'InnovateAI has launched its next-generation conversational AI platform targeting enterprise sales teams. The platform uses advanced language models to automate prospect research, generate personalized outreach, and provide real-time deal intelligence. Early adopters report a 40% increase in meeting bookings.',
    summary: 'InnovateAI launched a conversational AI platform for enterprise sales teams.',
    entities: ['InnovateAI'],
    sentiment: 'positive',
    confidence: 80,
    publishedAt: '2026-07-20T10:00:00Z',
    companyId: 'company-innovateai',
    tags: ['product-launch', 'conversational-ai', 'sales', 'enterprise'],
    isVerified: true,
    citationUrl: 'https://techcrunch.in/innovateai-launches-platform',
  },
  {
    id: 'doc-005',
    title: 'RetailMax Expands Operations to Asia-Pacific Region',
    source: 'Reuters',
    sourceType: 'news',
    content: 'London-based RetailMax has announced plans to expand its e-commerce intelligence platform into the Asia-Pacific region, starting with Singapore and Australia. CRO David Williams cited growing demand for AI-powered retail analytics in emerging markets. The expansion is expected to create 200 new jobs.',
    summary: 'RetailMax expanding APAC operations starting with Singapore and Australia.',
    entities: ['RetailMax', 'David Williams'],
    sentiment: 'positive',
    confidence: 90,
    publishedAt: '2026-07-30T07:00:00Z',
    companyId: 'company-retailmax',
    tags: ['expansion', 'apac', 'retail', 'hiring'],
    isVerified: true,
    citationUrl: 'https://reuters.com/business/retailmax-asia-expansion',
  },
  {
    id: 'doc-006',
    title: 'PharmaGlobal Faces Regulatory Scrutiny in EU Markets',
    source: 'Financial Times',
    sourceType: 'news',
    content: 'PharmaGlobal is facing increased regulatory scrutiny from the European Medicines Agency over its drug approval processes. The company disclosed that it has set aside $150 million for potential compliance-related costs. Shares fell 8% on the news. CEO Mark Thompson stated the company is cooperating fully with regulators.',
    summary: 'PharmaGlobal under EU regulatory scrutiny with $150M set aside for compliance.',
    entities: ['PharmaGlobal', 'European Medicines Agency', 'Mark Thompson'],
    sentiment: 'negative',
    confidence: 92,
    publishedAt: '2026-07-18T14:00:00Z',
    companyId: 'company-pharmaglobal',
    tags: ['regulatory', 'compliance', 'risk', 'pharma'],
    isVerified: true,
    citationUrl: 'https://ft.com/pharmaglobal-regulatory-scrutiny',
  },
  {
    id: 'doc-007',
    title: 'AutoWerks GmbH Partners with TechFront Japan',
    source: 'Nikkei Asia',
    sourceType: 'news',
    content: 'German automotive supplier AutoWerks GmbH has entered a strategic partnership with TechFront Japan to develop AI-powered supply chain optimization tools. The joint venture will combine AutoWerks\' manufacturing expertise with TechFront\'s AI capabilities. Initial deployment is planned for 12 factories across Germany and Japan.',
    summary: 'AutoWerks and TechFront Japan partner on AI supply chain optimization.',
    entities: ['AutoWerks GmbH', 'TechFront Japan'],
    sentiment: 'positive',
    confidence: 88,
    publishedAt: '2026-07-22T03:00:00Z',
    companyId: 'company-autowerks',
    tags: ['partnership', 'automotive', 'ai', 'supply-chain'],
    isVerified: true,
    citationUrl: 'https://asia.nikkei.com/autowerks-techfront-partnership',
  },
  {
    id: 'doc-008',
    title: 'FinServe Analytics Recognized as Gartner Magic Quadrant Leader',
    source: 'Gartner Press Release',
    sourceType: 'press_release',
    content: 'FinServe Analytics has been named a Leader in the 2026 Gartner Magic Quadrant for Financial Analytics and BI Platforms. This marks the third consecutive year the company has achieved Leader status. Gartner cited FinServe\'s AI-driven forecasting capabilities and strong customer satisfaction scores as key differentiators.',
    summary: 'FinServe Analytics named 2026 Gartner Magic Quadrant Leader for Financial Analytics.',
    entities: ['FinServe Analytics', 'Gartner'],
    sentiment: 'positive',
    confidence: 99,
    publishedAt: '2026-08-01T09:00:00Z',
    companyId: 'company-finserve',
    tags: ['analyst-report', 'gartner', 'leadership', 'recognition'],
    isVerified: true,
    citationUrl: 'https://gartner.com/press/2026-financial-analytics-mq',
  },
  {
    id: 'doc-009',
    title: 'Unverified: StartupHub to Acquire Competitor',
    source: 'Social Media Rumor',
    sourceType: 'social',
    content: 'Unverified social media reports suggest StartupHub is in advanced talks to acquire competitor SalesStack. Neither company has confirmed the rumors. Industry analysts note that such an acquisition would make strategic sense given overlapping product portfolios.',
    summary: 'Unverified rumor: StartupHub reportedly in acquisition talks with SalesStack.',
    entities: ['StartupHub', 'SalesStack'],
    sentiment: 'neutral',
    confidence: 30,
    publishedAt: '2026-07-25T18:00:00Z',
    companyId: 'company-startuphub',
    tags: ['rumor', 'acquisition', 'unverified', 'social'],
    isVerified: false,
    citationUrl: null,
  },
  {
    id: 'doc-010',
    title: 'Internal: Q3 Sales Pipeline Review',
    source: 'Internal CRM Report',
    sourceType: 'internal',
    content: 'Q3 pipeline stands at $4.2M across 23 active deals. Top prospects include TechCorp ($800K), GlobalFin ($650K), and RetailMax ($500K). Average deal cycle has reduced from 45 to 38 days. AI-driven intelligence insights contributed to a 28% improvement in win rates. Churn risk identified for 3 enterprise accounts.',
    summary: 'Q3 pipeline at $4.2M with 23 deals; AI insights improved win rates by 28%.',
    entities: ['TechCorp', 'GlobalFin', 'RetailMax'],
    sentiment: 'positive',
    confidence: 100,
    publishedAt: '2026-07-31T23:59:00Z',
    companyId: 'company-deepmindq',
    tags: ['internal', 'pipeline', 'quarterly', 'sales-intelligence'],
    isVerified: true,
    citationUrl: null,
  },
];

// Helper: Get verified documents only
export function getVerifiedDocuments(): GoldenDocument[] {
  return GOLDEN_DOCUMENTS.filter(d => d.isVerified);
}

// Helper: Get documents by source type
export function getDocumentsBySource(sourceType: GoldenDocument['sourceType']): GoldenDocument[] {
  return GOLDEN_DOCUMENTS.filter(d => d.sourceType === sourceType);
}

// Helper: Get high-confidence documents (>=80)
export function getHighConfidenceDocuments(): GoldenDocument[] {
  return GOLDEN_DOCUMENTS.filter(d => d.confidence >= 80);
}

// Helper: Get documents by sentiment
export function getDocumentsBySentiment(sentiment: GoldenDocument['sentiment']): GoldenDocument[] {
  return GOLDEN_DOCUMENTS.filter(d => d.sentiment === sentiment);
}

// Helper: Get document by ID
export function getDocumentById(id: string): GoldenDocument | undefined {
  return GOLDEN_DOCUMENTS.find(d => d.id === id);
}

// Helper: Get documents for a company
export function getDocumentsByCompany(companyId: string): GoldenDocument[] {
  return GOLDEN_DOCUMENTS.filter(d => d.companyId === companyId);
}

/**
 * Hallucination test pairs — known truths vs plausible fabrications
 * Used to validate hallucination detection systems
 */
export const HALLUCINATION_TEST_PAIRS = [
  {
    claim: 'TechCorp India raised $50M in Series C',
    isTruthful: true,
    supportingDocIds: ['doc-001'],
    fabricatedAlternative: 'TechCorp India raised $500M in Series C',
  },
  {
    claim: 'GlobalFin Q2 revenue was $2.3 billion',
    isTruthful: true,
    supportingDocIds: ['doc-002'],
    fabricatedAlternative: 'GlobalFin Q2 revenue was $5.7 billion',
  },
  {
    claim: 'HealthBridge acquired MedTech for $200M',
    isTruthful: false,
    supportingDocIds: ['doc-003'],
    fabricatedAlternative: 'HealthBridge acquired MedTech for an undisclosed amount',
    correctionNote: 'The actual document states "undisclosed amount", not $200M',
  },
  {
    claim: 'StartupHub acquired SalesStack',
    isTruthful: false,
    supportingDocIds: ['doc-009'],
    fabricatedAlternative: 'StartupHub is reportedly in talks to acquire SalesStack',
    correctionNote: 'This is an unverified rumor, not a completed acquisition',
  },
  {
    claim: 'FinServe Analytics was named a Gartner Leader in 2026',
    isTruthful: true,
    supportingDocIds: ['doc-008'],
    fabricatedAlternative: 'FinServe Analytics was named a Gartner Challenger in 2026',
  },
];
