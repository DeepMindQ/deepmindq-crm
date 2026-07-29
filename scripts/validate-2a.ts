/**
 * Phase 2A Validation Script
 *
 * Runs the intelligence collection pipeline against 3 target companies:
 *   1. Microsoft Corporation (Enterprise — information-rich)
 *   2. 6thstreet.com (Mid-market 200-500 — limited media coverage)
 *   3. Adyen (Mid-market 1001-5000 — moderate coverage)
 *
 * Measures: discovery, signal diversity, ranking quality, Intelligence Surprise Score
 */

import { db } from '../src/lib/db';
import { collectIntelligenceForCompany } from '../src/lib/intelligence-sources/external-intelligence-collector';
import { computeIntelligenceRanking, computeFreshnessState, SIGNAL_HALF_LIVES } from '../src/lib/scoring/freshness-ranking';

interface ValidationTarget {
  companyId: string;
  name: string;
  domain: string;
  sizeRange: string;
  tier: string;
}

const TARGETS: ValidationTarget[] = [
  {
    companyId: 'cms48ceju0000ozwbvsqt1xml',
    name: 'Microsoft Corporation',
    domain: 'microsoft.com',
    sizeRange: 'Enterprise',
    tier: 'Enterprise (10,000+)',
  },
  {
    companyId: '326a2c04c3a078a41e318371',
    name: '6thstreet.com',
    domain: '6thstreet.com',
    sizeRange: '201-500',
    tier: 'Mid-Market (200-500)',
  },
  {
    companyId: '2ac0db6261fa455e93d37d51',
    name: 'Adyen',
    domain: 'adyen.com',
    sizeRange: '1,001-5,000',
    tier: 'Mid-Market (1001-5000)',
  },
];

async function validateCompany(target: ValidationTarget) {
  console.log(`\n${'═'.repeat(80)}`);
  console.log(`  VALIDATING: ${target.name}`);
  console.log(`  Tier: ${target.tier} | Domain: ${target.domain}`);
  console.log(`${'═'.repeat(80)}`);

  // Step 1: Collect intelligence
  console.log('\n📡 Step 1: Running intelligence collection...');
  const result = await collectIntelligenceForCompany(target.companyId, 5);
  
  console.log(`   Queries executed: ~5 (size-adaptive)`);
  console.log(`   Total results found: ${result.totalSearched}`);
  console.log(`   Evidence stored: ${result.evidenceCollected}`);
  console.log(`   Signals created: ${result.signalsCreated}`);
  console.log(`   Signals skipped (dup/no-match): ${result.signalsSkipped}`);
  if (result.errors.length > 0) {
    console.log(`   ⚠️ Errors: ${result.errors.slice(0, 3).join('; ')}`);
  }
  console.log(`   Duration: ${(result.duration / 1000).toFixed(1)}s`);

  // Step 2: Analyze signals
  console.log('\n📊 Step 2: Analyzing collected signals...');
  const signals = await db.companySignal.findMany({
    where: {
      companyId: target.companyId,
      status: { notIn: ['archived', 'expired'] },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  console.log(`   Active signals in DB: ${signals.length}`);

  // Step 3: Signal type diversity
  console.log('\n🎯 Step 3: Signal type diversity...');
  const typeCounts: Record<string, number> = {};
  for (const s of signals) {
    typeCounts[s.signalType] = (typeCounts[s.signalType] || 0) + 1;
  }
  
  const diversity = Object.keys(typeCounts).length;
  console.log(`   Unique signal types: ${diversity}`);
  for (const [type, count] of Object.entries(typeCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`     • ${type}: ${count}`);
  }

  // Step 4: Ranking analysis
  console.log('\n🏆 Step 4: Intelligence Ranking (top 10)...');
  const ranked = signals.map(s => {
    const ranking = computeIntelligenceRanking({
      confidence: Math.round((s.confidence ?? 0.5) * 100),
      signalDate: s.signalDate?.toISOString?.() ?? null,
      createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : String(s.createdAt),
      signalType: s.signalType,
      sourceQuality: s.sourceQuality || 'standard',
      businessRelevance: 0.6,
      capabilityRelevance: 0.4,
    });
    return { signal: s, ranking };
  }).sort((a, b) => b.ranking.rankingScore - a.ranking.rankingScore);

  for (let i = 0; i < Math.min(10, ranked.length); i++) {
    const { signal, ranking } = ranked[i];
    const freshness = computeFreshnessState(
      signal.signalDate?.toISOString?.() ?? null,
      signal.createdAt instanceof Date ? signal.createdAt.toISOString() : String(signal.createdAt),
      signal.signalType
    );
    console.log(`   ${i + 1}. [${ranking.rankingScore}/100] ${signal.signalType} — "${signal.title.substring(0, 70)}..."`);
    console.log(`      Confidence: ${ranking.breakdown.confidenceScore} | Freshness: ${ranking.breakdown.freshnessScore} | Source: ${ranking.breakdown.sourceQualityScore}`);
    console.log(`      Staleness: ${freshness.staleness} (${freshness.daysSinceSignal}d old, half-life: ${freshness.halfLife}d)`);
    console.log(`      Action: ${(signal.recommendedAction || '').substring(0, 80)}...`);
    console.log('');
  }

  // Step 5: Intelligence Surprise Score estimation
  console.log('\n🧠 Step 5: Intelligence Surprise Score Assessment');
  console.log('   (1=obvious, 5=valuable discovery — manual evaluation needed)');
  console.log('   For each top signal, rate: Would a salesperson already know this?');
  
  for (let i = 0; i < Math.min(5, ranked.length); i++) {
    const { signal, ranking } = ranked[i];
    const isObvious = 
      signal.signalType === 'news' && signal.severity === 'medium' ? 'Likely obvious' :
      signal.signalType === 'people_change' || signal.signalType === 'technology_adoption' ? 'Possibly surprising' :
      signal.signalType === 'acquisition' || signal.signalType === 'funding' ? 'Possibly obvious (if widely reported)' :
      'Depends on salesperson awareness';
    
    console.log(`   ${i + 1}. "${signal.title.substring(0, 60)}..."`);
    console.log(`      Type: ${signal.signalType} | Obvious?: ${isObvious}`);
  }

  // Summary
  console.log(`\n📋 Summary for ${target.name}:`);
  console.log(`   Signals discovered: ${signals.length}`);
  console.log(`   Type diversity: ${diversity}/10 types`);
  console.log(`   Top ranking score: ${ranked[0]?.ranking.rankingScore ?? 0}/100`);
  console.log(`   Avg ranking score: ${ranked.length > 0 ? Math.round(ranked.reduce((s, r) => s + r.ranking.rankingScore, 0) / ranked.length) : 0}/100`);

  return { signals, ranked, diversity };
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║          Phase 2A Intelligence Engine — Validation Run                       ║');
  console.log('║          Testing: Discovery | Classification | Ranking | Diversity            ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝');
  
  const totalStart = Date.now();
  const results: any[] = [];

  for (const target of TARGETS) {
    try {
      const result = await validateCompany(target);
      results.push({ target, ...result });
    } catch (error) {
      console.error(`\n❌ FAILED for ${target.name}:`, error);
      results.push({ target, error: String(error) });
    }
  }

  // Final cross-company comparison
  console.log(`\n\n${'═'.repeat(80)}`);
  console.log('  CROSS-COMPANY COMPARISON');
  console.log(`${'═'.repeat(80)}`);
  
  for (const r of results) {
    if (r.error) {
      console.log(`   ❌ ${r.target.name}: FAILED`);
    } else {
      console.log(`   ✅ ${r.target.name} (${r.target.tier})`);
      console.log(`      Signals: ${r.signals.length} | Types: ${r.diversity}/10 | Top Score: ${r.ranked[0]?.ranking.rankingScore ?? 0}/100`);
    }
  }

  const totalDuration = ((Date.now() - totalStart) / 1000).toFixed(1);
  console.log(`\n⏱️ Total validation duration: ${totalDuration}s`);
  console.log('\n✅ Phase 2A Validation complete.');
  
  await db.$disconnect();
}

main().catch(e => {
  console.error('Validation failed:', e);
  process.exit(1);
});
