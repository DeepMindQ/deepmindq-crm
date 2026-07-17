import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { getVectorIndex } from '@/lib/vector-index';
import { tokenize, textToVector } from '@/lib/embeddings';

/* ═══════════════════════════════════════════════════
   Demo fallback capabilities when DB is empty
   ═══════════════════════════════════════════════════ */
const DEMO_CAPABILITIES = [
  {
    id: 'demo-sl-1',
    title: 'AI & Machine Learning',
    summary: 'End-to-end ML pipeline development, model training, MLOps, and intelligent automation solutions.',
    category: 'service_line',
    serviceLine: 'AI & Machine Learning',
    targetIndustries: 'Financial Services, Healthcare, Manufacturing, Technology, Retail',
    targetRoles: 'CTO, VP of Engineering, Head of AI, Data Science Director, Chief Digital Officer',
    problems: 'Manual processes, data silos, inaccurate predictions, slow time-to-insight, lack of AI strategy',
    evidence: '150+ enterprise ML deployments, average 3x ROI within 12 months',
    content: 'End-to-end ML pipeline development, model training, MLOps, and intelligent automation solutions. We help enterprises build production-grade AI systems that drive measurable business outcomes. Our team specializes in NLP, computer vision, recommendation systems, predictive analytics, and generative AI. We have delivered 150+ enterprise ML deployments with an average 3x ROI within 12 months.',
    targetCompanySizes: 'Mid-Market, Enterprise',
    upvotes: 0, downvotes: 0, usedInEmails: 0, tags: '["ai","ml","automation"]',
  },
  {
    id: 'demo-sl-2',
    title: 'Cloud Engineering',
    summary: 'Multi-cloud architecture design, migration strategy, and cloud-native application development on AWS, Azure, and GCP.',
    category: 'service_line',
    serviceLine: 'Cloud Engineering',
    targetIndustries: 'Financial Services, Healthcare, Technology, Media, Government',
    targetRoles: 'CTO, VP of Engineering, Cloud Architect, Head of Infrastructure, DevOps Director',
    problems: 'Legacy infrastructure, high cloud costs, vendor lock-in, compliance constraints, scalability issues',
    evidence: '200+ cloud migrations completed, 99.99% uptime SLA achieved',
    content: 'Multi-cloud architecture design, migration strategy, and cloud-native application development on AWS, Azure, and GCP. Specializing in complex enterprise migrations with zero downtime. 200+ cloud migrations completed with 99.99% uptime SLA.',
    targetCompanySizes: 'Mid-Market, Enterprise',
    upvotes: 0, downvotes: 0, usedInEmails: 0, tags: '["cloud","aws","azure","gcp","migration"]',
  },
  {
    id: 'demo-sl-3',
    title: 'Data Engineering',
    summary: 'Enterprise data platform design, real-time analytics, data governance, and warehouse modernization.',
    category: 'service_line',
    serviceLine: 'Data Engineering',
    targetIndustries: 'Financial Services, Healthcare, Retail, Technology, Energy',
    targetRoles: 'CDO, Head of Data, VP of Analytics, Data Engineering Lead, BI Director',
    problems: 'Data fragmentation, poor data quality, slow reporting, regulatory compliance, lack of real-time insights',
    evidence: '50+ enterprise data platforms built, 85% reduction in reporting time',
    content: 'Enterprise data platform design, real-time analytics, data governance, and warehouse modernization. Transforming how organizations collect, process, and derive value from their data. Expertise in Snowflake, Databricks, dbt, and real-time streaming architectures.',
    targetCompanySizes: 'Mid-Market, Enterprise',
    upvotes: 0, downvotes: 0, usedInEmails: 0, tags: '["data","analytics","snowflake","databricks"]',
  },
  {
    id: 'demo-sl-4',
    title: 'Digital Transformation',
    summary: 'Legacy system modernization, process automation, and technology strategy consulting.',
    category: 'service_line',
    serviceLine: 'Digital Transformation',
    targetIndustries: 'Manufacturing, Healthcare, Financial Services, Retail, Government',
    targetRoles: 'CEO, CIO, COO, Chief Digital Officer, VP of Technology',
    problems: 'Outdated systems, manual workflows, digital skills gap, change resistance, unclear transformation roadmap',
    evidence: '80+ transformation programs delivered, 60% efficiency gains on average',
    content: 'Legacy system modernization, process automation, and technology strategy consulting. Helping enterprises navigate digital disruption with pragmatic, outcome-focused approaches. 80+ transformation programs delivered with 60% efficiency gains.',
    targetCompanySizes: 'Mid-Market, Enterprise, Startup',
    upvotes: 0, downvotes: 0, usedInEmails: 0, tags: '["digital","transformation","modernization"]',
  },
  {
    id: 'demo-sl-5',
    title: 'Cybersecurity & Compliance',
    summary: 'Security architecture, compliance frameworks (SOC 2, HIPAA, PCI-DSS), penetration testing, and incident response.',
    category: 'service_line',
    serviceLine: 'Cybersecurity',
    targetIndustries: 'Financial Services, Healthcare, Government, Technology',
    targetRoles: 'CISO, CTO, VP of Security, Compliance Officer, IT Director',
    problems: 'Security breaches, compliance gaps, legacy vulnerabilities, threat detection, audit preparation',
    evidence: 'Zero breaches across 100+ security assessments, 99.7% compliance pass rate',
    content: 'Security architecture, compliance frameworks (SOC 2, HIPAA, PCI-DSS), penetration testing, and incident response. We protect critical infrastructure and sensitive data with defense-in-depth strategies.',
    targetCompanySizes: 'Enterprise',
    upvotes: 0, downvotes: 0, usedInEmails: 0, tags: '["security","compliance","soc2","hipaa"]',
  },
  {
    id: 'demo-cs-1',
    title: 'Fortune 500 Financial Services — AI Document Automation',
    summary: 'Reduced processing time by 85% for a Fortune 500 financial services company through AI-powered document automation.',
    category: 'case_study',
    serviceLine: 'AI & Machine Learning',
    targetIndustries: 'Financial Services',
    targetRoles: 'CTO, COO, VP of Operations',
    problems: 'Document processing, compliance overhead, manual data entry',
    evidence: '85% reduction in processing time, $2.5M annual savings',
    content: 'A Fortune 500 financial services firm was drowning in document processing — thousands of loan applications, compliance filings, and client onboarding documents processed manually each week. We deployed an AI-powered document automation system that reduced processing time by 85%, saving $2.5M annually and eliminating 95% of manual errors.',
    targetCompanySizes: 'Enterprise',
    upvotes: 0, downvotes: 0, usedInEmails: 0, tags: '["ai","automation","financial-services","document-processing"]',
  },
  {
    id: 'demo-cs-2',
    title: 'Healthcare Platform — Cloud-Native Migration',
    summary: 'Migrated 200+ microservices to cloud-native architecture for a healthcare platform, achieving 99.99% uptime.',
    category: 'case_study',
    serviceLine: 'Cloud Engineering',
    targetIndustries: 'Healthcare',
    targetRoles: 'CTO, VP of Engineering, Head of Infrastructure',
    problems: 'Legacy monolith, frequent downtime, slow deployments, HIPAA compliance',
    evidence: '200+ microservices migrated, 99.99% uptime, 10x deployment frequency',
    content: 'A healthcare platform running a legacy monolith was experiencing frequent outages and couldn\'t scale to meet growing demand. We migrated 200+ microservices to a cloud-native architecture on AWS with full HIPAA compliance, achieving 99.99% uptime and a 10x increase in deployment frequency.',
    targetCompanySizes: 'Enterprise',
    upvotes: 0, downvotes: 0, usedInEmails: 0, tags: '["cloud","migration","healthcare","aws"]',
  },
  {
    id: 'demo-cs-3',
    title: 'Retail Giant — Real-Time Analytics Platform',
    summary: 'Built a real-time analytics platform for a top-10 retailer, enabling same-day inventory decisions.',
    category: 'case_study',
    serviceLine: 'Data Engineering',
    targetIndustries: 'Retail',
    targetRoles: 'CDO, Head of Analytics, VP of Supply Chain',
    problems: 'Delayed reporting, inventory waste, poor demand forecasting',
    evidence: '85% reduction in reporting latency, $12M inventory savings, 30% improvement in forecast accuracy',
    content: 'A top-10 retailer was making inventory decisions on 24-hour-old data, leading to $40M in annual overstock and stockout costs. We built a real-time analytics platform that processes 2B+ events daily, reducing reporting latency by 85% and enabling same-day inventory decisions that save $12M annually.',
    targetCompanySizes: 'Enterprise',
    upvotes: 0, downvotes: 0, usedInEmails: 0, tags: '["data","analytics","retail","real-time"]',
  },
  {
    id: 'demo-cs-4',
    title: 'Mid-Market Manufacturer — Predictive Maintenance',
    summary: 'Deployed predictive maintenance AI for a mid-market manufacturer, reducing unplanned downtime by 72% and saving $1.8M annually.',
    category: 'case_study',
    serviceLine: 'AI & Machine Learning',
    targetIndustries: 'Manufacturing',
    targetRoles: 'VP of Operations, Head of Engineering, Plant Manager',
    problems: 'Unplanned downtime, equipment failures, maintenance costs',
    evidence: '72% reduction in unplanned downtime, $1.8M annual savings',
    content: 'A mid-market manufacturer with 12 facilities was losing $2.5M annually to unplanned equipment downtime. We deployed IoT sensors and a predictive maintenance AI model that identifies failures 48 hours in advance, reducing unplanned downtime by 72% and saving $1.8M per year.',
    targetCompanySizes: 'Mid-Market',
    upvotes: 0, downvotes: 0, usedInEmails: 0, tags: '["ai","iot","manufacturing","predictive-maintenance"]',
  },
  {
    id: 'demo-cs-5',
    title: 'Startup Fintech — Data Platform Foundation',
    summary: 'Built the entire data infrastructure for a Series B fintech startup from scratch in 8 weeks.',
    category: 'case_study',
    serviceLine: 'Data Engineering',
    targetIndustries: 'Financial Services, Technology',
    targetRoles: 'CTO, Head of Data, VP of Engineering',
    problems: 'No data infrastructure, manual reporting, data silos',
    evidence: '8-week delivery, processes 500M events/day, supports 50+ dashboards',
    content: 'A Series B fintech startup had no data infrastructure and was making all decisions on gut feel. We designed and built their entire data platform from scratch — ingestion pipelines, warehouse, real-time analytics, and BI dashboards — in just 8 weeks. The platform now processes 500M events daily and powers 50+ operational dashboards.',
    targetCompanySizes: 'Startup, Mid-Market',
    upvotes: 0, downvotes: 0, usedInEmails: 0, tags: '["data","fintech","startup","platform"]',
  },
  {
    id: 'demo-pp-1',
    title: '150+ Enterprise Implementations',
    summary: '150+ successful enterprise implementations across financial services, healthcare, manufacturing, and technology sectors.',
    category: 'proof_point',
    serviceLine: null,
    targetIndustries: 'Financial Services, Healthcare, Manufacturing, Technology',
    targetRoles: null,
    problems: null,
    evidence: '150+ projects, 97% client retention rate',
    content: 'DeepMindQ has delivered 150+ successful enterprise implementations across financial services, healthcare, manufacturing, and technology sectors, maintaining a 97% client retention rate.',
    targetCompanySizes: 'Mid-Market, Enterprise',
    upvotes: 0, downvotes: 0, usedInEmails: 0, tags: '["enterprise","track-record"]',
  },
  {
    id: 'demo-pp-2',
    title: 'Average 3x ROI Within 12 Months',
    summary: 'Average 3x ROI within 12 months for clients leveraging our AI and cloud solutions.',
    category: 'proof_point',
    serviceLine: null,
    targetIndustries: 'Financial Services, Healthcare, Manufacturing, Technology, Retail',
    targetRoles: null,
    problems: null,
    evidence: '3x average ROI, 12-month payback period',
    content: 'Clients leveraging DeepMindQ AI and cloud solutions see an average 3x return on investment within the first 12 months, measured by cost savings, revenue impact, and operational efficiency gains.',
    targetCompanySizes: 'Mid-Market, Enterprise',
    upvotes: 0, downvotes: 0, usedInEmails: 0, tags: '["roi","metrics"]',
  },
  {
    id: 'demo-pp-3',
    title: 'Certified Across All Major Clouds',
    summary: 'AWS Advanced Partner, Azure Gold Partner, and GCP Partner with 200+ cloud certifications across the team.',
    category: 'proof_point',
    serviceLine: 'Cloud Engineering',
    targetIndustries: null,
    targetRoles: null,
    problems: null,
    evidence: 'AWS Advanced, Azure Gold, GCP Partner, 200+ certifications',
    content: 'DeepMindQ holds AWS Advanced Partner, Azure Gold Partner, and GCP Partner designations. Our team maintains 200+ individual cloud certifications across architecture, security, data, and AI/ML specialties.',
    targetCompanySizes: 'Mid-Market, Enterprise',
    upvotes: 0, downvotes: 0, usedInEmails: 0, tags: '["cloud","certifications","aws","azure","gcp"]',
  },
  {
    id: 'demo-cta-1',
    title: '15-Minute Discovery Call',
    summary: 'Would you be open to a brief 15-minute call to explore how this might apply to your team?',
    category: 'cta',
    serviceLine: null,
    targetIndustries: null,
    targetRoles: null,
    problems: null,
    evidence: null,
    content: 'A low-friction call-to-action that has achieved a 34% positive response rate across industries.',
    targetCompanySizes: null,
    upvotes: 0, downvotes: 0, usedInEmails: 0, tags: null,
  },
  {
    id: 'demo-cta-2',
    title: 'Specific Use Case Discussion',
    summary: 'Could we schedule 20 minutes to walk through a specific use case relevant to [company]?',
    category: 'cta',
    serviceLine: null,
    targetIndustries: null,
    targetRoles: null,
    problems: null,
    evidence: null,
    content: 'A tailored CTA referencing a specific use case achieves 2.5x higher response rates than generic meeting requests.',
    targetCompanySizes: null,
    upvotes: 0, downvotes: 0, usedInEmails: 0, tags: null,
  },
  {
    id: 'demo-cta-3',
    title: 'Share Case Study CTA',
    summary: 'I recently put together a short case study on how we helped a [similar company] achieve [outcome]. Mind if I send it over?',
    category: 'cta',
    serviceLine: null,
    targetIndustries: null,
    targetRoles: null,
    problems: null,
    evidence: null,
    content: 'Case study CTAs achieve the highest engagement rate (41%) because they offer value before asking for anything.',
    targetCompanySizes: null,
    upvotes: 0, downvotes: 0, usedInEmails: 0, tags: null,
  },
  {
    id: 'demo-or-1',
    title: 'Budget Timing Objection',
    summary: 'We understand timing is a concern. Many of our clients start with a focused pilot — typically a 4-6 week engagement that demonstrates clear ROI before any broader commitment.',
    category: 'objection_response',
    serviceLine: null,
    targetIndustries: null,
    targetRoles: 'CFO, VP of Finance, Procurement',
    problems: 'Budget constraints, procurement cycles, uncertain ROI',
    evidence: '78% of pilot clients expand to full engagements',
    content: 'We understand timing is a concern. Many of our clients start with a focused pilot — typically a 4-6 week engagement that demonstrates clear ROI before any broader commitment. 78% of clients who start with a pilot go on to expand the engagement.',
    targetCompanySizes: 'Mid-Market, Enterprise',
    upvotes: 0, downvotes: 0, usedInEmails: 0, tags: '["budget","objection","pilot"]',
  },
  {
    id: 'demo-or-2',
    title: 'Already Have Internal Team Objection',
    summary: 'That makes sense — most of our clients have strong internal teams. We typically complement what they\'re already doing, whether that\'s providing specialized expertise, accelerating timelines, or bringing cross-industry patterns.',
    category: 'objection_response',
    serviceLine: null,
    targetIndustries: null,
    targetRoles: 'CTO, VP of Engineering, Head of IT',
    problems: 'Internal capability concerns, team overlap, budget justification',
    evidence: '65% of engagements augment existing internal teams',
    content: 'That makes sense — most of our clients have strong internal teams. We typically complement what they\'re already doing, whether that\'s providing specialized expertise, accelerating timelines, or bringing cross-industry patterns they wouldn\'t see otherwise.',
    targetCompanySizes: 'Mid-Market, Enterprise',
    upvotes: 0, downvotes: 0, usedInEmails: 0, tags: '["objection","internal-team","augmentation"]',
  },
  {
    id: 'demo-or-3',
    title: 'Need More Time Objection',
    summary: 'Absolutely understand — this isn\'t a decision that needs to be made today. Would it be helpful if I shared a 2-page brief on how we typically approach [specific problem] so you have it ready when the timing is right?',
    category: 'objection_response',
    serviceLine: null,
    targetIndustries: null,
    targetRoles: 'CEO, CIO, COO, VP of Technology',
    problems: 'Timing concerns, decision fatigue, competing priorities',
    evidence: 'Sharing relevant content maintains 68% of conversations for follow-up',
    content: 'Absolutely understand — this isn\'t a decision that needs to be made today. Would it be helpful if I shared a 2-page brief on how we typically approach [specific problem] so you have it ready when the timing is right?',
    targetCompanySizes: null,
    upvotes: 0, downvotes: 0, usedInEmails: 0, tags: null,
  },
];

/* ═══════════════════════════════════════════════════
   Search scoring helpers
   ═══════════════════════════════════════════════════ */

interface CapabilityRecord {
  id: string;
  title: string;
  summary: string;
  category: string;
  serviceLine?: string | null;
  targetIndustries?: string | null;
  targetRoles?: string | null;
  problems?: string | null;
  evidence?: string | null;
  content?: string | null;
  targetCompanySizes?: string | null;
  tags?: string | null;
  upvotes: number;
  downvotes: number;
  usedInEmails: number;
}

/** Search parameter interface */
interface KnowledgeSearchParams {
  query: string;
  industry?: string;
  role?: string;
  category?: string;
  serviceLine?: string;
  companySize?: string;
  problems?: string;
  minRelevanceScore?: number;
  limit?: number;
  includeContent?: boolean;
  searchMode?: 'keyword' | 'semantic' | 'hybrid';
  boostFields?: Record<string, number>;
  excludeCategories?: string[];
  tags?: string[]; // C-15: tag filtering
}

/** Map company size descriptions to standard labels */
function normalizeCompanySize(size?: string): string | null {
  if (!size) return null;
  const s = size.toLowerCase().trim();
  if (/startup|seed|series [ab]|1[-–]10|1[-–]50/i.test(s)) return 'Startup';
  if (/mid.?market|mid.?sized|50[-–]500|50[-–]1000/i.test(s)) return 'Mid-Market';
  if (/enterprise|large|1000\+|500\+|5000\+|fortune/i.test(s)) return 'Enterprise';
  return size;
}

/**
 * Parse tags from JSON string to string array.
 */
function parseTags(tagsStr: string | null | undefined): string[] {
  if (!tagsStr) return [];
  try {
    const parsed = JSON.parse(tagsStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return tagsStr.split(',').map(t => t.trim()).filter(Boolean);
  }
}

/**
 * Compute keyword match score between query tokens and a field.
 */
function keywordFieldScore(queryTokens: string[], fieldValue: string, weight: number): number {
  if (!fieldValue || queryTokens.length === 0) return 0;
  const fieldLower = fieldValue.toLowerCase();
  let score = 0;
  for (const token of queryTokens) {
    if (fieldLower.includes(token)) {
      score += weight;
    }
  }
  return score;
}

/**
 * Compute semantic score using TF-IDF vector index.
 * Returns 0 if index not available.
 */
function semanticFieldScore(
  queryTokens: string[],
  assetId: string,
  vectorIndex: ReturnType<typeof getVectorIndex> | null,
  queryVector: Float64Array | null,
  weight: number
): number {
  if (!vectorIndex || !queryVector || queryVector.length === 0) return 0;
  const score = vectorIndex.getScore(assetId, queryVector);
  return score * weight * 5; // Scale to match keyword scoring range
}

/** Score a single capability against the query and all parameters */
function scoreCapability(
  cap: CapabilityRecord,
  queryTokens: string[],
  params: KnowledgeSearchParams,
  vectorIndex: ReturnType<typeof getVectorIndex> | null,
  queryVector: Float64Array | null
): { score: number; matchedFields: string[] } {
  const matchedFields: string[] = [];
  let keywordScore = 0;
  let semanticScore = 0;

  // ── Base field weights (can be overridden by boostFields) ──
  const baseWeights: Record<string, number> = {
    title: 3.0,
    summary: 2.5,
    content: 2.0,
    targetIndustries: 2.0,
    targetRoles: 1.5,
    problems: 1.5,
    evidence: 1.0,
  };
  const weights = { ...baseWeights, ...(params.boostFields || {}) };

  // Searchable text fields
  const fields: Array<{ name: string; value: string | null; weight: number }> = [
    { name: 'title', value: cap.title, weight: weights.title || baseWeights.title },
    { name: 'summary', value: cap.summary, weight: weights.summary || baseWeights.summary },
    { name: 'content', value: cap.content ?? null, weight: weights.content || baseWeights.content },
    { name: 'targetIndustries', value: cap.targetIndustries ?? null, weight: weights.targetIndustries || baseWeights.targetIndustries },
    { name: 'targetRoles', value: cap.targetRoles ?? null, weight: weights.targetRoles || baseWeights.targetRoles },
    { name: 'problems', value: cap.problems ?? null, weight: weights.problems || baseWeights.problems },
    { name: 'evidence', value: cap.evidence ?? null, weight: weights.evidence || baseWeights.evidence },
  ];

  const searchMode = params.searchMode || 'keyword';

  // ── Keyword matching ──
  if (searchMode === 'keyword' || searchMode === 'hybrid') {
    for (const field of fields) {
      if (!field.value) continue;
      const fieldLower = field.value.toLowerCase();
      for (const token of queryTokens) {
        if (fieldLower.includes(token)) {
          keywordScore += field.weight;
          if (!matchedFields.includes(field.name)) {
            matchedFields.push(field.name);
          }
        }
      }
    }
  }

  // ── Semantic matching via TF-IDF vector index (C-01, C-02) ──
  if (searchMode === 'semantic' || searchMode === 'hybrid') {
    const semScore = semanticFieldScore(queryTokens, cap.id, vectorIndex, queryVector, 1.0);
    if (semScore > 0.1) {
      semanticScore += semScore;
      // Add matched fields based on semantic score threshold
      if (semScore > 0.2 && !matchedFields.includes('title')) matchedFields.push('title');
      if (semScore > 0.1 && !matchedFields.includes('summary')) matchedFields.push('summary');
    }
  }

  // ── Combine keyword and semantic scores ──
  let score: number;
  if (searchMode === 'keyword') {
    score = keywordScore;
  } else if (searchMode === 'semantic') {
    score = semanticScore;
  } else {
    // Hybrid: 50% keyword, 50% semantic
    score = (keywordScore * 0.5) + (semanticScore * 0.5);
  }

  // ── Exact phrase bonus ──
  const fullQuery = queryTokens.join(' ');
  if (fullQuery.length > 3) {
    for (const field of fields) {
      if (!field.value) continue;
      if (field.value.toLowerCase().includes(fullQuery)) {
        score += 5;
        if (!matchedFields.includes(field.name)) {
          matchedFields.push(field.name);
        }
      }
    }
  }

  // ── Problems search (specific parameter) ──
  if (params.problems) {
    const problemTokens = tokenize(params.problems);
    if (cap.problems) {
      const probFieldLower = cap.problems.toLowerCase();
      for (const token of problemTokens) {
        if (probFieldLower.includes(token)) {
          score += 3;
          if (!matchedFields.includes('problems')) {
            matchedFields.push('problems');
          }
        }
      }
    }
  }

  // ── Category weighting ──
  if (cap.category === 'service_line') score += 2;
  if (cap.category === 'case_study') score += 3;
  if (cap.category === 'proof_point') score += 1;
  if (cap.category === 'objection_response') score += 0.5;
  if (cap.category === 'cta') score += 0.5;

  // ── Industry match bonus ──
  if (params.industry && cap.targetIndustries) {
    const industryTokens = tokenize(params.industry);
    const targetsLower = cap.targetIndustries.toLowerCase();
    for (const token of industryTokens) {
      if (targetsLower.includes(token)) {
        score += 4;
        if (!matchedFields.includes('targetIndustries')) {
          matchedFields.push('targetIndustries');
        }
        break;
      }
    }
  }

  // ── Role match bonus ──
  if (params.role && cap.targetRoles) {
    const roleTokens = tokenize(params.role);
    const rolesLower = cap.targetRoles.toLowerCase();
    for (const token of roleTokens) {
      if (rolesLower.includes(token)) {
        score += 3;
        if (!matchedFields.includes('targetRoles')) {
          matchedFields.push('targetRoles');
        }
        break;
      }
    }
  }

  // ── Service line match bonus ──
  if (params.serviceLine && cap.serviceLine) {
    const slLower = params.serviceLine.toLowerCase();
    const capSlLower = cap.serviceLine.toLowerCase();
    const slTokens = tokenize(params.serviceLine);
    for (const token of slTokens) {
      if (capSlLower.includes(token)) {
        score += 3.5;
        if (!matchedFields.includes('serviceLine')) {
          matchedFields.push('serviceLine');
        }
        break;
      }
    }
  }

  // ── Company size match bonus (C-03) ──
  if (params.companySize && cap.targetCompanySizes) {
    const normalizedSize = normalizeCompanySize(params.companySize);
    if (normalizedSize && cap.targetCompanySizes.toLowerCase().includes(normalizedSize.toLowerCase())) {
      score += 2;
      if (!matchedFields.includes('targetCompanySizes')) {
        matchedFields.push('targetCompanySizes');
      }
    }
  }

  // ── Tag match bonus (C-15) ──
  if (params.tags && params.tags.length > 0 && cap.tags) {
    const assetTags = parseTags(cap.tags);
    const tagSet = new Set(assetTags.map(t => t.toLowerCase()));
    for (const searchTag of params.tags) {
      if (tagSet.has(searchTag.toLowerCase())) {
        score += 2;
        break; // Only bonus once for tag match
      }
    }
  }

  // ── Feedback factor (C-09): (upvotes - downvotes) * 0.5 ──
  const feedbackFactor = ((cap.upvotes || 0) - (cap.downvotes || 0)) * 0.5;
  score += feedbackFactor;

  // ── Used in emails bonus (C-09) ──
  if (cap.usedInEmails > 0) {
    score += Math.min(cap.usedInEmails * 0.2, 2); // Cap at +2
  }

  return { score, matchedFields };
}

/* ═══════════════════════════════════════════════════
   POST /api/knowledge/search

   Parameters:
   - query (required): Search query string
   - industry (optional): Target industry for bonus matching
   - role (optional): Target role for bonus matching
   - category (optional): Filter to specific category
   - serviceLine (optional): Filter/boost by service line
   - companySize (optional): Target company size (Startup/Mid-Market/Enterprise)
   - problems (optional): Problem statement to match against problems field
   - minRelevanceScore (optional): Minimum score (0-100) to include in results
   - limit (optional): Max results (default 8)
   - includeContent (optional): Include full content field in results
   - searchMode (optional): 'keyword' | 'semantic' | 'hybrid' (default 'keyword')
   - boostFields (optional): Object mapping field names to weight multipliers
   - excludeCategories (optional): Array of categories to exclude from results
   - tags (optional): Array of tag strings to filter/match (C-15)
   ═══════════════════════════════════════════════════ */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const params: KnowledgeSearchParams = {
      query: body.query,
      industry: body.industry || undefined,
      role: body.role || undefined,
      category: body.category || undefined,
      serviceLine: body.serviceLine || undefined,
      companySize: body.companySize || undefined,
      problems: body.problems || undefined,
      minRelevanceScore: body.minRelevanceScore ?? undefined,
      limit: body.limit || 8,
      includeContent: body.includeContent ?? false,
      searchMode: body.searchMode || 'keyword',
      boostFields: body.boostFields || undefined,
      excludeCategories: body.excludeCategories || undefined,
      tags: body.tags || undefined,
    };

    if (!params.query || typeof params.query !== 'string' || !params.query.trim()) {
      return NextResponse.json(
        { error: 'query is required and must be a non-empty string', requiredParams: ['query'], optionalParams: ['industry', 'role', 'category', 'serviceLine', 'companySize', 'problems', 'minRelevanceScore', 'limit', 'includeContent', 'searchMode', 'boostFields', 'excludeCategories', 'tags'] },
        { status: 400 }
      );
    }

    // ── Load capabilities from DB, fall back to demo data ──
    let capabilities: CapabilityRecord[] = [];
    let usedDB = false;

    try {
      const dbCaps = await db.capabilityAsset.findMany({
        where: { isActive: true },
      });
      if (dbCaps.length > 0) {
        capabilities = dbCaps.map(c => ({
          id: c.id,
          title: c.title,
          summary: c.summary,
          category: c.category,
          serviceLine: c.serviceLine,
          targetIndustries: c.targetIndustries,
          targetRoles: c.targetRoles,
          problems: c.problems,
          evidence: c.evidence,
          content: c.content,
          targetCompanySizes: c.targetCompanySizes,
          tags: c.tags,
          upvotes: c.upvotes || 0,
          downvotes: c.downvotes || 0,
          usedInEmails: c.usedInEmails || 0,
        }));
        usedDB = true;
      } else {
        capabilities = DEMO_CAPABILITIES as CapabilityRecord[];
      }
    } catch {
      capabilities = DEMO_CAPABILITIES as CapabilityRecord[];
    }

    const queryTokens = tokenize(params.query);

    // ── Build/rebuild vector index if using semantic or hybrid mode (C-01, C-02) ──
    let vectorIndex: ReturnType<typeof getVectorIndex> | null = null;
    let queryVector: Float64Array | null = null;

    if (params.searchMode === 'semantic' || params.searchMode === 'hybrid') {
      vectorIndex = getVectorIndex();
      if (!vectorIndex.isReady() && usedDB) {
        // Auto-build on first semantic/hybrid search
        vectorIndex.build(capabilities);
      }
      if (vectorIndex.isReady()) {
        queryVector = vectorIndex.queryToVector(params.query);
      }
    }

    // ── Score, filter, and sort ──
    const scored = capabilities
      .map(cap => {
        const { score, matchedFields } = scoreCapability(cap, queryTokens, params, vectorIndex, queryVector);
        return { ...cap, relevanceScore: score, matchedFields };
      })
      .filter(item => item.relevanceScore > 0);

    // Sort by relevance descending
    scored.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // ── Apply category filter ──
    let filtered = params.category
      ? scored.filter(item => item.category === params.category)
      : scored;

    // ── Exclude categories ──
    if (params.excludeCategories && params.excludeCategories.length > 0) {
      const excludeSet = new Set(params.excludeCategories);
      filtered = filtered.filter(item => !excludeSet.has(item.category));
    }

    // ── Apply service line filter ──
    if (params.serviceLine) {
      const slTokens = tokenize(params.serviceLine);
      filtered = filtered.filter(item => {
        if (!item.serviceLine) return true;
        const slLower = item.serviceLine.toLowerCase();
        return slTokens.some(t => slLower.includes(t));
      });
    }

    // ── Apply tag filter (C-15): only include assets that have ANY of the specified tags ──
    if (params.tags && params.tags.length > 0) {
      const tagSet = new Set(params.tags.map(t => t.toLowerCase()));
      filtered = filtered.filter(item => {
        if (!item.tags) return false;
        const assetTags = parseTags(item.tags);
        return assetTags.some(t => tagSet.has(t.toLowerCase()));
      });
    }

    // ── Normalize scores to 0-100 ──
    const maxScore = filtered.length > 0 ? filtered[0].relevanceScore : 1;
    let results = filtered.map(item => {
      const result: Record<string, unknown> = {
        id: item.id,
        title: item.title,
        summary: item.summary,
        category: item.category,
        relevanceScore: Math.round((item.relevanceScore / maxScore) * 100),
        matchedFields: item.matchedFields,
        upvotes: item.upvotes || 0,
        downvotes: item.downvotes || 0,
        usedInEmails: item.usedInEmails || 0,
      };
      if (item.serviceLine) result.serviceLine = item.serviceLine;
      if (item.targetIndustries) result.targetIndustries = item.targetIndustries;
      if (item.tags) {
        const parsed = parseTags(item.tags);
        if (parsed.length > 0) result.tags = parsed;
      }
      if (params.includeContent && item.content) result.content = item.content;
      return result;
    });

    // ── Apply minimum relevance score threshold ──
    if (params.minRelevanceScore !== undefined && params.minRelevanceScore > 0) {
      results = results.filter(
        (r: Record<string, unknown>) => (r.relevanceScore as number) >= params.minRelevanceScore!
      );
    }

    // ── Apply limit ──
    results = results.slice(0, params.limit);

    return NextResponse.json({
      results,
      query: params.query.trim(),
      searchMode: params.searchMode,
      vectorIndexReady: vectorIndex?.isReady() || false,
      appliedFilters: {
        ...(params.industry ? { industry: params.industry } : {}),
        ...(params.role ? { role: params.role } : {}),
        ...(params.category ? { category: params.category } : {}),
        ...(params.serviceLine ? { serviceLine: params.serviceLine } : {}),
        ...(params.companySize ? { companySize: params.companySize } : {}),
        ...(params.problems ? { problems: params.problems } : {}),
        ...(params.minRelevanceScore ? { minRelevanceScore: params.minRelevanceScore } : {}),
        ...(params.excludeCategories ? { excludeCategories: params.excludeCategories } : {}),
        ...(params.tags ? { tags: params.tags } : {}),
      },
      totalMatches: filtered.length,
      totalBeforeFilters: scored.length,
    });
  } catch (error) {
    console.error('Knowledge search error:', error);
    return NextResponse.json(
      { error: 'Failed to search knowledge base' },
      { status: 500 }
    );
  }
}

/* ═══════════════════════════════════════════════════
   GET /api/knowledge/search
   Returns parameter documentation for the knowledge engine.
   ═══════════════════════════════════════════════════ */
export async function GET() {
  return NextResponse.json({
    engine: 'DeepMindQ Knowledge Retrieval Engine v3.0',
    description: 'Retrieves relevant capabilities, case studies, proof points, objection responses, and CTAs based on TF-IDF semantic and keyword matching.',
    endpoint: 'POST /api/knowledge/search',
    parameters: {
      query: { type: 'string', required: true, description: 'Search query — keywords, phrases, or natural language' },
      industry: { type: 'string', required: false, description: 'Target industry for relevance boosting (e.g. "Financial Services", "Healthcare")' },
      role: { type: 'string', required: false, description: 'Target role for relevance boosting (e.g. "CTO", "VP of Engineering", "Head of AI")' },
      category: { type: 'string', required: false, description: 'Filter results to a specific category: service_line, case_study, proof_point, objection_response, cta' },
      serviceLine: { type: 'string', required: false, description: 'Filter/boost by service line (e.g. "AI & Machine Learning", "Cloud Engineering")' },
      companySize: { type: 'string', required: false, description: 'Target company size for relevance boosting: Startup, Mid-Market, Enterprise' },
      problems: { type: 'string', required: false, description: 'Problem statement to search against the problems field of capabilities' },
      minRelevanceScore: { type: 'number', required: false, description: 'Minimum relevance score (0-100) threshold. Results below this are excluded.' },
      limit: { type: 'number', required: false, default: 8, description: 'Maximum number of results to return' },
      includeContent: { type: 'boolean', required: false, default: false, description: 'Include full content field in results (for AI prompt building)' },
      searchMode: { type: 'string', required: false, default: 'keyword', enum: ['keyword', 'semantic', 'hybrid'], description: 'Search strategy: keyword (exact token matching), semantic (TF-IDF cosine similarity), hybrid (50% keyword + 50% semantic)' },
      boostFields: { type: 'object', required: false, description: 'Custom field weight multipliers. Keys: title, summary, content, targetIndustries, targetRoles, problems, evidence. Values: numeric multipliers.' },
      excludeCategories: { type: 'array', required: false, description: 'Array of category names to exclude from results' },
      tags: { type: 'array', required: false, description: 'Array of tag strings. Results must have at least one matching tag.' },
    },
  });
}