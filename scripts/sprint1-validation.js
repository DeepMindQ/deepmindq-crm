/**
 * Sprint 1 Validation Script
 * 
 * Runs the Sprint 1 intelligence pipeline against 5 validation companies:
 *   1. Microsoft Corporation (Enterprise)
 *   2. Sentinel Cyber Defense (Mid-market 1,000-5,000)
 *   3. Quantum Dynamics Research (Mid-market 1,000-5,000)
 *   4. 6Thstreet.Com (Mid-market 201-500)
 *   5. 10x ten x (Small Nov-50)
 */

const { PrismaClient } = require('@prisma/client');
const { collectIntelligenceForCompany } = require('../src/lib/intelligence-sources/external-intelligence-collector');
const { generateCompanyUnderstanding } = require('../src/lib/intelligence-sources/reasoning-engine');
const { assessSignalDensity } = require('../src/lib/intelligence-sources/adaptive-intelligence');
const { normalizeSignalType } = require('../src/lib/intelligence-sources/signal-type-mapping');
const { detectCorrelations } = require('../src/lib/intelligence-sources/cross-signal-correlation');
const { generatePredictions } = require('../src/lib/intelligence-sources/predictive-intelligence');

const db = new PrismaClient();

const VALIDATION_COMPANIES = [
  { id: 'cms48ceju0000ozwbvsqt1xml', name: 'Microsoft Corporation', tier: 'Enterprise' },
  { id: 'cms3t6dbh0004ozmvl3ckx8m3', name: 'Sentinel Cyber Defense', tier: 'Mid-Market (1,000-5,000)' },
  { id: 'cms3t6dz90006ozmvtx6h0pg5', name: 'Quantum Dynamics Research', tier: 'Mid-Market (1,000-5,000)' },
  { id: '326a2c04c3a078a41e318371', name: '6Thstreet.Com', tier: 'Mid-Market (201-500)' },
  { id: 'ef6f7e83113c89e9d4762783', name: '10x ten x', tier: 'Small (Nov-50)' },
];

async function validateCompany(target) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`  VALIDATING: ${target.name} (${target.tier})`);
  console.log(`${'='.repeat(70)}`);

  // Step 1: Collect intelligence (size-adaptive)
  console.log(`\n[1] Collecting intelligence...`);
  const startTime = Date.now();
  const collection = await collectIntelligenceForCompany(target.id, {
    maxResultsPerQuery: 5,
    useAIClassification: false, // Use rules for speed in validation
  });
  const collectionTime = Date.now() - startTime;

  console.log(`  Company size tier: ${collection.companySizeTier}`);
  console.log(`  Total searched: ${collection.totalSearched}`);
  console.log(`  Evidence collected: ${collection.evidenceCollected}`);
  console.log(`  Signals created: ${collection.signalsCreated}`);
  console.log(`  Signals skipped (dup): ${collection.signalsSkipped}`);
  console.log(`  Duration: ${collectionTime}ms`);
  if (collection.midMarketChannels) {
    console.log(`  Mid-market channels:`);
    for (const [channel, data] of Object.entries(collection.midMarketChannels)) {
      console.log(`    ${channel}: ${data.queriesRun} queries → ${data.evidenceCollected} evidence → ${data.signalsCreated} signals`);
    }
  }
  if (collection.errors.length > 0) {
    console.log(`  Errors: ${collection.errors.join('; ')}`);
  }

  // Step 2: Fetch all signals for reasoning + type mapping
  const signals = await db.companySignal.findMany({
    where: { companyId: target.id, status: { notIn: ['archived', 'expired'] } },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`\n[2] Signal Analysis (${signals.length} total signals)`);
  
  // Show type mapping results
  const typeMappingResults = {};
  for (const s of signals) {
    const mapping = normalizeSignalType(s.signalType, s.title, s.description || undefined);
    if (!typeMappingResults[mapping.originalType]) {
      typeMappingResults[mapping.originalType] = {
        normalizedTo: mapping.normalizedType,
        wasCanonical: mapping.wasCanonical,
        usedDirectMapping: mapping.usedDirectMapping,
        useContextualAnalysis: mapping.useContextualAnalysis,
        count: 0,
      };
    }
    typeMappingResults[mapping.originalType].count++;
  }

  console.log(`  Type mapping:`);
  for (const [original, mapping] of Object.entries(typeMappingResults)) {
    if (mapping.wasCanonical) continue; // Skip already-canonical types
    const arrow = mapping.normalizedTo !== original ? '→' : '≈';
    console.log(`    "${original}" ${arrow} "${mapping.normalizedTo}" (${mapping.count} signals, via ${mapping.useContextualAnalysis ? 'contextual' : mapping.usedDirectMapping ? 'direct' : 'fallback'})`);
  }

  // Step 3: Correlations (with type-normalized signals)
  const normalizedForCorrelation = signals.map(s => ({
    id: s.id,
    signalType: s.signalType,
    title: s.title,
    description: s.description,
    severity: s.severity,
    createdAt: s.createdAt,
    signalDate: s.signalDate,
    confidence: s.confidence,
  }));
  const correlations = detectCorrelations(normalizedForCorrelation);
  console.log(`\n[3] Correlations: ${correlations.length} detected`);
  for (const c of correlations) {
    console.log(`    ${c.pattern}: ${c.description} (confidence: ${c.confidence}, signals: ${c.signalCount})`);
  }

  // Step 4: Predictions
  const predictions = generatePredictions(normalizedForCorrelation);
  console.log(`\n[4] Predictions: ${predictions.length} detected`);
  for (const p of predictions) {
    console.log(`    ${p.type}: ${p.description} (confidence: ${p.confidence})`);
  }

  // Step 5: Signal density assessment
  const signalInputs = signals.map(s => ({
    id: s.id,
    signalType: s.signalType,
    title: s.title,
    description: s.description,
    severity: s.severity,
    confidence: s.confidence,
    signalDate: s.signalDate?.toISOString() || null,
    createdAt: s.createdAt.toISOString(),
    sourceQuality: s.sourceQuality,
  }));
  const density = assessSignalDensity(signalInputs);
  console.log(`\n[5] Intelligence Density: ${density.density}`);
  console.log(`    External weight: ${Math.round(density.externalWeight * 100)}%`);
  console.log(`    Internal weight: ${Math.round(density.internalWeight * 100)}%`);
  console.log(`    Recommendation: ${density.recommendation}`);

  return {
    target,
    collection,
    signalCount: signals.length,
    typeMappings: typeMappingResults,
    correlations: correlations.length,
    predictions: predictions.length,
    density: density.density,
  };
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('  DeepMindQ Sprint 1 — Validation Run');
  console.log('  Testing: Enterprise + Mid-Market + Small company tiers');
  console.log('╚════════════════════════════════════════════════════════════════╝');

  const results = [];
  
  // Process sequentially to avoid rate limits
  for (const target of VALIDATION_COMPANIES) {
    try {
      const result = await validateCompany(target);
      results.push(result);
      // Stagger between companies
      if (target !== VALIDATION_COMPANIES[VALIDATION_COMPANIES.length - 1]) {
        console.log('\n  [Waiting 5s before next company to respect rate limits...]');
        await new Promise(r => setTimeout(r, 5000));
      }
    } catch (error) {
      console.error(`\n  ERROR validating ${target.name}:`, error.message);
      results.push({ target, error: error.message });
    }
  }

  // Summary
  console.log(`\n\n${'═'.repeat(70)}`);
  console.log('  VALIDATION SUMMARY');
  console.log(`${'═'.repeat(70)}`);

  for (const r of results) {
    if (r.error) {
      console.log(`  ${r.target.name}: ERROR — ${r.error}`);
      continue;
    }
    console.log(`\n  ${r.target.name} (${r.target.tier})`);
    console.log(`    Collected: ${r.collection.evidenceCollected} evidence, ${r.collection.signalsCreated} signals (tier: ${r.collection.companySizeTier})`);
    console.log(`    Total signals in DB: ${r.signalCount}`);
    console.log(`    Type mappings applied: ${Object.keys(r.typeMappings).length}`);
    console.log(`    Correlations: ${r.correlations}`);
    console.log(`    Predictions: ${r.predictions}`);
    console.log(`    Density: ${r.density}`);
  }

  await db.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
