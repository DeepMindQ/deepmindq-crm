// Standalone gold-standard seed — runs via tsx with DATABASE_URL env
import { config } from 'dotenv';
config();
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const NOW = new Date();
const DAYS_AGO = (n: number) => new Date(NOW.getTime() - n * 86400000);

async function seed() {
  console.log('Starting Gold Standard seed...');

  // Clean existing
  const existing = await db.company.findFirst({
    where: { normalizedName: { contains: 'microsoft' } },
  });
  if (existing) {
    console.log(`Cleaning existing Microsoft (id: ${existing.id})...`);
    await db.companySignal.deleteMany({ where: { companyId: existing.id } });
    await db.evidence.deleteMany({ where: { companyId: existing.id } });
    await db.contact.deleteMany({ where: { companyId: existing.id } });
    await db.companyResearchCard.deleteMany({ where: { companyId: existing.id } });
    await db.company.delete({ where: { id: existing.id } });
  }

  // Clean capabilities
  const capTitles = [
    'Cloud Migration & Modernization',
    'AI & Machine Learning Platform',
    'Cybersecurity & Zero Trust Architecture',
    'Data Analytics & Business Intelligence',
    'Application Modernization',
    'DevOps & Platform Engineering',
    'Enterprise Integration',
    'Digital Workplace Transformation',
  ];
  const existingCaps = await db.capabilityAsset.findMany({ where: { title: { in: capTitles } } });
  if (existingCaps.length) {
    await db.capabilityAsset.deleteMany({ where: { id: { in: existingCaps.map(c => c.id) } } });
  }

  // 1. Company
  const company = await db.company.create({
    data: {
      rawName: 'Microsoft Corporation',
      normalizedName: 'microsoft corporation',
      domain: 'microsoft.com',
      industry: 'Technology',
      sizeRange: 'Enterprise',
      website: 'https://microsoft.com',
      intelligenceScore: 92,
      engagementScore: 65,
      status: 'active',
      lifecycleStage: 'qualification',
      internalSummary: 'Microsoft is undergoing a major AI transformation with Azure OpenAI, Copilot across product lines, and a $10B capex commitment to AI infrastructure. Key decision-makers include Judson Althoff (CCO), Scott Guthrie (Cloud+AI), and Charlie Bell (Security). Recent signals include enterprise Copilot adoption at 60% of F500, Azure AI Studio GA, and 500+ AI-specific hires in 2025.',
      lastEnrichedAt: NOW,
    },
  });
  console.log(`Company: ${company.id}`);

  // 2. Research Card
  await db.companyResearchCard.create({
    data: {
      companyId: company.id,
      techStack: JSON.stringify(['azure','azure-openai','kubernetes','terraform','python','typescript','dotnet','react','sap-s4hana','databricks','snowflake','power-bi','github-actions','helm','redis','postgresql','cosmos-db','service-fabric']),
      strategicPriorities: JSON.stringify(['AI-first product strategy with Copilot across all product lines','Enterprise cloud migration accelerating on Azure','Zero Trust security architecture mandated across all systems','Data culture transformation via Fabric and Power BI']),
      businessProblems: JSON.stringify(['Competitive pressure from Google Gemini and AWS Bedrock in AI/ML','Legacy on-premises customer base migration velocity','Cross-product integration complexity with SAP, Oracle, Salesforce','Talent scarcity in AI/ML engineering and cybersecurity']),
      transformationAreas: JSON.stringify(['AI-powered enterprise productivity via Copilot','Hybrid cloud infrastructure modernization','Zero Trust security model across all products','Industry-specific cloud solutions']),
      technologyThemes: JSON.stringify(['Azure AI Studio GA enterprise AI platform','Kubernetes migration container orchestration','Terraform v3 infrastructure-as-code','OpenAI partnership GPT-4 integration']),
    },
  });
  console.log('Research card created');

  // 3. Signals (11 across 4 categories)
  type Sig = { companyId: string; signalType: string; title: string; description: string; severity: string; impact: string; confidence: number; sourceQuality: string; timingWindow: string; meaningCategory: string; source: string; sourceUrl: string; signalDate: Date };
  const signals: Sig[] = [
    // Technology (3)
    { companyId: company.id, signalType: 'technology', title: 'Azure AI Studio GA — Enterprise AI Platform', description: 'Microsoft announced general availability of Azure AI Studio with integrated OpenAI models, custom model training, and responsible AI tooling.', severity: 'high', impact: 'positive', confidence: 0.92, sourceQuality: 'high', timingWindow: 'current', meaningCategory: 'technology', source: 'Microsoft Azure Blog', sourceUrl: 'https://azure.microsoft.com/blog/azure-ai-studio-ga', signalDate: DAYS_AGO(5) },
    { companyId: company.id, signalType: 'technology', title: 'Kubernetes Migration — 200+ Services Containerized', description: 'Microsoft is migrating 200+ internal services to Kubernetes, signaling container orchestration maturity.', severity: 'high', impact: 'positive', confidence: 0.85, sourceQuality: 'high', timingWindow: 'active', meaningCategory: 'technology', source: 'Microsoft Engineering Blog', sourceUrl: 'https://engineering.microsoft.com/blog/k8s-migration', signalDate: DAYS_AGO(12) },
    { companyId: company.id, signalType: 'technology', title: 'Terraform v3 — IaC Standardization', description: 'Microsoft engineering teams standardized on Terraform v3, replacing legacy ARM templates.', severity: 'medium', impact: 'positive', confidence: 0.78, sourceQuality: 'medium', timingWindow: 'active', meaningCategory: 'technology', source: 'TechCrunch', sourceUrl: 'https://techcrunch.com/2025/06/microsoft-terraform-v3', signalDate: DAYS_AGO(18) },
    // Business (3)
    { companyId: company.id, signalType: 'business', title: '$10B AI Infrastructure Capex', description: 'Microsoft committed $10B in capex for AI infrastructure expansion in FY2025.', severity: 'high', impact: 'positive', confidence: 0.95, sourceQuality: 'high', timingWindow: 'current', meaningCategory: 'business', source: 'Microsoft Q4 FY2025 Earnings', sourceUrl: 'https://microsoft.com/investor/reports', signalDate: DAYS_AGO(3) },
    { companyId: company.id, signalType: 'business', title: 'Azure Region Expansion — 5 New Regions', description: 'Microsoft announced 5 new Azure regions in 2025 targeting Southeast Asia, Middle East, Latin America.', severity: 'medium', impact: 'positive', confidence: 0.88, sourceQuality: 'high', timingWindow: 'active', meaningCategory: 'business', source: 'Azure Blog', sourceUrl: 'https://azure.microsoft.com/blog/region-expansion-2025', signalDate: DAYS_AGO(8) },
    { companyId: company.id, signalType: 'business', title: 'SAP Partnership — S/4HANA on Azure', description: 'Microsoft and SAP expanded partnership offering S/4HANA migration on Azure with migration factory.', severity: 'medium', impact: 'positive', confidence: 0.82, sourceQuality: 'high', timingWindow: 'active', meaningCategory: 'business', source: 'SAP News', sourceUrl: 'https://news.sap.com/2025/06/sap-microsoft-partnership', signalDate: DAYS_AGO(15) },
    // External (3)
    { companyId: company.id, signalType: 'external', title: 'Leadership Reorg — Cloud+AI Elevated', description: 'CEO Nadella elevated Cloud+AI division consolidating Azure, AI Platform, Copilot under Scott Guthrie.', severity: 'high', impact: 'positive', confidence: 0.90, sourceQuality: 'high', timingWindow: 'current', meaningCategory: 'external', source: 'The Verge', sourceUrl: 'https://theverge.com/2025/07/microsoft-reorg-cloud-ai', signalDate: DAYS_AGO(7) },
    { companyId: company.id, signalType: 'external', title: 'Gartner MQ Leader — Cloud AI Services', description: 'Microsoft positioned as Leader in Gartner Magic Quadrant for Cloud AI Developer Services, 4th consecutive year.', severity: 'medium', impact: 'positive', confidence: 0.93, sourceQuality: 'high', timingWindow: 'recent', meaningCategory: 'external', source: 'Gartner Report', sourceUrl: 'https://gartner.com/reviews/cloud-ai-services', signalDate: DAYS_AGO(20) },
    { companyId: company.id, signalType: 'external', title: 'Copilot 60% Fortune 500 Adoption', description: 'Microsoft Copilot deployed in 60% of Fortune 500 with 35% productivity improvement.', severity: 'high', impact: 'positive', confidence: 0.87, sourceQuality: 'medium', timingWindow: 'current', meaningCategory: 'external', source: 'Bloomberg Technology', sourceUrl: 'https://bloomberg.com/technology/microsoft-copilot-adoption', signalDate: DAYS_AGO(10) },
    // Relationship (2)
    { companyId: company.id, signalType: 'relationship', title: '500+ AI Hires in 2025', description: 'Microsoft hired 500+ AI engineers, researchers, and product specialists in 2025.', severity: 'high', impact: 'positive', confidence: 0.84, sourceQuality: 'medium', timingWindow: 'active', meaningCategory: 'relationship', source: 'LinkedIn Analysis', sourceUrl: 'https://linkedin.com/news/microsoft-ai-hiring-2025', signalDate: DAYS_AGO(14) },
    { companyId: company.id, signalType: 'relationship', title: 'Cybersecurity CoE — Redmond', description: 'Microsoft established Cybersecurity Center of Excellence consolidating security research and Zero Trust teams.', severity: 'medium', impact: 'positive', confidence: 0.80, sourceQuality: 'medium', timingWindow: 'active', meaningCategory: 'relationship', source: 'Microsoft Security Blog', sourceUrl: 'https://microsoft.com/security/blog/cybercoe', signalDate: DAYS_AGO(22) },
  ];
  for (const s of signals) {
    await db.companySignal.create({ data: s });
  }
  console.log(`Signals: ${signals.length}`);

  // 4. Dummy batch for contacts
  const batch = await db.importBatch.create({
    data: { fileName: 'gold-standard-manual', fileHash: `gs-${company.id}`, totalRows: 7, acceptedRows: 7, duplicateRows: 0, invalidRows: 0, questionableRows: 0, status: 'completed' },
  });

  // 5. Contacts (7)
  type Cnt = { rawName: string; normalizedName: string; title: string; email: string; leadScore: number; companyFitScore: number; engagementScore: number; aiConversionScore: number; role: string };
  const contacts: Cnt[] = [
    { rawName: 'Judson Althoff', normalizedName: 'judson althoff', title: 'Executive Vice President, Chief Commercial Officer', email: 'judson.althoff@microsoft.com', leadScore: 95, companyFitScore: 92, engagementScore: 70, aiConversionScore: 88, role: 'decision-maker' },
    { rawName: 'Scott Guthrie', normalizedName: 'scott guthrie', title: 'Executive Vice President, Cloud + AI', email: 'scott.guthrie@microsoft.com', leadScore: 98, companyFitScore: 96, engagementScore: 75, aiConversionScore: 92, role: 'decision-maker' },
    { rawName: 'Charlie Bell', normalizedName: 'charlie bell', title: 'Executive Vice President, Security', email: 'charlie.bell@microsoft.com', leadScore: 92, companyFitScore: 90, engagementScore: 65, aiConversionScore: 85, role: 'decision-maker' },
    { rawName: 'Sarah Bodner', normalizedName: 'sarah bodner', title: 'Vice President, Azure AI', email: 'sarah.bodner@microsoft.com', leadScore: 88, companyFitScore: 94, engagementScore: 60, aiConversionScore: 82, role: 'influencer' },
    { rawName: 'Mark Russinovich', normalizedName: 'mark russinovich', title: 'CTO, Azure', email: 'mark.russinovich@microsoft.com', leadScore: 90, companyFitScore: 91, engagementScore: 55, aiConversionScore: 80, role: 'influencer' },
    { rawName: 'Deepak Sharma', normalizedName: 'deepak sharma', title: 'Senior Director, Cloud Migration', email: 'deepak.sharma@microsoft.com', leadScore: 72, companyFitScore: 78, engagementScore: 50, aiConversionScore: 65, role: 'team-member' },
    { rawName: 'Lisa Chen', normalizedName: 'lisa chen', title: 'Director, AI Platform Engineering', email: 'lisa.chen@microsoft.com', leadScore: 75, companyFitScore: 82, engagementScore: 45, aiConversionScore: 70, role: 'team-member' },
  ];
  for (const c of contacts) {
    await db.contact.create({ data: { ...c, companyId: company.id, batchId: batch.id } });
  }
  console.log(`Contacts: ${contacts.length}`);

  // 6. Capabilities (8)
  type Cap = { title: string; summary: string; category: string; technology: string | null; problems: string; keywords: string; isActive: boolean };
  const caps: Cap[] = [
    { title: 'Cloud Migration & Modernization', summary: 'End-to-end cloud migration services for enterprise workloads.', category: 'service_line', technology: 'Multi-cloud', problems: JSON.stringify(['legacy system modernization','cloud cost optimization','hybrid cloud architecture']), keywords: JSON.stringify(['cloud','azure','aws','migration','kubernetes','terraform','cloud-native','infrastructure']), isActive: true },
    { title: 'AI & Machine Learning Platform', summary: 'Enterprise AI/ML platform services — model development, deployment, MLOps, AI strategy.', category: 'service_line', technology: 'Multi-platform', problems: JSON.stringify(['AI adoption acceleration','ML model governance','AI talent shortage','responsible AI']), keywords: JSON.stringify(['ai','ml','machine-learning','ai-platform','gpt','openai','copilot','mlops','ai-studio','python']), isActive: true },
    { title: 'Cybersecurity & Zero Trust Architecture', summary: 'Zero Trust security implementation — identity, network segmentation, threat detection.', category: 'service_line', technology: 'Multi-platform', problems: JSON.stringify(['Zero Trust implementation','threat complexity','compliance automation','security talent gap']), keywords: JSON.stringify(['security','zero-trust','cybersecurity','identity','threat-detection','compliance','soc','siem']), isActive: true },
    { title: 'Data Analytics & Business Intelligence', summary: 'Enterprise analytics — data warehouse modernization, real-time analytics, BI dashboards.', category: 'service_line', technology: 'Multi-platform', problems: JSON.stringify(['data silos','analytics adoption','real-time insights','data governance']), keywords: JSON.stringify(['analytics','data','bi','power-bi','snowflake','databricks','data-warehouse','reporting']), isActive: true },
    { title: 'Application Modernization', summary: 'Legacy app modernization — microservices, API management, containerization.', category: 'service_line', technology: 'Multi-platform', problems: JSON.stringify(['technical debt','microservices adoption','legacy dependencies','release velocity']), keywords: JSON.stringify(['modernization','microservices','api','container','dotnet','react','devops','github-actions']), isActive: true },
    { title: 'DevOps & Platform Engineering', summary: 'Platform engineering — CI/CD pipelines, GitOps, infrastructure-as-code.', category: 'service_line', technology: 'Multi-platform', problems: JSON.stringify(['CI/CD maturity','deployment frequency','infrastructure consistency','developer productivity']), keywords: JSON.stringify(['devops','cicd','terraform','kubernetes','helm','github-actions','platform-engineering','iac']), isActive: true },
    { title: 'Enterprise Integration', summary: 'Enterprise system integration — ERP migration, CRM integration, API gateway design.', category: 'service_line', technology: 'Multi-platform', problems: JSON.stringify(['cross-system integration','data consistency','migration complexity','vendor lock-in']), keywords: JSON.stringify(['integration','sap','s4hana','oracle','salesforce','erp','middleware','api-gateway']), isActive: true },
    { title: 'Digital Workplace Transformation', summary: 'Digital workplace strategy — Microsoft 365 optimization, collaboration platforms.', category: 'service_line', technology: 'Microsoft', problems: JSON.stringify(['employee adoption','collaboration friction','remote work','digital skills gap']), keywords: JSON.stringify(['digital-workplace','microsoft-365','teams','collaboration','productivity','copilot']), isActive: true },
  ];
  for (const c of caps) {
    await db.capabilityAsset.create({ data: c });
  }
  console.log(`Capabilities: ${caps.length}`);

  // 7. Evidence (8)
  type Ev = { companyId: string; sourceUrl: string; sourceTitle: string; sourceName: string; snippet: string; relevanceScore: number; confidence: number; sourceDate: Date; sourceQualityTier: string };
  const evidences: Ev[] = [
    { companyId: company.id, sourceUrl: 'https://microsoft.com/investor/reports/fy2025-q4', sourceTitle: 'Microsoft Q4 FY2025 Earnings', sourceName: 'Microsoft Investor Relations', snippet: 'Microsoft committed $10 billion in capital expenditure for AI infrastructure expansion in FY2025.', relevanceScore: 0.95, confidence: 0.95, sourceDate: DAYS_AGO(3), sourceQualityTier: 'premium' },
    { companyId: company.id, sourceUrl: 'https://azure.microsoft.com/blog/azure-ai-studio-ga', sourceTitle: 'Azure AI Studio GA', sourceName: 'Microsoft Azure Blog', snippet: 'Azure AI Studio is now generally available with comprehensive AI development platform.', relevanceScore: 0.92, confidence: 0.92, sourceDate: DAYS_AGO(5), sourceQualityTier: 'premium' },
    { companyId: company.id, sourceUrl: 'https://bloomberg.com/technology/microsoft-copilot-adoption', sourceTitle: 'Copilot Enterprise Adoption', sourceName: 'Bloomberg Technology', snippet: 'Microsoft Copilot deployed in 60% of Fortune 500 with 35% productivity improvement.', relevanceScore: 0.87, confidence: 0.87, sourceDate: DAYS_AGO(10), sourceQualityTier: 'standard' },
    { companyId: company.id, sourceUrl: 'https://gartner.com/reviews/cloud-ai-services-2025', sourceTitle: 'Gartner MQ Cloud AI Services', sourceName: 'Gartner', snippet: 'Microsoft positioned as Leader for 4th consecutive year in Cloud AI Developer Services.', relevanceScore: 0.93, confidence: 0.93, sourceDate: DAYS_AGO(20), sourceQualityTier: 'premium' },
    { companyId: company.id, sourceUrl: 'https://news.sap.com/2025/06/sap-microsoft-partnership', sourceTitle: 'SAP-Microsoft Partnership', sourceName: 'SAP News', snippet: 'Microsoft and SAP expanded partnership with S/4HANA migration services on Azure.', relevanceScore: 0.82, confidence: 0.82, sourceDate: DAYS_AGO(15), sourceQualityTier: 'premium' },
    { companyId: company.id, sourceUrl: 'https://engineering.microsoft.com/blog/k8s-migration', sourceTitle: 'Kubernetes Migration Blog', sourceName: 'Microsoft Engineering Blog', snippet: 'Microsoft is migrating 200+ internal services to Kubernetes.', relevanceScore: 0.85, confidence: 0.85, sourceDate: DAYS_AGO(12), sourceQualityTier: 'premium' },
    { companyId: company.id, sourceUrl: 'https://linkedin.com/news/microsoft-ai-hiring-2025', sourceTitle: 'AI Hiring Surge', sourceName: 'LinkedIn', snippet: 'Microsoft has hired 500+ AI engineers, researchers, and product specialists in 2025.', relevanceScore: 0.84, confidence: 0.84, sourceDate: DAYS_AGO(14), sourceQualityTier: 'standard' },
    { companyId: company.id, sourceUrl: 'https://theverge.com/2025/07/microsoft-reorg-cloud-ai', sourceTitle: 'Cloud+AI Reorg', sourceName: 'The Verge', snippet: 'Nadella elevated Cloud+AI division consolidating Azure, AI Platform, Copilot under Guthrie.', relevanceScore: 0.90, confidence: 0.90, sourceDate: DAYS_AGO(7), sourceQualityTier: 'standard' },
  ];
  for (const e of evidences) {
    await db.evidence.create({ data: e });
  }
  console.log(`Evidence: ${evidences.length}`);

  console.log('\n========================================');
  console.log('  GOLD STANDARD SEED COMPLETE');
  console.log('========================================');
  console.log(`  Company:     Microsoft Corporation (${company.id})`);
  console.log(`  Signals:     11 (3 tech, 3 biz, 3 ext, 2 rel)`);
  console.log(`  Contacts:    7 (3 DM, 2 INF, 2 TM)`);
  console.log(`  Capabilities: 8`);
  console.log(`  Evidence:    8 (6 premium, 2 standard)`);
  console.log('========================================\n');
}

seed()
  .catch((e) => { console.error('Seed failed:', e); process.exit(1); })
  .finally(() => db.$disconnect());
