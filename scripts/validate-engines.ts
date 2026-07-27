/**
 * Phase D — Enterprise Intelligence Validation
 * ==============================================
 * Validates all 3 composition engines against the enterprise seed dataset:
 *   1. ScoringEngine: Score 50+ accounts, validate dimensions/ranking/evidence
 *   2. ActionEngine: Top 20 scored accounts get full action recommendations
 *   3. ConversationEngine: 6 buyer personas across industries
 *
 * Usage: npx tsx scripts/validate-engines.ts
 */

import { PrismaClient } from '@prisma/client';
import { ScoringEngine } from '../src/lib/engines/scoring-engine';
import { ActionEngine } from '../src/lib/engines/action-engine';
import { ConversationEngine } from '../src/lib/engines/conversation-engine';

const db = new PrismaClient();

// ─── Validation 1: ScoringEngine ──────────────────────────────────────────

async function validateScoringEngine() {
  console.log('\n══════════════════════════════════════════════════');
  console.log('📊 VALIDATION 1: ScoringEngine (50+ accounts)');
  console.log('══════════════════════════════════════════════════');

  const companies = await db.company.findMany({ take: 55 });
  const results: any[] = [];
  let successCount = 0;
  let failCount = 0;
  const gradeDist: Record<string, number> = {};
  const priorityDist: Record<string, number> = {};
  let totalConfidence = 0;
  let totalFactors = 0;
  let totalEvidence = 0;

  for (const company of companies) {
    const start = Date.now();
    const score = await ScoringEngine.score({ companyId: company.id, skipNarrative: true });
    const duration = Date.now() - start;

    if (score.success) {
      successCount++;
      results.push(score);
      gradeDist[score.grade] = (gradeDist[score.grade] || 0) + 1;
      priorityDist[score.priorityTier] = (priorityDist[score.priorityTier] || 0) + 1;
      totalConfidence += score.confidence;
      totalFactors += score.factors.length;
      totalEvidence += score.evidenceCount;

      console.log(
        `  ✅ ${score.companyName.padEnd(22)} | Score: ${String(score.score).padStart(3)}/100 (${score.grade}) | ` +
        `Priority: ${score.priorityTier.padEnd(9)} | Factors: ${String(score.factors.length).padStart(2)} | ` +
        `Confidence: ${String(score.confidence).padStart(3)}% | Evidence: ${String(score.evidenceCount).padStart(3)} | ` +
        `${duration}ms`,
      );
    } else {
      failCount++;
      console.log(`  ❌ ${company.rawName.padEnd(22)} | FAILED: ${score.error}`);
    }
  }

  // Sort by score descending for ranking validation
  results.sort((a, b) => b.score - a.score);

  console.log('\n  ── Scoring Summary ──');
  console.log(`  Total scored: ${successCount + failCount} (${successCount} success, ${failCount} failed)`);
  console.log(`  Avg confidence: ${successCount > 0 ? Math.round(totalConfidence / successCount) : 0}%`);
  console.log(`  Avg factors per account: ${successCount > 0 ? (totalFactors / successCount).toFixed(1) : 0}`);
  console.log(`  Avg evidence per account: ${successCount > 0 ? (totalEvidence / successCount).toFixed(1) : 0}`);

  console.log('\n  Grade Distribution:');
  for (const [grade, count] of Object.entries(gradeDist).sort((a, b) => b[1] - a[1])) {
    const bar = '█'.repeat(Math.round(count / successCount * 30));
    console.log(`    ${grade}: ${String(count).padStart(3)} ${bar}`);
  }

  console.log('\n  Priority Tier Distribution:');
  for (const [tier, count] of Object.entries(priorityDist).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${tier.padEnd(10)}: ${count}`);
  }

  console.log('\n  Top 10 Accounts (by score):');
  for (let i = 0; i < Math.min(10, results.length); i++) {
    const r = results[i];
    const topFactors = r.factors.sort((a: any, b: any) => b.points - a.points).slice(0, 3);
    const factorStr = topFactors.map((f: any) => `${f.points > 0 ? '+' : ''}${f.points} ${f.label}`).join(', ');
    console.log(`    ${String(i + 1).padStart(2)}. ${r.companyName.padEnd(22)} ${String(r.score).padStart(3)}/100 — ${factorStr}`);
  }

  console.log('\n  Bottom 5 Accounts:');
  for (let i = 0; i < Math.min(5, results.length); i++) {
    const r = results[results.length - 1 - i];
    console.log(`    ${results.length - i}. ${r.companyName.padEnd(22)} ${String(r.score).padStart(3)}/100 — Factors: ${r.factors.length}`);
  }

  return results;
}

// ─── Validation 2: ActionEngine ───────────────────────────────────────────

async function validateActionEngine(topAccounts: any[]) {
  console.log('\n══════════════════════════════════════════════════');
  console.log('🎯 VALIDATION 2: ActionEngine (Top 20 accounts)');
  console.log('══════════════════════════════════════════════════');

  const top20 = topAccounts.slice(0, 20);
  let successCount = 0;
  let failCount = 0;
  const motionDist: Record<string, number> = {};

  for (const account of top20) {
    const start = Date.now();
    const result = await ActionEngine.recommend({ companyId: account.companyId, skipNarrative: true });
    const duration = Date.now() - start;

    if (result.success) {
      successCount++;
      motionDist[result.detectedSalesMotion] = (motionDist[result.detectedSalesMotion] || 0) + 1;

      const primary = result.primaryAction;
      console.log(
        `  ✅ ${account.companyName.padEnd(22)} | Motion: ${result.detectedSalesMotion.padEnd(14)} | ` +
        `Actions: ${String(result.actions.length).padStart(2)} | Risks: ${String(result.riskActions.length).padStart(2)} | ` +
        `Primary: ${(primary?.title || 'none').slice(0, 50)} | ${duration}ms`,
      );

      // Show action details for first 5
      if (successCount <= 5 && result.actions.length > 0) {
        for (const action of result.actions.slice(0, 3)) {
          console.log(
            `      → [${action.type.padEnd(20)}] Impact: ${String(action.impactScore).padEnd(3)}/100 ` +
            `Conf: ${String(action.confidence).padEnd(3)}% Urgency: ${action.urgency}`,
          );
        }
      }
    } else {
      failCount++;
      console.log(`  ❌ ${account.companyName.padEnd(22)} | FAILED: ${result.error}`);
    }
  }

  console.log('\n  ── Action Summary ──');
  console.log(`  Total: ${successCount + failCount} (${successCount} success, ${failCount} failed)`);

  console.log('\n  Sales Motion Distribution:');
  for (const [motion, count] of Object.entries(motionDist).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${motion.padEnd(14)}: ${count}`);
  }
}

// ─── Validation 3: ConversationEngine ────────────────────────────────────

async function validateConversationEngine() {
  console.log('\n══════════════════════════════════════════════════');
  console.log('💬 VALIDATION 3: ConversationEngine (6 personas)');
  console.log('══════════════════════════════════════════════════');

  // Find 6 diverse contacts across different industries/roles
  const targetRoles = [
    'Chief Information Officer',
    'Chief Technology Officer',
    'VP of Engineering',
    'Chief Data Officer',
    'Director of Data Analytics',
    'Head of Cloud Architecture',
  ];

  const contacts: any[] = [];
  for (const targetRole of targetRoles) {
    const contact = await db.contact.findFirst({
      where: { title: targetRole },
      orderBy: { leadScore: 'desc' },
    });
    if (contact) {
      contacts.push({ contact, role: targetRole });
    }
  }

  // If we don't have all 6 target roles, fill with any high-score contacts
  if (contacts.length < 6) {
    const existingIds = new Set(contacts.map(c => c.contact.id));
    const fillers = await db.contact.findMany({
      where: { id: { notIn: [...existingIds] } },
      orderBy: { leadScore: 'desc' },
      take: 6 - contacts.length,
    });
    for (const c of fillers) {
      contacts.push({ contact: c, role: c.title || 'Unknown' });
    }
  }

  let successCount = 0;
  let failCount = 0;

  for (const { contact, role } of contacts) {
    const company = await db.company.findUnique({ where: { id: contact.companyId } });
    if (!company) continue;

    const start = Date.now();
    const result = await ConversationEngine.brief({
      companyId: contact.companyId,
      contactId: contact.id,
      briefingType: 'meeting_prep',
      skipNarrative: true,
    });
    const duration = Date.now() - start;

    if (result.success) {
      successCount++;
      const bp = result.buyerProfile;

      console.log(
        `  ✅ ${bp.name.padEnd(20)} (${role.slice(0, 25).padEnd(25)}) @ ${company.rawName.padEnd(20)} | ` +
        `Meeting: ${result.meetingType} | Seniority: ${bp.seniority.padEnd(9)} | Buyer: ${bp.buyerRole} | ` +
        `${duration}ms`,
      );
      console.log(`      Talking pts: ${result.talkingPoints.length} | Questions: ${result.questionsToAsk.length} | ` +
        `Objections: ${result.objectionsToPrepare.length} | Avoid: ${result.topicsToAvoid.length}`);
      console.log(`      Objective: ${result.meetingObjective.slice(0, 80)}...`);

      // Show top objection for first 3
      if (successCount <= 3 && result.objectionsToPrepare.length > 0) {
        const obj = result.objectionsToPrepare[0];
        console.log(`      Top objection: "${obj.objection}" (prob: ${obj.probability})`);
      }
    } else {
      failCount++;
      console.log(`  ❌ ${contact.rawName.padEnd(20)} | FAILED: ${result.error}`);
    }
  }

  console.log('\n  ── Conversation Summary ──');
  console.log(`  Total briefings: ${contacts.length} (${successCount} success, ${failCount} failed)`);
  console.log(`  Personas tested: ${contacts.map(c => c.role).join(', ')}`);
}

// ─── Main ────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔬 Phase D — Enterprise Intelligence Validation');
  console.log('==============================================');
  const startTime = Date.now();

  // Validation 1: ScoringEngine
  const topAccounts = await validateScoringEngine();

  // Validation 2: ActionEngine (uses top 20 from scoring)
  await validateActionEngine(topAccounts);

  // Validation 3: ConversationEngine
  await validateConversationEngine();

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n══════════════════════════════════════════════════');
  console.log(`✅ All validations completed in ${duration}s`);
  console.log('══════════════════════════════════════════════════');
}

main()
  .catch((err) => {
    console.error('❌ Validation failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
