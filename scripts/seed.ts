import { db } from '../src/lib/db';

async function seed() {
  console.log('Seeding database...');

  const companies = [
    { id: 'comp-1', name: 'ABC Manufacturing', domain: 'abc.com', industry: 'Manufacturing', country: 'USA', employeeSize: '5001-10000', location: 'Detroit, MI', website: 'https://abc.com', linkedinUrl: 'https://linkedin.com/company/abc-mfg', status: 'researching', intelligenceScore: 85, dataFreshness: 'fresh' },
    { id: 'comp-2', name: 'TechVision Solutions', domain: 'techvision.io', industry: 'Technology', country: 'India', employeeSize: '201-500', location: 'Bangalore, India', website: 'https://techvision.io', linkedinUrl: 'https://linkedin.com/company/techvision', status: 'ready', intelligenceScore: 72, dataFreshness: 'fresh' },
    { id: 'comp-3', name: 'Global Finance Corp', domain: 'gfc.com', industry: 'Finance', country: 'UK', employeeSize: '10000+', location: 'London, UK', website: 'https://gfc.com', status: 'new', intelligenceScore: 68, dataFreshness: 'stale' },
    { id: 'comp-4', name: 'HealthPlus Networks', domain: 'healthplus.com', industry: 'Healthcare', country: 'USA', employeeSize: '501-1000', location: 'Boston, MA', website: 'https://healthplus.com', linkedinUrl: 'https://linkedin.com/company/healthplus', status: 'contacted', intelligenceScore: 91, dataFreshness: 'fresh' },
    { id: 'comp-5', name: 'EduLearn Platform', domain: 'edulearn.com', industry: 'Education', country: 'Singapore', employeeSize: '51-200', location: 'Singapore', website: 'https://edulearn.com', status: 'researching', intelligenceScore: 55, dataFreshness: 'old' },
    { id: 'comp-6', name: 'RetailMax Group', domain: 'retailmax.com', industry: 'Retail', country: 'UAE', employeeSize: '1000+', location: 'Dubai, UAE', website: 'https://retailmax.com', linkedinUrl: 'https://linkedin.com/company/retailmax', status: 'new', intelligenceScore: 78, dataFreshness: 'fresh' },
    { id: 'comp-7', name: 'GreenEnergy Systems', domain: 'greenenergy.com', industry: 'Energy', country: 'Germany', employeeSize: '201-500', location: 'Berlin, Germany', website: 'https://greenenergy.com', status: 'ready', intelligenceScore: 82, dataFreshness: 'fresh' },
    { id: 'comp-8', name: 'LogiTrans Global', domain: 'logitrans.com', industry: 'Logistics', country: 'Netherlands', employeeSize: '501-1000', location: 'Amsterdam, NL', website: 'https://logitrans.com', linkedinUrl: 'https://linkedin.com/company/logitrans', status: 'researching', intelligenceScore: 63, dataFreshness: 'stale' },
  ];

  for (const c of companies) {
    await db.company.upsert({ where: { id: c.id }, update: c, create: c });
  }
  console.log(`Created ${companies.length} companies`);

  const contacts = [
    { id: 'cont-1', companyId: 'comp-1', name: 'John Smith', email: 'john.smith@abc.com', jobTitle: 'CIO', roleBucket: 'executive', linkedinUrl: 'https://linkedin.com/in/johnsmith', phone: '+1-313-555-0101', location: 'Detroit, MI', status: 'ready', emailHealth: 'valid', emailHealthScore: 95 },
    { id: 'cont-2', companyId: 'comp-1', name: 'Mary Wilson', email: 'mary.wilson@abc.com', jobTitle: 'VP Technology', roleBucket: 'executive', linkedinUrl: 'https://linkedin.com/in/marywilson', phone: '+1-313-555-0102', location: 'Detroit, MI', status: 'ready', emailHealth: 'valid', emailHealthScore: 92 },
    { id: 'cont-3', companyId: 'comp-1', name: 'Raj Kumar', email: 'raj.kumar@abc.com', jobTitle: 'CTO', roleBucket: 'executive', linkedinUrl: '', status: 'drafted', emailHealth: 'valid', emailHealthScore: 88 },
    { id: 'cont-4', companyId: 'comp-2', name: 'Priya Sharma', email: 'priya@techvision.io', jobTitle: 'CEO', roleBucket: 'executive', linkedinUrl: 'https://linkedin.com/in/priyasharma', location: 'Bangalore', status: 'contacted', emailHealth: 'valid', emailHealthScore: 97 },
    { id: 'cont-5', companyId: 'comp-2', name: 'Amit Patel', email: 'invalid-email-techvision', jobTitle: 'Head of Engineering', roleBucket: 'manager', emailHealth: 'invalid', emailHealthScore: 5, status: 'new' },
    { id: 'cont-6', companyId: 'comp-3', name: 'James Thompson', email: 'j.thompson@gfc.com', jobTitle: 'CFO', roleBucket: 'executive', location: 'London', status: 'new', emailHealth: 'risky', emailHealthScore: 62 },
    { id: 'cont-7', companyId: 'comp-4', name: 'Sarah Chen', email: 'sarah.chen@healthplus.com', jobTitle: 'VP of Operations', roleBucket: 'executive', linkedinUrl: 'https://linkedin.com/in/sarahchen', phone: '+1-617-555-0201', location: 'Boston, MA', status: 'replied', emailHealth: 'valid', emailHealthScore: 96 },
    { id: 'cont-8', companyId: 'comp-4', name: 'Dr. Michael Lee', email: 'mlee@healthplus.com', jobTitle: 'Chief Medical Officer', roleBucket: 'executive', location: 'Boston, MA', status: 'ready', emailHealth: 'valid', emailHealthScore: 94 },
    { id: 'cont-9', companyId: 'comp-5', name: 'David Tan', email: 'david.tan@edulearn.com', jobTitle: 'Director of Technology', roleBucket: 'manager', location: 'Singapore', status: 'researching', emailHealth: 'valid', emailHealthScore: 85 },
    { id: 'cont-10', companyId: 'comp-6', name: 'Fatima Al-Rashid', email: 'fatima@retailmax.com', jobTitle: 'CTO', roleBucket: 'executive', linkedinUrl: 'https://linkedin.com/in/fatima-alrashid', location: 'Dubai', status: 'new', emailHealth: 'valid', emailHealthScore: 90 },
    { id: 'cont-11', companyId: 'comp-7', name: 'Hans Mueller', email: 'hans@greenenergy.com', jobTitle: 'Head of IT', roleBucket: 'manager', location: 'Berlin', status: 'ready', emailHealth: 'valid', emailHealthScore: 88 },
    { id: 'cont-12', companyId: 'comp-7', name: 'Anna Schmidt', email: 'anna.s@greenenergy.com', jobTitle: 'Sustainability Director', roleBucket: 'manager', location: 'Berlin', status: 'new', emailHealth: 'risky', emailHealthScore: 58 },
    { id: 'cont-13', companyId: 'comp-8', name: 'Jan de Vries', email: 'jan@logitrans.com', jobTitle: 'CEO', roleBucket: 'executive', linkedinUrl: 'https://linkedin.com/in/jandevries', location: 'Amsterdam', status: 'researching', emailHealth: 'valid', emailHealthScore: 93 },
    { id: 'cont-14', companyId: 'comp-1', name: 'Lisa Park', email: 'lisa.park@abc.com', jobTitle: 'IT Manager', roleBucket: 'manager', phone: '+1-313-555-0103', location: 'Detroit, MI', status: 'archived', archivedAt: new Date('2026-06-01'), emailHealth: 'invalid', emailHealthScore: 0 },
    { id: 'cont-15', companyId: 'comp-3', name: 'Emily Watson', email: 'e.watson@gfc.com', jobTitle: 'Technology Director', roleBucket: 'manager', location: 'London', status: 'new', emailHealth: 'valid', emailHealthScore: 91 },
  ];

  for (const c of contacts) {
    await db.contact.upsert({ where: { id: c.id }, update: c, create: c });
  }
  console.log(`Created ${contacts.length} contacts`);

  await db.companyNote.createMany({ data: [
    { companyId: 'comp-1', body: 'ABC Manufacturing is expanding their digital initiatives. They recently announced a $50M investment in automation technologies. Key decision maker is John Smith (CIO) who is driving the digital transformation agenda.', noteType: 'research' },
    { companyId: 'comp-1', body: 'Had a brief conversation with Mary Wilson at the manufacturing tech summit. She mentioned they are evaluating AI solutions for supply chain optimization. Very interested in proof of concepts.', noteType: 'call_note' },
    { companyId: 'comp-4', body: 'Sarah Chen responded positively to our initial outreach about healthcare workflow automation. She wants to schedule a discovery call next week.', noteType: 'follow_up' },
    { companyId: 'comp-2', body: 'TechVision is a growing mid-market IT services company in Bangalore. They might be a potential partner rather than a client. Need to evaluate.', noteType: 'research' },
  ]});
  console.log('Created 4 company notes');

  await db.companyResearchCard.upsert({
    where: { companyId: 'comp-1' },
    update: {},
    create: { companyId: 'comp-1', businessOverview: 'Global manufacturing company with $2B+ annual revenue. Major operations in automotive and industrial equipment manufacturing. Currently undergoing significant digital transformation.', currentTechLandscape: 'Legacy ERP systems (SAP), limited cloud adoption, manual shop floor processes. Recently started Microsoft Azure migration.', potentialChallenges: 'Integration complexity between legacy and new systems. Skills gap in data analytics and AI.', possibleOpportunities: 'AI-powered quality inspection, predictive maintenance, supply chain optimization, automated reporting dashboards.', relevantServices: 'AI Process Automation, Cloud Modernization, Data Analytics', keyDecisionMakers: 'John Smith (CIO), Mary Wilson (VP Tech), Raj Kumar (CTO)', lastInteraction: 'Met Mary Wilson at Manufacturing Tech Summit, July 2026', nextAction: 'Send AI automation introduction email to John Smith', confidenceScore: 85 },
  });
  await db.companyResearchCard.upsert({
    where: { companyId: 'comp-4' },
    update: {},
    create: { companyId: 'comp-4', businessOverview: 'Regional healthcare network with 12 hospitals and 200+ clinics. Focus on patient care quality and operational efficiency.', currentTechLandscape: 'Epic EHR system, limited AI/ML capabilities, data silos across facilities.', potentialChallenges: 'HIPAA compliance requirements, data security concerns, physician adoption of new technology.', possibleOpportunities: 'AI-powered document processing for insurance claims, patient flow optimization, automated scheduling systems.', relevantServices: 'AI Process Automation, Document Intelligence', keyDecisionMakers: 'Sarah Chen (VP Ops), Dr. Michael Lee (CMO)', lastInteraction: 'Email sent, Sarah replied with interest', nextAction: 'Schedule discovery call for healthcare automation', confidenceScore: 78 },
  });
  console.log('Created 2 research cards');

  await db.opportunity.createMany({ data: [
    { companyId: 'comp-1', title: 'AI Process Automation', description: 'ABC Manufacturing is investing $50M in digital transformation. AI automation for quality inspection and supply chain could be a strong entry point.', targetContactId: 'cont-1', status: 'qualified', nextAction: 'Send tailored AI automation email to CIO John Smith' },
    { companyId: 'comp-1', title: 'Cloud Migration Support', description: 'They recently started Azure migration. Could offer cloud modernization and application modernization services.', targetContactId: 'cont-3', status: 'researching', nextAction: 'Research their current Azure migration status' },
    { companyId: 'comp-4', title: 'Healthcare Document AI', description: 'Insurance claims processing automation could save significant time for their back-office operations.', targetContactId: 'cont-7', status: 'proposal', nextAction: 'Prepare proposal document for document AI solution' },
    { companyId: 'comp-7', title: 'Sustainability Analytics Platform', description: 'GreenEnergy needs better data analytics for their sustainability reporting and carbon tracking.', targetContactId: 'cont-11', status: 'researching', nextAction: 'Prepare capability deck on data analytics for energy sector' },
  ]});
  console.log('Created 4 opportunities');

  const now = Date.now();
  await db.timelineEntry.createMany({ data: [
    { companyId: 'comp-1', action: 'Company Created', details: 'Imported from Manufacturing_Leads_Q2.csv', createdAt: new Date(now - 6*24*60*60*1000) },
    { companyId: 'comp-1', action: 'Research Updated', details: 'Added business overview and technology landscape research', createdAt: new Date(now - 5*24*60*60*1000) },
    { companyId: 'comp-1', action: 'Note Added', details: 'Call note from Manufacturing Tech Summit', createdAt: new Date(now - 3*24*60*60*1000) },
    { companyId: 'comp-1', action: 'Opportunity Created', details: 'AI Process Automation opportunity identified', createdAt: new Date(now - 2*24*60*60*1000) },
    { companyId: 'comp-4', action: 'Company Created', details: 'Imported from Healthcare_Leads.csv', createdAt: new Date(now - 5*24*60*60*1000) },
    { companyId: 'comp-4', action: 'Email Sent', details: 'Initial outreach to Sarah Chen', createdAt: new Date(now - 2*24*60*60*1000) },
    { companyId: 'comp-4', action: 'Reply Received', details: 'Sarah Chen replied positively', createdAt: new Date(now - 1*24*60*60*1000) },
    { companyId: 'comp-2', action: 'Company Created', details: 'Imported from India_IT_Companies.csv', createdAt: new Date(now - 4*24*60*60*1000) },
    { companyId: 'comp-7', action: 'Company Created', details: 'Imported from Energy_Sector_Leads.csv', createdAt: new Date(now - 3*24*60*60*1000) },
    { companyId: 'comp-3', action: 'Company Created', details: 'Imported from Finance_Sector_Q3.csv', createdAt: new Date(now - 7*24*60*60*1000) },
  ]});
  console.log('Created 10 timeline entries');

  await db.emailHealthCheck.createMany({ data: [
    { contactId: 'cont-1', status: 'valid', score: 95, actionRecommendation: 'allow', syntaxOk: true, domainOk: true, mxOk: true, disposableOk: true },
    { contactId: 'cont-5', status: 'invalid', score: 5, actionRecommendation: 'block', syntaxOk: false, domainOk: false, mxOk: false, disposableOk: false },
    { contactId: 'cont-6', status: 'risky', score: 62, actionRecommendation: 'review', syntaxOk: true, domainOk: true, mxOk: false, disposableOk: true },
    { contactId: 'cont-14', status: 'invalid', score: 0, actionRecommendation: 'block', syntaxOk: false, domainOk: false, mxOk: false, disposableOk: false },
  ]});
  console.log('Created 4 health checks');

  await db.importBatch.createMany({ data: [
    { fileName: 'Manufacturing_Leads_Q2.csv', fileHash: 'sha256-abc123', totalRows: 12500, acceptedRows: 11800, duplicateRows: 520, invalidRows: 180, status: 'completed' },
    { fileName: 'Healthcare_Leads.csv', fileHash: 'sha256-def456', totalRows: 3400, acceptedRows: 3200, duplicateRows: 150, invalidRows: 50, status: 'completed' },
    { fileName: 'India_IT_Companies.csv', fileHash: 'sha256-ghi789', totalRows: 890, acceptedRows: 850, duplicateRows: 30, invalidRows: 10, status: 'completed' },
  ]});
  console.log('Created 3 import batches');

  await db.capabilityDocument.createMany({ data: [
    { id: 'cap-1', title: 'AI Process Automation', docType: 'service', description: 'End-to-end AI-powered process automation services', content: 'Our AI Process Automation services help enterprises eliminate manual workflows, reduce processing time by 60-80%, and improve accuracy across document processing, data extraction, and decision workflows.' },
    { id: 'cap-2', title: 'Cloud Modernization', docType: 'service', description: 'Comprehensive cloud migration and modernization services', content: 'We help organizations migrate legacy applications to modern cloud architectures. We specialize in AWS, Azure, and GCP platforms.' },
    { id: 'cap-3', title: 'Data Analytics & BI', docType: 'service', description: 'Advanced analytics and business intelligence solutions', content: 'Transform raw data into actionable business intelligence with modern data platforms and real-time analytics dashboards.' },
  ]});
  console.log('Created 3 capability documents');

  await db.capabilitySnippet.createMany({ data: [
    { documentId: 'cap-1', snippetType: 'capability', title: 'Document Intelligence', content: 'AI-powered extraction and processing of invoices, purchase orders, contracts, and compliance documents. Reduces manual data entry by 80%.', industries: 'Manufacturing, Finance, Healthcare', outcomes: '80% reduction in manual processing, 99.5% accuracy' },
    { documentId: 'cap-1', snippetType: 'case_study', title: 'Manufacturing QC Automation', content: 'Implemented AI-powered quality inspection for a Fortune 500 manufacturer. Reduced defect detection time from 45 minutes to 3 minutes per unit.', industries: 'Manufacturing', outcomes: '15x faster inspection, $2.5M annual savings' },
    { documentId: 'cap-2', snippetType: 'capability', title: 'Application Migration', content: 'Systematic migration of legacy applications to cloud-native architectures with zero-downtime strategies.', industries: 'Technology, Finance, Healthcare', outcomes: 'Zero downtime migration, 40% cost reduction' },
    { documentId: 'cap-3', snippetType: 'capability', title: 'Executive Dashboards', content: 'Real-time executive dashboards consolidating data from multiple sources into actionable insights.', industries: 'All Industries', outcomes: '70% reduction in report generation time' },
  ]});
  console.log('Created 4 capability snippets');

  await db.userPreferences.upsert({ where: { id: 'pref-1' }, update: {}, create: { id: 'pref-1' } });
  console.log('Created user preferences');

  console.log('\nDatabase seeded successfully!');
}

seed().catch(console.error).finally(() => process.exit(0));