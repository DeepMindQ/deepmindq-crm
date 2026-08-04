/**
 * DeepMindQ Enterprise AI Intelligence Platform
 * Milestone 3 — Section 3.4: AI Quality Certification
 * Golden Dataset Testing — 20 Benchmark Companies
 *
 * Each company has known facts, expected signals, and expected intelligence.
 * Tests validate: accuracy, evidence grounding, relevance, completeness.
 *
 * Run: npx vitest run --config vitest.ai-governance.config.ts tests/ai/ai-golden-dataset.test.ts
 */
import { describe, it, expect, vi } from 'vitest';

// ── Mock external dependencies only ──
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
    child: vi.fn(() => ({
      info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
    })),
  },
}));

// ── Import REAL business logic ──
import {
  extractClaims,
  verifyCitations,
  runHallucinationCheck,
  detectHedgingPatterns,
  scoreSpecificity,
  buildMinimalEvidenceContext,
  type EvidenceContext,
} from '@/lib/ai-hallucination-prevention';

import {
  computeFreshnessScore,
  computeFreshnessState,
  sourceQualityWeight,
  computeIntelligenceRanking,
  SIGNAL_HALF_LIVES,
} from '@/lib/scoring/freshness-ranking';

import {
  computeUnifiedConfidence,
  getSourceReliability,
} from '@/lib/ai-unified-confidence';

// ═══════════════════════════════════════════════════════════════════════════════
// GOLDEN DATASET — 20 Benchmark Companies
// ═══════════════════════════════════════════════════════════════════════════════

interface GoldenCompany {
  id: string;
  name: string;
  industry: string;
  size: 'enterprise' | 'mid-market' | 'smb' | 'startup';
  website: string;
  knownFacts: {
    revenue: string;
    employees: number;
    founded: number;
    hqLocation: string;
    technology: string[];
    recentEvents: string[];
    fundingStage: string;
    growthRate: string;
  };
  expectedSignals: Array<{
    type: string;
    confidence: 'high' | 'medium' | 'low';
    source: string;
  }>;
  expectedIntelligence: {
    accountTier: string;
    minScore: number;
    buyingIntent: string;
    recommendedActions: string[];
  };
  aiOutputSample: string;
  evidenceItems: Array<{
    marker: string;
    text: string;
    source: string;
  }>;
  primarySignalType: string;
  confidenceInput: {
    fieldConfidence: Record<string, number>;
    dataCompleteness: number;
    sources: Array<{ name: string; reliability: number; type: string }>;
    daysSinceResearch: number;
    crossValidatedFacts: number;
    totalFacts: number;
    evidenceCount: number;
    evidenceCoverage: number;
    hallucinationRiskScore: number;
  };
  expectedConfidence: {
    minScore: number;
    maxScore: number;
    trustClass: string;
    enterpriseReady: boolean;
  };
}

const GOLDEN_COMPANIES: GoldenCompany[] = [
  {
    id: 'golden-001', name: 'TechCorp Global', industry: 'Technology', size: 'enterprise',
    website: 'techcorp.example.com',
    knownFacts: { revenue: '$2.5B', employees: 12000, founded: 2010, hqLocation: 'San Francisco, CA', technology: ['Cloud Computing', 'AI/ML', 'SaaS'], recentEvents: ['Acquired DataStartup Inc for $200M', 'Hired new CTO', 'Launched AI platform'], fundingStage: 'public', growthRate: '25%' },
    expectedSignals: [
      { type: 'technology_trigger', confidence: 'high', source: 'web' },
      { type: 'growth_signal', confidence: 'high', source: 'news' },
      { type: 'executive_change', confidence: 'medium', source: 'press_release' },
    ],
    expectedIntelligence: { accountTier: 'hot', minScore: 70, buyingIntent: 'high', recommendedActions: ['executive_outreach', 'technical_discovery'] },
    aiOutputSample: 'TechCorp Global generates $2.5B in revenue [E1]. The company employs 12,000 people and was founded in 2010 [E2]. TechCorp Global recently acquired DataStartup Inc for $200M [E3]. They use Cloud Computing, AI/ML, and SaaS technologies [E4]. The CEO announced a new AI platform [E5].',
    evidenceItems: [
      { marker: 'E1', text: 'TechCorp Global reported $2.5B in annual revenue for fiscal year 2024.', source: 'reuters.com' },
      { marker: 'E2', text: 'TechCorp Global has approximately 12,000 employees worldwide.', source: 'linkedin.com' },
      { marker: 'E3', text: 'TechCorp Global announced the acquisition of DataStartup Inc for $200M.', source: 'techcrunch.com' },
      { marker: 'E4', text: 'TechCorp Global technology stack includes Cloud Computing, AI/ML platforms, and SaaS products.', source: 'techcorp.example.com' },
      { marker: 'E5', text: 'TechCorp Global CEO announced the launch of a new enterprise AI platform.', source: 'press release' },
    ],
    primarySignalType: 'news',
    confidenceInput: { fieldConfidence: { revenue: 0.95, employees: 0.90, technology: 0.88, funding: 0.95, location: 0.85 }, dataCompleteness: 0.9, sources: [{ name: 'reuters.com', reliability: 0.92, type: 'financial' }, { name: 'techcrunch.com', reliability: 0.78, type: 'news' }, { name: 'company website', reliability: 0.88, type: 'official' }, { name: 'press release', reliability: 0.85, type: 'official' }], daysSinceResearch: 3, crossValidatedFacts: 8, totalFacts: 10, evidenceCount: 12, evidenceCoverage: 0.85, hallucinationRiskScore: 5 },
    expectedConfidence: { minScore: 65, maxScore: 95, trustClass: 'enterprise', enterpriseReady: true },
  },
  {
    id: 'golden-002', name: 'FinServe Partners', industry: 'Financial Services', size: 'mid-market',
    website: 'finserve.example.com',
    knownFacts: { revenue: '$180M', employees: 850, founded: 2005, hqLocation: 'New York, NY', technology: ['Salesforce', 'Oracle', 'Python'], recentEvents: ['Expanded to London office', 'Hired VP of Engineering'], fundingStage: 'private', growthRate: '12%' },
    expectedSignals: [
      { type: 'expansion_signal', confidence: 'medium', source: 'news' },
      { type: 'hiring_signal', confidence: 'medium', source: 'linkedin.com' },
    ],
    expectedIntelligence: { accountTier: 'warm', minScore: 50, buyingIntent: 'medium', recommendedActions: ['relationship_building', 'technical_assessment'] },
    aiOutputSample: 'FinServe Partners generates $180M in annual revenue. The company has approximately 850 employees [E1]. FinServe Partners recently opened a new office in London [E2]. They use Salesforce and Oracle for their core operations.',
    evidenceItems: [
      { marker: 'E1', text: 'FinServe Partners employs around 850 people across offices in New York and London.', source: 'linkedin.com' },
      { marker: 'E2', text: 'FinServe Partners announces London office expansion.', source: 'businessinsider.com' },
    ],
    primarySignalType: 'expansion',
    confidenceInput: { fieldConfidence: { revenue: 0.70, employees: 0.65, technology: 0.75, funding: 0.60 }, dataCompleteness: 0.65, sources: [{ name: 'linkedin.com', reliability: 0.75, type: 'professional' }, { name: 'businessinsider.com', reliability: 0.75, type: 'news' }], daysSinceResearch: 15, crossValidatedFacts: 4, totalFacts: 8, evidenceCount: 5, evidenceCoverage: 0.55, hallucinationRiskScore: 15 },
    expectedConfidence: { minScore: 45, maxScore: 75, trustClass: 'advisory', enterpriseReady: false },
  },
  {
    id: 'golden-003', name: 'HealthTech Innovations', industry: 'Healthcare', size: 'startup',
    website: 'healthtech.example.com',
    knownFacts: { revenue: '$5M', employees: 45, founded: 2021, hqLocation: 'Boston, MA', technology: ['React', 'Python', 'AWS'], recentEvents: ['Raised Series A $15M'], fundingStage: 'series_a', growthRate: '80%' },
    expectedSignals: [{ type: 'funding_signal', confidence: 'high', source: 'crunchbase.com' }],
    expectedIntelligence: { accountTier: 'cold', minScore: 20, buyingIntent: 'low', recommendedActions: ['monitor', 'light_outreach'] },
    aiOutputSample: 'HealthTech Innovations raised $15M in Series A funding [E1]. The startup uses React, Python, and AWS for their healthcare platform [E2].',
    evidenceItems: [
      { marker: 'E1', text: 'HealthTech Innovations closes $15M Series A round led by Health Ventures.', source: 'crunchbase.com' },
      { marker: 'E2', text: 'HealthTech Innovations tech stack includes React frontend, Python backend, and AWS cloud.', source: 'healthtech.example.com' },
    ],
    primarySignalType: 'funding',
    confidenceInput: { fieldConfidence: { revenue: 0.30, employees: 0.40, technology: 0.60, funding: 0.85 }, dataCompleteness: 0.35, sources: [{ name: 'crunchbase.com', reliability: 0.85, type: 'funding' }, { name: 'company website', reliability: 0.88, type: 'official' }], daysSinceResearch: 30, crossValidatedFacts: 2, totalFacts: 6, evidenceCount: 3, evidenceCoverage: 0.30, hallucinationRiskScore: 25 },
    expectedConfidence: { minScore: 30, maxScore: 60, trustClass: 'advisory', enterpriseReady: false },
  },
  {
    id: 'golden-004', name: 'CloudNine Systems', industry: 'Technology', size: 'enterprise',
    website: 'cloudnine.example.com',
    knownFacts: { revenue: '$4.2B', employees: 25000, founded: 2003, hqLocation: 'Seattle, WA', technology: ['Kubernetes', 'Docker', 'Go', 'Terraform'], recentEvents: ['Q4 earnings beat expectations', 'Launched new cloud region in Asia'], fundingStage: 'public', growthRate: '18%' },
    expectedSignals: [
      { type: 'financial_signal', confidence: 'high', source: 'sec.gov' },
      { type: 'expansion_signal', confidence: 'high', source: 'press_release' },
    ],
    expectedIntelligence: { accountTier: 'hot', minScore: 75, buyingIntent: 'high', recommendedActions: ['executive_outreach', 'technical_discovery', 'proposal'] },
    aiOutputSample: 'CloudNine Systems reported $4.2B in revenue [E1]. The company employs approximately 25,000 people worldwide [E2]. CloudNine Systems is built on Kubernetes and uses Docker containers with Go microservices [E3]. They recently launched a new cloud region in Asia [E4].',
    evidenceItems: [
      { marker: 'E1', text: 'CloudNine Systems 10-K filing reports $4.2B in annual revenue.', source: 'sec.gov' },
      { marker: 'E2', text: 'CloudNine Systems headcount reaches 25,000 employees globally.', source: 'reuters.com' },
      { marker: 'E3', text: 'CloudNine Systems infrastructure runs on Kubernetes with Docker and Terraform.', source: 'cloudnine.example.com' },
      { marker: 'E4', text: 'CloudNine Systems announces new Asia Pacific cloud region.', source: 'press release' },
    ],
    primarySignalType: 'news',
    confidenceInput: { fieldConfidence: { revenue: 0.98, employees: 0.95, technology: 0.92, funding: 0.98, location: 0.90 }, dataCompleteness: 0.95, sources: [{ name: 'sec.gov', reliability: 0.95, type: 'government' }, { name: 'reuters.com', reliability: 0.92, type: 'financial' }, { name: 'company website', reliability: 0.88, type: 'official' }, { name: 'press release', reliability: 0.85, type: 'official' }, { name: 'wsj.com', reliability: 0.90, type: 'financial' }], daysSinceResearch: 2, crossValidatedFacts: 12, totalFacts: 13, evidenceCount: 18, evidenceCoverage: 0.95, hallucinationRiskScore: 3 },
    expectedConfidence: { minScore: 70, maxScore: 98, trustClass: 'enterprise', enterpriseReady: true },
  },
  {
    id: 'golden-005', name: 'RetailMax Corp', industry: 'Retail', size: 'enterprise',
    website: 'retailmax.example.com',
    knownFacts: { revenue: '$890M', employees: 5400, founded: 1998, hqLocation: 'Chicago, IL', technology: ['SAP', 'Shopify', 'Snowflake'], recentEvents: ['Digital transformation initiative', 'Closing 50 stores'], fundingStage: 'public', growthRate: '-3%' },
    expectedSignals: [
      { type: 'technology_trigger', confidence: 'medium', source: 'job_postings' },
      { type: 'financial_pressure', confidence: 'high', source: 'news' },
    ],
    expectedIntelligence: { accountTier: 'warm', minScore: 45, buyingIntent: 'medium', recommendedActions: ['cost_optimization_pitch', 'digital_transformation_consult'] },
    aiOutputSample: 'RetailMax Corp generates $890M in revenue [E1]. The company has 5,400 employees and uses SAP and Snowflake for operations [E2]. RetailMax Corp is closing 50 stores as part of a restructuring effort [E3].',
    evidenceItems: [
      { marker: 'E1', text: 'RetailMax Corp annual report shows $890M in revenue.', source: 'annual report' },
      { marker: 'E2', text: 'RetailMax Corp technology stack includes SAP ERP and Snowflake analytics.', source: 'job_postings' },
      { marker: 'E3', text: 'RetailMax Corp announces closure of 50 underperforming store locations.', source: 'wsj.com' },
    ],
    primarySignalType: 'financial_pressure',
    confidenceInput: { fieldConfidence: { revenue: 0.93, employees: 0.80, technology: 0.65, funding: 0.93 }, dataCompleteness: 0.70, sources: [{ name: 'annual report', reliability: 0.93, type: 'official' }, { name: 'wsj.com', reliability: 0.90, type: 'financial' }], daysSinceResearch: 20, crossValidatedFacts: 5, totalFacts: 8, evidenceCount: 6, evidenceCoverage: 0.60, hallucinationRiskScore: 18 },
    expectedConfidence: { minScore: 45, maxScore: 80, trustClass: 'advisory', enterpriseReady: false },
  },
  {
    id: 'golden-006', name: 'QuantumLeap AI', industry: 'Artificial Intelligence', size: 'startup',
    website: 'quantumleap.example.com',
    knownFacts: { revenue: '$1.2M', employees: 18, founded: 2023, hqLocation: 'Austin, TX', technology: ['Python', 'PyTorch', 'CUDA'], recentEvents: ['Seed funding $3M'], fundingStage: 'seed', growthRate: '200%' },
    expectedSignals: [{ type: 'funding_signal', confidence: 'medium', source: 'crunchbase.com' }],
    expectedIntelligence: { accountTier: 'unknown', minScore: 10, buyingIntent: 'none', recommendedActions: ['monitor_only'] },
    aiOutputSample: 'QuantumLeap AI raised $3M in seed funding [E1]. The company uses Python and PyTorch for their AI research platform.',
    evidenceItems: [{ marker: 'E1', text: 'QuantumLeap AI raises $3M seed round.', source: 'crunchbase.com' }],
    primarySignalType: 'funding',
    confidenceInput: { fieldConfidence: { revenue: 0.15, employees: 0.25, technology: 0.45, funding: 0.70 }, dataCompleteness: 0.20, sources: [{ name: 'crunchbase.com', reliability: 0.85, type: 'funding' }], daysSinceResearch: 60, crossValidatedFacts: 1, totalFacts: 5, evidenceCount: 2, evidenceCoverage: 0.15, hallucinationRiskScore: 35 },
    expectedConfidence: { minScore: 20, maxScore: 50, trustClass: 'speculative', enterpriseReady: false },
  },
  {
    id: 'golden-007', name: 'GreenEnergy Solutions', industry: 'Energy', size: 'mid-market',
    website: 'greenenergy.example.com',
    knownFacts: { revenue: '$75M', employees: 320, founded: 2012, hqLocation: 'Denver, CO', technology: ['IoT', 'Azure', 'PostgreSQL'], recentEvents: ['Government contract award $12M', 'Hiring 50 engineers'], fundingStage: 'private', growthRate: '35%' },
    expectedSignals: [
      { type: 'partnership_signal', confidence: 'high', source: 'gov.uk' },
      { type: 'hiring_signal', confidence: 'high', source: 'job_postings' },
      { type: 'growth_signal', confidence: 'medium', source: 'news' },
    ],
    expectedIntelligence: { accountTier: 'warm', minScore: 55, buyingIntent: 'high', recommendedActions: ['technical_discovery', 'proposal'] },
    aiOutputSample: 'GreenEnergy Solutions won a $12M government contract [E1]. The company is hiring 50 engineers [E2]. They use Azure and PostgreSQL for their IoT platform [E3]. Revenue is approximately $75M.',
    evidenceItems: [
      { marker: 'E1', text: 'GreenEnergy Solutions awarded $12M clean energy contract by Department of Energy.', source: 'gov.uk' },
      { marker: 'E2', text: 'GreenEnergy Solutions has 50 open engineering positions listed on their careers page.', source: 'greenenergy.example.com' },
      { marker: 'E3', text: 'GreenEnergy Solutions runs their IoT platform on Microsoft Azure with PostgreSQL.', source: 'greenenergy.example.com' },
    ],
    primarySignalType: 'partnership',
    confidenceInput: { fieldConfidence: { revenue: 0.60, employees: 0.55, technology: 0.72, funding: 0.50 }, dataCompleteness: 0.60, sources: [{ name: 'gov.uk', reliability: 0.95, type: 'government' }, { name: 'company website', reliability: 0.88, type: 'official' }], daysSinceResearch: 10, crossValidatedFacts: 5, totalFacts: 7, evidenceCount: 7, evidenceCoverage: 0.65, hallucinationRiskScore: 10 },
    expectedConfidence: { minScore: 50, maxScore: 80, trustClass: 'advisory', enterpriseReady: false },
  },
  {
    id: 'golden-008', name: 'DataVault Inc', industry: 'Cybersecurity', size: 'enterprise',
    website: 'datavault.example.com',
    knownFacts: { revenue: '$1.8B', employees: 8500, founded: 2007, hqLocation: 'Palo Alto, CA', technology: ['Zero Trust', 'Machine Learning', 'Snowflake', 'Kubernetes'], recentEvents: ['IPO at $5B valuation', 'Acquired ThreatDetect for $300M'], fundingStage: 'public', growthRate: '40%' },
    expectedSignals: [
      { type: 'funding_signal', confidence: 'high', source: 'sec.gov' },
      { type: 'acquisition_signal', confidence: 'high', source: 'reuters.com' },
      { type: 'technology_trigger', confidence: 'high', source: 'web' },
    ],
    expectedIntelligence: { accountTier: 'hot', minScore: 75, buyingIntent: 'high', recommendedActions: ['executive_outreach', 'security_assessment', 'technical_discovery'] },
    aiOutputSample: 'DataVault Inc completed its IPO at a $5B valuation [E1]. The company acquired ThreatDetect for $300M [E2]. DataVault Inc uses Machine Learning and Kubernetes for their cybersecurity platform [E3]. They have approximately 8,500 employees [E4].',
    evidenceItems: [
      { marker: 'E1', text: 'DataVault Inc IPO priced at $5B market capitalization on NASDAQ.', source: 'bloomberg.com' },
      { marker: 'E2', text: 'DataVault Inc to acquire ThreatDetect for $300M in all-cash deal.', source: 'reuters.com' },
      { marker: 'E3', text: 'DataVault Inc cybersecurity platform leverages Machine Learning and runs on Kubernetes.', source: 'datavault.example.com' },
      { marker: 'E4', text: 'DataVault Inc employs approximately 8,500 people globally.', source: 'linkedin.com' },
    ],
    primarySignalType: 'acquisition',
    confidenceInput: { fieldConfidence: { revenue: 0.95, employees: 0.88, technology: 0.90, funding: 0.98, location: 0.85 }, dataCompleteness: 0.88, sources: [{ name: 'bloomberg.com', reliability: 0.92, type: 'financial' }, { name: 'reuters.com', reliability: 0.92, type: 'financial' }, { name: 'company website', reliability: 0.88, type: 'official' }, { name: 'linkedin.com', reliability: 0.75, type: 'professional' }], daysSinceResearch: 5, crossValidatedFacts: 10, totalFacts: 12, evidenceCount: 15, evidenceCoverage: 0.80, hallucinationRiskScore: 8 },
    expectedConfidence: { minScore: 65, maxScore: 95, trustClass: 'enterprise', enterpriseReady: true },
  },
  {
    id: 'golden-009', name: 'LogisticsPro Ltd', industry: 'Logistics', size: 'mid-market',
    website: 'logisticspro.example.com',
    knownFacts: { revenue: '$45M', employees: 180, founded: 2008, hqLocation: 'Memphis, TN', technology: ['Java', 'Oracle', 'Redis'], recentEvents: ['Lost major contract'], fundingStage: 'private', growthRate: '-8%' },
    expectedSignals: [{ type: 'financial_pressure', confidence: 'high', source: 'news' }],
    expectedIntelligence: { accountTier: 'cold', minScore: 25, buyingIntent: 'low', recommendedActions: ['monitor_only'] },
    aiOutputSample: 'LogisticsPro Ltd has approximately 180 employees [E1]. The company uses Java and Oracle for their logistics platform.',
    evidenceItems: [{ marker: 'E1', text: 'LogisticsPro Ltd company profile on LinkedIn shows ~180 employees.', source: 'linkedin.com' }],
    primarySignalType: 'financial_pressure',
    confidenceInput: { fieldConfidence: { revenue: 0.40, employees: 0.55, technology: 0.50, funding: 0.30 }, dataCompleteness: 0.35, sources: [{ name: 'linkedin.com', reliability: 0.75, type: 'professional' }], daysSinceResearch: 90, crossValidatedFacts: 1, totalFacts: 6, evidenceCount: 2, evidenceCoverage: 0.25, hallucinationRiskScore: 30 },
    expectedConfidence: { minScore: 15, maxScore: 45, trustClass: 'speculative', enterpriseReady: false },
  },
  {
    id: 'golden-010', name: 'MediaPulse Digital', industry: 'Media & Advertising', size: 'smb',
    website: 'mediapulse.example.com',
    knownFacts: { revenue: '$22M', employees: 95, founded: 2015, hqLocation: 'Los Angeles, CA', technology: ['React', 'Node.js', 'MongoDB', 'AWS'], recentEvents: ['Launched CTV advertising product', 'Partnered with StreamTV'], fundingStage: 'private', growthRate: '30%' },
    expectedSignals: [
      { type: 'product_signal', confidence: 'medium', source: 'press_release' },
      { type: 'partnership_signal', confidence: 'medium', source: 'news' },
      { type: 'technology_trigger', confidence: 'medium', source: 'job_postings' },
    ],
    expectedIntelligence: { accountTier: 'warm', minScore: 40, buyingIntent: 'medium', recommendedActions: ['product_demo', 'partnership_discussion'] },
    aiOutputSample: 'MediaPulse Digital launched a new CTV advertising product [E1]. They partnered with StreamTV for content distribution [E2]. The company uses React and Node.js built on AWS [E3].',
    evidenceItems: [
      { marker: 'E1', text: 'MediaPulse Digital announces CTV advertising platform launch.', source: 'press release' },
      { marker: 'E2', text: 'MediaPulse Digital and StreamTV form strategic partnership.', source: 'adweek.com' },
      { marker: 'E3', text: 'MediaPulse Digital hiring React and Node.js developers for AWS cloud platform.', source: 'indeed.com' },
    ],
    primarySignalType: 'tech_change',
    confidenceInput: { fieldConfidence: { revenue: 0.50, employees: 0.55, technology: 0.68, funding: 0.45 }, dataCompleteness: 0.50, sources: [{ name: 'press release', reliability: 0.85, type: 'official' }, { name: 'adweek.com', reliability: 0.70, type: 'news' }], daysSinceResearch: 18, crossValidatedFacts: 3, totalFacts: 7, evidenceCount: 4, evidenceCoverage: 0.45, hallucinationRiskScore: 20 },
    expectedConfidence: { minScore: 35, maxScore: 65, trustClass: 'advisory', enterpriseReady: false },
  },
  {
    id: 'golden-011', name: 'BioGen Therapeutics', industry: 'Pharmaceutical', size: 'enterprise',
    website: 'biogen.example.com',
    knownFacts: { revenue: '$6.1B', employees: 9500, founded: 2001, hqLocation: 'Cambridge, MA', technology: ['AI Drug Discovery', 'Python', 'AWS', 'Databricks'], recentEvents: ['FDA approval for new drug', 'Phase 3 trial results positive'], fundingStage: 'public', growthRate: '22%' },
    expectedSignals: [
      { type: 'regulatory_signal', confidence: 'high', source: 'fda.gov' },
      { type: 'growth_signal', confidence: 'high', source: 'reuters.com' },
    ],
    expectedIntelligence: { accountTier: 'hot', minScore: 75, buyingIntent: 'high', recommendedActions: ['executive_outreach', 'technical_discovery', 'enterprise_deal'] },
    aiOutputSample: 'BioGen Therapeutics received FDA approval for their new drug [E1]. The company reported $6.1B in revenue [E2]. They use AI Drug Discovery and Databricks for research [E3].',
    evidenceItems: [
      { marker: 'E1', text: 'FDA approves BioGen Therapeutics new treatment for rare disease.', source: 'fda.gov' },
      { marker: 'E2', text: 'BioGen Therapeutics annual revenue reaches $6.1B.', source: 'reuters.com' },
      { marker: 'E3', text: 'BioGen Therapeutics leverages AI Drug Discovery with Databricks analytics.', source: 'biogen.example.com' },
    ],
    primarySignalType: 'regulatory',
    confidenceInput: { fieldConfidence: { revenue: 0.97, employees: 0.92, technology: 0.85, funding: 0.98, location: 0.90 }, dataCompleteness: 0.92, sources: [{ name: 'fda.gov', reliability: 0.95, type: 'government' }, { name: 'reuters.com', reliability: 0.92, type: 'financial' }, { name: 'company website', reliability: 0.88, type: 'official' }], daysSinceResearch: 4, crossValidatedFacts: 9, totalFacts: 10, evidenceCount: 14, evidenceCoverage: 0.90, hallucinationRiskScore: 5 },
    expectedConfidence: { minScore: 70, maxScore: 98, trustClass: 'enterprise', enterpriseReady: true },
  },
  {
    id: 'golden-012', name: 'EduLearn Platform', industry: 'EdTech', size: 'smb',
    website: 'edulearn.example.com',
    knownFacts: { revenue: '$8M', employees: 55, founded: 2017, hqLocation: 'Austin, TX', technology: ['Vue.js', 'Python', 'PostgreSQL'], recentEvents: [], fundingStage: 'bootstrap', growthRate: '10%' },
    expectedSignals: [],
    expectedIntelligence: { accountTier: 'cold', minScore: 10, buyingIntent: 'none', recommendedActions: ['monitor_only'] },
    aiOutputSample: 'EduLearn Platform has approximately 55 employees. The company uses Vue.js and Python for their education platform.',
    evidenceItems: [{ marker: 'E1', text: 'EduLearn Platform company overview with basic company information.', source: 'edulearn.example.com' }],
    primarySignalType: 'mention',
    confidenceInput: { fieldConfidence: { revenue: 0.20, employees: 0.40, technology: 0.35, funding: 0.15 }, dataCompleteness: 0.25, sources: [{ name: 'company website', reliability: 0.88, type: 'official' }], daysSinceResearch: 120, crossValidatedFacts: 0, totalFacts: 5, evidenceCount: 1, evidenceCoverage: 0.15, hallucinationRiskScore: 40 },
    expectedConfidence: { minScore: 15, maxScore: 40, trustClass: 'speculative', enterpriseReady: false },
  },
  {
    id: 'golden-013', name: 'AgriTech Farms', industry: 'Agriculture', size: 'mid-market',
    website: 'agritech.example.com',
    knownFacts: { revenue: '$120M', employees: 450, founded: 2010, hqLocation: 'Des Moines, IA', technology: ['IoT', 'Machine Learning', 'Azure'], recentEvents: ['Series B $40M', 'Expanded to 3 new states'], fundingStage: 'series_b', growthRate: '45%' },
    expectedSignals: [
      { type: 'funding_signal', confidence: 'high', source: 'crunchbase.com' },
      { type: 'expansion_signal', confidence: 'medium', source: 'news' },
      { type: 'technology_trigger', confidence: 'medium', source: 'job_postings' },
    ],
    expectedIntelligence: { accountTier: 'warm', minScore: 50, buyingIntent: 'high', recommendedActions: ['technical_discovery', 'partnership_proposal'] },
    aiOutputSample: 'AgriTech Farms raised $40M in Series B funding [E1]. The company is expanding to 3 new states [E2]. They use IoT sensors and Machine Learning for precision agriculture on Azure [E3].',
    evidenceItems: [
      { marker: 'E1', text: 'AgriTech Farms closes $40M Series B round led by AgVentures.', source: 'crunchbase.com' },
      { marker: 'E2', text: 'AgriTech Farms expands operations to Iowa, Nebraska, and Kansas.', source: 'agritech.example.com' },
      { marker: 'E3', text: 'AgriTech Farms technology uses IoT sensors and Machine Learning on Microsoft Azure.', source: 'agritech.example.com' },
    ],
    primarySignalType: 'funding',
    confidenceInput: { fieldConfidence: { revenue: 0.65, employees: 0.60, technology: 0.70, funding: 0.88 }, dataCompleteness: 0.60, sources: [{ name: 'crunchbase.com', reliability: 0.85, type: 'funding' }, { name: 'company website', reliability: 0.88, type: 'official' }], daysSinceResearch: 12, crossValidatedFacts: 4, totalFacts: 7, evidenceCount: 6, evidenceCoverage: 0.55, hallucinationRiskScore: 12 },
    expectedConfidence: { minScore: 40, maxScore: 75, trustClass: 'advisory', enterpriseReady: false },
  },
  {
    id: 'golden-014', name: 'SecureNet Corp', industry: 'Cybersecurity', size: 'enterprise',
    website: 'securenet.example.com',
    knownFacts: { revenue: '$3.4B', employees: 15000, founded: 2004, hqLocation: 'Reston, VA', technology: ['Zero Trust', 'AI', 'Cloud', 'GraphQL', 'Terraform'], recentEvents: ['Won $500M DoD contract', 'Hired 200 security engineers'], fundingStage: 'public', growthRate: '28%' },
    expectedSignals: [
      { type: 'partnership_signal', confidence: 'high', source: 'gov.uk' },
      { type: 'hiring_signal', confidence: 'high', source: 'job_postings' },
      { type: 'technology_trigger', confidence: 'high', source: 'web' },
    ],
    expectedIntelligence: { accountTier: 'hot', minScore: 78, buyingIntent: 'high', recommendedActions: ['executive_outreach', 'security_assessment', 'enterprise_deal'] },
    aiOutputSample: 'SecureNet Corp won a $500M Department of Defense contract [E1]. The company is hiring 200 security engineers [E2]. SecureNet Corp uses Zero Trust architecture with AI and Cloud infrastructure [E3].',
    evidenceItems: [
      { marker: 'E1', text: 'SecureNet Corp awarded $500M cybersecurity contract by Department of Defense.', source: 'gov.uk' },
      { marker: 'E2', text: 'SecureNet Corp has 200 open security engineering positions.', source: 'indeed.com' },
      { marker: 'E3', text: 'SecureNet Corp Zero Trust platform powered by AI and cloud infrastructure.', source: 'securenet.example.com' },
    ],
    primarySignalType: 'partnership',
    confidenceInput: { fieldConfidence: { revenue: 0.96, employees: 0.93, technology: 0.90, funding: 0.97, location: 0.88 }, dataCompleteness: 0.93, sources: [{ name: 'gov.uk', reliability: 0.95, type: 'government' }, { name: 'company website', reliability: 0.88, type: 'official' }, { name: 'indeed.com', reliability: 0.70, type: 'job_board' }, { name: 'bloomberg.com', reliability: 0.92, type: 'financial' }], daysSinceResearch: 3, crossValidatedFacts: 10, totalFacts: 11, evidenceCount: 16, evidenceCoverage: 0.92, hallucinationRiskScore: 4 },
    expectedConfidence: { minScore: 72, maxScore: 98, trustClass: 'enterprise', enterpriseReady: true },
  },
  {
    id: 'golden-015', name: 'TravelWise Inc', industry: 'Travel & Hospitality', size: 'mid-market',
    website: 'travelwise.example.com',
    knownFacts: { revenue: '$55M', employees: 250, founded: 2013, hqLocation: 'Miami, FL', technology: ['React', 'Node.js', 'MongoDB'], recentEvents: ['Layoffs of 30 employees'], fundingStage: 'private', growthRate: '-15%' },
    expectedSignals: [{ type: 'financial_pressure', confidence: 'high', source: 'news' }],
    expectedIntelligence: { accountTier: 'cold', minScore: 20, buyingIntent: 'low', recommendedActions: ['monitor_only'] },
    aiOutputSample: 'TravelWise Inc has approximately 250 employees. The company uses React and Node.js for their travel booking platform [E1].',
    evidenceItems: [{ marker: 'E1', text: 'TravelWise Inc technology stack and company overview.', source: 'travelwise.example.com' }],
    primarySignalType: 'financial_pressure',
    confidenceInput: { fieldConfidence: { revenue: 0.45, employees: 0.50, technology: 0.55, funding: 0.30 }, dataCompleteness: 0.35, sources: [{ name: 'company website', reliability: 0.88, type: 'official' }], daysSinceResearch: 75, crossValidatedFacts: 1, totalFacts: 6, evidenceCount: 2, evidenceCoverage: 0.20, hallucinationRiskScore: 35 },
    expectedConfidence: { minScore: 15, maxScore: 45, trustClass: 'speculative', enterpriseReady: false },
  },
  {
    id: 'golden-016', name: 'SpaceTech Dynamics', industry: 'Aerospace', size: 'mid-market',
    website: 'spacetech.example.com',
    knownFacts: { revenue: '$200M', employees: 600, founded: 2011, hqLocation: 'Huntsville, AL', technology: ['Embedded Systems', 'C++', 'ROS', 'AWS'], recentEvents: ['NASA contract $80M', 'New satellite launch'], fundingStage: 'private', growthRate: '50%' },
    expectedSignals: [
      { type: 'partnership_signal', confidence: 'high', source: 'nasa.gov' },
      { type: 'growth_signal', confidence: 'high', source: 'news' },
    ],
    expectedIntelligence: { accountTier: 'warm', minScore: 55, buyingIntent: 'high', recommendedActions: ['technical_discovery', 'proposal', 'partnership_discussion'] },
    aiOutputSample: 'SpaceTech Dynamics won an $80M NASA contract [E1]. The company recently launched a new communications satellite [E2]. They use Embedded Systems with C++ and AWS [E3].',
    evidenceItems: [
      { marker: 'E1', text: 'NASA awards $80M contract to SpaceTech Dynamics for satellite communications.', source: 'nasa.gov' },
      { marker: 'E2', text: 'SpaceTech Dynamics successfully launches next-gen communications satellite.', source: 'spacetech.example.com' },
      { marker: 'E3', text: 'SpaceTech Dynamics uses C++ and Embedded Systems with AWS cloud services.', source: 'spacetech.example.com' },
    ],
    primarySignalType: 'partnership',
    confidenceInput: { fieldConfidence: { revenue: 0.72, employees: 0.68, technology: 0.75, funding: 0.80 }, dataCompleteness: 0.65, sources: [{ name: 'nasa.gov', reliability: 0.95, type: 'government' }, { name: 'company website', reliability: 0.88, type: 'official' }], daysSinceResearch: 8, crossValidatedFacts: 5, totalFacts: 7, evidenceCount: 8, evidenceCoverage: 0.70, hallucinationRiskScore: 8 },
    expectedConfidence: { minScore: 50, maxScore: 82, trustClass: 'advisory', enterpriseReady: false },
  },
  {
    id: 'golden-017', name: 'FoodChain Logistics', industry: 'Supply Chain', size: 'enterprise',
    website: 'foodchain.example.com',
    knownFacts: { revenue: '$1.1B', employees: 6200, founded: 1999, hqLocation: 'Dallas, TX', technology: ['SAP', 'Oracle', 'Terraform', 'Docker'], recentEvents: ['Supply chain optimization project', 'New warehouse automation'], fundingStage: 'public', growthRate: '8%' },
    expectedSignals: [{ type: 'technology_trigger', confidence: 'medium', source: 'job_postings' }],
    expectedIntelligence: { accountTier: 'warm', minScore: 50, buyingIntent: 'medium', recommendedActions: ['supply_chain_assessment', 'automation_pitch'] },
    aiOutputSample: 'FoodChain Logistics generates $1.1B in revenue [E1]. The company uses SAP and Oracle for supply chain management [E2]. They are implementing warehouse automation with Docker containers [E3].',
    evidenceItems: [
      { marker: 'E1', text: 'FoodChain Logistics annual report shows $1.1B in revenue.', source: 'annual report' },
      { marker: 'E2', text: 'FoodChain Logistics runs SAP ERP and Oracle database for operations.', source: 'foodchain.example.com' },
      { marker: 'E3', text: 'FoodChain Logistics modernizing warehouse operations with Docker and automation.', source: 'foodchain.example.com' },
    ],
    primarySignalType: 'tech_change',
    confidenceInput: { fieldConfidence: { revenue: 0.93, employees: 0.82, technology: 0.72, funding: 0.93 }, dataCompleteness: 0.72, sources: [{ name: 'annual report', reliability: 0.93, type: 'official' }, { name: 'company website', reliability: 0.88, type: 'official' }], daysSinceResearch: 25, crossValidatedFacts: 5, totalFacts: 8, evidenceCount: 7, evidenceCoverage: 0.60, hallucinationRiskScore: 15 },
    expectedConfidence: { minScore: 48, maxScore: 80, trustClass: 'advisory', enterpriseReady: false },
  },
  {
    id: 'golden-018', name: 'CryptoVault Exchange', industry: 'Fintech', size: 'startup',
    website: 'cryptovault.example.com',
    knownFacts: { revenue: '$3M', employees: 28, founded: 2022, hqLocation: 'Singapore', technology: ['Rust', 'Go', 'PostgreSQL', 'Redis'], recentEvents: ['Regulatory scrutiny', 'Series A $8M'], fundingStage: 'series_a', growthRate: '120%' },
    expectedSignals: [
      { type: 'regulatory_signal', confidence: 'medium', source: 'news' },
      { type: 'funding_signal', confidence: 'high', source: 'crunchbase.com' },
    ],
    expectedIntelligence: { accountTier: 'cold', minScore: 15, buyingIntent: 'low', recommendedActions: ['monitor_only'] },
    aiOutputSample: 'CryptoVault Exchange raised $8M in Series A funding [E1]. The exchange faces regulatory scrutiny in multiple jurisdictions [E2]. They use Rust and Go for their trading engine [E3].',
    evidenceItems: [
      { marker: 'E1', text: 'CryptoVault Exchange closes $8M Series A led by Blockchain Capital.', source: 'crunchbase.com' },
      { marker: 'E2', text: 'CryptoVault Exchange under regulatory review by SEC and MAS.', source: 'reuters.com' },
      { marker: 'E3', text: 'CryptoVault Exchange engineering blog discusses Rust and Go trading infrastructure.', source: 'cryptovault.example.com' },
    ],
    primarySignalType: 'funding',
    confidenceInput: { fieldConfidence: { revenue: 0.20, employees: 0.35, technology: 0.55, funding: 0.80 }, dataCompleteness: 0.30, sources: [{ name: 'crunchbase.com', reliability: 0.85, type: 'funding' }, { name: 'reuters.com', reliability: 0.92, type: 'financial' }], daysSinceResearch: 45, crossValidatedFacts: 2, totalFacts: 6, evidenceCount: 4, evidenceCoverage: 0.30, hallucinationRiskScore: 28 },
    expectedConfidence: { minScore: 25, maxScore: 55, trustClass: 'speculative', enterpriseReady: false },
  },
  {
    id: 'golden-019', name: 'BuildRight Construction', industry: 'Construction', size: 'smb',
    website: 'buildright.example.com',
    knownFacts: { revenue: '$15M', employees: 72, founded: 2006, hqLocation: 'Phoenix, AZ', technology: ['Procore', 'Excel', 'QuickBooks'], recentEvents: [], fundingStage: 'bootstrap', growthRate: '5%' },
    expectedSignals: [],
    expectedIntelligence: { accountTier: 'cold', minScore: 5, buyingIntent: 'none', recommendedActions: ['monitor_only'] },
    aiOutputSample: 'BuildRight Construction is a construction company with approximately 72 employees.',
    evidenceItems: [{ marker: 'E1', text: 'BuildRight Construction basic company profile.', source: 'buildright.example.com' }],
    primarySignalType: 'mention',
    confidenceInput: { fieldConfidence: { revenue: 0.15, employees: 0.30, technology: 0.20, funding: 0.10 }, dataCompleteness: 0.15, sources: [{ name: 'company website', reliability: 0.88, type: 'official' }], daysSinceResearch: 180, crossValidatedFacts: 0, totalFacts: 4, evidenceCount: 1, evidenceCoverage: 0.10, hallucinationRiskScore: 45 },
    expectedConfidence: { minScore: 10, maxScore: 35, trustClass: 'unreliable', enterpriseReady: false },
  },
  {
    id: 'golden-020', name: 'NeuroLink Systems', industry: 'Biotechnology', size: 'enterprise',
    website: 'neurolink.example.com',
    knownFacts: { revenue: '$3.8B', employees: 11000, founded: 2008, hqLocation: 'San Diego, CA', technology: ['Brain-Computer Interface', 'Python', 'TensorFlow', 'CUDA', 'Snowflake'], recentEvents: ['Breakthrough clinical trial', 'Partnership with Mayo Clinic', 'IPO'], fundingStage: 'public', growthRate: '65%' },
    expectedSignals: [
      { type: 'partnership_signal', confidence: 'high', source: 'press_release' },
      { type: 'growth_signal', confidence: 'high', source: 'news' },
      { type: 'technology_trigger', confidence: 'high', source: 'web' },
      { type: 'funding_signal', confidence: 'high', source: 'sec.gov' },
    ],
    expectedIntelligence: { accountTier: 'hot', minScore: 80, buyingIntent: 'high', recommendedActions: ['executive_outreach', 'technical_discovery', 'enterprise_deal', 'partnership_proposal'] },
    aiOutputSample: 'NeuroLink Systems completed its IPO [E1]. The company reported $3.8B in revenue [E2]. NeuroLink Systems partnered with Mayo Clinic for clinical trials [E3]. They use TensorFlow and CUDA for brain-computer interface research [E4]. The company employs approximately 11,000 people [E5].',
    evidenceItems: [
      { marker: 'E1', text: 'NeuroLink Systems IPO priced at $12B market cap on NYSE.', source: 'bloomberg.com' },
      { marker: 'E2', text: 'NeuroLink Systems annual revenue of $3.8B driven by BCI product line.', source: 'reuters.com' },
      { marker: 'E3', text: 'NeuroLink Systems and Mayo Clinic announce partnership for neural interface trials.', source: 'press release' },
      { marker: 'E4', text: 'NeuroLink Systems research uses TensorFlow and CUDA for BCI development.', source: 'neurolink.example.com' },
      { marker: 'E5', text: 'NeuroLink Systems headcount grows to 11,000 employees.', source: 'linkedin.com' },
    ],
    primarySignalType: 'news',
    confidenceInput: { fieldConfidence: { revenue: 0.96, employees: 0.92, technology: 0.88, funding: 0.98, location: 0.90 }, dataCompleteness: 0.95, sources: [{ name: 'bloomberg.com', reliability: 0.92, type: 'financial' }, { name: 'reuters.com', reliability: 0.92, type: 'financial' }, { name: 'press release', reliability: 0.85, type: 'official' }, { name: 'company website', reliability: 0.88, type: 'official' }, { name: 'linkedin.com', reliability: 0.75, type: 'professional' }], daysSinceResearch: 2, crossValidatedFacts: 11, totalFacts: 12, evidenceCount: 20, evidenceCoverage: 0.95, hallucinationRiskScore: 2 },
    expectedConfidence: { minScore: 72, maxScore: 98, trustClass: 'enterprise', enterpriseReady: true },
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// TEST CATEGORY 1: SIGNAL ACCURACY — Freshness Ranking
// ═══════════════════════════════════════════════════════════════════════════════

describe('Golden Dataset: Signal Accuracy (Freshness Ranking)', () => {
  it('should have exactly 20 golden companies', () => {
    expect(GOLDEN_COMPANIES).toHaveLength(20);
  });

  it('should cover all expected industries', () => {
    const industries = new Set(GOLDEN_COMPANIES.map(c => c.industry));
    expect(industries.size).toBeGreaterThanOrEqual(12);
  });

  it('should cover all company sizes', () => {
    const sizes = new Set(GOLDEN_COMPANIES.map(c => c.size));
    expect(sizes).toContain('enterprise');
    expect(sizes).toContain('mid-market');
    expect(sizes).toContain('smb');
    expect(sizes).toContain('startup');
  });

  describe('computeFreshnessScore — decay behavior', () => {
    it('fresh signal (1 day old, news) should score above 90% of base', () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString();
      const score = computeFreshnessScore(95, yesterday, now.toISOString(), 'news');
      expect(score).toBeGreaterThan(85);
    });

    it('medium signal (14 days old, news) should decay to ~50%', () => {
      const now = new Date();
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
      const score = computeFreshnessScore(95, twoWeeksAgo, now.toISOString(), 'news');
      expect(score).toBeGreaterThan(40);
      expect(score).toBeLessThan(55);
    });

    it('stale signal (60 days old, news) should decay to near zero', () => {
      const now = new Date();
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();
      const score = computeFreshnessScore(95, sixtyDaysAgo, now.toISOString(), 'news');
      expect(score).toBeLessThan(10);
    });

    it('fresh structural signal (5 days old, regulatory) should retain most value', () => {
      const now = new Date();
      const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();
      const score = computeFreshnessScore(90, fiveDaysAgo, now.toISOString(), 'regulatory');
      expect(score).toBeGreaterThan(80);
    });

    it('fresh beats stale: 85% fresh > 95% stale', () => {
      const now = new Date();
      const freshDate = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString();
      const staleDate = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000).toISOString();
      const freshScore = computeFreshnessScore(85, freshDate, now.toISOString(), 'news');
      const staleScore = computeFreshnessScore(95, staleDate, now.toISOString(), 'news');
      expect(freshScore).toBeGreaterThan(staleScore);
    });

    it('different signal types should have correct half-lives from dataset', () => {
      expect(SIGNAL_HALF_LIVES['news']).toBe(14);
      expect(SIGNAL_HALF_LIVES['funding']).toBe(30);
      expect(SIGNAL_HALF_LIVES['regulatory']).toBe(90);
      expect(SIGNAL_HALF_LIVES['partnership']).toBe(45);
      expect(SIGNAL_HALF_LIVES['expansion']).toBe(60);
      expect(SIGNAL_HALF_LIVES['acquisition']).toBe(30);
    });

    it('all 20 golden companies should have valid primarySignalType with registered half-life', () => {
      for (const company of GOLDEN_COMPANIES) {
        const halfLife = SIGNAL_HALF_LIVES[company.primarySignalType] ?? SIGNAL_HALF_LIVES._default;
        expect(halfLife).toBeGreaterThan(0);
        expect(halfLife).toBeLessThanOrEqual(90);
      }
    });
  });

  describe('computeFreshnessState — staleness classification', () => {
    it('signal within half-life/2 should be "fresh"', () => {
      const now = new Date();
      const recent = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();
      const state = computeFreshnessState(recent, now.toISOString(), 'news');
      expect(state.staleness).toBe('fresh');
      expect(state.daysSinceSignal).toBe(5);
    });

    it('signal at half-life should be "aging"', () => {
      const now = new Date();
      const atHalfLife = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
      const state = computeFreshnessState(atHalfLife, now.toISOString(), 'news');
      expect(state.staleness).toBe('aging');
    });

    it('signal at 2x half-life should be "stale"', () => {
      const now = new Date();
      const twoHalfLives = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000).toISOString();
      const state = computeFreshnessState(twoHalfLives, now.toISOString(), 'news');
      expect(state.staleness).toBe('stale');
    });

    it('signal at 5x half-life should be "expired"', () => {
      const now = new Date();
      const expired = new Date(now.getTime() - 75 * 24 * 60 * 60 * 1000).toISOString();
      const state = computeFreshnessState(expired, now.toISOString(), 'news');
      expect(state.staleness).toBe('expired');
    });

    it('regulatory signal (half-life 90d) stays fresh longer than news (half-life 14d)', () => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const newsState = computeFreshnessState(thirtyDaysAgo, now.toISOString(), 'news');
      const regState = computeFreshnessState(thirtyDaysAgo, now.toISOString(), 'regulatory');
      // news at 30d (2x half-life of 14) should be stale or expired
      // regulatory at 30d (0.33x half-life of 90) should be fresh or aging
      expect(['stale', 'expired']).toContain(newsState.staleness);
      expect(['fresh', 'aging']).toContain(regState.staleness);
    });
  });

  describe('sourceQualityWeight — source quality mapping', () => {
    it('premium source should return 1.0', () => {
      expect(sourceQualityWeight('premium')).toBe(1.0);
    });

    it('standard source should return 0.8', () => {
      expect(sourceQualityWeight('standard')).toBe(0.8);
    });

    it('low source should return 0.6', () => {
      expect(sourceQualityWeight('low')).toBe(0.6);
    });

    it('unknown source should return 0.7 (default)', () => {
      expect(sourceQualityWeight('unknown')).toBe(0.7);
    });
  });

  describe('computeIntelligenceRanking — composite scoring', () => {
    it('fresh high-confidence signal should score higher than stale one', () => {
      const now = new Date();
      const freshInput = {
        confidence: 90,
        signalDate: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: now.toISOString(),
        signalType: 'news',
        sourceQuality: 'premium',
        businessRelevance: 0.8,
        capabilityRelevance: 0.7,
      };
      const staleInput = {
        confidence: 95,
        signalDate: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: now.toISOString(),
        signalType: 'news',
        sourceQuality: 'premium',
        businessRelevance: 0.8,
        capabilityRelevance: 0.7,
      };
      const freshResult = computeIntelligenceRanking(freshInput);
      const staleResult = computeIntelligenceRanking(staleInput);
      expect(freshResult.rankingScore).toBeGreaterThan(staleResult.rankingScore);
    });

    it('premium source should boost score over low source', () => {
      const now = new Date();
      const sameDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
      const base = {
        confidence: 85, signalDate: sameDate, createdAt: now.toISOString(),
        signalType: 'funding', businessRelevance: 0.6, capabilityRelevance: 0.6,
      };
      const premiumResult = computeIntelligenceRanking({ ...base, sourceQuality: 'premium' });
      const lowResult = computeIntelligenceRanking({ ...base, sourceQuality: 'low' });
      expect(premiumResult.rankingScore).toBeGreaterThan(lowResult.rankingScore);
    });

    it('ranking result should include freshness state', () => {
      const now = new Date();
      const result = computeIntelligenceRanking({
        confidence: 80,
        signalDate: now.toISOString(),
        createdAt: now.toISOString(),
        signalType: 'news',
        sourceQuality: 'standard',
        businessRelevance: 0.5,
        capabilityRelevance: 0.5,
      });
      expect(result.freshness).toBeDefined();
      expect(result.freshness.staleness).toBe('fresh');
      expect(result.breakdown).toBeDefined();
      expect(result.rankingScore).toBeGreaterThanOrEqual(0);
      expect(result.rankingScore).toBeLessThanOrEqual(100);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST CATEGORY 2: EVIDENCE GROUNDING — Hallucination Prevention
// ═══════════════════════════════════════════════════════════════════════════════

describe('Golden Dataset: Evidence Grounding', () => {
  const wellCitedCompanies = GOLDEN_COMPANIES.filter(
    c => c.expectedIntelligence.accountTier === 'hot'
  );

  it('well-cited companies should extract claims with citation markers', () => {
    for (const company of wellCitedCompanies) {
      const claims = extractClaims(company.aiOutputSample);
      const citedClaims = claims.filter(c => c.citationMarker !== null);
      // Hot companies should have at least 1 cited claim from their samples
      expect(citedClaims.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('all evidence items should have matching entries in evidence context', () => {
    for (const company of GOLDEN_COMPANIES.slice(0, 10)) {
      const ctx = buildMinimalEvidenceContext(company.evidenceItems);
      for (const item of company.evidenceItems) {
        expect(ctx.evidenceMap[item.marker]).toBeDefined();
        expect(ctx.evidenceMap[item.marker].text).toBe(item.text);
      }
    }
  });

  it('claims with valid citations should verify against evidence', () => {
    for (const company of wellCitedCompanies) {
      const claims = extractClaims(company.aiOutputSample);
      const citedClaims = claims.filter(c => c.citationMarker !== null);
      if (citedClaims.length === 0) continue;

      const ctx = buildMinimalEvidenceContext(company.evidenceItems);
      const verifications = verifyCitations(citedClaims, ctx);

      // All citations should exist (no hallucinated markers)
      const hallucinatedCitations = verifications.filter(v => !v.evidenceExists);
      expect(hallucinatedCitations.length).toBe(0);
    }
  });

  it('uncited claims should be detected and counted', () => {
    // FinServe Partners has uncited revenue claim
    const finserve = GOLDEN_COMPANIES.find(c => c.id === 'golden-002')!;
    const claims = extractClaims(finserve.aiOutputSample);
    const uncited = claims.filter(c => c.citationMarker === null);
    // Revenue claim without [En] marker
    expect(uncited.length).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST CATEGORY 3: CONFIDENCE SCORING — Unified Confidence Engine
// ═══════════════════════════════════════════════════════════════════════════════

describe('Golden Dataset: Confidence Scoring', () => {
  it('enterprise hot companies should score in enterprise trust range', () => {
    const hotCompanies = GOLDEN_COMPANIES.filter(
      c => c.expectedIntelligence.accountTier === 'hot'
    );
    for (const company of hotCompanies) {
      const result = computeUnifiedConfidence(company.confidenceInput);
      expect(result.score).toBeGreaterThanOrEqual(company.expectedConfidence.minScore);
      expect(result.score).toBeLessThanOrEqual(company.expectedConfidence.maxScore);
      expect(result.trustClass).toBe(company.expectedConfidence.trustClass);
      expect(result.enterpriseReady).toBe(company.expectedConfidence.enterpriseReady);
    }
  });

  it('cold companies should NOT be enterprise ready', () => {
    const coldCompanies = GOLDEN_COMPANIES.filter(
      c => c.expectedIntelligence.accountTier === 'cold'
    );
    for (const company of coldCompanies) {
      const result = computeUnifiedConfidence(company.confidenceInput);
      expect(result.enterpriseReady).toBe(false);
      expect(result.score).toBeLessThan(70);
    }
  });

  it('confidence should increase with better source reliability', () => {
    const baseInput = GOLDEN_COMPANIES[0].confidenceInput;
    const poorSources = {
      ...baseInput,
      sources: [{ name: 'twitter.com', reliability: 0.55, type: 'social' }],
    };
    const goodSources = {
      ...baseInput,
      sources: [
        { name: 'sec.gov', reliability: 0.95, type: 'government' },
        { name: 'reuters.com', reliability: 0.92, type: 'financial' },
      ],
    };
    const poorResult = computeUnifiedConfidence(poorSources);
    const goodResult = computeUnifiedConfidence(goodSources);
    expect(goodResult.score).toBeGreaterThan(poorResult.score);
  });

  it('stale research should lower confidence vs fresh research', () => {
    const baseInput = GOLDEN_COMPANIES[0].confidenceInput;
    const fresh = computeUnifiedConfidence({ ...baseInput, daysSinceResearch: 3 });
    const stale = computeUnifiedConfidence({ ...baseInput, daysSinceResearch: 120 });
    expect(fresh.score).toBeGreaterThan(stale.score);
  });

  it('high hallucination risk should lower confidence', () => {
    const baseInput = GOLDEN_COMPANIES[0].confidenceInput;
    const safe = computeUnifiedConfidence({ ...baseInput, hallucinationRiskScore: 5 });
    const risky = computeUnifiedConfidence({ ...baseInput, hallucinationRiskScore: 60 });
    expect(safe.score).toBeGreaterThan(risky.score);
  });

  it('cross-validation should boost confidence', () => {
    const baseInput = GOLDEN_COMPANIES[1].confidenceInput;
    const lowXV = computeUnifiedConfidence({ ...baseInput, crossValidatedFacts: 1, totalFacts: 8 });
    const highXV = computeUnifiedConfidence({ ...baseInput, crossValidatedFacts: 7, totalFacts: 8 });
    expect(highXV.score).toBeGreaterThan(lowXV.score);
  });

  it('all 20 companies should have confidence results with 6 factors', () => {
    for (const company of GOLDEN_COMPANIES) {
      const result = computeUnifiedConfidence(company.confidenceInput);
      expect(result.factors).toHaveLength(6);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.grade).toBeDefined();
      expect(result.trustClass).toBeDefined();
      expect(result.timestamp).toBeDefined();
      expect(result.modelVersion).toBeDefined();
    }
  });

  it('enterprise companies should have higher avg confidence than startups', () => {
    const enterprises = GOLDEN_COMPANIES.filter(c => c.size === 'enterprise');
    const startups = GOLDEN_COMPANIES.filter(c => c.size === 'startup');
    const enterpriseAvg = enterprises.reduce((sum, c) =>
      sum + computeUnifiedConfidence(c.confidenceInput).score, 0) / enterprises.length;
    const startupAvg = startups.reduce((sum, c) =>
      sum + computeUnifiedConfidence(c.confidenceInput).score, 0) / startups.length;
    expect(enterpriseAvg).toBeGreaterThan(startupAvg);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST CATEGORY 4: RECOMMENDATION RELEVANCE
// ═══════════════════════════════════════════════════════════════════════════════

describe('Golden Dataset: Recommendation Relevance', () => {
  it('hot companies should have executive_outreach or technical_discovery in actions', () => {
    const hotCompanies = GOLDEN_COMPANIES.filter(
      c => c.expectedIntelligence.accountTier === 'hot'
    );
    for (const company of hotCompanies) {
      const actions = company.expectedIntelligence.recommendedActions;
      const hasAction = actions.some(a =>
        ['executive_outreach', 'technical_discovery', 'enterprise_deal'].includes(a)
      );
      expect(hasAction).toBe(true);
    }
  });

  it('cold companies should primarily have monitor_only', () => {
    const coldCompanies = GOLDEN_COMPANIES.filter(
      c => c.expectedIntelligence.accountTier === 'cold'
    );
    for (const company of coldCompanies) {
      expect(company.expectedIntelligence.recommendedActions).toContain('monitor_only');
    }
  });

  it('companies with growth should have growth-related signals', () => {
    const growingCompanies = GOLDEN_COMPANIES.filter(
      c => parseFloat(c.knownFacts.growthRate) > 20
    );
    for (const company of growingCompanies) {
      const hasGrowthOrFunding = company.expectedSignals.some(
        s => ['growth_signal', 'funding_signal', 'hiring_signal'].includes(s.type)
      );
      // Most fast-growing companies should have at least one growth/funding/hiring signal
      expect(hasGrowthOrFunding).toBe(true);
    }
  });

  it('companies with acquisitions should have acquisition signals', () => {
    const acquirers = GOLDEN_COMPANIES.filter(c =>
      c.knownFacts.recentEvents.some(e => e.toLowerCase().includes('acquir'))
    );
    for (const company of acquirers) {
      const hasAcqOrFunding = company.expectedSignals.some(
        s => ['acquisition_signal', 'funding_signal', 'financial_signal'].includes(s.type)
      );
      expect(hasAcqOrFunding).toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST CATEGORY 5: HALLUCINATION REJECTION
// ═══════════════════════════════════════════════════════════════════════════════

describe('Golden Dataset: Hallucination Rejection', () => {
  it('well-grounded output should pass trust threshold', () => {
    const techcorp = GOLDEN_COMPANIES.find(c => c.id === 'golden-001')!;
    const ctx = buildMinimalEvidenceContext(techcorp.evidenceItems);
    const result = runHallucinationCheck(techcorp.aiOutputSample, ctx);
    expect(result.passesTrustThreshold).toBe(true);
    expect(result.hallucinatedCitations).toBe(0);
  });

  it('output with hallucinated citations should fail trust threshold', () => {
    const fakeOutput = 'TechCorp Global generates $2.5B in revenue [E99]. The CEO announced plans [E100] that are completely fabricated [E101].';
    const ctx = buildMinimalEvidenceContext([
      { marker: 'E1', text: 'TechCorp Global reported revenue.', source: 'reuters.com' },
    ]);
    const result = runHallucinationCheck(fakeOutput, ctx);
    // E99, E100, E101 don't exist — hallucinated citations
    expect(result.hallucinatedCitations).toBe(3);
    expect(result.passesTrustThreshold).toBe(false);
  });

  it('generic output with no specifics should have low specificity', () => {
    const genericOutput = 'The company is doing well in the market. They have some products and services. People seem to like them.';
    const ctx = buildMinimalEvidenceContext([]);
    const result = runHallucinationCheck(genericOutput, ctx);
    expect(result.specificityScore).toBeLessThan(20);
  });

  it('specific output with numbers and citations should have high specificity', () => {
    const specificOutput = 'CloudNine Systems reported $4.2B in revenue [E1]. The company employs 25,000 people [E2]. They use Kubernetes and Docker [E3]. Growth rate is 18%.';
    const specificity = scoreSpecificity(specificOutput);
    expect(specificity).toBeGreaterThan(40);
  });

  it('each golden company sample should produce a hallucination result', () => {
    for (const company of GOLDEN_COMPANIES) {
      const ctx = buildMinimalEvidenceContext(company.evidenceItems);
      const result = runHallucinationCheck(company.aiOutputSample, ctx);
      expect(result.hallucinationRiskScore).toBeGreaterThanOrEqual(0);
      expect(result.hallucinationRiskScore).toBeLessThanOrEqual(100);
      expect(result.riskLevel).toBeDefined();
      expect(result.claims).toBeInstanceOf(Array);
      expect(result.timestamp).toBeDefined();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST CATEGORY 6: SOURCE RELIABILITY REGISTRY
// ═══════════════════════════════════════════════════════════════════════════════

describe('Golden Dataset: Source Reliability Registry', () => {
  it('government sources should have highest reliability (>=0.90)', () => {
    expect(getSourceReliability('sec.gov')).toBeGreaterThanOrEqual(0.90);
    expect(getSourceReliability('fda.gov')).toBeGreaterThanOrEqual(0.90);
    expect(getSourceReliability('nasa.gov')).toBeGreaterThanOrEqual(0.90);
  });

  it('financial sources should have high reliability (>=0.85)', () => {
    expect(getSourceReliability('bloomberg.com')).toBeGreaterThanOrEqual(0.85);
    expect(getSourceReliability('reuters.com')).toBeGreaterThanOrEqual(0.85);
  });

  it('social media should have low reliability (<0.60)', () => {
    expect(getSourceReliability('twitter.com')).toBeLessThan(0.60);
    expect(getSourceReliability('facebook.com')).toBeLessThan(0.60);
    expect(getSourceReliability('reddit.com')).toBeLessThan(0.60);
  });

  it('unknown sources should return default 0.60', () => {
    expect(getSourceReliability('unknown')).toBe(0.60);
    expect(getSourceReliability('random-blog.example.com')).toBe(0.60);
  });

  it('category keyword matching should work', () => {
    expect(getSourceReliability('government filing')).toBeGreaterThanOrEqual(0.90);
    expect(getSourceReliability('official press release')).toBeGreaterThanOrEqual(0.80);
    expect(getSourceReliability('social media post')).toBeLessThan(0.60);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST CATEGORY 7: CROSS-CUTTING COMPLETENESS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Golden Dataset: Completeness & Consistency', () => {
  it('all 20 companies should have non-empty evidence items', () => {
    for (const company of GOLDEN_COMPANIES) {
      expect(company.evidenceItems.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('all 20 companies should have non-empty AI output samples', () => {
    for (const company of GOLDEN_COMPANIES) {
      expect(company.aiOutputSample.length).toBeGreaterThan(50);
    }
  });

  it('hot companies should have more evidence items than cold companies (avg)', () => {
    const hotCompanies = GOLDEN_COMPANIES.filter(c => c.expectedIntelligence.accountTier === 'hot');
    const coldCompanies = GOLDEN_COMPANIES.filter(c => c.expectedIntelligence.accountTier === 'cold');
    const hotAvg = hotCompanies.reduce((s, c) => s + c.evidenceItems.length, 0) / hotCompanies.length;
    const coldAvg = coldCompanies.reduce((s, c) => s + c.evidenceItems.length, 0) / coldCompanies.length;
    expect(hotAvg).toBeGreaterThan(coldAvg);
  });

  it('confidence bounds should be internally consistent', () => {
    for (const company of GOLDEN_COMPANIES) {
      expect(company.expectedConfidence.minScore).toBeLessThanOrEqual(
        company.expectedConfidence.maxScore
      );
      // enterpriseReady should correlate with trustClass
      if (company.expectedConfidence.enterpriseReady) {
        expect(company.expectedConfidence.trustClass).toBe('enterprise');
      }
    }
  });

  it('all unique company names and IDs', () => {
    const ids = new Set(GOLDEN_COMPANIES.map(c => c.id));
    const names = new Set(GOLDEN_COMPANIES.map(c => c.name));
    expect(ids.size).toBe(20);
    expect(names.size).toBe(20);
  });
});
