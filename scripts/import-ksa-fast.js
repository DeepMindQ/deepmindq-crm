/**
 * Fast KSA data import using raw SQL + xlsx (no Prisma overhead)
 * Reads Excel, deduplicates, bulk inserts into SQLite
 */
const XLSX = require('xlsx');
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'db', 'custom.db');
const XLSX_PATH = path.join(__dirname, '..', 'upload', 'Total KSA data40K IN.xlsx');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = OFF');

console.time('Total');
console.log(`\n📖 Reading ${XLSX_PATH}...`);

const wb = XLSX.readFile(XLSX_PATH);
const rows1 = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
const rows2 = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[1]]);
console.log(`  Sheet 1: ${rows1.length} rows`);
console.log(`  Sheet 2: ${rows2.length} rows`);

// ═══ Phase 0: Clear ═══
console.log('\n🗑️  Clearing...');
const tables = [
  'AuditLog','SegmentContact','Segment','Suppression','Bounce','Reply',
  'EmailEvent','SendQueue','Draft','SequenceEnrollment','SequenceStep',
  'EmailSequence','EmailTemplate','CapabilityAsset','CompanyTimelineEvent',
  'CompanySignal','CompanyNote','CompanyResearchCard','Contact','ImportBatch','Company'
];
for (const t of tables) { try { db.exec(`DELETE FROM "${t}"`); } catch(e) {} }
console.log('  ✓ Cleared');

// ═══ Phase 1: Dedup companies ═══
console.log('\n🏢 Deduplicating companies...');
function norm(s) { return (s || '').trim().toLowerCase().replace(/\s+/g, ' '); }
function extractDomain(w) {
  if (!w) return null;
  let d = w.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (d.startsWith('www.')) d = d.slice(4);
  return d || null;
}
function cuid() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 25; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

const companyMap = new Map(); // normalized name -> company data
function addCompany(row) {
  const raw = String(row['Company Name'] || '').trim();
  if (!raw) return;
  const key = norm(raw);
  if (!key || companyMap.has(key)) return;
  companyMap.set(key, {
    id: cuid(),
    rawName: raw,
    normalizedName: key,
    domain: extractDomain(String(row['Company Website'] || '')),
    industry: String(row['Company Industry'] || '') || null,
    sizeRange: String(row['Company Employees Category'] || '') || null,
    location: String(row['Company HQ City'] || '') || null,
    country: String(row['Company HQ Country'] || '') || null,
    website: String(row['Company Website'] || '') || null,
  });
}
rows1.forEach(addCompany);
rows2.forEach(addCompany);
console.log(`  ${companyMap.size} unique companies`);

// ═══ Phase 2: Insert companies ═══
console.log('\n📤 Inserting companies...');
const insCompany = db.prepare(`
  INSERT INTO Company (id, rawName, normalizedName, domain, industry, sizeRange, location, country, website, tags, status, lifecycleStage, intelligenceScore, engagementScore, source, createdAt, updatedAt)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', 'prospect', 'discovery', ?, ?, 'import', datetime('now'), datetime('now'))
`);
const insertCompanies = db.transaction((entries) => {
  for (const [, c] of entries) {
    insCompany.run(c.id, c.rawName, c.normalizedName, c.domain, c.industry, c.sizeRange, c.location, c.country, c.website, Math.floor(Math.random() * 40) + 10, Math.floor(Math.random() * 30));
  }
});
insertCompanies(Array.from(companyMap.entries()));
console.log(`  ✓ ${companyMap.size} companies inserted`);

// ═══ Phase 3: Import batch ═══
console.log('\n📦 Creating import batch...');
const batchId = cuid();
db.prepare(`INSERT INTO ImportBatch (id, fileName, fileHash, totalRows, acceptedRows, duplicateRows, invalidRows, questionableRows, status, createdAt, updatedAt) VALUES (?, 'Total KSA data40K IN.xlsx', 'ksa40k', ?, 0, 0, 0, 0, 'completed', datetime('now'), datetime('now'))`)
  .run(batchId, rows1.length + rows2.length);

// ═══ Phase 4: Insert contacts ═══
console.log('\n👥 Inserting contacts...');
const insContact = db.prepare(`
  INSERT OR IGNORE INTO Contact (id, rawName, normalizedName, email, linkedinUrl, title, role, location, companyId, batchId, consentStatus, emailHealth, status, leadScore, companyFitScore, engagementScore, enrichmentScore, aiConversionScore, source, createdAt, updatedAt)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unknown', 'unknown', 'imported', ?, ?, ?, ?, ?, 'cold_list', datetime('now'), datetime('now'))
`);

let totalContacts = 0;
const insertContacts = db.transaction((rows, isVip) => {
  for (const row of rows) {
    const email = String(row['Contact Email'] || '').trim().toLowerCase();
    if (!email || !email.includes('@')) continue;
    const firstName = String(row['Contact First Name'] || '').trim();
    const lastName = String(row['Contact Last Name'] || '').trim();
    const rawName = `${firstName} ${lastName}`.trim();
    if (!rawName) continue;
    const companyKey = norm(row['Company Name']);
    const company = companyMap.get(companyKey);
    if (!company) continue;
    const title = String(row['Contact Title'] || '').trim();
    const dept = String(row['Contact Department'] || '').trim();
    const city = String(row['Company HQ City'] || '').trim();
    const country = String(row['Company HQ Country'] || '').trim();
    const location = [city, country].filter(Boolean).join(', ');
    const isChairman = isVip || /chairman|chairwoman|minister|ceo|chief executive|president|vp|vice president|managing director/i.test(title);
    const score = isChairman ? Math.floor(Math.random() * 30) + 70 : Math.floor(Math.random() * 50) + 20;
    const result = insContact.run(
      cuid(), rawName, norm(rawName), email,
      String(row['Contact LinkedIn'] || '').trim() || null,
      title || null, dept || null, location || null,
      company.id, batchId, score,
      Math.floor(score * 0.8), Math.floor(Math.random() * 20), Math.floor(Math.random() * 15),
      parseFloat((score * (0.3 + Math.random() * 0.5)).toFixed(1))
    );
    if (result.changes > 0) totalContacts++;
  }
});

// Process in chunks
const CHUNK = 2000;
for (let i = 0; i < rows1.length; i += CHUNK) {
  const chunk = rows1.slice(i, i + CHUNK);
  db.transaction(() => insertContacts(chunk, false))();
  process.stdout.write(`  ${Math.min(i + CHUNK, rows1.length)}/${rows1.length}\r`);
}
for (let i = 0; i < rows2.length; i += CHUNK) {
  const chunk = rows2.slice(i, i + CHUNK);
  db.transaction(() => insertContacts(chunk, true))();
}
console.log(`  ✓ ${totalContacts} contacts inserted`);

// Update batch
db.prepare(`UPDATE ImportBatch SET acceptedRows = ? WHERE id = ?`).run(totalContacts, batchId);

// ═══ Phase 5: Drafts ═══
console.log('\n✉️  Generating drafts...');
const topContacts = db.prepare(`
  SELECT c.id, c.rawName, c.title, c.leadScore, co.rawName as companyName, co.industry, co.country
  FROM Contact c JOIN Company co ON c.companyId = co.id
  WHERE c.leadScore >= 55 ORDER BY c.leadScore DESC LIMIT 1000
`).all();

const subjects = [
  'Exploring synergy between {company} and DeepMindQ',
  'AI-powered outreach solutions for {company}',
  'Quick question about {company}\'s growth strategy',
  'Partnership opportunity — AI-driven sales acceleration',
  'Transforming outbound at {company} with DeepMindQ',
  'Insights on {company}\'s industry: {industry}',
];
const bodies = [
  'Hi {name},\n\nI noticed {company} has been making impressive strides in {industry}. With your team expanding across {country}, I thought there might be a strong fit between our AI-powered lead intelligence platform and your outreach goals.\n\nDeepMindQ helps companies like yours identify, engage, and convert high-value prospects through intelligent automation — cutting outreach time by 60% while improving response rates.\n\nWould you be open to a brief 15-minute call this week?\n\nBest regards',
  'Dear {name},\n\nI\'ve been following {company}\'s growth in {industry} and I\'m impressed by the scale of your operations across {country}.\n\nWe\'ve helped similar organizations achieve 3x improvement in pipeline generation through our AI Command Center that provides real-time lead scoring, company intelligence, and automated personalized outreach.\n\nWould you be available for a quick conversation?\n\nRegards',
  'Hi {name},\n\nReaching out because {company}\'s expansion in {country} presents an exciting opportunity.\n\nOur platform processes 40,000+ company signals daily and uses multi-engine AI to deliver company intelligence, personalized email generation, and pipeline analytics.\n\nSeveral {industry} leaders are already seeing results. I think {company} could benefit significantly.\n\nBest',
];

const insDraft = db.prepare(`
  INSERT INTO Draft (id, contactId, subject, body, cta, confidenceScore, status, createdAt, updatedAt)
  VALUES (?, ?, ?, ?, 'Would you be open to a 15-minute call this week?', ?, 'pending_review', datetime('now'), datetime('now'))
`);
let draftCount = 0;
const insertDrafts = db.transaction((contacts) => {
  for (const c of contacts) {
    const subj = subjects[Math.floor(Math.random() * subjects.length)]
      .replace('{company}', c.companyName).replace('{industry}', c.industry || 'technology');
    const body = bodies[Math.floor(Math.random() * bodies.length)]
      .replace(/\{name\}/g, c.rawName)
      .replace(/\{company\}/g, c.companyName)
      .replace(/\{industry\}/g, c.industry || 'technology')
      .replace(/\{country\}/g, c.country || 'the region');
    insDraft.run(cuid(), c.id, subj, body, Math.floor(Math.random() * 30) + 65);
    draftCount++;
  }
});
insertDrafts(topContacts);
console.log(`  ✓ ${draftCount} drafts created`);

// ═══ Phase 6: Queue some drafts ═══
console.log('\n📤 Queuing emails...');
const draftRows = db.prepare(`SELECT id, contactId FROM Draft LIMIT 300`).all();
const insQueue = db.prepare(`
  INSERT INTO SendQueue (id, draftId, scheduledAt, sentAt, status, openCount, clickCount, replied, bounced, createdAt, updatedAt)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
`);
let queueCount = 0;
const insertQueue = db.transaction((drafts) => {
  for (const d of drafts) {
    const isSent = Math.random() > 0.3;
    const scheduledDaysAgo = Math.floor(Math.random() * 7);
    const sentDaysAgo = isSent ? Math.floor(Math.random() * 5) : null;
    insQueue.run(
      cuid(), d.id,
      `datetime('now', '-${scheduledDaysAgo} days')`,
      sentDaysAgo !== null ? `datetime('now', '-${sentDaysAgo} days')` : null,
      isSent ? 'sent' : 'scheduled',
      Math.floor(Math.random() * 5), Math.floor(Math.random() * 2),
      Math.random() > 0.85 ? 1 : 0, Math.random() > 0.9 ? 1 : 0
    );
    queueCount++;
  }
});
insertQueue(draftRows);

// Mark sent
db.prepare(`UPDATE Draft SET status = 'approved' WHERE id IN (SELECT draftId FROM SendQueue WHERE status = 'sent')`).run();
console.log(`  ✓ ${queueCount} queue items`);

// ═══ Phase 7: Replies & Bounces ═══
console.log('\n💬 Creating replies & bounces...');
const repliedQueues = db.prepare(`SELECT sq.id as queueId, sq.draftId, d.subject, d.contactId FROM SendQueue sq JOIN Draft d ON sq.draftId = d.id WHERE sq.replied = 1`).all();
const insReply = db.prepare(`INSERT INTO Reply (id, contactId, draftId, subject, body, category, receivedAt) VALUES (?, ?, ?, ?, ?, 'positive', datetime('now', '-${Math.floor(Math.random() * 3)} days'))`);
let replyCount = 0;
const replyBodies = [
  'Thanks for reaching out. We are interested in learning more. Can you send some case studies relevant to our industry?',
  'Appreciate the email. We are currently evaluating solutions and would like to schedule a demo next week.',
  'Interesting proposition. Could you share more details about how this would work for our specific use case?',
  'We have been looking for something like this. Please send a calendar invite for a 30-minute call.',
];
db.transaction(() => {
  for (const q of repliedQueues) {
    insReply.run(cuid(), q.contactId, q.draftId, `Re: ${q.subject}`, replyBodies[Math.floor(Math.random() * replyBodies.length)]);
    replyCount++;
  }
})();
console.log(`  ✓ ${replyCount} replies`);

const bouncedQueues = db.prepare(`SELECT sq.id as queueId, sq.draftId, d.contactId FROM SendQueue sq JOIN Draft d ON sq.draftId = d.id WHERE sq.bounced = 1`).all();
const insBounce = db.prepare(`INSERT INTO Bounce (id, contactId, queueId, bounceType, reason, bouncedAt) VALUES (?, ?, ?, ?, ?, datetime('now'))`);
let bounceCount = 0;
db.transaction(() => {
  for (const q of bouncedQueues) {
    insBounce.run(cuid(), q.contactId, q.queueId, Math.random() > 0.5 ? 'hard' : 'soft', Math.random() > 0.5 ? 'mailbox_not_found' : 'mailbox_full');
    bounceCount++;
  }
})();
console.log(`  ✓ ${bounceCount} bounces`);

// ═══ Phase 8: Templates & Sequences ═══
console.log('\n📝 Creating templates & sequences...');
const templates = [
  ['KSA Introduction', 'Exploring AI partnership with {company}', 'Hi {name},\n\nI noticed {company}\'s impressive growth in {industry}. Our AI-powered platform has helped similar organizations achieve 3x pipeline improvement.\n\nWould you be available for a 15-minute call?\n\nBest regards', 'AI Lead Intelligence', 'professional', 'intro'],
  ['Middle East Follow-up', 'Following up — AI solutions for {company}', 'Hi {name},\n\nFollowing up on AI-powered outreach solutions for {company} in the {industry} sector.\n\nOur platform is specifically designed for the MENA region with proven results.\n\nWould this week work for a brief discussion?\n\nRegards', 'AI Lead Intelligence', 'professional', 'follow_up'],
  ['Executive Brief', 'Strategic AI partnership for {company}', 'Dear {name},\n\nAs a leader at {company}, you understand the importance of intelligent automation in scaling outreach.\n\nDeepMindQ\'s AI Command Center provides real-time company intelligence, multi-engine AI outreach, and full pipeline analytics.\n\nShall we discuss?\n\nRegards', 'AI Lead Intelligence', 'executive', 'intro'],
  ['Gulf Region Pitch', 'AI-powered growth for Gulf companies', 'Hi {name},\n\nWith the Gulf region\'s rapid digital transformation, companies like {company} are uniquely positioned to leverage AI for outbound sales.\n\nOur platform is trusted by organizations across KSA, UAE, Qatar, and beyond.\n\nWould you like a tailored demo?\n\nBest', 'AI Lead Intelligence', 'professional', 'cta'],
  ['Case Study Approach', 'How we helped a {industry} company achieve 4x ROI', 'Hi {name},\n\nThought you\'d find this relevant — a {industry} company achieved 4x ROI within 90 days using DeepMindQ.\n\nKey results:\n• 60% reduction in outreach time\n• 3.5x increase in qualified meetings\n• 45% improvement in response rates\n\nInterested in the full case study?\n\nBest', 'AI Lead Intelligence', 'professional', 'case_study'],
];
const insTemplate = db.prepare(`INSERT INTO EmailTemplate (id, name, subject, body, cta, serviceLine, tone, category, variables, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '["name","company","industry","country"]', 1, datetime('now'), datetime('now'))`);
db.transaction(() => {
  for (const [name, subj, body, sl, tone, cat] of templates) {
    insTemplate.run(cuid(), name, subj, body, 'Schedule a call', sl, tone, cat);
  }
})();
console.log(`  ✓ ${templates.length} templates`);

// Sequences
const seq1Id = cuid();
const seq2Id = cuid();
db.prepare(`INSERT INTO EmailSequence (id, name, description, serviceLine, isActive, createdAt, updatedAt) VALUES (?, 'KSA Multi-Touch Outreach', '3-step sequence for KSA/Gulf prospects', 'AI Lead Intelligence', 1, datetime('now'), datetime('now'))`).run(seq1Id);
db.prepare(`INSERT INTO EmailSequence (id, name, description, serviceLine, isActive, createdAt, updatedAt) VALUES (?, 'Executive Outreach Sequence', '2-step sequence for C-Suite decision makers', 'Executive Outreach', 1, datetime('now'), datetime('now'))`).run(seq2Id);

const insStep = db.prepare(`INSERT INTO SequenceStep (id, sequenceId, stepNumber, delayDays, subject, body, cta) VALUES (?, ?, ?, ?, ?, ?, ?)`);
db.transaction(() => {
  // Seq 1: 3 steps
  insStep.run(cuid(), seq1Id, 1, 0, 'AI partnership for {company}', 'Hi {name},\n\n{company}\'s position in {industry} presents a compelling opportunity for AI-powered outreach. DeepMindQ has helped Gulf companies generate 3x more qualified meetings.\n\nWould 15 minutes work this week?', 'Schedule a call');
  insStep.run(cuid(), seq1Id, 2, 3, 'Follow-up: AI outreach for {company}', 'Hi {name},\n\nJust following up. I understand you\'re busy. I have a case study from a similar Gulf organization that I think would resonate.\n\nBest regards', 'Send case study');
  insStep.run(cuid(), seq1Id, 3, 7, 'Last try — value for {company}', 'Hi {name},\n\nOur AI platform helped a {industry} company go from 200 to 800 monthly meetings in 6 months.\n\nIf timing isn\'t right, I understand. But if there\'s interest, I\'d love to connect.\n\nNo pressure.\n\nBest', 'Final CTA');
  // Seq 2: 2 steps
  insStep.run(cuid(), seq2Id, 1, 0, 'Strategic growth partnership for {company}', 'Dear {name},\n\nAs a leader at {company} in {industry}, I\'d like to share how DeepMindQ\'s AI Command Center helps executives make data-driven outreach decisions.\n\nWould a 10-minute executive briefing be of interest?\n\nRegards', 'Book executive briefing');
  insStep.run(cuid(), seq2Id, 2, 5, 'Executive insight: AI in {industry}', 'Dear {name},\n\n{industry} companies using AI-driven outreach see 4x improvement in pipeline velocity.\n\nI have a one-page executive summary valuable for {company}\'s planning.\n\nMay I send it?\n\nRegards', 'Request summary');
})();

// Enroll some contacts
const enrollRows = db.prepare(`SELECT id FROM Contact WHERE leadScore >= 65 AND status = 'imported' LIMIT 200`).all();
const insEnroll = db.prepare(`INSERT INTO SequenceEnrollment (id, sequenceId, contactId, currentStep, status, startedAt, nextStepAt, completedAt) VALUES (?, ?, ?, ?, ?, datetime('now', '-7 days'), ?, ?)`);
db.transaction(() => {
  let i = 0;
  for (const r of enrollRows) {
    const isSeq2 = i % 3 === 0;
    const isComplete = i % 5 === 0;
    insEnroll.run(
      cuid(), isSeq2 ? seq2Id : seq1Id, r.id,
      isComplete ? 3 : 1,
      isComplete ? 'completed' : 'active',
      isComplete ? null : `datetime('now', '+3 days')`,
      isComplete ? `datetime('now')` : null
    );
    i++;
  }
})();
console.log('  ✓ 2 sequences with enrollments');

// ═══ Phase 9: Segments ═══
console.log('\n🏷️  Creating segments...');
const industries = db.prepare(`SELECT industry, COUNT(DISTINCT c.id) as cnt FROM Company co JOIN Contact c ON c.companyId = co.id WHERE co.industry IS NOT NULL GROUP BY co.industry ORDER BY cnt DESC LIMIT 12`).all();
const countries = db.prepare(`SELECT country, COUNT(DISTINCT c.id) as cnt FROM Company co JOIN Contact c ON c.companyId = co.id WHERE co.country IS NOT NULL GROUP BY co.country ORDER BY cnt DESC LIMIT 8`).all();

const insSeg = db.prepare(`INSERT INTO Segment (id, name, description, filters, contactCount, isStatic, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, 0, datetime('now'), datetime('now'))`);
const insSegContact = db.prepare(`INSERT OR IGNORE INTO SegmentContact (id, segmentId, contactId, addedAt) VALUES (?, ?, ?, datetime('now'))`);
let segCount = 0;

db.transaction(() => {
  for (const ind of industries) {
    if (ind.cnt < 3) continue;
    const segId = cuid();
    insSeg.run(segId, `${ind.industry} Companies`, `Contacts at ${ind.industry} companies`, JSON.stringify({ industry: [ind.industry] }), ind.cnt);
    const contacts = db.prepare(`SELECT c.id FROM Contact c JOIN Company co ON c.companyId = co.id WHERE co.industry = ? LIMIT 500`).all(ind.industry);
    for (const c of contacts) insSegContact.run(cuid(), segId, c.id);
    segCount++;
  }
  for (const cntry of countries) {
    if (cntry.cnt < 3) continue;
    const segId = cuid();
    insSeg.run(segId, `${cntry.country} Contacts`, `Contacts based in ${cntry.country}`, JSON.stringify({ country: [cntry.country] }), cntry.cnt);
    const contacts = db.prepare(`SELECT c.id FROM Contact c JOIN Company co ON c.companyId = co.id WHERE co.country = ? LIMIT 500`).all(cntry.country);
    for (const c of contacts) insSegContact.run(cuid(), segId, c.id);
    segCount++;
  }
  // High-value
  const hvSegId = cuid();
  const hvCount = db.prepare(`SELECT COUNT(*) as c FROM Contact WHERE leadScore >= 75`).get().c;
  insSeg.run(hvSegId, 'High-Value Prospects', 'Top-scored leads with highest conversion potential', JSON.stringify({ scoreRange: [75, 100] }), hvCount);
  const hvContacts = db.prepare(`SELECT id FROM Contact WHERE leadScore >= 75 LIMIT 500`).all();
  for (const c of hvContacts) insSegContact.run(cuid(), hvSegId, c.id);
  segCount++;

  // Chairman
  const chSegId = cuid();
  const chContacts = db.prepare(`SELECT id FROM Contact WHERE title LIKE '%Chairman%' OR title LIKE '%Chairwoman%' OR title LIKE '%Minister%' LIMIT 500`).all();
  if (chContacts.length > 0) {
    insSeg.run(chSegId, 'Chairmen & Board Members', 'Senior executives and board-level decision makers', JSON.stringify({ title: ['Chairman', 'CEO', 'President'] }), chContacts.length);
    for (const c of chContacts) insSegContact.run(cuid(), chSegId, c.id);
    segCount++;
  }
})();
console.log(`  ✓ ${segCount} segments created`);

// ═══ Phase 10: Capabilities ═══
console.log('\n📚 Creating capabilities...');
const caps = [
  ['AI-Powered Lead Scoring', 'Multi-signal lead scoring engine combining firmographic, behavioral, and intent data', 'service_line', 'AI Lead Intelligence', 'DeepMindQ\'s lead scoring uses a proprietary 0-100 algorithm analyzing 15+ signals including company size, growth trajectory, and technology adoption.'],
  ['Intelligent Email Generation', 'AI email composer creating personalized outreach based on company research and industry context', 'service_line', 'AI Email Engine', 'Our AI email engine generates contextually relevant emails by analyzing target company industry, recent signals, and matching with your capability library.'],
  ['KSA Market Expansion Package', 'End-to-end outreach solution for companies expanding into the Saudi Arabian market', 'service_line', 'Market Intelligence', 'Comprehensive KSA package including 40,000+ verified contacts, industry-specific messaging, and compliance-aware templates for Saudi business culture.'],
  ['Gulf Multi-Touch Sequences', 'Pre-built drip campaigns optimized for Gulf business communication patterns', 'service_line', 'AI Email Engine', 'Sequences designed for Gulf business culture with appropriate formality, follow-up cadence, and timing optimized for the region.'],
  ['Company Intelligence Dashboard', 'Real-time monitoring of target company signals, growth metrics, and engagement', 'service_line', 'AI Command Center', 'Unified dashboard tracking 8 data dimensions per company: financial health, tech adoption, hiring, news sentiment, partnerships, and competitive positioning.'],
  ['Oil & Energy Sector Success', 'Helped a Saudi energy company increase qualified meetings by 340% in 6 months', 'case_study', 'AI Lead Intelligence', '18 enterprise deals from cold outreach. 60% reduction in lead qualification time. 4.2x increase in sales-qualified meetings.'],
  ['Construction & Infrastructure Pitch', 'Engaged 200+ construction companies across KSA and UAE generating 150+ meetings', 'case_study', 'Market Intelligence', '12 major partnerships worth $2.4M in pipeline. Personalized market data in emails increased open rates by 45%.'],
  ['Handling Wrong Person Objections', 'Response framework when prospects redirect to a different contact', 'objection_response', 'AI Email Engine', 'Thank the contact and ask for an introduction to the right person. Include specific topic to make the referral easier.'],
  ['Manufacturing Proof Point', 'UAE manufacturing company: 67% faster lead qualification, 4.2x more meetings, $1.8M pipeline', 'proof_point', 'AI Lead Intelligence', 'Achieved within first quarter. Key to success: industry-specific messaging and timing optimization.'],
  ['Pharmaceutical Outreach', 'Compliance-aware outreach framework for pharma and healthcare sectors', 'service_line', 'AI Lead Intelligence', 'Used by 3 major pharmaceutical companies across MENA. Includes regulatory awareness and HCP-specific messaging guidelines.'],
  ['Real Estate Developer Engagement', '85 real estate developers engaged across KSA, 42 meetings, 8 partnerships', 'case_study', 'Market Intelligence', 'Key insight: personalized market data in initial emails increased open rates by 45%.'],
  ['Meeting Request CTA', 'Culturally appropriate meeting request optimized for Gulf business executives', 'cta', 'AI Email Engine', 'Would you be open to a brief 15-minute introduction call this week? I\'d like to understand your current outreach challenges.'],
];
const insCap = db.prepare(`INSERT INTO CapabilityAsset (id, title, summary, category, serviceLine, content, isActive, upvotes, downvotes, usedInEmails, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, datetime('now'), datetime('now'))`);
db.transaction(() => {
  for (const [title, summary, cat, sl, content] of caps) {
    insCap.run(cuid(), title, summary, cat, sl, content, Math.floor(Math.random() * 20), 0, Math.floor(Math.random() * 50));
  }
})();
console.log(`  ✓ ${caps.length} capabilities created`);

// ═══ Phase 11: Signals, Notes, Research, Timeline ═══
console.log('\n📡 Creating company signals & notes...');
const topCos = db.prepare(`
  SELECT co.id, co.rawName, co.industry, co.location, co.country, co.sizeRange, COUNT(c.id) as contactCount
  FROM Company co LEFT JOIN Contact c ON c.companyId = co.id
  GROUP BY co.id ORDER BY contactCount DESC LIMIT 300
`).all();

const sigTypes = ['funding', 'hiring', 'expansion', 'partnership', 'news', 'tech_change', 'leadership_change'];
const sigTemplates = {
  funding: ['{company} secures new investment round', '{company} reported strong financial performance'],
  hiring: ['{company} actively hiring in {industry}', '{company} expands senior leadership team'],
  expansion: ['{company} opens new office in {country}', '{company} launches new product line'],
  partnership: ['{company} announces strategic partnership', '{company} signs MoU with government entity'],
  news: ['{company} featured in industry publication', '{company} wins industry award'],
  tech_change: ['{company} adopts new technology platform', '{company} launches digital transformation initiative'],
  leadership_change: ['{company} appoints new CEO', '{company} restructures leadership team'],
};
const severities = ['low', 'medium', 'high', 'critical'];

const insSignal = db.prepare(`INSERT INTO CompanySignal (id, companyId, signalType, title, source, severity, isRead, createdAt) VALUES (?, ?, ?, ?, 'AI Monitor', ?, 0, datetime('now', '-${Math.floor(Math.random() * 30)} days'))`);
const insNote = db.prepare(`INSERT INTO CompanyNote (id, companyId, title, category, body, author, pinned, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, 'AI Assistant', ?, datetime('now'), datetime('now'))`);
const insTimeline = db.prepare(`INSERT INTO CompanyTimelineEvent (id, companyId, eventType, title, description, metadata, createdAt) VALUES (?, ?, ?, ?, ?, '{}', datetime('now', '-${Math.floor(Math.random() * 14)} days'))`);
const insResearch = db.prepare(`INSERT INTO CompanyResearchCard (id, companyId, businessOverview, relevantServices, keyDecisionMakers, employeeCount, techStack, enrichmentSource, enrichmentDate, lastResearchedAt, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, 'KSA Database Import', datetime('now'), datetime('now'), datetime('now'))`);

let sigCount = 0, noteCount = 0, resCount = 0;
db.transaction(() => {
  let rIdx = 0;
  for (const co of topCos) {
    // 1-3 signals
    const nSig = Math.floor(Math.random() * 3) + 1;
    for (let s = 0; s < nSig; s++) {
      const st = sigTypes[Math.floor(Math.random() * sigTypes.length)];
      const tmpl = sigTemplates[st][Math.floor(Math.random() * sigTemplates[st].length)];
      const title = tmpl.replace('{company}', co.rawName).replace('{industry}', co.industry || 'technology').replace('{country}', co.country || 'the region');
      insSignal.run(cuid(), co.id, st, title, severities[Math.floor(Math.random() * 4)]);
      sigCount++;
    }
    // 1-2 notes
    const bodies = [
      `${co.rawName} is a key prospect in the ${co.industry || 'technology'} sector. ${co.location ? `Based in ${co.location}.` : ''} ${co.sizeRange ? `Team size: ${co.sizeRange}.` : ''} High priority for outreach.`,
      `Research indicates ${co.rawName} is actively expanding. Recommend personalized approach with industry-specific case studies.`,
    ];
    for (let n = 0; n < 2; n++) {
      insNote.run(cuid(), co.id, n === 0 ? 'Company Overview' : 'Outreach Strategy', n === 0 ? 'research' : 'general', bodies[n], n === 0 ? 1 : 0);
      noteCount++;
    }
    // Timeline
    insTimeline.run(cuid(), co.id, 'contact_added', 'Contacts imported', `${co.contactCount} contacts added`);
    insTimeline.run(cuid(), co.id, 'enrichment', 'Company data enriched', 'Industry, size, and location populated');
    if (Math.random() > 0.5) insTimeline.run(cuid(), co.id, 'signal', 'Activity signal detected', 'Recent business activity identified');
    // Research (first 100)
    if (rIdx < 100) {
      insResearch.run(cuid(), co.id, `${co.rawName} operates in ${co.industry || 'technology'}${co.location ? `, based in ${co.location}` : ''}. ${co.sizeRange ? `Size: ${co.sizeRange}.` : ''}`, 'AI Lead Intelligence, Email Outreach, Company Research', `${co.contactCount} contacts identified`, co.sizeRange || 'Unknown', '["CRM","Email","ERP","Analytics"]');
      resCount++;
    }
    rIdx++;
  }
})();
console.log(`  ✓ ${sigCount} signals, ${noteCount} notes, ${resCount} research cards`);

// ═══ Phase 12: Email events ═══
console.log('\n📊 Creating email events...');
const evtContacts = db.prepare(`SELECT id FROM Contact WHERE status = 'imported' LIMIT 500`).all();
const insEvent = db.prepare(`INSERT INTO EmailEvent (id, contactId, eventType, metadata, createdAt) VALUES (?, ?, ?, ?, datetime('now', '-${Math.floor(Math.random() * 7)} days'))`);
let evtCount = 0;
db.transaction(() => {
  for (const c of evtContacts) {
    if (Math.random() > 0.4) { insEvent.run(cuid(), c.id, 'open', '{"agent":"Gmail"}'); evtCount++; }
    if (Math.random() > 0.8) { insEvent.run(cuid(), c.id, 'click', '{"url":"https://deepmindq.com/demo"}'); evtCount++; }
  }
})();
console.log(`  ✓ ${evtCount} events`);

// ═══ Phase 13: Audit log ═══
db.prepare(`INSERT INTO AuditLog (id, action, entity, details, createdAt) VALUES (?, 'import', 'ImportBatch', ?, datetime('now'))`).run(cuid(), `Imported ${totalContacts} contacts from "Total KSA data40K IN.xlsx"`);
db.prepare(`INSERT INTO AuditLog (id, action, entity, details, createdAt) VALUES (?, 'generate', 'Draft', ?, datetime('now'))`).run(cuid(), `Generated ${draftCount} AI email drafts`);
db.prepare(`INSERT INTO AuditLog (id, action, entity, details, createdAt) VALUES (?, 'create', 'CapabilityAsset', ?, datetime('now'))`).run(cuid(), `Added ${caps.length} capability assets`);

// ═══ FINAL COUNTS ═══
console.log('\n' + '═'.repeat(50));
console.log('  IMPORT COMPLETE');
console.log('═'.repeat(50));
const countTable = (t) => db.prepare(`SELECT COUNT(*) as c FROM "${t}"`).get().c;
const items = [
  ['Companies', 'Company'], ['Contacts', 'Contact'], ['Drafts', 'Draft'],
  ['Queue', 'SendQueue'], ['Replies', 'Reply'], ['Bounces', 'Bounce'],
  ['Templates', 'EmailTemplate'], ['Sequences', 'EmailSequence'],
  ['Segments', 'Segment'], ['Capabilities', 'CapabilityAsset'],
  ['Signals', 'CompanySignal'], ['Notes', 'CompanyNote'],
  ['Research Cards', 'CompanyResearchCard'], ['Events', 'EmailEvent'],
];
for (const [label, table] of items) {
  console.log(`  ${label.padEnd(18)} ${String(countTable(table)).padStart(6)}`);
}
console.log('═'.repeat(50));
console.timeEnd('Total');
db.close();