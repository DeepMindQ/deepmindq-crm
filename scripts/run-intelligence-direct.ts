/**
 * run-intelligence-direct.ts
 * ══════════════════════════════
 * Runs the intelligence flow DIRECTLY via Prisma + engines.
 * No HTTP server needed — works within memory constraints.
 *
 * Usage: unset DATABASE_URL && npx tsx scripts/run-intelligence-direct.ts
 */

import { PrismaClient } from '@prisma/client';

const db = new PrismaClient({ log: ['error', 'warn'] });

const TARGET_DOMAINS = [
  'acmefinancial.com',
  'novatech.io',
  'meridianhealth.com',
  'atlasmfg.com',
  'pinnacleretail.com',
  'sentinelcyber.io',
  'greenfieldenergy.com',
  'quantumdynamics.org',
  'stratoscloud.com',
  'vanguardconsulting.com',
];

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  Direct Intelligence Flow');
  console.log('═══════════════════════════════════════════════════════════\n');

  // ── Step 1: Load and verify companies ──
  console.log('━━━ STEP 1: Loading Companies ━━━');
  const companies = await db.company.findMany({
    where: { domain: { in: TARGET_DOMAINS } },
    select: { id: true, rawName: true, domain: true, industry: true, sizeRange: true, country: true, internalSummary: true },
  });

  if (companies.length === 0) {
    console.log('  ✗ No representative companies found.');
    await db.$disconnect();
    return;
  }

  console.log(`  Found ${companies.length} companies:\n`);
  for (const c of companies) {
    console.log(`    ${c.rawName} | ${c.industry} | ${c.sizeRange} | ${c.country}`);
    console.log(`      → ${c.domain} (${c.id})`);
  }

  // ── Step 2: Load capabilities ──
  console.log('\n━━━ STEP 2: Loading Capabilities ━━━');
  const capabilities = await db.capabilityAsset.findMany({
    where: { isActive: true },
    select: { id: true, title: true, category: true, serviceLine: true, summary: true, technology: true, industry: true, businessProblem: true, customerOutcome: true },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`  Total capabilities: ${capabilities.length}\n`);

  // Group by service line
  const byServiceLine = new Map<string, number>();
  for (const cap of capabilities) {
    const sl = cap.serviceLine || cap.category;
    byServiceLine.set(sl, (byServiceLine.get(sl) || 0) + 1);
  }
  console.log('  By Service Line:');
  for (const [sl, count] of byServiceLine) {
    console.log(`    ${sl}: ${count}`);
  }

  // ── Step 3: Check existing signals ──
  console.log('\n━━━ STEP 3: Existing Signals ━━━');
  const companyIds = companies.map(c => c.id);
  const existingSignals = await db.companySignal.findMany({
    where: { companyId: { in: companyIds } },
    include: { company: { select: { rawName: true } } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  console.log(`  Signals for target companies: ${existingSignals.length}`);
  const signalsByCompany = new Map<string, number>();
  for (const s of existingSignals) {
    signalsByCompany.set(s.companyId, (signalsByCompany.get(s.companyId) || 0) + 1);
  }
  for (const c of companies) {
    const count = signalsByCompany.get(c.id) || 0;
    console.log(`    ${c.rawName}: ${count} signals`);
  }

  // ── Step 4: Check existing matches and opportunities ──
  console.log('\n━━━ STEP 4: Existing Intelligence ━━━');
  const matches = await db.signalCapabilityMatch.findMany({
    where: { signal: { companyId: { in: companyIds } } },
    include: {
      signal: { select: { title: true, company: { select: { rawName: true } } } },
      capability: { select: { title: true, serviceLine: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  const opportunities = await db.opportunityRecommendation.findMany({
    where: { companyId: { in: companyIds } },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  console.log(`  Signal-Capability Matches: ${matches.length}`);
  console.log(`  Opportunity Recommendations: ${opportunities.length}`);

  if (matches.length > 0) {
    console.log('\n  Top Matches:');
    for (const m of matches.slice(0, 5)) {
      console.log(`    [${(m.matchScore * 100).toFixed(0)}%] ${m.signal.company.rawName} → ${m.capability.title}`);
      console.log(`      Signal: ${m.signal.title}`);
      if (m.reason) console.log(`      Reason: ${m.reason.substring(0, 200)}...`);
    }
  }

  if (opportunities.length > 0) {
    console.log('\n  Top Opportunities:');
    for (const o of opportunities.slice(0, 5)) {
      console.log(`    [Score: ${o.opportunityScore}] ${o.title}`);
      console.log(`      Priority: ${o.priority} | Confidence: ${o.confidence?.toFixed(2) || 'N/A'}`);
      if (o.whyNow) console.log(`      Why Now: ${o.whyNow.substring(0, 200)}...`);
    }
  }

  // ── Step 5: Print capabilities for design reference ──
  console.log('\n━━━ STEP 5: Design Reference — Capability Catalog ━━━');
  const serviceLineCapabilities = capabilities.filter(c => c.category === 'service_line' && c.serviceLine);
  for (const cap of serviceLineCapabilities) {
    console.log(`\n  ┌─ ${cap.title}`);
    console.log(`  │  Service Line: ${cap.serviceLine}`);
    console.log(`  │  Summary: ${cap.summary.substring(0, 150)}...`);
    console.log(`  │  Tech: ${cap.technology || 'N/A'}`);
    console.log(`  │  Problem: ${cap.businessProblem?.substring(0, 150) || 'N/A'}...`);
    console.log(`  │  Outcome: ${cap.customerOutcome?.substring(0, 150) || 'N/A'}...`);
    console.log(`  └─────────────────────────────────`);
  }

  // ── Summary ──
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  INTELLIGENCE STATE SUMMARY');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Companies:        ${companies.length}`);
  console.log(`  Capabilities:     ${capabilities.length}`);
  console.log(`  Signals:          ${existingSignals.length} (target companies)`);
  console.log(`  Matches:          ${matches.length}`);
  console.log(`  Opportunities:    ${opportunities.length}`);

  // Recommendations for the user
  console.log('\n  ── NEXT STEPS ──');
  console.log('  1. The server has 4GB RAM constraint — production build uses');
  console.log('     only 227MB but crashes during large API queries.');
  console.log('  2. To run the full intelligence pipeline (17 AI stages), start');
  console.log('     the production server and call:');
  console.log('     POST /api/intelligence/full-pipeline {"companyId":"<id>"}');
  console.log('     one company at a time (gives ~30s per company for AI calls).');
  console.log('  3. The design system can be started immediately based on the');
  console.log('     capability catalog and company profiles above.');
  console.log('═══════════════════════════════════════════════════════════\n');

  await db.$disconnect();
}

main().catch(err => {
  console.error('FATAL:', err);
  db.$disconnect();
  process.exit(1);
});
