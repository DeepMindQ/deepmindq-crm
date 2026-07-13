import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

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
    content: 'End-to-end ML pipeline development, model training, MLOps, and intelligent automation solutions. We help enterprises build production-grade AI systems that drive measurable business outcomes.',
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
    content: 'Multi-cloud architecture design, migration strategy, and cloud-native application development on AWS, Azure, and GCP. Specializing in complex enterprise migrations with zero downtime.',
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
    content: 'Enterprise data platform design, real-time analytics, data governance, and warehouse modernization. Transforming how organizations collect, process, and derive value from their data.',
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
    content: 'Legacy system modernization, process automation, and technology strategy consulting. Helping enterprises navigate digital disruption with pragmatic, outcome-focused approaches.',
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
}

/** Extract meaningful tokens from a query string */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s&+]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1);
}

/** Score a single capability against the query tokens */
function scoreCapability(
  cap: CapabilityRecord,
  queryTokens: string[],
  industry?: string,
  role?: string
): { score: number; matchedFields: string[] } {
  const matchedFields: string[] = [];
  let score = 0;

  // Searchable text fields with weights
  const fields: Array<{ name: string; value: string | null; weight: number }> = [
    { name: 'title', value: cap.title, weight: 3.0 },
    { name: 'summary', value: cap.summary, weight: 2.5 },
    { name: 'content', value: cap.content ?? null, weight: 2.0 },
    { name: 'targetIndustries', value: cap.targetIndustries ?? null, weight: 2.0 },
    { name: 'targetRoles', value: cap.targetRoles ?? null, weight: 1.5 },
    { name: 'problems', value: cap.problems ?? null, weight: 1.5 },
    { name: 'evidence', value: cap.evidence ?? null, weight: 1.0 },
  ];

  // Keyword matching
  for (const field of fields) {
    if (!field.value) continue;
    const fieldLower = field.value.toLowerCase();
    for (const token of queryTokens) {
      if (fieldLower.includes(token)) {
        score += field.weight;
        if (!matchedFields.includes(field.name)) {
          matchedFields.push(field.name);
        }
      }
    }
  }

  // Exact phrase bonus — if the full query appears as a substring
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

  // Category bonus — service_line and case_study are higher value
  if (cap.category === 'service_line') score += 2;
  if (cap.category === 'case_study') score += 3;
  if (cap.category === 'proof_point') score += 1;
  // objection_response and cta get small bonuses
  if (cap.category === 'objection_response') score += 0.5;
  if (cap.category === 'cta') score += 0.5;

  // Industry match bonus
  if (industry && cap.targetIndustries) {
    const industryLower = industry.toLowerCase();
    const targetsLower = cap.targetIndustries.toLowerCase();
    const industryTokens = tokenize(industry);
    for (const token of industryTokens) {
      if (targetsLower.includes(token)) {
        score += 4;
        if (!matchedFields.includes('targetIndustries')) {
          matchedFields.push('targetIndustries');
        }
        break; // Only bonus once per field
      }
    }
  }

  // Role match bonus
  if (role && cap.targetRoles) {
    const roleLower = role.toLowerCase();
    const rolesLower = cap.targetRoles.toLowerCase();
    const roleTokens = tokenize(role);
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

  return { score, matchedFields };
}

/* ═══════════════════════════════════════════════════
   POST /api/knowledge/search
   ═══════════════════════════════════════════════════ */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { query, industry, role, category, limit = 5 } = body;

    if (!query || typeof query !== 'string' || !query.trim()) {
      return NextResponse.json(
        { error: 'query is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    // Load capabilities from DB, fall back to demo data
    let capabilities: CapabilityRecord[] = [];

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
        }));
      } else {
        capabilities = DEMO_CAPABILITIES;
      }
    } catch {
      capabilities = DEMO_CAPABILITIES;
    }

    const queryTokens = tokenize(query);

    // Score and sort
    const scored = capabilities
      .map(cap => {
        const { score, matchedFields } = scoreCapability(cap, queryTokens, industry, role);
        return { ...cap, relevanceScore: score, matchedFields };
      })
      .filter(item => item.relevanceScore > 0);

    // Sort by relevance descending
    scored.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Apply category filter if provided
    const filtered = category
      ? scored.filter(item => item.category === category)
      : scored;

    // Normalize scores to 0-100
    const maxScore = filtered.length > 0 ? filtered[0].relevanceScore : 1;
    const results = filtered.slice(0, limit).map(item => ({
      id: item.id,
      title: item.title,
      summary: item.summary,
      category: item.category,
      relevanceScore: Math.round((item.relevanceScore / maxScore) * 100),
      matchedFields: item.matchedFields,
      serviceLine: item.serviceLine || undefined,
      targetIndustries: item.targetIndustries || undefined,
      content: item.content || undefined,
    }));

    return NextResponse.json({
      results,
      query: query.trim(),
      totalMatches: filtered.length,
    });
  } catch (error) {
    console.error('Knowledge search error:', error);
    return NextResponse.json(
      { error: 'Failed to search knowledge base' },
      { status: 500 }
    );
  }
}