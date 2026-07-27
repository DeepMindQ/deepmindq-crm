import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
function makeId() { return Math.random().toString(36).substring(2, 15) + Date.now().toString(36); }
function daysAgo(n: number) { return new Date(Date.now() - n * 86400000); }
function rand(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

const INDUSTRIES = ['Banking & Financial Services','Insurance','Manufacturing','Healthcare & Pharma','Government & Public Sector','Technology'];

const COMPANY_NAMES: Record<string, string[]> = {
  'Banking & Financial Services': ['Meridian Capital Bank','Atlas National Financial','Pacific Trust Holdings','Sterling Commercial Bank','Apex Financial Group','Continental Banking Corp','Harborside Financial','Ironwood Capital','Northstar Banking','Crescent Valley Bank','Summit Financial Services','Redwood National Bank','Coastal Commerce Bank','Evergreen Financial','Liberty Trust Corporation','Silver Lake Banking','Cascadia Financial','Prairie National Bank','Blue Ridge Capital','Grandview Financial'],
  'Insurance': ['Sentinel Insurance Group','Guardian Shield Insurance','Prudential Life Insurance','Atlas Casualty Group','Pacific Coast Insurance','Heritage Life Insurance','Pinnacle Insurance Corp','Cornerstone Insurance','Liberty Mutual Re','Monarch Insurance Holdings','Atlas Reinsurance','Evergreen Casualty','Summit Insurance Group','Sterling Life Insurance','Continental Insurance'],
  'Manufacturing': ['Titan Industries','Precision Manufacturing Corp','Atlas Heavy Industries','Cascadia Manufacturing','Summit Industrial','Ironworks Manufacturing','Pacific Steel Corp','Meridian Aerospace','Liberty Electronics','Coastal Industrial','Redwood Manufacturing','Northstar Engineering','Evergreen Industrial','Silver Lake Precision','Blue Ridge Manufacturing'],
  'Healthcare & Pharma': ['Meridian Health Systems','Pacific Health Corp','Atlas Pharmaceuticals','Sentinel Healthcare','Cascadia Health','Summit Medical Center','Guardian Pharma','Pinnacle Health Systems','Heritage BioPharma','Continental Healthcare','Northstar Medical','Evergreen Pharma','Silver Lake Health','Blue Ridge Health Systems','Redwood Medical Center'],
  'Government & Public Sector': ['Federal Technology Agency','Department of Digital Services','National Data Authority','State of Cascadia IT','Metro Government Services','Federal Cloud Initiative','National Cybersecurity Center','State Digital Transformation Office','Federal Health IT Agency','Metro Data Analytics Office','National Infrastructure Authority','State Compliance Agency','Federal Intelligence Systems','Metro Citizen Services','National Records Administration'],
  'Technology': ['Nexus Cloud Platform','Quantum Data Systems','Atlas AI Corporation','Sentinel Cybersecurity','Cascadia Software','Summit AI Labs','Ironcloud Infrastructure','Pacific Data Corp','Meridian Tech Solutions','Liberty Cloud Services','Coastal Analytics','Redwood Systems','Northstar AI','Evergreen Software','Silver Lake Technologies'],
};

const SIGNALS_BY_INDUSTRY: Record<string, string[]> = {
  'Banking & Financial Services': ['Cloud migration to AWS/Azure announced','Core banking system modernization RFP','AI fraud detection platform evaluation','Open banking API initiative launched','Hired VP of Digital Banking','New CIO appointed','Cybersecurity audit triggered','$200M digital transformation budget','Data lake consolidation project','Mobile banking platform upgrade','Regulatory compliance automation','Blockchain pilot for payments','Risk management platform RFP','Customer 360 initiative started','Hired 40 cloud engineers','New Head of Data Analytics','Real-time payments upgrade','Hired Chief Data Officer'],
  'Insurance': ['Claims automation platform evaluation','AI-powered underwriting initiative','Legacy system modernization plan','Hired VP Claims Technology','New CTO from insurtech','Telematics platform expansion','Regulatory reporting automation','Customer portal modernization RFP','Hired Head of Actuarial Data Science','Cloud infrastructure migration','Data warehouse modernization','Fraud detection AI pilot','$150M technology investment','New VP Digital Customer Experience','Expanded data engineering team'],
  'Manufacturing': ['Industry 4.0 digital transformation','IoT platform for predictive maintenance','SAP S/4HANA migration','Supply chain digitization','Hired VP Smart Manufacturing','New CTO appointed','Robotics automation expansion','Quality management system upgrade','Digital twin implementation','ERP cloud migration RFP','Hired 30 data engineers','Energy management optimization','Shop floor analytics platform','Hired Head of Operational Technology','Cybersecurity assessment for OT'],
  'Healthcare & Pharma': ['EHR system interoperability upgrade','AI diagnostic platform evaluation','Telehealth platform expansion','Hired VP Clinical Informatics','HIPAA compliance automation','Precision medicine data platform','Revenue cycle modernization','Patient engagement platform RFP','Hired Chief Data Officer','Cloud migration for PHI workloads','Clinical trial management upgrade','Population health analytics','Hired Head of Health IT Security','Drug discovery AI platform'],
  'Government & Public Sector': ['FedRAMP cloud migration','Zero-trust cybersecurity implementation','Data center consolidation','Hired Deputy CIO','Citizen services digital transformation','AI-powered fraud detection','Open data platform','Hired Chief Data Officer','Legacy system modernization RFP','Cybersecurity workforce expansion','Hired 20 cloud security engineers','Interagency data sharing platform'],
  'Technology': ['Kubernetes platform migration','AI/ML infrastructure buildout','Hired VP AI/ML Engineering','Data mesh architecture adoption','Microservices decomposition','New CTO hired from FAANG','Hired 60 platform engineers','Observability platform upgrade','Edge computing deployment','Real-time analytics platform','Hired Head of Platform Engineering','$300M Series E raised','Security posture improvement'],
};

const TITLES_BY_INDUSTRY: Record<string, string[]> = {
  'Banking & Financial Services': ['CIO','CTO','VP Digital Transformation','VP Engineering','Head of Data','Chief Data Officer','CISO','VP Risk Management','Head of Compliance','VP Digital Channels','Director of Core Banking','Head of API Platform'],
  'Insurance': ['CTO','VP Claims Technology','Head of Data Analytics','CISO','VP Digital Transformation','Chief Actuary','VP Underwriting Technology','Head of IT Infrastructure','Director of Data Engineering','VP Customer Experience'],
  'Manufacturing': ['VP Engineering','CTO','Head of Operations','VP Supply Chain','Director of Manufacturing IT','VP Quality','Head of Operational Technology','Director of IoT','VP Plant Operations','Head of Digital Manufacturing','CIO','VP Enterprise Architecture'],
  'Healthcare & Pharma': ['CIO','VP Clinical Informatics','Chief Data Officer','VP Revenue Cycle','Head of Interoperability','CISO','Director of Health Analytics','VP Digital Health','Head of Precision Medicine','VP IT Infrastructure'],
  'Government & Public Sector': ['CTO','Deputy CIO','Program Manager IT','Chief Data Officer','Cybersecurity Director','Director of Cloud Services','Head of Enterprise Architecture','VP of Digital Services','IT Security Manager','Director of Data Analytics'],
  'Technology': ['CTO','VP Engineering','VP Product','Head of AI/ML','CISO','VP Sales Engineering','Director of Platform','Head of DevOps','VP Infrastructure','Chief Architect'],
};

const FIRST_NAMES = ['James','Sarah','Michael','Emily','David','Jennifer','Robert','Amanda','William','Jessica','Richard','Lauren','Thomas','Stephanie','Christopher','Nicole','Daniel','Rachel','Matthew','Megan','Andrew','Elizabeth','Joshua','Samantha','Kevin','Catherine','Brian','Olivia','Steven','Victoria','Marcus','Priya','Chen','Arun','Mei','Raj','Anita','Vikram','Sunita','Wei','Yuki','Hiroshi','Kenji','Akiko','Carlos','Maria','Elena','Ahmed','Fatima','Omar','Leila'];
const LAST_NAMES = ['Anderson','Martinez','Thompson','Nakamura','Patel','Williams','Chen','Kim','Rodriguez','Singh','O\'Brien','Mueller','Svensson','Kowalski','Petrov','Yamamoto','Gupta','Lopez','Johansson','Takahashi','Costa','Park','Zhang','Al-Rashid','Nair','Fernandez','Ivanov','Morales','Sullivan','Huang'];

function genCompany(name: string, industry: string, idx: number) {
  const short = name.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 12);
  const size = idx < 5 ? 'enterprise' : idx < 15 ? 'mid-market' : 'smb';
  return {
    id: makeId(), rawName: name, normalizedName: name, domain: `${short}.com`,
    industry, sizeRange: size, website: `https://${short}.com`, location: pick(['New York, NY','San Francisco, CA','Chicago, IL','Dallas, TX','Boston, MA','Atlanta, GA','Washington, DC','Seattle, WA']),
    internalSummary: `${name} is a ${size} ${industry} company. ${size === 'enterprise' ? 'Fortune 1000 eligible with 5000+ employees and $500M+ revenue.' : size === 'mid-market' ? 'Mid-market company with 500-5000 employees.' : 'Growing SMB with 50-500 employees.'} Active in modernization and digital transformation.`,
    intelligenceScore: idx < 5 ? 5 : idx < 15 ? rand(3, 4) : rand(1, 3),
    status: 'prospect', source: 'enterprise-seed', tags: '[]',
  };
}

function genContact(companyId: string, industry: string, titles: string[], companyDomain: string) {
  const fn = pick(FIRST_NAMES), ln = pick(LAST_NAMES);
  const name = `${fn} ${ln}`, title = pick(titles);
  const statusRoll = Math.random();
  const status = statusRoll < 0.55 ? 'imported' : statusRoll < 0.75 ? 'contacted' : statusRoll < 0.87 ? 'replied' : statusRoll < 0.95 ? 'active' : 'archived';
  return {
    id: makeId(), rawName: name, normalizedName: name,
    email: `${fn.toLowerCase()}.${ln.toLowerCase()}@${companyDomain}`,
    title, role: title.match(/vp/i) ? 'VP' : title.match(/chief|cio|cdo/i) ? 'C-Suite' : title.match(/director|head/i) ? 'Director' : title.match(/manager/i) ? 'Manager' : 'Staff',
    linkedinUrl: null, phone: null, companyId, batchId: 'enterprise-seed',
    leadScore: title.match(/chief|cio/i) ? rand(70, 95) : title.match(/vp|vice/i) ? rand(55, 85) : title.match(/director|head/i) ? rand(40, 70) : rand(20, 55),
    companyFitScore: rand(40, 90), engagementScore: (status === 'replied' || status === 'active') ? rand(30, 60) : rand(0, 30), enrichmentScore: rand(30, 80),
    status, consentStatus: 'opted_in', isSuppressed: false,
  };
}

function genSignal(companyId: string, signals: string[], industry: string) {
  const title = pick(signals);
  let signalType = 'news', severity: 'low' as string, impact: 'medium' as string;
  if (title.match(/migrat|cloud|kubernetes|azure|aws|sap|erp|iot/i)) { signalType = 'tech_change'; impact = 'high'; }
  else if (title.match(/hired|hiring|expanded|team/i)) { signalType = 'hiring'; impact = 'medium'; }
  else if (title.match(/new cto|new cio|new vp|appointed/i)) { signalType = 'leadership_change'; impact = 'high'; }
  else if (title.match(/fund|series|\$|budget/i)) { signalType = 'funding'; impact = 'high'; }
  else if (title.match(/breach|violation|layoff|risk/i)) { signalType = 'risk'; severity = pick(['high', 'critical']); impact = 'high'; }
  const source = signalType === 'funding' ? pick(['Press Release', 'Bloomberg']) : signalType === 'hiring' ? pick(['LinkedIn', 'Job Posting']) : pick(['LinkedIn', 'Press Release', 'TechCrunch', 'Industry Report']);
  return {
    id: makeId(), companyId, title, description: `${title} at a ${industry} company.`,
    signalType, severity, impact,
    businessImpact: signalType === 'tech_change' ? 'Technology change creates vendor evaluation opportunity' : signalType === 'hiring' ? 'Hiring indicates growth phase and budget' : signalType === 'leadership_change' ? 'New leadership may reset vendor relationships within 90 days' : signalType === 'funding' ? 'Funding signals budget availability' : 'Signal indicates potential buying interest',
    recommendedAction: signalType === 'tech_change' ? 'Approach CTO with relevant tech value proposition' : signalType === 'hiring' ? 'Position as scaling solution' : signalType === 'leadership_change' ? 'Engage new executive within 90 days' : 'Monitor and enrich intelligence',
    timingWindow: severity === 'critical' ? 'immediate' : impact === 'high' ? 'this_week' : pick(['this_month', 'this_quarter']),
    source, sourceUrl: null, signalDate: daysAgo(rand(1, 90)), status: 'active', confidence: rand(60, 95) / 100,
  };
}

async function seed(reset = false) {
  console.log('🚀 Starting enterprise seed...');
  if (reset) {
    console.log('🗑️  Clearing...');
    try { await prisma.evidence.deleteMany({}); } catch {}
    try { await prisma.opportunityRecommendation.deleteMany({}); } catch {}
    try { await prisma.companySignal.deleteMany({}); } catch {}
    try { await prisma.contact.deleteMany({}); } catch {}
    try { await prisma.company.deleteMany({}); } catch {}
  }

  // Companies
  const allCompanies: any[] = [];
  for (const [industry, names] of Object.entries(COMPANY_NAMES)) {
    for (let i = 0; i < names.length; i++) allCompanies.push(genCompany(names[i], industry, i));
  }
  console.log(`Creating ${allCompanies.length} companies...`);
  for (const c of allCompanies) { try { await prisma.company.create({ data: c }); } catch(e) {} }

  // Fetch
  const companies = await prisma.company.findMany({ select: { id: true, rawName: true, industry: true, domain: true } });
  console.log(`Created ${companies.length} companies`);

  // Contacts
  console.log('Creating contacts...');
  let contactCount = 0;
  for (const company of companies) {
    const industry = company.industry || 'Technology';
    const titles = TITLES_BY_INDUSTRY[industry] || ['VP Engineering', 'CTO'];
    const count = rand(4, 7);
    for (let i = 0; i < count; i++) {
      try { await prisma.contact.create({ data: genContact(company.id, industry, titles, company.domain || 'company.com') }); contactCount++; } catch {}
    }
  }
  console.log(`Created ${contactCount} contacts`);

  // Signals
  console.log('Creating signals...');
  let signalCount = 0;
  for (const company of companies) {
    const industry = company.industry || 'Technology';
    const signals = SIGNALS_BY_INDUSTRY[industry] || ['New initiative detected'];
    const companyIdx = allCompanies.findIndex(c => c.rawName === company.rawName);
    const count = companyIdx < 5 ? rand(12, 16) : companyIdx < 20 ? rand(8, 12) : rand(4, 8);
    for (let i = 0; i < count; i++) {
      try { await prisma.companySignal.create({ data: genSignal(company.id, signals, industry) }); signalCount++; } catch {}
    }
  }
  console.log(`Created ${signalCount} signals`);

  // Opportunities
  console.log('Creating opportunities...');
  let oppCount = 0;
  const topCompanies = allCompanies.filter((_, i) => i < 35);
  for (const comp of topCompanies) {
    const created = companies.find(c => c.rawName === comp.rawName);
    if (!created) continue;
    try {
      await prisma.opportunityRecommendation.create({
        data: {
          id: makeId(), companyId: created.id,
          opportunityTitle: pick(['Cloud Platform Migration Deal','AI Governance Solution','Data Platform Modernization','Security Operations Center','Digital Transformation Initiative','Revenue Intelligence Platform','Supply Chain Optimization','Customer Analytics Platform']),
          opportunityScore: rand(50, 85), confidenceScore: rand(30, 80) / 100,
          stage: pick(['discovery','qualification','proposal','negotiation']),
          estimatedValue: rand(50, 500) * 1000, probability: rand(20, 70),
          status: 'active', createdAt: daysAgo(rand(1, 60)), updatedAt: new Date(),
        },
      }); oppCount++;
    } catch {}
  }
  console.log(`Created ${oppCount} opportunities`);

  // Evidence
  console.log('Creating evidence...');
  let evCount = 0;
  for (const company of companies.slice(0, 60)) {
    const count = rand(2, 5);
    for (let i = 0; i < count; i++) {
      try {
        await prisma.evidence.create({
          data: {
            id: makeId(), companyId: company.id,
            sourceName: pick(['TechCrunch','Bloomberg','Reuters','LinkedIn','SEC Filing','Industry Report','Company Website','Press Release']),
            sourceTitle: `${company.rawName} ${pick(['announces','launches','expands','modernizes','invests in'])} initiative`,
            sourceUrl: `https://example.com/news/${makeId()}`,
            extractedField: pick(['technology_stack','hiring_trend','revenue_growth','market_expansion','partnership']),
            extractedValue: pick(['Cloud-native adoption','Hiring data engineers','15% YoY growth','New market entry','Strategic partnership']),
            snippet: `Evidence from ${company.rawName}: Active technology modernization program.`,
            confidence: rand(60, 95) / 100, createdAt: daysAgo(rand(1, 60)),
          },
        }); evCount++;
      } catch {}
    }
  }
  console.log(`Created ${evCount} evidence records`);

  // Summary
  const c = await prisma.company.count(), co = await prisma.contact.count(), s = await prisma.companySignal.count(), o = await prisma.opportunityRecommendation.count(), e = await prisma.evidence.count();
  console.log(`\n✅ Enterprise dataset seeded!`);
  console.log(`   Companies: ${c} | Contacts: ${co} | Signals: ${s} | Opportunities: ${o} | Evidence: ${e}`);

  // Top 5 hottest
  const hot = await prisma.companySignal.groupBy({ by: ['companyId'], _count: { id: true }, orderBy: { _count: { id: 'desc' } }, take: 5 });
  console.log('\n🔥 Top 5 Hottest:');
  for (const h of hot) {
    const comp = companies.find(c => c.id === h.companyId);
    console.log(`   ${comp?.rawName || h.companyId} — ${h._count.id} signals`);
  }
}

seed(process.argv.includes('--reset')).catch(e => { console.error('❌', e); process.exit(1); }).finally(() => prisma.$disconnect());
