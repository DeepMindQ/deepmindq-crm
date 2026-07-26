/**
 * Engine Smoke Test
 * =================
 *
 * Verifies that all 4 Phase B Session 1 engines load, expose the correct
 * API surface, and handle missing data gracefully (non-throwing).
 *
 * Run with: npx tsx scripts/test-engines-smoke.ts
 */

import { ModelRouter, GroundingEngine, RetrievalEngine, SynthesisEngine } from '../src/lib/engines';

async function main() {
  console.log('\n=== Phase B Session 1 — Engine Smoke Test ===\n');

  let passed = 0;
  let failed = 0;

  function check(label: string, condition: boolean, detail?: string) {
    if (condition) {
      console.log(`  ✓ ${label}${detail ? ' — ' + detail : ''}`);
      passed++;
    } else {
      console.log(`  ✗ ${label}${detail ? ' — ' + detail : ''}`);
      failed++;
    }
  }

  // ─── ModelRouter ──────────────────────────────────────────────────
  console.log('ModelRouter:');
  try {
    const health = await ModelRouter.health();
    check('health() returns deep/smart/fast availability', typeof health.deep === 'boolean');
    check('health() returns provider count', typeof health.providers === 'number');
    check('health() returns details array', Array.isArray(health.details));
  } catch (err) {
    check('ModelRouter.health() does not throw', false, err instanceof Error ? err.message : String(err));
  }

  // ─── GroundingEngine ─────────────────────────────────────────────
  console.log('\nGroundingEngine:');
  try {
    const chain = await GroundingEngine.collect({});
    check('collect({}) returns empty chain', chain.evidences.length === 0);
    check('collect({}) has gaps array', Array.isArray(chain.gaps) && chain.gaps.length > 0);
    check('collect({}) returns aggregateConfidence', typeof chain.aggregateConfidence === 'number');
    check('collect({}) returns coverage', typeof chain.coverage === 'number');
    check('collect({}) returns freshnessScore', typeof chain.freshnessScore === 'number');
    check('collect({}) returns builtAt ISO string', typeof chain.builtAt === 'string' && chain.builtAt.includes('T'));
    check('collect({}) returns context object', typeof chain.context === 'object');
    check('collect({}) is non-throwing (error is null or string)', chain.error === null || typeof chain.error === 'string');
  } catch (err) {
    check('GroundingEngine.collect({}) does not throw', false, err instanceof Error ? err.message : String(err));
  }

  // ─── RetrievalEngine ─────────────────────────────────────────────
  console.log('\nRetrievalEngine:');
  try {
    const results = await RetrievalEngine.search('');
    check('search("") returns empty array', Array.isArray(results) && results.length === 0);
  } catch (err) {
    check('RetrievalEngine.search("") does not throw', false, err instanceof Error ? err.message : String(err));
  }

  try {
    const stats = await RetrievalEngine.getStats();
    check('getStats() returns stats object', typeof stats === 'object');
    check('getStats() returns backend field', ['transformer', 'tfidf', 'empty'].includes(stats.backend));
  } catch (err) {
    check('RetrievalEngine.getStats() does not throw', false, err instanceof Error ? err.message : String(err));
  }

  // ─── SynthesisEngine ─────────────────────────────────────────────
  console.log('\nSynthesisEngine:');
  try {
    const brief = await SynthesisEngine.generate({
      briefType: 'account_brief',
      context: {},
    });
    check('generate({}) returns brief object', typeof brief === 'object');
    check('generate({}) returns success=false on no evidence', brief.success === false);
    check('generate({}) returns error="insufficient_evidence"', brief.error === 'insufficient_evidence');
    check('generate({}) returns evidenceChain', typeof brief.evidenceChain === 'object');
    check('generate({}) returns gaps array', Array.isArray(brief.gaps));
    check('generate({}) returns warnings array', Array.isArray(brief.warnings));
    check('generate({}) returns wordCount=0', brief.wordCount === 0);
  } catch (err) {
    check('SynthesisEngine.generate({}) does not throw', false, err instanceof Error ? err.message : String(err));
  }

  // ─── Summary ─────────────────────────────────────────────────────
  console.log('\n=== Summary ===');
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  if (failed > 0) {
    console.log('\n❌ Some tests failed.');
    process.exit(1);
  } else {
    console.log('\n✓ All 4 engine smoke tests passed.');
  }
}

main().catch((err) => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
