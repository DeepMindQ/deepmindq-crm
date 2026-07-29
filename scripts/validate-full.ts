/**
 * Full Phase 2A+2B+2C Validation
 * Tests: Collection → Classification → Ranking → Correlation → Prediction → Monitoring
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const TARGETS = [
  { companyId: 'cms48ceju0000ozwbvsqt1xml', name: 'Microsoft Corporation', tier: 'Enterprise (10k+)' },
  { companyId: '326a2c04c3a078a41e318371', name: '6thstreet.com', tier: 'Mid-Market (200-500)' },
  { companyId: '2ac0db6261fa455e93d37d51', name: 'Adyen', tier: 'Mid-Market (1001-5000)' },
];

async function main() {
  console.log('='.repeat(80));
  console.log('  Phase 2A + 2B + 2C — Full Pipeline Validation');
  console.log('='.repeat(80));

  for (const target of TARGETS) {
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`  ${target.name} (${target.tier})`);
    console.log(`${'─'.repeat(80)}`);

    // Phase 2A: Collect
    console.log('\n[2A] Collecting intelligence...');
    const { collectIntelligenceForCompany } = await import('../src/lib/intelligence-sources/external-intelligence-collector');
    const start = Date.now();
    const result = await collectIntelligenceForCompany(target.companyId, 5);
    console.log(`  Results: ${result.totalSearched} found | ${result.signalsCreated} signals | ${result.signalsSkipped} skipped | ${(Date.now()-start)/1000}s`);

    // Phase 2A: Analyze signals
    const signals = await prisma.companySignal.findMany({
      where: { companyId: target.companyId, status: { notIn: ['archived', 'expired'] } },
      orderBy: { createdAt: 'desc' }, take: 30,
    });

    const typeCounts: Record<string, number> = {};
    signals.forEach(s => { typeCounts[s.signalType] = (typeCounts[s.signalType] || 0) + 1; });
    console.log(`  Signal types: ${Object.entries(typeCounts).map(([t,c]) => `${t}(${c})`).join(', ') || 'none'}`);

    // Phase 2A: Ranking
    const { computeIntelligenceRanking } = await import('../src/lib/scoring/freshness-ranking');
    const ranked = signals.slice(0, 5).map(s => {
      const r = computeIntelligenceRanking({
        confidence: Math.round((s.confidence ?? 0.5) * 100),
        signalDate: s.signalDate?.toISOString?.() ?? null,
        createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : String(s.createdAt),
        signalType: s.signalType, sourceQuality: s.sourceQuality || 'standard',
        businessRelevance: 0.6, capabilityRelevance: 0.4,
      });
      return { title: s.title.substring(0, 60), type: s.signalType, score: r.rankingScore, freshness: r.freshness.staleness };
    });
    console.log(`  Top 5 ranked: ${ranked.map(r => `[${r.score}] ${r.type}: "${r.title}..." (${r.freshness})`).join(' | ')}`);

    // Phase 2B: Correlations
    console.log('\n[2B] Cross-signal correlations...');
    const { detectCorrelations } = await import('../src/lib/intelligence-sources/cross-signal-correlation');
    const correlations = detectCorrelations(signals);
    if (correlations.length > 0) {
      correlations.forEach(c => console.log(`  ✅ ${c.pattern}: ${c.description} (confidence: ${c.confidence}, ${c.signalCount} signals)`));
    } else {
      console.log('  No correlations detected (need 2+ signals of different types)');
    }

    // Phase 2C: Predictions
    console.log('\n[2C] Predictive intelligence...');
    const { generatePredictions } = await import('../src/lib/intelligence-sources/predictive-intelligence');
    const predictions = generatePredictions(signals);
    if (predictions.length > 0) {
      predictions.forEach(p => console.log(`  ✅ ${p.type}: ${p.description} (confidence: ${p.confidence}, ${p.timeframe})`));
    } else {
      console.log('  No predictions (need 3+ signals with patterns)');
    }

    // Phase 2C: Monitoring
    console.log('\n[2C] Autonomous monitoring...');
    const { runMonitoringCheck } = await import('../src/lib/intelligence-sources/autonomous-monitor');
    const alerts = await runMonitoringCheck(target.companyId);
    if (alerts.length > 0) {
      alerts.forEach(a => console.log(`  ${a.severity === 'critical' ? '🔴' : a.severity === 'urgent' ? '🟠' : a.severity === 'warning' ? '🟡' : '🟢'} ${a.type}: ${a.title}`));
    } else {
      console.log('  No alerts');
    }

    console.log(`\n  Total signals: ${signals.length} | Types: ${Object.keys(typeCounts).length} | Correlations: ${correlations.length} | Predictions: ${predictions.length} | Alerts: ${alerts.length}`);
  }

  // Cross-account
  console.log(`\n${'─'.repeat(80)}`);
  console.log('[2C] Cross-account intelligence (all 3 companies)...');
  const { detectCrossAccountPatterns } = await import('../src/lib/intelligence-sources/cross-account-intelligence');
  const allSignals = await prisma.companySignal.findMany({
    where: { companyId: { in: TARGETS.map(t => t.companyId) }, status: { notIn: ['archived', 'expired'] } },
    orderBy: { createdAt: 'desc' }, take: 100,
  });
  const companies = await prisma.company.findMany({ where: { id: { in: TARGETS.map(t => t.companyId) } }, select: { id: true, rawName: true, industry: true } });
  const companyMap = new Map(companies.map(c => [c.id, c]));
  const patterns = detectCrossAccountPatterns(allSignals.map(s => ({
    companyId: s.companyId, companyName: companyMap.get(s.companyId)?.rawName || 'Unknown',
    industry: companyMap.get(s.companyId)?.industry || null,
    signalType: s.signalType, title: s.title, createdAt: s.createdAt, confidence: s.confidence,
  })));
  if (patterns.length > 0) {
    patterns.forEach(p => console.log(`  ✅ ${p.pattern}: ${p.description}`));
  } else {
    console.log('  No cross-account patterns (need 5+ signals across accounts)');
  }

  console.log('\n' + '='.repeat(80));
  console.log('  ✅ Full pipeline validation complete');
  console.log('='.repeat(80));
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
