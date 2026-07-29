/**
 * run-intelligence-flow.ts
 * ══════════════════════════
 * Runs the complete intelligence flow against the production server:
 *   1. Embed new capabilities via vector index
 *   2. Enrich each representative company
 *   3. Run full intelligence pipeline on key accounts
 *   4. Capture all real outputs for design reference
 *
 * Usage: unset DATABASE_URL && npx tsx scripts/run-intelligence-flow.ts
 */

const BASE = 'http://localhost:3000';

// Representative company IDs (from demo prepare - will fetch dynamically)
const COMPANY_DOMAINS = [
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

async function api(method: string, path: string, body?: unknown) {
  const url = `${BASE}${path}`;
  const opts: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  
  try {
    const res = await fetch(url, opts);
    const data = await res.json();
    if (!res.ok) {
      console.log(`    ⚠ HTTP ${res.status}: ${JSON.stringify(data).substring(0, 200)}`);
      return null;
    }
    return data;
  } catch (err) {
    console.log(`    ⚠ FETCH ERROR: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  DeepMindQ — Intelligence Flow Runner');
  console.log('═══════════════════════════════════════════════════════════\n');

  // ── Step 1: Get company IDs ──
  console.log('━━━ STEP 1: Fetching Company IDs ━━━');
  const companies: Array<{id: string; rawName: string; domain: string}> = [];
  for (const domain of COMPANY_DOMAINS) {
    const data = await api('GET', `/api/companies?search=${encodeURIComponent(domain)}&limit=5`);
    if (data?.companies) {
      const match = data.companies.find((c: any) => c.domain === domain);
      if (match) {
        companies.push({ id: match.id, rawName: match.rawName, domain: match.domain });
        console.log(`  ✓ ${match.rawName} (${match.id})`);
      }
    }
  }
  console.log(`  Found ${companies.length} companies\n`);

  if (companies.length === 0) {
    console.log('  ✗ No companies found. Aborting.');
    return;
  }

  // ── Step 2: Enrich Companies ──
  console.log('━━━ STEP 2: Enriching Companies ━━━');
  for (const company of companies.slice(0, 5)) {
    console.log(`  Enriching: ${company.rawName}...`);
    const result = await api('POST', '/api/companies/enrich', { companyId: company.id });
    if (result?.success) {
      console.log(`    ✓ Enriched successfully`);
    } else {
      console.log(`    ⚠ Enrichment issue (will continue)`);
    }
  }
  console.log('');

  // ── Step 3: Run Intelligence Enrichment (Signal Detection) ──
  console.log('━━━ STEP 3: Running Intelligence Enrichment (Signal Detection) ━━━');
  for (const company of companies.slice(0, 5)) {
    console.log(`  Enriching: ${company.rawName}...`);
    const result = await api('POST', '/api/intelligence/enrich', { companyId: company.id });
    if (result?.success) {
      console.log(`    ✓ Signals detected: ${result.signalsDetected || 'unknown count'}`);
    } else {
      console.log(`    ⚠ Enrichment issue`);
    }
  }
  console.log('');

  // ── Step 4: Run Full Pipeline on 2-3 key accounts ──
  console.log('━━━ STEP 4: Running Full Intelligence Pipeline ━━━');
  const pipelineTargets = companies.slice(0, 3);
  const pipelineResults: any[] = [];
  
  for (const company of pipelineTargets) {
    console.log(`  Pipeline: ${company.rawName}...`);
    console.log(`    (This will take 1-2 minutes — runs 17 AI-powered stages)`);
    const result = await api('POST', '/api/intelligence/full-pipeline', { companyId: company.id });
    if (result) {
      pipelineResults.push({ company: company.rawName, result });
      console.log(`    ✓ Pipeline completed`);
      if (result.pipelineRun) {
        const pr = result.pipelineRun;
        console.log(`    Stages: ${pr.completedStages}/${pr.totalStages} completed, ${pr.failedStages} failed`);
      }
      if (result.accountStrategy) {
        const as = result.accountStrategy;
        console.log(`    Win Probability: ${as.winProbability?.probability || 'N/A'}%`);
        if (as.executiveBrief) {
          console.log(`    Executive Brief: ${as.executiveBrief.substring(0, 150)}...`);
        }
      }
    } else {
      console.log(`    ⚠ Pipeline failed`);
    }
    console.log('');
  }

  // ── Step 5: Capture Full Intelligence State ──
  console.log('━━━ STEP 5: Capturing Intelligence State ━━━');
  
  // Get signals
  const signals = await api('GET', '/api/signals?limit=20');
  console.log(`  Signals: ${signals?.total || 0} total`);
  
  // Get capabilities
  const caps = await api('GET', '/api/capabilities?limit=100');
  console.log(`  Capabilities: ${caps?.length || caps?.capabilities?.length || 0} total`);
  
  // Get demo readiness
  const readiness = await api('GET', '/api/demo/prepare');
  if (readiness) {
    console.log(`  Intelligence Graph Status:`);
    console.log(`    Capabilities: ${readiness.capabilities}`);
    console.log(`    Demo Companies: ${readiness.demoCompanies}`);
    console.log(`    Signals: ${readiness.signals}`);
    console.log(`    Signal-Capability Matches: ${readiness.matches}`);
  }

  // Get detailed pipeline results for first target
  if (pipelineResults.length > 0) {
    const target = pipelineTargets[0];
    const fullState = await api('GET', `/api/intelligence/full-pipeline?companyId=${target.id}`);
    if (fullState) {
      console.log('\n  ━━ Detailed Intelligence for', target.rawName, '━━');
      
      // Signals
      if (fullState.summary?.externalIntelligence?.signalDetection) {
        const sd = fullState.summary.externalIntelligence.signalDetection;
        console.log(`  Signal Detection:`);
        console.log(`    Total Signals: ${sd.totalSignals || 'N/A'}`);
        console.log(`    Top Signal: ${sd.topSignals?.[0]?.title || 'N/A'}`);
      }
      
      // Capability matches
      if (fullState.summary?.internalMatching?.capabilityMatching) {
        const cm = fullState.summary.internalMatching.capabilityMatching;
        console.log(`  Capability Matching:`);
        console.log(`    Total Matches: ${cm.totalMatches || 'N/A'}`);
        console.log(`    High Confidence: ${cm.highConfidence || 'N/A'}`);
      }

      // Opportunities
      if (fullState.summary?.topOpportunities) {
        console.log(`  Top Opportunities:`);
        for (const opp of (fullState.summary.topOpportunities as any[]).slice(0, 3)) {
          console.log(`    - ${opp.title || 'Untitled'} (Score: ${opp.opportunityScore || 'N/A'}, Priority: ${opp.priority || 'N/A'})`);
          if (opp.reasoning) console.log(`      ${opp.reasoning.substring(0, 200)}...`);
        }
      }

      // Intelligence Fusion
      if (fullState.summary?.intelligenceFusion) {
        const fus = fullState.summary.intelligenceFusion;
        console.log(`  Intelligence Fusion:`);
        console.log(`    Status: ${fus.status || 'N/A'}`);
        console.log(`    Overall Score: ${fus.overallScore || 'N/A'}`);
      }
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  INTELLIGENCE FLOW COMPLETE');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Companies enriched: ${Math.min(5, companies.length)}`);
  console.log(`  Full pipelines run: ${pipelineResults.length}`);
  console.log(`  Total signals: ${signals?.total || 0}`);
  console.log('');
  console.log('  The UI can now be designed against REAL intelligence outputs.');
  console.log('═══════════════════════════════════════════════════════════\n');
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
