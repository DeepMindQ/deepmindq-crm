/**
 * run-enrichment-direct.ts
 * ═══════════════════════════
 * Runs company enrichment and signal detection directly via Prisma + AI engines.
 * Bypasses the HTTP server to work within 4GB RAM constraints.
 *
 * Usage: unset DATABASE_URL && npx tsx scripts/run-enrichment-direct.ts
 */

import { PrismaClient } from '@prisma/client';
import { ModelRouter } from '../src/lib/engines/model-router';

const db = new PrismaClient({ log: ['error', 'warn'] });

// Target companies
const TARGETS = [
  { domain: 'acmefinancial.com', name: 'Acme Financial Services' },
  { domain: 'meridianhealth.com', name: 'Meridian Healthcare Group' },
  { domain: 'stratoscloud.com', name: 'StratosCloud Systems' },
];

async function enrichCompany(companyId: string, companyName: string) {
  console.log(`\n  ── Enriching: ${companyName} ──`);
  
  const company = await db.company.findUnique({
    where: { id: companyId },
    include: { signals: true, contacts: true, researchCard: true },
  });

  if (!company) {
    console.log('    ✗ Company not found');
    return null;
  }

  // Step 1: AI-powered enrichment (estimate company profile)
  console.log('    [1/4] AI Company Profile Estimation...');
  try {
    const systemPrompt = `You are a business intelligence analyst. Given a company name, domain, industry, and summary, estimate key business characteristics. Return JSON.`;
    const userPrompt = `Company: ${company.rawName}
Domain: ${company.domain || 'Unknown'}
Industry: ${company.industry || 'Unknown'}
Size: ${company.sizeRange || 'Unknown'}
Country: ${company.country || 'Unknown'}
Summary: ${company.internalSummary || 'No summary available'}

Estimate:
1. revenue (string, e.g. "$500M - $1B")
2. employeeCount (string, e.g. "10,000+")
3. fundingStage (string, e.g. "Public" or "Series D")
4. techStack (array of strings)
5. businessOverview (2-3 sentences)
6. keyInitiatives (array of 2-3 current initiatives)
7. potentialPainPoints (array of 2-3 likely challenges)

Return ONLY valid JSON, no markdown.`;

    const result = await ModelRouter.complete({
      systemPrompt,
      userPrompt,
      tier: 'smart',
      maxTokens: 1500,
      temperature: 0.3,
      genType: 'company_enrichment',
      companyId,
    });

    if (result.success && result.text) {
      // Parse the JSON from the response
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const enrichment = JSON.parse(jsonMatch[0]);
        console.log('    ✓ Revenue: ' + (enrichment.revenue || 'N/A'));
        console.log('    ✓ Employees: ' + (enrichment.employeeCount || 'N/A'));
        console.log('    ✓ Tech: ' + (enrichment.techStack?.join(', ') || 'N/A').substring(0, 100));
        console.log('    ✓ Initiatives: ' + (enrichment.keyInitiatives?.join('; ') || 'N/A').substring(0, 200));
      }
    }
  } catch (err) {
    console.log('    ⚠ AI enrichment error: ' + (err instanceof Error ? err.message : String(err)));
  }

  // Step 2: Detect signals
  console.log('    [2/4] Signal Detection...');
  try {
    const systemPrompt = `You are a sales intelligence signal detector. Given a company profile, detect 3-5 buying signals that indicate this company may need technology services. For each signal provide:
- type (one of: expansion, technology_adoption, leadership_change, funding_event, partnership, compliance, digital_transformation, hiring_surge)
- title (short, specific)
- description (1-2 sentences)
- impact (high/medium/low)
- confidence (0.0-1.0)

Return ONLY valid JSON array.`;
    const userPrompt = `Company: ${company.rawName}
Industry: ${company.industry}
Size: ${company.sizeRange}
Country: ${company.country}
Summary: ${company.internalSummary || 'No summary'}

Detect buying signals for this company.`;

    const result = await ModelRouter.complete({
      systemPrompt,
      userPrompt,
      tier: 'smart',
      maxTokens: 2000,
      temperature: 0.3,
      genType: 'signal_detection',
      companyId,
    });

    if (result.success && result.text) {
      const jsonMatch = result.text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const signals = JSON.parse(jsonMatch[0]);
        console.log(`    ✓ Detected ${signals.length} signals:`);
        for (const s of signals) {
          // Persist signal
          await db.companySignal.create({
            data: {
              companyId,
              title: s.title || 'Untitled Signal',
              description: s.description || '',
              signalType: s.type || 'digital_transformation',
              impact: s.impact || 'medium',
              confidence: typeof s.confidence === 'number' ? s.confidence : 0.7,
              source: 'ai_detection',
              severity: s.impact === 'high' ? 'high' : s.impact === 'medium' ? 'medium' : 'low',
              status: 'active',
            },
          });
          console.log(`      → [${s.impact?.toUpperCase() || 'MED'}] ${s.title}`);
        }
      }
    }
  } catch (err) {
    console.log('    ⚠ Signal detection error: ' + (err instanceof Error ? err.message : String(err)));
  }

  // Step 3: Capability matching
  console.log('    [3/4] Capability Matching...');
  try {
    const capabilities = await db.capabilityAsset.findMany({
      where: { isActive: true, category: 'service_line' },
    });

    const signals = await db.companySignal.findMany({
      where: { companyId, status: 'active' },
    });

    if (signals.length > 0 && capabilities.length > 0) {
      const systemPrompt = `You are a sales intelligence matching engine. Given a company's detected buying signals and a list of available capabilities, match the TOP signals to the MOST relevant capabilities.

For each match provide:
- signalTitle (from the signals)
- capabilityTitle (from the capabilities)
- matchScore (0.0-1.0, how well the capability addresses the signal)
- reason (1-2 sentences explaining the fit)
- businessProblem (the core problem this combination addresses)
- salesAngle (suggested conversation opener, 1-2 sentences)

Return ONLY valid JSON array. Max 3 matches.`;

      const signalContext = signals.map(s => `- ${s.title} (${s.signalType}, impact: ${s.impact})`).join('\n');
      const capContext = capabilities.slice(0, 15).map(c => `- ${c.title} (${c.serviceLine || c.category}): ${c.summary.substring(0, 100)}`).join('\n');

      const userPrompt = `Company: ${company.rawName}
Industry: ${company.industry}

DETECTED SIGNALS:
${signalContext}

AVAILABLE CAPABILITIES:
${capContext}

Match signals to capabilities.`;

      const result = await ModelRouter.complete({
        systemPrompt,
        userPrompt,
        tier: 'smart',
        maxTokens: 2000,
        temperature: 0.3,
        genType: 'capability_matching',
        companyId,
      });

      if (result.success && result.text) {
        const jsonMatch = result.text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const matches = JSON.parse(jsonMatch[0]);
          console.log(`    ✓ Found ${matches.length} capability matches:`);
          for (const m of matches) {
            const signal = signals.find(s => s.title === m.signalTitle);
            const cap = capabilities.find(c => c.title === m.capabilityTitle);
            if (signal && cap) {
              await db.signalCapabilityMatch.create({
                data: {
                  signalId: signal.id,
                  companyId,
                  capabilityId: cap.id,
                  matchScore: typeof m.matchScore === 'number' ? m.matchScore : 0.7,
                  reason: m.reason || '',
                  businessProblem: m.businessProblem || '',
                  expectedOutcome: m.salesAngle || '',
                  salesAngle: m.salesAngle || '',
                },
              });
              console.log(`      → [${((m.matchScore || 0.7) * 100).toFixed(0)}%] ${m.capabilityTitle}`);
              console.log(`        Signal: ${m.signalTitle}`);
            }
          }
        }
      }
    } else {
      console.log('    ⊘ No signals or capabilities to match');
    }
  } catch (err) {
    console.log('    ⚠ Capability matching error: ' + (err instanceof Error ? err.message : String(err)));
  }

  // Step 4: Generate opportunity recommendation
  console.log('    [4/4] Opportunity Generation...');
  try {
    const matches = await db.signalCapabilityMatch.findMany({
      where: { companyId },
      include: { signal: true, capability: true },
      orderBy: { matchScore: 'desc' },
    });

    if (matches.length > 0) {
      const bestMatch = matches[0];
      const systemPrompt = `You are a strategic opportunity advisor for an enterprise technology services company. Based on a signal-capability match for a prospect company, generate an opportunity recommendation.

Return JSON with:
- title (opportunity title, 5-10 words)
- businessTrigger (what triggered this opportunity)
- whyNow (why the timing is right, 2 sentences)
- businessProblem (core problem, 2 sentences)
- recommendedCapability (which service line to lead with)
- opportunityScore (0-100)
- confidenceScore (0-1)
- priority (HOT/WARM/NURTURE)
- reasoning (strategic reasoning, 3-4 sentences)
- suggestedNextAction (concrete next step, 1-2 sentences)`;

      const userPrompt = `Company: ${company.rawName}
Industry: ${company.industry}
Size: ${company.sizeRange}
Country: ${company.country}

SIGNAL: ${bestMatch.signal.title} (${bestMatch.signal.description})
MATCHED CAPABILITY: ${bestMatch.capability.title}
MATCH SCORE: ${(bestMatch.matchScore * 100).toFixed(0)}%
MATCH REASON: ${bestMatch.reason || 'N/A'}

Generate an opportunity recommendation.`;

      const result = await ModelRouter.complete({
        systemPrompt,
        userPrompt,
        tier: 'deep',
        maxTokens: 1500,
        temperature: 0.3,
        genType: 'opportunity_generation',
        companyId,
      });

      if (result.success && result.text) {
        const jsonMatch = result.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const opp = JSON.parse(jsonMatch[0]);
          await db.opportunityRecommendation.create({
            data: {
              companyId,
              title: opp.title || 'Untitled Opportunity',
              businessTrigger: opp.businessTrigger || '',
              whyNow: opp.whyNow || '',
              businessProblem: opp.businessProblem || '',
              recommendedCapability: opp.recommendedCapability || '',
              recommendedStakeholders: '["CTO", "CIO"]',
              opportunityScore: typeof opp.opportunityScore === 'number' ? opp.opportunityScore : 70,
              confidence: typeof opp.confidenceScore === 'number' ? opp.confidenceScore : 0.7,
              priority: opp.priority || 'WARM',
              reasoning: opp.reasoning || '',
              status: 'new',
              source: 'ai_pipeline',
            },
          });
          console.log(`    ✓ Opportunity: ${opp.title}`);
          console.log(`      Score: ${opp.opportunityScore} | Priority: ${opp.priority} | Confidence: ${(opp.confidenceScore * 100).toFixed(0)}%`);
          console.log(`      Why Now: ${opp.whyNow?.substring(0, 200)}`);
          console.log(`      Next Action: ${opp.suggestedNextAction || 'N/A'}`);
        }
      }
    } else {
      console.log('    ⊘ No matches to generate opportunity from');
    }
  } catch (err) {
    console.log('    ⚠ Opportunity generation error: ' + (err instanceof Error ? err.message : String(err)));
  }

  return true;
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  Direct Intelligence Enrichment');
  console.log('═══════════════════════════════════════════════════════════');

  for (const target of TARGETS) {
    const company = await db.company.findFirst({
      where: { domain: target.domain },
    });
    if (company) {
      await enrichCompany(company.id, company.rawName);
    } else {
      console.log(`\n  ⊘ SKIP: ${target.name} (not found)`);
    }
  }

  // Final summary
  const totalSignals = await db.companySignal.count();
  const totalMatches = await db.signalCapabilityMatch.count();
  const totalOpps = await db.opportunityRecommendation.count();
  const totalCaps = await db.capabilityAsset.count({ where: { isActive: true } });
  const totalCompanies = await db.company.count({ where: { source: { in: ['demo', 'intelligence-prep'] } } });

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  INTELLIGENCE DATA READY FOR DESIGN');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Capabilities:     ${totalCaps}`);
  console.log(`  Companies:        ${totalCompanies}`);
  console.log(`  Signals:          ${totalSignals}`);
  console.log(`  Cap Matches:      ${totalMatches}`);
  console.log(`  Opportunities:    ${totalOpps}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  await db.$disconnect();
}

main().catch(err => {
  console.error('FATAL:', err);
  db.$disconnect();
  process.exit(1);
});
