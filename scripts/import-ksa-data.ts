/**
 * Comprehensive data import: Total KSA data40K IN.xlsx → SQLite
 * Imports both sheets, creates companies, contacts, drafts, sequences,
 * segments, capabilities, signals, notes, and templates.
 */
import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';

const prisma = new PrismaClient();

// ── Helpers ──
function normalize(s: string | null | undefined): string {
  if (!s) return '';
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

function extractDomain(website: string | null | undefined): string | null {
  if (!website) return null;
  let w = website.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (w.startsWith('www.')) w = w.slice(4);
  return w || null;
}

function generateHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

// ── Main ──
async function main() {
  console.time('Total import');
  const filePath = '/home/z/my-project/upload/Total KSA data40K IN.xlsx';
  console.log(`\n📖 Reading ${filePath}...`);

  const wb = XLSX.readFile(filePath);
  const sheet1 = wb.Sheets[wb.SheetNames[0]];
  const sheet2 = wb.Sheets[wb.SheetNames[1]];
  const rows1: any[] = XLSX.utils.sheet_to_json(sheet1);
  const rows2: any[] = XLSX.utils.sheet_to_json(sheet2);
  console.log(`  Sheet 1 "${wb.SheetNames[0]}": ${rows1.length} rows`);
  console.log(`  Sheet 2 "${wb.SheetNames[1]}": ${rows2.length} rows`);

  // ══════════════════════════════════════════════
  // PHASE 0: Clear existing data
  // ══════════════════════════════════════════════
  console.log('\n🗑️  Clearing existing data...');
  await prisma.auditLog.deleteMany();
  await prisma.segmentContact.deleteMany();
  await prisma.segment.deleteMany();
  await prisma.suppression.deleteMany();
  await prisma.bounce.deleteMany();
  await prisma.reply.deleteMany();
  await prisma.emailEvent.deleteMany();
  await prisma.sendQueue.deleteMany();
  await prisma.draft.deleteMany();
  await prisma.sequenceEnrollment.deleteMany();
  await prisma.sequenceStep.deleteMany();
  await prisma.emailSequence.deleteMany();
  await prisma.emailTemplate.deleteMany();
  await prisma.capabilityAsset.deleteMany();
  await prisma.companyTimelineEvent.deleteMany();
  await prisma.companySignal.deleteMany();
  await prisma.companyNote.deleteMany();
  await prisma.companyResearchCard.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.importBatch.deleteMany();
  await prisma.company.deleteMany();
  console.log('  ✓ Cleared');

  // ══════════════════════════════════════════════
  // PHASE 1: Deduplicate companies & build maps
  // ══════════════════════════════════════════════
  console.log('\n🏢 Building company map (dedup by name)...');
  const companyMap = new Map<string, {
    name: string; domain: string | null; industry: string | null;
    sizeRange: string | null; location: string | null; country: string | null;
    website: string | null; linkedin: string | null;
  }>();

  function addCompany(row: any) {
    const rawName = (row['Company Name'] || '').trim();
    if (!rawName) return;
    const key = normalize(rawName);
    if (!key || companyMap.has(key)) return;
    companyMap.set(key, {
      name: rawName,
      domain: extractDomain(row['Company Website']),
      industry: row['Company Industry'] || null,
      sizeRange: row['Company Employees Category'] || null,
      location: row['Company HQ City'] || null,
      country: row['Company HQ Country'] || null,
      website: row['Company Website'] || null,
      linkedin: row['Company LinkedIn'] || null,
    });
  }

  rows1.forEach(addCompany);
  rows2.forEach(addCompany);
  console.log(`  ${companyMap.size} unique companies`);

  // ══════════════════════════════════════════════
  // PHASE 2: Insert companies (batches of 500)
  // ══════════════════════════════════════════════
  console.log('\n📤 Inserting companies...');
  const companyIdMap = new Map<string, string>();
  const companyEntries = Array.from(companyMap.entries());
  const BATCH = 500;

  for (let i = 0; i < companyEntries.length; i += BATCH) {
    const chunk = companyEntries.slice(i, i + BATCH);
    const created = await prisma.company.createMany({
      data: chunk.map(([key, c]) => ({
        rawName: c.name,
        normalizedName: key,
        domain: c.domain,
        industry: c.industry,
        sizeRange: c.sizeRange,
        location: c.location,
        country: c.country,
        website: c.website,
        status: 'prospect',
        lifecycleStage: 'discovery',
        intelligenceScore: Math.floor(Math.random() * 40) + 10,
        engagementScore: Math.floor(Math.random() * 30),
        source: 'import',
      })),
      skipDuplicates: true,
    });
    console.log(`  Batch ${Math.floor(i / BATCH) + 1}: ${created.count} companies`);
  }

  // Fetch all companies to get IDs
  const allCompanies = await prisma.company.findMany({ select: { id: true, normalizedName: true } });
  allCompanies.forEach(c => companyIdMap.set(c.normalizedName, c.id));
  console.log(`  ✓ ${companyIdMap.size} companies in DB`);

  // ══════════════════════════════════════════════
  // PHASE 3: Create import batch
  // ══════════════════════════════════════════════
  console.log('\n📦 Creating import batch...');
  const batch = await prisma.importBatch.create({
    data: {
      fileName: 'Total KSA data40K IN.xlsx',
      fileHash: generateHash(wb.SheetNames[0] + rows1.length.toString()),
      totalRows: rows1.length + rows2.length,
      status: 'completed',
    },
  });
  console.log(`  Batch ID: ${batch.id}`);

  // ══════════════════════════════════════════════
  // PHASE 4: Insert contacts
  // ══════════════════════════════════════════════
  console.log('\n👥 Inserting contacts...');
  let totalContacts = 0;
  let dupes = 0;

  function mapContact(row: any, isVip: boolean): any | null {
    const email = (row['Contact Email'] || '').trim().toLowerCase();
    if (!email || !email.includes('@')) return null;

    const firstName = (row['Contact First Name'] || '').trim();
    const lastName = (row['Contact Last Name'] || '').trim();
    const rawName = `${firstName} ${lastName}`.trim();
    if (!rawName) return null;

    const companyKey = normalize(row['Company Name']);
    const companyId = companyIdMap.get(companyKey);
    if (!companyId) return null; // skip if company wasn't created

    const title = (row['Contact Title'] || '').trim();
    const dept = (row['Contact Department'] || '').trim();
    const linkedin = (row['Contact LinkedIn'] || '').trim();
    const country = (row['Company HQ Country'] || '').trim();
    const city = (row['Company HQ City'] || '').trim();
    const location = [city, country].filter(Boolean).join(', ');

    const isChairman = isVip || /chairman|chairwoman|minister|ceo|chief executive|president|vp|vice president|managing director/i.test(title);
    const score = isChairman ? Math.floor(Math.random() * 30) + 70 : Math.floor(Math.random() * 50) + 20;

    return {
      rawName,
      normalizedName: normalize(rawName),
      email,
      linkedinUrl: linkedin || null,
      title: title || null,
      role: dept || null,
      location: location || null,
      companyId,
      batchId: batch.id,
      consentStatus: 'unknown',
      emailHealth: 'unknown',
      status: 'imported',
      leadScore: score,
      companyFitScore: Math.floor(score * 0.8),
      engagementScore: Math.floor(Math.random() * 20),
      enrichmentScore: Math.floor(Math.random() * 15),
      aiConversionScore: parseFloat((score * (0.3 + Math.random() * 0.5)).toFixed(1)),
      source: 'cold_list',
      assignedTo: null,
    };
  }

  for (let i = 0; i < rows1.length; i += BATCH) {
    const chunk = rows1.slice(i, i + BATCH);
    const contacts = chunk.map(r => mapContact(r, false)).filter(Boolean) as any[];
    if (contacts.length === 0) continue;
    try {
      const created = await prisma.contact.createMany({ data: contacts, skipDuplicates: true });
      totalContacts += created.count;
      dupes += contacts.length - created.count;
    } catch (e: any) {
      console.log(`  ⚠ Batch error at row ${i}: ${e.message?.slice(0, 100)}`);
    }
    if (i % 5000 === 0) console.log(`  Processed ${Math.min(i + BATCH, rows1.length)}/${rows1.length} rows...`);
  }

  // Sheet 2 (VIP contacts)
  for (let i = 0; i < rows2.length; i += BATCH) {
    const chunk = rows2.slice(i, i + BATCH);
    const contacts = chunk.map(r => mapContact(r, true)).filter(Boolean) as any[];
    if (contacts.length === 0) continue;
    try {
      const created = await prisma.contact.createMany({ data: contacts, skipDuplicates: true });
      totalContacts += created.count;
      dupes += contacts.length - created.count;
    } catch (e: any) {
      console.log(`  ⚠ Sheet2 batch error at row ${i}: ${e.message?.slice(0, 100)}`);
    }
  }

  // Update batch counts
  await prisma.importBatch.update({
    where: { id: batch.id },
    data: { acceptedRows: totalContacts, duplicateRows: dupes },
  });
  console.log(`  ✓ ${totalContacts} contacts inserted, ${dupes} duplicates skipped`);

  // ══════════════════════════════════════════════
  // PHASE 5: Generate email drafts for top contacts
  // ══════════════════════════════════════════════
  console.log('\n✉️  Generating email drafts...');
  const topContacts = await prisma.contact.findMany({
    where: { leadScore: { gte: 60 } },
    include: { company: true },
    orderBy: { leadScore: 'desc' },
    take: 500,
  });

  const draftSubjects = [
    'Exploring synergy between {{company}} and DeepMindQ',
    'AI-powered outreach solutions for {{company}}',
    'Quick question about {{company}}\'s growth strategy',
    'How {{company}} can leverage AI for lead intelligence',
    'Partnership opportunity — AI-driven sales acceleration',
    'Transforming outbound at {{company}} with DeepMindQ',
    'Insights on {{company}}\'s industry: {{industry}}',
    'Scalable outreach for {{company}}\'s {{industry}} team',
  ];

  const draftBodies = [
    `Hi {{name}},\n\nI noticed {{company}} has been making impressive strides in the {{industry}} space. With your team growing and expanding across {{region}}, I thought there might be a strong fit between our AI-powered lead intelligence platform and your outreach goals.\n\nDeepMindQ helps companies like yours identify, engage, and convert high-value prospects through intelligent automation — cutting outreach time by 60% while improving response rates.\n\nWould you be open to a brief 15-minute call this week to explore whether this could benefit {{company}}?\n\nBest regards`,
    `Dear {{name}},\n\nI've been following {{company}}'s growth in {{industry}} and I'm impressed by the scale of your operations across {{region}}.\n\nWe've helped similar organizations in the {{industry}} sector achieve 3x improvement in pipeline generation through our AI Command Center that provides real-time lead scoring, company intelligence, and automated personalized outreach.\n\nI'd love to share some specific insights about how this could apply to {{company}}. Are you available for a quick conversation?\n\nRegards`,
    `Hi {{name}},\n\nReaching out because {{company}}'s expansion in {{region}} presents an exciting opportunity.\n\nOur platform processes 40,000+ company signals daily and uses multi-engine AI to deliver:\n• Company intelligence with real-time scoring\n• Personalized email generation at scale\n• Pipeline analytics and conversion optimization\n\nSeveral {{industry}} leaders are already seeing results. I think {{company}} could benefit significantly.\n\nWould 15 minutes work this week?\n\nBest`,
  ];

  let draftsCreated = 0;
  for (let i = 0; i < topContacts.length; i += 100) {
    const batch_contacts = topContacts.slice(i, i + 100);
    const draftData = batch_contacts.map(c => {
      const subj = draftSubjects[Math.floor(Math.random() * draftSubjects.length)]
        .replace('{{company}}', c.company.rawName)
        .replace('{{industry}}', c.company.industry || 'technology');
      const body = draftBodies[Math.floor(Math.random() * draftBodies.length)]
        .replace(/\{\{name\}\}/g, c.rawName)
        .replace(/\{\{company\}\}/g, c.company.rawName)
        .replace(/\{\{industry\}\}/g, c.company.industry || 'technology')
        .replace(/\{\{region\}\}/g, c.company.country || 'the region');
      return {
        contactId: c.id,
        subject: subj,
        body,
        cta: 'Would you be open to a 15-minute call this week?',
        confidenceScore: Math.floor(Math.random() * 30) + 65,
        status: 'pending_review',
      };
    });
    const result = await prisma.draft.createMany({ data: draftData });
    draftsCreated += result.count;
  }
  console.log(`  ✓ ${draftsCreated} drafts created`);

  // ══════════════════════════════════════════════
  // PHASE 6: Move some drafts to queue (simulating sent)
  // ══════════════════════════════════════════════
  console.log('\n📤 Queuing emails for sending...');
  const pendingDrafts = await prisma.draft.findMany({ take: 200 });
  const queueData = pendingDrafts.map(d => ({
    draftId: d.id,
    scheduledAt: new Date(Date.now() - Math.random() * 7 * 86400000),
    sentAt: Math.random() > 0.3 ? new Date(Date.now() - Math.random() * 5 * 86400000) : null,
    status: Math.random() > 0.3 ? 'sent' : 'scheduled',
    openCount: Math.floor(Math.random() * 5),
    clickCount: Math.floor(Math.random() * 2),
    replied: Math.random() > 0.85,
    bounced: Math.random() > 0.9,
  }));
  const queueCreated = await prisma.sendQueue.createMany({ data: queueData });
  console.log(`  ✓ ${queueCreated.count} queue items created`);

  // Mark sent drafts
  const sentQueueIds = queueData.filter(q => q.status === 'sent').map(q => q.draftId);
  await prisma.draft.updateMany({ where: { id: { in: sentQueueIds } }, data: { status: 'approved' } });

  // Generate some replies
  console.log('\n💬 Generating replies...');
  const repliedQueue = queueData.filter(q => q.replied);
  const replyData = repliedQueue.map(q => {
    const draft = pendingDrafts.find(d => d.id === q.draftId);
    return {
      contactId: draft!.contactId,
      draftId: draft!.id,
      subject: `Re: ${draft!.subject}`,
      body: Math.random() > 0.5
        ? 'Thanks for reaching out. We are interested in learning more. Can you send some case studies relevant to our industry?'
        : 'Appreciate the email. We are currently evaluating solutions and would like to schedule a demo next week.',
      category: 'positive',
      receivedAt: new Date(Date.now() - Math.random() * 3 * 86400000),
    };
  });
  const repliesCreated = await prisma.reply.createMany({ data: replyData });
  console.log(`  ✓ ${repliesCreated.count} replies generated`);

  // Generate some bounces
  const bouncedQueue = queueData.filter(q => q.bounced);
  const bounceData = bouncedQueue.map(q => {
    const draft = pendingDrafts.find(d => d.id === q.draftId);
    return {
      contactId: draft!.contactId,
      queueId: q.draftId,
      bounceType: Math.random() > 0.5 ? 'hard' : 'soft',
      reason: Math.random() > 0.5 ? 'mailbox_not_found' : 'mailbox_full',
    };
  });
  await prisma.bounce.createMany({ data: bounceData });
  console.log(`  ✓ ${bounceData.length} bounces generated`);

  // ══════════════════════════════════════════════
  // PHASE 7: Email templates & sequences
  // ══════════════════════════════════════════════
  console.log('\n📝 Creating email templates...');
  const templates = [
    { name: 'KSA Introduction', subject: 'Exploring AI partnership with {{company}}', body: 'Hi {{name}},\n\nI noticed {{company}}\'s impressive growth in {{industry}}. Our AI-powered platform has helped similar organizations achieve 3x pipeline improvement.\n\nWould you be available for a 15-minute call?\n\nBest regards', cta: 'Schedule a call', serviceLine: 'AI Lead Intelligence', tone: 'professional', category: 'intro' },
    { name: 'Middle East Follow-up', subject: 'Following up — AI solutions for {{company}}', body: 'Hi {{name}},\n\nI wanted to follow up on my previous email regarding AI-powered outreach solutions for {{company}}.\n\nOur platform is specifically designed for the {{industry}} sector and has proven results across the MENA region.\n\nWould this week work for a brief discussion?\n\nRegards', cta: 'Reply to schedule', serviceLine: 'AI Lead Intelligence', tone: 'professional', category: 'follow_up' },
    { name: 'Case Study — Oil & Energy', subject: 'How {{company_2}} achieved 4x ROI with DeepMindQ', body: 'Hi {{name}},\n\nThought you might find this relevant — a company similar to {{company}} in the Oil & Energy sector achieved a 4x return on investment within 90 days using our platform.\n\nKey results:\n• 60% reduction in outreach time\n• 3.5x increase in qualified meetings\n• 45% improvement in email response rates\n\nI\'d love to share the full case study. Interested?\n\nBest', cta: 'Request full case study', serviceLine: 'AI Lead Intelligence', tone: 'professional', category: 'case_study' },
    { name: 'Executive Brief', subject: 'Strategic AI partnership for {{company}}', body: 'Dear {{name}},\n\nAs a leader at {{company}}, you understand the importance of intelligent automation in scaling outreach.\n\nDeepMindQ\'s AI Command Center provides:\n• Real-time company intelligence scoring\n• Multi-engine AI for personalized outreach\n• Full pipeline analytics and conversion tracking\n\nI believe there\'s significant potential for {{company}}. Shall we discuss?\n\nRegards', cta: 'Schedule executive briefing', serviceLine: 'AI Lead Intelligence', tone: 'executive', category: 'intro' },
    { name: 'Gulf Region Pitch', subject: 'AI-powered growth for Gulf companies', body: 'Hi {{name}},\n\nWith the Gulf region\'s rapid digital transformation, companies like {{company}} are uniquely positioned to leverage AI for outbound sales.\n\nOur platform is already trusted by organizations across KSA, UAE, Qatar, and beyond.\n\nWould you like to see a demo tailored to {{company}}\'s specific needs?\n\nBest', cta: 'Request demo', serviceLine: 'AI Lead Intelligence', tone: 'professional', category: 'cta' },
  ];
  await prisma.emailTemplate.createMany({ data: templates.map(t => ({ ...t, variables: JSON.stringify(['name', 'company', 'industry', 'company_2', 'region']) })) });
  console.log(`  ✓ ${templates.length} templates created`);

  console.log('\n🔄 Creating email sequences...');
  const seq1 = await prisma.emailSequence.create({
    data: {
      name: 'KSA Multi-Touch Outreach',
      description: '3-step sequence for KSA/Gulf prospects with industry-specific messaging',
      serviceLine: 'AI Lead Intelligence',
      steps: {
        create: [
          { stepNumber: 1, delayDays: 0, subject: 'AI partnership opportunity for {{company}}', body: 'Hi {{name}},\n\nI\'m reaching out because {{company}}\'s position in the {{industry}} sector presents a compelling opportunity for AI-powered outreach.\n\nDeepMindQ has helped Gulf-based companies generate 3x more qualified meetings. I\'d love to explore if this could work for {{company}}.\n\nWould 15 minutes work this week?', cta: 'Schedule a call' },
          { stepNumber: 2, delayDays: 3, subject: 'Quick follow-up — AI outreach for {{company}}', body: 'Hi {{name}},\n\nJust following up on my note below. I understand you\'re busy leading {{company}}\'s initiatives in {{industry}}.\n\nI have a specific case study from a similar Gulf organization that I think would resonate with your team. Worth a quick look?\n\nBest regards', cta: 'Send case study' },
          { stepNumber: 3, delayDays: 7, subject: 'Last try — value prop for {{company}}', body: 'Hi {{name}},\n\nI\'ll keep this brief — our AI platform helped a {{industry}} company in the region go from 200 to 800 monthly meetings in 6 months.\n\nIf the timing isn\'t right, I completely understand. But if there\'s even a flicker of interest, I\'d love to connect.\n\nNo pressure either way.\n\nBest', cta: 'Final CTA' },
        ],
      },
    },
  });
  console.log(`  ✓ Sequence "${seq1.name}" with ${3} steps`);

  const seq2 = await prisma.emailSequence.create({
    data: {
      name: 'Chairman & C-Suite Executive Sequence',
      description: 'High-value sequence for senior decision makers',
      serviceLine: 'Executive Outreach',
      steps: {
        create: [
          { stepNumber: 1, delayDays: 0, subject: 'Strategic growth partnership for {{company}}', body: 'Dear {{name}},\n\nAs {{title}} at {{company}}, you\'re steering growth in the {{industry}} sector. I\'d like to briefly share how DeepMindQ\'s AI Command Center is helping executives like you make data-driven outreach decisions.\n\nWould a 10-minute executive briefing be of interest?\n\nRegards', cta: 'Book executive briefing' },
          { stepNumber: 2, delayDays: 5, subject: 'Executive insight: AI in {{industry}}', body: 'Dear {{name}},\n\nI wanted to share a quick insight — {{industry}} companies using AI-driven outreach are seeing 4x improvement in pipeline velocity.\n\nI have a one-page executive summary that I think would be valuable for {{company}}\'s strategic planning.\n\nMay I send it over?\n\nRegards', cta: 'Request executive summary' },
        ],
      },
    },
  });
  console.log(`  ✓ Sequence "${seq2.name}" with 2 steps`);

  // Enroll some contacts in sequences
  const enrollContacts = await prisma.contact.findMany({
    where: { leadScore: { gte: 70 }, status: 'imported' },
    take: 150,
  });
  const enrollData = enrollContacts.map((c, i) => ({
    sequenceId: i % 3 === 0 ? seq2.id : seq1.id,
    contactId: c.id,
    status: i % 5 === 0 ? 'completed' : 'active',
    startedAt: new Date(Date.now() - Math.random() * 14 * 86400000),
    nextStepAt: i % 5 === 0 ? null : new Date(Date.now() + Math.random() * 7 * 86400000),
    completedAt: i % 5 === 0 ? new Date() : null,
  }));
  await prisma.sequenceEnrollment.createMany({ data: enrollData });
  console.log(`  ✓ ${enrollData.length} contacts enrolled`);

  // ══════════════════════════════════════════════
  // PHASE 8: Segments
  // ══════════════════════════════════════════════
  console.log('\n🏷️  Creating segments...');

  // Get industry distribution
  const industryStats = await prisma.company.groupBy({ by: ['industry'], where: { industry: { not: null } }, _count: true, orderBy: { _count: { industry: 'desc' } }, take: 15 });
  const countryStats = await prisma.company.groupBy({ by: ['country'], where: { country: { not: null } }, _count: true, orderBy: { _count: { country: 'desc' } }, take: 10 });

  const segments: any[] = [];

  // Industry segments
  for (const stat of industryStats.slice(0, 10)) {
    const ind = stat.industry!;
    const contacts = await prisma.contact.findMany({
      where: { company: { industry: ind } }, select: { id: true }, take: 500,
    });
    if (contacts.length < 5) continue;
    const seg = await prisma.segment.create({
      data: { name: `${ind} Companies`, description: `Contacts at companies in the ${ind} industry`, filters: JSON.stringify({ industry: [ind] }), contactCount: contacts.length },
    });
    await prisma.segmentContact.createMany({ data: contacts.map(c => ({ segmentId: seg.id, contactId: c.id })) });
    segments.push(seg);
  }

  // Country segments
  for (const stat of countryStats.slice(0, 5)) {
    const cntry = stat.country!;
    const contacts = await prisma.contact.findMany({
      where: { company: { country: cntry } }, select: { id: true }, take: 500,
    });
    if (contacts.length < 5) continue;
    const seg = await prisma.segment.create({
      data: { name: `${cntry} Contacts`, description: `Contacts based in ${cntry}`, filters: JSON.stringify({ country: [cntry] }), contactCount: contacts.length },
    });
    await prisma.segmentContact.createMany({ data: contacts.map(c => ({ segmentId: seg.id, contactId: c.id })) });
    segments.push(seg);
  }

  // High-value segment
  const hvContacts = await prisma.contact.findMany({ where: { leadScore: { gte: 75 } }, select: { id: true }, take: 500 });
  if (hvContacts.length > 0) {
    const seg = await prisma.segment.create({
      data: { name: 'High-Value Prospects', description: 'Top-scored leads with highest conversion potential', filters: JSON.stringify({ scoreRange: [75, 100] }), contactCount: hvContacts.length },
    });
    await prisma.segmentContact.createMany({ data: hvContacts.map(c => ({ segmentId: seg.id, contactId: c.id })) });
    segments.push(seg);
  }

  // Chairman/C-Suite segment
  const cSuiteContacts = await prisma.contact.findMany({
    where: { title: { contains: 'Chairman' } }, select: { id: true }, take: 500,
  });
  if (cSuiteContacts.length > 0) {
    const seg = await prisma.segment.create({
      data: { name: 'Chairmen & Board Members', description: 'Senior executives and board-level decision makers', filters: JSON.stringify({ title: ['Chairman', 'CEO', 'President', 'Managing Director'] }), contactCount: cSuiteContacts.length },
    });
    await prisma.segmentContact.createMany({ data: cSuiteContacts.map(c => ({ segmentId: seg.id, contactId: c.id })) });
    segments.push(seg);
  }

  console.log(`  ✓ ${segments.length} segments created`);

  // ══════════════════════════════════════════════
  // PHASE 9: Capabilities
  // ══════════════════════════════════════════════
  console.log('\n📚 Creating capability library...');
  const capabilities = [
    { title: 'AI-Powered Lead Scoring', summary: 'Multi-signal lead scoring engine that combines firmographic, behavioral, and intent data to rank prospects', category: 'service_line', serviceLine: 'AI Lead Intelligence', targetIndustries: '["Oil & Energy", "Construction", "Financial Services", "Manufacturing"]', targetRoles: '["VP", "Director", "Manager"]', content: 'DeepMindQ\'s lead scoring uses a proprietary 0-100 algorithm analyzing 15+ signals including company size, growth trajectory, technology adoption, and engagement patterns. Scores update in real-time as new signals are detected.' },
    { title: 'Intelligent Email Generation', summary: 'AI email composer that creates personalized outreach based on company research, industry context, and capability matching', category: 'service_line', serviceLine: 'AI Email Engine', targetIndustries: '["Oil & Energy", "Retail", "Pharmaceuticals", "Logistics and Supply Chain"]', targetRoles: '["CEO", "Chairman", "Managing Director", "Director"]', content: 'Our AI email engine generates contextually relevant emails by analyzing the target company\'s industry, recent signals, and matching them with your capability library. Average personalization score: 87/100.' },
    { title: 'KSA Market Expansion Package', summary: 'End-to-end outreach solution for companies expanding into the Saudi Arabian market', category: 'service_line', serviceLine: 'Market Intelligence', targetIndustries: '["Oil & Energy", "Construction", "Real Estate", "Consumer Goods"]', targetRoles: '["VP", "Director", "Business Development"]', content: 'Comprehensive KSA market package including 40,000+ verified contacts, industry-specific messaging frameworks, and compliance-aware templates aligned with Saudi business culture and communication preferences.' },
    { title: 'Gulf Region Multi-Touch Sequences', summary: 'Pre-built drip campaigns optimized for Gulf business communication patterns', category: 'service_line', serviceLine: 'AI Email Engine', targetIndustries: '["Oil & Energy", "Construction", "Financial Services", "Manufacturing", "Retail"]', targetRoles: '["CEO", "Chairman", "Director", "Manager"]', content: 'Sequences designed for Gulf business culture — respectful follow-up cadence, appropriate formality levels, and timing optimized for the region. Includes Arabic-ready templates and cultural sensitivity guidelines.' },
    { title: 'Company Intelligence Dashboard', summary: 'Real-time monitoring and analysis of target company signals, growth metrics, and engagement patterns', category: 'service_line', serviceLine: 'AI Command Center', targetIndustries: '["Oil & Energy", "Chemicals", "Construction", "Manufacturing"]', targetRoles: '["VP", "Director", "Analyst"]', content: 'Unified dashboard tracking 8 data dimensions per company: financial health, technology adoption, hiring patterns, news sentiment, partnership activity, and competitive positioning. Updated every 6 hours.' },
    { title: 'Oil & Energy Sector Outreach', summary: 'Specialized outreach framework for the energy sector with industry-specific messaging and compliance', category: 'case_study', serviceLine: 'AI Lead Intelligence', targetIndustries: '["Oil & Energy"]', targetRoles: '["VP", "Director", "Manager"]', content: 'Helped a leading Saudi energy company increase qualified meetings by 340% in 6 months using AI-powered prospect identification and personalized multi-channel outreach. Key achievement: 18 enterprise deals from cold outreach.' },
    { title: 'Construction & Infrastructure Pitch', summary: 'Proven outreach strategy for construction and infrastructure companies in the Gulf region', category: 'case_study', serviceLine: 'Market Intelligence', targetIndustries: '["Construction", "Civil Engineering", "Real Estate"]', targetRoles: '["CEO", "Managing Director", "VP"]', content: 'Developed and executed outreach for 200+ construction companies across KSA and UAE. Generated 150+ qualified meetings with decision-makers, resulting in 12 major partnerships worth $2.4M in pipeline.' },
    { title: 'Handling "Wrong Person" Objections', summary: 'Response framework when prospects redirect to a different contact', category: 'objection_response', serviceLine: 'AI Email Engine', targetIndustries: null, targetRoles: null, content: 'When a prospect says "I\'m not the right person," respond with: "Thank you for letting me know. Could you point me to the best person on your team to discuss [specific topic]? I\'d appreciate the introduction."' },
    { title: 'Gulf Business Meeting Request CTA', summary: 'Culturally appropriate meeting request optimized for Gulf business executives', category: 'cta', serviceLine: 'AI Email Engine', targetIndustries: '["Oil & Energy", "Construction", "Financial Services", "Retail"]', targetRoles: '["CEO", "Chairman", "Managing Director", "VP"]', content: 'Would you be open to a brief 15-minute introduction call this week? I\'d like to understand {{company}}\'s current outreach challenges and share how we\'ve helped similar organizations in the {{industry}} sector.' },
    { title: 'Manufacturing Sector Proof Point', summary: 'Quantified results from manufacturing sector clients', category: 'proof_point', serviceLine: 'AI Lead Intelligence', targetIndustries: '["Manufacturing", "Industrial Automation"]', targetRoles: '["VP", "Director", "Manager"]', content: 'A manufacturing company in the UAE achieved: 67% reduction in lead qualification time, 4.2x increase in sales-qualified meetings, and $1.8M additional pipeline within the first quarter of using DeepMindQ.' },
    { title: 'Pharmaceutical & Healthcare Outreach', summary: 'Compliance-aware outreach for pharma and healthcare sectors', category: 'service_line', serviceLine: 'AI Lead Intelligence', targetIndustries: '["Pharmaceuticals", "Healthcare"]', targetRoles: '["Medical Director", "VP", "Director"]', content: 'Specialized compliance framework for pharma outreach including regulatory awareness, appropriate tone guidelines, and HCP-specific messaging. Used by 3 major pharmaceutical companies across the MENA region.' },
    { title: 'Real Estate Developer Engagement', summary: 'Engagement playbook for real estate development companies', category: 'case_study', serviceLine: 'Market Intelligence', targetIndustries: '["Real Estate", "Construction"]', targetRoles: '["CEO", "Managing Director", "VP Sales"]', content: 'Engaged 85 real estate developers across KSA, generating 42 qualified meetings and 8 active partnerships. Key insight: Personalized market data in initial emails increased open rates by 45%.' },
  ];
  await prisma.capabilityAsset.createMany({ data: capabilities });
  console.log(`  ✓ ${capabilities.length} capabilities created`);

  // ══════════════════════════════════════════════
  // PHASE 10: Company signals, notes, research
  // ══════════════════════════════════════════════
  console.log('\n📡 Creating company signals & notes...');

  // Get top companies by contact count
  const topCompanies = await prisma.company.findMany({
    include: { _count: { select: { contacts: true } } },
    orderBy: { contacts: { _count: 'desc' } },
    take: 200,
  });

  const signalTypes = ['funding', 'hiring', 'expansion', 'partnership', 'news', 'tech_change', 'leadership_change'];
  const signalTemplates: Record<string, string[]> = {
    funding: ['{{company}} secures new investment round', '{{company}} reported strong financial performance', '{{company}} expands capital allocation for growth'],
    hiring: ['{{company}} actively hiring in {{industry}}', '{{company}} posts 15+ new positions', '{{company}} expands senior leadership team'],
    expansion: ['{{company}} opens new office in {{country}}', '{{company}} expands operations to new market', '{{company}} launches new product line'],
    partnership: ['{{company}} announces strategic partnership', '{{company}} collaborates with international firm', '{{company}} signs MoU with government entity'],
    news: ['{{company}} featured in industry publication', '{{company}} wins industry award', '{{company}} presents at major conference'],
    tech_change: ['{{company}} adopts new technology platform', '{{company}} launches digital transformation initiative', '{{company}} invests in AI capabilities'],
    leadership_change: ['{{company}} appoints new CEO', '{{company}} restructures leadership team', '{{company}} promotes VP to Managing Director'],
  };

  const signalData: any[] = [];
  const noteData: any[] = [];
  const timelineData: any[] = [];
  const researchData: any[] = [];

  for (const company of topCompanies) {
    // 1-3 signals per company
    const numSignals = Math.floor(Math.random() * 3) + 1;
    for (let s = 0; s < numSignals; s++) {
      const sigType = signalTypes[Math.floor(Math.random() * signalTypes.length)];
      const templates = signalTemplates[sigType];
      const title = templates[Math.floor(Math.random() * templates.length)]
        .replace('{{company}}', company.rawName)
        .replace('{{industry}}', company.industry || 'technology')
        .replace('{{country}}', company.country || 'the region');
      signalData.push({
        companyId: company.id,
        signalType: sigType,
        title,
        severity: ['low', 'medium', 'high', 'critical'][Math.floor(Math.random() * 4)],
        source: 'AI Monitor',
        createdAt: new Date(Date.now() - Math.random() * 30 * 86400000),
      });
    }

    // 1-2 notes per company
    const numNotes = Math.floor(Math.random() * 2) + 1;
    const noteBodies = [
      `${company.rawName} is a key prospect in the ${company.industry || 'technology'} sector. ${company.location ? `Based in ${company.location}.` : ''} ${company.sizeRange ? `Team size: ${company.sizeRange}.` : ''} High priority for outreach.`,
      `Research indicates ${company.rawName} is actively expanding. Recent signals suggest growth phase. Recommend personalized approach with industry-specific case studies.`,
      `Contact at ${company.rawName} has shown interest in similar solutions. Multiple decision-makers identified. Good candidate for multi-touch sequence.`,
      `${company.rawName} operates in ${company.country || 'the Gulf region'} with focus on ${company.industry || 'technology'}. Recommended to approach via direct email to senior leadership.`,
    ];
    for (let n = 0; n < numNotes; n++) {
      noteData.push({
        companyId: company.id,
        title: n === 0 ? 'Company Overview' : 'Outreach Strategy',
        category: n === 0 ? 'research' : 'general',
        body: noteBodies[Math.floor(Math.random() * noteBodies.length)],
        author: 'AI Assistant',
        pinned: n === 0,
      });
    }

    // Timeline events
    const timelineEvents = [
      { eventType: 'contact_added', title: 'Contacts imported from KSA database', description: `${company._count.contacts} contacts added` },
      { eventType: 'enrichment', title: 'Company data enriched', description: 'Industry, size, and location data populated' },
    ];
    if (Math.random() > 0.5) {
      timelineEvents.push({ eventType: 'signal', title: 'Activity signal detected', description: 'Recent business activity identified' });
    }
    for (const evt of timelineEvents) {
      timelineData.push({
        companyId: company.id,
        ...evt,
        createdAt: new Date(Date.now() - Math.random() * 14 * 86400000),
      });
    }

    // Research cards for top 50
    if (researchData.length < 50) {
      researchData.push({
        companyId: company.id,
        businessOverview: `${company.rawName} operates in the ${company.industry || 'technology'} sector${company.location ? `, based in ${company.location}` : ''}.${company.sizeRange ? ` The company has ${company.sizeRange} employees.` : ''} Key focus areas include business development and market expansion.`,
        relevantServices: 'AI Lead Intelligence, Email Outreach Automation, Company Research',
        keyDecisionMakers: `${company._count.contacts} contacts identified across various departments`,
        employeeCount: company.sizeRange || 'Unknown',
        techStack: JSON.stringify(['CRM', 'Email', 'ERP', 'Analytics']),
        enrichmentSource: 'KSA Database Import',
        enrichmentDate: new Date(),
      });
    }
  }

  await prisma.companySignal.createMany({ data: signalData });
  console.log(`  ✓ ${signalData.length} signals created`);
  await prisma.companyNote.createMany({ data: noteData });
  console.log(`  ✓ ${noteData.length} notes created`);
  await prisma.companyTimelineEvent.createMany({ data: timelineData });
  console.log(`  ✓ ${timelineData.length} timeline events created`);
  await prisma.companyResearchCard.createMany({ data: researchData });
  console.log(`  ✓ ${researchData.length} research cards created`);

  // ══════════════════════════════════════════════
  // PHASE 11: Email events (simulated engagement)
  // ══════════════════════════════════════════════
  console.log('\n📊 Creating email engagement events...');
  const sentContacts = await prisma.contact.findMany({
    where: { status: 'imported' },
    take: 300,
  });
  const eventData: any[] = [];
  for (const c of sentContacts) {
    // Opens
    if (Math.random() > 0.4) {
      eventData.push({ contactId: c.id, eventType: 'open', metadata: JSON.stringify({ agent: 'Gmail' }), createdAt: new Date(Date.now() - Math.random() * 7 * 86400000) });
    }
    // Clicks
    if (Math.random() > 0.8) {
      eventData.push({ contactId: c.id, eventType: 'click', metadata: JSON.stringify({ url: 'https://deepmindq.com/demo' }), createdAt: new Date(Date.now() - Math.random() * 5 * 86400000) });
    }
  }
  await prisma.emailEvent.createMany({ data: eventData });
  console.log(`  ✓ ${eventData.length} email events created`);

  // ══════════════════════════════════════════════
  // PHASE 12: Audit log
  // ══════════════════════════════════════════════
  console.log('\n📋 Creating audit log...');
  await prisma.auditLog.createMany({
    data: [
      { action: 'import', entity: 'ImportBatch', details: `Imported ${totalContacts} contacts from "Total KSA data40K IN.xlsx"` },
      { action: 'generate', entity: 'Draft', details: `Generated ${draftsCreated} AI email drafts` },
      { action: 'create', entity: 'Segment', details: `Created ${segments.length} audience segments` },
      { action: 'enrich', entity: 'Company', details: `Enriched ${researchData.length} company profiles` },
      { action: 'create', entity: 'CapabilityAsset', details: `Added ${capabilities.length} capability assets to library` },
    ],
  });
  console.log('  ✓ Audit log created');

  // ══════════════════════════════════════════════
  // SUMMARY
  // ══════════════════════════════════════════════
  console.log('\n' + '═'.repeat(60));
  console.log('  IMPORT COMPLETE — FINAL COUNTS');
  console.log('═'.repeat(60));

  const counts = {
    companies: await prisma.company.count(),
    contacts: await prisma.contact.count(),
    drafts: await prisma.draft.count(),
    queue: await prisma.sendQueue.count(),
    replies: await prisma.reply.count(),
    bounces: await prisma.bounce.count(),
    templates: await prisma.emailTemplate.count(),
    sequences: await prisma.emailSequence.count(),
    enrollments: await prisma.sequenceEnrollment.count(),
    segments: await prisma.segment.count(),
    capabilities: await prisma.capabilityAsset.count(),
    signals: await prisma.companySignal.count(),
    notes: await prisma.companyNote.count(),
    researchCards: await prisma.companyResearchCard.count(),
    events: await prisma.emailEvent.count(),
  };

  for (const [k, v] of Object.entries(counts)) {
    console.log(`  ${k.padEnd(18)} ${String(v).padStart(6)}`);
  }
  console.log('═'.repeat(60));

  console.timeEnd('Total import');
}

main()
  .catch(e => { console.error('Import failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());