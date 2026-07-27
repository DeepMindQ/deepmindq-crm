/**
 * Enterprise Demo Dataset Seeding Script
 * ======================================
 * Creates a realistic enterprise-scale dataset for Phase D validation:
 *   - 100 companies across 6 industries
 *   - 500+ contacts with diverse roles/seniorities
 *   - 1000+ signals across all signal types
 *   - 200+ evidence records
 *   - 30+ opportunities with capability matches
 *   - 10 capability assets
 *
 * Usage: npx tsx scripts/seed-enterprise-data.ts
 */

import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

// ─── Industry Data ─────────────────────────────────────────────────────────

const INDUSTRIES = [
  'Financial Services',
  'Healthcare',
  'SaaS / Technology',
  'Manufacturing',
  'Retail / E-Commerce',
  'Energy / Utilities',
] as const;

const COMPANY_TEMPLATES: Record<string, { prefix: string; domains: string[]; sizes: string[]; locations: string[] }> = {
  'Financial Services': {
    prefix: 'Fin',
    domains: ['capitalone.com', 'jpmorgan.com', 'goldmansachs.com', 'fidelity.com', 'mastercard.com',
      'stripe.com', 'plaid.com', 'robinhood.com', 'sofi.com', 'chime.com',
      'bnymellon.com', 'blackrock.com', 'visa.com', 'paypal.com', 'intuit.com', 'adp.com'],
    sizes: ['1001-5000', '5001-10000', '10001+'],
    locations: ['New York, NY', 'San Francisco, CA', 'Charlotte, NC', 'Chicago, IL', 'London, UK'],
  },
  'Healthcare': {
    prefix: 'Med',
    domains: ['epic.com', 'cerner.com', 'athenahealth.com', 'vareva.com', 'phreesia.com',
      'tempus.com', 'flatiron.com', 'verily.com', 'color.com', '23andme.com',
      'unitedhealth.com', 'cvshealth.com', 'labcorp.com', 'questdiagnostics.com', 'biogen.com', 'moderna.com'],
    sizes: ['501-1000', '1001-5000', '5001-10000'],
    locations: ['Boston, MA', 'San Francisco, CA', 'Minneapolis, MN', 'Nashville, TN', 'Philadelphia, PA'],
  },
  'SaaS / Technology': {
    prefix: 'Tech',
    domains: ['snowflake.com', 'databricks.com', 'confluent.io', 'hashicorp.com', 'datadog.com',
      'gitlab.com', 'circleci.com', 'launchdarkly.com', 'segment.com', 'twilio.com',
      'slack.com', 'asana.com', 'notion.so', 'figma.com', 'canva.com', 'zoom.us'],
    sizes: ['51-200', '201-500', '501-1000', '1001-5000'],
    locations: ['San Francisco, CA', 'Seattle, WA', 'Austin, TX', 'New York, NY', 'Denver, CO'],
  },
  'Manufacturing': {
    prefix: 'Mfg',
    domains: ['siemens.com', 'ge.com', 'honeywell.com', 'rockwellautomation.com', 'ptc.com',
      'fanuc.com', 'abb.com', 'schneider-electric.com', 'dassault.com', 'ansys.com',
      'cat.com', 'deere.com', 'boeing.com', 'lockheedmartin.com', 'northropgrumman.com', 'rtx.com'],
    sizes: ['5001-10000', '10001+'],
    locations: ['Detroit, MI', 'Chicago, IL', 'Atlanta, GA', 'Houston, TX', 'Cincinnati, OH'],
  },
  'Retail / E-Commerce': {
    prefix: 'Retail',
    domains: ['shopify.com', 'stripe.com', 'bigcommerce.com', 'salesforce.com', 'adobe.com',
      'amazon.com', 'walmart.com', 'target.com', 'ebay.com', 'etsy.com',
      'wayfair.com', 'chewy.com', 'instacart.com', 'doordash.com', 'uber.com', 'airbnb.com'],
    sizes: ['1001-5000', '5001-10000', '10001+'],
    locations: ['New York, NY', 'San Francisco, CA', 'Seattle, WA', 'Austin, TX', 'Chicago, IL'],
  },
  'Energy / Utilities': {
    prefix: 'Energy',
    domains: ['nexteraenergy.com', 'exelon.com', 'dominionenergy.com', 'duke-energy.com', 'southernco.com',
      'shell.com', 'bp.com', 'equinor.com', 'vestas.com', 'ensenada.com',
      'ge.com', 'schneider-electric.com', 'siemens-energy.com', 'hitachienergy.com', 'powin.com', 'fluence.com'],
    sizes: ['1001-5000', '5001-10000', '10001+'],
    locations: ['Houston, TX', 'Denver, CO', 'Atlanta, GA', 'Charlotte, NC', 'Phoenix, AZ'],
  },
};

const CONTACT_ROLES: Record<string, { roles: string[]; seniorities: string[] }> = {
  'Financial Services': {
    roles: ['Chief Information Officer', 'Chief Technology Officer', 'Chief Data Officer', 'VP of Engineering', 'VP of Digital Transformation',
      'Director of Data Analytics', 'Head of Cloud Architecture', 'Director of Cybersecurity', 'Head of Risk Technology', 'VP of Operations'],
    seniorities: ['c_suite', 'c_suite', 'c_suite', 'vp', 'vp', 'director', 'director', 'director', 'director', 'vp'],
  },
  'Healthcare': {
    roles: ['Chief Information Officer', 'Chief Technology Officer', 'VP of Engineering', 'Director of Health IT',
      'Head of Data Science', 'Chief Digital Officer', 'Director of Clinical Informatics', 'VP of Innovation',
      'Head of Interoperability', 'Director of Compliance Technology'],
    seniorities: ['c_suite', 'c_suite', 'vp', 'director', 'director', 'c_suite', 'director', 'vp', 'director', 'director'],
  },
  'SaaS / Technology': {
    roles: ['Chief Technology Officer', 'VP of Engineering', 'Head of Platform', 'Director of Infrastructure',
      'VP of Product', 'Head of DevOps', 'Staff Engineer', 'Engineering Manager', 'Principal Architect', 'VP of Security'],
    seniorities: ['c_suite', 'vp', 'director', 'director', 'vp', 'director', 'individual', 'manager', 'director', 'vp'],
  },
  'Manufacturing': {
    roles: ['Chief Digital Officer', 'VP of Manufacturing Technology', 'Director of Industrial IoT',
      'Head of Supply Chain Analytics', 'VP of Operations', 'Director of Quality Systems',
      'Head of Automation', 'Chief Information Officer', 'VP of Engineering', 'Director of ERP Systems'],
    seniorities: ['c_suite', 'vp', 'director', 'director', 'vp', 'director', 'director', 'c_suite', 'vp', 'director'],
  },
  'Retail / E-Commerce': {
    roles: ['Chief Technology Officer', 'VP of E-Commerce', 'Head of Data Analytics', 'Director of Supply Chain',
      'VP of Digital', 'Chief Marketing Officer', 'Director of Customer Experience', 'Head of AI/ML',
      'VP of Operations', 'Director of Mobile Engineering'],
    seniorities: ['c_suite', 'vp', 'director', 'director', 'vp', 'c_suite', 'director', 'director', 'vp', 'director'],
  },
  'Energy / Utilities': {
    roles: ['Chief Information Officer', 'VP of Grid Technology', 'Director of Smart Grid',
      'Head of Renewable Analytics', 'Chief Sustainability Officer', 'VP of Engineering',
      'Director of SCADA Systems', 'Head of Cybersecurity', 'VP of Operations', 'Director of Asset Management'],
    seniorities: ['c_suite', 'vp', 'director', 'director', 'c_suite', 'vp', 'director', 'director', 'vp', 'director'],
  },
};

const FIRST_NAMES = [
  'Sarah', 'Michael', 'Jennifer', 'David', 'Lisa', 'James', 'Maria', 'Robert', 'Patricia', 'John',
  'Emily', 'William', 'Amanda', 'Richard', 'Jessica', 'Thomas', 'Ashley', 'Daniel', 'Stephanie', 'Christopher',
  'Rachel', 'Andrew', 'Nicole', 'Kevin', 'Lauren', 'Brian', 'Michelle', 'Jason', 'Kimberly', 'Ryan',
  'Samantha', 'Nathan', 'Elizabeth', 'Marcus', 'Olivia', 'Alex', 'Megan', 'Jordan', 'Taylor', 'Priya',
  'Arjun', 'Wei', 'Yuki', 'Carlos', 'Fatima', 'Aisha', 'Kofi', 'Omar', 'Vikram', 'Deepa',
];

const LAST_NAMES = [
  'Johnson', 'Williams', 'Chen', 'Patel', 'Anderson', 'Kim', 'Garcia', 'Martinez', 'Brown', 'Davis',
  'Wilson', 'Taylor', 'Thomas', 'Moore', 'Jackson', 'White', 'Harris', 'Thompson', 'Lee', 'Clark',
  'Robinson', 'Lewis', 'Walker', 'Hall', 'Allen', 'Young', 'King', 'Wright', 'Scott', 'Torres',
  'Nguyen', 'Hill', 'Flores', 'Green', 'Adams', 'Baker', 'Gonzalez', 'Nelson', 'Carter', 'Mitchell',
  'Perez', 'Roberts', 'Turner', 'Phillips', 'Campbell', 'Parker', 'Evans', 'Edwards', 'Collins', 'Stewart',
];

const SIGNAL_TYPES = ['funding', 'hiring', 'leadership_change', 'tech_change', 'news', 'mention', 'partnership', 'expansion'] as const;

const SIGNAL_TEMPLATES: Record<string, { titles: string[]; descriptions: string[]; severities: string[]; businessImpacts: string[]; recommendedActions: string[]; timingWindows: string[]; meaningCategories: string[] }> = {
  funding: {
    titles: [
      'raises $50M Series C to expand platform',
      'closes $120M growth round led by Sequoia',
      'secures $25M Series B for market expansion',
      'raises $80M at $500M valuation',
      'closes $200M funding round for AI initiatives',
    ],
    descriptions: [
      'Company has raised significant capital for growth initiatives, indicating budget availability for technology investments.',
      'Growth funding signals expansion plans and openness to new vendor relationships.',
      'Series funding validates business model and creates technology modernization budget.',
    ],
    severities: ['medium', 'high'],
    businessImpacts: [
      'High — newly funded companies actively seek technology solutions to deploy capital effectively',
      'Medium — funding provides budget runway for vendor evaluation and procurement',
    ],
    recommendedActions: [
      'Position solution as a capital-efficient way to accelerate their growth mandate within 30 days',
      'Schedule executive discussion to understand their deployment priorities for the new capital',
    ],
    timingWindows: ['within_30_days', 'within_7_days'],
    meaningCategories: ['budget_available', 'growth_pressure'],
  },
  hiring: {
    titles: [
      'hiring 25 engineers for cloud platform team',
      'posted 15 new roles in data engineering',
      'expanding AI/ML team with 20 new hires',
      'hiring VP of Engineering to lead digital transformation',
      'opening new R&D center with 50 positions',
    ],
    descriptions: [
      'Rapid team expansion indicates growth phase and technology investment priorities.',
      'Hiring signals operational scaling needs — tools and platforms must keep pace.',
    ],
    severities: ['medium', 'low'],
    businessImpacts: [
      'Medium — growing teams need scalable platforms and automation tools',
      'Low — hiring signals long-term growth but may not have immediate budget pressure',
    ],
    recommendedActions: [
      'Position as a scaling enabler that grows with their team — outreach to hiring manager',
      'Research their growth plans and propose automation that multiplies team productivity',
    ],
    timingWindows: ['within_30_days', 'within_90_days'],
    meaningCategories: ['growth_pressure', 'tech_dissatisfaction'],
  },
  leadership_change: {
    titles: [
      'appoints new Chief Information Officer',
      'names new VP of Engineering from Google',
      'hires Chief Data Officer to lead AI strategy',
      'promotes VP of Digital Transformation to COO',
      'brings in new CTO to modernize platform',
    ],
    descriptions: [
      'New executive leadership often reassesses vendor relationships within first 90 days. This is a prime engagement window.',
      'Leadership change creates opportunity for fresh vendor evaluation and relationship reset.',
    ],
    severities: ['high', 'critical'],
    businessImpacts: [
      'High — new executives actively seek trusted technology partners and reassess existing vendor landscape',
      'Critical — C-level change signals strategic pivot, creating vendor evaluation window',
    ],
    recommendedActions: [
      'Research new executive background, craft personalized introduction within 7 days',
      'Map shared connections and prepare case study materials aligned to their likely priorities',
    ],
    timingWindows: ['within_7_days', 'within_30_days'],
    meaningCategories: ['leadership_openness', 'vendor_evaluation'],
  },
  tech_change: {
    titles: [
      'announces migration to Azure AI platform',
      'adopts Kubernetes for container orchestration',
      'launches data lake modernization initiative',
      'implements zero-trust security architecture',
      'begins SAP S/4HANA migration project',
    ],
    descriptions: [
      'Technology migration signals dissatisfaction with current solutions and openness to complementary tools.',
      'Major platform changes create integration needs and consulting opportunities.',
    ],
    severities: ['high', 'medium'],
    businessImpacts: [
      'High — technology migration creates immediate integration and consulting opportunities',
      'Medium — platform change signals long-term architecture evolution and vendor reassessment',
    ],
    recommendedActions: [
      'Lead with technical value proposition targeting the architecture team within 14 days',
      'Position integration expertise relevant to their chosen platform — prepare technical discovery call',
    ],
    timingWindows: ['within_14_days', 'within_30_days'],
    meaningCategories: ['tech_dissatisfaction', 'vendor_evaluation'],
  },
  news: {
    titles: [
      'featured in Forbes for digital innovation',
      'wins industry award for customer experience',
      'announces strategic partnership with Microsoft',
      'hosts annual developer conference with 10K attendees',
      'publishes open-source framework for data governance',
    ],
    descriptions: [
      'Positive news coverage indicates company momentum and marketing openness.',
      'Industry recognition provides conversation starters for outreach.',
    ],
    severities: ['low', 'medium'],
    businessImpacts: [
      'Medium — positive momentum creates warm outreach opportunity',
      'Low — general news provides conversational context but limited buying signal',
    ],
    recommendedActions: [
      'Reference recent achievement in outreach to build rapport and credibility',
      'Use news mention as conversation opener for warm introduction email',
    ],
    timingWindows: ['within_30_days', 'within_90_days'],
    meaningCategories: ['growth_pressure', 'unknown'],
  },
  mention: {
    titles: [
      'mentioned in Gartner Magic Quadrant report',
      'cited in industry analyst research note',
      'referenced in regulatory compliance guidance',
      'featured in trade publication case study',
      'discussed at industry conference keynote',
    ],
    descriptions: [
      'Industry mention indicates market visibility and potential compliance/regulatory awareness.',
      'Analyst coverage often precedes technology evaluation cycles.',
    ],
    severities: ['low', 'medium'],
    businessImpacts: [
      'Medium — analyst mention may trigger technology evaluation cycle',
      'Low — industry mention provides contextual awareness',
    ],
    recommendedActions: [
      'Monitor for follow-up signals — analyst mentions often precede RFP processes',
      'Prepare relevant case study if the mention relates to your solution area',
    ],
    timingWindows: ['within_90_days', 'ongoing'],
    meaningCategories: ['compliance_requirement', 'unknown'],
  },
  partnership: {
    titles: [
      'partners with AWS for cloud transformation',
      'joins Microsoft AI partner program',
      'announces strategic alliance with Deloitte',
      'integrates with Salesforce platform',
      'launches joint venture with Siemens',
    ],
    descriptions: [
      'New partnership signals ecosystem strategy and creates integration/co-sell opportunities.',
      'Partnership often indicates budget allocation and technology roadmap direction.',
    ],
    severities: ['medium', 'high'],
    businessImpacts: [
      'Medium — partnership creates ecosystem entry point and co-sell opportunity',
      'High — strategic partnership signals budget and roadmap alignment',
    ],
    recommendedActions: [
      'Position complementary capabilities that enhance their new partnership ecosystem',
      'Identify co-sell opportunities through the partnership channel',
    ],
    timingWindows: ['within_30_days', 'within_90_days'],
    meaningCategories: ['vendor_evaluation', 'growth_pressure'],
  },
  expansion: {
    titles: [
      'opens new office in London for European expansion',
      'expands into healthcare vertical with new division',
      'launches operations in Asia-Pacific market',
      'acquires startup to enter AI analytics space',
      'establishes new innovation lab in Austin',
    ],
    descriptions: [
      'Geographic or vertical expansion creates new technology requirements and vendor needs.',
      'Expansion signals growth phase and operational scaling challenges.',
    ],
    severities: ['medium', 'high'],
    businessImpacts: [
      'Medium — expansion creates infrastructure and platform needs in new markets',
      'High — new market entry often requires fresh technology stack evaluation',
    ],
    recommendedActions: [
      'Position as a scalable platform that supports multi-region/multi-vertical operations',
      'Research their expansion target market and prepare relevant case studies',
    ],
    timingWindows: ['within_30_days', 'within_90_days'],
    meaningCategories: ['growth_pressure', 'budget_available'],
  },
};

const EVIDENCE_TEMPLATES = [
  { field: 'revenue', sources: ['sec.gov', 'bloomberg.com', 'reuters.com'], qualities: ['premium', 'premium', 'standard'] },
  { field: 'employeeCount', sources: ['linkedin.com', 'crunchbase.com', 'company website'], qualities: ['standard', 'standard', 'standard'] },
  { field: 'techStack', sources: ['stackshare.io', 'builtwith.com', 'job postings'], qualities: ['standard', 'standard', 'low'] },
  { field: 'fundingHistory', sources: ['crunchbase.com', 'pitchbook.com', 'techcrunch.com'], qualities: ['premium', 'premium', 'standard'] },
  { field: 'industrySegment', sources: ['industry reports', 'company website', 'news articles'], qualities: ['standard', 'standard', 'low'] },
  { field: 'keyPartnerships', sources: ['press releases', 'news articles', 'conference announcements'], qualities: ['standard', 'standard', 'low'] },
  { field: 'growthRate', sources: ['linkedin.com', 'crunchbase.com', 'news articles'], qualities: ['standard', 'standard', 'low'] },
  { field: 'cloudInfrastructure', sources: ['job postings', 'tech blogs', 'cloud marketplace listings'], qualities: ['standard', 'low', 'low'] },
];

const CAPABILITY_ASSETS = [
  { title: 'Cloud Migration Factory', summary: 'End-to-end cloud migration service from assessment through execution with automated tooling.', category: 'solution', technology: 'AWS,Azure,GCP', industry: 'Cross-Industry', businessProblem: 'Legacy system modernization', keywords: '["cloud migration", "modernization", "lift-and-shift", "refactoring"]' },
  { title: 'Data & Analytics Platform', summary: 'Enterprise data platform implementation with real-time analytics, data governance, and ML pipeline integration.', category: 'solution', technology: 'Snowflake,Databricks,dbt', industry: 'Cross-Industry', businessProblem: 'Data silos and analytics maturity', keywords: '["data platform", "analytics", "data lake", "BI", "data governance"]' },
  { title: 'AI/ML Operations (MLOps)', summary: 'Production ML pipeline deployment, model governance, and AI operations for enterprise scale.', category: 'solution', technology: 'Kubernetes,TensorFlow,MLflow', industry: 'Cross-Industry', businessProblem: 'ML model deployment and governance', keywords: '["machine learning", "AI operations", "MLOps", "model governance"]' },
  { title: 'Cybersecurity Assessment', summary: 'Comprehensive security posture assessment with zero-trust architecture design and implementation.', category: 'service_line', technology: 'CrowdStrike,Palo Alto,Zscaler', industry: 'Cross-Industry', businessProblem: 'Security vulnerabilities and compliance', keywords: '["cybersecurity", "zero trust", "security assessment", "compliance"]' },
  { title: 'Digital Transformation Advisory', summary: 'Strategic advisory for enterprise digital transformation including roadmap, governance, and change management.', category: 'service_line', technology: 'Cross-Platform', industry: 'Cross-Industry', businessProblem: 'Lack of digital strategy and execution', keywords: '["digital transformation", "strategy", "advisory", "change management"]' },
  { title: 'Enterprise Integration Platform', summary: 'API management and enterprise integration platform for connecting legacy systems with modern applications.', category: 'solution', technology: 'MuleSoft,Kong,Apigee', industry: 'Cross-Industry', businessProblem: 'System integration and API management', keywords: '["integration", "API management", "middleware", "SOA"]' },
  { title: 'DevOps & CI/CD Acceleration', summary: 'DevOps maturity assessment and CI/CD pipeline modernization for faster, more reliable software delivery.', category: 'accelerator', technology: 'Jenkins,GitHub Actions,Azure DevOps', industry: 'Cross-Industry', businessProblem: 'Slow and unreliable software delivery', keywords: '["DevOps", "CI/CD", "automation", "pipeline"]' },
  { title: 'Regulatory Compliance Solution', summary: 'Industry-specific compliance automation for GDPR, HIPAA, SOX, and PCI-DSS requirements.', category: 'solution', technology: 'Cross-Platform', industry: 'Financial Services,Healthcare', businessProblem: 'Regulatory compliance overhead', keywords: '["compliance", "regulatory", "GDPR", "HIPAA", "SOX"]' },
  { title: 'Customer Experience Platform', summary: 'Omnichannel customer experience platform with personalization, analytics, and journey orchestration.', category: 'solution', technology: 'Salesforce,Adobe,Segment', industry: 'Retail / E-Commerce', businessProblem: 'Fragmented customer experience', keywords: '["customer experience", "CX", "personalization", "omnichannel"]' },
  { title: 'Smart Manufacturing IoT', summary: 'Industrial IoT platform for predictive maintenance, quality monitoring, and supply chain optimization.', category: 'solution', technology: 'Azure IoT,AWS IoT,OSIsoft', industry: 'Manufacturing,Energy / Utilities', businessProblem: 'Operational inefficiency and downtime', keywords: '["IoT", "smart manufacturing", "predictive maintenance", "IIoT"]' },
];

// ─── Helper Functions ───────────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate(daysBack: number): Date {
  const now = new Date();
  const offset = randomInt(0, daysBack) * 24 * 60 * 60 * 1000;
  return new Date(now.getTime() - offset);
}

function randomDateRange(daysBackMin: number, daysBackMax: number): Date {
  const now = new Date();
  const offset = randomInt(daysBackMin, daysBackMax) * 24 * 60 * 60 * 1000;
  return new Date(now.getTime() - offset);
}

function generateEmail(first: string, last: string, domain: string, uniqueId: number): string {
  const patterns = [
    `${first.toLowerCase()}.${last.toLowerCase()}.${uniqueId}@${domain}`,
    `${first.toLowerCase()}.${last.toLowerCase()}_${uniqueId}@${domain}`,
    `${first[0].toLowerCase()}${last.toLowerCase()}${uniqueId}@${domain}`,
    `${first.toLowerCase()}${uniqueId}@${domain}`,
  ];
  return patterns[uniqueId % patterns.length];
}

// ─── Main Seed Function ───────────────────────────────────────────────────

async function seedEnterpriseData() {
  console.log('🌱 Enterprise Demo Dataset Seeding');
  console.log('================================');
  const startTime = Date.now();

  // Step 0: Create ImportBatch for contacts
  console.log('\n📦 Creating import batch...');
  const batch = await db.importBatch.create({
    data: {
      fileName: 'enterprise-seed-dataset.csv',
      fileHash: `seed_${Date.now()}`,
      totalRows: 0,
      acceptedRows: 0,
      status: 'completed',
    },
  });

  // Step 1: Create 100 companies across 6 industries
  console.log('\n🏢 Creating 100 companies...');
  const companies: { id: string; name: string; industry: string; domain: string; index: number }[] = [];
  const companiesPerIndustry = Math.floor(100 / INDUSTRIES.length); // ~16 per industry

  for (const industry of INDUSTRIES) {
    const template = COMPANY_TEMPLATES[industry];
    const count = industry === INDUSTRIES[INDUSTRIES.length - 1]
      ? 100 - companiesPerIndustry * (INDUSTRIES.length - 1)
      : companiesPerIndustry;

    for (let i = 0; i < count; i++) {
      const name = `${template.prefix}${String(i + 1).padStart(2, '0')} Corp`;
      const domain = template.domains[i % template.domains.length];
      const sizeRange = pick(template.sizes);
      const location = pick(template.locations);
      const tags = JSON.stringify([industry.toLowerCase().replace(/[\/\s]/g, '-')]);
      const intScore = randomInt(1, 5);
      const statuses = ['prospect', 'researching', 'active', 'engaged'];
      const lifecycleStages = ['discovery', 'qualification', 'proposal', 'negotiation'];

      const company = await db.company.create({
        data: {
          rawName: name,
          normalizedName: name.toLowerCase(),
          domain,
          industry,
          sizeRange,
          location,
          country: location.includes('UK') ? 'United Kingdom' : 'United States',
          website: `https://${domain}`,
          tags,
          status: pick(statuses),
          lifecycleStage: pick(lifecycleStages),
          intelligenceScore: intScore,
          engagementScore: randomInt(0, 80),
          source: 'manual',
        },
      });

      companies.push({ id: company.id, name: company.rawName, industry, domain, index: companies.length });
    }
  }
  console.log(`   ✅ Created ${companies.length} companies`);

  // Step 2: Create 500+ contacts
  console.log('\n👤 Creating 500+ contacts...');
  let contactCount = 0;

  for (const company of companies) {
    const roleConfig = CONTACT_ROLES[company.industry];
    const numContacts = randomInt(4, 7); // 4-7 per company

    for (let i = 0; i < numContacts; i++) {
      const firstName = pick(FIRST_NAMES);
      const lastName = pick(LAST_NAMES);
      const roleIndex = i % roleConfig.roles.length;
      const role = roleConfig.roles[roleIndex];
      const email = generateEmail(firstName, lastName, company.domain, contactCount);
      const leadScore = randomInt(20, 95);
      const statuses = ['imported', 'cleaned', 'contacted', 'replied', 'active'];
      const status = pick(statuses);

      await db.contact.create({
        data: {
          rawName: `${firstName} ${lastName}`,
          normalizedName: `${firstName} ${lastName}`.toLowerCase(),
          email,
          title: role,
          location: company.location?.split(',')[0],
          companyId: company.id,
          batchId: batch.id,
          leadScore,
          status,
          consentStatus: pick(['unknown', 'opted_in']),
          emailHealth: pick(['unknown', 'valid']),
          companyFitScore: randomInt(30, 90),
          engagementScore: randomInt(0, 70),
          enrichmentScore: randomInt(20, 80),
          source: pick(['linkedin', 'event', 'manual', 'inbound']),
        },
      });
      contactCount++;
    }
  }
  console.log(`   ✅ Created ${contactCount} contacts`);

  // Step 3: Create 1000+ signals
  console.log('\n📡 Creating 1000+ signals...');
  let signalCount = 0;
  const signalIdsByCompany: Map<string, string[]> = new Map();

  for (const company of companies) {
    const numSignals = randomInt(8, 15); // 8-15 per company
    const companySignalIds: string[] = [];

    for (let i = 0; i < numSignals; i++) {
      const signalType = pick(SIGNAL_TYPES as unknown as string[]);
      const template = SIGNAL_TEMPLATES[signalType] || SIGNAL_TEMPLATES.news;
      const title = `${company.name} ${pick(template.titles)}`;
      const signalDate = randomDateRange(1, 90);
      const confidence = Math.round((randomInt(40, 95)) / 100 * 100) / 100;

      const signal = await db.companySignal.create({
        data: {
          companyId: company.id,
          signalType,
          title,
          description: pick(template.descriptions),
          source: pick(['LinkedIn', 'TechCrunch', 'Bloomberg', 'SEC Filing', 'Press Release', 'Crunchbase', 'Reuters']),
          sourceUrl: `https://example.com/signal/${signalType}/${Date.now() + signalCount}`,
          severity: pick(template.severities),
          impact: pick(['high', 'medium', 'low']),
          signalDate,
          confidence,
          businessImpact: pick(template.businessImpacts),
          recommendedAction: pick(template.recommendedActions),
          timingWindow: pick(template.timingWindows),
          meaningCategory: pick(template.meaningCategories),
          status: pick(['detected', 'validated', 'active']),
          sourceQuality: pick(['premium', 'standard', 'standard', 'low']),
        },
      });

      companySignalIds.push(signal.id);
      signalCount++;
    }
    signalIdsByCompany.set(company.id, companySignalIds);
  }
  console.log(`   ✅ Created ${signalCount} signals`);

  // Step 4: Create 200+ evidence records
  console.log('\n📄 Creating 200+ evidence records...');
  let evidenceCount = 0;

  for (const company of companies) {
    const numEvidence = randomInt(1, 4); // 1-4 per company

    for (let i = 0; i < numEvidence; i++) {
      const tmpl = pick(EVIDENCE_TEMPLATES);
      const confidence = Math.round((randomInt(50, 95)) / 100 * 100) / 100;

      await db.evidence.create({
        data: {
          companyId: company.id,
          sourceUrl: `https://${pick(tmpl.sources)}/${company.domain}/${tmpl.field}`,
          sourceTitle: `${company.name} ${tmpl.field} data`,
          sourceName: pick(tmpl.sources),
          snippet: `Extracted ${tmpl.field} data for ${company.name} from ${pick(tmpl.sources)}`,
          extractedField: tmpl.field,
          extractedValue: tmpl.field === 'revenue' ? `$${randomInt(10, 500)}M` :
            tmpl.field === 'employeeCount' ? String(randomInt(200, 50000)) :
            tmpl.field === 'growthRate' ? `${randomInt(10, 80)}%` : 'Detected',
          relevanceScore: confidence,
          confidence,
          sourceQualityTier: pick(tmpl.qualities),
          status: 'active',
        },
      });
      evidenceCount++;
    }
  }
  console.log(`   ✅ Created ${evidenceCount} evidence records`);

  // Step 5: Create capability assets
  console.log('\n🔧 Creating capability assets...');
  const capabilities: { id: string; title: string }[] = [];

  for (const asset of CAPABILITY_ASSETS) {
    const created = await db.capabilityAsset.create({
      data: {
        title: asset.title,
        summary: asset.summary,
        category: asset.category,
        technology: asset.technology,
        industry: asset.industry,
        businessProblem: asset.businessProblem,
        keywords: asset.keywords,
        isActive: true,
      },
    });
    capabilities.push({ id: created.id, title: created.title });
  }
  console.log(`   ✅ Created ${capabilities.length} capability assets`);

  // Step 6: Create SignalCapabilityMatches + Opportunities for top companies
  console.log('\n🎯 Creating opportunities (30+)...');
  let opportunityCount = 0;
  let matchCount = 0;

  // Pick top ~50 companies for matches and ~25 for opportunities
  const topCompanies = companies.slice(0, 50);

  for (const company of topCompanies) {
    const signalIds = signalIdsByCompany.get(company.id) || [];
    if (signalIds.length === 0) continue;

    // Create 1-3 capability matches per company
    const numMatches = randomInt(1, 3);

    for (let i = 0; i < numMatches; i++) {
      const signalId = pick(signalIds);
      const capability = pick(capabilities);
      const matchScore = Math.round((randomInt(50, 95)) / 100 * 100) / 100;

      const match = await db.signalCapabilityMatch.create({
        data: {
          companyId: company.id,
          signalId,
          capabilityId: capability.id,
          matchScore: matchScore,
          reason: `Signal "${signalId.slice(0, 8)}" indicates need for ${capability.title} — ${company.industry} company showing active ${pick(SIGNAL_TYPES as unknown as string[])} signals`,
          businessProblem: `Company requires ${capability.title.toLowerCase()} to support their ${company.industry.toLowerCase()} operations`,
          expectedOutcome: `Improved efficiency and reduced operational costs through ${capability.title}`,
          salesAngle: `Position ${capability.title} as proven solution in ${company.industry} with measurable ROI`,
        },
      });

      // Create opportunity recommendation (for ~30 total)
      if (opportunityCount < 35 && matchCount < 50) {
        const priorities = ['high', 'medium', 'medium', 'low'];
        const statusList = ['pending_review', 'accepted', 'monitored'];

        await db.opportunityRecommendation.create({
          data: {
            companyId: company.id,
            signalId,
            capabilityMatchId: match.id,
            opportunityTitle: `${capability.title} for ${company.name}`,
            businessTrigger: `${company.name} signals indicate readiness for ${capability.title.toLowerCase()}`,
            whyNow: `Active ${pick(SIGNAL_TYPES as unknown as string[])} signals + ${company.industry} industry momentum create immediate engagement window`,
            businessProblem: `${company.name} faces challenges requiring ${capability.title.toLowerCase()} — identified through intelligence monitoring`,
            recommendedCapability: capability.title,
            recommendedStakeholders: JSON.stringify(['CTO', 'VP Engineering', 'CIO']),
            suggestedConversation: `Discuss ${capability.title} implementation roadmap and align to their ${company.industry.toLowerCase()} priorities`,
            confidenceScore: matchScore,
            freshnessScore: randomInt(70, 95),
            matchScore,
            opportunityScore: randomInt(55, 92),
            priority: pick(priorities),
            status: pick(statusList),
          },
        });
        opportunityCount++;
      }
      matchCount++;
    }
  }
  console.log(`   ✅ Created ${matchCount} capability matches + ${opportunityCount} opportunities`);

  // Step 7: Create pursuits for a subset of accepted opportunities
  console.log('\n📈 Creating pursuits...');
  const acceptedOpps = await db.opportunityRecommendation.findMany({
    where: { status: 'accepted' },
    take: 15,
  });

  let pursuitCount = 0;
  for (const opp of acceptedOpps) {
    await db.pursuit.create({
      data: {
        opportunityId: opp.id,
        companyId: opp.companyId,
        priority: pick(['high', 'medium']),
        status: pick(['active', 'active', 'active', 'paused']),
        nextAction: pick([
          'Schedule discovery call with CTO',
          'Prepare technical proposal',
          'Send case study materials',
          'Arrange product demo',
          'Follow up on initial conversation',
        ]),
        nextActionAt: randomDateRange(-7, 14),
        outcomeStage: pick(['discovery', 'qualification', 'proposal', 'negotiation']),
      },
    });
    pursuitCount++;
  }
  console.log(`   ✅ Created ${pursuitCount} pursuits`);

  // Summary
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n═══════════════════════════════════════');
  console.log(`✅ Enterprise Dataset Seeded in ${duration}s`);
  console.log(`   Companies:  ${companies.length}`);
  console.log(`   Contacts:   ${contactCount}`);
  console.log(`   Signals:    ${signalCount}`);
  console.log(`   Evidence:   ${evidenceCount}`);
  console.log(`   Capabilities: ${capabilities.length}`);
  console.log(`   Matches:    ${matchCount}`);
  console.log(`   Opportunities: ${opportunityCount}`);
  console.log(`   Pursuits:   ${pursuitCount}`);
  console.log('═══════════════════════════════════════');
}

seedEnterpriseData()
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
