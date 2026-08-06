/**
 * M5 WOW #2 — Market Intelligence Discovery CLI
 *
 * Thin wrapper around the service in src/lib/market-discovery.ts.
 * Run with: npx tsx scripts/m5-wow2-market-discovery.ts [query] [maxResults]
 */

import { discoverMarket } from '../src/lib/market-discovery';

async function main() {
  const query = process.argv[2] ||
    'Find companies likely to buy AI modernization in Europe';
  const maxResults = parseInt(process.argv[3] || '10', 10);

  console.log(`\n╔══════════════════════════════════════════════════════╗`);
  console.log(`║  M5 WOW #2 — Market Intelligence Discovery         ║`);
  console.log(`╚══════════════════════════════════════════════════════╝\n`);
  console.log(`Query: "${query}"\n`);

  const result = await discoverMarket(query, maxResults);

  console.log(`Found ${result.results.length} results in ${result.latencyMs}ms\n`);

  for (const r of result.results) {
    console.log(`┌─ ${r.companyName} (${r.matchScore}/100)`);
    console.log(`│  Industry: ${r.industry || 'N/A'} | Location: ${r.country || r.location || 'N/A'} | Size: ${r.sizeRange || 'N/A'}`);
    console.log(`│  ICP: ${r.icpScore} | Account: ${r.accountScore} | Intent: ${r.buyingIntentScore}`);
    if (r.whyMatch.length > 0) {
      console.log(`│  Why:`);
      for (const reason of r.whyMatch) {
        console.log(`│    • ${reason}`);
      }
    }
    if (r.buyingIndicators.length > 0) {
      console.log(`│  Buying Indicators:`);
      for (const bi of r.buyingIndicators) {
        console.log(`│    → ${bi}`);
      }
    }
    if (r.relevantContacts.length > 0) {
      const topContact = r.relevantContacts[0];
      console.log(`│  Top Contact: ${topContact.name} (${topContact.title || 'N/A'})`);
    }
    console.log(`│  Approach: ${r.recommendedApproach}`);
    console.log(`│  Trust: ${r.trust.confidence} confidence, ${r.trust.verificationStatus}`);
    console.log(`└${'─'.repeat(60)}`);
  }

  console.log(`\nAggregate Trust: ${result.trust.confidence} | Evidence: ${result.trust.evidenceCount || 0} sources`);
  console.log(`Reasoning: ${result.trust.reasoning}\n`);
}

main().catch((err) => {
  console.error('Market discovery failed:', err);
  process.exit(1);
});
