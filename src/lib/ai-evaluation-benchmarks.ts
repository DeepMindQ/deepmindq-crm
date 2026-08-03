/**
 * AI Evaluation Benchmarks — WI-16E
 * ====================================
 *
 * Enterprise Intelligence Benchmark Dataset for DeepMindQ AI evaluation.
 *
 * Contains curated test cases across 10 intelligence categories:
 *   1. Company Intelligence     — Company profiling, industry analysis
 *   2. Contact Intelligence     — Stakeholder mapping, decision maker ID
 *   3. Signal Detection         — Trigger identification, event classification
 *   4. Opportunity Prediction   — Win probability, pipeline assessment
 *   5. Recommendation           — Next-best-action, capability matching
 *   6. Brief Generation         — Executive briefs, account summaries
 *   7. Scoring                  — Revenue intelligence scoring
 *   8. Conversation Planning    — Meeting prep, talking points
 *   9. Email Generation         — Outreach email drafting
 *  10. Strategy                 — Competitive positioning, go-to-market
 *
 * Each benchmark case contains:
 *   - Input: Company data, signals, evidence, context
 *   - Expected: Correct facts, required claims, confidence range
 *   - Constraints: Forbidden claims, minimum score thresholds
 *
 * DESIGN PRINCIPLES:
 *   - Benchmarks are deterministic (no randomness in expected outputs)
 *   - Cases span difficulty levels (basic → edge_case)
 *   - Each category has multiple cases for statistical significance
 *   - Forbidden claims test hallucination prevention
 *   - Required claims test completeness
 *   - Confidence ranges test calibration
 *
 * NON-THROWING: Returns arrays, never throws.
 */

import type { BenchmarkCase, EvaluatedEngine, IntelligenceCategory } from './ai-evaluation-engine';

// ── Types ────────────────────────────────────────────────────────────────────

export interface BenchmarkSuite {
  /** Suite ID. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Description of what this suite tests. */
  description: string;
  /** The benchmark cases. */
  cases: BenchmarkCase[];
}

// ── Benchmark Case Builders ────────────────────────────────────────────────

/** Helper to create a benchmark case. */
function benchmark(
  id: string,
  name: string,
  targetEngine: EvaluatedEngine,
  category: IntelligenceCategory,
  difficulty: 'basic' | 'intermediate' | 'advanced' | 'edge_case',
  input: BenchmarkCase['input'],
  expected: BenchmarkCase['expected'],
  options: {
    maxHallucinationRate?: number;
    minScore?: number;
    forbiddenClaims?: string[];
    requiredClaims?: string[];
    allowedConfidenceRange?: { min: number; max: number };
    tags?: string[];
  } = {},
): BenchmarkCase {
  return {
    id,
    name,
    targetEngine,
    category,
    difficulty,
    input,
    expected,
    maxHallucinationRate: options.maxHallucinationRate ?? 0.15,
    minScore: options.minScore ?? 65,
    forbiddenClaims: options.forbiddenClaims,
    requiredClaims: options.requiredClaims,
    allowedConfidenceRange: options.allowedConfidenceRange,
    tags: options.tags ?? [category, targetEngine],
    active: true,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// BENCHMARK SUITE 1: Company Intelligence
// ═══════════════════════════════════════════════════════════════════════════

const companyIntelligenceBenchmarks: BenchmarkCase[] = [
  benchmark(
    'CI-001',
    'Basic company profile with strong evidence',
    'synthesis_engine',
    'company_intelligence',
    'basic',
    {
      query: 'Provide a company intelligence summary for TechVault Inc.',
      companyData: {
        name: 'TechVault Inc.',
        industry: 'Cloud Infrastructure',
        size: '500-1000',
        revenue: '$120M',
        technology: ['AWS', 'Kubernetes', 'Terraform', 'Go'],
        location: 'San Francisco, CA',
      },
      signals: [
        { type: 'growth_signal', description: 'TechVault raised $50M Series D at $500M valuation', source: 'TechCrunch', date: '2025-01-15', confidence: 0.9 },
        { type: 'technology_trigger', description: 'TechVault migrated 80% of workloads to Kubernetes', source: 'Company Blog', date: '2025-02-01', confidence: 0.85 },
      ],
      evidence: [
        { id: 'E1', text: 'TechVault Inc. is a cloud infrastructure company based in San Francisco, specializing in container orchestration and infrastructure automation.', source: 'LinkedIn', reliability: 0.9 },
        { id: 'E2', text: 'TechVault raised $50M in Series D funding, bringing total funding to $180M. The round was led by Sequoia Capital.', source: 'TechCrunch', reliability: 0.95 },
        { id: 'E3', text: 'The company has approximately 650 employees and generates $120M in annual recurring revenue.', source: 'PitchBook', reliability: 0.85 },
      ],
    },
    {
      keyFacts: [
        'TechVault is a cloud infrastructure company',
        'Based in San Francisco',
        'Raised $50M Series D',
        '650 employees approximately',
        '$120M ARR',
        'Uses Kubernetes',
      ],
      minCitations: 2,
      expectedConfidence: 'high',
      requiredEntities: ['TechVault', 'cloud infrastructure'],
    },
    {
      forbiddenClaims: ['bankrupt', 'shutting down', 'acquired by Microsoft', 'pre-revenue'],
      requiredClaims: ['cloud infrastructure', 'San Francisco'],
      minScore: 70,
      maxHallucinationRate: 0.05,
      tags: ['company_intelligence', 'basic', 'evidence_rich'],
    },
  ),

  benchmark(
    'CI-002',
    'Company with limited evidence — should hedge appropriately',
    'synthesis_engine',
    'company_intelligence',
    'intermediate',
    {
      query: 'What can you tell me about DataNova Systems?',
      companyData: {
        name: 'DataNova Systems',
        industry: 'Data Analytics',
        size: 'Unknown',
      },
      signals: [
        { type: 'growth_signal', description: 'DataNova posted 3 new job openings for senior engineers', source: 'LinkedIn', date: '2025-03-01', confidence: 0.6 },
      ],
      evidence: [
        { id: 'E1', text: 'DataNova Systems appears in a list of emerging data analytics startups.', source: 'CB Insights', reliability: 0.5 },
      ],
    },
    {
      keyFacts: [
        'DataNova is in data analytics',
        'Limited information available',
      ],
      minCitations: 1,
      expectedConfidence: 'low',
      exclusions: ['revenue figures', 'employee count', 'funding amount'],
    },
    {
      forbiddenClaims: ['$100M revenue', '1000 employees', 'Series B', 'unicorn'],
      requiredClaims: ['limited', 'data analytics'],
      minScore: 55,
      maxHallucinationRate: 0.1,
      allowedConfidenceRange: { min: 20, max: 55 },
      tags: ['company_intelligence', 'limited_evidence', 'hedging_test'],
    },
  ),

  benchmark(
    'CI-003',
    'Company with conflicting signals — AI must resolve ambiguity',
    'reasoning_engine',
    'company_intelligence',
    'advanced',
    {
      query: 'Analyze CloudBridge Technologies growth trajectory and provide an intelligence assessment.',
      companyData: {
        name: 'CloudBridge Technologies',
        industry: 'SaaS Platform',
        size: '200-500',
        revenue: '$45M',
        technology: ['React', 'Node.js', 'PostgreSQL'],
        location: 'Austin, TX',
      },
      signals: [
        { type: 'growth_signal', description: 'CloudBridge expanded to European market with new London office', source: 'LinkedIn', date: '2025-01-20', confidence: 0.85 },
        { type: 'risk', description: 'CloudBridge lost VP of Engineering after 2 years', source: 'LinkedIn', date: '2025-02-05', confidence: 0.9 },
        { type: 'growth_signal', description: 'CloudBridge reported 40% YoY revenue growth in Q4', source: 'Press Release', date: '2025-01-30', confidence: 0.8 },
        { type: 'technology_trigger', description: 'CloudBridge evaluating migration from PostgreSQL to CockroachDB', source: 'Job Posting', date: '2025-02-15', confidence: 0.6 },
        { type: 'risk', description: 'Competitor SaaSPro launched competing feature at lower price', source: 'Industry Report', date: '2025-02-20', confidence: 0.7 },
      ],
      evidence: [
        { id: 'E1', text: 'CloudBridge Technologies is a B2B SaaS platform company headquartered in Austin, TX with approximately 350 employees.', source: 'Company Website', reliability: 0.85 },
        { id: 'E2', text: 'CloudBridge annual revenue is approximately $45M ARR with 40% year-over-year growth.', source: 'SaaS Capital Report', reliability: 0.8 },
        { id: 'E3', text: 'VP of Engineering (Jane Mitchell) departed CloudBridge in February 2025 after 2 years.', source: 'LinkedIn', reliability: 0.9 },
        { id: 'E4', text: 'CloudBridge opened a London office, signaling European expansion plans.', source: 'LinkedIn', reliability: 0.85 },
        { id: 'E5', text: 'SaaSPro introduced a competing feature set at 30% lower price point.', source: 'G2 Review Analysis', reliability: 0.7 },
      ],
    },
    {
      keyFacts: [
        'CloudBridge is a B2B SaaS company in Austin',
        '$45M ARR with 40% growth',
        '350 employees',
        'VP of Engineering departed',
        'European expansion underway',
        'Competitive pressure from SaaSPro',
      ],
      minCitations: 3,
      expectedConfidence: 'medium',
      requiredEntities: ['CloudBridge', 'SaaS', 'Austin'],
      requiredSections: ['growth', 'risk', 'competition'],
    },
    {
      forbiddenClaims: ['acquired', 'bankrupt', '$500M revenue', 'IPO planned'],
      requiredClaims: ['growth', 'risk', 'competitive'],
      minScore: 65,
      maxHallucinationRate: 0.08,
      tags: ['company_intelligence', 'conflicting_signals', 'reasoning'],
    },
  ),
];

// ═══════════════════════════════════════════════════════════════════════════
// BENCHMARK SUITE 2: Contact Intelligence
// ═══════════════════════════════════════════════════════════════════════════

const contactIntelligenceBenchmarks: BenchmarkCase[] = [
  benchmark(
    'CTI-001',
    'Decision maker identification from contact data',
    'conversation_engine',
    'contact_intelligence',
    'basic',
    {
      query: 'Identify the key decision makers at Meridian Health for a technology solutions sale.',
      companyData: {
        name: 'Meridian Health Systems',
        industry: 'Healthcare',
        size: '1000-5000',
      },
      contacts: [
        { name: 'Sarah Chen', role: 'Chief Information Officer', department: 'IT', seniority: 'C-Suite' },
        { name: 'Dr. James Rodriguez', role: 'Chief Medical Officer', department: 'Medical', seniority: 'C-Suite' },
        { name: 'Lisa Park', role: 'VP of Digital Health', department: 'Innovation', seniority: 'VP' },
        { name: 'Michael Foster', role: 'Director of IT Infrastructure', department: 'IT', seniority: 'Director' },
      ],
      evidence: [
        { id: 'E1', text: 'Sarah Chen was appointed CIO of Meridian Health in 2023, bringing 15 years of healthcare IT experience.', source: 'Health IT News', reliability: 0.9 },
        { id: 'E2', text: 'Lisa Park leads the digital health innovation team and has been advocating for AI-powered diagnostics.', source: 'Company Website', reliability: 0.85 },
      ],
    },
    {
      keyFacts: [
        'Sarah Chen is CIO and key technology decision maker',
        'Lisa Park leads digital health innovation',
        'Dr. James Rodriguez is CMO',
        'Michael Foster handles IT infrastructure',
      ],
      minCitations: 1,
      requiredEntities: ['Sarah Chen', 'CIO'],
    },
    {
      forbiddenClaims: ['CEO', 'CTO of Meridian'],
      requiredClaims: ['Sarah Chen', 'CIO', 'decision'],
      minScore: 65,
      tags: ['contact_intelligence', 'decision_maker', 'basic'],
    },
  ),

  benchmark(
    'CTI-002',
    'Buying committee mapping with relationship intelligence',
    'reasoning_engine',
    'contact_intelligence',
    'advanced',
    {
      query: 'Map the buying committee for an enterprise cloud migration project at FinServ Global.',
      companyData: {
        name: 'FinServ Global',
        industry: 'Financial Services',
        size: '5000+',
        revenue: '$2B',
        technology: ['Oracle', 'SAP', 'Mainframe'],
        location: 'New York, NY',
      },
      contacts: [
        { name: 'Robert Williams', role: 'Chief Technology Officer', department: 'Technology', seniority: 'C-Suite' },
        { name: 'Patricia Kumar', role: 'SVP of Infrastructure', department: 'IT', seniority: 'SVP' },
        { name: 'David Kim', role: 'VP of Cloud Strategy', department: 'IT', seniority: 'VP' },
        { name: 'Angela Torres', role: 'Chief Risk Officer', department: 'Risk', seniority: 'C-Suite' },
        { name: 'Thomas Blake', role: 'Head of Procurement', department: 'Finance', seniority: 'Director' },
      ],
      signals: [
        { type: 'technology_trigger', description: 'FinServ Global posted job openings for cloud architects and DevOps engineers', source: 'LinkedIn', date: '2025-01-10', confidence: 0.85 },
        { type: 'growth_signal', description: 'FinServ Global CTO Robert Williams spoke about "cloud-first future" at industry conference', source: 'Conference Report', date: '2025-02-01', confidence: 0.9 },
      ],
      evidence: [
        { id: 'E1', text: 'Robert Williams, CTO of FinServ Global, announced a 3-year cloud migration roadmap at the Gartner Symposium.', source: 'Conference Report', reliability: 0.9 },
        { id: 'E2', text: 'Patricia Kumar leads infrastructure modernization and has been with FinServ for 12 years.', source: 'LinkedIn', reliability: 0.85 },
        { id: 'E3', text: 'FinServ Global is a $2B financial services firm with legacy mainframe systems.', source: 'Annual Report', reliability: 0.95 },
      ],
    },
    {
      keyFacts: [
        'Robert Williams (CTO) is the executive sponsor',
        'Patricia Kumar (SVP Infrastructure) is a key influencer',
        'David Kim (VP Cloud Strategy) is the technical champion',
        'Angela Torres (CRO) is a gatekeeper for risk compliance',
        'Thomas Blake (Procurement) handles commercial negotiation',
      ],
      minCitations: 2,
      requiredEntities: ['Robert Williams', 'CTO', 'cloud migration'],
      requiredSections: ['buying committee', 'influencer', 'champion', 'gatekeeper'],
    },
    {
      forbiddenClaims: ['CIO', 'blockchain', 'crypto'],
      requiredClaims: ['CTO', 'cloud', 'buying committee'],
      minScore: 70,
      maxHallucinationRate: 0.08,
      tags: ['contact_intelligence', 'buying_committee', 'enterprise', 'advanced'],
    },
  ),
];

// ═══════════════════════════════════════════════════════════════════════════
// BENCHMARK SUITE 3: Signal Detection
// ═══════════════════════════════════════════════════════════════════════════

const signalDetectionBenchmarks: BenchmarkCase[] = [
  benchmark(
    'SD-001',
    'Technology trigger signal classification',
    'grounding_engine',
    'signal_detection',
    'basic',
    {
      query: 'What signals indicate buying intent for cybersecurity solutions at Apex Manufacturing?',
      companyData: {
        name: 'Apex Manufacturing',
        industry: 'Manufacturing',
        size: '500-1000',
        technology: ['SAP ERP', 'Windows Server', 'Cisco Firewall'],
      },
      signals: [
        { type: 'technology_trigger', description: 'Apex Manufacturing experienced a ransomware attack last month', source: 'News Article', date: '2025-01-15', confidence: 0.95 },
        { type: 'hiring', description: 'Apex posted a job for "Senior Cybersecurity Analyst"', source: 'LinkedIn', date: '2025-02-01', confidence: 0.85 },
        { type: 'technology_trigger', description: 'Apex is evaluating CrowdStrike and Palo Alto solutions', source: 'RFP Database', date: '2025-02-10', confidence: 0.8 },
      ],
      evidence: [
        { id: 'E1', text: 'Apex Manufacturing confirmed a ransomware incident that disrupted operations for 48 hours.', source: 'WSJ', reliability: 0.95 },
        { id: 'E2', text: 'Senior Cybersecurity Analyst job posting suggests Apex is building internal security capabilities.', source: 'LinkedIn', reliability: 0.85 },
        { id: 'E3', text: 'Apex Manufacturing issued an RFP for next-generation endpoint protection covering 2000 endpoints.', source: 'Industry Database', reliability: 0.8 },
      ],
    },
    {
      keyFacts: [
        'Ransomware attack creates urgency',
        'Active security tool evaluation (CrowdStrike, Palo Alto)',
        'Hiring cybersecurity talent indicates investment commitment',
        'RFP for 2000 endpoints indicates significant deal size',
      ],
      minCitations: 2,
      expectedConfidence: 'high',
    },
    {
      forbiddenClaims: ['not interested in security', 'no budget'],
      requiredClaims: ['ransomware', 'cybersecurity', 'evaluating'],
      minScore: 70,
      maxHallucinationRate: 0.05,
      tags: ['signal_detection', 'cybersecurity', 'buying_intent', 'urgent'],
    },
  ),

  benchmark(
    'SD-002',
    'Multiple weak signals — should aggregate into stronger insight',
    'retrieval_engine',
    'signal_detection',
    'intermediate',
    {
      query: 'Are there any signals that NexaRetail might be expanding their e-commerce capabilities?',
      companyData: {
        name: 'NexaRetail',
        industry: 'Retail',
        size: '200-500',
        technology: ['Shopify', 'Magento', 'MySQL'],
      },
      signals: [
        { type: 'hiring', description: 'NexaRetail posted 2 frontend developer roles', source: 'LinkedIn', date: '2025-01-20', confidence: 0.6 },
        { type: 'technology_trigger', description: 'NexaRetail domain registered a new subdomain: app.nexaretail.com', source: 'WHOIS', date: '2025-02-05', confidence: 0.5 },
        { type: 'growth_signal', description: 'NexaRetail CEO mentioned "digital transformation" in LinkedIn post', source: 'LinkedIn', date: '2025-02-10', confidence: 0.55 },
      ],
      evidence: [
        { id: 'E1', text: 'NexaRetail currently uses Shopify for online sales with a basic storefront.', source: 'Company Website', reliability: 0.7 },
        { id: 'E2', text: 'NexaRetail registered the subdomain app.nexaretail.com on February 5, 2025.', source: 'WHOIS Lookup', reliability: 0.6 },
      ],
    },
    {
      keyFacts: [
        'Multiple weak signals suggest e-commerce expansion',
        'New frontend hiring indicates UI/UX investment',
        'Subdomain registration suggests custom app development',
        'CEO digital transformation mention adds executive context',
      ],
      minCitations: 1,
      expectedConfidence: 'low',
      exclusions: ['confirmed expansion', 'budget allocation'],
    },
    {
      forbiddenClaims: ['confirmed', 'definitely expanding', 'budget approved'],
      requiredClaims: ['signal', 'suggest', 'may'],
      minScore: 55,
      maxHallucinationRate: 0.1,
      allowedConfidenceRange: { min: 25, max: 55 },
      tags: ['signal_detection', 'weak_signals', 'aggregation', 'hedging'],
    },
  ),
];

// ═══════════════════════════════════════════════════════════════════════════
// BENCHMARK SUITE 4: Opportunity Prediction
// ═══════════════════════════════════════════════════════════════════════════

const opportunityPredictionBenchmarks: BenchmarkCase[] = [
  benchmark(
    'OP-001',
    'High-intent opportunity scoring with strong signals',
    'scoring_engine',
    'opportunity_prediction',
    'basic',
    {
      query: 'Score the opportunity for selling cloud consulting services to VelocityLabs.',
      companyData: {
        name: 'VelocityLabs',
        industry: 'Technology',
        size: '100-250',
        revenue: '$25M',
        technology: ['AWS', 'Docker', 'Python', 'React'],
        location: 'Seattle, WA',
      },
      signals: [
        { type: 'growth_signal', description: 'VelocityLabs secured $15M Series B funding', source: 'Crunchbase', date: '2025-01-05', confidence: 0.9 },
        { type: 'hiring', description: 'Hiring 5 new DevOps engineers', source: 'LinkedIn', date: '2025-01-20', confidence: 0.85 },
        { type: 'technology_trigger', description: 'VelocityLabs CTO blogged about needing "cloud architecture expertise"', source: 'Tech Blog', date: '2025-02-01', confidence: 0.8 },
      ],
      evidence: [
        { id: 'E1', text: 'VelocityLabs raised $15M Series B led by Andreessen Horowitz for cloud-native platform expansion.', source: 'Crunchbase', reliability: 0.95 },
        { id: 'E2', text: 'VelocityLabs currently has 120 employees and $25M ARR, growing 60% YoY.', source: 'PitchBook', reliability: 0.85 },
        { id: 'E3', text: 'CTO Marcus Lee published: "We need expertise in multi-cloud architecture to scale our platform."', source: 'Medium Blog', reliability: 0.8 },
      ],
    },
    {
      keyFacts: [
        'VelocityLabs has strong growth indicators (60% YoY)',
        'Fresh funding ($15M) provides budget availability',
        'Active hiring signals expansion investment',
        'CTO explicitly stated need for cloud expertise',
        'High-fit opportunity for cloud consulting',
      ],
      minCitations: 2,
      expectedConfidence: 'high',
    },
    {
      forbiddenClaims: ['low priority', 'no budget', 'not a fit'],
      requiredClaims: ['opportunity', 'high', 'cloud'],
      minScore: 70,
      tags: ['opportunity_prediction', 'high_intent', 'scoring'],
    },
  ),

  benchmark(
    'OP-002',
    'Low-intent opportunity — AI should not over-score',
    'scoring_engine',
    'opportunity_prediction',
    'edge_case',
    {
      query: 'Score the opportunity for enterprise consulting at SleepyCorp Inc.',
      companyData: {
        name: 'SleepyCorp Inc.',
        industry: 'Traditional Manufacturing',
        size: '5000+',
        revenue: '$800M',
        technology: ['COBOL', 'AS/400', 'SAP R/3'],
        location: 'Cleveland, OH',
      },
      signals: [
        { type: 'growth_signal', description: 'SleepyCorp announced quarterly earnings within expectations', source: 'Press Release', date: '2025-01-30', confidence: 0.5 },
      ],
      evidence: [
        { id: 'E1', text: 'SleepyCorp has been using SAP R/3 since 2005 and has no publicly announced modernization plans.', source: 'Industry Report', reliability: 0.8 },
        { id: 'E2', text: 'SleepyCorp CIO stated "if it isn\'t broken, we don\'t fix it" in a 2024 interview.', source: 'CIO Magazine', reliability: 0.9 },
      ],
    },
    {
      keyFacts: [
        'No modernization signals detected',
        'CIO has explicitly resisted change',
        'Legacy technology stack with no migration plans',
        'Low buying intent for technology consulting',
      ],
      expectedConfidence: 'low',
      exclusions: ['high opportunity', 'immediate action'],
    },
    {
      forbiddenClaims: ['urgent', 'high priority', 'active buyer', 'budget allocated'],
      requiredClaims: ['low', 'limited', 'no immediate'],
      minScore: 40,
      maxHallucinationRate: 0.05,
      allowedConfidenceRange: { min: 20, max: 50 },
      tags: ['opportunity_prediction', 'low_intent', 'negative_signal', 'edge_case'],
    },
  ),
];

// ═══════════════════════════════════════════════════════════════════════════
// BENCHMARK SUITE 5: Recommendation Intelligence
// ═══════════════════════════════════════════════════════════════════════════

const recommendationBenchmarks: BenchmarkCase[] = [
  benchmark(
    'REC-001',
    'Next-best-action recommendation with reasoning',
    'action_engine',
    'recommendation',
    'intermediate',
    {
      query: 'What is the recommended next action for engaging with Quantum Dynamics?',
      companyData: {
        name: 'Quantum Dynamics',
        industry: 'Quantum Computing',
        size: '50-200',
        revenue: '$10M',
        technology: ['Python', 'Qiskit', 'C++', 'AWS Braket'],
        location: 'Cambridge, MA',
      },
      signals: [
        { type: 'technology_trigger', description: 'Quantum Dynamics published a paper on quantum error correction', source: 'arXiv', date: '2025-01-15', confidence: 0.8 },
        { type: 'growth_signal', description: 'Quantum Dynamics hired a VP of Business Development', source: 'LinkedIn', date: '2025-02-01', confidence: 0.85 },
        { type: 'engagement', description: 'VP of Business Development accepted your LinkedIn connection', source: 'LinkedIn', date: '2025-02-10', confidence: 0.95 },
      ],
      evidence: [
        { id: 'E1', text: 'Quantum Dynamics is a quantum computing startup with 85 employees and $10M in seed/Series A funding.', source: 'Crunchbase', reliability: 0.85 },
        { id: 'E2', text: 'New VP of Business Development (Alex Nguyen) joined from IBM Quantum and accepted connection request.', source: 'LinkedIn', reliability: 0.9 },
      ],
    },
    {
      keyFacts: [
        'VP of Business Development accepted connection — warm entry point',
        'New BD leader from IBM suggests enterprise sales experience',
        'Quantum computing focus limits broad applicability',
        'Timing is good — new BD leader building pipeline',
      ],
      minCitations: 1,
      requiredSections: ['action', 'reasoning'],
    },
    {
      forbiddenClaims: ['call the CEO directly', 'send generic email blast'],
      requiredClaims: ['recommend', 'action', 'VP'],
      minScore: 60,
      tags: ['recommendation', 'next_best_action', 'warm_lead'],
    },
  ),
];

// ═══════════════════════════════════════════════════════════════════════════
// BENCHMARK SUITE 6: Brief Generation
// ═══════════════════════════════════════════════════════════════════════════

const briefGenerationBenchmarks: BenchmarkCase[] = [
  benchmark(
    'BG-001',
    'Executive brief with evidence grounding',
    'synthesis_engine',
    'brief_generation',
    'advanced',
    {
      query: 'Generate an executive intelligence brief for Pinnacle Financial Group.',
      companyData: {
        name: 'Pinnacle Financial Group',
        industry: 'Financial Services',
        size: '1000-5000',
        revenue: '$500M',
        technology: ['Java', 'Oracle', 'Red Hat', 'AWS'],
        location: 'Chicago, IL',
      },
      signals: [
        { type: 'executive_change', description: 'New CTO appointed: Maria Gonzalez, former Goldman Sachs', source: 'Press Release', date: '2025-01-05', confidence: 0.95 },
        { type: 'technology_trigger', description: 'Pinnacle announced cloud-first initiative', source: 'Conference Keynote', date: '2025-01-20', confidence: 0.9 },
        { type: 'growth_signal', description: 'Pinnacle acquired FinTech startup DataFlow for $30M', source: 'SEC Filing', date: '2025-02-01', confidence: 0.95 },
        { type: 'risk', description: 'Pinnacle faces regulatory scrutiny on data handling practices', source: 'Reuters', date: '2025-02-10', confidence: 0.85 },
      ],
      evidence: [
        { id: 'E1', text: 'Maria Gonzalez joins Pinnacle as CTO from Goldman Sachs, bringing 20 years of financial technology experience.', source: 'Press Release', reliability: 0.95 },
        { id: 'E2', text: 'Pinnacle\'s CEO announced a $200M, 3-year digital transformation initiative at the Money20/20 conference.', source: 'Conference Report', reliability: 0.9 },
        { id: 'E3', text: 'DataFlow acquisition brings AI-powered fraud detection capabilities to Pinnacle.', source: 'SEC Filing', reliability: 0.95 },
        { id: 'E4', text: 'Regulators issued a warning letter regarding Pinnacle\'s cross-border data transfer practices.', source: 'Reuters', reliability: 0.85 },
        { id: 'E5', text: 'Pinnacle has 3,200 employees and $500M annual revenue, operating in 15 countries.', source: 'Annual Report', reliability: 0.95 },
      ],
    },
    {
      keyFacts: [
        'New CTO Maria Gonzalez from Goldman Sachs',
        '$200M digital transformation initiative',
        'DataFlow acquisition ($30M) for AI fraud detection',
        'Regulatory scrutiny on data handling',
        '3,200 employees, $500M revenue, 15 countries',
        'Cloud-first strategy announced',
      ],
      minCitations: 4,
      expectedConfidence: 'high',
      requiredEntities: ['Pinnacle', 'Maria Gonzalez', 'CTO', 'DataFlow'],
      requiredSections: ['executive summary', 'key developments', 'risks', 'opportunities', 'recommendations'],
    },
    {
      forbiddenClaims: ['blockchain', 'crypto', 'small company'],
      requiredClaims: ['Maria Gonzalez', 'digital transformation', 'DataFlow', 'regulatory'],
      minScore: 70,
      maxHallucinationRate: 0.05,
      tags: ['brief_generation', 'executive', 'evidence_rich', 'advanced'],
    },
  ),
];

// ═══════════════════════════════════════════════════════════════════════════
// BENCHMARK SUITE 7: Scoring Intelligence
// ═══════════════════════════════════════════════════════════════════════════

const scoringBenchmarks: BenchmarkCase[] = [
  benchmark(
    'SC-001',
    'Revenue intelligence scoring with explainable factors',
    'scoring_engine',
    'scoring',
    'intermediate',
    {
      query: 'Calculate the revenue intelligence score for GreenTech Solutions.',
      companyData: {
        name: 'GreenTech Solutions',
        industry: 'Clean Energy',
        size: '100-250',
        revenue: '$30M',
        technology: ['Python', 'IoT', 'AWS IoT', 'React'],
        location: 'Denver, CO',
      },
      signals: [
        { type: 'growth_signal', description: 'GreenTech won 3 new enterprise contracts worth $5M TCV', source: 'Press Release', date: '2025-01-15', confidence: 0.9 },
        { type: 'technology_trigger', description: 'GreenTech launched new IoT monitoring platform', source: 'Product Announcement', date: '2025-02-01', confidence: 0.85 },
        { type: 'growth_signal', description: 'GreenTech expanded to European market', source: 'LinkedIn', date: '2025-02-10', confidence: 0.8 },
      ],
      evidence: [
        { id: 'E1', text: 'GreenTech Solutions provides IoT-based energy monitoring for enterprise clients.', source: 'Company Website', reliability: 0.85 },
        { id: 'E2', text: 'Three new enterprise contracts (Fortune 500 companies) worth $5M total contract value signed in January.', source: 'Press Release', reliability: 0.9 },
        { id: 'E3', text: 'GreenTech has 180 employees and $30M ARR, growing at 45% YoY.', source: 'PitchBook', reliability: 0.85 },
      ],
    },
    {
      keyFacts: [
        '45% YoY growth rate',
        '$5M in new contracts',
        'Product expansion (IoT platform)',
        'Market expansion (Europe)',
        '180 employees, $30M ARR',
      ],
      minCitations: 2,
      expectedConfidence: 'medium',
    },
    {
      forbiddenClaims: ['declining', 'losing customers', 'low growth'],
      requiredClaims: ['score', 'growth', 'opportunity'],
      minScore: 65,
      tags: ['scoring', 'revenue_intelligence', 'growth'],
    },
  ),
];

// ═══════════════════════════════════════════════════════════════════════════
// BENCHMARK SUITE 8: Conversation Planning
// ═══════════════════════════════════════════════════════════════════════════

const conversationPlanningBenchmarks: BenchmarkCase[] = [
  benchmark(
    'CP-001',
    'Meeting prep with talking points and objection handling',
    'conversation_engine',
    'conversation_planning',
    'intermediate',
    {
      query: 'Prepare a conversation plan for a first meeting with Atlas Robotics CTO.',
      companyData: {
        name: 'Atlas Robotics',
        industry: 'Robotics / AI',
        size: '50-200',
        revenue: '$15M',
        technology: ['ROS', 'Python', 'C++', 'TensorFlow', 'AWS'],
        location: 'Boston, MA',
      },
      contacts: [
        { name: 'Dr. Priya Sharma', role: 'Chief Technology Officer', department: 'Engineering', seniority: 'C-Suite' },
      ],
      signals: [
        { type: 'technology_trigger', description: 'Atlas Robotics looking to scale AI inference from on-prem to cloud', source: 'Conference Q&A', date: '2025-01-15', confidence: 0.8 },
        { type: 'growth_signal', description: 'Atlas won DoD contract requiring secure cloud deployment', source: 'Federal Register', date: '2025-02-01', confidence: 0.9 },
      ],
      evidence: [
        { id: 'E1', text: 'Dr. Priya Sharma has PhD in Computer Vision from MIT. Previously led AI team at Boston Dynamics.', source: 'LinkedIn', reliability: 0.9 },
        { id: 'E2', text: 'Atlas Robotics won a $4M DoD contract for autonomous inspection systems, requiring FedRAMP-compliant cloud.', source: 'Federal Register', reliability: 0.95 },
        { id: 'E3', text: 'Atlas currently runs AI inference on 50 on-prem GPU servers and is evaluating cloud alternatives.', source: 'Conference Q&A', reliability: 0.8 },
      ],
    },
    {
      keyFacts: [
        'CTO Dr. Priya Sharma — technical, PhD from MIT',
        'DoD contract creates compliance requirements (FedRAMP)',
        'Current pain: scaling from 50 on-prem GPU servers to cloud',
        'Technical audience — avoid marketing fluff',
      ],
      minCitations: 2,
      requiredEntities: ['Dr. Priya Sharma', 'Atlas Robotics', 'cloud'],
      requiredSections: ['talking points', 'questions', 'objection handling'],
    },
    {
      forbiddenClaims: ['Dr. Sharma is CEO', 'Atlas makes consumer products'],
      requiredClaims: ['talking point', 'question'],
      minScore: 60,
      tags: ['conversation_planning', 'meeting_prep', 'technical_audience'],
    },
  ),
];

// ═══════════════════════════════════════════════════════════════════════════
// BENCHMARK SUITE 9: Email Generation
// ═══════════════════════════════════════════════════════════════════════════

const emailGenerationBenchmarks: BenchmarkCase[] = [
  benchmark(
    'EG-001',
    'Personalized outreach email with evidence-based personalization',
    'synthesis_engine',
    'email_generation',
    'intermediate',
    {
      query: 'Draft a personalized outreach email to Horizon AI Labs VP of Engineering.',
      companyData: {
        name: 'Horizon AI Labs',
        industry: 'Artificial Intelligence',
        size: '50-200',
        revenue: '$8M',
        technology: ['Python', 'PyTorch', 'Kubernetes', 'GCP'],
        location: 'Palo Alto, CA',
      },
      contacts: [
        { name: 'Jason Park', role: 'VP of Engineering', department: 'Engineering', seniority: 'VP' },
      ],
      signals: [
        { type: 'hiring', description: 'Horizon AI Labs hiring ML engineers for new computer vision team', source: 'LinkedIn', date: '2025-02-01', confidence: 0.85 },
        { type: 'growth_signal', description: 'Horizon secured $12M Series A', source: 'TechCrunch', date: '2025-01-15', confidence: 0.9 },
      ],
      evidence: [
        { id: 'E1', text: 'Jason Park joined Horizon AI Labs as VP of Engineering from Google Brain. Expert in computer vision and distributed training.', source: 'LinkedIn', reliability: 0.9 },
        { id: 'E2', text: 'Horizon AI Labs raised $12M Series A to build computer vision platform for manufacturing defect detection.', source: 'TechCrunch', reliability: 0.95 },
      ],
    },
    {
      keyFacts: [
        'Jason Park came from Google Brain',
        'Horizon focuses on computer vision for manufacturing',
        'Recently funded ($12M Series A)',
        'Hiring ML engineers — growth mode',
      ],
      minCitations: 1,
      requiredEntities: ['Jason Park', 'Horizon AI Labs'],
    },
    {
      forbiddenClaims: ['Dear Sir/Madam', 'To whom it may concern', 'I am writing to introduce'],
      requiredClaims: ['Jason', 'Horizon', 'computer vision'],
      minScore: 60,
      maxHallucinationRate: 0.05,
      tags: ['email_generation', 'personalized', 'outreach'],
    },
  ),
];

// ═══════════════════════════════════════════════════════════════════════════
// BENCHMARK SUITE 10: Strategy
// ═══════════════════════════════════════════════════════════════════════════

const strategyBenchmarks: BenchmarkCase[] = [
  benchmark(
    'ST-001',
    'Competitive positioning analysis',
    'reasoning_engine',
    'strategy',
    'advanced',
    {
      query: 'Provide a competitive positioning strategy for selling data analytics solutions to the healthcare sector.',
      companyData: {
        name: 'HealthFirst Network',
        industry: 'Healthcare',
        size: '5000+',
        revenue: '$1.5B',
        technology: ['Epic EHR', 'Cerner', 'SQL Server', 'Tableau'],
        location: 'Atlanta, GA',
      },
      signals: [
        { type: 'technology_trigger', description: 'HealthFirst RFP for advanced analytics platform', source: 'RFP Database', date: '2025-01-10', confidence: 0.9 },
        { type: 'competitive', description: 'Competitor DataMed Solutions won a similar deal with rival health system', source: 'Industry Report', date: '2025-01-20', confidence: 0.8 },
        { type: 'technology_trigger', description: 'HealthFirst investing in population health analytics initiative', source: 'Conference Keynote', date: '2025-02-05', confidence: 0.85 },
      ],
      evidence: [
        { id: 'E1', text: 'HealthFirst Network is a regional health system with 12 hospitals and 500+ clinics across the Southeast.', source: 'Company Website', reliability: 0.95 },
        { id: 'E2', text: 'HealthFirst issued an RFP for an enterprise analytics platform with specific HIPAA compliance requirements.', source: 'RFP Database', reliability: 0.9 },
        { id: 'E3', text: 'DataMed Solutions won a $3M deal with Southeast Regional Health for predictive analytics.', source: 'Industry Report', reliability: 0.8 },
        { id: 'E4', text: 'HealthFirst CMO Dr. Williams emphasized population health management as top strategic priority.', source: 'Conference Report', reliability: 0.85 },
      ],
    },
    {
      keyFacts: [
        'HealthFirst is a 12-hospital regional health system',
        'Active RFP for analytics platform with HIPAA requirements',
        'Competitor DataMed won similar deal — competitive threat',
        'Population health analytics is the strategic priority',
        'Dr. Williams (CMO) is the champion for analytics investment',
      ],
      minCitations: 3,
      expectedConfidence: 'medium',
      requiredEntities: ['HealthFirst', 'analytics', 'HIPAA'],
      requiredSections: ['competitive analysis', 'positioning', 'differentiation', 'approach strategy'],
    },
    {
      forbiddenClaims: ['acquisition target', 'going private'],
      requiredClaims: ['competitive', 'strategy', 'analytics'],
      minScore: 65,
      maxHallucinationRate: 0.08,
      tags: ['strategy', 'competitive', 'healthcare', 'enterprise'],
    },
  ),
];

// ═══════════════════════════════════════════════════════════════════════════
// BENCHMARK REGISTRY
// ═══════════════════════════════════════════════════════════════════════════

/** All benchmark suites, keyed by ID. */
const BENCHMARK_SUITES: BenchmarkSuite[] = [
  {
    id: 'company_intelligence',
    name: 'Company Intelligence Benchmarks',
    description: 'Tests AI ability to synthesize company profiles from evidence, handle limited data, and resolve conflicting signals.',
    cases: companyIntelligenceBenchmarks,
  },
  {
    id: 'contact_intelligence',
    name: 'Contact Intelligence Benchmarks',
    description: 'Tests AI ability to identify decision makers, map buying committees, and assess relationship dynamics.',
    cases: contactIntelligenceBenchmarks,
  },
  {
    id: 'signal_detection',
    name: 'Signal Detection Benchmarks',
    description: 'Tests AI ability to classify signals, detect buying intent, and aggregate weak signals into insights.',
    cases: signalDetectionBenchmarks,
  },
  {
    id: 'opportunity_prediction',
    name: 'Opportunity Prediction Benchmarks',
    description: 'Tests AI scoring accuracy, intent calibration, and ability to avoid over-scoring low-intent opportunities.',
    cases: opportunityPredictionBenchmarks,
  },
  {
    id: 'recommendation',
    name: 'Recommendation Intelligence Benchmarks',
    description: 'Tests AI ability to provide actionable, evidence-grounded next-best-action recommendations.',
    cases: recommendationBenchmarks,
  },
  {
    id: 'brief_generation',
    name: 'Brief Generation Benchmarks',
    description: 'Tests AI ability to produce comprehensive, evidence-grounded executive briefs.',
    cases: briefGenerationBenchmarks,
  },
  {
    id: 'scoring',
    name: 'Scoring Intelligence Benchmarks',
    description: 'Tests AI scoring accuracy, factor decomposition, and explainability.',
    cases: scoringBenchmarks,
  },
  {
    id: 'conversation_planning',
    name: 'Conversation Planning Benchmarks',
    description: 'Tests AI ability to prepare meeting-relevant talking points, questions, and objection handling.',
    cases: conversationPlanningBenchmarks,
  },
  {
    id: 'email_generation',
    name: 'Email Generation Benchmarks',
    description: 'Tests AI ability to draft personalized, evidence-grounded outreach emails without generic templates.',
    cases: emailGenerationBenchmarks,
  },
  {
    id: 'strategy',
    name: 'Strategy Intelligence Benchmarks',
    description: 'Tests AI ability to analyze competitive positioning and recommend strategic approaches.',
    cases: strategyBenchmarks,
  },
];

/**
 * Get all benchmark suites.
 */
export function getBenchmarkSuites(): BenchmarkSuite[] {
  return BENCHMARK_SUITES;
}

/**
 * Get a specific benchmark suite by ID.
 */
export function getBenchmarkSuite(suiteId: string): BenchmarkSuite | null {
  return BENCHMARK_SUITES.find(s => s.id === suiteId) ?? null;
}

/**
 * Get all benchmark cases across all suites.
 */
export function getAllBenchmarkCases(): BenchmarkCase[] {
  return BENCHMARK_SUITES.flatMap(s => s.cases);
}

/**
 * Get benchmark cases filtered by category, engine, difficulty, or tags.
 */
export function getFilteredBenchmarks(filters: {
  category?: IntelligenceCategory;
  engine?: EvaluatedEngine;
  difficulty?: BenchmarkCase['difficulty'];
  tags?: string[];
  activeOnly?: boolean;
}): BenchmarkCase[] {
  let cases = getAllBenchmarkCases();

  if (filters.category) {
    cases = cases.filter(c => c.category === filters.category);
  }
  if (filters.engine) {
    cases = cases.filter(c => c.targetEngine === filters.engine);
  }
  if (filters.difficulty) {
    cases = cases.filter(c => c.difficulty === filters.difficulty);
  }
  if (filters.tags && filters.tags.length > 0) {
    cases = cases.filter(c =>
      filters.tags!.some(tag => c.tags.includes(tag)),
    );
  }
  if (filters.activeOnly) {
    cases = cases.filter(c => c.active);
  }

  return cases;
}

/**
 * Get benchmark suite statistics.
 */
export function getBenchmarkStats(): {
  totalSuites: number;
  totalCases: number;
  activeCases: number;
  byCategory: Record<string, number>;
  byEngine: Record<string, number>;
  byDifficulty: Record<string, number>;
} {
  const allCases = getAllBenchmarkCases();
  const activeCases = allCases.filter(c => c.active);

  const byCategory: Record<string, number> = {};
  const byEngine: Record<string, number> = {};
  const byDifficulty: Record<string, number> = {};

  for (const c of allCases) {
    byCategory[c.category] = (byCategory[c.category] || 0) + 1;
    byEngine[c.targetEngine] = (byEngine[c.targetEngine] || 0) + 1;
    byDifficulty[c.difficulty] = (byDifficulty[c.difficulty] || 0) + 1;
  }

  return {
    totalSuites: BENCHMARK_SUITES.length,
    totalCases: allCases.length,
    activeCases: activeCases.length,
    byCategory,
    byEngine,
    byDifficulty,
  };
}

/**
 * Import BenchmarkCase type for external use.
 */
export type { BenchmarkCase };
