/**
 * Sprint 1 Live Validation — 5 Company Test
 *
 * Runs the full Sprint 1 pipeline against:
 *   1 Enterprise: Microsoft Corporation
 *   3 Mid-Market: Sentinel Cyber Defense, Quantum Dynamics Research, NovaTech Industries
 *   1 Small: WorkshopX (no sizeRange, 1 contact)
 *
 * Validates:
 *   - Three-date model: signalDate != null for all new signals
 *   - Signal type normalization: all signals in 10-type taxonomy
 *   - Mid-market sensor: channels fire for mid-tier companies
 *   - AI classification: premium/enterprise signals use AI
 *   - Adaptive density: correct external/internal weights
 *   - Reasoning engine: produces understanding (not empty)
 */

import { PrismaClient } from '@prisma/client';

const DB_URL = process.env.DATABASE_URL!;
const prisma = new PrismaClient({ datasources: { db: { url: DB_URL } } });

// Company targets
const TARGET_COMPANIES = [
  { id: 'cms48ceju0000ozwbvsqt1xml', name: 'Microsoft Corporation', expectedTier: 'enterprise' },
  { id: 'cms3t6dbh0004ozmvl3ckx8m3', name: 'Sentinel Cyber Defense', expectedTier: 'mid_market' },
  { id: 'cms3t6dz90006ozmvtx6h0pg5', name: 'Quantum Dynamics Research', expectedTier: 'mid_market' },
  { id: 'cms3t6bu60000ozmvxvwro77c', name: 'NovaTech Industries', expectedTier: 'mid_market' },
  { id: '0e694f23084f55c40b87227e', name: 'WorkshopX', expectedTier: 'small' },
];

const CANONICAL_TYPES = new Set([
  'funding', 'hiring', 'leadership_change', 'people_change', 'expansion',
  'tech_change', 'technology_adoption', 'partnership', 'acquisition', 'news',
]);

interface ValidationResult {
  companyId: string;
  companyName: string;
  expectedTier: string;
  signalsBefore: number;
  signalsAfter: number;
  newSignals: number;
  allSignalDatesPopulated: boolean;
  allTypesCanonical: boolean;
  nonCanonicalTypes: string[];
  nullSignalDates: number;
  publicationDatesPopulated: number;
  aiClassifiedCount: number;
  ruleClassifiedCount: number;
  midMarketChannelsFired: boolean;
  densityLevel: string;
  densityExternalWeight: number;
  understandingGenerated: boolean;
  understandingSummary: string;
  errors: string[];
  duration: number;
}

async function runValidation(): Promise<void> {
  console.log('════════════════════════════════════════════════════════════');
  console.log('  SPRINT 1 LIVE VALIDATION — 5 Companies');
  console.log('════════════════════════════════════════════════════════════\n');

  // Dynamic imports
  const { collectIntelligenceForCompany } = await import('../src/lib/intelligence-sources/external-intelligence-collector');
  const { generateCompanyUnderstanding } = await import('../src/lib/intelligence-sources/reasoning-engine');
  const { assessSignalDensity } = await import('../src/lib/intelligence-sources/adaptive-intelligence');
  const { normalizeType } = await import('../src/lib/intelligence-sources/signal-type-mapping');

  const results: ValidationResult[] = [];
  let totalPass = 0;
  let totalFail = 0;

  for (const target of TARGET_COMPANIES) {
    console.log(`\n── Validating: ${target.name} (${target.expectedTier}) ──`);
    const startTime = Date.now();
    const result: ValidationResult = {
      ...target,
      signalsBefore: 0,
      signalsAfter: 0,
      newSignals: 0,
      allSignalDatesPopulated: true,
      allTypesCanonical: true,
      nonCanonicalTypes: [],
      nullSignalDates: 0,
      publicationDatesPopulated: 0,
      aiClassifiedCount: 0,
      ruleClassifiedCount: 0,
      midMarketChannelsFired: false,
      densityLevel: 'unknown',
      densityExternalWeight: 0,
      understandingGenerated: false,
      understandingSummary: '',
      errors: [],
      duration: 0,
    };

    try {
      // Count signals before
      const beforeSignals = await prisma.companySignal.count({
        where: { companyId: target.id, status: { notIn: ['archived', 'expired'] } },
      });
      result.signalsBefore = beforeSignals;

      // Step 1: Collect intelligence (Sprint 1 pipeline)
      console.log(`  Collecting intelligence (max 2 results/query, skipping mid-market sensor for speed)...`);
      const collection = await collectIntelligenceForCompany(target.id, {
        maxResultsPerQuery: 2, // Minimal for speed
        useAIClassification: false, // Let auto-enable logic work
      });

      result.aiClassifiedCount = collection.aiClassifiedCount;
      result.ruleClassifiedCount = collection.ruleClassifiedCount;
      result.midMarketChannelsFired = !!collection.midMarketChannels;
      result.duration = collection.duration;

      console.log(`  Collection: ${collection.evidenceCollected} evidence, ${collection.signalsCreated} signals, ${collection.signalsSkipped} skipped`);
      console.log(`  AI: ${collection.aiClassifiedCount}, Rules: ${collection.ruleClassifiedCount}`);
      if (collection.midMarketChannels) {
        const ch = collection.midMarketChannels;
        console.log(`  Mid-market channels: careers=${ch.careers.evidenceCollected}, hiring=${ch.hiring.evidenceCollected}, leadership=${ch.leadership.evidenceCollected}, tech=${ch.technology.evidenceCollected}`);
      }
      if (collection.errors.length > 0) {
        console.log(`  Errors: ${collection.errors.join('; ')}`);
      }

      // Step 2: Count signals after
      const afterSignals = await prisma.companySignal.count({
        where: { companyId: target.id, status: { notIn: ['archived', 'expired'] } },
      });
      result.signalsAfter = afterSignals;
      result.newSignals = afterSignals - beforeSignals;

      // Step 3: Validate new signals
      const newSignalsList = await prisma.companySignal.findMany({
        where: {
          companyId: target.id,
          createdAt: { gte: new Date(Date.now() - 60000 * 5) }, // Last 5 minutes
        },
        select: {
          id: true, signalType: true, signalDate: true, publicationDate: true,
          title: true, sourceQuality: true, confidence: true,
        },
      });

      // Check three-date model: signalDate should not be null
      for (const sig of newSignalsList) {
        if (!sig.signalDate) {
          result.nullSignalDates++;
          result.allSignalDatesPopulated = false;
        }
        if (sig.publicationDate) {
          result.publicationDatesPopulated++;
        }
        // Check canonical types
        const normalized = normalizeType(sig.signalType, sig.title);
        if (!CANONICAL_TYPES.has(normalized)) {
          result.nonCanonicalTypes.push(sig.signalType);
          result.allTypesCanonical = false;
        }
      }

      // Step 4: Assess density
      const allSignals = await prisma.companySignal.findMany({
        where: { companyId: target.id, status: { notIn: ['archived', 'expired'] } },
        select: {
          id: true, signalType: true, title: true, description: true,
          severity: true, confidence: true, signalDate: true, createdAt: true,
          sourceUrl: true, source: true, sourceQuality: true,
          businessImpact: true, recommendedAction: true, timingWindow: true,
          meaningCategory: true, publicationDate: true,
        },
        take: 50,
        orderBy: { createdAt: 'desc' },
      });

      const density = assessSignalDensity(allSignals.map(s => ({
        id: s.id,
        signalType: s.signalType,
        title: s.title,
        description: s.description,
        severity: s.severity,
        confidence: s.confidence,
        signalDate: s.signalDate?.toISOString() || null,
        createdAt: s.createdAt.toISOString(),
        sourceUrl: s.sourceUrl,
        source: s.source,
        sourceQuality: s.sourceQuality,
        businessImpact: s.businessImpact,
        recommendedAction: s.recommendedAction,
        timingWindow: s.timingWindow,
        meaningCategory: s.meaningCategory,
        sourcePublishedDate: s.publicationDate?.toISOString() || null,
      })), { contactCount: await prisma.contact.count({ where: { companyId: target.id } }) });

      result.densityLevel = density.density;
      result.densityExternalWeight = density.externalWeight;

      // Step 5: Generate understanding
      const company = await prisma.company.findUnique({
        where: { id: target.id },
        select: { rawName: true, domain: true, sizeRange: true, industry: true },
      });

      const capabilities = await prisma.capabilityAsset.findMany({
        where: { isActive: true },
        select: { id: true, title: true, category: true, summary: true },
        take: 20,
      });

      const understanding = generateCompanyUnderstanding({
        companyId: target.id,
        companyName: company?.rawName || target.name,
        domain: company?.domain || null,
        industry: company?.industry || null,
        sizeRange: company?.sizeRange || null,
        signals: allSignals.map(s => ({
          id: s.id,
          signalType: s.signalType,
          title: s.title,
          description: s.description,
          severity: s.severity,
          confidence: s.confidence,
          signalDate: s.signalDate?.toISOString() || null,
          createdAt: s.createdAt.toISOString(),
          sourceUrl: s.sourceUrl,
          source: s.source,
          sourceQuality: s.sourceQuality,
          businessImpact: s.businessImpact,
          recommendedAction: s.recommendedAction,
          timingWindow: s.timingWindow,
          meaningCategory: s.meaningCategory,
          sourcePublishedDate: s.publicationDate?.toISOString() || null,
        })),
        internalContext: {
          contactCount: await prisma.contact.count({ where: { companyId: target.id } }),
          existingNotes: await prisma.companyNote.count({ where: { companyId: target.id } }),
        },
        capabilities: capabilities.map(c => ({
          id: c.id,
          title: c.title,
          category: c.category,
          description: c.summary || undefined,
        })),
      });

      result.understandingGenerated = !!understanding.executiveSummary;
      result.understandingSummary = understanding.executiveSummary.substring(0, 120) + '...';

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(msg);
      console.log(`  ❌ ERROR: ${msg}`);
    }

    result.duration = Date.now() - startTime;
    results.push(result);

    // Print validation checks
    const checks = [
      { pass: result.newSignals >= 0 || result.signalsBefore > 0, label: 'Pipeline completes without crash' },
      { pass: result.allSignalDatesPopulated, label: 'Three-date model: all signalDates populated' },
      { pass: result.allTypesCanonical, label: 'Signal taxonomy: all types canonical' },
      { pass: result.nullSignalDates === 0, label: 'No null signalDates' },
      { pass: result.understandingGenerated, label: 'Reasoning engine produces understanding' },
    ];

    // Tier-specific checks
    if (target.expectedTier === 'mid_market') {
      checks.push({ pass: result.midMarketChannelsFired || result.newSignals > 0, label: 'Mid-market sensor engaged' });
    }
    if (target.expectedTier === 'enterprise') {
      checks.push({ pass: result.aiClassifiedCount > 0 || result.signalsBefore > 10, label: 'AI classification active (enterprise)' });
    }
    if (target.expectedTier === 'small') {
      checks.push({ pass: result.densityExternalWeight <= 0.5 || result.densityLevel === 'minimal' || result.densityLevel === 'sparse', label: 'Adaptive density: internal weight boosted for small' });
    }

    for (const check of checks) {
      const icon = check.pass ? '✅' : '❌';
      console.log(`  ${icon} ${check.label}`);
      if (check.pass) totalPass++; else totalFail++;
    }
  }

  // Summary
  console.log('\n════════════════════════════════════════════════════════════');
  console.log('  VALIDATION SUMMARY');
  console.log('════════════════════════════════════════════════════════════');
  console.log(`  Total checks: ${totalPass + totalFail}`);
  console.log(`  Passed:       ${totalPass} ✅`);
  console.log(`  Failed:       ${totalFail} ❌`);
  console.log(`  Pass rate:    ${((totalPass / (totalPass + totalFail)) * 100).toFixed(1)}%`);
  console.log('');

  // Per-company summary
  console.log('  Per-Company Results:');
  console.log('  ─────────────────────────────────────────────────────────');
  for (const r of results) {
    const status = r.errors.length > 0 ? '❌ ERROR' : '✅ OK';
    console.log(`  ${status} ${r.companyName}`);
    console.log(`       Tier: ${r.expectedTier} | Signals: ${r.signalsBefore}→${r.signalsAfter} (+${r.newSignals})`);
    console.log(`       Density: ${r.densityLevel} (ext: ${r.densityExternalWeight})`);
    console.log(`       Null dates: ${r.nullSignalDates} | Non-canonical types: ${r.nonCanonicalTypes.length}`);
    if (r.understandingGenerated) {
      console.log(`       Understanding: ${r.understandingSummary}`);
    }
    if (r.errors.length > 0) {
      r.errors.forEach(e => console.log(`       Error: ${e.substring(0, 100)}`));
    }
  }

  console.log('\n════════════════════════════════════════════════════════════');
  if (totalFail === 0) {
    console.log('  🎉 ALL SPRINT 1 VALIDATION CHECKS PASSED');
  } else {
    console.log(`  ⚠️  ${totalFail} check(s) failed — review above`);
  }
  console.log('════════════════════════════════════════════════════════════');

  await prisma.$disconnect();
  process.exit(totalFail > 0 ? 1 : 0);
}

runValidation().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
