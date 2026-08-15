import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

// ═══════════════════════════════════════════════════════════════════════════
// DeepMindQ — Database Seed Script
//
// Populates the SQLite database with realistic demo data so the app
// has real content on first load. All data is fictional but plausible.
// ═══════════════════════════════════════════════════════════════════════════

const _INDUSTRIES = [
  'Artificial Intelligence',
  'Cloud Infrastructure',
  'Cybersecurity',
  'FinTech',
  'HealthTech',
  'EdTech',
  'DevTools',
  'E-Commerce',
  'SaaS',
  'MarTech',
  'IoT',
  'Biotech',
];

const SIGNAL_TYPES = [
  'funding_event',
  'hiring_change',
  'leadership_change',
  'technology_change',
  'market_expansion',
  'partnership',
  'competitor_move',
  'financial_indicator',
  'product_launch',
  'regulatory',
  'customer_signal',
  'social_mention',
];

const SEVERITIES: ('critical' | 'high' | 'medium' | 'low')[] = [
  'critical',
  'high',
  'medium',
  'low',
];
const STATUSES: ('detected' | 'validated' | 'analyzed' | 'acted_upon' | 'expired' | 'dismissed')[] =
  ['detected', 'validated', 'analyzed', 'acted_upon', 'expired', 'dismissed'];

const PERSON_ROLES: ('executive' | 'vice_president' | 'director' | 'manager' | 'individual')[] = [
  'executive',
  'vice_president',
  'director',
  'manager',
  'individual',
];

const DEPARTMENTS = [
  'Engineering',
  'Sales',
  'Marketing',
  'Product',
  'Finance',
  'Operations',
  'HR',
  'Customer Success',
];
const SENIORITIES = ['Senior', 'Mid', 'Junior'];

const COMPANIES = [
  {
    name: 'Anthropic AI',
    domain: 'anthropic.com',
    industry: 'Artificial Intelligence',
    hq: 'San Francisco, CA',
    employees: 850,
    revenue: '$500M-$1B',
    founded: 2021,
  },
  {
    name: 'Databricks',
    domain: 'databricks.com',
    industry: 'Cloud Infrastructure',
    hq: 'San Francisco, CA',
    employees: 7000,
    revenue: '$1B-$2B',
    founded: 2013,
  },
  {
    name: 'Cohere',
    domain: 'cohere.com',
    industry: 'Artificial Intelligence',
    hq: 'Toronto, Canada',
    employees: 400,
    revenue: '$100M-$200M',
    founded: 2019,
  },
  {
    name: 'Linear',
    domain: 'linear.app',
    industry: 'DevTools',
    hq: 'San Francisco, CA',
    employees: 120,
    revenue: '$20M-$50M',
    founded: 2020,
  },
  {
    name: 'Clerk',
    domain: 'clerk.dev',
    industry: 'DevTools',
    hq: 'San Francisco, CA',
    employees: 80,
    revenue: '$10M-$20M',
    founded: 2021,
  },
  {
    name: 'Stripe',
    domain: 'stripe.com',
    industry: 'FinTech',
    hq: 'South San Francisco, CA',
    employees: 8000,
    revenue: '$5B+',
    founded: 2010,
  },
  {
    name: 'Cal.com',
    domain: 'cal.com',
    industry: 'SaaS',
    hq: 'San Francisco, CA',
    employees: 60,
    revenue: '$5M-$10M',
    founded: 2021,
  },
  {
    name: 'Vercel',
    domain: 'vercel.com',
    industry: 'Cloud Infrastructure',
    hq: 'San Francisco, CA',
    employees: 350,
    revenue: '$100M-$200M',
    founded: 2020,
  },
  {
    name: 'Supabase',
    domain: 'supabase.com',
    industry: 'Cloud Infrastructure',
    hq: 'San Francisco, CA',
    employees: 200,
    revenue: '$20M-$50M',
    founded: 2020,
  },
  {
    name: 'Figma',
    domain: 'figma.com',
    industry: 'SaaS',
    hq: 'San Francisco, CA',
    employees: 1500,
    revenue: '$500M-$1B',
    founded: 2012,
  },
  {
    name: 'Notion',
    domain: 'notion.so',
    industry: 'SaaS',
    hq: 'San Francisco, CA',
    employees: 800,
    revenue: '$200M-$500M',
    founded: 2016,
  },
  {
    name: 'Wiz',
    domain: 'wiz.io',
    industry: 'Cybersecurity',
    hq: 'New York, NY',
    employees: 1800,
    revenue: '$500M-$1B',
    founded: 2020,
  },
  {
    name: 'Ramp',
    domain: 'ramp.com',
    industry: 'FinTech',
    hq: 'New York, NY',
    employees: 1500,
    revenue: '$300M-$500M',
    founded: 2019,
  },
  {
    name: 'Hugging Face',
    domain: 'huggingface.co',
    industry: 'Artificial Intelligence',
    hq: 'New York, NY',
    employees: 250,
    revenue: '$50M-$100M',
    founded: 2016,
  },
  {
    name: 'Pinecone',
    domain: 'pinecone.io',
    industry: 'Artificial Intelligence',
    hq: 'New York, NY',
    employees: 200,
    revenue: '$30M-$50M',
    founded: 2019,
  },
  {
    name: 'PostHog',
    domain: 'posthog.com',
    industry: 'MarTech',
    hq: 'San Francisco, CA',
    employees: 100,
    revenue: '$10M-$20M',
    founded: 2020,
  },
  {
    name: 'Resend',
    domain: 'resend.com',
    industry: 'DevTools',
    hq: 'San Francisco, CA',
    employees: 40,
    revenue: '$5M-$10M',
    founded: 2022,
  },
  {
    name: 'Planetscale',
    domain: 'planetscale.com',
    industry: 'Cloud Infrastructure',
    hq: 'Austin, TX',
    employees: 150,
    revenue: '$20M-$50M',
    founded: 2018,
  },
  {
    name: 'Loom',
    domain: 'loom.com',
    industry: 'SaaS',
    hq: 'San Francisco, CA',
    employees: 600,
    revenue: '$100M-$200M',
    founded: 2016,
  },
  {
    name: 'HashiCorp',
    domain: 'hashicorp.com',
    industry: 'Cloud Infrastructure',
    hq: 'San Francisco, CA',
    employees: 2500,
    revenue: '$500M-$1B',
    founded: 2012,
  },
  {
    name: 'Replicate',
    domain: 'replicate.com',
    industry: 'Artificial Intelligence',
    hq: 'San Francisco, CA',
    employees: 60,
    revenue: '$10M-$20M',
    founded: 2019,
  },
  {
    name: 'Neon',
    domain: 'neon.tech',
    industry: 'Cloud Infrastructure',
    hq: 'San Francisco, CA',
    employees: 100,
    revenue: '$10M-$20M',
    founded: 2021,
  },
  {
    name: 'Merge',
    domain: 'merge.dev',
    industry: 'DevTools',
    hq: 'San Francisco, CA',
    employees: 120,
    revenue: '$20M-$50M',
    founded: 2020,
  },
  {
    name: 'Astronomer',
    domain: 'astronomer.io',
    industry: 'Cloud Infrastructure',
    hq: 'Cincinnati, OH',
    employees: 400,
    revenue: '$50M-$100M',
    founded: 2018,
  },
  {
    name: 'Lacework',
    domain: 'lacework.net',
    industry: 'Cybersecurity',
    hq: 'San Jose, CA',
    employees: 1000,
    revenue: '$200M-$500M',
    founded: 2016,
  },
  {
    name: 'Mistral AI',
    domain: 'mistral.ai',
    industry: 'Artificial Intelligence',
    hq: 'Paris, France',
    employees: 150,
    revenue: '$50M-$100M',
    founded: 2023,
  },
  {
    name: 'Oxide Computer',
    domain: 'oxide.computer',
    industry: 'Cloud Infrastructure',
    hq: 'Emeryville, CA',
    employees: 80,
    revenue: '$10M-$20M',
    founded: 2020,
  },
  {
    name: 'Temporal',
    domain: 'temporal.io',
    industry: 'DevTools',
    hq: 'Seattle, WA',
    employees: 200,
    revenue: '$30M-$50M',
    founded: 2019,
  },
  {
    name: 'TaxJar',
    domain: 'taxjar.com',
    industry: 'FinTech',
    hq: 'Chicago, IL',
    employees: 300,
    revenue: '$50M-$100M',
    founded: 2013,
  },
  {
    name: 'Fly.io',
    domain: 'fly.io',
    industry: 'Cloud Infrastructure',
    hq: 'Chicago, IL',
    employees: 100,
    revenue: '$10M-$20M',
    founded: 2017,
  },
];

const SIGNAL_TEMPLATES: Record<string, { title: string; desc: string }[]> = {
  funding_event: [
    {
      title: 'Series C Funding Round',
      desc: 'Raised $150M in Series C funding led by Sequoia Capital with participation from a16z and Accel. Valued at $2.5B post-money.',
    },
    {
      title: 'Series B Extension',
      desc: 'Closed $80M extension to Series B at $1.2B valuation. New investors include Tiger Global.',
    },
    {
      title: 'Seed Round Completed',
      desc: 'Secured $12M seed funding from Y Combinator and angel investors. Focus on expanding AI capabilities.',
    },
    {
      title: 'Strategic Investment',
      desc: 'Received $25M strategic investment from Google Ventures. Partnership opportunities in AI integration.',
    },
  ],
  hiring_change: [
    {
      title: 'Rapid Engineering Hiring Spree',
      desc: 'Posted 45 new engineering positions in the last 30 days, a 180% increase from the previous quarter.',
    },
    {
      title: 'Sales Team Expansion',
      desc: 'Hired 12 new enterprise account executives in APAC region, signaling international expansion plans.',
    },
    {
      title: 'Key Leadership Hire',
      desc: 'Recruited former VP of Engineering from Meta to lead infrastructure team.',
    },
    {
      title: 'AI/ML Hiring Surge',
      desc: 'Listed 30 machine learning positions across seniority levels. Building dedicated AI research lab.',
    },
  ],
  leadership_change: [
    {
      title: 'New CEO Appointed',
      desc: 'Board appointed new CEO from within. Previous CEO transitions to CTO role. Strategic pivot expected.',
    },
    {
      title: 'CRO Departure',
      desc: 'Chief Revenue Officer departed after 3 years. No replacement announced yet. Potential sales reorganization.',
    },
    {
      title: 'CFO Change',
      desc: 'New CFO joined from a public company. Suggests potential IPO preparation.',
    },
    {
      title: 'CTO Transition',
      desc: 'Long-time CTO stepping down. Technical leadership vacuum may create opportunity for competing solutions.',
    },
  ],
  technology_change: [
    {
      title: 'Migration to New Tech Stack',
      desc: 'Evidence of migrating from microservices architecture to event-driven platform. Could indicate integration difficulties.',
    },
    {
      title: 'Adopted Kubernetes',
      desc: 'Container orchestration deployment detected. Infrastructure maturity increasing — may reduce vendor lock-in.',
    },
    {
      title: 'Open Source Tool Adoption',
      desc: 'Switched from proprietary solution to open-source alternative. Cost optimization signal.',
    },
    {
      title: 'AI Infrastructure Buildout',
      desc: 'Significant GPU compute procurement detected. Building internal AI/ML training infrastructure.',
    },
  ],
  market_expansion: [
    {
      title: 'EU Market Entry',
      desc: 'Registered EU subsidiary and GDPR-compliant data center. Targeting European enterprise customers.',
    },
    {
      title: 'APAC Expansion',
      desc: 'Opened Tokyo and Singapore offices. Hired regional sales directors for APAC market.',
    },
    {
      title: 'Vertical Market Pivot',
      desc: 'Shifted positioning from horizontal platform to healthcare vertical. New landing pages and case studies detected.',
    },
  ],
  partnership: [
    {
      title: 'Strategic Partnership Announced',
      desc: 'Partnership with major cloud provider. Integration listed on their marketplace. Co-marketing expected.',
    },
    {
      title: 'Technology Alliance',
      desc: 'Formed technology alliance with enterprise software company. Joint solution in development.',
    },
    {
      title: 'Channel Partner Program',
      desc: 'Launched channel partner program with 15 initial partners. Revenue share model suggests aggressive growth strategy.',
    },
  ],
  competitor_move: [
    {
      title: 'Competitor Product Launch',
      desc: 'Major competitor launched competing feature directly targeting our differentiation. Pricing 30% lower.',
    },
    {
      title: 'Market Share Shift',
      desc: 'Industry report shows competitor gaining 15% market share in our core segment. Customer churn risk increasing.',
    },
    {
      title: 'Competitor Acquisition',
      desc: 'Competitor acquired by larger platform. Combined entity now has significantly more resources.',
    },
  ],
  financial_indicator: [
    {
      title: 'Revenue Growth Acceleration',
      desc: 'Q4 revenue exceeded projections by 35%. Annual recurring revenue crossed $100M threshold.',
    },
    {
      title: 'Cost Optimization Detected',
      desc: 'Reduced SaaS tool subscriptions by 40%. Consolidating vendors — potential buying window.',
    },
    {
      title: 'Budget Increase Signal',
      desc: 'Engineering budget allocation increased 50% YoY. Technology investment priority confirmed.',
    },
  ],
  product_launch: [
    {
      title: 'Major Product Release',
      desc: 'Launched v3.0 with completely redesigned UI and AI-powered features. Positive early reviews.',
    },
    {
      title: 'Beta Program Launch',
      desc: 'Opened beta for new enterprise tier. Feature set targets our core capabilities.',
    },
    {
      title: 'API V2 Release',
      desc: 'Released major API update with new endpoints for automation. Developer community growing rapidly.',
    },
  ],
  regulatory: [
    {
      title: 'Compliance Certification',
      desc: 'Obtained SOC 2 Type II certification. Enterprise sales barrier removed for regulated industries.',
    },
    {
      title: 'GDPR Investigation',
      desc: 'Subject to GDPR investigation in EU. May create trust concerns among European customers.',
    },
    {
      title: 'Industry Regulation Change',
      desc: 'New regulation in their industry may increase demand for compliance-related features.',
    },
  ],
  customer_signal: [
    {
      title: 'High-Profile Customer Churn',
      desc: 'Lost anchor customer (Fortune 500). Renewal failure suggests product-market fit issues in enterprise segment.',
    },
    {
      title: 'Customer Expansion',
      desc: 'Existing customer expanded contract by 3x. Strong upsell signal — product is proving value.',
    },
    {
      title: 'Review Pattern Shift',
      desc: 'G2 reviews declining from 4.5 to 3.8 average. Common complaints about reliability and support.',
    },
  ],
  social_mention: [
    {
      title: 'Viral Product Demo',
      desc: 'Product demo went viral on X/Twitter. 50K+ views. Increased inbound interest expected.',
    },
    {
      title: 'Negative Press Coverage',
      desc: 'Major tech publication published critical review. Leadership responded publicly.',
    },
    {
      title: 'Conference Keynote',
      desc: 'CEO delivering keynote at major industry conference. New product announcement expected.',
    },
  ],
};

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function _randomItems<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function randomFloat(min: number, max: number): number {
  return Math.round((min + Math.random() * (max - min)) * 10) / 10;
}

async function seed() {
  console.info('🌱 Seeding database...\n');

  // Clean existing data
  await db.relationship.deleteMany();
  await db.evidence.deleteMany();
  await db.insight.deleteMany();
  await db.signal.deleteMany();
  await db.briefing.deleteMany();
  await db.promptTemplate.deleteMany();
  await db.dataIngestionRow.deleteMany();
  await db.dataIngestion.deleteMany();
  await db.aIUsageLog.deleteMany();
  await db.person.deleteMany();
  await db.organization.deleteMany();
  await db.session.deleteMany();
  await db.auditLog.deleteMany();
  await db.user.deleteMany();

  // Create admin user
  const admin = await db.user.create({
    data: {
      email: 'admin@deepmindq.com',
      name: 'DeepMindQ Admin',
      role: 'admin',
      passwordHash: 'hashed_password_placeholder',
    },
  });
  console.info(`✅ Created admin user: ${admin.email}`);

  // Create organizations
  const organizations = [];
  for (const company of COMPANIES) {
    const org = await db.organization.create({
      data: {
        name: company.name,
        domain: company.domain,
        aliases: JSON.stringify([company.name.toLowerCase()]),
        industry: company.industry,
        description: `${company.name} is a ${company.industry} company headquartered in ${company.hq}.`,
        website: `https://${company.domain}`,
        headquarters: company.hq,
        employeeCount: company.employees,
        revenue: company.revenue,
        foundedYear: company.founded,
        trackingStatus:
          Math.random() > 0.15 ? 'active' : Math.random() > 0.5 ? 'paused' : 'archived',
        intelligenceScore: randomFloat(30, 95),
        lastSignalAt: randomDate(new Date(Date.now() - 30 * 86400000), new Date()),
        lastEnrichedAt: randomDate(new Date(Date.now() - 7 * 86400000), new Date()),
        source: randomItem([
          'manual',
          'crm',
          'upload',
          'external',
          'ai_inferred',
          'signal_detected',
        ] as const),
        firstSeenAt: randomDate(new Date('2023-01-01'), new Date('2025-01-01')),
      },
    });
    organizations.push(org);
  }
  console.info(`✅ Created ${organizations.length} organizations`);

  // Create people
  const people = [];
  const firstNames = [
    'Sarah',
    'Mike',
    'Jessica',
    'David',
    'Emily',
    'James',
    'Amanda',
    'Chris',
    'Rachel',
    'Alex',
    'Priya',
    'Wei',
    'Carlos',
    'Fatima',
    'Olga',
  ];
  const lastNames = [
    'Chen',
    'Johnson',
    'Williams',
    'Patel',
    'Kim',
    'Mueller',
    'Singh',
    'Garcia',
    'Nakamura',
    'Anderson',
    'Lee',
    'Thompson',
    'Martinez',
    'Brown',
    'Taylor',
  ];
  const titles = [
    'CEO',
    'CTO',
    'CRO',
    'VP Engineering',
    'VP Product',
    'VP Sales',
    'VP Marketing',
    'Director of Engineering',
    'Head of AI',
    'Head of Product',
    'Head of Sales',
    'Senior Engineer',
    'Product Manager',
    'Solutions Architect',
    'Customer Success Lead',
  ];

  for (const org of organizations) {
    const personCount = 2 + Math.floor(Math.random() * 4); // 2-5 people per org
    for (let i = 0; i < personCount; i++) {
      const firstName = randomItem(firstNames);
      const lastName = randomItem(lastNames);
      const person = await db.person.create({
        data: {
          fullName: `${firstName} ${lastName}`,
          email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${org.domain || 'example.com'}`,
          title: randomItem(titles),
          role: randomItem(PERSON_ROLES),
          department: randomItem(DEPARTMENTS),
          seniority: randomItem(SENIORITIES),
          notes: '',
          organizationId: org.id,
          source: randomItem(['manual', 'crm', 'upload', 'signal_detected'] as const),
        },
      });
      people.push(person);
    }
  }
  console.info(`✅ Created ${people.length} people`);

  // Create signals
  const signals = [];
  for (const org of organizations) {
    const signalCount = 3 + Math.floor(Math.random() * 8); // 3-10 signals per org
    for (let i = 0; i < signalCount; i++) {
      const signalType = randomItem(SIGNAL_TYPES);
      const templates = SIGNAL_TEMPLATES[signalType] || SIGNAL_TEMPLATES.social_mention;
      const template = randomItem(templates);
      const status = randomItem(STATUSES);
      const signal = await db.signal.create({
        data: {
          organizationId: org.id,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          signalType: signalType as any,
          severity: randomItem(SEVERITIES),
          status,
          title: template.title,
          description: template.desc,
          confidenceScore: randomFloat(20, 95),
          impactScore: randomFloat(10, 90),
          detectedAt: randomDate(new Date(Date.now() - 60 * 86400000), new Date()),
          eventDate: randomDate(new Date(Date.now() - 90 * 86400000), new Date()),
          expiresAt: randomDate(new Date(), new Date(Date.now() + 60 * 86400000)),
          source: randomItem(['signal_detected', 'ai_inferred', 'external', 'crm'] as const),
          sourceLabel: randomItem([
            'LinkedIn',
            'Crunchbase',
            'TechCrunch',
            'G2',
            'BuiltWith',
            'Job Board',
            'Press Release',
            'SEC Filing',
          ]),
          analyzedAt:
            status === 'analyzed' || status === 'acted_upon'
              ? randomDate(new Date(Date.now() - 30 * 86400000), new Date())
              : null,
        },
      });
      signals.push(signal);
    }
  }
  console.info(`✅ Created ${signals.length} signals`);

  // Create evidence
  const evidence = [];
  const evidenceTypes = [
    'news_article',
    'press_release',
    'job_posting',
    'filing',
    'social',
    'blog_post',
    'product_page',
    'review',
  ];
  const sources = [
    'TechCrunch',
    'VentureBeat',
    'The Information',
    'LinkedIn',
    'Crunchbase',
    'SEC EDGAR',
    'Product Hunt',
    'G2',
    'BuiltWith',
    'Glassdoor',
  ];

  for (const signal of signals.slice(0, 150)) {
    // Create evidence for ~150 signals
    const evCount = 1 + Math.floor(Math.random() * 3); // 1-3 evidence items per signal
    for (let i = 0; i < evCount; i++) {
      const ev = await db.evidence.create({
        data: {
          signalId: signal.id,
          organizationId: signal.organizationId,
          claim: `Supporting evidence for: ${signal.title}`,
          sourceType: randomItem(evidenceTypes),
          sourceUrl: `https://example.com/article/${Date.now() + Math.random()}`,
          sourceTitle: `${signal.title} — ${randomItem(sources)}`,
          sourceDate: randomDate(new Date(Date.now() - 90 * 86400000), new Date()),
          excerpt: `Detailed evidence corroborating the ${signal.signalType} signal detected for this organization.`,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          reliability: randomItem(['verified', 'likely', 'inferred', 'unverified'] as any),
        },
      });
      evidence.push(ev);
    }
  }
  console.info(`✅ Created ${evidence.length} evidence items`);

  // Create insights
  const categories = ['opportunity', 'risk', 'recommendation', 'pattern'];
  const confidences: ('very_high' | 'high' | 'medium' | 'low' | 'very_low')[] = [
    'very_high',
    'high',
    'medium',
    'low',
    'very_low',
  ];
  const reasoningMethods = ['llm', 'rule', 'hybrid', 'template'];

  for (const org of organizations.slice(0, 20)) {
    // Create insights for top 20 orgs
    const insightCount = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < insightCount; i++) {
      const orgSignals = signals.filter((s) => s.organizationId === org.id);
      const relatedSignal = orgSignals.length > 0 ? randomItem(orgSignals) : null;
      await db.insight.create({
        data: {
          organizationId: org.id,
          signalId: relatedSignal?.id,
          category: randomItem(categories),
          title: `${randomItem(['Strategic', 'Competitive', 'Market', 'Technology'])} ${randomItem(['Opportunity', 'Risk', 'Pattern', 'Insight'])}: ${org.name}`,
          narrative: `Based on ${orgSignals.length} signals analyzed, ${org.name} shows strong indicators of ${randomItem(['expansion', 'investment', 'hiring', 'innovation'])}. The ${randomItem(['funding', 'hiring', 'technology', 'market'])} signals suggest a ${randomItem(['growth', 'pivot', 'maturity', 'disruption'])} phase that presents ${randomItem(['entry', 'expansion', 'competitive'])} opportunities.`,
          recommendation: `Consider ${randomItem(['initiating outreach', 'scheduling demo', 'monitoring for 30 days', 'preparing competitive analysis'])} for ${org.name}. ${randomItem(['Decision maker identified', 'Budget cycle aligns', 'Technology fit confirmed', 'Competitive weakness detected'])}.`,
          suggestedMessage: `Hi ${randomItem(firstNames)}, I noticed ${org.name} is ${randomItem(['expanding', 'investing heavily', 'building new capabilities', 'entering new markets'])}. Would love to discuss how we can help.`,
          confidence: randomItem(confidences),
          confidenceScore: randomFloat(40, 95),
          evidenceIds: '[]',
          signalIds: JSON.stringify(relatedSignal ? [relatedSignal.id] : []),
          reasoningMethod: randomItem(reasoningMethods),
          modelUsed: randomItem(['gpt-4o-mini', 'claude-3-5-sonnet', 'gemini-pro']),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          status: randomItem(['active', 'acted_upon', 'dismissed'] as any),
        },
      });
    }
  }
  console.info(`✅ Created insights`);

  // Create briefings
  for (const org of organizations.slice(0, 15)) {
    const orgSignals = signals.filter((s) => s.organizationId === org.id);
    await db.briefing.create({
      data: {
        organizationId: org.id,
        executiveSummary: `${org.name} is a ${org.industry} company with ${org.employeeCount} employees, headquartered in ${org.headquarters}. ${orgSignals.length} intelligence signals detected in the last 90 days indicate ${randomItem(['active growth', 'strategic expansion', 'technology modernization', 'market leadership consolidation'])}.`,
        keyFindings: JSON.stringify([
          `${orgSignals.filter((s) => s.severity === 'critical').length} critical signals require immediate attention`,
          `Strong ${randomItem(['funding', 'hiring', 'technology'])} momentum detected in last 30 days`,
          `${randomItem(['Decision maker', 'Key contact', 'Technical lead'])} identified in the organization`,
          `Competitor analysis reveals ${randomItem(['market opening', 'pricing vulnerability', 'feature gap'])}`,
        ]),
        opportunityScore: randomFloat(30, 85),
        riskFactors: JSON.stringify([
          randomItem([
            'High competition in core market',
            'Recent leadership changes',
            'Budget constraints detected',
          ]),
          randomItem([
            'Technology lock-in risk',
            'Long sales cycle expected',
            'Regulatory uncertainty',
          ]),
        ]),
        recommendedActions: JSON.stringify([
          `Initiate outreach via ${randomItem(['email', 'LinkedIn', 'referral', 'event'])}`,
          `Prepare ${randomItem(['competitive analysis', 'ROI calculator', 'case study', 'technical comparison'])}`,
          `Monitor for ${randomItem(['funding', 'hiring', 'product', 'partnership'])} signals over next 30 days`,
        ]),
        signalCount: orgSignals.length,
        activeSignals: orgSignals.filter((s) => s.status === 'detected' || s.status === 'validated')
          .length,
        insightCount: 1 + Math.floor(Math.random() * 3),
        evidenceCount: evidence.filter((e) => e.organizationId === org.id).length,
        overallConfidence: randomItem(confidences),
      },
    });
  }
  console.info(`✅ Created briefings`);

  // Create relationships
  for (let i = 0; i < 30; i++) {
    const sourceOrg = randomItem(organizations);
    let targetOrg = randomItem(organizations);
    while (targetOrg.id === sourceOrg.id) {
      targetOrg = randomItem(organizations);
    }
    await db.relationship.create({
      data: {
        type: randomItem([
          'competes_with',
          'partnered_with',
          'invested_in',
          'is_customer_of',
          'integrates_with',
        ]),
        label: `${sourceOrg.name} ${randomItem(['competes with', 'partners with', 'invested in', 'is a customer of', 'integrates with'])} ${targetOrg.name}`,
        weight: randomFloat(0.3, 1.0),
        sourceOrgId: sourceOrg.id,
        targetOrgId: targetOrg.id,
      },
    });
  }
  console.info(`✅ Created relationships`);

  // Create AI usage logs
  const providers = ['OpenAI', 'Anthropic', 'Gemini', 'zai-sdk'];
  const models = ['gpt-4o-mini', 'claude-3-5-sonnet', 'gemini-pro', 'deepmindq-reasoning'];
  const features = [
    'reasoning',
    'briefing',
    'signal_analysis',
    'entity_resolution',
    'relationship_discovery',
  ];

  for (let i = 0; i < 200; i++) {
    await db.aIUsageLog.create({
      data: {
        provider: randomItem(providers),
        model: randomItem(models),
        feature: randomItem(features),
        promptTokens: 500 + Math.floor(Math.random() * 3000),
        completionTokens: 200 + Math.floor(Math.random() * 1500),
        totalTokens: 700 + Math.floor(Math.random() * 4500),
        latencyMs: 200 + Math.floor(Math.random() * 3000),
        costUSD: randomFloat(0.001, 0.15),
        qualityScore: Math.floor(60 + Math.random() * 40),
        error: Math.random() > 0.95 ? 'Rate limit exceeded' : null,
        createdAt: randomDate(new Date(Date.now() - 30 * 86400000), new Date()),
      },
    });
  }
  console.info(`✅ Created AI usage logs`);

  // Create audit log entries
  const actions = [
    'login',
    'view_organization',
    'search',
    'create_briefing',
    'analyze_signal',
    'export_data',
    'update_settings',
    'dismiss_signal',
  ];
  for (let i = 0; i < 50; i++) {
    await db.auditLog.create({
      data: {
        userId: admin.id,
        action: randomItem(actions),
        resource: randomItem(organizations.map((o) => o.id)),
        details: JSON.stringify({
          page: randomItem(['dashboard', 'search', 'briefing', 'signals']),
        }),
        ipAddress: '192.168.1.1',
        createdAt: randomDate(new Date(Date.now() - 14 * 86400000), new Date()),
      },
    });
  }
  console.info(`✅ Created audit logs`);

  // Create prompt templates
  const templateData = [
    {
      key: 'brief_summary',
      label: 'Executive Brief Summary',
      description: 'Generate a concise executive summary of an organization',
      systemPrompt:
        'You are an intelligence analyst. Summarize the key findings about this organization.',
      userPromptTemplate: 'Summarize: {{organization}}',
      version: 1,
      isActive: true,
      isDefault: true,
      feature: 'briefing',
      model: 'gpt-4o-mini',
    },
    {
      key: 'reasoning_analyst',
      label: 'Deep Analysis Reasoning',
      description: 'Deep reasoning analysis for signal intelligence',
      systemPrompt:
        'You are a senior intelligence analyst with expertise in business strategy and competitive analysis.',
      version: 1,
      isActive: true,
      isDefault: true,
      feature: 'reasoning',
      model: 'claude-3-5-sonnet',
    },
    {
      key: 'engagement_approach',
      label: 'Engagement Strategy',
      description: 'Generate personalized outreach strategies',
      systemPrompt: 'You are a sales strategist. Recommend the best engagement approach.',
      version: 1,
      isActive: true,
      isDefault: false,
      feature: 'reasoning',
      model: 'gpt-4o-mini',
    },
  ];
  for (const t of templateData) {
    await db.promptTemplate.create({ data: t });
  }
  console.info(`✅ Created prompt templates`);

  console.info('\n🎉 Seed complete!');
  console.info(`   Organizations: ${organizations.length}`);
  console.info(`   People: ${people.length}`);
  console.info(`   Signals: ${signals.length}`);
  console.info(`   Evidence: ${evidence.length}`);
}

seed()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
