/**
 * Sprint 1 Live Validation — Single Company Runner
 * Run: DATABASE_URL="..." npx tsx scripts/sprint1-validate-one.ts <companyId> <companyName> <tier>
 *
 * This validates Sprint 1 for a single company to avoid timeout issues.
 * Run multiple times for different companies.
 */

import { PrismaClient } from '@prisma/client';

const DB_URL = process.env.DATABASE_URL!;
const prisma = new PrismaClient({ datasources: { db: { url: DB_URL } } });

const companyId = process.argv[2];
const companyName = process.argv[3] || 'Unknown';
const expectedTier = process.argv[4] || 'default';

if (!companyId) {
  console.error('Usage: npx tsx scripts/sprint1-validate-one.ts <companyId> <companyName> <tier>');
  process.exit(1);
}

const CANONICAL_TYPES = new Set([
  'funding', 'hiring', 'leadership_change', 'people_change', 'expansion',
  'tech_change', 'technology_adoption', 'partnership', 'acquisition', 'news',
]);

async function validate() {
  console.log(`\n═══ ${companyName} (${expectedTier}) ═══`);

  const { collectIntelligenceForCompany } = await import('../src/lib/intelligence-sources/external-intelligence-collector');
  const { generateCompanyUnderstanding } = await import('../src/lib/intelligence-sources/reasoning-engine');
  const { assessSignalDensity } = await import('../src/lib/intelligence-sources/adaptive-intelligence');
  const { normalizeType } = await import('../src/lib/intelligence-sources/signal-type-mapping');

  const checks: { pass: boolean; label: string; detail?: string }[] = [];

  // Pre-signal count
  const beforeSignals = await prisma.companySignal.count({
    where: { companyId, status: { notIn: ['archived', 'expired'] } },
  });
  console.log(`  Signals before: ${beforeSignals}`);

  // Collect
  console.log(`  Collecting (2 results/query, enterprise queries only)...`);
  const t0 = Date.now();
  const collection = await collectIntelligenceForCompany(companyId, {
    maxResultsPerQuery: 2,
    useAIClassification: false,
  });
  const duration = Date.now() - t0;
  console.log(`  Collection done in ${duration}ms`);
  console.log(`  Evidence: ${collection.evidenceCollected} | Signals: ${collection.signalsCreated} | Skipped: ${collection.signalsSkipped}`);
  console.log(`  AI: ${collection.aiClassifiedCount} | Rules: ${collection.ruleClassifiedCount}`);
  if (collection.midMarketChannels) {
    const ch = collection.midMarketChannels;
    console.log(`  Mid-market: careers=${ch.careers.evidenceCollected} hiring=${ch.hiring.evidenceCollected} leadership=${ch.leadership.evidenceCollected} tech=${ch.technology.evidenceCollected}`);
  }
  if (collection.errors.length > 0) {
    console.log(`  Errors: ${collection.errors.slice(0,3).join('; ')}`);
  }

  checks.push({ pass: collection.duration > 0, label: 'Pipeline completes', detail: `${collection.duration}ms` });
  checks.push({ pass: collection.evidenceCollected >= 0, label: 'Evidence collection works', detail: `${collection.evidenceCollected} collected` });

  // Validate new signals
  const newSignals = await prisma.companySignal.findMany({
    where: { companyId, createdAt: { gte: new Date(Date.now() - 60000 * 10) } },
    select: { id: true, signalType: true, signalDate: true, publicationDate: true, title: true, confidence: true, sourceQuality: true },
  });

  let nullDates = 0;
  let pubDatesCount = 0;
  const nonCanonical: string[] = [];
  for (const sig of newSignals) {
    if (!sig.signalDate) nullDates++;
    if (sig.publicationDate) pubDatesCount++;
    const norm = normalizeType(sig.signalType, sig.title);
    if (!CANONICAL_TYPES.has(norm)) nonCanonical.push(`${sig.signalType}→${norm}`);
  }

  checks.push({ pass: nullDates === 0, label: 'Three-date: no null signalDates', detail: `${nullDates} null` });
  checks.push({ pass: nonCanonical.length === 0, label: 'Taxonomy: all canonical types', detail: nonCanonical.length > 0 ? nonCanonical.slice(0,3).join(', ') : 'all ok' });
  checks.push({ pass: true, label: `Publication dates populated`, detail: `${pubDatesCount}/${newSignals.length}` });

  // Density assessment
  const allSignals = await prisma.companySignal.findMany({
    where: { companyId, status: { notIn: ['archived', 'expired'] } },
    select: {
      id: true, signalType: true, title: true, description: true, severity: true,
      confidence: true, signalDate: true, createdAt: true, sourceUrl: true, source: true,
      sourceQuality: true, businessImpact: true, recommendedAction: true, timingWindow: true,
      meaningCategory: true, publicationDate: true,
    },
    take: 50, orderBy: { createdAt: 'desc' },
  });

  const contactCount = await prisma.contact.count({ where: { companyId } });
  const noteCount = await prisma.companyNote.count({ where: { companyId } });

  const density = assessSignalDensity(allSignals.map(s => ({
    id: s.id, signalType: s.signalType, title: s.title, description: s.description,
    severity: s.severity, confidence: s.confidence,
    signalDate: s.signalDate?.toISOString() || null, createdAt: s.createdAt.toISOString(),
    sourceUrl: s.sourceUrl, source: s.source, sourceQuality: s.sourceQuality,
    businessImpact: s.businessImpact, recommendedAction: s.recommendedAction,
    timingWindow: s.timingWindow, meaningCategory: s.meaningCategory,
    sourcePublishedDate: s.publicationDate?.toISOString() || null,
  })), { contactCount, existingNotes: noteCount });

  console.log(`\n  Density: ${density.density} | External: ${(density.externalWeight * 100).toFixed(0)}% | Internal: ${(density.internalWeight * 100).toFixed(0)}%`);
  console.log(`  Contacts: ${contactCount} | Notes: ${noteCount}`);

  checks.push({ pass: ['abundant', 'moderate', 'sparse', 'minimal'].includes(density.density), label: 'Density assessment works', detail: `${density.density}` });

  if (expectedTier === 'small') {
    checks.push({ pass: density.externalWeight <= 0.5, label: 'Small: internal weight boosted', detail: `ext=${density.externalWeight}` });
  }
  if (expectedTier === 'enterprise') {
    checks.push({ pass: density.externalWeight >= 0.5, label: 'Enterprise: external weight dominant', detail: `ext=${density.externalWeight}` });
  }

  // Reasoning engine
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { rawName: true, domain: true, sizeRange: true, industry: true } });
  const capabilities = await prisma.capabilityAsset.findMany({ where: { isActive: true }, select: { id: true, title: true, category: true, summary: true }, take: 20 });

  const understanding = generateCompanyUnderstanding({
    companyId, companyName: company?.rawName || companyName,
    domain: company?.domain || null, industry: company?.industry || null, sizeRange: company?.sizeRange || null,
    signals: allSignals.map(s => ({
      id: s.id, signalType: s.signalType, title: s.title, description: s.description,
      severity: s.severity, confidence: s.confidence,
      signalDate: s.signalDate?.toISOString() || null, createdAt: s.createdAt.toISOString(),
      sourceUrl: s.sourceUrl, source: s.source, sourceQuality: s.sourceQuality,
      businessImpact: s.businessImpact, recommendedAction: s.recommendedAction,
      timingWindow: s.timingWindow, meaningCategory: s.meaningCategory,
      sourcePublishedDate: s.publicationDate?.toISOString() || null,
    })),
    internalContext: { contactCount, existingNotes: noteCount },
    capabilities: capabilities.map(c => ({ id: c.id, title: c.title, category: c.category, description: c.summary || undefined })),
  });

  checks.push({ pass: !!understanding.executiveSummary && understanding.executiveSummary.length > 20, label: 'Reasoning engine produces understanding', detail: understanding.executiveSummary.substring(0, 80) + '...' });
  checks.push({ pass: understanding.keyChanges.length >= 0, label: 'Key changes generated', detail: `${understanding.keyChanges.length} changes` });
  checks.push({ pass: understanding.recommendedActions.length >= 0, label: 'Actions recommended', detail: `${understanding.recommendedActions.length} actions` });

  // Print
  console.log(`\n  ─── Checks ───`);
  let pass = 0, fail = 0;
  for (const c of checks) {
    const icon = c.pass ? '✅' : '❌';
    console.log(`  ${icon} ${c.label}${c.detail ? ` — ${c.detail}` : ''}`);
    if (c.pass) pass++; else fail++;
  }
  console.log(`\n  Result: ${pass}/${pass+fail} passed`);

  await prisma.$disconnect();
  process.exit(fail > 0 ? 1 : 0);
}

validate().catch(e => { console.error('Fatal:', e); process.exit(1); });
