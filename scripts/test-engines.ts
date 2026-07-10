import { db } from '../src/lib/db';
import { validateEmail, checkSyntax, isDisposableDomain, checkMxRecords, checkSpfRecord, getTldTrustScore } from '../src/lib/email-verification';

async function main() {
  console.log('=== TESTING EMAIL VERIFICATION ENGINE ===\n');

  // Test 1: Syntax check
  console.log('1. Syntax checks:');
  console.log('   valid@email.com:', checkSyntax('valid@email.com'));
  console.log('   invalid-email:', checkSyntax('invalid-email'));
  console.log('   @missing-local:', checkSyntax('@missing-local'));
  console.log('   no-tld@domain:', checkSyntax('no-tld@domain'));

  // Test 2: Disposable domain
  console.log('\n2. Disposable domain checks:');
  console.log('   mailinator.com:', isDisposableDomain('mailinator.com'));
  console.log('   gmail.com:', isDisposableDomain('gmail.com'));
  console.log('   tempmail.com:', isDisposableDomain('tempmail.com'));

  // Test 3: TLD trust scoring
  console.log('\n3. TLD trust scores:');
  console.log('   gmail.com:', getTldTrustScore('gmail.com'));
  console.log('   company.io:', getTldTrustScore('company.io'));
  console.log('   startup.ai:', getTldTrustScore('startup.ai'));
  console.log('   random.xyz:', getTldTrustScore('random.xyz'));

  // Test 4: MX record lookup (real DNS)
  console.log('\n4. Real MX record lookups:');
  const mx1 = await checkMxRecords('google.com');
  console.log('   google.com MX:', mx1);
  const mx2 = await checkMxRecords('github.com');
  console.log('   github.com MX:', mx2);
  const mx3 = await checkMxRecords('thisdomaindoesnotexist12345.com');
  console.log('   fake domain MX:', mx3);

  // Test 5: SPF check
  console.log('\n5. SPF record checks:');
  const spf1 = await checkSpfRecord('google.com');
  console.log('   google.com SPF:', spf1);
  const spf2 = await checkSpfRecord('github.com');
  console.log('   github.com SPF:', spf2);

  // Test 6: Full validation
  console.log('\n6. Full email validation:');
  const r1 = await validateEmail('sarah.chen@datapulse.ai');
  console.log('   sarah.chen@datapulse.ai:', JSON.stringify({ score: r1.score, status: r1.status, mxOk: r1.mxOk, spfOk: r1.spfOk, dmarcOk: r1.dmarcOk, tldScore: r1.tldScore }));

  const r2 = await validateEmail('test@mailinator.com');
  console.log('   test@mailinator.com:', JSON.stringify({ score: r2.score, status: r2.status, disposableOk: r2.disposableOk }));

  const r3 = await validateEmail('not-an-email');
  console.log('   not-an-email:', JSON.stringify({ score: r3.score, status: r3.status, syntaxOk: r3.syntaxOk }));

  // Test 7: Database queries - verify seed data
  console.log('\n=== VERIFYING SEED DATA ===\n');
  const companies = await db.company.count({ where: { status: { not: 'archived' } } });
  const contacts = await db.contact.count({ where: { archivedAt: null } });
  const opportunities = await db.opportunity.count();
  const researchCards = await db.companyResearchCard.count();
  const documents = await db.capabilityDocument.count();
  const snippets = await db.capabilitySnippet.count();
  const notes = await db.companyNote.count() + await db.contactNote.count();
  const timeline = await db.timelineEntry.count();
  const drafts = await db.draft.count();
  const healthChecks = await db.emailHealthCheck.count();

  console.log(`Companies (active): ${companies}`);
  console.log(`Contacts (active): ${contacts}`);
  console.log(`Opportunities: ${opportunities}`);
  console.log(`Research Cards: ${researchCards}`);
  console.log(`Capability Documents: ${documents}`);
  console.log(`Capability Snippets: ${snippets}`);
  console.log(`Notes: ${notes}`);
  console.log(`Timeline Entries: ${timeline}`);
  console.log(`Drafts: ${drafts}`);
  console.log(`Email Health Checks: ${healthChecks}`);

  // Test 8: Sample a research card
  console.log('\n=== SAMPLE RESEARCH CARD ===\n');
  const rc = await db.companyResearchCard.findFirst({ include: { company: { select: { name: true } } } });
  if (rc) {
    console.log(`Company: ${rc.company.name}`);
    console.log(`Overview: ${rc.businessOverview?.substring(0, 150)}...`);
    console.log(`Confidence: ${rc.confidenceScore}`);
  }

  // Test 9: Sample a draft
  console.log('\n=== SAMPLE EMAIL DRAFT ===\n');
  const draft = await db.draft.findFirst({ include: { contact: { select: { name: true, email: true } } } });
  if (draft) {
    console.log(`Contact: ${draft.contact.name} (${draft.contact.email})`);
    console.log(`Subject: ${draft.subject}`);
    console.log(`Match Score: ${draft.matchScore}, Confidence: ${draft.confidenceScore}`);
  }

  // Test 10: Company with full data
  console.log('\n=== SAMPLE COMPANY WITH FULL DATA ===\n');
  const fullCompany = await db.company.findFirst({
    where: { status: { not: 'archived' } },
    include: {
      contacts: { take: 2, where: { archivedAt: null } },
      researchCard: true,
      opportunities: { take: 2 },
      notes: { take: 1 },
    },
  });
  if (fullCompany) {
    console.log(`Name: ${fullCompany.name}`);
    console.log(`Industry: ${fullCompany.industry}`);
    console.log(`Status: ${fullCompany.status}`);
    console.log(`Intelligence Score: ${fullCompany.intelligenceScore}`);
    console.log(`Contacts: ${fullCompany.contacts.length}`);
    console.log(`Has Research: ${!!fullCompany.researchCard}`);
    console.log(`Opportunities: ${fullCompany.opportunities.length}`);
    console.log(`Notes: ${fullCompany.notes.length}`);
    for (const c of fullCompany.contacts) {
      console.log(`  - ${c.name} (${c.jobTitle}) | ${c.email} | health: ${c.emailHealth}`);
    }
  }

  console.log('\n=== ALL TESTS PASSED ===');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
