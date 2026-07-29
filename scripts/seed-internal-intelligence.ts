/**
 * Seed Internal Intelligence Graph
 * =================================
 *
 * Populates the CapabilityAsset table with realistic enterprise knowledge
 * that powers the AI Matching Engine. This is the "fuel" for the moat.
 *
 * Categories seeded:
 *   - service_line (core services)
 *   - case_study (success stories)
 *   - proof_point (metrics/credibility)
 *   - objection_response (sales battle cards)
 *   - technology (platform expertise)
 *   - industry_expertise (domain knowledge)
 *   - accelerator (reusable assets)
 *   - ip_platform (proprietary tools)
 */

import { db } from '@/lib/db';
import { CapabilityIntelligenceEngine } from '@/lib/capability-intelligence-engine';

const SEED_CAPABILITIES = [
  // ═══ SERVICE LINES ═══
  {
    title: 'AI & Machine Learning Solutions',
    summary: 'End-to-end ML pipeline development, model training, MLOps, and intelligent automation solutions. From data strategy through production deployment of NLP, computer vision, recommendation systems, and predictive analytics.',
    category: 'service_line',
    serviceLine: 'AI & Data',
    technology: 'Azure AI, AWS SageMaker, GCP Vertex AI, PyTorch, TensorFlow',
    industry: 'Cross-Industry',
    businessProblem: 'Organizations struggle to move AI from experimentation to production. They lack the MLOps infrastructure, data pipelines, and engineering expertise to deploy models at scale.',
    customerOutcome: 'Production-ready AI systems that generate measurable business value within 12 weeks. 3x faster time-to-production compared to internal builds.',
    differentiator: 'Full-stack AI delivery from data engineering through MLOps, with pre-built accelerators that reduce development time by 60%.',
    targetIndustries: ['Financial Services', 'Healthcare', 'Manufacturing', 'Retail', 'Technology'],
    targetRoles: ['CTO', 'VP Engineering', 'Head of Data', 'Chief Data Officer', 'AI/ML Lead'],
    keywords: ['ai', 'machine learning', 'ml', 'deep learning', 'nlp', 'computer vision', 'mlops', 'generative ai', 'llm'],
    evidence: '150+ successful AI/ML implementations across Fortune 500 companies. Specialized in GenAI integration, responsible AI governance, and enterprise-grade MLOps platforms.',
  },
  {
    title: 'Cloud Engineering & Migration',
    summary: 'Multi-cloud architecture design, migration strategy, and cloud-native application development on AWS, Azure, and GCP. Zero-downtime migration with full security and compliance assurance.',
    category: 'service_line',
    serviceLine: 'Cloud & Infrastructure',
    technology: 'AWS, Azure, GCP, Kubernetes, Terraform, Docker',
    industry: 'Cross-Industry',
    businessProblem: 'Legacy on-premise infrastructure is expensive, inflexible, and unable to support modern digital initiatives. Organizations face vendor lock-in concerns and migration complexity.',
    customerOutcome: '60-70% infrastructure cost reduction. 99.99% uptime SLA. Migration completed in 8-12 weeks with zero downtime.',
    differentiator: 'Patented Cloud Migration Factory approach with automated assessment tools and pre-built migration patterns. 200+ successful migrations.',
    targetIndustries: ['Financial Services', 'Healthcare', 'Technology', 'Manufacturing', 'Government'],
    targetRoles: ['CTO', 'VP Engineering', 'Cloud Architect', 'Head of Infrastructure', 'DevOps Lead'],
    keywords: ['cloud', 'aws', 'azure', 'gcp', 'migration', 'kubernetes', 'terraform', 'devops', 'cloud-native', 'serverless'],
    evidence: '200+ cloud migrations completed. Average 65% cost reduction. Zero-downtime migration track record across financial services and healthcare.',
  },
  {
    title: 'Data Engineering & Analytics',
    summary: 'Enterprise data platform design, real-time analytics, data governance, and warehouse modernization. Building modern lakehouse architectures that turn raw data into actionable business intelligence.',
    category: 'service_line',
    serviceLine: 'AI & Data',
    technology: 'Snowflake, Databricks, dbt, Apache Spark, Airflow, Kafka',
    industry: 'Cross-Industry',
    businessProblem: 'Data silos prevent organizations from making unified, data-driven decisions. Poor data quality, slow analytics, and lack of governance lead to missed opportunities.',
    customerOutcome: 'Real-time analytics in under 4 weeks. 99.9% platform uptime. Self-service analytics that empowers 10x more business users.',
    differentiator: 'Pre-built data quality frameworks and governance accelerators. Specialized in financial services data platforms with regulatory compliance.',
    targetIndustries: ['Financial Services', 'Healthcare', 'Retail', 'Manufacturing'],
    targetRoles: ['CDO', 'VP Data', 'Head of Analytics', 'Data Architect', 'BI Lead'],
    keywords: ['data engineering', 'analytics', 'snowflake', 'databricks', 'data warehouse', 'data lake', 'etl', 'real-time', 'governance'],
    evidence: '120+ data platform implementations. Average 4-week time-to-first-insight. Specialized in regulated industries with full compliance frameworks.',
  },
  {
    title: 'Digital Transformation Consulting',
    summary: 'Strategic technology advisory and implementation for enterprise digital transformation. From assessment and roadmap creation through execution of large-scale modernization programs.',
    category: 'service_line',
    serviceLine: 'Advisory & Strategy',
    technology: 'Cross-platform',
    industry: 'Cross-Industry',
    businessProblem: 'Organizations know they need to modernize but struggle with prioritization, change management, and execution. Digital initiatives fail at 70% rate due to poor strategy.',
    customerOutcome: 'Clear 18-month transformation roadmap with measurable milestones. 85% initiative success rate (vs industry average of 30%).',
    differentiator: 'Industry-specific transformation playbooks developed from 200+ engagements. Combined strategy + execution capability.',
    targetIndustries: ['Financial Services', 'Healthcare', 'Manufacturing', 'Retail', 'Government'],
    targetRoles: ['CEO', 'CIO', 'CTO', 'VP Digital', 'Head of Strategy'],
    keywords: ['digital transformation', 'modernization', 'strategy', 'roadmap', 'change management', 'innovation'],
    evidence: '85% client satisfaction rate. Average engagement spans 18 months. Trusted by 50+ enterprise CIOs as strategic technology partner.',
  },
  {
    title: 'Cybersecurity & Compliance',
    summary: 'Enterprise security architecture, compliance automation, threat detection, and zero-trust implementation. Specializing in regulated industries (FINRA, SOC 2, HIPAA, PCI-DSS).',
    category: 'service_line',
    serviceLine: 'Security & Compliance',
    technology: 'Azure Sentinel, CrowdStrike, Palo Alto, Splunk, Zscaler',
    industry: 'Cross-Industry',
    businessProblem: 'Increasing cyber threats, complex compliance requirements, and security talent shortages leave organizations vulnerable. Manual compliance processes are slow and error-prone.',
    customerOutcome: '85% reduction in security incidents. Automated compliance reporting reduces audit preparation time by 90%.',
    differentiator: 'Compliance-as-Code approach with pre-built security frameworks for regulated industries. 24/7 SOC with AI-powered threat detection.',
    targetIndustries: ['Financial Services', 'Healthcare', 'Government', 'Technology'],
    targetRoles: ['CISO', 'VP Security', 'Chief Compliance Officer', 'Head of IT Security'],
    keywords: ['cybersecurity', 'compliance', 'zero trust', 'soc', 'siem', 'hipaa', 'pci', 'soc2', 'finra', 'threat detection'],
    evidence: '100+ security assessments completed. Zero major breaches for managed SOC clients. 95% compliance audit pass rate on first attempt.',
  },

  // ═══ CASE STUDIES ═══
  {
    title: 'Fortune 500 Financial Services — AI Document Automation',
    summary: 'Reduced document processing time by 85% for a Fortune 500 financial services company through AI-powered document automation. Deployed NLP models for automated extraction, classification, and processing of 500K+ monthly documents.',
    category: 'case_study',
    serviceLine: 'AI & Data',
    technology: 'Azure AI, Python, NLP, OCR',
    industry: 'Financial Services',
    businessProblem: 'Manual document processing was taking 45 minutes per document with 12% error rate. Volume growing 30% annually.',
    customerOutcome: '85% processing time reduction (45 min to 7 min). Error rate dropped to 0.3%. $2.4M annual savings. 99.7% accuracy.',
    differentiator: 'Custom NLP models trained on financial services domain data. 12-week deployment from assessment to production.',
    targetIndustries: ['Financial Services'],
    targetRoles: ['COO', 'CFO', 'VP Operations', 'Head of Back Office'],
    keywords: ['ai', 'automation', 'document processing', 'nlp', 'financial services', 'ocr'],
    evidence: '$2.4M annual savings. 85% time reduction. 99.7% accuracy. Featured in Gartner case study.',
    caseStudyRef: [{ title: 'AI Document Automation for Fortune 500 FS', industry: 'Financial Services', outcome: '$2.4M savings, 85% time reduction' }],
    proofPointRef: [{ metric: 'Processing Time', value: '85% reduction', context: 'From 45 min to 7 min per document' }, { metric: 'Error Rate', value: '0.3%', context: 'Down from 12%' }, { metric: 'Annual Savings', value: '$2.4M', context: 'Direct operational cost reduction' }],
  },
  {
    title: 'Healthcare Platform — Cloud Migration to Azure',
    summary: 'Migrated 200+ microservices from on-premise data centers to Azure cloud-native architecture for a major healthcare platform. Achieved zero downtime during migration while maintaining HIPAA compliance.',
    category: 'case_study',
    serviceLine: 'Cloud & Infrastructure',
    technology: 'Azure, Kubernetes, Terraform, Azure DevOps',
    industry: 'Healthcare',
    businessProblem: 'On-premise infrastructure costing $4.2M annually with frequent outages. HIPAA compliance requirements adding complexity. Scaling limited by physical hardware.',
    customerOutcome: '99.99% uptime achieved. $3.1M annual infrastructure savings (74% reduction). HIPAA compliance maintained throughout. 35% improvement in deployment velocity.',
    differentiator: 'Zero-downtime migration of 200+ microservices. Automated compliance validation integrated into CI/CD pipeline.',
    targetIndustries: ['Healthcare'],
    targetRoles: ['CTO', 'VP Engineering', 'CISO', 'Head of Infrastructure'],
    keywords: ['cloud', 'azure', 'healthcare', 'migration', 'hipaa', 'kubernetes', 'microservices'],
    evidence: '$3.1M annual savings. 99.99% uptime. 200+ services migrated. Zero security incidents.',
    caseStudyRef: [{ title: 'Healthcare Platform Cloud Migration', industry: 'Healthcare', outcome: '$3.1M savings, 99.99% uptime' }],
    proofPointRef: [{ metric: 'Infrastructure Cost', value: '74% reduction', context: '$4.2M to $1.1M annually' }, { metric: 'Uptime', value: '99.99%', context: 'Up from 97.2%' }, { metric: 'Deployment Velocity', value: '35% improvement', context: 'From 2 weeks to 9 days avg' }],
  },
  {
    title: 'Retail Bank — Real-Time Data Platform',
    summary: 'Built a modern real-time data platform for a top-20 retail bank, enabling instant fraud detection, personalized customer offers, and regulatory reporting. Migrated from legacy batch processing to real-time streaming architecture.',
    category: 'case_study',
    serviceLine: 'AI & Data',
    technology: 'Databricks, Kafka, Spark, Snowflake, dbt',
    industry: 'Financial Services',
    businessProblem: 'Batch processing meant 24-hour delay in fraud detection. Customer data fragmented across 15 systems. Regulatory reporting taking 3 weeks to compile.',
    customerOutcome: 'Real-time fraud detection (sub-second). 360-degree customer view enabling personalized offers. Regulatory reporting automated (3 weeks to 2 hours). $8M fraud loss prevention.',
    differentiator: 'Built banking-specific data quality and governance frameworks. Regulatory compliance automated through compliance-as-code.',
    targetIndustries: ['Financial Services', 'Retail', 'Banking'],
    targetRoles: ['CDO', 'VP Data', 'Head of Analytics', 'Chief Risk Officer'],
    keywords: ['data platform', 'real-time', 'fraud detection', 'banking', 'databricks', 'kafka', 'streaming'],
    evidence: '$8M fraud prevention. 2-hour regulatory reporting. Real-time customer insights. Featured at Snowflake Summit.',
    caseStudyRef: [{ title: 'Real-Time Data Platform for Retail Bank', industry: 'Financial Services', outcome: '$8M fraud prevention, real-time insights' }],
    proofPointRef: [{ metric: 'Fraud Detection', value: 'Sub-second', context: 'Was 24-hour batch delay' }, { metric: 'Regulatory Reporting', value: '2 hours', context: 'Was 3 weeks' }, { metric: 'Fraud Loss Prevention', value: '$8M annually', context: 'Real-time vs batch detection' }],
  },
  {
    title: 'Manufacturing Giant — Predictive Maintenance AI',
    summary: 'Deployed AI-powered predictive maintenance system for a Fortune 100 manufacturer, preventing equipment failures before they occur. Combined IoT sensor data with ML models to predict failures 72 hours in advance.',
    category: 'case_study',
    serviceLine: 'AI & Data',
    technology: 'Azure IoT, Python, TensorFlow, Power BI',
    industry: 'Manufacturing',
    businessProblem: 'Unplanned equipment downtime costing $15M annually. Reactive maintenance causing 30% higher repair costs. Safety incidents from unexpected failures.',
    customerOutcome: '72-hour advance failure prediction with 94% accuracy. $15M annual downtime cost eliminated. 30% reduction in maintenance costs. Zero safety incidents from equipment failure.',
    differentiator: 'Manufacturing-specific ML models trained on 3 years of sensor data. Edge computing for real-time prediction at the factory floor.',
    targetIndustries: ['Manufacturing', 'Energy', 'Utilities', 'Transportation'],
    targetRoles: ['VP Operations', 'CTO', 'Head of Manufacturing', 'Plant Manager'],
    keywords: ['predictive maintenance', 'iot', 'manufacturing', 'ai', 'machine learning', 'edge computing'],
    evidence: '$15M downtime elimination. 94% prediction accuracy. 30% maintenance cost reduction.',
    caseStudyRef: [{ title: 'Predictive Maintenance for Fortune 100 Manufacturer', industry: 'Manufacturing', outcome: '$15M savings, 94% accuracy' }],
    proofPointRef: [{ metric: 'Failure Prediction', value: '72 hours advance', context: 'With 94% accuracy' }, { metric: 'Downtime Savings', value: '$15M annually', context: 'Eliminated unplanned downtime' }, { metric: 'Maintenance Cost', value: '30% reduction', context: 'From reactive to predictive' }],
  },

  // ═══ PROOF POINTS ═══
  {
    title: '150+ Enterprise Implementations',
    summary: '150+ successful enterprise implementations across financial services, healthcare, manufacturing, and technology sectors. Average 3x ROI within 12 months.',
    category: 'proof_point',
    industry: 'Cross-Industry',
    evidence: 'Average 3x ROI within 12 months',
    keywords: ['enterprise', 'track-record', 'roi'],
    proofPointRef: [{ metric: 'Total Implementations', value: '150+', context: 'Across 4 major industries' }, { metric: 'Average ROI', value: '3x', context: 'Within 12 months of go-live' }, { metric: 'Client Retention', value: '92%', context: 'Annual retention rate' }],
  },
  {
    title: '99.99% Uptime SLA',
    summary: 'Consistently delivering 99.99% uptime across all managed cloud and data platforms. Industry-leading reliability backed by 24/7 monitoring and automated remediation.',
    category: 'proof_point',
    industry: 'Cross-Industry',
    evidence: 'Zero major outages in the last 36 months',
    keywords: ['uptime', 'reliability', 'sla', 'operations'],
    proofPointRef: [{ metric: 'Uptime SLA', value: '99.99%', context: 'Across all managed platforms' }, { metric: 'Major Outages', value: '0', context: 'In the last 36 months' }, { metric: 'MTTR', value: '<5 min', context: 'Mean time to resolution' }],
  },
  {
    title: 'Certified Across All Major Clouds',
    summary: 'Hold certifications across AWS, Azure, and GCP. Specialized competencies in AI/ML, Data Analytics, and Security for each platform.',
    category: 'proof_point',
    industry: 'Cross-Industry',
    evidence: 'AWS Advanced Partner, Azure Gold, GCP Premier',
    keywords: ['certified', 'aws', 'azure', 'gcp', 'cloud', 'partnership'],
    proofPointRef: [{ metric: 'AWS', value: 'Advanced Partner', context: 'Specialized in AI/ML and Data' }, { metric: 'Azure', value: 'Gold Partner', context: 'Specialized in Data and Security' }, { metric: 'GCP', value: 'Premier Partner', context: 'Specialized in Data Analytics' }],
  },
  {
    title: '200+ Certified Engineers',
    summary: 'Team of 200+ certified engineers across cloud, data, AI, and security domains. Average 8+ years of enterprise experience.',
    category: 'proof_point',
    industry: 'Cross-Industry',
    evidence: '200+ engineers, 50+ certifications, 8+ years avg experience',
    keywords: ['team', 'engineers', 'certified', 'expertise', 'talent'],
    proofPointRef: [{ metric: 'Engineers', value: '200+', context: 'Across cloud, data, AI, security' }, { metric: 'Certifications', value: '50+', context: 'AWS, Azure, GCP, Snowflake, Databricks' }, { metric: 'Avg Experience', value: '8+ years', context: 'In enterprise delivery' }],
  },

  // ═══ OBJECTION RESPONSES ═══
  {
    title: 'Cost vs. In-House Building',
    summary: 'When prospects say they can build it internally, acknowledge their capability, then pivot to speed and focus.',
    category: 'objection_response',
    targetRoles: ['CTO', 'VP Engineering', 'CFO'],
    content: 'Acknowledge their capability, then pivot to speed and opportunity cost: "Your team is absolutely capable — the question is whether this is the highest-impact use of their time right now. We have 200+ engineers who have solved this exact problem 150+ times. We deliver in 12 weeks what typically takes 6-12 months to build internally. What could your team accomplish in those 6 months if we handled this?"',
    keywords: ['objection', 'budget', 'build vs buy', 'internal', 'cost'],
  },
  {
    title: 'Budget Constraints',
    summary: 'When prospects say budget is tight, reframe around ROI, phased approach, and proven outcomes.',
    category: 'objection_response',
    targetRoles: ['CFO', 'VP Finance', 'Procurement'],
    content: 'Refocus on value and phased approach: "We typically see 3x ROI within the first year. Would it help if we structured this as a phased engagement — starting with the highest-impact area for a smaller initial investment? Our Fortune 500 document automation client saved $2.4M in year one on a project that paid for itself in 5 months. What would a 3x return look like for your organization?"',
    keywords: ['objection', 'budget', 'roi', 'phased', 'investment'],
  },
  {
    title: 'Already Have a Vendor',
    summary: 'When prospects say they already have a vendor for this capability, position as complementary or improvement.',
    category: 'objection_response',
    targetRoles: ['CTO', 'VP Engineering', 'Procurement'],
    content: 'Position as complementary or improvement opportunity: "That is great that you have an existing partner. Many of our best clients came to us because they needed specialized expertise their current vendor lacked. We would not ask you to replace them — instead, we focus on the areas where we have 150+ proven implementations. Would it be valuable to have a 30-minute discussion about the specific outcomes our AI practice delivers that might complement your current setup?"',
    keywords: ['objection', 'competition', 'vendor', 'incumbent', 'switching'],
  },
  {
    title: 'Security and Data Privacy Concerns',
    summary: 'When prospects express concern about data security and privacy, leverage compliance track record and certifications.',
    category: 'objection_response',
    targetRoles: ['CISO', 'VP Security', 'Chief Compliance Officer', 'Legal'],
    content: 'Lead with track record: "I completely understand that concern — especially in your industry. We operate under the same compliance frameworks you do: SOC 2 Type II, HIPAA, PCI-DSS, FINRA. Our managed SOC has had zero major security incidents in 36 months. We can provide our full compliance documentation and architecture diagrams before any engagement begins. Would it be helpful to schedule a call with our CISO to address your specific security requirements?"',
    keywords: ['objection', 'security', 'compliance', 'privacy', 'soc2', 'hipaa'],
  },

  // ═══ TECHNOLOGIES ═══
  {
    title: 'Microsoft Azure',
    summary: 'Azure Gold Partner with deep expertise across Azure AI, Azure Data, Azure DevOps, and Azure Security. Specialized in enterprise Azure migration and modernization.',
    category: 'technology',
    technology: 'Azure',
    industry: 'Cross-Industry',
    businessProblem: 'Organizations need a trusted Azure partner who understands enterprise complexity, compliance requirements, and can deliver at scale.',
    keywords: ['azure', 'microsoft', 'cloud', 'enterprise', 'ai', 'data'],
    evidence: 'Azure Gold Partner. 80+ Azure implementations. Specialized in Azure AI and Azure Data services.',
  },
  {
    title: 'Snowflake',
    summary: 'Expert Snowflake implementation and optimization partner. Build modern data cloud architectures with Snowflake as the foundation.',
    category: 'technology',
    technology: 'Snowflake',
    industry: 'Cross-Industry',
    businessProblem: 'Organizations need to modernize their data warehouse but lack Snowflake-specific expertise for optimal architecture, performance tuning, and cost management.',
    keywords: ['snowflake', 'data warehouse', 'data cloud', 'analytics'],
    evidence: 'Snowflake Select Partner. 40+ Snowflake implementations. Specialized in financial services data clouds.',
  },
  {
    title: 'Databricks',
    summary: 'Databricks implementation partner specializing in lakehouse architectures, real-time analytics, and ML platform builds on the Databricks Data Intelligence Platform.',
    category: 'technology',
    technology: 'Databricks',
    industry: 'Cross-Industry',
    businessProblem: 'Organizations struggle to unify their data engineering, analytics, and ML workloads. Databricks lakehouse architecture solves this but requires specialized expertise.',
    keywords: ['databricks', 'lakehouse', 'spark', 'ml', 'analytics', 'delta lake'],
    evidence: 'Databricks Partner. 30+ lakehouse implementations. Specialized in real-time streaming analytics.',
  },

  // ═══ INDUSTRY EXPERTISE ═══
  {
    title: 'Financial Services',
    summary: 'Deep domain expertise in banking, insurance, capital markets, and fintech. 60+ implementations in the financial services sector with specialized compliance frameworks for FINRA, SEC, SOX, and PCI-DSS.',
    category: 'industry_expertise',
    industry: 'Financial Services',
    businessProblem: 'Financial services organizations face unique challenges: regulatory compliance, real-time fraud detection, data governance, and legacy system modernization.',
    keywords: ['financial services', 'banking', 'insurance', 'fintech', 'compliance', 'regulatory'],
    evidence: '60+ financial services implementations. Specialized compliance frameworks. Trusted by top-20 US banks.',
  },
  {
    title: 'Healthcare & Life Sciences',
    summary: 'Healthcare IT specialists with 40+ implementations across hospitals, health systems, payers, and life sciences. HIPAA-compliant delivery with deep HL7/FHIR integration expertise.',
    category: 'industry_expertise',
    industry: 'Healthcare',
    businessProblem: 'Healthcare organizations need to modernize while maintaining HIPAA compliance, integrating with legacy EHR systems, and improving patient outcomes through data-driven insights.',
    keywords: ['healthcare', 'hipaa', 'ehr', 'fhir', 'life sciences', 'payer', 'provider'],
    evidence: '40+ healthcare implementations. HIPAA-certified delivery model. Specialized in EHR integration and clinical data platforms.',
  },

  // ═══ ACCELERATORS ═══
  {
    title: 'Cloud Migration Factory',
    summary: 'Pre-built migration assessment tool, automated migration scripts, and proven migration patterns that reduce cloud migration time by 60%.',
    category: 'accelerator',
    serviceLine: 'Cloud & Infrastructure',
    technology: 'Terraform, Azure DevOps, AWS CDK',
    businessProblem: 'Cloud migrations are complex, time-consuming, and risky. Organizations need a repeatable, efficient migration approach.',
    customerOutcome: '60% faster migration. Standardized assessment in 1 week. Automated provisioning of cloud infrastructure.',
    differentiator: 'Used in 200+ migrations. Pre-built patterns for common enterprise workloads. Automated compliance validation.',
    keywords: ['accelerator', 'migration', 'cloud', 'automation', 'factory'],
  },
  {
    title: 'AI Governance Framework',
    summary: 'Pre-built AI governance toolkit for responsible AI deployment. Includes bias detection, model explainability, data lineage tracking, and automated compliance reporting.',
    category: 'accelerator',
    serviceLine: 'AI & Data',
    technology: 'Python, MLflow, SHAP, Azure AI',
    businessProblem: 'Organizations deploying AI struggle with governance, bias detection, explainability, and regulatory compliance for AI models.',
    customerOutcome: 'Automated bias detection and reporting. Model explainability dashboards. Regulatory compliance documentation in hours instead of weeks.',
    differentiator: 'Purpose-built for regulated industries. Integrates with existing MLOps pipelines. Supports multiple AI frameworks.',
    keywords: ['accelerator', 'ai governance', 'responsible ai', 'bias', 'explainability', 'compliance'],
  },
  {
    title: 'Data Quality Accelerator',
    summary: 'Automated data quality monitoring and remediation toolkit. Pre-built data quality rules for financial services, healthcare, and retail domains.',
    category: 'accelerator',
    serviceLine: 'AI & Data',
    technology: 'dbt, Great Expectations, Spark',
    businessProblem: 'Poor data quality costs organizations $12.9M annually (Gartner). Manual data quality processes are slow, inconsistent, and don not scale.',
    customerOutcome: 'Automated quality monitoring across all data pipelines. 95% data quality improvement in 8 weeks. Pre-built rules for common data quality issues.',
    differentiator: 'Domain-specific quality rules (not generic). Automated remediation suggestions. Real-time quality dashboards.',
    keywords: ['accelerator', 'data quality', 'governance', 'monitoring', 'automated'],
  },

  // ═══ IP PLATFORMS ═══
  {
    title: 'Intelligence Score Engine',
    summary: 'Proprietary revenue intelligence scoring algorithm that combines 9 dimensions of prospect intelligence to produce an actionable 0-100 score with full reasoning transparency.',
    category: 'ip_platform',
    businessProblem: 'Traditional lead scoring is opaque and unexplainable. Sales teams cannot understand WHY a lead scored high or low.',
    customerOutcome: 'Explainable scoring with evidence chains. Sales teams trust and act on scores. 3x improvement in lead conversion.',
    differentiator: '9-dimension scoring with AI reasoning. Every score comes with evidence, reasoning, and confidence level.',
    keywords: ['ip', 'scoring', 'intelligence', 'algorithm', 'proprietary'],
  },
  {
    title: 'AI Matching Engine',
    summary: 'Proprietary semantic matching engine that connects external prospect signals to internal capability knowledge. The core differentiator that transforms DeepMindQ from a research tool into a revenue operating system.',
    category: 'ip_platform',
    businessProblem: 'Sales teams manually match prospects to capabilities. Inconsistent matching leads to missed opportunities and irrelevant outreach.',
    customerOutcome: 'Automated signal-to-capability matching. Every buying signal matched to relevant case studies, proof points, and positioning guidance.',
    differentiator: 'Dual intelligence graph: External (prospect) + Internal (capability) → AI matching → Account Strategy.',
    keywords: ['ip', 'matching', 'ai', 'semantic', 'capability', 'intelligence graph'],
  },
];

async function seedInternalIntelligenceGraph() {
  console.log('════════════════════════════════════════════════════════════════');
  console.log('  SEEDING INTERNAL INTELLIGENCE GRAPH');
  console.log('════════════════════════════════════════════════════════════════');

  // Check current state
  const currentCount = await db.capabilityAsset.count();
  console.log(`\nCurrent capability assets in DB: ${currentCount}`);

  if (currentCount > 0) {
    console.log('⚠️  Capability assets already exist. Skipping seed to avoid duplicates.');
    console.log('    To re-seed, delete existing assets first.');
    return;
  }

  // Bulk ingest all capabilities
  console.log(`\nIngesting ${SEED_CAPABILITIES.length} capability assets...`);
  const result = await CapabilityIntelligenceEngine.bulkIngest(
    SEED_CAPABILITIES as any
  );

  console.log(`\n✅ Seed Results:`);
  console.log(`   Total: ${result.total}`);
  console.log(`   Created: ${result.created}`);
  console.log(`   Skipped: ${result.skipped}`);
  console.log(`   Errors: ${result.errors}`);

  if (result.errors > 0) {
    console.log('\n⚠️  Errors:');
    for (const detail of result.details.filter(d => d.status === 'error')) {
      console.log(`   - ${detail.title}: ${detail.reason}`);
    }
  }

  // Show final graph status
  const status = await CapabilityIntelligenceEngine.getGraphStatus();
  console.log(`\n📊 Graph Status:`);
  console.log(`   Total Capabilities: ${status.totalCapabilities}`);
  console.log(`   Embedded: ${status.embededCapabilities}`);
  console.log(`   By Category: ${JSON.stringify(status.capabilitiesByCategory, null, 2)}`);
  console.log(`   Health: ${status.graphHealth}`);

  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('  INTERNAL INTELLIGENCE GRAPH SEEDED SUCCESSFULLY');
  console.log('════════════════════════════════════════════════════════════════');
}

// Run if executed directly
seedInternalIntelligenceGraph()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });

export { seedInternalIntelligenceGraph, SEED_CAPABILITIES };
