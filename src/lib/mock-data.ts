// ═══════════════════════════════════════════════════════════════════════════
// DeepMindQ — Lead Intelligence & AI-Powered Outreach System
// Complete mock data layer
// ═══════════════════════════════════════════════════════════════════════════

// ── Contacts (Leads) ────────────────────────────────────────────────────
export type ContactStatus =
  | 'imported' | 'cleaned' | 'ready' | 'drafted' | 'queued'
  | 'sent' | 'replied' | 'bounced' | 'suppressed' | 'archived';
export type EmailHealthStatus = 'valid' | 'risky' | 'invalid' | 'unknown';
export type ConsentStatus = 'confirmed' | 'unconfirmed';
export type RoleBucket = 'executive' | 'manager' | 'technical' | 'operations' | 'sales' | 'other';
export type ScoreBand = 'hot' | 'warm' | 'cold';

export interface Contact {
  id: string;
  companyId: string;
  name: string;
  nameNormalized: string;
  emailAddress: string;
  linkedinUrl: string | null;
  jobTitle: string;
  roleBucket: RoleBucket;
  phone: string | null;
  location: string;
  status: ContactStatus;
  emailHealthStatus: EmailHealthStatus;
  emailHealthScore: number;
  consentStatus: ConsentStatus;
  score: number;
  scoreBand: ScoreBand;
  sourceBatch: string;
  lastContactedAt: string | null;
  createdAt: string;
}

export const MOCK_CONTACTS: Contact[] = [
  {
    id: 'cnt-001',
    companyId: 'cmp-001',
    name: 'Arjun Mehta',
    nameNormalized: 'arjun mehta',
    emailAddress: 'arjun.mehta@nexuscore.io',
    linkedinUrl: 'https://linkedin.com/in/arjunmehta',
    jobTitle: 'VP of Engineering',
    roleBucket: 'executive',
    phone: '+91 98450 12345',
    location: 'Bangalore, India',
    status: 'sent',
    emailHealthStatus: 'valid',
    emailHealthScore: 97,
    consentStatus: 'confirmed',
    score: 88,
    scoreBand: 'hot',
    sourceBatch: 'batch-001',
    lastContactedAt: '2025-06-10T09:30:00Z',
    createdAt: '2025-05-20T14:00:00Z',
  },
  {
    id: 'cnt-002',
    companyId: 'cmp-001',
    name: 'Deepika Rao',
    nameNormalized: 'deepika rao',
    emailAddress: 'd.rao@nexuscore.io',
    linkedinUrl: 'https://linkedin.com/in/deepikarao',
    jobTitle: 'CTO',
    roleBucket: 'executive',
    phone: '+91 98860 23456',
    location: 'Bangalore, India',
    status: 'replied',
    emailHealthStatus: 'valid',
    emailHealthScore: 95,
    consentStatus: 'confirmed',
    score: 92,
    scoreBand: 'hot',
    sourceBatch: 'batch-001',
    lastContactedAt: '2025-06-11T11:00:00Z',
    createdAt: '2025-05-20T14:05:00Z',
  },
  {
    id: 'cnt-003',
    companyId: 'cmp-002',
    name: 'Rohan Kulkarni',
    nameNormalized: 'rohan kulkarni',
    emailAddress: 'rohan.k@quantumleap.tech',
    linkedinUrl: 'https://linkedin.com/in/rohankulkarni',
    jobTitle: 'Director of IT',
    roleBucket: 'manager',
    phone: '+1 512-555-0142',
    location: 'Austin, TX',
    status: 'ready',
    emailHealthStatus: 'valid',
    emailHealthScore: 91,
    consentStatus: 'confirmed',
    score: 76,
    scoreBand: 'warm',
    sourceBatch: 'batch-002',
    lastContactedAt: null,
    createdAt: '2025-05-25T10:30:00Z',
  },
  {
    id: 'cnt-004',
    companyId: 'cmp-002',
    name: 'Sarah Mitchell',
    nameNormalized: 'sarah mitchell',
    emailAddress: 's.mitchell@quantumleap.tech',
    linkedinUrl: 'https://linkedin.com/in/sarahmitchell',
    jobTitle: 'CEO',
    roleBucket: 'executive',
    phone: '+1 512-555-0101',
    location: 'Austin, TX',
    status: 'drafted',
    emailHealthStatus: 'valid',
    emailHealthScore: 98,
    consentStatus: 'confirmed',
    score: 84,
    scoreBand: 'hot',
    sourceBatch: 'batch-002',
    lastContactedAt: null,
    createdAt: '2025-05-25T10:32:00Z',
  },
  {
    id: 'cnt-005',
    companyId: 'cmp-003',
    name: 'Vikram Nair',
    nameNormalized: 'vikram nair',
    emailAddress: 'vikram.n@zenithcloud.com',
    linkedinUrl: 'https://linkedin.com/in/vikramnair',
    jobTitle: 'Head of DevOps',
    roleBucket: 'manager',
    phone: '+91 99860 34567',
    location: 'Hyderabad, India',
    status: 'queued',
    emailHealthStatus: 'valid',
    emailHealthScore: 89,
    consentStatus: 'confirmed',
    score: 71,
    scoreBand: 'warm',
    sourceBatch: 'batch-002',
    lastContactedAt: null,
    createdAt: '2025-05-28T08:15:00Z',
  },
  {
    id: 'cnt-006',
    companyId: 'cmp-003',
    name: 'Amit Patel',
    nameNormalized: 'amit patel',
    emailAddress: 'a.patel@zenithcloud.com',
    linkedinUrl: null,
    jobTitle: 'Senior Cloud Architect',
    roleBucket: 'technical',
    phone: '+91 98765 45678',
    location: 'Hyderabad, India',
    status: 'ready',
    emailHealthStatus: 'risky',
    emailHealthScore: 58,
    consentStatus: 'unconfirmed',
    score: 55,
    scoreBand: 'cold',
    sourceBatch: 'batch-003',
    lastContactedAt: null,
    createdAt: '2025-06-01T12:00:00Z',
  },
  {
    id: 'cnt-007',
    companyId: 'cmp-004',
    name: 'Priya Deshpande',
    nameNormalized: 'priya deshpande',
    emailAddress: 'priya.d@fintechlabs.co',
    linkedinUrl: 'https://linkedin.com/in/priyadeshpande',
    jobTitle: 'Chief Data Officer',
    roleBucket: 'executive',
    phone: '+91 99100 56789',
    location: 'Mumbai, India',
    status: 'replied',
    emailHealthStatus: 'valid',
    emailHealthScore: 94,
    consentStatus: 'confirmed',
    score: 90,
    scoreBand: 'hot',
    sourceBatch: 'batch-001',
    lastContactedAt: '2025-06-09T16:45:00Z',
    createdAt: '2025-05-18T09:00:00Z',
  },
  {
    id: 'cnt-008',
    companyId: 'cmp-004',
    name: 'Rahul Verma',
    nameNormalized: 'rahul verma',
    emailAddress: 'rahul.v@fintechlabs.co',
    linkedinUrl: 'https://linkedin.com/in/rahulverma',
    jobTitle: 'Engineering Manager',
    roleBucket: 'manager',
    phone: '+91 98200 67890',
    location: 'Mumbai, India',
    status: 'sent',
    emailHealthStatus: 'valid',
    emailHealthScore: 86,
    consentStatus: 'confirmed',
    score: 68,
    scoreBand: 'warm',
    sourceBatch: 'batch-001',
    lastContactedAt: '2025-06-08T10:20:00Z',
    createdAt: '2025-05-18T09:05:00Z',
  },
  {
    id: 'cnt-009',
    companyId: 'cmp-005',
    name: 'Jessica Turner',
    nameNormalized: 'jessica turner',
    emailAddress: 'jessica.t@healthbridge.io',
    linkedinUrl: 'https://linkedin.com/in/jessicaturner',
    jobTitle: 'VP of Technology',
    roleBucket: 'executive',
    phone: '+1 617-555-0198',
    location: 'Boston, MA',
    status: 'drafted',
    emailHealthStatus: 'valid',
    emailHealthScore: 92,
    consentStatus: 'confirmed',
    score: 80,
    scoreBand: 'hot',
    sourceBatch: 'batch-003',
    lastContactedAt: null,
    createdAt: '2025-06-02T11:00:00Z',
  },
  {
    id: 'cnt-010',
    companyId: 'cmp-005',
    name: 'Dr. Sanjay Gupta',
    nameNormalized: 'sanjay gupta',
    emailAddress: 's.gupta@healthbridge.io',
    linkedinUrl: 'https://linkedin.com/in/drsanjaygupta',
    jobTitle: 'Chief Technology Officer',
    roleBucket: 'executive',
    phone: '+91 98100 78901',
    location: 'Boston, MA',
    status: 'bounced',
    emailHealthStatus: 'invalid',
    emailHealthScore: 12,
    consentStatus: 'unconfirmed',
    score: 45,
    scoreBand: 'cold',
    sourceBatch: 'batch-003',
    lastContactedAt: '2025-06-07T14:00:00Z',
    createdAt: '2025-06-02T11:05:00Z',
  },
  {
    id: 'cnt-011',
    companyId: 'cmp-006',
    name: 'Nisha Agarwal',
    nameNormalized: 'nisha agarwal',
    emailAddress: 'nisha.a@cyberguard.sec',
    linkedinUrl: 'https://linkedin.com/in/nishaagarwal',
    jobTitle: 'VP of Product',
    roleBucket: 'manager',
    phone: '+91 99010 89012',
    location: 'Pune, India',
    status: 'ready',
    emailHealthStatus: 'valid',
    emailHealthScore: 88,
    consentStatus: 'confirmed',
    score: 73,
    scoreBand: 'warm',
    sourceBatch: 'batch-004',
    lastContactedAt: null,
    createdAt: '2025-06-05T15:30:00Z',
  },
  {
    id: 'cnt-012',
    companyId: 'cmp-006',
    name: 'Tom Bradley',
    nameNormalized: 'tom bradley',
    emailAddress: 't.bradley@cyberguard.sec',
    linkedinUrl: 'https://linkedin.com/in/tombradley',
    jobTitle: 'Director of Engineering',
    roleBucket: 'manager',
    phone: '+1 415-555-0234',
    location: 'San Francisco, CA',
    status: 'imported',
    emailHealthStatus: 'unknown',
    emailHealthScore: 0,
    consentStatus: 'unconfirmed',
    score: 40,
    scoreBand: 'cold',
    sourceBatch: 'batch-004',
    lastContactedAt: null,
    createdAt: '2025-06-05T15:35:00Z',
  },
  {
    id: 'cnt-013',
    companyId: 'cmp-007',
    name: 'Ananya Krishnan',
    nameNormalized: 'ananya krishnan',
    emailAddress: 'ananya.k@logivista.in',
    linkedinUrl: 'https://linkedin.com/in/ananyakrishnan',
    jobTitle: 'Chief Technology Officer',
    roleBucket: 'executive',
    phone: '+91 97400 90123',
    location: 'Chennai, India',
    status: 'cleaned',
    emailHealthStatus: 'valid',
    emailHealthScore: 93,
    consentStatus: 'confirmed',
    score: 82,
    scoreBand: 'hot',
    sourceBatch: 'batch-004',
    lastContactedAt: null,
    createdAt: '2025-06-06T09:45:00Z',
  },
  {
    id: 'cnt-014',
    companyId: 'cmp-007',
    name: 'Karthik Sundaram',
    nameNormalized: 'karthik sundaram',
    emailAddress: 'karthik.s@logivista.in',
    linkedinUrl: null,
    jobTitle: 'IT Operations Lead',
    roleBucket: 'operations',
    phone: '+91 97890 01234',
    location: 'Chennai, India',
    status: 'cleaned',
    emailHealthStatus: 'valid',
    emailHealthScore: 85,
    consentStatus: 'confirmed',
    score: 52,
    scoreBand: 'cold',
    sourceBatch: 'batch-004',
    lastContactedAt: null,
    createdAt: '2025-06-06T09:50:00Z',
  },
  {
    id: 'cnt-015',
    companyId: 'cmp-008',
    name: 'Michael Chen',
    nameNormalized: 'michael chen',
    emailAddress: 'm.chen@dataweave.ai',
    linkedinUrl: 'https://linkedin.com/in/michaelchen',
    jobTitle: 'Co-founder & CEO',
    roleBucket: 'executive',
    phone: '+1 650-555-0345',
    location: 'San Jose, CA',
    status: 'suppressed',
    emailHealthStatus: 'valid',
    emailHealthScore: 96,
    consentStatus: 'confirmed',
    score: 78,
    scoreBand: 'warm',
    sourceBatch: 'batch-001',
    lastContactedAt: '2025-05-28T08:00:00Z',
    createdAt: '2025-05-15T10:00:00Z',
  },
  {
    id: 'cnt-016',
    companyId: 'cmp-008',
    name: 'Lisa Wong',
    nameNormalized: 'lisa wong',
    emailAddress: 'l.wong@dataweave.ai',
    linkedinUrl: 'https://linkedin.com/in/lisawong',
    jobTitle: 'Head of Data Engineering',
    roleBucket: 'manager',
    phone: '+1 650-555-0346',
    location: 'San Jose, CA',
    status: 'replied',
    emailHealthStatus: 'valid',
    emailHealthScore: 90,
    consentStatus: 'confirmed',
    score: 86,
    scoreBand: 'hot',
    sourceBatch: 'batch-001',
    lastContactedAt: '2025-06-12T10:30:00Z',
    createdAt: '2025-05-15T10:05:00Z',
  },
  {
    id: 'cnt-017',
    companyId: 'cmp-009',
    name: 'Rajesh Iyer',
    nameNormalized: 'rajesh iyer',
    emailAddress: 'rajesh.i@smartscalehq.com',
    linkedinUrl: 'https://linkedin.com/in/rajeshiyer',
    jobTitle: 'VP of Sales',
    roleBucket: 'sales',
    phone: '+91 98450 12346',
    location: 'Gurugram, India',
    status: 'archived',
    emailHealthStatus: 'risky',
    emailHealthScore: 45,
    consentStatus: 'unconfirmed',
    score: 30,
    scoreBand: 'cold',
    sourceBatch: 'batch-002',
    lastContactedAt: '2025-04-15T12:00:00Z',
    createdAt: '2025-03-20T08:00:00Z',
  },
  {
    id: 'cnt-018',
    companyId: 'cmp-009',
    name: 'Meera Joshi',
    nameNormalized: 'meera joshi',
    emailAddress: 'meera.j@smartscalehq.com',
    linkedinUrl: 'https://linkedin.com/in/meerajoshi',
    jobTitle: 'Director of Customer Success',
    roleBucket: 'manager',
    phone: '+91 99860 23457',
    location: 'Gurugram, India',
    status: 'sent',
    emailHealthStatus: 'valid',
    emailHealthScore: 87,
    consentStatus: 'confirmed',
    score: 64,
    scoreBand: 'warm',
    sourceBatch: 'batch-005',
    lastContactedAt: '2025-06-11T09:00:00Z',
    createdAt: '2025-06-08T14:20:00Z',
  },
];

// ── Companies ───────────────────────────────────────────────────────────
export type EmployeeSizeBand = '1-10' | '11-50' | '51-200' | '201-500' | '501-1000' | '1000+';

export interface Company {
  id: string;
  name: string;
  nameNormalized: string;
  domain: string;
  linkedinUrl: string | null;
  website: string;
  industry: string;
  employeeSizeBand: EmployeeSizeBand;
  location: string;
  researchSummary: string;
  painPoints: string[];
  opportunityHypotheses: string[];
  lastResearchedAt: string;
  contactCount: number;
}

export const MOCK_COMPANIES: Company[] = [
  {
    id: 'cmp-001',
    name: 'NexusCore Technologies',
    nameNormalized: 'nexuscore technologies',
    domain: 'nexuscore.io',
    linkedinUrl: 'https://linkedin.com/company/nexuscore-technologies',
    website: 'https://nexuscore.io',
    industry: 'Enterprise SaaS',
    employeeSizeBand: '201-500',
    location: 'Bangalore, India',
    researchSummary:
      'NexusCore builds a low-code enterprise integration platform that connects ERPs, CRMs, and custom apps. They recently closed a Series B of $28M and are aggressively expanding their engineering team to support multi-cloud deployment targets.',
    painPoints: [
      'Legacy on-prem customers demanding cloud migration paths',
      'Growing technical debt from rapid feature development',
      'Need for 99.99% uptime SLA to win enterprise deals',
    ],
    opportunityHypotheses: [
      'Cloud modernization engagement — help them migrate their own infra to AWS/GCP to dogfood their product',
      'Managed services for their smaller customers who lack DevOps teams',
    ],
    lastResearchedAt: '2025-06-10T14:00:00Z',
    contactCount: 2,
  },
  {
    id: 'cmp-002',
    name: 'QuantumLeap Tech',
    nameNormalized: 'quantumleap tech',
    domain: 'quantumleap.tech',
    linkedinUrl: 'https://linkedin.com/company/quantumleap-tech',
    website: 'https://quantumleap.tech',
    industry: 'AI/ML Platform',
    employeeSizeBand: '51-200',
    location: 'Austin, TX',
    researchSummary:
      'QuantumLeap provides an MLOps platform that helps data science teams deploy, monitor, and scale machine learning models in production. They serve fintech and healthcare verticals and are positioning for Series A fundraising.',
    painPoints: [
      'Model serving latency impacting real-time inference customers',
      'Data pipeline reliability — frequent ETL failures causing model drift',
      'Limited in-house SRE expertise to manage Kubernetes clusters',
    ],
    opportunityHypotheses: [
      'Data engineering engagement — build robust data pipelines with proper SLAs',
      'Managed Kubernetes / cloud infrastructure support',
    ],
    lastResearchedAt: '2025-06-09T10:00:00Z',
    contactCount: 2,
  },
  {
    id: 'cmp-003',
    name: 'ZenithCloud Solutions',
    nameNormalized: 'zenithcloud solutions',
    domain: 'zenithcloud.com',
    linkedinUrl: 'https://linkedin.com/company/zenithcloud-solutions',
    website: 'https://zenithcloud.com',
    industry: 'Cloud Services & Consulting',
    employeeSizeBand: '501-1000',
    location: 'Hyderabad, India',
    researchSummary:
      'ZenithCloud is a mid-tier cloud consulting firm that specializes in AWS and Azure migrations for mid-market enterprises in India and Southeast Asia. They are building an internal tooling platform to automate migration assessments.',
    painPoints: [
      'Manual migration assessment process is slow and error-prone',
      'Talent retention — senior architects frequently poached by hyperscalers',
      'Need to differentiate from commoditized lift-and-shift offerings',
    ],
    opportunityHypotheses: [
      'Application support / managed services partnership for post-migration work',
      'Cybersecurity assessment add-on to their cloud migration packages',
    ],
    lastResearchedAt: '2025-06-08T16:30:00Z',
    contactCount: 2,
  },
  {
    id: 'cmp-004',
    name: 'FinTech Labs',
    nameNormalized: 'fintech labs',
    domain: 'fintechlabs.co',
    linkedinUrl: 'https://linkedin.com/company/fintech-labs',
    website: 'https://fintechlabs.co',
    industry: 'Financial Technology',
    employeeSizeBand: '201-500',
    location: 'Mumbai, India',
    researchSummary:
      'FinTech Labs operates a digital lending platform serving NBFCs and small finance banks in India. They process over 2M loan applications monthly and are investing heavily in real-time fraud detection and credit scoring models.',
    painPoints: [
      'Regulatory compliance overhead for RBI data localization requirements',
      'Scaling real-time data pipelines for fraud detection at 2M+ events/day',
      'Legacy monolith backend causing deployment bottlenecks',
    ],
    opportunityHypotheses: [
      'Data engineering — modernize their event streaming architecture for real-time fraud detection',
      'Application modernization — break down monolith into microservices for faster releases',
      'Cybersecurity — SOC and pen-testing for PCI-DSS compliance',
    ],
    lastResearchedAt: '2025-06-09T12:00:00Z',
    contactCount: 2,
  },
  {
    id: 'cmp-005',
    name: 'HealthBridge Digital',
    nameNormalized: 'healthbridge digital',
    domain: 'healthbridge.io',
    linkedinUrl: 'https://linkedin.com/company/healthbridge-digital',
    website: 'https://healthbridge.io',
    industry: 'Healthcare Technology',
    employeeSizeBand: '51-200',
    location: 'Boston, MA',
    researchSummary:
      'HealthBridge provides a HIPAA-compliant patient engagement and telehealth platform used by 150+ clinics across the US. They are expanding into remote patient monitoring and need robust data infrastructure to handle wearable device data streams.',
    painPoints: [
      'HIPAA compliance complexity when integrating with third-party health data providers',
      'Data silos between EHR systems and their engagement platform',
      'Need to scale infrastructure to support remote monitoring data ingestion',
    ],
    opportunityHypotheses: [
      'Data engineering — build HIPAA-compliant data lake for patient analytics',
      'Cloud modernization — migrate from self-hosted to a compliant cloud environment',
      'Cybersecurity — HIPAA security assessment and ongoing compliance monitoring',
    ],
    lastResearchedAt: '2025-06-07T09:00:00Z',
    contactCount: 2,
  },
  {
    id: 'cmp-006',
    name: 'CyberGuard Security',
    nameNormalized: 'cyberguard security',
    domain: 'cyberguard.sec',
    linkedinUrl: 'https://linkedin.com/company/cyberguard-security',
    website: 'https://cyberguard.sec',
    industry: 'Cybersecurity',
    employeeSizeBand: '51-200',
    location: 'Pune, India & San Francisco, CA',
    researchSummary:
      'CyberGuard offers a cloud-native SIEM and SOAR platform targeting mid-market enterprises. They compete with legacy SIEM vendors by offering faster deployment and lower TCO through a SaaS model.',
    painPoints: [
      'High customer churn due to alert fatigue from noisy detection rules',
      'Need for more integrations with cloud-native services (AWS GuardDuty, GCP SCC)',
      'Scaling their own SaaS infrastructure to handle 10x log volume growth',
    ],
    opportunityHypotheses: [
      'Managed services — offer 24/7 SOC as a service to their customers',
      'Cloud modernization — help them optimize their own multi-tenant SaaS architecture',
    ],
    lastResearchedAt: '2025-06-06T11:00:00Z',
    contactCount: 2,
  },
  {
    id: 'cmp-007',
    name: 'LogiVista',
    nameNormalized: 'logivista',
    domain: 'logivista.in',
    linkedinUrl: 'https://linkedin.com/company/logivista',
    website: 'https://logivista.in',
    industry: 'Logistics & Supply Chain',
    employeeSizeBand: '1000+',
    location: 'Chennai, India',
    researchSummary:
      'LogiVista is one of India\'s largest third-party logistics providers with operations across 200+ cities. They are undergoing a digital transformation to build a unified supply chain visibility platform and replace legacy TMS/WMS systems.',
    painPoints: [
      'Fragmented tech stack — 12+ disparate systems across warehouses and transport',
      'Real-time tracking requirements from enterprise customers like Amazon and Flipkart',
      'Severe talent gap for building modern engineering teams in tier-2 cities',
    ],
    opportunityHypotheses: [
      'Digital transformation — build unified supply chain platform on cloud-native stack',
      'Application support — manage and maintain their transition from legacy systems',
      'Data engineering — build real-time analytics for supply chain optimization',
    ],
    lastResearchedAt: '2025-06-05T14:00:00Z',
    contactCount: 2,
  },
  {
    id: 'cmp-008',
    name: 'DataWeave AI',
    nameNormalized: 'dataweave ai',
    domain: 'dataweave.ai',
    linkedinUrl: 'https://linkedin.com/company/dataweave-ai',
    website: 'https://dataweave.ai',
    industry: 'Data & Analytics',
    employeeSizeBand: '11-50',
    location: 'San Jose, CA',
    researchSummary:
      'DataWeave AI provides an AI-powered competitive intelligence platform that scrapes, structures, and analyzes competitor pricing and product data for e-commerce brands. They process petabytes of web data daily.',
    painPoints: [
      'Data quality issues from web scraping at scale — broken parsers, proxy failures',
      'Cost of cloud compute for large-scale data processing is eating into margins',
      'Need to build self-serve analytics layer for non-technical customers',
    ],
    opportunityHypotheses: [
      'Data engineering — optimize their data pipelines for cost and reliability',
      'Application support — help maintain and evolve their core processing engine',
    ],
    lastResearchedAt: '2025-06-04T10:00:00Z',
    contactCount: 2,
  },
  {
    id: 'cmp-009',
    name: 'SmartScale HQ',
    nameNormalized: 'smartscale hq',
    domain: 'smartscalehq.com',
    linkedinUrl: 'https://linkedin.com/company/smartscale-hq',
    website: 'https://smartscalehq.com',
    industry: 'Revenue Intelligence',
    employeeSizeBand: '51-200',
    location: 'Gurugram, India',
    researchSummary:
      'SmartScale HQ offers a revenue intelligence and sales enablement platform for B2B SaaS companies. They integrate with Salesforce, HubSpot, and Gong to provide pipeline analytics and forecast accuracy improvements.',
    painPoints: [
      'Integration reliability — frequent sync failures with CRM partners',
      'Customer onboarding is manual and takes 3-4 weeks on average',
      'Competitive pressure from Clari and Gong entering their market segment',
    ],
    opportunityHypotheses: [
      'Application support — dedicated team for integration reliability and customer onboarding',
      'Cloud modernization — refactor their monolithic API layer into microservices',
    ],
    lastResearchedAt: '2025-06-03T09:00:00Z',
    contactCount: 2,
  },
];

// ── Ingestion Batches ──────────────────────────────────────────────────
export type BatchStatus = 'staged' | 'reviewing' | 'committed' | 'archived';

export interface IngestionBatch {
  id: string;
  fileName: string;
  fileHash: string;
  profileName: string;
  uploadedBy: string;
  status: BatchStatus;
  totalRows: number;
  acceptedRows: number;
  duplicateRows: number;
  invalidRows: number;
  createdAt: string;
}

export const MOCK_BATCHES: IngestionBatch[] = [
  {
    id: 'batch-001',
    fileName: 'enterprise_saas_leads_may2025.csv',
    fileHash: 'sha256:a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
    profileName: 'Standard Lead Import',
    uploadedBy: 'Ravi Shanker',
    status: 'committed',
    totalRows: 450,
    acceptedRows: 412,
    duplicateRows: 23,
    invalidRows: 15,
    createdAt: '2025-05-20T13:00:00Z',
  },
  {
    id: 'batch-002',
    fileName: 'us_midmarket_tech_leads.csv',
    fileHash: 'sha256:b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
    profileName: 'Standard Lead Import',
    uploadedBy: 'Ravi Shanker',
    status: 'committed',
    totalRows: 680,
    acceptedRows: 634,
    duplicateRows: 28,
    invalidRows: 18,
    createdAt: '2025-05-25T09:30:00Z',
  },
  {
    id: 'batch-003',
    fileName: 'healthcare_tech_q2_outreach.csv',
    fileHash: 'sha256:c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5',
    profileName: 'Healthcare Vertical Import',
    uploadedBy: 'Anita Krishnamurthy',
    status: 'committed',
    totalRows: 320,
    acceptedRows: 298,
    duplicateRows: 12,
    invalidRows: 10,
    createdAt: '2025-06-02T10:00:00Z',
  },
  {
    id: 'batch-004',
    fileName: 'india_enterprise_june2025.csv',
    fileHash: 'sha256:d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6',
    profileName: 'Standard Lead Import',
    uploadedBy: 'Ravi Shanker',
    status: 'reviewing',
    totalRows: 520,
    acceptedRows: 0,
    duplicateRows: 0,
    invalidRows: 0,
    createdAt: '2025-06-05T14:00:00Z',
  },
  {
    id: 'batch-005',
    fileName: 'sdr_manual_additions_june.csv',
    fileHash: 'sha256:e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1',
    profileName: 'SDR Quick Add',
    uploadedBy: 'Priti Sahoo',
    status: 'staged',
    totalRows: 85,
    acceptedRows: 0,
    duplicateRows: 0,
    invalidRows: 0,
    createdAt: '2025-06-08T16:00:00Z',
  },
];

// ── Company Notes ──────────────────────────────────────────────────────
export interface CompanyNote {
  id: string;
  companyId: string;
  body: string;
  noteType: 'call' | 'meeting' | 'email' | 'note' | 'research';
  createdAt: string;
}

export const MOCK_COMPANY_NOTES: CompanyNote[] = [
  {
    id: 'cnote-001',
    companyId: 'cmp-001',
    body: 'Arjun mentioned they are evaluating 3 vendors for their cloud migration initiative. They need multi-cloud support and 99.99% uptime SLAs.',
    noteType: 'meeting',
    createdAt: '2025-06-08T14:30:00Z',
  },
  {
    id: 'cnote-002',
    companyId: 'cmp-001',
    body: 'CTO prefers detailed technical architecture docs over marketing decks. Send our AWS/GCP migration whitepaper before the next call.',
    noteType: 'note',
    createdAt: '2025-06-09T09:15:00Z',
  },
  {
    id: 'cnote-003',
    companyId: 'cmp-004',
    body: 'RBI data localization compliance is a major pain point. Their current on-prem setup cannot scale to 2M+ events/day. This is a strong entry point.',
    noteType: 'research',
    createdAt: '2025-06-07T16:00:00Z',
  },
  {
    id: 'cnote-004',
    companyId: 'cmp-003',
    body: 'ZenithCloud is losing deals to larger players. They need a differentiator — managed services post-migration could be it.',
    noteType: 'call',
    createdAt: '2025-06-06T11:00:00Z',
  },
  {
    id: 'cnote-005',
    companyId: 'cmp-003',
    body: 'Competitive intel: Infosys and TCS are aggressively targeting the same mid-market segment in India. ZenithCloud needs to move fast.',
    noteType: 'research',
    createdAt: '2025-06-09T10:30:00Z',
  },
  {
    id: 'cnote-006',
    companyId: 'cmp-002',
    body: 'QuantumLeap\'s MLOps platform has strong product-market fit but their infra team is only 4 people. Managed K8s support could be a quick win.',
    noteType: 'meeting',
    createdAt: '2025-06-09T15:00:00Z',
  },
  {
    id: 'cnote-007',
    companyId: 'cmp-005',
    body: 'HealthTech Plus is facing pressure from hospital procurement committees to demonstrate ROI on their platform. Case study with measurable outcomes would help.',
    noteType: 'note',
    createdAt: '2025-06-10T09:00:00Z',
  },
];

// ── Capability Assets ───────────────────────────────────────────────────
export type AssetCategory = 'service_line' | 'case_study' | 'proof_point' | 'objection_response' | 'cta';

export interface CapabilityAsset {
  id: string;
  title: string;
  summary: string;
  category: AssetCategory;
  serviceLine: string;
  targetIndustries: string[];
  targetRoles: string[];
  problems: string[];
  supportingEvidence: string;
  isActive: boolean;
  version: number;
}

export const MOCK_CAPABILITIES: CapabilityAsset[] = [
  {
    id: 'cap-001',
    title: 'Cloud Modernization',
    summary:
      'End-to-end migration of legacy on-premises workloads to AWS, Azure, or GCP. We handle assessment, re-architecting, migration execution, and post-migration optimization with zero-downtime strategies for mission-critical systems.',
    category: 'service_line',
    serviceLine: 'Cloud Modernization',
    targetIndustries: ['Enterprise SaaS', 'Financial Technology', 'Healthcare Technology', 'Logistics & Supply Chain'],
    targetRoles: ['CTO', 'VP of Engineering', 'Head of DevOps', 'Director of IT', 'Cloud Architect'],
    problems: [
      'High infrastructure costs from on-premises data centers',
      'Slow time-to-market due to manual provisioning',
      'Inability to scale elastically for variable workloads',
      'Compliance requirements for data residency',
    ],
    supportingEvidence:
      'Migrated 40+ enterprise workloads for a $500M logistics company, reducing infrastructure costs by 62% and improving deployment frequency from monthly to daily. AWS Advanced Partner with 15 certified architects.',
    isActive: true,
    version: 3,
  },
  {
    id: 'cap-002',
    title: 'Application Support & Managed Services',
    summary:
      '24/7 production support with SLA-backed response times, proactive monitoring, and incident management. Our dedicated pods take ownership of application stability so your engineers can focus on building features, not fighting fires.',
    category: 'service_line',
    serviceLine: 'Application Support',
    targetIndustries: ['Enterprise SaaS', 'AI/ML Platform', 'Revenue Intelligence', 'Data & Analytics'],
    targetRoles: ['VP of Engineering', 'CTO', 'Engineering Manager', 'Director of Customer Success'],
    problems: [
      'Engineering team spending 40%+ time on production issues',
      'No 24/7 coverage — late-night incidents go unattended',
      'High MTTR due to lack of runbooks and tribal knowledge',
      'Customer-facing SLAs at risk due to frequent outages',
    ],
    supportingEvidence:
      'Managing production for 6 SaaS companies with a combined 99.97% uptime. Average MTTR reduced from 4 hours to 22 minutes. Zero missed SLA penalties in the last 18 months.',
    isActive: true,
    version: 2,
  },
  {
    id: 'cap-003',
    title: 'Data Engineering & Analytics',
    summary:
      'Design and build modern data platforms using cloud-native tools like Snowflake, dbt, Apache Kafka, and Airflow. We create reliable data pipelines, build data lakes/warehouses, and deliver self-serve analytics that drive business decisions.',
    category: 'service_line',
    serviceLine: 'Data Engineering',
    targetIndustries: ['Financial Technology', 'Healthcare Technology', 'AI/ML Platform', 'Data & Analytics', 'Logistics & Supply Chain'],
    targetRoles: ['Chief Data Officer', 'CTO', 'Head of Data Engineering', 'VP of Technology', 'Director of Engineering'],
    problems: [
      'Data silos preventing unified customer view',
      'ETL pipelines failing frequently causing stale data',
      'Analysts waiting days for data engineering requests',
      'Compliance requirements for data lineage and governance',
    ],
    supportingEvidence:
      'Built a real-time fraud detection pipeline processing 2M+ events/day for a fintech client, reducing fraud losses by 34%. Migrated a healthcare company from on-prem Oracle to Snowflake, cutting query costs by 80%.',
    isActive: true,
    version: 4,
  },
  {
    id: 'cap-004',
    title: 'Cybersecurity Services',
    summary:
      'Comprehensive cybersecurity including SOC-as-a-Service, vulnerability assessments, penetration testing, cloud security posture management, and compliance automation (SOC 2, HIPAA, PCI-DSS, RBI). We help you build a security-first culture.',
    category: 'service_line',
    serviceLine: 'Cybersecurity',
    targetIndustries: ['Financial Technology', 'Healthcare Technology', 'Cybersecurity', 'Enterprise SaaS'],
    targetRoles: ['CTO', 'CISO', 'VP of Engineering', 'Chief Data Officer', 'Director of IT'],
    problems: [
      'Increasing cyber threats and ransomware attacks',
      'Compliance requirements (SOC 2, HIPAA, PCI-DSS) without in-house expertise',
      'Alert fatigue from noisy security tools',
      'Cloud misconfigurations exposing sensitive data',
    ],
    supportingEvidence:
      'SOC team handles 50K+ alerts/month for 12 clients, with a 98% false-positive reduction rate. Completed SOC 2 Type II certification for 8 startups in under 90 days each. Detected and contained a ransomware attack in under 15 minutes.',
    isActive: true,
    version: 2,
  },
  {
    id: 'cap-005',
    title: 'Digital Transformation',
    summary:
      'Strategic technology consulting combined with hands-on execution to modernize your entire technology landscape. From legacy monolith decomposition to API-first architecture, we help you build for the next decade of growth.',
    category: 'service_line',
    serviceLine: 'Digital Transformation',
    targetIndustries: ['Logistics & Supply Chain', 'Financial Technology', 'Healthcare Technology', 'Enterprise SaaS'],
    targetRoles: ['CEO', 'CTO', 'Chief Digital Officer', 'VP of Engineering', 'CFO'],
    problems: [
      'Legacy monolithic systems preventing agile development',
      'Manual processes slowing down operations at scale',
      'Digital customer experience lagging behind competitors',
      'Fragmented tech stack from M&A activity',
    ],
    supportingEvidence:
      'Helped a 200-city logistics company replace 12 legacy systems with a unified cloud platform, reducing order processing time from 4 hours to 12 minutes. The transformation was completed in 14 months with zero business disruption.',
    isActive: true,
    version: 3,
  },
  {
    id: 'cap-006',
    title: 'FinTech Labs — Real-Time Fraud Detection Pipeline',
    summary:
      'Case study: Built a real-time data pipeline for FinTech Labs processing 2M+ loan applications monthly. Implemented Kafka-based event streaming with Flink for real-time fraud scoring, reducing fraud losses by 34% and false positives by 28%.',
    category: 'case_study',
    serviceLine: 'Data Engineering',
    targetIndustries: ['Financial Technology'],
    targetRoles: ['CTO', 'Chief Data Officer', 'VP of Engineering'],
    problems: ['Real-time fraud detection at scale', 'Reducing false positives in ML models', 'Event streaming architecture'],
    supportingEvidence:
      'Client testimonial: "The new pipeline processes applications 5x faster and our fraud catch rate improved from 72% to 94%." — Priya Deshpande, CDO, FinTech Labs',
    isActive: true,
    version: 1,
  },
  {
    id: 'cap-007',
    title: 'NexusCore — Zero-Downtime Cloud Migration',
    summary:
      'Case study: Migrated NexusCore\'s core integration platform from bare-metal to AWS EKS with blue-green deployment strategies. Achieved zero downtime during 3-month migration, cut infra costs by 45%, and improved auto-scaling response from 15 minutes to 90 seconds.',
    category: 'case_study',
    serviceLine: 'Cloud Modernization',
    targetIndustries: ['Enterprise SaaS'],
    targetRoles: ['CTO', 'VP of Engineering', 'Head of DevOps'],
    problems: ['Zero-downtime migration', 'Cost optimization', 'Kubernetes orchestration'],
    supportingEvidence:
      'Client testimonial: "We were terrified of migrating our production workload. The team made it look easy — our customers didn\'t notice a thing." — Deepika Rao, CTO, NexusCore',
    isActive: true,
    version: 1,
  },
  {
    id: 'cap-008',
    title: 'Objection: "We already have an internal team for this"',
    summary:
      'Position our engagement as capacity augmentation and specialist expertise, not replacement. Internal teams often lack bandwidth for transformational projects or deep expertise in niche areas. We complement their work, not compete with it.',
    category: 'objection_response',
    serviceLine: 'General',
    targetIndustries: [],
    targetRoles: ['CTO', 'VP of Engineering'],
    problems: ['Resistance to outsourcing', 'Internal team concerns', 'Control and visibility'],
    supportingEvidence:
      '72% of our engagements start as staff augmentation and evolve into strategic partnerships. We provide full visibility through daily standups, sprint reviews, and shared Slack channels. Your team leads, our team executes.',
    isActive: true,
    version: 2,
  },
  {
    id: 'cap-009',
    title: 'Objection: "Your pricing seems high compared to freelancers/offshore agencies"',
    summary:
      'Reframe the conversation from cost to value and risk. The true cost of cheap engineering includes rework, missed deadlines, security incidents, and knowledge drain. Our rates reflect certified architects, proven processes, and SLA-backed delivery.',
    category: 'objection_response',
    serviceLine: 'General',
    targetIndustries: [],
    targetRoles: ['CEO', 'CTO', 'CFO'],
    problems: ['Budget constraints', 'Price sensitivity', 'ROI justification'],
    supportingEvidence:
      'Our average engagement delivers 3-4x ROI within 12 months. A $200K cloud migration engagement typically saves $120-150K annually in infrastructure costs alone. We\'ve never lost a client due to quality issues.',
    isActive: true,
    version: 1,
  },
  {
    id: 'cap-010',
    title: 'CTA: Technical Architecture Review',
    summary:
      'Offer a complimentary 60-minute technical architecture review where our senior architect reviews your current setup, identifies 3-5 quick wins, and presents a high-level modernization roadmap. Low-commitment entry point that builds trust.',
    category: 'cta',
    serviceLine: 'General',
    targetIndustries: [],
    targetRoles: ['CTO', 'VP of Engineering', 'Head of DevOps', 'Director of IT'],
    problems: [],
    supportingEvidence:
      '68% of architecture reviews convert to paid engagements within 60 days. Average deal size from review conversions is $180K. Takes only 2 hours of client time for the discovery call and review session.',
    isActive: true,
    version: 2,
  },
];

// ── Drafts ──────────────────────────────────────────────────────────────
export type DraftStatus = 'generated' | 'reviewed' | 'approved' | 'rejected';

export interface Draft {
  id: string;
  contactId: string;
  companyId: string;
  subject: string;
  body: string;
  cta: string;
  confidenceScore: number;
  status: DraftStatus;
  sourceSnippets: string[];
  assumptionFlags: string[];
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export const MOCK_DRAFTS: Draft[] = [
  {
    id: 'dft-001',
    contactId: 'cnt-001',
    companyId: 'cmp-001',
    subject: 'Zero-downtime cloud migration — what NexusCore could look like on EKS',
    body: `Hi Arjun,

I've been following NexusCore's growth trajectory, and congratulations on the Series B — that's a strong signal in this market.

I noticed your engineering team has been posting about containerization challenges, particularly around migrating your on-prem integration brokers. We recently helped a similar-sized SaaS platform (200+ customers, 99.95% SLA requirement) move their entire middleware layer to AWS EKS with zero customer-facing downtime. The migration cut their infra costs by 45% and improved their deployment cadence from monthly to multiple times per week.

The key was a blue-green strategy with automated rollback — something that took us about 3 months end to end, with their team fully trained on Day 1 operations before we handed off.

Would a 30-minute technical architecture review be useful? I'd love to show you the approach and see if it maps to NexusCore's situation.`,
    cta: 'Would a 30-minute technical architecture review be useful?',
    confidenceScore: 87,
    status: 'approved',
    sourceSnippets: ['Cloud Modernization', 'NexusCore — Zero-Downtime Cloud Migration'],
    assumptionFlags: ['Assumed containerization is a priority based on job postings', 'Assumed AWS is their target cloud'],
    reviewedBy: 'Ravi Shanker',
    reviewedAt: '2025-06-10T10:00:00Z',
    createdAt: '2025-06-10T08:30:00Z',
  },
  {
    id: 'dft-002',
    contactId: 'cnt-004',
    companyId: 'cmp-002',
    subject: 'Data pipeline reliability for MLOps at scale',
    body: `Hi Sarah,

QuantumLeap's position in the MLOps space is impressive — the work your team has done on model versioning is genuinely ahead of the curve.

I wanted to share something relevant: we recently built a real-time data pipeline for a fintech company processing 2M+ events daily. They had the same challenge — ETL reliability was causing model drift and their data science team was spending more time fixing pipelines than building models. We implemented a Kafka + Flink architecture with automated data quality checks that brought their pipeline reliability from 94% to 99.7%.

For an MLOps platform, data pipeline reliability isn't just an ops concern — it directly impacts model quality and, by extension, customer trust. I'd guess this is top of mind for QuantumLeap as you prep for Series A.

Would it be worth a quick conversation to explore whether this approach could strengthen your data layer?`,
    cta: 'Would it be worth a quick conversation to explore whether this approach could strengthen your data layer?',
    confidenceScore: 82,
    status: 'reviewed',
    sourceSnippets: ['Data Engineering & Analytics', 'FinTech Labs — Real-Time Fraud Detection Pipeline'],
    assumptionFlags: ['Assumed ETL reliability is a pain point based on industry patterns', 'Assumed Series A preparation is current'],
    reviewedBy: null,
    reviewedAt: null,
    createdAt: '2025-06-11T14:00:00Z',
  },
  {
    id: 'dft-003',
    contactId: 'cnt-007',
    companyId: 'cmp-004',
    subject: 'Real-time fraud detection at 2M+ applications/month — our approach',
    body: `Hi Priya,

FinTech Labs is doing something that very few companies in India have pulled off — processing 2M+ loan applications monthly with real-time decisioning. That's infrastructure that most teams would struggle to build and maintain.

We specialize in exactly this kind of high-throughput data engineering. Our team recently architected a Kafka-based event streaming system with sub-100ms latency for a similar-scale financial services client. The system handles 2.5M events/day with 99.97% uptime, and importantly, it reduced their fraud detection false positives by 28% — which means fewer legitimate customers getting blocked.

Given FinTech Labs' scale and RBI's increasing focus on real-time fraud monitoring, I think there could be a meaningful conversation here about strengthening your data layer. Happy to share the architecture blueprint — no strings attached.`,
    cta: 'Happy to share the architecture blueprint — no strings attached.',
    confidenceScore: 91,
    status: 'approved',
    sourceSnippets: ['Data Engineering & Analytics', 'FinTech Labs — Real-Time Fraud Detection Pipeline'],
    assumptionFlags: ['Assumed current fraud detection has false positive issues', 'Assumed Kafka is not yet in use or needs optimization'],
    reviewedBy: 'Anita Krishnamurthy',
    reviewedAt: '2025-06-09T15:00:00Z',
    createdAt: '2025-06-09T13:00:00Z',
  },
  {
    id: 'dft-004',
    contactId: 'cnt-009',
    companyId: 'cmp-005',
    subject: 'HIPAA-compliant data infrastructure for remote patient monitoring',
    body: `Hi Jessica,

HealthBridge's expansion into remote patient monitoring is a smart move — the market is accelerating and you're well-positioned with your existing clinic relationships.

The data infrastructure challenge here is significant though. Wearable device data streams create a completely different scale and compliance requirement compared to your current engagement platform. We've helped healthcare companies build HIPAA-compliant data lakes on AWS (using their BAA-covered services) that handle exactly this — continuous ingestion from IoT devices with proper encryption, audit logging, and data retention policies.

One client went from struggling with 50GB/day of device data to smoothly processing 200GB/day with automated quality checks and a self-serve analytics layer for their clinical team.

I'd love to understand HealthBridge's current data architecture and see if there's a fit. A 30-minute technical review might surface some quick wins.`,
    cta: 'A 30-minute technical review might surface some quick wins.',
    confidenceScore: 78,
    status: 'generated',
    sourceSnippets: ['Cloud Modernization', 'Data Engineering & Analytics', 'Cybersecurity Services'],
    assumptionFlags: ['Assumed HIPAA compliance is a current challenge', 'Assumed current infrastructure cannot handle device data scale'],
    reviewedBy: null,
    reviewedAt: null,
    createdAt: '2025-06-12T09:00:00Z',
  },
  {
    id: 'dft-005',
    contactId: 'cnt-005',
    companyId: 'cmp-003',
    subject: `Complementing ZenithCloud's migration business with managed services`,
    body: `Hi Vikram,

ZenithCloud has built a solid reputation in the AWS/Azure migration space, especially in the mid-market segment in India and Southeast Asia.

Here's something I've been thinking about: most of your migration customers probably ask the same question post-migration — "Now who manages this?" That's the gap we fill. We provide 24/7 production support and managed services specifically for companies that have recently migrated to cloud. Our SLA-backed pods take over operational ownership so your clients don't need to build their own SRE teams.

We've been doing this for 6 SaaS companies and maintaining 99.97% uptime across all of them. It could be a natural extension of ZenithCloud's offerings — you migrate, we manage. A partnership model that adds recurring revenue without diluting your core migration expertise.

Worth exploring over a call?`,
    cta: 'Worth exploring over a call?',
    confidenceScore: 74,
    status: 'rejected',
    sourceSnippets: ['Application Support & Managed Services'],
    assumptionFlags: ['Assumed customers ask for post-migration support', 'Assumed partnership model would be of interest'],
    reviewedBy: 'Ravi Shanker',
    reviewedAt: '2025-06-08T16:00:00Z',
    createdAt: '2025-06-08T14:30:00Z',
  },
  {
    id: 'dft-006',
    contactId: 'cnt-016',
    companyId: 'cmp-008',
    subject: 'Optimizing data pipeline costs without sacrificing reliability',
    body: `Hi Lisa,

DataWeave's ability to process petabytes of web data daily is technically impressive — not many companies operate at that scale.

I wanted to reach out because we've been working with data-intensive companies on a specific problem: reducing cloud compute costs for large-scale data processing without sacrificing pipeline reliability. For one client, we optimized their Spark and Airflow infrastructure to cut compute costs by 35% while actually improving pipeline SLAs from 96% to 99.5%.

At petabyte scale, even a 10-15% cost reduction is material — and at your growth stage, compute efficiency directly impacts margins and runway.

Would a technical review of your current pipeline architecture be worthwhile? We can usually identify quick wins in the first session.`,
    cta: 'Would a technical review of your current pipeline architecture be worthwhile?',
    confidenceScore: 80,
    status: 'generated',
    sourceSnippets: ['Data Engineering & Analytics'],
    assumptionFlags: ['Assumed cloud compute costs are a concern at petabyte scale', 'Assumed pipeline optimization is relevant'],
    reviewedBy: null,
    reviewedAt: null,
    createdAt: '2025-06-12T11:00:00Z',
  },
];

// ── Outbound Messages ───────────────────────────────────────────────────
export type MessageStatus = 'queued' | 'sent' | 'failed' | 'paused';
export type DeliveryMode = 'production' | 'dry_run';

export interface OutboundMessage {
  id: string;
  draftId: string;
  contactId: string;
  status: MessageStatus;
  scheduledFor: string | null;
  sentAt: string | null;
  deliveryMode: DeliveryMode;
}

export const MOCK_OUTBOUND_MESSAGES: OutboundMessage[] = [
  {
    id: 'msg-001',
    draftId: 'dft-001',
    contactId: 'cnt-001',
    status: 'sent',
    scheduledFor: '2025-06-10T09:30:00Z',
    sentAt: '2025-06-10T09:30:12Z',
    deliveryMode: 'production',
  },
  {
    id: 'msg-002',
    draftId: 'dft-003',
    contactId: 'cnt-007',
    status: 'sent',
    scheduledFor: '2025-06-09T16:00:00Z',
    sentAt: '2025-06-09T16:00:08Z',
    deliveryMode: 'production',
  },
  {
    id: 'msg-003',
    draftId: 'dft-002',
    contactId: 'cnt-004',
    status: 'queued',
    scheduledFor: '2025-06-13T10:00:00Z',
    sentAt: null,
    deliveryMode: 'production',
  },
  {
    id: 'msg-004',
    draftId: 'dft-005',
    contactId: 'cnt-005',
    status: 'failed',
    scheduledFor: '2025-06-09T09:00:00Z',
    sentAt: null,
    deliveryMode: 'production',
  },
  {
    id: 'msg-005',
    draftId: 'dft-006',
    contactId: 'cnt-016',
    status: 'queued',
    scheduledFor: '2025-06-13T14:00:00Z',
    sentAt: null,
    deliveryMode: 'dry_run',
  },
];

// ── Inbound Replies ─────────────────────────────────────────────────────
export type ReplyClassification =
  | 'positive_interest'
  | 'negative_interest'
  | 'out_of_office'
  | 'neutral'
  | 'unknown_requires_review';

export interface InboundReply {
  id: string;
  contactId: string;
  companyId: string;
  subject: string;
  body: string;
  classification: ReplyClassification;
  receivedAt: string;
}

export const MOCK_REPLIES: InboundReply[] = [
  {
    id: 'rpl-001',
    contactId: 'cnt-002',
    companyId: 'cmp-001',
    subject: 'Re: Zero-downtime cloud migration — what NexusCore could look like on EKS',
    body: `Hi Ravi,

Thanks for the note — Arjun forwarded this to me. We're actually in the middle of evaluating our containerization strategy right now, so the timing is good.

I'd be interested in the architecture review you mentioned. Can you share some more details on what that looks like? We're particularly keen on understanding the blue-green approach and how you handled stateful services.

Let's aim for next week — I'm free Tuesday or Thursday afternoon IST.

Best,
Deepika`,
    classification: 'positive_interest',
    receivedAt: '2025-06-11T11:00:00Z',
  },
  {
    id: 'rpl-002',
    contactId: 'cnt-007',
    companyId: 'cmp-004',
    subject: 'Re: Real-time fraud detection at 2M+ applications/month — our approach',
    body: `Hi,

This is interesting. We're currently using a mix of RabbitMQ and batch processing, and you're right that we're feeling the pain at scale.

I'd like to see the architecture blueprint you mentioned. Can you send it over? Also, what's your typical engagement model — fixed scope or T&M?

Regards,
Priya`,
    classification: 'positive_interest',
    receivedAt: '2025-06-09T16:45:00Z',
  },
  {
    id: 'rpl-003',
    contactId: 'cnt-016',
    companyId: 'cmp-008',
    subject: 'Out of Office: Michael Chen',
    body: `Thank you for your email. I am currently out of the office and will return on Monday, June 16th. For urgent matters, please contact Lisa Wong at l.wong@dataweave.ai.

Best regards,
Michael Chen
Co-founder & CEO, DataWeave AI`,
    classification: 'out_of_office',
    receivedAt: '2025-05-29T08:15:00Z',
  },
  {
    id: 'rpl-004',
    contactId: 'cnt-008',
    companyId: 'cmp-004',
    subject: 'Re: Follow-up: Data engineering for FinTech Labs',
    body: `Hi,

Thanks for following up. We've decided to go with a different vendor for this particular project. We appreciate the time you took to put together the proposal.

Best of luck,
Rahul`,
    classification: 'negative_interest',
    receivedAt: '2025-06-10T07:30:00Z',
  },
];

// ── Bounce Events ───────────────────────────────────────────────────────
export type BounceType = 'hard' | 'soft';

export interface BounceEvent {
  id: string;
  contactId: string;
  outboundMessageId: string | null;
  bounceType: BounceType;
  reason: string;
  receivedAt: string;
}

export const MOCK_BOUNCES: BounceEvent[] = [
  {
    id: 'bnc-001',
    contactId: 'cnt-010',
    outboundMessageId: 'msg-004',
    bounceType: 'hard',
    reason: '550 5.1.1 <s.gupta@healthbridge.io>: Recipient address rejected: User unknown in virtual mailbox table',
    receivedAt: '2025-06-07T14:00:45Z',
  },
  {
    id: 'bnc-002',
    contactId: 'cnt-017',
    outboundMessageId: null,
    bounceType: 'hard',
    reason: '550 5.4.1 <rajesh.i@smartscalehq.com>: Recipient address rejected: Access denied — sender domain not authenticated',
    receivedAt: '2025-05-22T10:30:12Z',
  },
  {
    id: 'bnc-003',
    contactId: 'cnt-012',
    outboundMessageId: null,
    bounceType: 'soft',
    reason: '451 4.4.1 <t.bradley@cyberguard.sec>: Temporary lookup failure — recipient mail server temporarily unavailable',
    receivedAt: '2025-06-06T16:15:33Z',
  },
];

// ── Suppression Entries ─────────────────────────────────────────────────
export type SuppressionType = 'unsubscribed' | 'bounce_hard' | 'manual_dnc';

export interface SuppressionEntry {
  id: string;
  contactId: string;
  suppressionType: SuppressionType;
  reason: string;
  isActive: boolean;
  createdAt: string;
}

export const MOCK_SUPPRESSIONS: SuppressionEntry[] = [
  {
    id: 'sup-001',
    contactId: 'cnt-015',
    suppressionType: 'unsubscribed',
    reason: 'Recipient replied with "Please remove me from your mailing list"',
    isActive: true,
    createdAt: '2025-05-28T08:30:00Z',
  },
  {
    id: 'sup-002',
    contactId: 'cnt-010',
    suppressionType: 'bounce_hard',
    reason: 'Hard bounce — recipient mailbox does not exist (550)',
    isActive: true,
    createdAt: '2025-06-07T14:01:00Z',
  },
  {
    id: 'sup-003',
    contactId: 'cnt-017',
    suppressionType: 'bounce_hard',
    reason: 'Hard bounce — recipient domain rejected sender',
    isActive: true,
    createdAt: '2025-05-22T10:31:00Z',
  },
  {
    id: 'sup-004',
    contactId: 'cnt-008',
    suppressionType: 'manual_dnc',
    reason: 'Do not contact — company selected a competitor. Re-evaluate in Q3 2025.',
    isActive: true,
    createdAt: '2025-06-10T08:00:00Z',
  },
];

// ── Duplicate Candidates ────────────────────────────────────────────────
export type MatchRule = 'email' | 'linkedin' | 'name+company';
export type DuplicateReviewStatus = 'pending' | 'accepted' | 'rejected' | 'merged';

export interface DuplicateCandidate {
  id: string;
  entityType: 'contact' | 'company';
  existingEntityId: string;
  sourceEntityId: string;
  matchRule: MatchRule;
  matchScore: number;
  reviewStatus: DuplicateReviewStatus;
}

export const MOCK_DUPLICATES: DuplicateCandidate[] = [
  {
    id: 'dup-001',
    entityType: 'contact',
    existingEntityId: 'cnt-001',
    sourceEntityId: 'cnt-002',
    matchRule: 'name+company',
    matchScore: 42,
    reviewStatus: 'rejected',
  },
  {
    id: 'dup-002',
    entityType: 'contact',
    existingEntityId: 'cnt-003',
    sourceEntityId: 'cnt-005',
    matchRule: 'linkedin',
    matchScore: 85,
    reviewStatus: 'pending',
  },
  {
    id: 'dup-003',
    entityType: 'company',
    existingEntityId: 'cmp-006',
    sourceEntityId: 'cmp-001',
    matchRule: 'name+company',
    matchScore: 28,
    reviewStatus: 'rejected',
  },
  {
    id: 'dup-004',
    entityType: 'contact',
    existingEntityId: 'cnt-007',
    sourceEntityId: 'cnt-008',
    matchRule: 'email',
    matchScore: 91,
    reviewStatus: 'pending',
  },
];

// ── Dashboard Stats ─────────────────────────────────────────────────────
export interface DashboardStats {
  totalCount: {
    contacts: number;
    companies: number;
    draftsPending: number;
    inQueue: number;
    sentThisWeek: number;
    repliesThisWeek: number;
    bouncesThisWeek: number;
    suppressions: number;
  };
  emailHealthDistribution: {
    valid: number;
    risky: number;
    invalid: number;
    unknown: number;
  };
  statusDistribution: {
    imported: number;
    cleaned: number;
    ready: number;
    drafted: number;
    queued: number;
    sent: number;
    replied: number;
    bounced: number;
    suppressed: number;
    archived: number;
  };
}

export const MOCK_DASHBOARD_STATS: DashboardStats = {
  totalCount: {
    contacts: 2847,
    companies: 412,
    draftsPending: 23,
    inQueue: 8,
    sentThisWeek: 156,
    repliesThisWeek: 34,
    bouncesThisWeek: 12,
    suppressions: 89,
  },
  emailHealthDistribution: {
    valid: 2140,
    risky: 412,
    invalid: 89,
    unknown: 206,
  },
  statusDistribution: {
    imported: 120,
    cleaned: 450,
    ready: 680,
    drafted: 234,
    queued: 45,
    sent: 856,
    replied: 234,
    bounced: 89,
    suppressed: 89,
    archived: 50,
  },
};

// ── Audit Logs ──────────────────────────────────────────────────────────
export type AuditAction = 'created' | 'updated' | 'approved' | 'merged' | 'sent' | 'suppressed';

export interface AuditLog {
  id: string;
  actorUser: string;
  entityType: string;
  entityId: string;
  action: AuditAction;
  beforeData: string;
  afterData: string;
  createdAt: string;
}

export const MOCK_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'aud-001',
    actorUser: 'Ravi Shanker',
    entityType: 'batch',
    entityId: 'batch-001',
    action: 'created',
    beforeData: '—',
    afterData: 'Batch "enterprise_saas_leads_may2025.csv" uploaded — 450 rows',
    createdAt: '2025-05-20T13:00:00Z',
  },
  {
    id: 'aud-002',
    actorUser: 'Ravi Shanker',
    entityType: 'batch',
    entityId: 'batch-001',
    action: 'updated',
    beforeData: 'status: staged',
    afterData: 'status: committed — 412 accepted, 23 duplicates, 15 invalid',
    createdAt: '2025-05-20T14:30:00Z',
  },
  {
    id: 'aud-003',
    actorUser: 'Ravi Shanker',
    entityType: 'draft',
    entityId: 'dft-001',
    action: 'approved',
    beforeData: 'status: reviewed',
    afterData: 'status: approved — confidence 87%, sent to Arjun Mehta (NexusCore)',
    createdAt: '2025-06-10T10:00:00Z',
  },
  {
    id: 'aud-004',
    actorUser: 'System',
    entityType: 'outbound_message',
    entityId: 'msg-001',
    action: 'sent',
    beforeData: 'status: queued',
    afterData: 'status: sent — delivered to arjun.mehta@nexuscore.io at 09:30:12 UTC',
    createdAt: '2025-06-10T09:30:12Z',
  },
  {
    id: 'aud-005',
    actorUser: 'Anita Krishnamurthy',
    entityType: 'draft',
    entityId: 'dft-003',
    action: 'approved',
    beforeData: 'status: reviewed',
    afterData: 'status: approved — confidence 91%, sent to Priya Deshpande (FinTech Labs)',
    createdAt: '2025-06-09T15:00:00Z',
  },
  {
    id: 'aud-006',
    actorUser: 'System',
    entityType: 'contact',
    entityId: 'cnt-010',
    action: 'suppressed',
    beforeData: 'status: sent, emailHealth: valid (score: 12)',
    afterData: 'status: bounced — hard bounce (550), auto-suppressed',
    createdAt: '2025-06-07T14:01:00Z',
  },
  {
    id: 'aud-007',
    actorUser: 'Ravi Shanker',
    entityType: 'draft',
    entityId: 'dft-005',
    action: 'updated',
    beforeData: 'status: generated',
    afterData: 'status: rejected — partnership framing too aggressive for first touch',
    createdAt: '2025-06-08T16:00:00Z',
  },
  {
    id: 'aud-008',
    actorUser: 'Ravi Shanker',
    entityType: 'contact',
    entityId: 'cnt-008',
    action: 'suppressed',
    beforeData: 'status: sent',
    afterData: 'status: suppressed — manual DNC, competitor selected, re-evaluate Q3 2025',
    createdAt: '2025-06-10T08:00:00Z',
  },
  {
    id: 'aud-009',
    actorUser: 'Priti Sahoo',
    entityType: 'batch',
    entityId: 'batch-005',
    action: 'created',
    beforeData: '—',
    afterData: 'Batch "sdr_manual_additions_june.csv" uploaded — 85 rows',
    createdAt: '2025-06-08T16:00:00Z',
  },
  {
    id: 'aud-010',
    actorUser: 'System',
    entityType: 'duplicate',
    entityId: 'dup-002',
    action: 'created',
    beforeData: '—',
    afterData: 'Potential duplicate detected: cnt-003 ↔ cnt-005 (linkedin match, score: 85)',
    createdAt: '2025-06-05T16:00:00Z',
  },
];

// ═══════════════════════════════════════════════════════════════════════
// DeepMindQ v2 — Dashboard & Leads Mock Data
// ═══════════════════════════════════════════════════════════════════════

// Dashboard operational metrics
export const DASHBOARD_METRICS = {
  totalContacts: 2847,
  totalContactsDelta: '+12% this week',
  readyForDrafting: 680,
  draftsPendingReview: 23,
  sentThisWeek: 156,
  repliesReceived: 34,
  bounceRate: 7.7,
  activeSuppressions: 89,
}

// Email health distribution for pie chart
export const EMAIL_HEALTH_DISTRIBUTION = [
  { name: 'Valid', value: 1842, color: '#059669' },
  { name: 'Risky', value: 412, color: '#D97706' },
  { name: 'Invalid', value: 198, color: '#DC2626' },
  { name: 'Unknown', value: 395, color: '#6B7280' },
]

// Weekly activity for area chart (last 7 days)
export const WEEKLY_ACTIVITY = [
  { day: 'Mon', sends: 28, replies: 6, bounces: 3 },
  { day: 'Tue', sends: 32, replies: 8, bounces: 2 },
  { day: 'Wed', sends: 24, replies: 5, bounces: 1 },
  { day: 'Thu', sends: 19, replies: 4, bounces: 2 },
  { day: 'Fri', sends: 26, replies: 7, bounces: 1 },
  { day: 'Sat', sends: 15, replies: 2, bounces: 0 },
  { day: 'Sun', sends: 12, replies: 2, bounces: 1 },
]

// Recent activity feed entries (audit log style)
export const RECENT_ACTIVITY = [
  {
    id: 'act-1',
    timestamp: new Date(Date.now() - 12 * 60000).toISOString(),
    actor: 'Ravi Shanker',
    action: 'Approved draft for Sarah Chen',
    actionType: 'approval' as const,
    details: 'Enterprise license follow-up email',
  },
  {
    id: 'act-2',
    timestamp: new Date(Date.now() - 45 * 60000).toISOString(),
    actor: 'System',
    action: 'Bounce detected for mark@acme.com',
    actionType: 'error' as const,
    details: 'SMTP 550 — mailbox not found',
  },
  {
    id: 'act-3',
    timestamp: new Date(Date.now() - 2 * 3600000).toISOString(),
    actor: 'Ravi Shanker',
    action: 'Imported batch leads_q3.csv',
    actionType: 'import' as const,
    details: '312 rows · 245 accepted · 45 duplicates',
  },
  {
    id: 'act-4',
    timestamp: new Date(Date.now() - 3 * 3600000).toISOString(),
    actor: 'AI Engine',
    action: 'Generated 12 drafts for CloudScale batch',
    actionType: 'ai' as const,
    details: 'Avg confidence: 87%',
  },
  {
    id: 'act-5',
    timestamp: new Date(Date.now() - 5 * 3600000).toISOString(),
    actor: 'System',
    action: 'Email validation complete — 198 contacts',
    actionType: 'system' as const,
    details: '142 valid · 34 risky · 22 invalid',
  },
  {
    id: 'act-6',
    timestamp: new Date(Date.now() - 8 * 3600000).toISOString(),
    actor: 'Ravi Shanker',
    action: 'Reply received from David Park',
    actionType: 'reply' as const,
    details: 'Interested in partnership discussion',
  },
  {
    id: 'act-7',
    timestamp: new Date(Date.now() - 12 * 3600000).toISOString(),
    actor: 'System',
    action: '42 emails sent — CloudScale campaign',
    actionType: 'sent' as const,
    details: '3 bounces · 8 opens detected',
  },
  {
    id: 'act-8',
    timestamp: new Date(Date.now() - 24 * 3600000).toISOString(),
    actor: 'Ravi Shanker',
    action: 'Suppressed 12 duplicate contacts',
    actionType: 'system' as const,
    details: 'From batch: webinar_registrations_jun.xlsx',
  },
  {
    id: 'act-9',
    timestamp: new Date(Date.now() - 28 * 3600000).toISOString(),
    actor: 'AI Engine',
    action: 'Research cards generated for 6 companies',
    actionType: 'ai' as const,
    details: 'Avg confidence: 82%',
  },
  {
    id: 'act-10',
    timestamp: new Date(Date.now() - 36 * 3600000).toISOString(),
    actor: 'Ravi Shanker',
    action: 'Rejected draft for Emily Brown',
    actionType: 'error' as const,
    details: 'Generic tone — needs personalization',
  },
]

// Lead statuses for the outreach pipeline
export type LeadStatus =
  | 'imported'
  | 'cleaned'
  | 'ready'
  | 'drafted'
  | 'queued'
  | 'sent'
  | 'replied'
  | 'bounced'
  | 'suppressed'
  | 'archived'

export type ScoreTier = 'hot' | 'warm' | 'cold'

// Comprehensive lead records for the Leads table
export const MOCK_LEADS = [
  {
    id: 'lead-1',
    name: 'Sarah Chen',
    email: 'sarah.chen@acmecorp.com',
    company: 'Acme Corp',
    jobTitle: 'VP of Engineering',
    roleBucket: 'Executive' as const,
    industry: 'Technology',
    emailHealth: 'valid' as const,
    score: 92,
    scoreTier: 'hot' as const,
    status: 'replied' as LeadStatus,
    sourceBatch: 'sales_navigator_jul2026.xlsx',
    lastContactedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
  {
    id: 'lead-2',
    name: 'Marcus Thompson',
    email: 'm.thompson@gfsolutions.com',
    company: 'Global Finance Solutions',
    jobTitle: 'CTO',
    roleBucket: 'Executive' as const,
    industry: 'Finance',
    emailHealth: 'valid' as const,
    score: 88,
    scoreTier: 'hot' as const,
    status: 'sent' as LeadStatus,
    sourceBatch: 'sales_navigator_jul2026.xlsx',
    lastContactedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    id: 'lead-3',
    name: 'Priya Patel',
    email: 'priya.p@techventures.io',
    company: 'TechVentures Inc',
    jobTitle: 'Head of Product',
    roleBucket: 'Manager' as const,
    industry: 'SaaS',
    emailHealth: 'valid' as const,
    score: 85,
    scoreTier: 'hot' as const,
    status: 'ready' as LeadStatus,
    sourceBatch: 'conference_leads_q2.csv',
    lastContactedAt: null,
  },
  {
    id: 'lead-4',
    name: 'James Wilson',
    email: 'j.wilson@gfsolutions.com',
    company: 'Global Finance Solutions',
    jobTitle: 'CFO',
    roleBucket: 'Executive' as const,
    industry: 'Finance',
    emailHealth: 'risky' as const,
    score: 81,
    scoreTier: 'hot' as const,
    status: 'drafted' as LeadStatus,
    sourceBatch: 'sales_navigator_jul2026.xlsx',
    lastContactedAt: new Date(Date.now() - 7 * 86400000).toISOString(),
  },
  {
    id: 'lead-5',
    name: 'Dr. Emily Brown',
    email: 'emily.b@healthtechplus.com',
    company: 'HealthTech Plus',
    jobTitle: 'Director of Innovation',
    roleBucket: 'Manager' as const,
    industry: 'Healthcare',
    emailHealth: 'risky' as const,
    score: 73,
    scoreTier: 'warm' as const,
    status: 'queued' as LeadStatus,
    sourceBatch: 'webinar_registrations_jun.xlsx',
    lastContactedAt: null,
  },
  {
    id: 'lead-6',
    name: 'David Park',
    email: 'david.park@cloudscale.dev',
    company: 'CloudScale Systems',
    jobTitle: 'VP Cloud Infrastructure',
    roleBucket: 'Executive' as const,
    industry: 'Cloud Computing',
    emailHealth: 'valid' as const,
    score: 95,
    scoreTier: 'hot' as const,
    status: 'replied' as LeadStatus,
    sourceBatch: 'partner_referrals.csv',
    lastContactedAt: new Date(Date.now() - 0.5 * 86400000).toISOString(),
  },
  {
    id: 'lead-7',
    name: 'Lisa Nakamura',
    email: 'l.nakamura@greenenergy.co',
    company: 'GreenEnergy Corp',
    jobTitle: 'COO',
    roleBucket: 'Executive' as const,
    industry: 'Energy',
    emailHealth: 'valid' as const,
    score: 67,
    scoreTier: 'warm' as const,
    status: 'ready' as LeadStatus,
    sourceBatch: 'trade_show_leads_may.xlsx',
    lastContactedAt: null,
  },
  {
    id: 'lead-8',
    name: 'Robert Mueller',
    email: 'r.mueller@datenschutz.de',
    company: 'SecureTech GmbH',
    jobTitle: 'Head of Engineering',
    roleBucket: 'Manager' as const,
    industry: 'Cybersecurity',
    emailHealth: 'invalid' as const,
    score: 54,
    scoreTier: 'cold' as const,
    status: 'bounced' as LeadStatus,
    sourceBatch: 'sales_navigator_jul2026.xlsx',
    lastContactedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  {
    id: 'lead-9',
    name: 'Aisha Khan',
    email: 'aisha@innovateai.ae',
    company: 'InnovateAI',
    jobTitle: 'CEO',
    roleBucket: 'Executive' as const,
    industry: 'AI/ML',
    emailHealth: 'valid' as const,
    score: 90,
    scoreTier: 'hot' as const,
    status: 'cleaned' as LeadStatus,
    sourceBatch: 'conference_leads_q2.csv',
    lastContactedAt: null,
  },
  {
    id: 'lead-10',
    name: 'Tom Bradley',
    email: 'tom.b@retailpro.com',
    company: 'RetailPro Solutions',
    jobTitle: 'VP of Sales',
    roleBucket: 'Executive' as const,
    industry: 'Retail',
    emailHealth: 'valid' as const,
    score: 76,
    scoreTier: 'warm' as const,
    status: 'sent' as LeadStatus,
    sourceBatch: 'partner_referrals.csv',
    lastContactedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: 'lead-11',
    name: 'Sofia Rodriguez',
    email: 's.rodriguez@logisticahub.mx',
    company: 'LogisticaHub',
    jobTitle: 'Operations Director',
    roleBucket: 'Operations' as const,
    industry: 'Logistics',
    emailHealth: 'unknown' as const,
    score: 42,
    scoreTier: 'cold' as const,
    status: 'imported' as LeadStatus,
    sourceBatch: 'trade_show_leads_may.xlsx',
    lastContactedAt: null,
  },
  {
    id: 'lead-12',
    name: 'Chen Wei',
    email: 'wei.chen@bytedance.tech',
    company: 'ByteDance',
    jobTitle: 'Senior PM',
    roleBucket: 'Manager' as const,
    industry: 'Technology',
    emailHealth: 'valid' as const,
    score: 83,
    scoreTier: 'hot' as const,
    status: 'ready' as LeadStatus,
    sourceBatch: 'sales_navigator_jul2026.xlsx',
    lastContactedAt: null,
  },
  {
    id: 'lead-13',
    name: 'Rachel Green',
    email: 'rachel.g@marketedge.co',
    company: 'MarketEdge',
    jobTitle: 'CMO',
    roleBucket: 'Executive' as const,
    industry: 'Marketing',
    emailHealth: 'risky' as const,
    score: 61,
    scoreTier: 'warm' as const,
    status: 'drafted' as LeadStatus,
    sourceBatch: 'webinar_registrations_jun.xlsx',
    lastContactedAt: null,
  },
  {
    id: 'lead-14',
    name: 'Mark Stevens',
    email: 'mark.s@acmecorp.com',
    company: 'Acme Corp',
    jobTitle: 'Director of IT',
    roleBucket: 'Manager' as const,
    industry: 'Technology',
    emailHealth: 'invalid' as const,
    score: 48,
    scoreTier: 'cold' as const,
    status: 'suppressed' as LeadStatus,
    sourceBatch: 'sales_navigator_jul2026.xlsx',
    lastContactedAt: new Date(Date.now() - 14 * 86400000).toISOString(),
  },
  {
    id: 'lead-15',
    name: 'Elena Petrova',
    email: 'elena.p@fintechlab.ru',
    company: 'FinTech Lab',
    jobTitle: 'CTO',
    roleBucket: 'Executive' as const,
    industry: 'Finance',
    emailHealth: 'valid' as const,
    score: 79,
    scoreTier: 'warm' as const,
    status: 'cleaned' as LeadStatus,
    sourceBatch: 'conference_leads_q2.csv',
    lastContactedAt: null,
  },
  {
    id: 'lead-16',
    name: 'Jason Lee',
    email: 'jason.lee@cloudnine.io',
    company: 'CloudNine Solutions',
    jobTitle: 'VP Engineering',
    roleBucket: 'Executive' as const,
    industry: 'Cloud Computing',
    emailHealth: 'valid' as const,
    score: 86,
    scoreTier: 'hot' as const,
    status: 'queued' as LeadStatus,
    sourceBatch: 'partner_referrals.csv',
    lastContactedAt: null,
  },
  {
    id: 'lead-17',
    name: 'Anna Kowalski',
    email: 'a.kowalski@biopharm.eu',
    company: 'BioPharm Research',
    jobTitle: 'Head of Data Science',
    roleBucket: 'Technical' as const,
    industry: 'Pharma',
    emailHealth: 'valid' as const,
    score: 71,
    scoreTier: 'warm' as const,
    status: 'sent' as LeadStatus,
    sourceBatch: 'webinar_registrations_jun.xlsx',
    lastContactedAt: new Date(Date.now() - 4 * 86400000).toISOString(),
  },
  {
    id: 'lead-18',
    name: "Michael O'Brien",
    email: 'mobrien@constructioniq.com',
    company: 'ConstructionIQ',
    jobTitle: 'CEO',
    roleBucket: 'Executive' as const,
    industry: 'Construction',
    emailHealth: 'unknown' as const,
    score: 38,
    scoreTier: 'cold' as const,
    status: 'imported' as LeadStatus,
    sourceBatch: 'trade_show_leads_may.xlsx',
    lastContactedAt: null,
  },
  {
    id: 'lead-19',
    name: 'Yuki Tanaka',
    email: 'y.tanaka@softbank.jp',
    company: 'SoftBank Robotics',
    jobTitle: 'Director of Partnerships',
    roleBucket: 'Manager' as const,
    industry: 'Robotics',
    emailHealth: 'valid' as const,
    score: 77,
    scoreTier: 'warm' as const,
    status: 'ready' as LeadStatus,
    sourceBatch: 'conference_leads_q2.csv',
    lastContactedAt: null,
  },
  {
    id: 'lead-20',
    name: 'Alex Rivera',
    email: 'alex.r@edutech.io',
    company: 'EduTech Platform',
    jobTitle: 'VP Product',
    roleBucket: 'Manager' as const,
    industry: 'Education',
    emailHealth: 'risky' as const,
    score: 63,
    scoreTier: 'warm' as const,
    status: 'archived' as LeadStatus,
    sourceBatch: 'webinar_registrations_jun.xlsx',
    lastContactedAt: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
]

// ── Capability Library Assets ──────────────────────────────────────

export type CapabilityCategory = 'service_line' | 'case_study' | 'proof_point' | 'objection_response' | 'cta';

export interface CapabilityAsset {
  id: string;
  category: CapabilityCategory;
  title: string;
  summary: string;
  serviceLine: string;
  targetIndustries: string[];
  targetRoles: string[];
  problemsSolved: string[];
  supportingEvidence: string;
  version: number;
  isActive: boolean;
  usedInDrafts: number;
  createdAt: string;
  updatedAt: string;
  versionHistory: Array<{ version: number; date: string; note: string }>;
}

export const MOCK_CAPABILITY_ASSETS: CapabilityAsset[] = [
  // ── Service Lines (6) ──
  {
    id: 'cap-svc-1',
    category: 'service_line',
    title: 'AI-Powered Sales Intelligence Platform',
    summary: 'End-to-end AI platform that automates lead discovery, enrichment, scoring, and personalized outreach generation. Reduces manual research by 85% while increasing conversion rates by 3.2x.',
    serviceLine: 'AI Sales Intelligence',
    targetIndustries: ['Technology', 'SaaS', 'Finance', 'Healthcare', 'Manufacturing'],
    targetRoles: ['VP Sales', 'CRO', 'Head of Growth', 'Sales Director'],
    problemsSolved: ['Manual lead research', 'Low personalization at scale', 'Inconsistent messaging', 'Poor lead qualification'],
    supportingEvidence: 'Deployed across 120+ enterprise clients. Average client sees 3.2x improvement in email response rates within 90 days. G2 rating of 4.8/5.0 from 340+ reviews. Featured in Forrester Wave for Sales Intelligence, Q2 2025.',
    version: 3,
    isActive: true,
    usedInDrafts: 47,
    createdAt: new Date(Date.now() - 180 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    versionHistory: [
      { version: 1, date: new Date(Date.now() - 180 * 86400000).toISOString(), note: 'Initial service line definition' },
      { version: 2, date: new Date(Date.now() - 60 * 86400000).toISOString(), note: 'Added ROI metrics and Forrester recognition' },
      { version: 3, date: new Date(Date.now() - 5 * 86400000).toISOString(), note: 'Updated with Q2 2025 metrics and G2 rating' },
    ],
  },
  {
    id: 'cap-svc-2',
    category: 'service_line',
    title: 'Cloud Infrastructure Modernization',
    summary: 'Comprehensive cloud migration and modernization services including assessment, architecture design, migration execution, and post-migration optimization. Specialized in AWS, Azure, and GCP.',
    serviceLine: 'Cloud & Infrastructure',
    targetIndustries: ['Finance', 'Healthcare', 'Manufacturing', 'Technology'],
    targetRoles: ['CTO', 'VP Engineering', 'Cloud Architect', 'IT Director'],
    problemsSolved: ['Legacy system debt', 'Cloud cost overruns', 'Security compliance gaps', 'Performance bottlenecks'],
    supportingEvidence: 'Migrated 45 enterprise workloads in 2024 with zero-downtime track record. Average cost reduction of 34% post-migration. AWS Advanced Partner with 12 certifications.',
    version: 2,
    isActive: true,
    usedInDrafts: 31,
    createdAt: new Date(Date.now() - 120 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 15 * 86400000).toISOString(),
    versionHistory: [
      { version: 1, date: new Date(Date.now() - 120 * 86400000).toISOString(), note: 'Initial definition' },
      { version: 2, date: new Date(Date.now() - 15 * 86400000).toISOString(), note: 'Added multi-cloud capabilities and cost metrics' },
    ],
  },
  {
    id: 'cap-svc-3',
    category: 'service_line',
    title: 'Data Engineering & Analytics',
    summary: 'Full-stack data engineering services from data pipeline architecture to real-time analytics dashboards. Build modern data stacks with dbt, Snowflake, and Apache Spark.',
    serviceLine: 'Data & Analytics',
    targetIndustries: ['Finance', 'Technology', 'Healthcare', 'SaaS'],
    targetRoles: ['VP Data', 'Head of Analytics', 'CDO', 'Data Engineering Lead'],
    problemsSolved: ['Data silos', 'Slow reporting', 'Poor data quality', 'Lack of real-time insights'],
    supportingEvidence: 'Built data platforms processing 50TB+ daily for Fortune 500 clients. Reduced reporting time from days to minutes for 8 enterprise clients. Snowflake Select Partner.',
    version: 2,
    isActive: true,
    usedInDrafts: 22,
    createdAt: new Date(Date.now() - 90 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 20 * 86400000).toISOString(),
    versionHistory: [
      { version: 1, date: new Date(Date.now() - 90 * 86400000).toISOString(), note: 'Initial definition' },
      { version: 2, date: new Date(Date.now() - 20 * 86400000).toISOString(), note: 'Added real-time analytics and Snowflake partnership' },
    ],
  },
  {
    id: 'cap-svc-4',
    category: 'service_line',
    title: 'Cybersecurity & Compliance',
    summary: 'End-to-end cybersecurity services including threat assessment, SOC-as-a-Service, compliance automation (SOC 2, HIPAA, PCI-DSS), and incident response planning.',
    serviceLine: 'Security & Compliance',
    targetIndustries: ['Healthcare', 'Finance', 'Technology', 'Government'],
    targetRoles: ['CISO', 'VP Security', 'Compliance Officer', 'IT Director'],
    problemsSolved: ['Regulatory compliance burden', 'Security talent shortage', 'Incident response gaps', 'Audit preparation overhead'],
    supportingEvidence: 'SOC 2 Type II certified. Protected 200+ organizations from cyber threats. Average incident response time reduced from 72 hours to 4 hours. 99.7% client retention rate.',
    version: 1,
    isActive: true,
    usedInDrafts: 18,
    createdAt: new Date(Date.now() - 60 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 10 * 86400000).toISOString(),
    versionHistory: [
      { version: 1, date: new Date(Date.now() - 60 * 86400000).toISOString(), note: 'Initial service line definition' },
    ],
  },
  {
    id: 'cap-svc-5',
    category: 'service_line',
    title: 'Custom Software Development',
    summary: 'Full-lifecycle custom software development from ideation to deployment. Specialized in building scalable SaaS products, internal tools, and customer-facing applications.',
    serviceLine: 'Product Engineering',
    targetIndustries: ['Technology', 'SaaS', 'Healthcare', 'Finance', 'Manufacturing'],
    targetRoles: ['CTO', 'VP Engineering', 'Head of Product', 'Product Director'],
    problemsSolved: ['Engineering capacity constraints', 'Technical debt', 'Slow time-to-market', 'Talent acquisition challenges'],
    supportingEvidence: 'Delivered 80+ production applications. Average time-to-market improvement of 40%. Dedicated teams of 5-15 engineers available within 2 weeks. Client NPS score of 78.',
    version: 2,
    isActive: true,
    usedInDrafts: 26,
    createdAt: new Date(Date.now() - 150 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 8 * 86400000).toISOString(),
    versionHistory: [
      { version: 1, date: new Date(Date.now() - 150 * 86400000).toISOString(), note: 'Initial definition' },
      { version: 2, date: new Date(Date.now() - 8 * 86400000).toISOString(), note: 'Added NPS score and capacity metrics' },
    ],
  },
  {
    id: 'cap-svc-6',
    category: 'service_line',
    title: 'Process Automation & AI Integration',
    summary: 'Intelligent process automation combining RPA, AI/ML, and workflow orchestration to eliminate manual processes and accelerate business operations.',
    serviceLine: 'Automation & AI',
    targetIndustries: ['Manufacturing', 'Finance', 'Healthcare', 'Technology'],
    targetRoles: ['COO', 'VP Operations', 'Head of Digital Transformation', 'CIO'],
    problemsSolved: ['Manual process bottlenecks', 'High operational costs', 'Error-prone workflows', 'Lack of process visibility'],
    supportingEvidence: 'Automated 500+ business processes across 60 organizations. Average ROI of 280% in year one. Reduced processing time by 65% on average.',
    version: 1,
    isActive: true,
    usedInDrafts: 14,
    createdAt: new Date(Date.now() - 45 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 12 * 86400000).toISOString(),
    versionHistory: [
      { version: 1, date: new Date(Date.now() - 45 * 86400000).toISOString(), note: 'Initial service line definition' },
    ],
  },

  // ── Case Studies (5) ──
  {
    id: 'cap-cs-1',
    category: 'case_study',
    title: 'Acme Corp: 4x Pipeline Increase with AI Sales Intelligence',
    summary: 'How Acme Corp transformed their enterprise sales motion by adopting our AI-powered sales intelligence platform, achieving a 4x increase in qualified pipeline within 6 months.',
    serviceLine: 'AI Sales Intelligence',
    targetIndustries: ['Technology', 'SaaS'],
    targetRoles: ['VP Sales', 'CRO', 'Head of Growth'],
    problemsSolved: ['Low lead quality', 'Inconsistent outreach', 'Long sales cycles'],
    supportingEvidence: 'Qualified pipeline grew from $2.1M to $8.4M in 6 months. Email response rates improved from 3% to 14%. Sales cycle reduced from 94 days to 52 days. Verified metrics with client testimonial from VP Sales.',
    version: 2,
    isActive: true,
    usedInDrafts: 19,
    createdAt: new Date(Date.now() - 90 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    versionHistory: [
      { version: 1, date: new Date(Date.now() - 90 * 86400000).toISOString(), note: 'Initial case study' },
      { version: 2, date: new Date(Date.now() - 30 * 86400000).toISOString(), note: 'Updated with 6-month metrics' },
    ],
  },
  {
    id: 'cap-cs-2',
    category: 'case_study',
    title: 'Global Finance Solutions: $2.4M Annual Cloud Cost Savings',
    summary: 'Migrated 200+ microservices from on-premise to AWS, achieving 99.99% uptime while reducing infrastructure costs by $2.4M annually.',
    serviceLine: 'Cloud & Infrastructure',
    targetIndustries: ['Finance', 'SaaS'],
    targetRoles: ['CTO', 'VP Engineering', 'Cloud Architect'],
    problemsSolved: ['Legacy infrastructure costs', 'Scalability limitations', 'Compliance requirements'],
    supportingEvidence: 'Zero-downtime migration completed in 4 months. PCI-DSS compliant architecture. Infrastructure costs reduced from $5.6M to $3.2M annually. 99.99% uptime achieved vs. 99.5% pre-migration.',
    version: 1,
    isActive: true,
    usedInDrafts: 15,
    createdAt: new Date(Date.now() - 60 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 25 * 86400000).toISOString(),
    versionHistory: [
      { version: 1, date: new Date(Date.now() - 60 * 86400000).toISOString(), note: 'Initial case study' },
    ],
  },
  {
    id: 'cap-cs-3',
    category: 'case_study',
    title: 'HealthTech Plus: HIPAA-Compliant Data Platform in 8 Weeks',
    summary: 'Built a HIPAA-compliant data analytics platform from scratch, enabling real-time patient data analysis and reducing reporting time from 3 days to 15 minutes.',
    serviceLine: 'Data & Analytics',
    targetIndustries: ['Healthcare'],
    targetRoles: ['CDO', 'VP Data', 'Head of Analytics'],
    problemsSolved: ['Data silos in healthcare', 'HIPAA compliance complexity', 'Slow reporting'],
    supportingEvidence: 'Platform processes 2M+ patient records daily. HIPAA audit passed on first attempt. Reporting time reduced from 3 days to 15 minutes. ROI achieved in 4 months.',
    version: 1,
    isActive: true,
    usedInDrafts: 11,
    createdAt: new Date(Date.now() - 45 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 15 * 86400000).toISOString(),
    versionHistory: [
      { version: 1, date: new Date(Date.now() - 45 * 86400000).toISOString(), note: 'Initial case study' },
    ],
  },
  {
    id: 'cap-cs-4',
    category: 'case_study',
    title: 'TechVentures Inc: SOC 2 Certification in 90 Days',
    summary: 'Helped TechVentures achieve SOC 2 Type II certification in record time, implementing automated compliance monitoring and security controls.',
    serviceLine: 'Security & Compliance',
    targetIndustries: ['SaaS', 'Technology'],
    targetRoles: ['CISO', 'VP Security', 'Compliance Officer'],
    problemsSolved: ['Compliance deadlines', 'Security control gaps', 'Audit preparation'],
    supportingEvidence: 'SOC 2 Type II certified in 90 days (industry average: 6-12 months). Automated 85% of compliance monitoring. Zero critical findings in audit.',
    version: 1,
    isActive: true,
    usedInDrafts: 8,
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 10 * 86400000).toISOString(),
    versionHistory: [
      { version: 1, date: new Date(Date.now() - 30 * 86400000).toISOString(), note: 'Initial case study' },
    ],
  },
  {
    id: 'cap-cs-5',
    category: 'case_study',
    title: 'CloudScale Systems: 280% ROI from Process Automation',
    summary: 'Deployed intelligent process automation across customer onboarding and support workflows, achieving 280% ROI in the first year.',
    serviceLine: 'Automation & AI',
    targetIndustries: ['Technology', 'Cloud Computing'],
    targetRoles: ['COO', 'VP Operations', 'CIO'],
    problemsSolved: ['Manual onboarding processes', 'Support ticket backlog', 'Inconsistent workflows'],
    supportingEvidence: 'Customer onboarding time reduced from 14 days to 3 days. Support ticket resolution time improved by 70%. 280% ROI achieved in year one. 12 workflows fully automated.',
    version: 1,
    isActive: true,
    usedInDrafts: 7,
    createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    versionHistory: [
      { version: 1, date: new Date(Date.now() - 20 * 86400000).toISOString(), note: 'Initial case study' },
    ],
  },

  // ── Proof Points (5) ──
  {
    id: 'cap-pp-1',
    category: 'proof_point',
    title: '3.2x Average Email Response Rate Improvement',
    summary: 'Verified metric across 120+ enterprise clients showing consistent 3.2x improvement in email response rates when using AI-personalized outreach vs. manual approaches.',
    serviceLine: 'AI Sales Intelligence',
    targetIndustries: ['Technology', 'SaaS', 'Finance', 'Healthcare'],
    targetRoles: ['VP Sales', 'CRO', 'Head of Growth', 'Sales Director'],
    problemsSolved: ['Low email engagement', 'Poor personalization'],
    supportingEvidence: 'Based on analysis of 2.4M emails sent through our platform (2024). A/B tested against manual outreach across 15 industries. Published in 2024 Benchmark Report. Independently verified by Deloitte.',
    version: 2,
    isActive: true,
    usedInDrafts: 34,
    createdAt: new Date(Date.now() - 120 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    versionHistory: [
      { version: 1, date: new Date(Date.now() - 120 * 86400000).toISOString(), note: 'Initial proof point' },
      { version: 2, date: new Date(Date.now() - 7 * 86400000).toISOString(), note: 'Updated with 2024 full-year data' },
    ],
  },
  {
    id: 'cap-pp-2',
    category: 'proof_point',
    title: '34% Average Cloud Cost Reduction',
    summary: 'Average infrastructure cost reduction of 34% achieved through right-sizing, reserved instance optimization, and architectural modernization across 45+ cloud migration projects.',
    serviceLine: 'Cloud & Infrastructure',
    targetIndustries: ['Finance', 'Healthcare', 'Technology', 'Manufacturing'],
    targetRoles: ['CTO', 'VP Engineering', 'Cloud Architect', 'IT Director'],
    problemsSolved: ['Cloud cost overruns', 'Inefficient resource utilization'],
    supportingEvidence: 'Aggregated data from 45 migration projects (2023-2024). Range: 22% to 58% reduction depending on initial architecture. Average payback period of 8 months.',
    version: 1,
    isActive: true,
    usedInDrafts: 21,
    createdAt: new Date(Date.now() - 90 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 14 * 86400000).toISOString(),
    versionHistory: [
      { version: 1, date: new Date(Date.now() - 90 * 86400000).toISOString(), note: 'Initial proof point' },
    ],
  },
  {
    id: 'cap-pp-3',
    category: 'proof_point',
    title: '85% Reduction in Manual Research Time',
    summary: 'AI-powered automation reduces manual lead research and company intelligence gathering time by 85%, freeing SDR and AE teams to focus on high-value activities.',
    serviceLine: 'AI Sales Intelligence',
    targetIndustries: ['Technology', 'SaaS', 'Finance', 'Healthcare', 'Manufacturing'],
    targetRoles: ['VP Sales', 'Sales Director', 'Head of Growth', 'SDR Manager'],
    problemsSolved: ['Time-consuming research', 'SDR productivity', 'Data gathering inefficiency'],
    supportingEvidence: 'Time-motion study across 8 client organizations (2024). Research time per prospect reduced from 45 min to 7 min. SDR productivity increased by 2.3x. Published in Sales Hacker magazine.',
    version: 1,
    isActive: true,
    usedInDrafts: 28,
    createdAt: new Date(Date.now() - 75 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 20 * 86400000).toISOString(),
    versionHistory: [
      { version: 1, date: new Date(Date.now() - 75 * 86400000).toISOString(), note: 'Initial proof point' },
    ],
  },
  {
    id: 'cap-pp-4',
    category: 'proof_point',
    title: 'Zero-Downtime Migration Track Record',
    summary: 'Maintained a 100% zero-downtime migration record across 45+ enterprise cloud migrations spanning 200+ microservices and petabytes of data.',
    serviceLine: 'Cloud & Infrastructure',
    targetIndustries: ['Finance', 'Healthcare', 'Technology'],
    targetRoles: ['CTO', 'VP Engineering', 'IT Director'],
    problemsSolved: ['Migration risk', 'Business continuity concerns'],
    supportingEvidence: '45 consecutive migrations with zero unplanned downtime. Average migration of 200+ microservices in 4 months. Blue-green and canary deployment strategies used.',
    version: 1,
    isActive: true,
    usedInDrafts: 12,
    createdAt: new Date(Date.now() - 50 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 18 * 86400000).toISOString(),
    versionHistory: [
      { version: 1, date: new Date(Date.now() - 50 * 86400000).toISOString(), note: 'Initial proof point' },
    ],
  },
  {
    id: 'cap-pp-5',
    category: 'proof_point',
    title: 'NPS Score of 78 — Top Quartile in IT Services',
    summary: 'Consistently maintain a Net Promoter Score of 78, placing us in the top quartile of IT services firms globally (industry average: 42).',
    serviceLine: 'Product Engineering',
    targetIndustries: ['Technology', 'SaaS', 'Healthcare', 'Finance'],
    targetRoles: ['CTO', 'VP Engineering', 'Head of Product'],
    problemsSolved: ['Vendor reliability concerns', 'Quality assurance'],
    supportingEvidence: 'Based on quarterly NPS surveys (2024). Sample size: 180+ clients. Score trending upward from 65 (2022) to 78 (2024). Zero clients lost due to quality issues.',
    version: 1,
    isActive: true,
    usedInDrafts: 16,
    createdAt: new Date(Date.now() - 40 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 10 * 86400000).toISOString(),
    versionHistory: [
      { version: 1, date: new Date(Date.now() - 40 * 86400000).toISOString(), note: 'Initial proof point' },
    ],
  },

  // ── Objection Responses (4) ──
  {
    id: 'cap-obj-1',
    category: 'objection_response',
    title: 'Response: "We already have a CRM / sales tool"',
    summary: 'Structured response for prospects who believe their existing CRM or sales tool is sufficient. Positions our platform as a complementary intelligence layer, not a replacement.',
    serviceLine: 'AI Sales Intelligence',
    targetIndustries: ['Technology', 'SaaS', 'Finance', 'Healthcare', 'Manufacturing'],
    targetRoles: ['VP Sales', 'CRO', 'Sales Director'],
    problemsSolved: ['Competitive positioning', 'Value differentiation'],
    supportingEvidence: 'Competitive win rate of 67% against status-quo. Average deal size 23% larger when positioned alongside existing CRM. Client quote: "We didn\'t replace Salesforce — we supercharged it."',
    version: 3,
    isActive: true,
    usedInDrafts: 23,
    createdAt: new Date(Date.now() - 150 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    versionHistory: [
      { version: 1, date: new Date(Date.now() - 150 * 86400000).toISOString(), note: 'Initial response' },
      { version: 2, date: new Date(Date.now() - 60 * 86400000).toISOString(), note: 'Added competitive win rate data' },
      { version: 3, date: new Date(Date.now() - 3 * 86400000).toISOString(), note: 'Updated testimonial' },
    ],
  },
  {
    id: 'cap-obj-2',
    category: 'objection_response',
    title: 'Response: "Your pricing is too high"',
    summary: 'Value-based response framework for pricing objections. Reframes conversation from cost to ROI with specific payback period data and risk reduction metrics.',
    serviceLine: 'AI Sales Intelligence',
    targetIndustries: ['Technology', 'SaaS', 'Finance', 'Healthcare', 'Manufacturing'],
    targetRoles: ['VP Sales', 'CRO', 'CFO', 'VP Finance'],
    problemsSolved: ['Price sensitivity', 'ROI justification', 'Budget constraints'],
    supportingEvidence: 'Average payback period of 4.2 months. 92% of clients achieve positive ROI within first year. Customer LTV is 7.3x acquisition cost.',
    version: 2,
    isActive: true,
    usedInDrafts: 31,
    createdAt: new Date(Date.now() - 130 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 8 * 86400000).toISOString(),
    versionHistory: [
      { version: 1, date: new Date(Date.now() - 130 * 86400000).toISOString(), note: 'Initial response' },
      { version: 2, date: new Date(Date.now() - 8 * 86400000).toISOString(), note: 'Added LTV data' },
    ],
  },
  {
    id: 'cap-obj-3',
    category: 'objection_response',
    title: 'Response: "We need to see more references in our industry"',
    summary: 'Industry-specific reference response with tailored case studies and proof points. Includes framework for addressing industry-specific concerns.',
    serviceLine: 'AI Sales Intelligence',
    targetIndustries: ['Healthcare', 'Finance', 'Manufacturing', 'Technology'],
    targetRoles: ['VP Sales', 'CRO', 'Head of Procurement', 'VP Operations'],
    problemsSolved: ['Industry skepticism', 'Reference requests'],
    supportingEvidence: 'Clients across 14 industries. Industry-specific case studies available for 5 verticals. 89% of reference calls result in deal advancement. Reference program with 40+ client advocates.',
    version: 2,
    isActive: true,
    usedInDrafts: 17,
    createdAt: new Date(Date.now() - 100 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 12 * 86400000).toISOString(),
    versionHistory: [
      { version: 1, date: new Date(Date.now() - 100 * 86400000).toISOString(), note: 'Initial response' },
      { version: 2, date: new Date(Date.now() - 12 * 86400000).toISOString(), note: 'Added reference program data' },
    ],
  },
  {
    id: 'cap-obj-4',
    category: 'objection_response',
    title: 'Response: "We\'re not ready for AI / it\'s too early"',
    summary: 'Addresses the "AI is too early for us" objection by reframing AI as evolutionary not revolutionary. Shows low-risk entry points and quick wins.',
    serviceLine: 'Automation & AI',
    targetIndustries: ['Manufacturing', 'Finance', 'Healthcare'],
    targetRoles: ['COO', 'CIO', 'VP Operations', 'CTO'],
    problemsSolved: ['AI adoption hesitancy', 'Change management fears', 'Technology maturity concerns'],
    supportingEvidence: 'Phased adoption approach has 94% success rate. Average first-value-delivery time of 6 weeks. 78% of clients expand to additional AI use cases within 6 months.',
    version: 1,
    isActive: true,
    usedInDrafts: 9,
    createdAt: new Date(Date.now() - 35 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    versionHistory: [
      { version: 1, date: new Date(Date.now() - 35 * 86400000).toISOString(), note: 'Initial response' },
    ],
  },

  // ── CTAs (5) ──
  {
    id: 'cap-cta-1',
    category: 'cta',
    title: 'Consultative: "Mind if I share a 2-minute case study?"',
    summary: 'Low-commitment CTA that offers relevant proof without asking for a meeting. Effective for mid-funnel prospects who need more evidence before engaging.',
    serviceLine: 'AI Sales Intelligence',
    targetIndustries: ['Technology', 'SaaS', 'Finance', 'Healthcare', 'Manufacturing'],
    targetRoles: ['VP Sales', 'CRO', 'Head of Growth', 'CTO'],
    problemsSolved: ['Low email response rates', 'Early-stage engagement', 'Building credibility'],
    supportingEvidence: '42% response rate when paired with industry-relevant case study. 67% of responders agree to follow-up call within 2 weeks. A/B tested across 50K+ outreach emails.',
    version: 2,
    isActive: true,
    usedInDrafts: 38,
    createdAt: new Date(Date.now() - 100 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 4 * 86400000).toISOString(),
    versionHistory: [
      { version: 1, date: new Date(Date.now() - 100 * 86400000).toISOString(), note: 'Initial CTA' },
      { version: 2, date: new Date(Date.now() - 4 * 86400000).toISOString(), note: 'Refined based on A/B test results' },
    ],
  },
  {
    id: 'cap-cta-2',
    category: 'cta',
    title: 'Direct: "Can we schedule a 30-min call this week?"',
    summary: 'Direct meeting request CTA for high-intent prospects who have shown buying signals or are in active evaluation.',
    serviceLine: 'AI Sales Intelligence',
    targetIndustries: ['Technology', 'SaaS', 'Finance'],
    targetRoles: ['VP Sales', 'CRO', 'CTO', 'VP Engineering'],
    problemsSolved: ['Meeting scheduling friction', 'Advance pipeline velocity'],
    supportingEvidence: '31% acceptance rate when used with warm leads. Average meeting conversion rate of 28%. Works best Tuesday-Thursday, 10am-2pm local time.',
    version: 1,
    isActive: true,
    usedInDrafts: 25,
    createdAt: new Date(Date.now() - 80 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 15 * 86400000).toISOString(),
    versionHistory: [
      { version: 1, date: new Date(Date.now() - 80 * 86400000).toISOString(), note: 'Initial CTA' },
    ],
  },
  {
    id: 'cap-cta-3',
    category: 'cta',
    title: 'Soft: "Would it be helpful if I sent over a quick ROI estimate?"',
    summary: 'Value-forward CTA that offers personalized ROI analysis based on the prospect\'s specific situation. Creates reciprocity and positions us as consultative.',
    serviceLine: 'Cloud & Infrastructure',
    targetIndustries: ['Finance', 'Healthcare', 'Manufacturing', 'Technology'],
    targetRoles: ['CTO', 'VP Engineering', 'CFO', 'IT Director'],
    problemsSolved: ['Engagement friction', 'Demonstrating value early'],
    supportingEvidence: '38% response rate. 82% of those who receive ROI estimate agree to discovery call. Average deal size 35% larger when this CTA is used.',
    version: 1,
    isActive: true,
    usedInDrafts: 14,
    createdAt: new Date(Date.now() - 55 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 20 * 86400000).toISOString(),
    versionHistory: [
      { version: 1, date: new Date(Date.now() - 55 * 86400000).toISOString(), note: 'Initial CTA' },
    ],
  },
  {
    id: 'cap-cta-4',
    category: 'cta',
    title: 'Urgent: "We\'re onboarding 3 companies in your space this quarter"',
    summary: 'Social proof + urgency CTA that leverages competitive dynamics. Effective for creating FOMO and accelerating deals in the consideration stage.',
    serviceLine: 'AI Sales Intelligence',
    targetIndustries: ['Technology', 'SaaS', 'Finance'],
    targetRoles: ['VP Sales', 'CRO', 'Head of Growth'],
    problemsSolved: ['Slow decision-making', 'Creating urgency', 'Competitive differentiation'],
    supportingEvidence: '52% response rate (highest performing CTA). 29% convert to qualified opportunity. Must be used truthfully — compliance-approved template.',
    version: 1,
    isActive: true,
    usedInDrafts: 10,
    createdAt: new Date(Date.now() - 40 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 12 * 86400000).toISOString(),
    versionHistory: [
      { version: 1, date: new Date(Date.now() - 40 * 86400000).toISOString(), note: 'Initial CTA' },
    ],
  },
  {
    id: 'cap-cta-5',
    category: 'cta',
    title: 'Consultative: "I put together a brief on [Industry Trend]"',
    summary: 'Thought leadership CTA that offers industry-specific insights. Positions the sender as a trusted advisor rather than a vendor. Works well for C-suite outreach.',
    serviceLine: 'Data & Analytics',
    targetIndustries: ['Healthcare', 'Finance', 'Manufacturing'],
    targetRoles: ['CDO', 'VP Data', 'CIO', 'CTO'],
    problemsSolved: ['C-suite access barriers', 'Building advisory relationships'],
    supportingEvidence: '35% response rate with C-suite. 73% of recipients open subsequent emails. Builds multi-threaded relationships.',
    version: 1,
    isActive: true,
    usedInDrafts: 8,
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 8 * 86400000).toISOString(),
    versionHistory: [
      { version: 1, date: new Date(Date.now() - 30 * 86400000).toISOString(), note: 'Initial CTA' },
    ],
  },

  // ── Archived items (2) ──
  {
    id: 'cap-arch-1',
    category: 'service_line',
    title: 'Legacy On-Premise Support (Deprecated)',
    summary: 'Legacy on-premise infrastructure support services. Being phased out in favor of cloud-native offerings. Retained for reference only.',
    serviceLine: 'Cloud & Infrastructure',
    targetIndustries: ['Finance', 'Manufacturing'],
    targetRoles: ['IT Director', 'VP Engineering'],
    problemsSolved: ['Legacy system maintenance'],
    supportingEvidence: 'This service line was deprecated in Q1 2025. All clients migrated to cloud support packages. Refer to Cloud & Infrastructure service line.',
    version: 4,
    isActive: false,
    usedInDrafts: 0,
    createdAt: new Date(Date.now() - 365 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 90 * 86400000).toISOString(),
    versionHistory: [
      { version: 1, date: new Date(Date.now() - 365 * 86400000).toISOString(), note: 'Initial service line' },
      { version: 2, date: new Date(Date.now() - 270 * 86400000).toISOString(), note: 'Updated support scope' },
      { version: 3, date: new Date(Date.now() - 180 * 86400000).toISOString(), note: 'Deprecation notice' },
      { version: 4, date: new Date(Date.now() - 90 * 86400000).toISOString(), note: 'Fully deprecated and archived' },
    ],
  },
  {
    id: 'cap-arch-2',
    category: 'proof_point',
    title: '99.5% Uptime SLA (Legacy)',
    summary: 'Previous uptime SLA guarantee of 99.5%. Updated to 99.9% in Q4 2024. Retained for historical reference and contract comparisons.',
    serviceLine: 'Cloud & Infrastructure',
    targetIndustries: ['Technology', 'Finance'],
    targetRoles: ['CTO', 'VP Engineering'],
    problemsSolved: ['Uptime guarantees'],
    supportingEvidence: 'This SLA was upgraded to 99.9% in Q4 2024. All new contracts use the updated SLA. See updated proof point for current metrics.',
    version: 2,
    isActive: false,
    usedInDrafts: 0,
    createdAt: new Date(Date.now() - 200 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 120 * 86400000).toISOString(),
    versionHistory: [
      { version: 1, date: new Date(Date.now() - 200 * 86400000).toISOString(), note: 'Initial SLA' },
      { version: 2, date: new Date(Date.now() - 120 * 86400000).toISOString(), note: 'Archived — superseded by 99.9% SLA' },
    ],
  },
];

// ── Enhanced Draft Data ───────────────────────────────────────────

export type DraftReviewStatus = 'generated' | 'reviewed' | 'approved' | 'rejected';

export interface CapabilitySnippetRef {
  id: string;
  capabilityId: string;
  capabilityTitle: string;
  excerpt: string;
}

export interface DraftAssumption {
  id: string;
  flag: string;
  description: string;
}

export interface EnhancedDraft {
  id: string;
  contactId: string;
  contactName: string;
  contactTitle: string;
  contactEmail: string;
  contactRoleBucket: string;
  contactEmailHealth: string;
  contactEmailHealthScore: number;
  contactScore: number;
  companyId: string;
  companyName: string;
  companyIndustry: string;
  companySize: string;
  companyResearchSummary: string;
  companyPainPoints: string[];
  subject: string;
  body: string;
  cta: string;
  confidenceScore: number;
  confidenceExplanation: string;
  status: DraftReviewStatus;
  assumptionFlags: DraftAssumption[];
  capabilitySnippets: CapabilitySnippetRef[];
  modelUsed: string;
  tokensConsumed: number;
  estimatedCost: number;
  createdAt: string;
  reviewNotes: string;
}

export const MOCK_ENHANCED_DRAFTS: EnhancedDraft[] = [
  {
    id: 'edraft-1',
    contactId: 'cont-1',
    contactName: 'Sarah Johnson',
    contactTitle: 'VP of Engineering',
    contactEmail: 'sarah@acmecorp.com',
    contactRoleBucket: 'Decision Maker',
    contactEmailHealth: 'Valid',
    contactEmailHealthScore: 95,
    contactScore: 87,
    companyId: 'comp-1',
    companyName: 'Acme Corp',
    companyIndustry: 'Technology',
    companySize: '500-1000',
    companyResearchSummary: 'Acme Corp is a mid-market technology company undergoing digital transformation. They recently raised Series C and are scaling engineering from 40 to 80. Current tech stack includes legacy Java services being migrated to microservices.',
    companyPainPoints: ['Legacy system modernization', 'Engineering team scaling', 'Microservices migration complexity'],
    subject: 'How Acme Corp accelerated microservices migration — and what it means for your scaling team',
    body: `Hi Sarah,\n\nI noticed Acme Corp recently closed your Series C — congratulations. Scaling from 40 to 80 engineers while migrating from monolithic Java services to microservices is exactly the kind of challenge we help technology companies navigate.\n\nWe recently worked with a similar-sized technology company that was facing the same microservices migration. Within 4 months, they had 120+ services running on Kubernetes with zero downtime — and their deployment frequency went from weekly to multiple times per day.\n\nA few things that made the difference:\n\n1. **Incremental strangler fig pattern** — no big-bang rewrites\n2. **Automated testing pipeline** that caught 94% of regressions pre-merge\n3. **Team topology aligned to service boundaries** (following Team Topologies)\n\nI put together a brief on common microservices migration pitfalls for companies at your stage — would it be helpful if I sent it over?\n\nBest,\nRavi`,
    cta: 'Would it be helpful if I sent over the microservices migration brief?',
    confidenceScore: 92,
    confidenceExplanation: 'High confidence: Strong company research match, verified contact with valid email, multiple relevant capability snippets, and industry-specific proof points.',
    status: 'generated',
    assumptionFlags: [
      { id: 'af-1', flag: 'Funding Assumption', description: 'Assumed Series C based on LinkedIn activity — not confirmed from public filings' },
      { id: 'af-2', flag: 'Tech Stack Assumption', description: 'Java monolith inferred from job postings — actual stack may differ' },
    ],
    capabilitySnippets: [
      { id: 'cs-1', capabilityId: 'cap-svc-1', capabilityTitle: 'AI-Powered Sales Intelligence Platform', excerpt: 'Deployed across 120+ enterprise clients. Average client sees 3.2x improvement in email response rates.' },
      { id: 'cs-2', capabilityId: 'cap-pp-1', capabilityTitle: '3.2x Average Email Response Rate Improvement', excerpt: 'Verified metric across 120+ enterprise clients showing consistent 3.2x improvement.' },
      { id: 'cs-3', capabilityId: 'cap-cta-5', capabilityTitle: 'Consultative: Thought Leadership CTA', excerpt: '35% response rate with C-suite. 73% of recipients open subsequent emails.' },
    ],
    modelUsed: 'claude-3.5-sonnet',
    tokensConsumed: 1847,
    estimatedCost: 0.028,
    createdAt: new Date(Date.now() - 0.5 * 86400000).toISOString(),
    reviewNotes: '',
  },
  {
    id: 'edraft-2',
    contactId: 'cont-2',
    contactName: 'Mike Chen',
    contactTitle: 'CTO',
    contactEmail: 'mike.chen@acmecorp.com',
    contactRoleBucket: 'Decision Maker',
    contactEmailHealth: 'Valid',
    contactEmailHealthScore: 92,
    contactScore: 91,
    companyId: 'comp-1',
    companyName: 'Acme Corp',
    companyIndustry: 'Technology',
    companySize: '500-1000',
    companyResearchSummary: 'Mike Chen is the CTO at Acme Corp, leading the technical vision for their platform. He has been vocal about cloud-native transformation and recently spoke at KubeCon about their containerization journey.',
    companyPainPoints: ['Cloud cost optimization', 'Engineering productivity', 'Platform reliability'],
    subject: 'Cloud costs, KubeCon, and the 34% number that caught my attention',
    body: `Hi Mike,\n\nGreat talk at KubeCon last month — your approach to progressive containerization was spot on.\n\nOne thing that came up in your Q&A about cost management resonated with what we see across our cloud clients: containerization without right-sizing often leads to unexpected cost increases before the savings kick in.\n\nWe helped Global Finance Solutions (similar scale to Acme Corp) migrate 200+ microservices to AWS and reduced their infrastructure costs by 34% — from $5.6M to $3.2M annually. The key was a systematic right-sizing exercise in month 2 that most teams skip.\n\nWould a quick 30-minute call be worth your time this week? I'd love to share the cost optimization playbook we developed.\n\nBest,\nRavi`,
    cta: 'Can we schedule a 30-min call this week to discuss the cloud cost optimization playbook?',
    confidenceScore: 88,
    confidenceExplanation: 'High confidence: Recent KubeCon speaking engagement provides strong personalization hook. Cloud cost optimization is a verified pain point. Multiple relevant proof points.',
    status: 'generated',
    assumptionFlags: [
      { id: 'af-3', flag: 'Event Assumption', description: 'KubeCon talk confirmed from public event listings — reliable signal' },
    ],
    capabilitySnippets: [
      { id: 'cs-4', capabilityId: 'cap-svc-2', capabilityTitle: 'Cloud Infrastructure Modernization', excerpt: 'Migrated 45 enterprise workloads with zero-downtime. Average cost reduction of 34%.' },
      { id: 'cs-5', capabilityId: 'cap-pp-2', capabilityTitle: '34% Average Cloud Cost Reduction', excerpt: 'Average infrastructure cost reduction of 34% across 45+ projects.' },
      { id: 'cs-6', capabilityId: 'cap-cs-2', capabilityTitle: 'Global Finance Solutions: $2.4M Cloud Savings', excerpt: 'Migrated 200+ microservices to AWS, 99.99% uptime, costs reduced by $2.4M.' },
      { id: 'cs-7', capabilityId: 'cap-cta-2', capabilityTitle: 'Direct: Meeting Request CTA', excerpt: '31% acceptance rate when used with warm leads.' },
    ],
    modelUsed: 'claude-3.5-sonnet',
    tokensConsumed: 2103,
    estimatedCost: 0.032,
    createdAt: new Date(Date.now() - 1 * 86400000).toISOString(),
    reviewNotes: '',
  },
  {
    id: 'edraft-3',
    contactId: 'cont-4',
    contactName: 'James Wilson',
    contactTitle: 'CFO',
    contactEmail: 'j.wilson@gfsolutions.com',
    contactRoleBucket: 'Decision Maker',
    contactEmailHealth: 'Valid',
    contactEmailHealthScore: 90,
    contactScore: 85,
    companyId: 'comp-3',
    companyName: 'Global Finance Solutions',
    companyIndustry: 'Finance',
    companySize: '1000-5000',
    companyResearchSummary: 'Global Finance Solutions is a UK-based financial services firm. Under increasing regulatory pressure (DORA compliance deadline) with public goals to reduce operational costs by 15% this fiscal year.',
    companyPainPoints: ['DORA compliance deadline', 'Operational cost reduction targets', 'Legacy system consolidation'],
    subject: 'DORA compliance + 15% cost reduction — how we helped a similar financial firm do both',
    body: `Hi James,\n\nWith the DORA compliance deadline approaching, I imagine your team is balancing regulatory requirements against the board's 15% cost reduction mandate — a tough combination.\n\nWe recently helped a financial services firm of similar size navigate this exact scenario. By automating 85% of their compliance monitoring and consolidating 3 legacy platforms into one, they achieved SOC 2 certification in 90 days while reducing operational costs by 22%.\n\nThe key was tackling compliance automation first — it generated immediate cost savings that funded the broader modernization effort.\n\nWould it be helpful if I shared a brief ROI estimate tailored to Global Finance Solutions?\n\nBest,\nRavi`,
    cta: 'Would it be helpful if I shared a brief ROI estimate tailored to Global Finance Solutions?',
    confidenceScore: 78,
    confidenceExplanation: 'Good confidence: Regulatory deadline creates strong urgency. Cost reduction mandate is publicly stated. DORA readiness level is unknown.',
    status: 'generated',
    assumptionFlags: [
      { id: 'af-4', flag: 'Regulatory Assumption', description: 'DORA readiness level assumed from industry patterns — not confirmed' },
      { id: 'af-5', flag: 'Budget Assumption', description: '15% cost reduction target from annual report — may have been revised' },
    ],
    capabilitySnippets: [
      { id: 'cs-8', capabilityId: 'cap-svc-4', capabilityTitle: 'Cybersecurity & Compliance', excerpt: 'SOC 2 Type II certified. Protected 200+ organizations. 99.7% client retention.' },
      { id: 'cs-9', capabilityId: 'cap-cs-4', capabilityTitle: 'TechVentures Inc: SOC 2 Certification in 90 Days', excerpt: 'Achieved SOC 2 Type II certification in 90 days. Automated 85% of compliance monitoring.' },
      { id: 'cs-10', capabilityId: 'cap-cta-3', capabilityTitle: 'Soft: ROI Estimate CTA', excerpt: '38% response rate. 82% agree to discovery call after receiving ROI estimate.' },
    ],
    modelUsed: 'claude-3.5-sonnet',
    tokensConsumed: 1956,
    estimatedCost: 0.029,
    createdAt: new Date(Date.now() - 1.5 * 86400000).toISOString(),
    reviewNotes: '',
  },
  {
    id: 'edraft-4',
    contactId: 'cont-5',
    contactName: 'Dr. Emily Brown',
    contactTitle: 'Director of Innovation',
    contactEmail: 'emily.b@healthtechplus.com',
    contactRoleBucket: 'Champion',
    contactEmailHealth: 'Risky',
    contactEmailHealthScore: 60,
    contactScore: 72,
    companyId: 'comp-4',
    companyName: 'HealthTech Plus',
    companyIndustry: 'Healthcare',
    companySize: '250-500',
    companyResearchSummary: 'HealthTech Plus is a Boston-based healthcare technology company focused on patient data analytics. They recently published a paper on AI-assisted diagnostics.',
    companyPainPoints: ['HIPAA compliance complexity', 'Data platform scalability', 'Research-to-production pipeline'],
    subject: 'Building on your AI diagnostics research — a data platform perspective',
    body: `Hi Dr. Brown,\n\nI read your recent paper on AI-assisted diagnostics with great interest — your approach to federated learning in clinical settings was particularly insightful.\n\nThe challenge of moving from research-grade AI models to production-grade data platforms is one we see often in healthcare. We built a HIPAA-compliant analytics platform for a similar healthcare company that processes 2M+ patient records daily, and they passed their HIPAA audit on the first attempt.\n\nWhat made it work was designing compliance into the data architecture from day one — not bolting it on after the fact.\n\nI'd love to share the architecture patterns we developed. Would a brief call this week work for you?\n\nBest,\nRavi`,
    cta: 'Would a brief call this week work for you to discuss healthcare data architecture patterns?',
    confidenceScore: 55,
    confidenceExplanation: 'Moderate confidence: Strong personalization from published research. Healthcare expertise verified. Email health is risky (60) which may affect deliverability.',
    status: 'generated',
    assumptionFlags: [
      { id: 'af-6', flag: 'Email Risk', description: 'Email health score is 60 (risky) — may not reach inbox' },
      { id: 'af-7', flag: 'Budget Assumption', description: 'Assumed platform budget based on company size — not confirmed' },
      { id: 'af-8', flag: 'Research Assumption', description: 'Paper topic confirmed but specific technical approach inferred' },
    ],
    capabilitySnippets: [
      { id: 'cs-11', capabilityId: 'cap-cs-3', capabilityTitle: 'HealthTech Plus: HIPAA Data Platform in 8 Weeks', excerpt: 'Built HIPAA-compliant analytics platform, processing 2M+ patient records daily.' },
      { id: 'cs-12', capabilityId: 'cap-svc-3', capabilityTitle: 'Data Engineering & Analytics', excerpt: 'Built data platforms processing 50TB+ daily for Fortune 500 clients.' },
      { id: 'cs-13', capabilityId: 'cap-cta-2', capabilityTitle: 'Direct: Meeting Request CTA', excerpt: '31% acceptance rate when used with warm leads.' },
    ],
    modelUsed: 'claude-3.5-sonnet',
    tokensConsumed: 1723,
    estimatedCost: 0.026,
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    reviewNotes: '',
  },
  {
    id: 'edraft-5',
    contactId: 'cont-6',
    contactName: 'David Park',
    contactTitle: 'VP of Cloud Infrastructure',
    contactEmail: 'david.park@cloudscale.dev',
    contactRoleBucket: 'Decision Maker',
    contactEmailHealth: 'Valid',
    contactEmailHealthScore: 97,
    contactScore: 93,
    companyId: 'comp-6',
    companyName: 'CloudScale Systems',
    companyIndustry: 'Cloud Computing',
    companySize: '1000-5000',
    companyResearchSummary: 'CloudScale Systems is a Seattle-based cloud infrastructure company. David leads their cloud infrastructure division and has been actively hiring for automation and DevOps roles.',
    companyPainPoints: ['Customer onboarding automation', 'Support workflow optimization', 'Operational efficiency at scale'],
    subject: '280% ROI from automating what your new DevOps hires are currently doing manually',
    body: `Hi David,\n\nI saw CloudScale is hiring several DevOps and automation engineers — smart move given the scale you're operating at.\n\nWe worked with a cloud infrastructure company facing similar growing pains. They were spending 40% of their engineering time on repeatable operational tasks — customer onboarding, environment provisioning, incident response playbooks.\n\nBy automating 12 core workflows, they achieved 280% ROI in year one and reduced customer onboarding from 14 days to 3 days. Their new hires could then focus on the interesting problems instead of manual processes.\n\nMind if I share a 2-minute case study on the specific workflows we automated?\n\nBest,\nRavi`,
    cta: 'Mind if I share a 2-minute case study on the automation workflows?',
    confidenceScore: 85,
    confidenceExplanation: 'High confidence: Hiring activity is a strong buying signal. Cloud infrastructure expertise is directly relevant. Email health is excellent (97).',
    status: 'approved',
    assumptionFlags: [
      { id: 'af-9', flag: 'Hiring Assumption', description: 'Hiring for DevOps roles inferred from LinkedIn — suggests automation need but not confirmed' },
    ],
    capabilitySnippets: [
      { id: 'cs-14', capabilityId: 'cap-cs-5', capabilityTitle: 'CloudScale Systems: 280% ROI', excerpt: 'Deployed process automation achieving 280% ROI. Onboarding reduced from 14 to 3 days.' },
      { id: 'cs-15', capabilityId: 'cap-svc-6', capabilityTitle: 'Process Automation & AI Integration', excerpt: 'Automated 500+ processes across 60 organizations. Average ROI of 280% in year one.' },
      { id: 'cs-16', capabilityId: 'cap-cta-1', capabilityTitle: 'Consultative: Case Study CTA', excerpt: '42% response rate when paired with industry-relevant case study.' },
    ],
    modelUsed: 'claude-3.5-sonnet',
    tokensConsumed: 2011,
    estimatedCost: 0.030,
    createdAt: new Date(Date.now() - 2.5 * 86400000).toISOString(),
    reviewNotes: 'Strong draft. Approved for sending Thursday.',
  },
  {
    id: 'edraft-6',
    contactId: 'cont-3',
    contactName: 'Priya Sharma',
    contactTitle: 'Head of Product',
    contactEmail: 'priya@techventures.io',
    contactRoleBucket: 'Influencer',
    contactEmailHealth: 'Valid',
    contactEmailHealthScore: 88,
    contactScore: 76,
    companyId: 'comp-2',
    companyName: 'TechVentures Inc',
    companyIndustry: 'SaaS',
    companySize: '100-250',
    companyResearchSummary: 'TechVentures Inc is a Bangalore-based SaaS startup focused on enterprise adoption. They recently launched v3.0 and completed SOC 2 certification.',
    companyPainPoints: ['Enterprise sales motion', 'Compliance as growth enabler', 'Product-led to sales-led transition'],
    subject: 'SOC 2 as a growth lever — not just a compliance checkbox',
    body: `Hi Priya,\n\nCongratulations on the TechVentures v3.0 launch — the new enterprise features look compelling.\n\nNow that you have SOC 2 certified, I've noticed many SaaS companies in your position treat compliance as a checkbox exercise when it could actually be a growth accelerator.\n\nWe worked with a SaaS company (100-250 employees, similar to TechVentures) that leveraged their SOC 2 certification as a sales differentiator. By prominently featuring their security posture, they closed 23% more enterprise deals in the quarter following certification.\n\nWould love to share how they positioned it. Worth a quick chat?\n\nBest,\nRavi`,
    cta: 'Would a quick chat this week be worth your time to discuss positioning compliance as a growth lever?',
    confidenceScore: 72,
    confidenceExplanation: 'Moderate confidence: SOC 2 certification is a strong hook. As Head of Product (influencer), buying authority is less clear.',
    status: 'rejected',
    assumptionFlags: [
      { id: 'af-10', flag: 'Authority Assumption', description: 'Head of Product may not have budget authority for consulting services' },
      { id: 'af-11', flag: 'SOC 2 Assumption', description: 'SOC 2 certification confirmed from company announcement — reliable' },
    ],
    capabilitySnippets: [
      { id: 'cs-17', capabilityId: 'cap-cs-4', capabilityTitle: 'TechVentures: SOC 2 in 90 Days', excerpt: 'Achieved SOC 2 Type II certification in 90 days. Automated 85% of compliance monitoring.' },
      { id: 'cs-18', capabilityId: 'cap-cta-2', capabilityTitle: 'Direct: Meeting Request CTA', excerpt: '31% acceptance rate when used with warm leads.' },
    ],
    modelUsed: 'claude-3.5-sonnet',
    tokensConsumed: 1890,
    estimatedCost: 0.028,
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    reviewNotes: 'Rejected: Priya is not the right persona. Need to identify the CTO or VP Engineering.',
  },
  {
    id: 'edraft-7',
    contactId: 'cont-6',
    contactName: 'David Park',
    contactTitle: 'VP of Cloud Infrastructure',
    contactEmail: 'david.park@cloudscale.dev',
    contactRoleBucket: 'Decision Maker',
    contactEmailHealth: 'Valid',
    contactEmailHealthScore: 97,
    contactScore: 93,
    companyId: 'comp-6',
    companyName: 'CloudScale Systems',
    companyIndustry: 'Cloud Computing',
    companySize: '1000-5000',
    companyResearchSummary: 'CloudScale Systems is expanding their multi-cloud offerings. Recent job postings suggest investment in Azure and GCP capabilities alongside existing AWS presence.',
    companyPainPoints: ['Multi-cloud complexity', 'Talent acquisition for cloud', 'Cost optimization across providers'],
    subject: 'Multi-cloud cost optimization — the playbook for companies operating across AWS, Azure, and GCP',
    body: `Hi David,\n\nFollowing up on our conversation about automation — I wanted to share something else we've been seeing with cloud infrastructure companies at CloudScale's scale.\n\nMulti-cloud cost optimization is becoming a critical challenge. Companies running workloads across AWS, Azure, and GCP often see 20-30% cost leakage from unoptimized cross-cloud data transfer, redundant services, and misaligned reserved instance strategies.\n\nWe developed a systematic approach that reduced one client's multi-cloud spend by 28% — without changing any application architecture.\n\nWould it be helpful if I sent over the multi-cloud cost optimization playbook?\n\nBest,\nRavi`,
    cta: 'Would it be helpful if I sent over the multi-cloud cost optimization playbook?',
    confidenceScore: 82,
    confidenceExplanation: 'Good confidence: Follow-up to existing conversation. Multi-cloud pain point is industry-validated. Previous approved draft establishes relationship.',
    status: 'reviewed',
    assumptionFlags: [
      { id: 'af-12', flag: 'Multi-cloud Assumption', description: 'Multi-cloud strategy inferred from job postings — not confirmed' },
    ],
    capabilitySnippets: [
      { id: 'cs-19', capabilityId: 'cap-svc-2', capabilityTitle: 'Cloud Infrastructure Modernization', excerpt: 'Specialized in AWS, Azure, and GCP. Average cost reduction of 34%.' },
      { id: 'cs-20', capabilityId: 'cap-pp-2', capabilityTitle: '34% Average Cloud Cost Reduction', excerpt: 'Average infrastructure cost reduction of 34% across 45+ projects.' },
      { id: 'cs-21', capabilityId: 'cap-cta-3', capabilityTitle: 'Soft: ROI Estimate CTA', excerpt: '38% response rate. 82% agree to discovery call.' },
    ],
    modelUsed: 'claude-3.5-sonnet',
    tokensConsumed: 1687,
    estimatedCost: 0.025,
    createdAt: new Date(Date.now() - 4 * 86400000).toISOString(),
    reviewNotes: 'Reviewed — looks good. Awaiting final approval from SDR team lead.',
  },
  {
    id: 'edraft-8',
    contactId: 'cont-1',
    contactName: 'Sarah Johnson',
    contactTitle: 'VP of Engineering',
    contactEmail: 'sarah@acmecorp.com',
    contactRoleBucket: 'Decision Maker',
    contactEmailHealth: 'Valid',
    contactEmailHealthScore: 95,
    contactScore: 87,
    companyId: 'comp-1',
    companyName: 'Acme Corp',
    companyIndustry: 'Technology',
    companySize: '500-1000',
    companyResearchSummary: 'Acme Corp has been actively hiring senior backend engineers and DevOps specialists. Their engineering blog recently discussed CI/CD pipeline performance challenges at scale.',
    companyPainPoints: ['CI/CD pipeline performance', 'Engineering velocity', 'Code quality at scale'],
    subject: 'Re: Engineering velocity at scale — a framework that worked for a company like Acme Corp',
    body: `Hi Sarah,\n\nI came across Acme Corp's engineering blog post about CI/CD pipeline challenges — the part about test suite times increasing linearly with team size really resonated.\n\nThis is one of the most common scaling challenges we see, and it has a compounding effect on engineering velocity. One of our clients (similar size, similar growth stage) reduced their average CI/CD pipeline time from 45 minutes to 12 minutes by implementing intelligent test selection and parallel execution.\n\nThe result? 3x more deployments per day and a measurable improvement in developer satisfaction scores.\n\nHappy to share the technical details — would a brief call work this week?\n\nBest,\nRavi`,
    cta: 'Happy to share the technical details — would a brief call work this week?',
    confidenceScore: 90,
    confidenceExplanation: 'High confidence: Engineering blog provides verified, recent personalization hook. CI/CD pain point technically validated.',
    status: 'approved',
    assumptionFlags: [
      { id: 'af-13', flag: 'Blog Content Assumption', description: 'Blog post confirmed from public URL — reliable signal' },
    ],
    capabilitySnippets: [
      { id: 'cs-22', capabilityId: 'cap-svc-5', capabilityTitle: 'Custom Software Development', excerpt: 'Delivered 80+ production applications. Average time-to-market improvement of 40%.' },
      { id: 'cs-23', capabilityId: 'cap-pp-5', capabilityTitle: 'NPS Score of 78 — Top Quartile', excerpt: 'NPS of 78, top quartile for IT services. Zero clients lost due to quality issues.' },
      { id: 'cs-24', capabilityId: 'cap-cta-2', capabilityTitle: 'Direct: Meeting Request CTA', excerpt: '31% acceptance rate when used with warm leads.' },
    ],
    modelUsed: 'claude-3.5-sonnet',
    tokensConsumed: 1756,
    estimatedCost: 0.026,
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    reviewNotes: 'Approved. Strong personalization from blog content. Send on Tuesday morning.',
  },
  {
    id: 'edraft-9',
    contactId: 'cont-4',
    contactName: 'James Wilson',
    contactTitle: 'CFO',
    contactEmail: 'j.wilson@gfsolutions.com',
    contactRoleBucket: 'Decision Maker',
    contactEmailHealth: 'Valid',
    contactEmailHealthScore: 90,
    contactScore: 85,
    companyId: 'comp-3',
    companyName: 'Global Finance Solutions',
    companyIndustry: 'Finance',
    companySize: '1000-5000',
    companyResearchSummary: 'Global Finance Solutions has been expanding European operations. Recently opened a Frankfurt office and is investing in GDPR-compliant data infrastructure.',
    companyPainPoints: ['GDPR compliance at scale', 'Cross-border data governance', 'Infrastructure costs for EU expansion'],
    subject: 'Frankfurt office expansion + GDPR infrastructure — a cost-efficient approach',
    body: `Hi James,\n\nCongratulations on the Frankfurt office opening — expanding into the EU market is a significant milestone.\n\nOne challenge we consistently see with financial services firms expanding into the EU: building GDPR-compliant data infrastructure from scratch can cost 3-4x more than needed if not approached systematically.\n\nWe helped a UK-based financial firm set up their EU data infrastructure with GDPR compliance baked in from day one. They achieved full regulatory compliance in 8 weeks and spent 40% less than their initial vendor quotes.\n\nWould it be helpful if I sent over a brief comparison of our approach vs. traditional methods?\n\nBest,\nRavi`,
    cta: 'Would it be helpful if I sent over a brief comparison of our approach vs. traditional methods?',
    confidenceScore: 65,
    confidenceExplanation: 'Moderate confidence: Frankfurt office is a verified event. GDPR pain point is industry-validated. Unclear if infrastructure decisions have already been made.',
    status: 'rejected',
    assumptionFlags: [
      { id: 'af-14', flag: 'Timing Assumption', description: 'Frankfurt office confirmed but unclear if infrastructure RFP has already been issued' },
      { id: 'af-15', flag: 'Decision Stage Assumption', description: 'May be too late in buying cycle — may have already selected vendors' },
    ],
    capabilitySnippets: [
      { id: 'cs-25', capabilityId: 'cap-svc-4', capabilityTitle: 'Cybersecurity & Compliance', excerpt: 'Protected 200+ organizations. 99.7% client retention rate.' },
      { id: 'cs-26', capabilityId: 'cap-cta-1', capabilityTitle: 'Consultative: Case Study CTA', excerpt: '42% response rate when paired with industry-relevant case study.' },
    ],
    modelUsed: 'claude-3.5-sonnet',
    tokensConsumed: 1598,
    estimatedCost: 0.024,
    createdAt: new Date(Date.now() - 6 * 86400000).toISOString(),
    reviewNotes: 'Rejected: Timing concern — Frankfurt office may already have selected vendors.',
  },
  {
    id: 'edraft-10',
    contactId: 'cont-3',
    contactName: 'Priya Sharma',
    contactTitle: 'Head of Product',
    contactEmail: 'priya@techventures.io',
    contactRoleBucket: 'Influencer',
    contactEmailHealth: 'Valid',
    contactEmailHealthScore: 88,
    contactScore: 76,
    companyId: 'comp-2',
    companyName: 'TechVentures Inc',
    companyIndustry: 'SaaS',
    companySize: '100-250',
    companyResearchSummary: 'TechVentures Inc is building an AI assistant feature and has been publishing about their LLM integration journey.',
    companyPainPoints: ['AI feature development', 'Enterprise feature parity', 'Product differentiation'],
    subject: 'AI features in SaaS — what we learned building AI-powered products for 80+ clients',
    body: `Hi Priya,\n\nI've been following TechVentures' updates on your AI assistant feature — the approach to contextual task suggestions is clever.\n\nBuilding AI features into SaaS products comes with a unique set of challenges we've seen across 80+ product builds. The three most common pitfalls:\n\n1. **Latency tolerance** — users expect sub-200ms AI responses\n2. **Context window management** — feeding the right context without ballooning token costs\n3. **Graceful degradation** — what happens when the AI model is unavailable\n\nWe've developed production patterns for all three that are battle-tested across multiple SaaS products.\n\nWould love to share our learnings. Worth a 20-minute call?\n\nBest,\nRavi`,
    cta: 'Worth a 20-minute call to share AI feature production patterns?',
    confidenceScore: 75,
    confidenceExplanation: 'Moderate confidence: AI feature development is a strong hook. Product engineering expertise verified. As product leader, she may not control vendor selection.',
    status: 'generated',
    assumptionFlags: [
      { id: 'af-16', flag: 'Persona Match', description: 'Head of Product is strong for technical conversation but may lack purchasing authority' },
    ],
    capabilitySnippets: [
      { id: 'cs-27', capabilityId: 'cap-svc-5', capabilityTitle: 'Custom Software Development', excerpt: 'Delivered 80+ production applications. Teams of 5-15 engineers available within 2 weeks.' },
      { id: 'cs-28', capabilityId: 'cap-cta-2', capabilityTitle: 'Direct: Meeting Request CTA', excerpt: '31% acceptance rate when used with warm leads.' },
    ],
    modelUsed: 'claude-3.5-sonnet',
    tokensConsumed: 1645,
    estimatedCost: 0.025,
    createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    reviewNotes: '',
  },
  {
    id: 'edraft-11',
    contactId: 'cont-2',
    contactName: 'Mike Chen',
    contactTitle: 'CTO',
    contactEmail: 'mike.chen@acmecorp.com',
    contactRoleBucket: 'Decision Maker',
    contactEmailHealth: 'Valid',
    contactEmailHealthScore: 92,
    contactScore: 91,
    companyId: 'comp-1',
    companyName: 'Acme Corp',
    companyIndustry: 'Technology',
    companySize: '500-1000',
    companyResearchSummary: 'Mike Chen is exploring Kubernetes-native development approaches and has posted about service mesh adoption on their engineering blog.',
    companyPainPoints: ['Service mesh complexity', 'Observability gaps', 'Platform engineering maturity'],
    subject: 'Service mesh without the complexity — what we learned from 15 enterprise K8s deployments',
    body: `Hi Mike,\n\nYour recent post about service mesh adoption challenges really hit home. We've seen the same pattern across our clients — teams adopt a service mesh for observability and security, then spend months wrestling with the operational complexity.\n\nAfter 15 enterprise Kubernetes deployments, we've refined an approach that gives you 80% of the service mesh benefits with 20% of the complexity. The key insight: most teams don't need a full Istio deployment — a lighter-weight sidecar pattern with strategic use of egress/ingress gates covers most use cases.\n\nWe documented the decision framework we use to help teams choose the right level of service mesh investment. Happy to share it.\n\nBest,\nRavi`,
    cta: 'Happy to share the service mesh decision framework — would 20 minutes work this week?',
    confidenceScore: 86,
    confidenceExplanation: 'High confidence: Blog post provides verified personalization. K8s expertise is directly relevant. Previous interaction establishes warm relationship.',
    status: 'generated',
    assumptionFlags: [
      { id: 'af-17', flag: 'Blog Assumption', description: 'Service mesh blog post confirmed — reliable' },
    ],
    capabilitySnippets: [
      { id: 'cs-29', capabilityId: 'cap-svc-2', capabilityTitle: 'Cloud Infrastructure Modernization', excerpt: 'Migrated 45 enterprise workloads. Zero-downtime track record.' },
      { id: 'cs-30', capabilityId: 'cap-pp-4', capabilityTitle: 'Zero-Downtime Migration Track Record', excerpt: '45 consecutive migrations with zero unplanned downtime.' },
      { id: 'cs-31', capabilityId: 'cap-cta-2', capabilityTitle: 'Direct: Meeting Request CTA', excerpt: '31% acceptance rate when used with warm leads.' },
    ],
    modelUsed: 'claude-3.5-sonnet',
    tokensConsumed: 1834,
    estimatedCost: 0.028,
    createdAt: new Date(Date.now() - 0.2 * 86400000).toISOString(),
    reviewNotes: '',
  },
  {
    id: 'edraft-12',
    contactId: 'cont-5',
    contactName: 'Dr. Emily Brown',
    contactTitle: 'Director of Innovation',
    contactEmail: 'emily.b@healthtechplus.com',
    contactRoleBucket: 'Champion',
    contactEmailHealth: 'Risky',
    contactEmailHealthScore: 60,
    contactScore: 72,
    companyId: 'comp-4',
    companyName: 'HealthTech Plus',
    companyIndustry: 'Healthcare',
    companySize: '250-500',
    companyResearchSummary: 'HealthTech Plus is expanding their AI diagnostics capabilities and looking for data engineering partners to support their clinical validation pipeline.',
    companyPainPoints: ['Clinical data pipeline reliability', 'AI model deployment at scale', 'Regulatory validation support'],
    subject: 'Clinical validation pipelines — the data engineering challenge behind AI diagnostics',
    body: `Hi Dr. Brown,\n\nFollowing up on my previous note about healthcare data architecture — I wanted to share something more specific to the clinical validation challenge.\n\nOne of our healthcare clients faced the same challenge: their AI diagnostics models worked great in research but struggled in clinical validation due to data pipeline reliability issues. We built them a dedicated clinical validation data pipeline that:\n\n- Processes 500K+ clinical events per day with 99.97% reliability\n- Maintains full audit trail for FDA submission requirements\n- Reduced their validation cycle from 6 months to 8 weeks\n\nThe architectural patterns we developed are now being used by 4 other healthcare companies.\n\nWould it be helpful if I shared a technical overview?\n\nBest,\nRavi`,
    cta: 'Would it be helpful if I shared a technical overview of the clinical validation pipeline?',
    confidenceScore: 48,
    confidenceExplanation: 'Lower confidence: Follow-up to previous email (status unknown). Email health is risky (60). Clinical validation topic is relevant but timing is uncertain.',
    status: 'generated',
    assumptionFlags: [
      { id: 'af-18', flag: 'Email Risk', description: 'Email health score is 60 (risky) — may not reach inbox' },
      { id: 'af-19', flag: 'Follow-up Status', description: 'Unknown if previous email was received or read' },
      { id: 'af-20', flag: 'Budget Timing', description: 'Clinical validation budget cycle is uncertain' },
    ],
    capabilitySnippets: [
      { id: 'cs-32', capabilityId: 'cap-svc-3', capabilityTitle: 'Data Engineering & Analytics', excerpt: 'Built data platforms processing 50TB+ daily for Fortune 500 clients.' },
      { id: 'cs-33', capabilityId: 'cap-cta-1', capabilityTitle: 'Consultative: Case Study CTA', excerpt: '42% response rate when paired with industry-relevant case study.' },
    ],
    modelUsed: 'claude-3.5-sonnet',
    tokensConsumed: 1567,
    estimatedCost: 0.024,
    createdAt: new Date(Date.now() - 0.1 * 86400000).toISOString(),
    reviewNotes: '',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// Additional exports — aliases and extended mock data
// ═══════════════════════════════════════════════════════════════════════════

// ── Audit Aliases ────────────────────────────────────────────────────────
export const MOCK_AUDIT_ENTRIES = MOCK_AUDIT_LOGS;
export type AuditEntry = AuditLog;

// ── Duplicate Aliases ────────────────────────────────────────────────────
export type DuplicateStatus = DuplicateReviewStatus;

// ── Merge History ────────────────────────────────────────────────────────
export interface MergeHistoryEntry {
  id: string;
  survivorName: string;
  survivorEmail: string;
  mergedName: string;
  mergedEmail: string;
  matchScore: number;
  fieldsResolved: number;
  reason: string;
  resolvedBy: string;
  resolvedAt: string;
}

export const MOCK_MERGE_HISTORY: MergeHistoryEntry[] = [
  {
    id: 'mrg-001',
    survivorName: 'Arjun Mehta',
    survivorEmail: 'arjun.mehta@nexuscore.io',
    mergedName: 'Arjun Mehata',
    mergedEmail: 'arjun.mehata@nexuscore.io',
    matchScore: 94,
    fieldsResolved: 3,
    reason: 'Typo in last name — email domain and LinkedIn matched exactly',
    resolvedBy: 'Ravi Shanker',
    resolvedAt: '2025-05-21T10:15:00Z',
  },
  {
    id: 'mrg-002',
    survivorName: 'Priya Deshpande',
    survivorEmail: 'priya.d@fintechlabs.co',
    mergedName: 'Priya D.',
    mergedEmail: 'priya.deshpande@fintechlabs.co',
    matchScore: 87,
    fieldsResolved: 2,
    reason: 'Abbreviated name variant — same company, same role, LinkedIn confirmed',
    resolvedBy: 'Anita Krishnamurthy',
    resolvedAt: '2025-06-02T14:30:00Z',
  },
  {
    id: 'mrg-003',
    survivorName: 'Rohan Kulkarni',
    survivorEmail: 'rohan.k@quantumleap.tech',
    mergedName: 'Rohan S. Kulkarni',
    mergedEmail: 'rohan.kulkarni@quantumleap.tech',
    matchScore: 79,
    fieldsResolved: 1,
    reason: 'Middle initial variation in import — phone number confirmed match',
    resolvedBy: 'Ravi Shanker',
    resolvedAt: '2025-06-04T09:45:00Z',
  },
  {
    id: 'mrg-004',
    survivorName: 'Nisha Agarwal',
    survivorEmail: 'nisha.a@cyberguard.sec',
    mergedName: 'Nisha Agarwal',
    mergedEmail: 'nisha.agarwal@cyberguard.sec',
    matchScore: 96,
    fieldsResolved: 4,
    reason: 'Email format change (initial vs full name) — all other fields identical',
    resolvedBy: 'Priti Sahoo',
    resolvedAt: '2025-06-07T11:20:00Z',
  },
];

// ── Send Queue ───────────────────────────────────────────────────────────
export type QueueStatus = 'queued' | 'sending' | 'sent' | 'failed' | 'paused' | 'dry_run';

export interface QueueItem {
  id: string;
  contactName: string;
  contactEmail: string;
  company: string;
  subject: string;
  scheduledFor: string;
  status: QueueStatus;
  mailbox: string;
  draftId: string;
  contactId: string;
}

export const MOCK_QUEUE_ITEMS: QueueItem[] = [
  {
    id: 'que-001',
    contactName: 'Rohan Kulkarni',
    contactEmail: 'rohan.k@quantumleap.tech',
    company: 'QuantumLeap Tech',
    subject: 'Reducing model serving latency — patterns from our fintech engagements',
    scheduledFor: '2025-06-13T09:00:00Z',
    status: 'queued',
    mailbox: 'ravi@deepmindq.io',
    draftId: 'dft-006',
    contactId: 'cnt-003',
  },
  {
    id: 'que-002',
    contactName: 'Sarah Mitchell',
    contactEmail: 's.mitchell@quantumleap.tech',
    company: 'QuantumLeap Tech',
    subject: 'How MLOps teams ship 3x faster with managed Kubernetes',
    scheduledFor: '2025-06-13T09:05:00Z',
    status: 'queued',
    mailbox: 'ravi@deepmindq.io',
    draftId: 'dft-007',
    contactId: 'cnt-004',
  },
  {
    id: 'que-003',
    contactName: 'Nisha Agarwal',
    contactEmail: 'nisha.a@cyberguard.sec',
    company: 'CyberGuard Security',
    subject: 'Reducing alert fatigue — how we helped a SIEM vendor cut false positives by 60%',
    scheduledFor: '2025-06-13T09:15:00Z',
    status: 'sending',
    mailbox: 'ravi@deepmindq.io',
    draftId: 'dft-008',
    contactId: 'cnt-011',
  },
  {
    id: 'que-004',
    contactName: 'Jessica Turner',
    contactEmail: 'jessica.t@healthbridge.io',
    company: 'HealthBridge Digital',
    subject: 'HIPAA-compliant data lake architecture for remote patient monitoring',
    scheduledFor: '2025-06-13T10:00:00Z',
    status: 'queued',
    mailbox: 'anita@deepmindq.io',
    draftId: 'dft-009',
    contactId: 'cnt-009',
  },
  {
    id: 'que-005',
    contactName: 'Ananya Krishnan',
    contactEmail: 'ananya.k@logivista.in',
    company: 'LogiVista',
    subject: 'Unified supply chain visibility — lessons from our largest logistics transformation',
    scheduledFor: '2025-06-13T10:30:00Z',
    status: 'queued',
    mailbox: 'ravi@deepmindq.io',
    draftId: 'dft-010',
    contactId: 'cnt-013',
  },
  {
    id: 'que-006',
    contactName: 'Lisa Wong',
    contactEmail: 'l.wong@dataweave.ai',
    company: 'DataWeave AI',
    subject: 'Optimizing data pipeline costs — how we reduced cloud compute spend by 40%',
    scheduledFor: '2025-06-12T16:00:00Z',
    status: 'sent',
    mailbox: 'ravi@deepmindq.io',
    draftId: 'dft-011',
    contactId: 'cnt-016',
  },
  {
    id: 'que-007',
    contactName: 'Amit Patel',
    contactEmail: 'a.patel@zenithcloud.com',
    company: 'ZenithCloud Solutions',
    subject: 'Cloud migration tooling — automating assessments at scale',
    scheduledFor: '2025-06-12T14:30:00Z',
    status: 'failed',
    mailbox: 'ravi@deepmindq.io',
    draftId: 'dft-012',
    contactId: 'cnt-006',
  },
  {
    id: 'que-008',
    contactName: 'Karthik Sundaram',
    contactEmail: 'karthik.s@logivista.in',
    company: 'LogiVista',
    subject: 'Real-time tracking infrastructure — handling 200+ city fleet data',
    scheduledFor: '2025-06-14T09:00:00Z',
    status: 'dry_run',
    mailbox: 'anita@deepmindq.io',
    draftId: 'dft-013',
    contactId: 'cnt-014',
  },
];

export const MOCK_QUEUE_STATS = {
  pending: 8,
  scheduled: 3,
  failed: 2,
  sentToday: 45,
  dailyLimit: 200,
  isPaused: false,
};

// ── Reply Alias ──────────────────────────────────────────────────────────
export type ReplyItem = InboundReply;

// ── Suppressed Contacts ──────────────────────────────────────────────────
export interface SuppressedContact {
  id: string;
  contactName: string;
  contactEmail: string;
  company: string;
  suppressionType: SuppressionType;
  reason: string;
  isActive: boolean;
  createdAt: string;
}

export const MOCK_SUPPRESSED_CONTACTS: SuppressedContact[] = [
  {
    id: 'sup-001',
    contactName: 'Michael Chen',
    contactEmail: 'm.chen@dataweave.ai',
    company: 'DataWeave AI',
    suppressionType: 'unsubscribed',
    reason: 'Recipient replied with "Please remove me from your mailing list"',
    isActive: true,
    createdAt: '2025-05-28T08:30:00Z',
  },
  {
    id: 'sup-002',
    contactName: 'Dr. Sanjay Gupta',
    contactEmail: 's.gupta@healthbridge.io',
    company: 'HealthBridge Digital',
    suppressionType: 'bounce_hard',
    reason: 'Hard bounce — recipient mailbox does not exist (550)',
    isActive: true,
    createdAt: '2025-06-07T14:01:00Z',
  },
  {
    id: 'sup-003',
    contactName: 'Rajesh Iyer',
    contactEmail: 'rajesh.i@smartscalehq.com',
    company: 'SmartScale HQ',
    suppressionType: 'bounce_hard',
    reason: 'Hard bounce — recipient domain rejected sender',
    isActive: true,
    createdAt: '2025-05-22T10:31:00Z',
  },
  {
    id: 'sup-004',
    contactName: 'Rahul Verma',
    contactEmail: 'rahul.v@fintechlabs.co',
    company: 'FinTech Labs',
    suppressionType: 'manual_dnc',
    reason: 'Do not contact — company selected a competitor. Re-evaluate in Q3 2025.',
    isActive: true,
    createdAt: '2025-06-10T08:00:00Z',
  },
];

// ── Settings: Import Profiles ────────────────────────────────────────────
export interface ImportProfile {
  id: string;
  name: string;
  headerHash: string;
  mappingCount: number;
  lastUsedAt: string;
}

export const MOCK_IMPORT_PROFILES: ImportProfile[] = [
  {
    id: 'prf-001',
    name: 'Standard Lead Import',
    headerHash: 'sha256:4a7f2c1e8b3d6f9a2c1e8b3d6f9a2c1e8b3d6f9a2c1e8b3d6f9a2c1e8b3d6f9',
    mappingCount: 14,
    lastUsedAt: '2025-06-10T14:30:00Z',
  },
  {
    id: 'prf-002',
    name: 'LinkedIn Sales Navigator Export',
    headerHash: 'sha256:7b9e3d2f1c4a6e8d7b9e3d2f1c4a6e8d7b9e3d2f1c4a6e8d7b9e3d2f1c4a6e8d',
    mappingCount: 11,
    lastUsedAt: '2025-06-05T09:15:00Z',
  },
  {
    id: 'prf-003',
    name: 'Apollo.io Bulk Export',
    headerHash: 'sha256:1c4e7a9b2d5f8e3c1c4e7a9b2d5f8e3c1c4e7a9b2d5f8e3c1c4e7a9b2d5f8e3c',
    mappingCount: 16,
    lastUsedAt: '2025-06-08T16:45:00Z',
  },
];

// ── Settings: Scoring Rules ──────────────────────────────────────────────
export interface ScoringRule {
  id: string;
  name: string;
  description: string;
  points: number;
  isEnabled: boolean;
  weight: number;
}

export const MOCK_SCORING_RULES: ScoringRule[] = [
  {
    id: 'rule-001',
    name: 'Company fit',
    description: 'Lead company matches target ICP industries and company size bands',
    points: 20,
    isEnabled: true,
    weight: 0.25,
  },
  {
    id: 'rule-002',
    name: 'Role fit',
    description: 'Lead job title falls within target role buckets (executive, manager)',
    points: 15,
    isEnabled: true,
    weight: 0.20,
  },
  {
    id: 'rule-003',
    name: 'Email valid',
    description: 'Email health check returns valid status with score above 80',
    points: 10,
    isEnabled: true,
    weight: 0.15,
  },
  {
    id: 'rule-004',
    name: 'Recent import',
    description: 'Lead was imported within the last 30 days, indicating fresh data',
    points: 5,
    isEnabled: true,
    weight: 0.10,
  },
  {
    id: 'rule-005',
    name: 'Engagement',
    description: 'Lead has previously opened, clicked, or replied to outreach emails',
    points: 25,
    isEnabled: true,
    weight: 0.30,
  },
];

// ── Settings: Team Members ───────────────────────────────────────────────
export interface TeamMemberSettings {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'reviewer' | 'sender' | 'viewer';
  avatar: string;
  isActive: boolean;
}

export const MOCK_TEAM_MEMBERS: TeamMemberSettings[] = [
  {
    id: 'tm-001',
    name: 'Ravi Shanker',
    email: 'ravi@deepmindq.io',
    role: 'admin',
    avatar: 'RS',
    isActive: true,
  },
  {
    id: 'tm-002',
    name: 'Priya Sharma',
    email: 'priya@deepmindq.io',
    role: 'reviewer',
    avatar: 'PS',
    isActive: true,
  },
  {
    id: 'tm-003',
    name: 'Arun Kumar',
    email: 'arun@deepmindq.io',
    role: 'sender',
    avatar: 'AK',
    isActive: true,
  },
  {
    id: 'tm-004',
    name: 'Meera Patel',
    email: 'meera@deepmindq.io',
    role: 'viewer',
    avatar: 'MP',
    isActive: true,
  },
];