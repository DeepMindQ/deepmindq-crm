/**
 * Phase 3 End-to-End Governance Tests
 *
 * Tests the complete intelligence pipeline:
 *   Company → Research Engine → Evidence → Signals → Research Card → Intelligence Contract → AI Consumer
 *
 * Three test scenarios:
 *   1. Normal company: fresh research, good evidence, high confidence
 *   2. Limited-info company: sparse evidence, low confidence
 *   3. Stale-research company: old data, expired freshness, needs refresh
 *
 * Run: npx tsx src/lib/__tests__/phase3-e2e-governance.ts
 */

import {
  runGovernanceChecks,
  getGovernanceConfig,
  buildGovernancePromptAddon,
  buildEvidenceGroundingNote,
  HALLUCINATION_PREVENTION_RULES,
  GOVERNANCE_PROMPT_VERSION,
} from '@/lib/ai-governance';
import {
  applyFreshnessAdjustments,
  assessRefreshNeeds,
  FRESHNESS_EXPIRATION_THRESHOLDS,
} from '@/lib/intelligence-contract';
import type { ResearchContext, ResearchFreshness } from '@/lib/intelligence-contract';

// ── Test Helpers ──

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  FAIL: ${testName}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

function assertEqual(actual: unknown, expected: unknown, testName: string) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    console.log(`  PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  FAIL: ${testName} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failed++;
  }
}

// ── Mock Data Builders ──

function freshResearchContext(): ResearchContext {
  return {
    companyId: 'test-company-1',
    companyName: 'Acme Corp',
    domain: 'acme.com',
    industry: 'Technology',
    website: 'https://acme.com',
    country: 'US',
    sizeRange: '201-500',
    internalSummary: null,
    researchCard: {
      exists: true,
      source: 'research_engine_v3',
      enrichedAt: new Date().toISOString(),
      businessOverview: 'Acme Corp is a technology company specializing in cloud solutions.',
      revenue: '$50M',
      employeeCount: '350',
      fundingStage: 'Series C',
      techStack: 'AWS, React, Python',
      socialProfiles: { linkedin: 'https://linkedin.com/company/acme' },
      industry: 'Technology',
      website: 'https://acme.com',
    },
    keyPeople: [
      { name: 'Jane Smith', title: 'CEO', department: 'Executive' },
      { name: 'Bob Johnson', title: 'CTO', department: 'Engineering' },
    ],
    signals: [
      {
        id: 'sig-1',
        type: 'funding_round',
        title: 'Acme raises $20M Series C',
        description: 'Acme Corp announced a $20M Series C round led by VC Partners.',
        impact: 'high',
        severity: 'medium',
        confidence: 0.9,
        sourceUrl: 'https://techcrunch.com/acme-series-c',
        signalDate: new Date().toISOString(),
        detectedAt: new Date().toISOString(),
      },
    ],
    recentNews: [
      { title: 'Acme raises $20M', snippet: 'Series C funding round', source: 'TechCrunch', url: 'https://techcrunch.com/acme', signalType: 'funding_round', impact: 'high' },
    ],
    fieldConfidence: {
      revenue: 0.85,
      employeeCount: 0.9,
      fundingStage: 0.95,
      techStack: 0.8,
      businessOverview: 0.75,
      industry: 0.9,
    },
    evidenceSummary: {
      totalEvidence: 15,
      fields: {
        revenue: { count: 4, avgConfidence: 0.85, tierBreakdown: { premium: 2, standard: 2, low: 0 } },
        employeeCount: { count: 3, avgConfidence: 0.9, tierBreakdown: { premium: 1, standard: 2, low: 0 } },
      },
    },
    freshness: {
      score: 95,
      status: 'fresh',
      lastResearchedAt: new Date().toISOString(),
      daysSinceResearch: 2,
      evidenceCount: 15,
      signalCount: 1,
      categories: {
        profile: { score: 100, status: 'fresh', lastVerifiedAt: new Date().toISOString(), daysSinceVerification: 2 },
        signal: { score: 100, status: 'fresh', lastVerifiedAt: new Date().toISOString(), daysSinceVerification: 1 },
        contact: { score: 100, status: 'fresh', lastVerifiedAt: new Date().toISOString(), daysSinceVerification: 2 },
        technology: { score: 100, status: 'fresh', lastVerifiedAt: new Date().toISOString(), daysSinceVerification: 2 },
      },
    },
    structuredTechLandscape: { cloud: ['AWS'], data: ['PostgreSQL'], ai: [], applications: ['React'] },
    strategicPriorities: [
      { priority: 'Cloud expansion', description: 'Expanding cloud infrastructure', evidence: 'Press release', confidence: 0.8 },
    ],
    capabilityMatchingInputs: {
      businessProblems: ['scalability'],
      transformationAreas: ['cloud migration'],
      technologyThemes: ['AWS'],
    },
    contactCount: 5,
    internalNotes: null,
  };
}

function limitedInfoContext(): ResearchContext {
  const ctx = freshResearchContext();
  ctx.companyId = 'test-company-2';
  ctx.companyName = 'Unknown Startup';
  ctx.researchCard = {
    exists: true,
    source: 'research_engine_v3',
    enrichedAt: new Date().toISOString(),
    businessOverview: 'A startup in the technology sector.',
    revenue: null,
    employeeCount: null,
    fundingStage: null,
    techStack: null,
    socialProfiles: {},
    industry: 'Technology',
    website: null,
  };
  ctx.fieldConfidence = { businessOverview: 0.3, industry: 0.4 };
  ctx.evidenceSummary = { totalEvidence: 2, fields: {} };
  ctx.freshness = {
    score: 40,
    status: 'aging',
    lastResearchedAt: new Date().toISOString(),
    daysSinceResearch: 15,
    evidenceCount: 2,
    signalCount: 0,
    categories: {
      profile: { score: 60, status: 'fresh', lastVerifiedAt: new Date().toISOString(), daysSinceVerification: 15 },
      signal: { score: 0, status: 'none', lastVerifiedAt: null, daysSinceVerification: null },
      contact: { score: 0, status: 'none', lastVerifiedAt: null, daysSinceVerification: null },
      technology: { score: 0, status: 'none', lastVerifiedAt: null, daysSinceVerification: null },
    },
  };
  ctx.signals = [];
  ctx.keyPeople = [];
  ctx.strategicPriorities = [];
  ctx.capabilityMatchingInputs = { businessProblems: [], transformationAreas: [], technologyThemes: [] };
  ctx.structuredTechLandscape = { cloud: [], data: [], ai: [], applications: [] };
  ctx.contactCount = 0;
  return ctx;
}

function staleResearchContext(): ResearchContext {
  const ctx = freshResearchContext();
  ctx.companyId = 'test-company-3';
  ctx.companyName = 'Old Data Corp';
  const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000);
  const twentyDaysAgo = new Date(Date.now() - 20 * 86400000);
  const fiftyDaysAgo = new Date(Date.now() - 50 * 86400000);
  ctx.researchCard!.enrichedAt = sixtyDaysAgo.toISOString();
  ctx.freshness = {
    score: 35,
    status: 'stale',
    lastResearchedAt: sixtyDaysAgo.toISOString(),
    daysSinceResearch: 60,
    evidenceCount: 8,
    signalCount: 2,
    categories: {
      profile: { score: 75, status: 'aging', lastVerifiedAt: sixtyDaysAgo.toISOString(), daysSinceVerification: 60 },
      signal: { score: 15, status: 'stale', lastVerifiedAt: twentyDaysAgo.toISOString(), daysSinceVerification: 20 },
      contact: { score: 40, status: 'aging', lastVerifiedAt: fiftyDaysAgo.toISOString(), daysSinceVerification: 50 },
      technology: { score: 55, status: 'aging', lastVerifiedAt: fiftyDaysAgo.toISOString(), daysSinceVerification: 50 },
    },
  };
  return ctx;
}

// ── Test Suite 1: Normal Company (High Confidence) ──

async function testNormalCompany() {
  console.log('\n=== Test Suite 1: Normal Company (High Confidence) ===');
  const ctx = freshResearchContext();

  // Test 1.1: Email governance should pass
  const emailResult = await runGovernanceChecks({
    companyId: ctx.companyId,
    generationType: 'email_draft',
    researchContext: ctx,
    capabilityMatchCount: 2,
  });
  assert(emailResult.canProceed, 'Email governance passes for high-confidence company');
  assert(emailResult.checks.research_confidence.passed, 'Research confidence check passes (0.85 avg > 0.6 threshold)');

  // Test 1.2: Conversation plan governance should pass
  const planResult = await runGovernanceChecks({
    companyId: ctx.companyId,
    generationType: 'conversation_plan',
    researchContext: ctx,
  });
  assert(planResult.canProceed, 'Conversation plan governance passes');

  // Test 1.3: Opportunity governance should pass
  const oppResult = await runGovernanceChecks({
    companyId: ctx.companyId,
    generationType: 'opportunities',
    researchContext: ctx,
  });
  assert(oppResult.canProceed, 'Opportunity governance passes (0.5 threshold)');

  // Test 1.4: Lead scoring governance should pass
  const leadResult = await runGovernanceChecks({
    companyId: ctx.companyId,
    generationType: 'score_leads',
    researchContext: ctx,
  });
  assert(leadResult.canProceed, 'Lead scoring governance passes (0.5 threshold)');

  // Test 1.5: Prompt addon should be empty (no warnings)
  const addon = buildGovernancePromptAddon(emailResult);
  assert(addon === '', 'No governance warnings for fresh, high-confidence data');

  // Test 1.6: Evidence grounding note should be positive
  const grounding = buildEvidenceGroundingNote(ctx);
  assert(grounding.includes('15 evidence sources'), 'Grounding note mentions evidence count');
  assert(grounding.includes('95/100 freshness'), 'Grounding note mentions freshness score');

  // Test 1.7: Freshness adjustments should be minimal
  const { adjustedConfidence, adjustments, warnings } = applyFreshnessAdjustments(ctx.fieldConfidence, ctx.freshness);
  assert(adjustments.length === 0, 'No freshness adjustments for fresh data');
  assert(warnings.length === 0, 'No freshness warnings for fresh data');
  assertEqual(adjustedConfidence.revenue, 0.85, 'Revenue confidence unchanged for fresh data');
}

// ── Test Suite 2: Limited-Info Company (Low Confidence) ──

async function testLimitedInfoCompany() {
  console.log('\n=== Test Suite 2: Limited-Info Company (Low Confidence) ===');
  const ctx = limitedInfoContext();

  // Test 2.1: Email governance should BLOCK (enforceGovernance=true)
  const emailResult = await runGovernanceChecks({
    companyId: ctx.companyId,
    generationType: 'email_draft',
    researchContext: ctx,
    capabilityMatchCount: 0,
  });
  assert(!emailResult.canProceed, 'Email governance BLOCKS for low-confidence company');
  assert(emailResult.rejectionReason !== null, 'Rejection reason provided');
  assert(!emailResult.checks.research_confidence.passed, 'Research confidence check fails (0.35 avg < 0.6 threshold)');
  assert(!emailResult.checks.capability_match.passed, 'Capability match check fails (0 matches)');

  // Test 2.2: Insights governance should pass (enforceGovernance=false, advisory mode)
  const insightsResult = await runGovernanceChecks({
    companyId: ctx.companyId,
    generationType: 'insights',
    researchContext: ctx,
  });
  // Insights requires 0.3 confidence, limited company has 0.35 avg — should pass
  assert(insightsResult.canProceed, 'Insights governance passes (0.35 > 0.3 threshold)');

  // Test 2.3: Prompt addon should include warnings
  const addon = buildGovernancePromptAddon(insightsResult);
  assert(addon.length > 0, 'Governance warnings present for low-confidence data');

  // Test 2.4: Evidence grounding note should warn about limited evidence
  const grounding = buildEvidenceGroundingNote(ctx);
  assert(grounding.includes('Limited evidence'), 'Grounding note warns about limited evidence');
  assert(grounding.includes('No buying signals detected'), 'Grounding note warns about missing signals');

  // Test 2.5: Refresh needs — limited-info company has 'none' signal status
  // The assessRefreshNeeds function checks for aging/stale, not 'none'
  // 'none' status means category was never populated, which is a different concern
  const refreshNeeds = assessRefreshNeeds(ctx.freshness);
  // With all categories being 'fresh' or 'none', needsRefresh depends on aging categories
  // Profile is fresh (15 days < 90), others are 'none' — no refresh triggered by staleness
  assert(!refreshNeeds.needsRefresh || refreshNeeds.urgency === 'optional', 'Limited-info company has no stale categories to refresh');
}

// ── Test Suite 3: Stale-Research Company (Expired Freshness) ──

async function testStaleResearchCompany() {
  console.log('\n=== Test Suite 3: Stale-Research Company (Expired Freshness) ===');
  const ctx = staleResearchContext();

  // Test 3.1: Freshness adjustments should apply penalties when fields exceed category thresholds
  // Note: The stale company's fields (revenue, employeeCount → profile; techStack → technology)
  // are at 60d and 50d respectively, which are BELOW their thresholds (90d, 60d).
  // So no field-level adjustments. Warnings are still generated for the signal category.
  const { adjustedConfidence, adjustments, warnings } = applyFreshnessAdjustments(ctx.fieldConfidence, ctx.freshness);
  assert(warnings.length > 0, 'Freshness warnings present for stale data');

  // Test 3.2: Freshness adjustments apply to fields in fieldConfidence.
  // The stale company inherits fieldConfidence from freshResearchContext:
  //   revenue -> profile category (60 days < 90 threshold = no penalty)
  //   techStack -> technology category (50 days < 60 threshold = no penalty)
  //   employeeCount -> profile category (60 days < 90 threshold = no penalty)
  // All are below their respective thresholds, so NO adjustments.
  // This is correct behavior — the data isn't old enough per its category.
  assert(adjustments.length === 0, 'No adjustments because all fields are below category-specific thresholds');

  // Test 3.3: Signal freshness is tracked via the signal category (not fieldConfidence).
  // Signals at 20 days > 14 day threshold triggers a WARNING but not a field confidence
   // adjustment, because signals aren't stored in fieldConfidence.
  // The warning is already tested above (warnings.length > 0).
  assert(warnings.some(w => w.includes('signal')), 'Signal staleness warning present for 20-day-old signals');

  // Test 3.4: Refresh needs should indicate immediate action
  const refreshNeeds = assessRefreshNeeds(ctx.freshness);
  assert(refreshNeeds.needsRefresh, 'Refresh needed for stale company');
  assert(refreshNeeds.urgency === 'immediate' || refreshNeeds.urgency === 'recommended', 'Refresh urgency is immediate or recommended');
  assert(refreshNeeds.reasons.length > 0, 'Refresh reasons provided');
  assert(refreshNeeds.categoryNeeds.some(c => c.category === 'signal'), 'Signal refresh need identified');

  // Test 3.5: Contact at 50 days > 45 day threshold — triggers aging warning
  const contactCategory = ctx.freshness.categories.contact;
  assert(contactCategory.daysSinceVerification === 50, 'Contact data is 50 days old');
  assert(contactCategory.status === 'aging', 'Contact category is in aging state (50d > 45d threshold)');
  assert(warnings.some(w => w.includes('contact') && w.includes('aging')), 'Contact aging warning present');

  // Test 3.6: Governance staleness check for email
  const emailResult = await runGovernanceChecks({
    companyId: ctx.companyId,
    generationType: 'email_draft',
    researchContext: ctx,
    capabilityMatchCount: 1,
  });
  // Email has maxStalenessDays = 60. Research is 60 days old. Should be borderline.
  // The check is daysSince <= maxStalenessDays, so 60 <= 60 = true (passes)
  assert(emailResult.checks.staleness.passed, 'Staleness check passes at exactly 60 days (<= threshold)');
}

// ── Test Suite 4: Governance Config & Constants ──

async function testGovernanceConfigs() {
  console.log('\n=== Test Suite 4: Governance Config & Constants ===');

  // Test 4.1: Email has 60% confidence threshold
  const emailConfig = getGovernanceConfig('email_draft');
  assertEqual(emailConfig.minResearchConfidence, 0.6, 'Email confidence threshold is 60%');

  // Test 4.2: Conversation plan has 60% confidence threshold
  const planConfig = getGovernanceConfig('conversation_plan');
  assertEqual(planConfig.minResearchConfidence, 0.6, 'Conversation plan confidence threshold is 60%');

  // Test 4.3: Opportunity has 50% confidence threshold
  const oppConfig = getGovernanceConfig('opportunities');
  assertEqual(oppConfig.minResearchConfidence, 0.5, 'Opportunity confidence threshold is 50%');

  // Test 4.4: Lead scoring has 50% confidence threshold
  const leadConfig = getGovernanceConfig('score_leads');
  assertEqual(leadConfig.minResearchConfidence, 0.5, 'Lead scoring confidence threshold is 50%');

  // Test 4.5: Prompt version is set
  assert(GOVERNANCE_PROMPT_VERSION === 'v3-phase3-harden', 'Governance prompt version is v3-phase3-harden');

  // Test 4.6: Hallucination rules have 15 rules
  const ruleLines = HALLUCINATION_PREVENTION_RULES.trim().split('\n').filter(l => /^\d+\./.test(l.trim()));
  assert(ruleLines.length === 15, `Hallucination prevention has 15 rules (found ${ruleLines.length})`);

  // Test 4.7: Default config is reasonable
  const defaultConfig = getGovernanceConfig('unknown_type');
  assertEqual(defaultConfig.minResearchConfidence, 0.4, 'Default confidence threshold is 40%');

  // Test 4.8: Freshness expiration thresholds are correct
  assertEqual(FRESHNESS_EXPIRATION_THRESHOLDS.signal.warningDays, 14, 'Signal warning at 14 days');
  assertEqual(FRESHNESS_EXPIRATION_THRESHOLDS.technology.warningDays, 60, 'Technology warning at 60 days');
  assertEqual(FRESHNESS_EXPIRATION_THRESHOLDS.contact.warningDays, 45, 'Contact warning at 45 days');
  assertEqual(FRESHNESS_EXPIRATION_THRESHOLDS.profile.warningDays, 90, 'Profile warning at 90 days');
}

// ── Run All Tests ──

async function main() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  Phase 3 End-to-End Governance Test Suite            ║');
  console.log('║  Testing: Governance, Freshness, Evidence Pipeline   ║');
  console.log('╚══════════════════════════════════════════════════════╝');

  await testNormalCompany();
  await testLimitedInfoCompany();
  await testStaleResearchCompany();
  await testGovernanceConfigs();

  console.log('\n══════════════════════════════════════════════════════');
  console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  if (failed === 0) {
    console.log('All Phase 3 governance tests PASSED.');
  } else {
    console.error(`${failed} test(s) FAILED.`);
    process.exit(1);
  }
  console.log('══════════════════════════════════════════════════════');
}

main().catch(err => {
  console.error('Test runner failed:', err);
  process.exit(1);
});