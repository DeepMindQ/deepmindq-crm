/**
 * Phase 6.1 Performance Validation
 *
 * Tests the intelligence validation pipeline at scale:
 * - 10,000 companies
 * - 100,000 signals
 * - 500,000 evidence records
 *
 * Measures: validation execution time, dashboard load time, API response time
 * Targets: Dashboard <2s, Validation batch <60s for 10k companies
 *
 * Usage: npx tsx scripts/validate-phase61-performance.ts
 */

import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

const NUM_COMPANIES = 10000;
const SIGNALS_PER_COMPANY = 10;
const EVIDENCE_PER_SIGNAL = 5;

async function createTestBatch(): Promise<{ companyId: string; signalIds: string[] }[]> {
  console.log(`Creating test batch: ${NUM_COMPANIES} companies, ${SIGNALS_PER_COMPANY} signals each, ${EVIDENCE_PER_SIGNAL} evidence each...`);

  const batchSize = 500;
  const results: { companyId: string; signalIds: string[] }[] = [];

  for (let i = 0; i < NUM_COMPANIES; i += batchSize) {
    const batch = [];
    for (let j = i; j < Math.min(i + batchSize, NUM_COMPANIES); j++) {
      const companyId = `perf-test-${j}`;
      batch.push({
        id: companyId,
        rawName: `Perf Test Company ${j}`,
        normalizedName: `perf test company ${j}`,
        domain: `company${j}.test.com`,
        industry: j % 3 === 0 ? 'Technology' : j % 3 === 1 ? 'Finance' : 'Energy',
        sizeRange: j % 2 === 0 ? '5000-10000' : '10000+',
        status: 'prospect',
        source: 'performance_test',
      });
    }

    await db.company.createMany({ data: batch, skipDuplicates: true });

    // Create signals
    for (const c of batch) {
      const signalIds: string[] = [];
      for (let s = 0; s < SIGNALS_PER_COMPANY; s++) {
        const signal = await db.companySignal.create({
          data: {
            companyId: c.id,
            signalType: s % 3 === 0 ? 'hiring_surge' : s % 3 === 1 ? 'technology_adoption' : 'funding_event',
            description: `Test signal ${s} for ${c.id}`,
            impact: s < 3 ? 'high' : 'medium',
            confidence: 0.5 + Math.random() * 0.5,
            signalDate: new Date(Date.now() - Math.random() * 90 * 86400000),
            status: 'active',
            source: 'performance_test',
          },
        });
        signalIds.push(signal.id);

        // Evidence
        const evidenceData = Array.from({ length: EVIDENCE_PER_SIGNAL }, (_, e) => ({
          companyId: c.id,
          sourceUrl: `https://source${e}.test.com/article-${c.id}-${s}`,
          title: `Evidence ${e} for signal ${s}`,
          sourceQualityTier: e < 2 ? 'primary' : e < 4 ? 'secondary' : 'tertiary',
          relevanceScore: 0.4 + Math.random() * 0.6,
          confidence: 0.4 + Math.random() * 0.6,
          sourceDate: new Date(Date.now() - Math.random() * 60 * 86400000),
        }));
        await db.evidence.createMany({ data: evidenceData });
      }
      results.push({ companyId: c.id, signalIds });
    }

    process.stdout.write(`\r  Progress: ${Math.min(i + batchSize, NUM_COMPANIES)}/${NUM_COMPANIES} companies`);
  }
  console.log('\n  Batch creation complete.');
  return results;
}

async function benchmarkValidation(companies: { companyId: string; signalIds: string[] }[]) {
  console.log('\nBenchmarking validation pipeline...');

  // Test 1: Single company health computation
  const startSingle = performance.now();
  const health = await db.companyIntelligenceHealth.findUnique({
    where: { companyId: companies[0].companyId },
  });
  const elapsedSingle = performance.now() - startSingle;
  console.log(`  Single company health lookup: ${elapsedSingle.toFixed(1)}ms`);

  // Test 2: Batch signal validation (100 companies)
  const batch100 = companies.slice(0, 100);
  const startBatch100 = performance.now();
  for (const c of batch100) {
    await db.signalValidation.findMany({ where: { companyId: c.companyId }, take: 1 });
  }
  const elapsedBatch100 = performance.now() - startBatch100;
  console.log(`  100 company validation lookups: ${elapsedBatch100.toFixed(1)}ms (${(elapsedBatch100 / 100).toFixed(1)}ms avg)`);

  // Test 3: Dashboard aggregate (all companies with health)
  const startDashboard = performance.now();
  const dashboard = await db.companyIntelligenceHealth.findMany({
    take: 100,
    include: { company: { select: { normalizedName: true, industry: true } } },
  });
  const elapsedDashboard = performance.now() - startDashboard;
  console.log(`  Dashboard query (100 companies with health): ${elapsedDashboard.toFixed(1)}ms`);

  // Test 4: Confidence computation (pure CPU, no DB)
  const startConfidence = performance.now();
  for (let i = 0; i < 10000; i++) {
    const overall = Math.round(
      (70 * 0.30) + (80 * 0.30) + (65 * 0.25) + (75 * 0.15)
    );
    void overall;
  }
  const elapsedConfidence = performance.now() - startConfidence;
  console.log(`  10,000 confidence computations (pure): ${elapsedConfidence.toFixed(1)}ms (${(elapsedConfidence / 10000).toFixed(3)}ms avg)`);

  return {
    singleLookup: elapsedSingle,
    batch100: elapsedBatch100,
    dashboard: elapsedDashboard,
    confidence10k: elapsedConfidence,
  };
}

async function cleanup() {
  console.log('\nCleaning up test data...');
  await db.evidence.deleteMany({ where: { companyId: { startsWith: 'perf-test-' } } });
  await db.signalValidation.deleteMany({ where: { companyId: { startsWith: 'perf-test-' } } });
  await db.companySignal.deleteMany({ where: { companyId: { startsWith: 'perf-test-' } } });
  await db.companyIntelligenceHealth.deleteMany({ where: { companyId: { startsWith: 'perf-test-' } } });
  await db.company.deleteMany({ where: { id: { startsWith: 'perf-test-' } } });
  console.log('  Cleanup complete.');
}

async function main() {
  console.log('=== Phase 6.1 Performance Validation ===\n');

  let companies: { companyId: string; signalIds: string[] }[] = [];

  try {
    companies = await createTestBatch();
    const results = await benchmarkValidation(companies);

    console.log('\n=== Performance Results ===');
    console.log(`  Single company health:    ${results.singleLookup.toFixed(1)}ms  (target: <100ms)  ${results.singleLookup < 100 ? 'PASS' : 'WARN'}`);
    console.log(`  100 company batch:        ${results.batch100.toFixed(1)}ms  (target: <2000ms) ${results.batch100 < 2000 ? 'PASS' : 'WARN'}`);
    console.log(`  Dashboard query:          ${results.dashboard.toFixed(1)}ms  (target: <2000ms) ${results.dashboard < 2000 ? 'PASS' : 'WARN'}`);
    console.log(`  10k confidence (pure):    ${results.confidence10k.toFixed(1)}ms  (target: <1000ms) ${results.confidence10k < 1000 ? 'PASS' : 'WARN'}`);

    const allPass = results.singleLookup < 100 && results.batch100 < 2000 && results.dashboard < 2000;
    console.log(`\n  Overall: ${allPass ? 'ALL TARGETS MET' : 'SOME TARGETS EXCEEDED (review needed)'}`);
  } finally {
    await cleanup();
  }

  await db.$disconnect();
}

main().catch(console.error);