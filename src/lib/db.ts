// Mock database layer for Lead Intelligence & AI-Powered Outreach System

const MOCK_COMPANIES = [
  { id: 'comp-1', name: 'Acme Corp', domain: 'acmecorp.com', linkedinUrl: 'https://linkedin.com/company/acmecorp', website: 'https://acmecorp.com', industry: 'Technology', employeeSize: '500-1000', country: 'United States', location: 'San Francisco, CA', status: 'active', intelligenceScore: 87, dataFreshness: 'fresh', lastUpdatedAt: new Date().toISOString(), createdAt: new Date(Date.now() - 30*86400000).toISOString() },
  { id: 'comp-2', name: 'TechVentures Inc', domain: 'techventures.io', linkedinUrl: 'https://linkedin.com/company/techventures', website: 'https://techventures.io', industry: 'SaaS', employeeSize: '100-250', country: 'India', location: 'Bangalore, KA', status: 'new', intelligenceScore: 72, dataFreshness: 'fresh', lastUpdatedAt: new Date().toISOString(), createdAt: new Date(Date.now() - 15*86400000).toISOString() },
  { id: 'comp-3', name: 'Global Finance Solutions', domain: 'gfsolutions.com', linkedinUrl: null, website: 'https://gfsolutions.com', industry: 'Finance', employeeSize: '1000-5000', country: 'United Kingdom', location: 'London, UK', status: 'active', intelligenceScore: 91, dataFreshness: 'stale', lastUpdatedAt: new Date(Date.now() - 7*86400000).toISOString(), createdAt: new Date(Date.now() - 60*86400000).toISOString() },
  { id: 'comp-4', name: 'HealthTech Plus', domain: 'healthtechplus.com', linkedinUrl: 'https://linkedin.com/company/healthtechplus', website: 'https://healthtechplus.com', industry: 'Healthcare', employeeSize: '250-500', country: 'United States', location: 'Boston, MA', status: 'researching', intelligenceScore: 78, dataFreshness: 'fresh', lastUpdatedAt: new Date().toISOString(), createdAt: new Date(Date.now() - 10*86400000).toISOString() },
  { id: 'comp-5', name: 'GreenEnergy Corp', domain: 'greenenergy.co', linkedinUrl: null, website: 'https://greenenergy.co', industry: 'Energy', employeeSize: '50-100', country: 'Germany', location: 'Berlin, DE', status: 'new', intelligenceScore: 65, dataFreshness: 'unknown', lastUpdatedAt: new Date(Date.now() - 2*86400000).toISOString(), createdAt: new Date(Date.now() - 5*86400000).toISOString() },
  { id: 'comp-6', name: 'CloudScale Systems', domain: 'cloudscale.dev', linkedinUrl: 'https://linkedin.com/company/cloudscale', website: 'https://cloudscale.dev', industry: 'Cloud Computing', employeeSize: '1000-5000', country: 'United States', location: 'Seattle, WA', status: 'active', intelligenceScore: 93, dataFreshness: 'fresh', lastUpdatedAt: new Date().toISOString(), createdAt: new Date(Date.now() - 45*86400000).toISOString() },
  { id: 'comp-7', name: 'RetailMax', domain: 'retailmax.com', website: 'https://retailmax.com', industry: 'Retail', employeeSize: '5000+', country: 'United States', location: 'Chicago, IL', status: 'new', intelligenceScore: 58, dataFreshness: 'unknown', lastUpdatedAt: new Date(Date.now() - 86400000).toISOString(), createdAt: new Date(Date.now() - 3*86400000).toISOString() },
  { id: 'comp-8', name: 'FinBridge Analytics', domain: 'finbridge.io', website: 'https://finbridge.io', industry: 'FinTech', employeeSize: '100-250', country: 'Singapore', location: 'Singapore', status: 'researching', intelligenceScore: 82, dataFreshness: 'fresh', lastUpdatedAt: new Date().toISOString(), createdAt: new Date(Date.now() - 20*86400000).toISOString() },
];

const MOCK_CONTACTS = [
  { id: 'cont-1', companyId: 'comp-1', name: 'Sarah Johnson', email: 'sarah@acmecorp.com', jobTitle: 'VP of Engineering', roleBucket: 'decision-maker', linkedinUrl: 'https://linkedin.com/in/sarahjohnson', phone: '+1 415-555-0101', location: 'San Francisco, CA', status: 'active', emailHealth: 'valid', emailHealthScore: 95, lastContactedAt: new Date(Date.now() - 3*86400000).toISOString(), createdAt: new Date(Date.now() - 20*86400000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'cont-2', companyId: 'comp-1', name: 'Mike Chen', email: 'mike.chen@acmecorp.com', jobTitle: 'CTO', roleBucket: 'decision-maker', linkedinUrl: 'https://linkedin.com/in/mikechen', phone: '+1 415-555-0102', location: 'San Francisco, CA', status: 'active', emailHealth: 'valid', emailHealthScore: 92, lastContactedAt: null, createdAt: new Date(Date.now() - 25*86400000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'cont-3', companyId: 'comp-2', name: 'Priya Sharma', email: 'priya@techventures.io', jobTitle: 'Head of Product', roleBucket: 'influencer', linkedinUrl: 'https://linkedin.com/in/priyasharma', phone: '+91 80-555-0201', location: 'Bangalore, KA', status: 'new', emailHealth: 'valid', emailHealthScore: 88, lastContactedAt: null, createdAt: new Date(Date.now() - 12*86400000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'cont-4', companyId: 'comp-3', name: 'James Wilson', email: 'j.wilson@gfsolutions.com', jobTitle: 'CFO', roleBucket: 'decision-maker', linkedinUrl: null, phone: '+44 20-555-0301', location: 'London, UK', status: 'active', emailHealth: 'valid', emailHealthScore: 90, lastContactedAt: new Date(Date.now() - 7*86400000).toISOString(), createdAt: new Date(Date.now() - 50*86400000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'cont-5', companyId: 'comp-4', name: 'Dr. Emily Brown', email: 'emily.b@healthtechplus.com', jobTitle: 'Director of Innovation', roleBucket: 'champion', linkedinUrl: 'https://linkedin.com/in/emilybrown', phone: '+1 617-555-0401', location: 'Boston, MA', status: 'new', emailHealth: 'risky', emailHealthScore: 60, lastContactedAt: null, createdAt: new Date(Date.now() - 8*86400000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'cont-6', companyId: 'comp-6', name: 'David Park', email: 'david.park@cloudscale.dev', jobTitle: 'VP of Cloud Infrastructure', roleBucket: 'decision-maker', linkedinUrl: 'https://linkedin.com/in/davidpark', phone: '+1 206-555-0601', location: 'Seattle, WA', status: 'active', emailHealth: 'valid', emailHealthScore: 97, lastContactedAt: new Date(Date.now() - 86400000).toISOString(), createdAt: new Date(Date.now() - 40*86400000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'cont-7', companyId: 'comp-8', name: 'Raj Patel', email: 'raj@finbridge.io', jobTitle: 'CEO', roleBucket: 'decision-maker', linkedinUrl: 'https://linkedin.com/in/rajpatel', phone: '+65 555-0801', location: 'Singapore', status: 'new', emailHealth: 'valid', emailHealthScore: 94, lastContactedAt: null, createdAt: new Date(Date.now() - 18*86400000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'cont-8', companyId: 'comp-5', name: 'Anna Mueller', email: 'anna@greenenergy.co', jobTitle: 'Head of Operations', roleBucket: 'influencer', phone: '+49 30-555-0501', location: 'Berlin, DE', status: 'new', emailHealth: 'valid', emailHealthScore: 85, lastContactedAt: null, createdAt: new Date(Date.now() - 4*86400000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'cont-9', companyId: 'comp-7', name: 'Tom Garcia', email: 't.garcia@retailmax.com', jobTitle: 'SVP Digital', roleBucket: 'decision-maker', phone: '+1 312-555-0701', location: 'Chicago, IL', status: 'new', emailHealth: 'unknown', emailHealthScore: 70, lastContactedAt: null, createdAt: new Date(Date.now() - 2*86400000).toISOString(), updatedAt: new Date().toISOString() },
];

const MOCK_RESEARCH_CARDS = [
  { id: 'rc-1', companyId: 'comp-1', businessOverview: 'Acme Corp is a mid-market technology company specializing in enterprise software solutions. They recently raised Series C funding of $45M and are expanding their engineering team aggressively. Current focus areas include AI/ML integration and cloud migration.', currentTechLandscape: 'Primarily Java/Spring backend with React frontend. Legacy monolith being decomposed into microservices. Currently using AWS but evaluating multi-cloud strategy. No dedicated data pipeline — relying on ad-hoc scripts.', potentialChallenges: 'Scaling engineering team fast enough, technical debt from monolith, data silos between departments, compliance requirements for new markets.', possibleOpportunities: 'Data engineering & pipeline modernization, AI/ML capability building, cloud migration acceleration, team augmentation for their transformation roadmap.', relevantServices: 'Data Engineering, AI/ML Strategy, Cloud Migration, Team Augmentation', keyDecisionMakers: 'Mike Chen (CTO) — technical vision, Sarah Johnson (VP Eng) — execution & team. Both aligned on modernization.', nextAction: 'Generate personalized outreach for Mike Chen focusing on cloud migration case study.', confidenceScore: 87, lastResearchedAt: new Date().toISOString(), createdAt: new Date(Date.now() - 5*86400000).toISOString() },
  { id: 'rc-2', companyId: 'comp-6', businessOverview: 'CloudScale Systems is a major cloud infrastructure provider serving enterprise clients globally. They have been expanding their managed services portfolio and investing heavily in AI-powered operations (AIOps). Revenue grew 35% YoY.', currentTechLandscape: 'Kubernetes-native, Go & Python services, heavy Kafka usage, own monitoring stack. Recently adopted OpenTelemetry. Data platform built on Snowflake + dbt.', potentialChallenges: 'Differentiating in crowded AIOps market, retaining top talent, integrating recent acquisitions, maintaining SLAs during rapid scaling.', possibleOpportunities: 'AI-powered analytics for their managed services clients, custom LLM deployment for internal operations, advanced monitoring solutions.', relevantServices: 'AI-Powered Analytics, LLM Deployment, Advanced Monitoring', keyDecisionMakers: 'David Park (VP Cloud Infra) — owns platform decisions. Reports to CTO.', nextAction: 'Draft outreach highlighting our AIOps case study from similar cloud provider.', confidenceScore: 93, lastResearchedAt: new Date().toISOString(), createdAt: new Date(Date.now() - 3*86400000).toISOString() },
  { id: 'rc-3', companyId: 'comp-8', businessOverview: 'FinBridge Analytics is a fast-growing fintech startup providing real-time financial analytics to banks and hedge funds. They just closed Series B of $20M and are looking to expand into APAC markets.', currentTechLandscape: 'Python/PyTorch for ML models, Kafka for real-time data, PostgreSQL + TimescaleDB for storage. Frontend in Vue.js. Deploying on GCP.', potentialChallenges: 'Regulatory compliance across APAC markets, real-time data latency optimization, talent acquisition in competitive Singapore market.', possibleOpportunities: 'Regulatory compliance automation, low-latency data pipeline optimization, ML model deployment infrastructure.', relevantServices: 'Data Engineering, ML Operations, Regulatory Tech', keyDecisionMakers: 'Raj Patel (CEO) — drives strategic partnerships directly. Small team, fast decisions.', nextAction: 'Prepare outreach with APAC regulatory tech angle.', confidenceScore: 82, lastResearchedAt: new Date(Date.now() - 86400000).toISOString(), createdAt: new Date(Date.now() - 2*86400000).toISOString() },
];

const MOCK_DRAFTS = [
  { id: 'draft-1', contactId: 'cont-2', subject: 'Accelerating Acme Corp\'s Cloud Migration — A Proven Approach', body: 'Hi Mike,\n\nI noticed Acme Corp recently closed your Series C and is scaling engineering fast. We helped a similar mid-market tech company (500+ engineers) cut their cloud migration timeline by 40% using our phased approach — starting with their most critical data pipelines first.\n\nThe key was avoiding the common trap of trying to migrate everything at once. Instead, we identified the highest-ROI workloads and built momentum from there.\n\nWould a 20-minute conversation about our approach be worth your time this week?\n\nBest,\nRavi', cta: 'Would a 20-minute conversation about our approach be worth your time this week?', serviceAngle: 'Cloud Migration', matchScore: 94, confidenceScore: 89, status: 'pending-review', rejectReason: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'draft-2', contactId: 'cont-6', subject: 'AIOps Differentiation — What\'s Working for Cloud Providers Like You', body: 'Hi David,\n\nCloudScale\'s move into AIOps is well-timed — we\'re seeing demand spike across the infrastructure space. One thing we\'ve learned working with cloud providers: the winners are the ones who make AIOps actionable for their managed services clients, not just for internal ops.\n\nWe recently helped a cloud platform increase client retention by 22% by embedding predictive analytics into their managed services dashboard.\n\nWould love to share the approach — interested in a brief call?\n\nRegards,\nRavi', cta: 'Interested in a brief call to discuss the approach?', serviceAngle: 'AI-Powered Analytics', matchScore: 91, confidenceScore: 86, status: 'approved', rejectReason: null, createdAt: new Date(Date.now() - 2*86400000).toISOString(), updatedAt: new Date(Date.now() - 86400000).toISOString() },
  { id: 'draft-3', contactId: 'cont-7', subject: 'APAC Expansion Without the Compliance Headache', body: 'Hi Raj,\n\nCongrats on the Series B — expanding into APAC is a smart move. The biggest blocker we see for fintechs entering APAC isn\'t the tech, it\'s navigating the regulatory landscape across Singapore, Hong Kong, and Australia simultaneously.\n\nWe built a regulatory compliance automation layer that helped a fintech client go live in 3 APAC markets in 5 months instead of 12.\n\nWould it be useful to see how we approached it?\n\nBest,\nRavi', cta: 'Would it be useful to see how we approached the compliance layer?', serviceAngle: 'Regulatory Tech', matchScore: 88, confidenceScore: 83, status: 'pending-review', rejectReason: null, createdAt: new Date(Date.now() - 86400000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'draft-4', contactId: 'cont-1', subject: 'Data Pipeline Modernization for Acme\'s Scaling Team', body: 'Hi Sarah,\n\nWith Acme\'s engineering team growing and the monolith decommissioning underway, data pipeline maturity becomes critical fast. We helped a 600-person engineering org move from ad-hoc scripts to a production-grade data platform in 8 weeks.\n\nThe result? 3x faster data access for downstream teams and 60% reduction in pipeline breakage incidents.\n\nWould you be open to a quick chat about what that could look like for Acme?\n\nRegards,\nRavi', cta: 'Open to a quick chat about what a modern data platform could look like for Acme?', serviceAngle: 'Data Engineering', matchScore: 90, confidenceScore: 87, status: 'sent', rejectReason: null, createdAt: new Date(Date.now() - 4*86400000).toISOString(), updatedAt: new Date(Date.now() - 2*86400000).toISOString() },
  { id: 'draft-5', contactId: 'cont-5', subject: 'AI/ML Strategy for HealthTech Innovation', body: 'Hi Dr. Brown,\n\nHealthTech Plus\'s focus on innovation in healthcare is impressive. We\'ve been working with healthcare organizations on building responsible AI/ML systems — particularly around patient data privacy and model explainability.\n\nOne of our clients in health tech reduced their AI model deployment time from months to weeks while maintaining full HIPAA compliance.\n\nWould sharing our approach be useful for your innovation roadmap?\n\nBest,\nRavi', cta: 'Would sharing our healthcare AI approach be useful for your innovation roadmap?', serviceAngle: 'AI/ML Strategy', matchScore: 76, confidenceScore: 72, status: 'rejected', rejectReason: 'Too generic — needs more specific healthcare angle', createdAt: new Date(Date.now() - 6*86400000).toISOString(), updatedAt: new Date(Date.now() - 3*86400000).toISOString() },
];

const MOCK_SEQUENCES = [
  { id: 'seq-1', name: 'CloudScale Outreach — David Park', description: 'Initial + 2 follow-ups for CloudScale AIOps pitch', status: 'active', contactId: 'cont-6', companyId: 'comp-6', createdAt: new Date(Date.now() - 3*86400000).toISOString(), updatedAt: new Date().toISOString(),
    steps: [
      { id: 'step-1', sequenceId: 'seq-1', stepNumber: 1, subject: 'AIOps Differentiation — What\'s Working for Cloud Providers Like You', body: 'Hi David...', delayMinutes: 0, cta: 'Interested in a brief call?', status: 'sent', sentAt: new Date(Date.now() - 2*86400000).toISOString(), openedAt: new Date(Date.now() - 86400000).toISOString(), repliedAt: null, createdAt: new Date(Date.now() - 3*86400000).toISOString(), updatedAt: new Date().toISOString() },
      { id: 'step-2', sequenceId: 'seq-1', stepNumber: 2, subject: 'Re: AIOps — Quick Case Study', body: 'Hi David, just bumping this up...', delayMinutes: 1440, cta: 'Can I send you the case study?', status: 'pending', sentAt: null, openedAt: null, repliedAt: null, createdAt: new Date(Date.now() - 3*86400000).toISOString(), updatedAt: new Date().toISOString() },
      { id: 'step-3', sequenceId: 'seq-1', stepNumber: 3, subject: 'Re: AIOps — Last try', body: 'Hi David, one last attempt...', delayMinutes: 2880, cta: 'Worth a 10-min chat?', status: 'pending', sentAt: null, openedAt: null, repliedAt: null, createdAt: new Date(Date.now() - 3*86400000).toISOString(), updatedAt: new Date().toISOString() },
    ]},
  { id: 'seq-2', name: 'Acme Corp — Mike Chen', description: 'Cloud migration pitch sequence', status: 'draft', contactId: 'cont-2', companyId: 'comp-1', createdAt: new Date(Date.now() - 86400000).toISOString(), updatedAt: new Date().toISOString(),
    steps: [
      { id: 'step-4', sequenceId: 'seq-2', stepNumber: 1, subject: 'Accelerating Acme Corp\'s Cloud Migration', body: 'Hi Mike...', delayMinutes: 0, cta: '20-min conversation?', status: 'pending', sentAt: null, openedAt: null, repliedAt: null, createdAt: new Date(Date.now() - 86400000).toISOString(), updatedAt: new Date().toISOString() },
      { id: 'step-5', sequenceId: 'seq-2', stepNumber: 2, subject: 'Re: Cloud Migration', body: 'Following up...', delayMinutes: 1440, cta: 'Quick chat?', status: 'pending', sentAt: null, openedAt: null, repliedAt: null, createdAt: new Date(Date.now() - 86400000).toISOString(), updatedAt: new Date().toISOString() },
      { id: 'step-6', sequenceId: 'seq-2', stepNumber: 3, subject: 'Re: Cloud Migration — Final', body: 'Last follow-up...', delayMinutes: 2880, cta: 'Worth 10 min?', status: 'pending', sentAt: null, openedAt: null, repliedAt: null, createdAt: new Date(Date.now() - 86400000).toISOString(), updatedAt: new Date().toISOString() },
    ]},
];

const MOCK_CAPS = [
  { id: 'cap-1', title: 'Cloud Migration Playbook', docType: 'case-study', description: 'How we helped a 500-engineer org cut cloud migration time by 40%', content: 'Detailed case study covering phased migration approach starting with critical data pipelines. Client reduced migration timeline from 18 months to 11 months.', fileName: 'cloud-migration-playbook.pdf', createdAt: new Date(Date.now() - 60*86400000).toISOString(), updatedAt: new Date().toISOString(),
    snippets: [
      { id: 'sn-1', documentId: 'cap-1', snippetType: 'proof-point', title: '40% Faster Migration', content: 'Reduced cloud migration timeline from 18 to 11 months using phased approach', industries: 'Technology, SaaS', outcomes: 'Reduced cost, faster time-to-value', createdAt: new Date().toISOString() },
      { id: 'sn-2', documentId: 'cap-1', snippetType: 'proof-point', title: 'Zero Downtime Cutover', content: 'Achieved zero-downtime migration for 3 critical production systems', industries: 'Technology, Finance', outcomes: 'Business continuity maintained', createdAt: new Date().toISOString() },
      { id: 'sn-3', documentId: 'cap-1', snippetType: 'objection-response', title: '"We already have a migration plan"', content: 'That\'s great — most mature teams do. Where we add value is the execution layer: our playbook has 47 decision points where teams typically get stuck, with pre-built acceleration patterns for each.', industries: null, outcomes: null, createdAt: new Date().toISOString() },
    ]},
  { id: 'cap-2', title: 'AIOps for Cloud Providers', docType: 'case-study', description: 'How a cloud platform increased client retention 22% with embedded analytics', content: 'Embedded predictive analytics into managed services dashboard, enabling proactive issue resolution and capacity planning.', fileName: 'aiops-cloud-retention.pdf', createdAt: new Date(Date.now() - 30*86400000).toISOString(), updatedAt: new Date().toISOString(),
    snippets: [
      { id: 'sn-4', documentId: 'cap-2', snippetType: 'proof-point', title: '22% Client Retention Increase', content: 'Cloud provider increased managed services client retention by embedding predictive analytics into their dashboard', industries: 'Cloud Computing, SaaS', outcomes: 'Higher NRR, reduced churn', createdAt: new Date().toISOString() },
      { id: 'sn-5', documentId: 'cap-2', snippetType: 'proof-point', title: '60% Faster Incident Response', content: 'Predictive alerting reduced mean time to resolution by 60% for P1 incidents', industries: 'Cloud Computing', outcomes: 'Operational efficiency, client satisfaction', createdAt: new Date().toISOString() },
    ]},
  { id: 'cap-3', title: 'Data Engineering Services Overview', docType: 'service-description', description: 'End-to-end data engineering: pipelines, warehousing, real-time analytics', content: 'Our data engineering practice covers the full lifecycle from data ingestion to analytics. Specializations include real-time streaming, data quality, and ML feature stores.', fileName: 'data-eng-overview.pdf', createdAt: new Date(Date.now() - 45*86400000).toISOString(), updatedAt: new Date().toISOString(),
    snippets: [
      { id: 'sn-6', documentId: 'cap-3', snippetType: 'proof-point', title: '3x Faster Data Access', content: 'Built production data platform for 600-person org, achieving 3x faster data access and 60% fewer pipeline incidents', industries: 'Technology, Finance, Healthcare', outcomes: 'Faster insights, fewer outages', createdAt: new Date().toISOString() },
      { id: 'sn-7', documentId: 'cap-3', snippetType: 'objection-response', title: '"We already have a data team"', content: 'Absolutely — and that\'s exactly who we complement. We come in when the data team is backlogged or needs specialized skills (streaming, ML feature stores) that aren\'t core to their stack.', industries: null, outcomes: null, createdAt: new Date().toISOString() },
    ]},
  { id: 'cap-4', title: 'APAC Regulatory Compliance for FinTech', docType: 'case-study', description: 'Compliance automation layer enabling 3-market launch in 5 months', content: 'Built regulatory compliance automation for a fintech expanding into Singapore, Hong Kong, and Australia. Reduced compliance overhead by 65%.', fileName: 'apac-fintech-compliance.pdf', createdAt: new Date(Date.now() - 15*86400000).toISOString(), updatedAt: new Date().toISOString(),
    snippets: [
      { id: 'sn-8', documentId: 'cap-4', snippetType: 'proof-point', title: '3 Markets in 5 Months', content: 'Fintech client launched in Singapore, Hong Kong, and Australia in 5 months vs typical 12-month timeline', industries: 'FinTech, Finance', outcomes: 'Faster market entry, lower compliance cost', createdAt: new Date().toISOString() },
      { id: 'sn-9', documentId: 'cap-4', snippetType: 'proof-point', title: '65% Reduction in Compliance Overhead', content: 'Automated compliance checks reduced manual compliance work by 65%', industries: 'FinTech', outcomes: 'Cost savings, faster approvals', createdAt: new Date().toISOString() },
    ]},
  { id: 'cap-5', title: 'AI/ML Strategy & Implementation', docType: 'service-description', description: 'End-to-end AI/ML: strategy, model development, deployment, and MLOps', content: 'From AI readiness assessment to production ML systems. We build responsible AI with explainability and compliance built in. Specializing in healthcare and finance verticals.', fileName: 'ai-ml-strategy.pdf', createdAt: new Date(Date.now() - 20*86400000).toISOString(), updatedAt: new Date().toISOString(),
    snippets: [
      { id: 'sn-10', documentId: 'cap-5', snippetType: 'proof-point', title: 'Months to Weeks Deployment', content: 'Reduced AI model deployment time from months to weeks while maintaining full compliance (HIPAA/SOX)', industries: 'Healthcare, Finance', outcomes: 'Faster time-to-value, compliance assured', createdAt: new Date().toISOString() },
    ]},
];

const MOCK_IMPORT_BATCHES = [
  { id: 'batch-1', fileName: 'tech_leads_july_2026.csv', fileHash: 'hash-abc123', totalRows: 150, acceptedRows: 142, duplicateRows: 5, invalidRows: 3, status: 'completed', createdAt: new Date(Date.now() - 7*86400000).toISOString(), updatedAt: new Date(Date.now() - 7*86400000).toISOString() },
  { id: 'batch-2', fileName: 'healthcare_contacts_q3.csv', fileHash: 'hash-def456', totalRows: 89, acceptedRows: 85, duplicateRows: 2, invalidRows: 2, status: 'completed', createdAt: new Date(Date.now() - 3*86400000).toISOString(), updatedAt: new Date(Date.now() - 3*86400000).toISOString() },
  { id: 'batch-3', fileName: 'apac_fintech_leads.csv', fileHash: 'hash-ghi789', totalRows: 200, acceptedRows: 200, duplicateRows: 0, invalidRows: 0, status: 'processing', createdAt: new Date(Date.now() - 3600000).toISOString(), updatedAt: new Date().toISOString() },
];

const MOCK_OPPORTUNITIES = [];
const MOCK_TASKS = [];
const MOCK_PROMPTS = [];
const MOCK_USER = { id: 'demo-1', name: 'Ravi Shanker', email: 'ravi@deepmindq.com', role: 'admin', image: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };

// ── Where clause matching ──
function matchWhere(item: any, where: any): boolean {
  if (!where) return false
  for (const [key, val] of Object.entries(where)) {
    if (val === null || val === undefined) continue
    if (typeof val === 'object') {
      if ('equals' in val) { if (item[key] !== val.equals) return false }
      else if ('contains' in val) { if (!(item[key] || '').toString().toLowerCase().includes((val.contains as string).toLowerCase())) return false }
      else if ('in' in val) { if (!(val.in as any[]).includes(item[key])) return false }
      else if ('not' in val) {
        if (typeof val.not === 'string' && item[key] === val.not) return false
        if (typeof val.not === 'object' && val.not !== null && 'equals' in val.not && item[key] === val.not.equals) return false
      }
      else if ('startsWith' in val) { if (!(item[key] || '').toString().toLowerCase().startsWith((val.startsWith as string).toLowerCase())) return false }
      else if ('gte' in val) { if (!(item[key] >= val.gte)) return false }
      else if ('lte' in val) { if (!(item[key] <= val.lte)) return false }
      else if ('gt' in val) { if (!(item[key] > val.gt)) return false }
      else if ('lt' in val) { if (!(item[key] < val.lt)) return false }
      else if ('notIn' in val) { if ((val.notIn as any[]).includes(item[key])) return false }
      else if ('AND' in val) { for (const sub of (val.AND as any[])) { if (!matchWhere(item, sub)) return false } }
      else if ('OR' in val) { if (!(val.OR as any[]).some((sub: any) => matchWhere(item, sub))) return false }
    } else {
      if (item[key] !== val) return false
    }
  }
  return true
}

function filterData(data: any[], where: any): any[] {
  if (!where) return data
  if (where.AND) { let r = data; for (const s of where.AND) r = r.filter((d: any) => matchWhere(d, s)); return r }
  if (where.OR) return data.filter((d: any) => (where.OR as any[]).some((s: any) => matchWhere(d, s)))
  return data.filter((d: any) => matchWhere(d, where))
}

function enrichItem(item: any, include: any): any {
  const result = { ...item }
  if (!include) return result
  for (const [key] of Object.entries(include)) {
    if (key === 'contacts') result.contacts = MOCK_CONTACTS.filter(c => c.companyId === item.id)
    else if (key === 'company') result.company = MOCK_COMPANIES.find(c => c.id === item.companyId) || null
    else if (key === 'snippets') result.snippets = MOCK_CAPS.flatMap(cap => cap.snippets || []).filter(s => s.documentId === item.id)
    else if (key === 'steps') result.steps = (MOCK_SEQUENCES.find(s => s.id === item.id) || { steps: [] }).steps
    else if (key === 'targetContact') result.targetContact = MOCK_CONTACTS.find(c => c.id === item.targetContactId) || null
    else if (key === 'opportunities') result.opportunities = []
    else if (key === 'notes' || key === 'timeline' || key === 'comments' || key === 'researchCard' || key === 'researchSources' || key === 'members' || key === 'accounts' || key === 'sessions' || key === 'auditLogs' || key === 'notifications' || key === 'preferences' || key === 'healthChecks' || key === 'targetedOpportunities' || key === 'customFieldValues' || key === 'tags' || key === 'teams') result[key] = []
    else result[key] = null
  }
  return result
}

function createModelProxy(data: any[]) {
  return new Proxy({} as any, {
    get(_target, prop: string) {
      const methods: Record<string, Function> = {
        findMany: (args?: any) => {
          let result = [...data]
          if (args?.where) result = filterData(result, args.where)
          if (args?.distinct) { const seen = new Set(); result = result.filter((r: any) => { const k = r[args.distinct]; if (seen.has(k)) return false; seen.add(k); return true }) }
          if (args?.orderBy) { const k = Object.keys(args.orderBy)[0]; const d = args.orderBy[k] === 'desc' ? -1 : 1; result.sort((a: any, b: any) => ((a[k] || '') > (b[k] || '') ? d : -d)) }
          if (args?.skip) result = result.slice(args.skip)
          if (args?.take) result = result.slice(0, args.take)
          if (args?.include) result = result.map((item: any) => enrichItem(item, args.include))
          if (args?.select) result = result.map((item: any) => { const p: any = {}; for (const k of Object.keys(args.select)) p[k] = item[k]; return p })
          return Promise.resolve(result)
        },
        findUnique: (args: any) => { const item = data.find((d: any) => matchWhere(d, args?.where)); return Promise.resolve(item ? (args?.include ? enrichItem(item, args.include) : item) : null) },
        findFirst: (args: any) => { let r = [...data]; if (args?.where) r = filterData(r, args.where); if (args?.orderBy) { const k = Object.keys(args.orderBy)[0]; const d = args.orderBy[k] === 'desc' ? -1 : 1; r.sort((a: any, b: any) => ((a[k] || '') > (b[k] || '') ? d : -d)) } const item = r[0] || null; return Promise.resolve(item ? (args?.include ? enrichItem(item, args.include) : item) : null) },
        count: (args?: any) => { let r = [...data]; if (args?.where) r = filterData(r, args.where); return Promise.resolve(r.length) },
        create: (args: any) => { const n = { id: `mock-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, ...args?.data, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; data.push(n); return Promise.resolve(n) },
        update: (args: any) => { const i = data.findIndex((d: any) => matchWhere(d, args?.where)); if (i >= 0) { data[i] = { ...data[i], ...args?.data, updatedAt: new Date().toISOString() }; return Promise.resolve(args?.include ? enrichItem(data[i], args.include) : data[i]) } return Promise.resolve(null) },
        delete: (args: any) => { const i = data.findIndex((d: any) => matchWhere(d, args?.where)); if (i >= 0) return Promise.resolve(data.splice(i, 1)[0]); return Promise.resolve(null) },
        deleteMany: (args?: any) => { if (args?.where) { const b = data.length; const f = data.filter((d: any) => !matchWhere(d, args.where)); data.length = 0; data.push(...f); return Promise.resolve({ count: b - data.length }) } const c = data.length; data.length = 0; return Promise.resolve({ count: c }) },
        upsert: (args: any) => { let i = data.findIndex((d: any) => matchWhere(d, args?.where)); if (i >= 0) { data[i] = { ...data[i], ...args?.update, updatedAt: new Date().toISOString() }; return Promise.resolve(data[i]) } const n = { id: `mock-${Date.now()}`, ...args?.create, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; data.push(n); return Promise.resolve(n) },
        aggregate: (args?: any) => { let r = [...data]; if (args?.where) r = filterData(r, args.where); const a: any = { _count: r.length, _sum: {}, _avg: {}, _min: {}, _max: {} }; return Promise.resolve(a) },
        groupBy: (args: any) => { let r = [...data]; if (args?.where) r = filterData(r, args.where); const g: Record<string, any> = {}; for (const item of r) { const k = String(item[args.by[0]] || 'unknown'); if (!g[k]) g[k] = {}; g[k][args.by[0]] = k; g[k]._count = (g[k]._count || 0) + 1; if (args._count) { for (const ck of Object.keys(args._count)) { if (item[ck] != null) g[k][ck] = (g[k][ck] || 0) + 1 } } } return Promise.resolve(Object.values(g)) },
      }
      return methods[prop] || (() => Promise.resolve(null))
    }
  })
}

const models: Record<string, any> = {
  company: createModelProxy(MOCK_COMPANIES),
  contact: createModelProxy(MOCK_CONTACTS),
  companyResearchCard: createModelProxy(MOCK_RESEARCH_CARDS),
  draft: createModelProxy(MOCK_DRAFTS),
  capabilityDocument: createModelProxy(MOCK_CAPS),
  capabilitySnippet: createModelProxy(MOCK_CAPS.flatMap(c => c.snippets || [])),
  emailSequence: createModelProxy(MOCK_SEQUENCES),
  emailSequenceStep: createModelProxy(MOCK_SEQUENCES.flatMap(s => s.steps || [])),
  importBatch: createModelProxy(MOCK_IMPORT_BATCHES),
  opportunity: createModelProxy(MOCK_OPPORTUNITIES),
  task: createModelProxy(MOCK_TASKS),
  promptTemplate: createModelProxy(MOCK_PROMPTS),
  user: createModelProxy([MOCK_USER]),
  account: createModelProxy([]),
  session: createModelProxy([]),
  verificationToken: createModelProxy([]),
  auditLog: createModelProxy([]),
  notification: createModelProxy([]),
  userPreferences: createModelProxy([]),
  customFieldDefinition: createModelProxy([]),
  customFieldValue: createModelProxy([]),
  tag: createModelProxy([]),
  tagAssignment: createModelProxy([]),
  comment: createModelProxy([]),
  team: createModelProxy([]),
  teamMember: createModelProxy([]),
  companyNote: createModelProxy([]),
  contactNote: createModelProxy([]),
  companyResearchSource: createModelProxy([]),
  timelineEntry: createModelProxy([]),
  emailHealthCheck: createModelProxy([]),
}

export const db = new Proxy(models, {
  get(target, prop) {
    if (prop in target) return target[prop as string]
    return createModelProxy([])
  }
})

export function isDbAvailable() { return false }