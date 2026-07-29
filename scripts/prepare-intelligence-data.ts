/**
 * prepare-intelligence-data.ts
 * ══════════════════════════════
 * Loads curated enterprise capabilities and representative companies,
 * then runs the complete intelligence flow to generate real outputs.
 *
 * Usage: npx tsx scripts/prepare-intelligence-data.ts
 *
 * FLOW:
 *   1. Load ~10 curated capabilities across 9 service domains
 *   2. Load 10 representative enterprise companies
 *   3. Run company enrichment (AI-powered)
 *   4. Run signal detection
 *   5. Run capability matching
 *   6. Run full intelligence pipeline on 2-3 key accounts
 *   7. Capture all real outputs for design reference
 */

import { PrismaClient } from '@prisma/client';

const db = new PrismaClient({
  log: ['error', 'warn'],
});

// ═══════════════════════════════════════════════════════════════════════
// 1. CURATED ENTERPRISE CAPABILITIES
// ═══════════════════════════════════════════════════════════════════════

const CURATED_CAPABILITIES = [
  // ── Enterprise AI & Machine Learning ──
  {
    title: 'Enterprise AI Strategy & Implementation',
    summary: 'End-to-end AI transformation from strategy through production deployment. We assess organizational readiness, design AI roadmaps, build ML pipelines, and deploy intelligent automation at enterprise scale.',
    category: 'service_line' as const,
    serviceLine: 'Enterprise AI',
    solution: 'AI Transformation Accelerator',
    technology: 'Azure AI, AWS SageMaker, GCP Vertex AI',
    industry: 'Cross-Industry',
    businessProblem: 'Organizations struggle to move beyond AI pilots into production-grade, scalable AI systems that deliver measurable business outcomes.',
    customerOutcome: 'Production AI systems with 3-5x ROI within 18 months, reduced time-to-deploy from months to weeks.',
    differentiator: 'Our AI-Native Delivery Framework combines industry-specific pre-trained models with a rapid prototyping methodology that de-risks AI investments.',
    targetIndustries: ['Financial Services', 'Healthcare', 'Manufacturing', 'Technology'],
    targetRoles: ['CTO', 'CIO', 'VP Engineering', 'Head of AI', 'Chief Data Officer'],
    keywords: ['artificial intelligence', 'machine learning', 'AI strategy', 'MLOps', 'intelligent automation', 'AI governance', 'production AI', 'deep learning', 'NLP', 'computer vision'],
    evidence: '85% of our AI engagements reach production within 6 months vs. industry average of 24 months.',
    tags: ['ai', 'ml', 'strategy', 'transformation'],
    caseStudyRef: [{ title: 'Fortune 500 Bank AI Modernization', industry: 'Financial Services', outcome: 'Reduced fraud detection latency by 94% and automated 70% of document processing' }],
    proofPointRef: [{ metric: 'Production deployment rate', value: '85% within 6 months', context: 'vs. 25% industry average' }, { metric: 'Average ROI', value: '3.5x within 18 months', context: 'across 40+ enterprise clients' }],
    content: 'Our Enterprise AI practice delivers across the full AI lifecycle: opportunity identification, data strategy, model development, MLOps infrastructure, and change management. We specialize in computer vision, NLP, recommendation systems, predictive analytics, and generative AI. Our AI Center of Excellence framework helps enterprises build internal AI capabilities while we deliver immediate business value.',
  },

  {
    title: 'Generative AI & LLM Operations',
    summary: 'Design, fine-tune, deploy and manage production Large Language Model systems. From RAG architectures to agentic AI workflows, we help enterprises safely leverage generative AI.',
    category: 'service_line' as const,
    serviceLine: 'Enterprise AI',
    solution: 'GenAI Production Platform',
    technology: 'Azure OpenAI, Anthropic Claude, Llama, LangChain, Semantic Kernel',
    industry: 'Cross-Industry',
    businessProblem: 'Enterprises are investing in generative AI but struggling to move from prototypes to safe, reliable, cost-effective production systems with proper governance.',
    customerOutcome: 'Production GenAI applications with 99.5% reliability, 60% reduction in hallucination rates, and documented AI governance frameworks.',
    differentiator: 'Our Responsible AI framework ensures every GenAI deployment includes guardrails, monitoring, and human-in-the-loop validation before production.',
    targetIndustries: ['Financial Services', 'Healthcare', 'Technology', 'Consulting', 'Legal'],
    targetRoles: ['CTO', 'CIO', 'VP Engineering', 'Head of AI', 'Chief Data Officer'],
    keywords: ['generative AI', 'LLM', 'RAG', 'fine-tuning', 'agentic AI', 'AI governance', 'prompt engineering', 'Azure OpenAI', 'retrieval augmented generation'],
    evidence: 'Deployed 25+ production GenAI applications across Fortune 500 clients in the past 12 months.',
    tags: ['genai', 'llm', 'rag', 'ai-governance'],
    caseStudyRef: [{ title: 'Global Bank Customer Service AI', industry: 'Financial Services', outcome: 'Deployed GenAI-powered customer service handling 40% of queries autonomously with 92% satisfaction' }],
    proofPointRef: [{ metric: 'Hallucination reduction', value: '60% average decrease', context: 'through RAG + grounding architecture' }, { metric: 'Cost per query', value: '$0.002 avg', context: 'optimized through model routing' }],
    content: 'Our GenAI practice covers the full spectrum from strategy to production: use case identification, architecture design (RAG, fine-tuning, agents), prompt engineering, safety testing, deployment automation, and ongoing monitoring. We specialize in enterprise-grade RAG pipelines, agentic workflows, multi-model orchestration, and responsible AI governance.',
  },

  // ── Data & AI Platforms ──
  {
    title: 'Enterprise Data Platform Modernization',
    summary: 'Design and build modern data platforms on cloud-native architectures. From legacy warehouse migration to real-time analytics, we enable data-driven decision making at scale.',
    category: 'service_line' as const,
    serviceLine: 'Data & AI Platforms',
    solution: 'Data Platform Factory',
    technology: 'Snowflake, Databricks, Azure Synapse, dbt, Apache Spark, Kafka',
    industry: 'Cross-Industry',
    businessProblem: 'Organizations are drowning in data but starving for insights. Legacy data warehouses are slow, siloed, and cannot support modern analytics or AI workloads.',
    customerOutcome: 'Unified data platform with 10x faster query performance, 80% reduction in data pipeline maintenance, and self-service analytics for 500+ business users.',
    differentiator: 'Our Data Platform Factory approach combines industry-specific data models with automated migration tooling, reducing typical 18-month modernization projects to 6 months.',
    targetIndustries: ['Financial Services', 'Healthcare', 'Retail', 'Manufacturing'],
    targetRoles: ['CDO', 'VP Data', 'Head of Analytics', 'CTO', 'Data Architecture Lead'],
    keywords: ['data platform', 'data warehouse', 'lakehouse', 'Snowflake', 'Databricks', 'real-time analytics', 'data governance', 'data mesh', 'ETL', 'data quality'],
    evidence: 'Migrated 50+ enterprise data platforms with zero data loss and average 6-month delivery timelines.',
    tags: ['data', 'platform', 'analytics', 'modernization'],
    caseStudyRef: [{ title: 'Healthcare System Data Unification', industry: 'Healthcare', outcome: 'Unified 15 disparate data sources into a single platform, enabling real-time clinical and operational analytics' }],
    proofPointRef: [{ metric: 'Query performance improvement', value: '10x average', context: 'post-migration benchmarking' }, { metric: 'Data pipeline reliability', value: '99.9% uptime', context: 'across all production platforms' }],
    content: 'We deliver modern data platforms using cloud-native architectures: lakehouse patterns, medallion architectures, data mesh, and real-time streaming. Our expertise spans Snowflake, Databricks, Azure Synapse, and GCP BigQuery, combined with modern tooling like dbt for transformation and Great Expectations for quality.',
  },

  // ── Cloud & Infrastructure Modernization ──
  {
    title: 'Cloud Migration & Infrastructure Modernization',
    summary: 'End-to-end cloud transformation from assessment and strategy through migration and optimization. Multi-cloud expertise across AWS, Azure, and GCP with proven migration factory approach.',
    category: 'service_line' as const,
    serviceLine: 'Cloud & Infra Modernization',
    solution: 'Cloud Migration Factory',
    technology: 'AWS, Azure, GCP, Terraform, Kubernetes, Docker',
    industry: 'Cross-Industry',
    businessProblem: 'Enterprises with legacy on-premise infrastructure face rising costs, security vulnerabilities, and inability to innovate. Cloud migration is complex, risky, and often over-budget.',
    customerOutcome: '40% infrastructure cost reduction, 99.99% uptime SLA, and cloud-native architecture enabling rapid feature delivery.',
    differentiator: 'Our Cloud Migration Factory has pre-built migration patterns for 200+ enterprise application types, reducing typical migration timelines by 60% and risk by 80%.',
    targetIndustries: ['Financial Services', 'Healthcare', 'Technology', 'Manufacturing', 'Government'],
    targetRoles: ['CTO', 'CIO', 'VP Engineering', 'Cloud Architect', 'Infrastructure Lead'],
    keywords: ['cloud migration', 'cloud native', 'multi-cloud', 'AWS', 'Azure', 'GCP', 'Kubernetes', 'infrastructure as code', 'DevOps', 'cost optimization'],
    evidence: 'Completed 200+ cloud migrations including zero-downtime migrations for regulated industries.',
    tags: ['cloud', 'migration', 'infrastructure', 'modernization'],
    caseStudyRef: [{ title: 'Global Healthcare Azure Migration', industry: 'Healthcare', outcome: 'Migrated 200+ microservices to Azure with 99.99% uptime and zero data loss' }],
    proofPointRef: [{ metric: 'Migration acceleration', value: '60% faster', context: 'vs. traditional approaches' }, { metric: 'Cost reduction', value: '40% average', context: 'post-migration optimization' }],
    content: 'Full-spectrum cloud transformation: cloud strategy, application assessment, migration planning, execution (lift-and-shift, re-platform, re-architect), and ongoing optimization. Deep expertise in AWS, Azure, and GCP with certified architects across all three platforms.',
  },

  // ── Application Modernization ──
  {
    title: 'Application Modernization & Re-Architecture',
    summary: 'Transform legacy monolithic applications into cloud-native, microservices-based architectures. We modernize at the pace the business needs — from lift-and-shift to full re-architecture.',
    category: 'service_line' as const,
    serviceLine: 'App Modernization',
    solution: 'App Modernization Accelerator',
    technology: 'Kubernetes, Docker, Node.js, .NET Core, Java Spring Boot, React, Angular',
    industry: 'Cross-Industry',
    businessProblem: 'Legacy applications are slow to evolve, expensive to maintain, and cannot support modern user expectations. But rewriting everything is too risky and expensive.',
    customerOutcome: '70% reduction in deployment time, 50% reduction in maintenance costs, and ability to ship new features weekly instead of quarterly.',
    differentiator: 'Our Strangler Fig approach modernizes incrementally — no big-bang rewrites. Each sprint delivers measurable business value while progressively modernizing the architecture.',
    targetIndustries: ['Financial Services', 'Healthcare', 'Retail', 'Government'],
    targetRoles: ['CTO', 'VP Engineering', 'Head of Application Development', 'Enterprise Architect'],
    keywords: ['application modernization', 'microservices', 'cloud native', 'containerization', 'legacy modernization', 'strangler fig', 'API-first', 'domain-driven design'],
    evidence: 'Modernized 80+ legacy applications, averaging 70% reduction in technical debt within 12 months.',
    tags: ['modernization', 'microservices', 'legacy', 're-architecture'],
    caseStudyRef: [{ title: 'Insurance Platform Re-Architecture', industry: 'Financial Services', outcome: 'Decomposed 15-year-old monolith into 12 microservices, reducing deployment time from 3 months to 2 hours' }],
    proofPointRef: [{ metric: 'Deployment frequency', value: '10x improvement', context: 'from quarterly to weekly releases' }, { metric: 'Technical debt reduction', value: '70% average', context: 'within first 12 months' }],
    content: 'We specialize in incremental modernization using patterns like Strangler Fig, Anti-Corruption Layer, and Sidecar. Our approach preserves business continuity while progressively modernizing the architecture, typically completing full transformation within 12-18 months.',
  },

  // ── Intelligent Automation ──
  {
    title: 'Intelligent Process Automation',
    summary: 'Combine RPA with AI to automate complex business processes end-to-end. From document processing to workflow orchestration, we deliver measurable efficiency gains.',
    category: 'service_line' as const,
    serviceLine: 'Intelligent Automation',
    solution: 'Intelligent Automation Platform',
    technology: 'UiPath, Power Automate, Azure AI Document Intelligence, OpenAI',
    industry: 'Cross-Industry',
    businessProblem: 'Manual processes are slow, error-prone, and expensive. Simple RPA is not enough — processes require judgment, document understanding, and exception handling.',
    customerOutcome: '85% reduction in processing time, 95% accuracy rate, and 60% cost reduction in targeted processes.',
    differentiator: 'Our Human-in-the-Loop design ensures AI handles routine work while humans focus on exceptions and strategic decisions, achieving higher accuracy than fully automated systems.',
    targetIndustries: ['Financial Services', 'Healthcare', 'Insurance', 'Government'],
    targetRoles: ['COO', 'VP Operations', 'Head of Shared Services', 'Process Excellence Lead', 'CFO'],
    keywords: ['RPA', 'intelligent automation', 'document processing', 'workflow automation', 'process mining', 'AI automation', 'hyperautomation'],
    evidence: 'Automated 500+ processes across 30 enterprise clients with average 85% processing time reduction.',
    tags: ['automation', 'rpa', 'process', 'efficiency'],
    caseStudyRef: [{ title: 'Fortune 500 Document Automation', industry: 'Financial Services', outcome: '85% processing time reduction, $2M annual savings, and 99.5% accuracy in loan document processing' }],
    proofPointRef: [{ metric: 'Processing time reduction', value: '85% average', context: 'across 500+ automated processes' }, { metric: 'Annual savings', value: '$2M+ per client', context: 'average across automated processes' }],
    content: 'We go beyond traditional RPA by combining robotic automation with AI: intelligent document processing, natural language understanding, decision automation, and predictive exception handling. Our process mining capability identifies the highest-ROI automation opportunities first.',
  },

  // ── Cybersecurity ──
  {
    title: 'Cybersecurity Transformation & Managed Detection',
    summary: 'Comprehensive cybersecurity transformation from assessment through managed detection and response. We help enterprises build proactive security programs that protect against modern threats.',
    category: 'service_line' as const,
    serviceLine: 'Cybersecurity',
    solution: 'Cyber Defense Platform',
    technology: 'Azure Sentinel, Splunk, CrowdStrike, Palo Alto, Wiz',
    industry: 'Cross-Industry',
    businessProblem: 'Cyber threats are evolving faster than most security teams can adapt. Legacy security tools create alert fatigue, and talent shortages leave organizations vulnerable.',
    customerOutcome: '70% reduction in mean-time-to-detect threats, 50% reduction in false positives, and 24/7 security coverage without hiring additional staff.',
    differentiator: 'Our AI-powered threat detection reduces false positives by 50%, allowing security teams to focus on genuine threats. Our SOC-as-a-Service provides 24/7 coverage without the overhead.',
    targetIndustries: ['Financial Services', 'Healthcare', 'Technology', 'Government', 'Energy'],
    targetRoles: ['CISO', 'VP Security', 'Security Architect', 'CIO', 'CTO'],
    keywords: ['cybersecurity', 'managed detection', 'SOC', 'threat detection', 'security transformation', 'zero trust', 'cloud security', 'SIEM', 'incident response'],
    evidence: 'Protected 100+ enterprise clients with 99.9% threat detection rate and zero major breaches.',
    tags: ['security', 'cybersecurity', 'threat-detection'],
    caseStudyRef: [{ title: 'Financial Services SOC Modernization', industry: 'Financial Services', outcome: 'Reduced MTTD from 48 hours to 15 minutes and eliminated 50% of false positive alerts' }],
    proofPointRef: [{ metric: 'Mean time to detect', value: '15 minutes avg', context: 'vs. 48 hours industry average' }, { metric: 'False positive reduction', value: '50%', context: 'through AI-powered detection' }],
    content: 'Full-spectrum cybersecurity services: assessment and advisory, architecture design, implementation, and managed detection and response. Specializing in Zero Trust architecture, cloud security, SOC modernization, and AI-powered threat detection.',
  },

  // ── Quality Engineering ──
  {
    title: 'Quality Engineering & Test Automation',
    summary: 'Modern quality engineering combining test automation, performance engineering, and AI-powered testing to deliver quality at the speed of agile.',
    category: 'service_line' as const,
    serviceLine: 'Quality Engineering',
    solution: 'Quality Accelerator',
    technology: 'Selenium, Cypress, Playwright, JMeter, k6, AI-powered test generation',
    industry: 'Cross-Industry',
    businessProblem: 'Traditional QA is too slow for modern delivery cycles. Manual testing creates bottlenecks, and test suites become fragile and expensive to maintain.',
    customerOutcome: '90% test automation coverage, 80% reduction in regression testing time, and shift-left quality that catches defects 5x earlier.',
    differentiator: 'Our AI-powered test generation and self-healing test frameworks reduce maintenance costs by 60% while increasing test coverage and reliability.',
    targetIndustries: ['Financial Services', 'Healthcare', 'Technology', 'Retail'],
    targetRoles: ['VP Engineering', 'QA Director', 'Head of Quality', 'CTO'],
    keywords: ['test automation', 'quality engineering', 'performance testing', 'AI testing', 'shift-left', 'continuous testing', 'regression automation'],
    evidence: 'Delivered 90%+ automation for 60+ enterprise clients with average 80% reduction in release cycle time.',
    tags: ['quality', 'testing', 'automation', 'performance'],
    caseStudyRef: [{ title: 'FinTech Platform Quality Overhaul', industry: 'Financial Services', outcome: 'Achieved 95% automation coverage and reduced release cycle from 6 weeks to 1 week' }],
    proofPointRef: [{ metric: 'Automation coverage', value: '90%+ average', context: 'across 60+ enterprise engagements' }, { metric: 'Defect detection shift', value: '5x earlier', context: 'through shift-left practices' }],
    content: 'Modern quality engineering: test strategy and architecture, automation framework design, AI-powered test generation, performance engineering, security testing, and continuous quality in CI/CD pipelines.',
  },

  // ── DevOps & Platform Engineering ──
  {
    title: 'DevOps & Platform Engineering',
    summary: 'Build internal developer platforms that accelerate software delivery. From CI/CD pipelines to infrastructure-as-code to developer experience, we enable engineering teams to ship faster.',
    category: 'service_line' as const,
    serviceLine: 'DevOps & Platform Engineering',
    solution: 'Developer Platform Accelerator',
    technology: 'Kubernetes, Terraform, GitHub Actions, GitLab CI, ArgoCD, Backstage',
    industry: 'Cross-Industry',
    businessProblem: 'Engineering teams waste 30-40% of their time on undifferentiated infrastructure work instead of building product features. CI/CD pipelines are slow, environments are inconsistent, and deployments are risky.',
    customerOutcome: 'Deployment frequency 10x, lead time from commit to production reduced by 75%, and developer satisfaction scores increased by 40%.',
    differentiator: 'Our Internal Developer Platform approach treats the platform as a product, with self-service capabilities that reduce cognitive load on development teams while maintaining governance and security.',
    targetIndustries: ['Technology', 'Financial Services', 'Healthcare', 'Retail'],
    targetRoles: ['VP Engineering', 'Platform Engineering Lead', 'DevOps Lead', 'CTO'],
    keywords: ['DevOps', 'platform engineering', 'CI/CD', 'Kubernetes', 'infrastructure as code', 'GitOps', 'developer experience', 'internal developer platform'],
    evidence: 'Built 30+ internal developer platforms with average 10x improvement in deployment frequency.',
    tags: ['devops', 'platform', 'kubernetes', 'cicd'],
    caseStudyRef: [{ title: 'Enterprise Kubernetes Platform', industry: 'Technology', outcome: 'Built unified Kubernetes platform serving 200+ developers, enabling self-service deployments in under 15 minutes' }],
    proofPointRef: [{ metric: 'Deployment frequency', value: '10x improvement', context: 'from monthly to daily deployments' }, { metric: 'Developer onboarding time', value: '75% reduction', context: 'from 2 weeks to 2 days' }],
    content: 'Full-spectrum DevOps and platform engineering: CI/CD pipeline design, Kubernetes platform architecture, infrastructure-as-code, GitOps workflows, observability, and internal developer portals using Backstage.',
  },

  // ── Digital Engineering ──
  {
    title: 'Digital Product Engineering',
    summary: 'Design and build modern digital products — web, mobile, and conversational interfaces. From product strategy through engineering delivery with a focus on user experience.',
    category: 'service_line' as const,
    serviceLine: 'Digital Engineering',
    solution: 'Digital Product Factory',
    technology: 'React, Next.js, React Native, Flutter, Node.js, Python, Figma',
    industry: 'Cross-Industry',
    businessProblem: 'Enterprises struggle to build digital experiences that customers love. Internal teams lack UX expertise, modern frontend skills, and product thinking.',
    customerOutcome: 'Digital products with 40% higher user engagement, 3x faster time-to-market, and NPS scores averaging 70+.',
    differentiator: 'Our Product + Design + Engineering triad approach ensures every feature is validated with users before engineering investment, reducing wasted effort by 50%.',
    targetIndustries: ['Financial Services', 'Healthcare', 'Retail', 'Technology', 'Media'],
    targetRoles: ['CPO', 'VP Product', 'CTO', 'Head of Digital', 'Chief Digital Officer'],
    keywords: ['digital product', 'web development', 'mobile development', 'UX design', 'product engineering', 'frontend', 'React', 'Next.js', 'user experience'],
    evidence: 'Delivered 100+ digital products with average 3x faster time-to-market vs. traditional approaches.',
    tags: ['digital', 'product', 'engineering', 'ux'],
    caseStudyRef: [{ title: 'Banking App Modernization', industry: 'Financial Services', outcome: 'Redesigned mobile banking app achieving 4.8-star rating and 60% increase in daily active users' }],
    proofPointRef: [{ metric: 'Time to market', value: '3x faster', context: 'vs. traditional development' }, { metric: 'User engagement', value: '40% increase', context: 'average across delivered products' }],
    content: 'End-to-end digital product delivery: product strategy, UX research and design, frontend and backend engineering, QA, and ongoing product evolution. We specialize in React/Next.js web applications, React Native/Flutter mobile apps, and conversational AI interfaces.',
  },

  // ── Managed Services ──
  {
    title: 'Managed IT & Cloud Services',
    summary: 'Proactive managed services for cloud infrastructure, applications, and security. We operate and optimize your technology stack so your team can focus on innovation.',
    category: 'service_line' as const,
    serviceLine: 'Managed Services',
    solution: 'Managed Services Platform',
    technology: 'AWS, Azure, GCP, Datadog, PagerDuty, ServiceNow',
    industry: 'Cross-Industry',
    businessProblem: 'Operating cloud infrastructure and applications at scale requires specialized skills that are expensive and hard to hire. Outages impact revenue and customer trust.',
    customerOutcome: '99.99% uptime SLA, 50% reduction in incident response time, and predictable monthly costs with no hidden infrastructure surprises.',
    differentiator: 'Our proactive monitoring and AI-powered anomaly detection catches and resolves issues before they impact users, averaging 95% of incidents resolved without customer notification.',
    targetIndustries: ['Financial Services', 'Healthcare', 'Technology', 'Retail', 'Government'],
    targetRoles: ['CIO', 'CTO', 'VP Operations', 'IT Director', 'Head of Infrastructure'],
    keywords: ['managed services', 'cloud operations', 'SRE', 'site reliability', 'monitoring', 'incident management', 'cloud cost optimization', 'IT operations'],
    evidence: 'Managing 500+ production workloads with 99.99% uptime SLA across 50+ enterprise clients.',
    tags: ['managed', 'operations', 'sre', 'monitoring'],
    caseStudyRef: [{ title: 'SaaS Platform Operations Takeover', industry: 'Technology', outcome: 'Achieved 99.99% uptime, 50% reduction in incidents, and 30% cost optimization within first 6 months' }],
    proofPointRef: [{ metric: 'Uptime SLA', value: '99.99%', context: 'across 500+ production workloads' }, { metric: 'Proactive incident resolution', value: '95% before customer impact', context: 'through AI-powered monitoring' }],
    content: 'Comprehensive managed services: cloud operations, application management, security operations, cost optimization, and 24/7 support. Our SRE approach combines proactive monitoring, automated remediation, and continuous optimization.',
  },
];

// ═══════════════════════════════════════════════════════════════════════
// 2. REPRESENTATIVE ENTERPRISE COMPANIES
// ═══════════════════════════════════════════════════════════════════════

const REPRESENTATIVE_COMPANIES = [
  {
    rawName: 'Acme Financial Services',
    domain: 'acmefinancial.com',
    website: 'https://acmefinancial.com',
    industry: 'Financial Services',
    sizeRange: 'Enterprise (10,000+)',
    country: 'United States',
    internalSummary: 'Leading global financial services firm offering banking, investment, and insurance products across 40+ countries. Recently announced a $500M digital transformation initiative focused on AI and cloud modernization.',
  },
  {
    rawName: 'NovaTech Industries',
    domain: 'novatech.io',
    website: 'https://novatech.io',
    industry: 'Technology',
    sizeRange: 'Mid-Market (500-5,000)',
    country: 'United States',
    internalSummary: 'Cloud-native SaaS company providing AI-powered DevOps and infrastructure monitoring solutions for enterprise customers. Raised $200M Series D in 2024 and is expanding into European and APAC markets.',
  },
  {
    rawName: 'Meridian Healthcare Group',
    domain: 'meridianhealth.com',
    website: 'https://meridianhealth.com',
    industry: 'Healthcare',
    sizeRange: 'Enterprise (10,000+)',
    country: 'United Kingdom',
    internalSummary: 'Integrated healthcare system operating 15 hospitals and 200+ clinics with a focus on digital health transformation. Their CIO announced a comprehensive Azure migration strategy and AI-powered patient analytics initiative.',
  },
  {
    rawName: 'Atlas Manufacturing Corp',
    domain: 'atlasmfg.com',
    website: 'https://atlasmfg.com',
    industry: 'Manufacturing',
    sizeRange: 'Enterprise (5,000-10,000)',
    country: 'Germany',
    internalSummary: 'Global precision manufacturing company specializing in automotive and aerospace components with 25 factories across Europe and Asia. Implementing Industry 4.0 with predictive maintenance and IoT integration.',
  },
  {
    rawName: 'Pinnacle Retail Holdings',
    domain: 'pinnacleretail.com',
    website: 'https://pinnacleretail.com',
    industry: 'Retail',
    sizeRange: 'Enterprise (10,000+)',
    country: 'United States',
    internalSummary: 'Omnichannel retail giant operating 800+ stores and a rapidly growing e-commerce platform serving 50M+ customers. Currently undertaking a massive cloud migration and AI personalization initiative.',
  },
  {
    rawName: 'Sentinel Cyber Defense',
    domain: 'sentinelcyber.io',
    website: 'https://sentinelcyber.io',
    industry: 'Information Technology',
    sizeRange: 'Mid-Market (1,000-5,000)',
    country: 'Israel',
    internalSummary: 'AI-driven cybersecurity platform providing threat detection, incident response, and compliance automation for Fortune 500 companies. Expanding rapidly with new CISO hires and product line extensions.',
  },
  {
    rawName: 'Greenfield Energy Solutions',
    domain: 'greenfieldenergy.com',
    website: 'https://greenfieldenergy.com',
    industry: 'Energy',
    sizeRange: 'Mid-Market (500-5,000)',
    country: 'Denmark',
    internalSummary: 'Renewable energy company developing smart grid technology and wind farm management software for utility providers. Recently secured $300M in government contracts for smart city infrastructure projects.',
  },
  {
    rawName: 'Quantum Dynamics Research',
    domain: 'quantumdynamics.org',
    website: 'https://quantumdynamics.org',
    industry: 'Technology',
    sizeRange: 'Mid-Market (1,000-5,000)',
    country: 'United States',
    internalSummary: 'Quantum computing research company developing next-generation encryption and optimization solutions for government and enterprise clients. Recently hired VP of Engineering from Google and opened a new R&D center.',
  },
  {
    rawName: 'StratosCloud Systems',
    domain: 'stratoscloud.com',
    website: 'https://stratoscloud.com',
    industry: 'Technology',
    sizeRange: 'Enterprise (5,000-10,000)',
    country: 'Singapore',
    internalSummary: 'Multi-cloud orchestration platform helping enterprises manage hybrid cloud infrastructure across AWS, Azure, and GCP. Their CTO published an Azure-first strategy and is hiring cloud architects aggressively.',
  },
  {
    rawName: 'Vanguard Consulting Group',
    domain: 'vanguardconsulting.com',
    website: 'https://vanguardconsulting.com',
    industry: 'Consulting',
    sizeRange: 'Mid-Market (1,000-5,000)',
    country: 'United States',
    internalSummary: 'Management and technology consulting firm specializing in digital transformation for financial services and healthcare sectors. Expanding their AI practice and recently won a $50M federal digital modernization contract.',
  },
];

// ═══════════════════════════════════════════════════════════════════════
// MAIN EXECUTION
// ═══════════════════════════════════════════════════════════════════════

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  DeepMindQ — Intelligence Data Preparation');
  console.log('═══════════════════════════════════════════════════════════\n');

  // ── Step 1: Load Capabilities ──
  console.log('━━━ STEP 1: Loading Curated Capabilities ━━━');
  let created = 0, skipped = 0;
  for (const cap of CURATED_CAPABILITIES) {
    const existing = await db.capabilityAsset.findFirst({
      where: { title: cap.title, category: cap.category },
    });
    if (existing) {
      console.log(`  ⊘ SKIP: "${cap.title}" (already exists: ${existing.id})`);
      skipped++;
      continue;
    }
    const asset = await db.capabilityAsset.create({
      data: {
        title: cap.title,
        summary: cap.summary,
        category: cap.category,
        serviceLine: cap.serviceLine,
        solution: cap.solution,
        technology: cap.technology,
        industry: cap.industry,
        businessProblem: cap.businessProblem,
        customerOutcome: cap.customerOutcome,
        differentiator: cap.differentiator,
        targetIndustries: JSON.stringify(cap.targetIndustries),
        targetRoles: JSON.stringify(cap.targetRoles),
        targetCompanySizes: null,
        caseStudyRef: cap.caseStudyRef ? JSON.stringify(cap.caseStudyRef) : null,
        proofPointRef: cap.proofPointRef ? JSON.stringify(cap.proofPointRef) : null,
        keywords: JSON.stringify(cap.keywords),
        evidence: cap.evidence,
        content: cap.content,
        tags: JSON.stringify(cap.tags),
        isActive: true,
        version: 1,
      },
    });
    console.log(`  ✓ CREATED: "${cap.title}" (${asset.id})`);
    created++;
  }
  console.log(`\n  Capabilities: ${created} created, ${skipped} skipped\n`);

  // ── Step 2: Load Companies ──
  console.log('━━━ STEP 2: Loading Representative Companies ━━━');
  created = 0; skipped = 0;
  for (const c of REPRESENTATIVE_COMPANIES) {
    const existing = await db.company.findFirst({ where: { domain: c.domain } });
    if (existing) {
      console.log(`  ⊘ SKIP: "${c.rawName}" (already exists: ${existing.id})`);
      skipped++;
      continue;
    }
    const company = await db.company.create({
      data: {
        rawName: c.rawName,
        normalizedName: c.rawName.toLowerCase(),
        domain: c.domain,
        website: c.website,
        industry: c.industry,
        sizeRange: c.sizeRange,
        country: c.country,
        internalSummary: c.internalSummary,
        tags: '[]',
        status: 'prospect',
        lifecycleStage: 'discovery',
        source: 'intelligence-prep',
      },
    });
    console.log(`  ✓ CREATED: "${c.rawName}" (${company.id})`);
    created++;
  }
  console.log(`\n  Companies: ${created} created, ${skipped} skipped\n`);

  // ── Summary ──
  const totalCaps = await db.capabilityAsset.count({ where: { isActive: true } });
  const totalCompanies = await db.company.count({ where: { source: 'intelligence-prep' } });
  const totalSignals = await db.companySignal.count();
  const totalMatches = await db.signalCapabilityMatch.count();
  const totalOpportunities = await db.opportunityRecommendation.count();

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  DATA PREPARATION COMPLETE');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Capabilities:    ${totalCaps}`);
  console.log(`  Demo Companies:  ${totalCompanies}`);
  console.log(`  Signals:         ${totalSignals}`);
  console.log(`  Matches:         ${totalMatches}`);
  console.log(`  Opportunities:   ${totalOpportunities}`);
  console.log('');
  console.log('  NEXT: Start the server and run the enrichment pipeline:');
  console.log('    POST /api/companies/enrich    (for each company)');
  console.log('    POST /api/intelligence/enrich  (signal detection)');
  console.log('    POST /api/intelligence/full-pipeline (full intelligence)');
  console.log('═══════════════════════════════════════════════════════════\n');

  await db.$disconnect();
}

main().catch(err => {
  console.error('FATAL:', err);
  db.$disconnect();
  process.exit(1);
});
