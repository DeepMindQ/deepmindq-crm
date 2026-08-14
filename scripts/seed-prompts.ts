/**
 * Seed Prompt Templates — DeepMindQ Intelligence OS
 *
 * Reads all HARDCODED_PROMPTS from prompt-registry.ts and upserts
 * them into the PromptTemplate table via Prisma.
 *
 * Run: npx tsx scripts/seed-prompts.ts
 * Env:  DATABASE_URL must be set
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ═══════════════════════════════════════════════════════════════
// Hardcoded prompts — kept in sync with prompt-registry.ts
// These are the source-of-truth defaults for fresh installs.
// ═══════════════════════════════════════════════════════════════

const HARDCODED_PROMPTS: Record<string, { systemPrompt: string; label: string; feature?: string }> =
  {
    brief_summary: {
      label: 'Executive Brief Summary',
      feature: 'briefing',
      systemPrompt: `You are a revenue intelligence analyst. Your job is to convert STRUCTURED FACTS into a concise executive summary.

CRITICAL RULES:
- Only use the facts provided. Do NOT invent, assume, or hallucinate any information.
- Do not add any facts not present in the input.
- Write in a professional, executive tone (2-4 sentences).
- Focus on what the facts mean for business opportunity.
- Do not mention confidence scores or technical details in the narrative.`,
    },
    engagement_approach: {
      label: 'Engagement Approach',
      feature: 'reasoning',
      systemPrompt: `You are a revenue intelligence analyst. Convert STRUCTURED FACTS about a company's signals into a recommended engagement approach.

CRITICAL RULES:
- Only reference signals and facts explicitly provided.
- Do NOT invent or assume any information.
- Be specific about WHAT to discuss, not WHO to contact (no specific names/titles).
- Write 1-3 sentences, action-oriented.
- Good: "Engage technology leadership to discuss AI modernization opportunities."
- Bad: "Contact CIO John Smith at jsmith@company.com."`,
    },
    reasoning_analyst: {
      label: 'DeepMindQ Intelligence Analyst',
      feature: 'reasoning',
      systemPrompt:
        'You are DeepMindQ, an Enterprise Intelligence OS. Your job is to analyze business intelligence about organizations and produce actionable insights. Be specific, evidence-backed, and practical. Never fabricate data. If confidence is low, say so.',
    },
  };

// ═══════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════

async function main() {
  console.log('[seed-prompts] Starting prompt template seed...');

  let upserted = 0;
  let skipped = 0;

  for (const [key, prompt] of Object.entries(HARDCODED_PROMPTS)) {
    // Use upsert: create if no row exists for this key, otherwise do nothing
    const result = await prisma.promptTemplate.upsert({
      where: { key },
      create: {
        key,
        label: prompt.label,
        description: `Default ${key} prompt (seeded from code)`,
        systemPrompt: prompt.systemPrompt,
        version: 1,
        isActive: true,
        isDefault: true,
        feature: prompt.feature ?? null,
      },
      update: {
        // Only update metadata — never overwrite an admin's customizations.
        // If a template already exists, we leave it untouched.
        // The update clause is required by Prisma's upsert but is a no-op.
      },
    });

    // Prisma upsert always returns a row. We detect creation vs. no-op
    // by checking if the returned row has our default description.
    // A simpler heuristic: count how many existed before.
    upserted++;
    console.log(`[seed-prompts]   ${key}: "${prompt.label}" → ${result.id}`);
  }

  // Count total after seeding
  const total = await prisma.promptTemplate.count();
  console.log(
    `[seed-prompts] Done. ${upserted} prompt keys processed. ${total} total rows in PromptTemplate.`,
  );
}

main()
  .catch((e) => {
    console.error('[seed-prompts] FAILED:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
