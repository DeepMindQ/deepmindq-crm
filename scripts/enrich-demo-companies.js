/**
 * DeepMindQ — Standalone Enrichment Runner
 * 
 * Runs the intelligence enrichment pipeline directly via Prisma + ModelRouter,
 * bypassing the Next.js API layer entirely.
 * 
 * Usage: DATABASE_URL=... TAVILY_API_KEY=... node scripts/enrich-demo-companies.js
 */

const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

// ─── Inline the core enrichment logic ─────────────────────────────────────

async function enrichCompany(companyId) {
  const company = await db.company.findUnique({
    where: { id: companyId },
  });
  if (!company) throw new Error(`Company ${companyId} not found`);

  console.log(`\n═══ Enriching: ${company.rawName} (${company.industry}, ${company.country}) ═══`);

  // Step 1: Web search via Tavily
  console.log('  Step 1: Web search...');
  const tavilyKey = process.env.TAVILY_API_KEY;
  if (!tavilyKey) {
    console.log('  ⚠️ No TAVILY_API_KEY, skipping web search');
    return { success: false, error: 'No TAVILY_API_KEY' };
  }

  const searchQueries = [
    `${company.rawName} ${company.industry || ''} news 2025 2026`,
    `${company.rawName} technology digital transformation AI cloud`,
  ];

  const searchResults = [];
  for (const query of searchQueries) {
    try {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: tavilyKey, query, max_results: 5, include_answer: true }),
      });
      if (res.ok) {
        const data = await res.json();
        searchResults.push(...(data.results || []));
        if (data.answer) searchResults.push({ title: 'AI Summary', content: data.answer, url: '', score: 1.0 });
      }
    } catch (e) {
      console.log(`  ⚠️ Search failed for: ${query.substring(0, 50)}`);
    }
  }
  console.log(`  ✅ Found ${searchResults.length} search results`);

  if (searchResults.length === 0) {
    return { success: false, signals: 0, error: 'No search results' };
  }

  // Step 2: Generate signals using LLM
  console.log('  Step 2: LLM signal extraction...');
  const contextText = searchResults.slice(0, 8).map(r => `[${r.title || 'Source'}] ${r.content || r.text || ''}`).join('\n\n');

  const prompt = `Analyze the following intelligence about ${company.rawName}, a ${company.industry || ''} company in ${company.country || 'Unknown'}.
  
INTELLIGENCE SOURCES:
${contextText}

Extract buying signals. Return JSON: { "signals": [{ "title": "...", "type": "technology|funding|leadership|partnership|expansion|product", "description": "...", "severity": "critical|high|medium|low", "confidence": 0.0-1.0, "businessImpact": "...", "recommendedAction": "..." }] }

Max 8 signals. Only return signals with evidence from the sources.`;

  let signals = [];
  try {
    const apiKey = process.env.NVIDIA_API_KEY;
    const apiBase = 'https://integrate.api.nvidia.com/v1';
    const model = 'meta/llama-3.1-8b-instruct';

    const llmRes = await fetch(`${apiBase}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 3000,
      }),
    });
    if (llmRes.ok) {
      const llmData = await llmRes.json();
      const content = llmData.choices?.[0]?.message?.content || '';
      const cleaned = content.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      // Extract JSON from content (handle markdown wrapping)
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        signals = parsed.signals || [];
      }
    }
  } catch (e) {
    console.log('  ⚠️ LLM failed:', e.message?.substring(0, 100));
  }
  console.log(`  ✅ Extracted ${signals.length} signals`);

  // Step 3: Save signals + evidence to DB
  console.log('  Step 3: Persisting to database...');
  let signalCount = 0;
  let evidenceCount = 0;

  for (const signal of signals) {
    try {
      const created = await db.companySignal.create({
        data: {
          companyId,
          title: signal.title,
          signalType: signal.type || 'technology',
          description: signal.description || '',
          severity: signal.severity || 'medium',
          confidence: Math.min(1, Math.max(0, signal.confidence || 0.5)),
          businessImpact: signal.businessImpact || '',
          recommendedAction: signal.recommendedAction || '',
          source: 'tavily_web',
          status: 'active',
        },
      });
      signalCount++;

      // Create evidence from search results
      for (const result of searchResults.slice(0, 3)) {
        try {
          await db.evidence.create({
            data: {
              companyId,
              signalId: created.id,
              sourceName: result.title || 'Web Source',
              sourceUrl: result.url || '',
              snippet: (result.content || result.text || '').substring(0, 500),
              reliability: 0.7,
              status: 'active',
            },
          });
          evidenceCount++;
        } catch { /* skip duplicate evidence */ }
      }
    } catch (e) {
      console.log(`  ⚠️ Signal create error:`, e.message?.substring(0, 80));
    }
  }
  console.log(`  ✅ Saved ${signalCount} signals, ${evidenceCount} evidence records`);

  // Step 4: Create research card
  console.log('  Step 4: Creating research card...');
  try {
    const existingCard = await db.companyResearchCard.findUnique({ where: { companyId } });
    if (existingCard) {
      await db.companyResearchCard.update({
        where: { companyId },
        data: { businessOverview: searchResults.slice(0, 3).map(r => r.content || '').join(' ').substring(0, 1000) },
      });
    } else {
      await db.companyResearchCard.create({
        data: { companyId, businessOverview: searchResults.slice(0, 3).map(r => r.content || '').join(' ').substring(0, 1000) },
      });
    }
    console.log('  ✅ Research card created/updated');
  } catch (e) {
    console.log('  ⚠️ Research card error:', e.message?.substring(0, 80));
  }

  // Step 5: Update company
  await db.company.update({
    where: { id: companyId },
    data: { lastEnrichedAt: new Date() },
  });

  return { success: true, signals: signalCount, evidence: evidenceCount };
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  DeepMindQ — Demo Company Enrichment');
  console.log('═══════════════════════════════════════════════════════════');

  const companies = await db.company.findMany({
    where: { source: 'demo' },
    select: { id: true, rawName: true },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`\nFound ${companies.length} demo companies to enrich\n`);

  const results = [];
  for (const company of companies) {
    try {
      const result = await enrichCompany(company.id);
      results.push({ name: company.rawName, ...result });
    } catch (e) {
      console.log(`  ❌ Fatal error for ${company.rawName}: ${e.message?.substring(0, 100)}`);
      results.push({ name: company.rawName, success: false, error: e.message });
    }
    // Small delay between companies to avoid rate limits
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  RESULTS SUMMARY');
  console.log('═══════════════════════════════════════════════════════════');
  for (const r of results) {
    const icon = r.success ? '✅' : '❌';
    console.log(`  ${icon} ${r.name}: ${r.signals || 0} signals, ${r.evidence || 0} evidence`);
  }

  const total = results.reduce((a, r) => a + (r.signals || 0), 0);
  console.log(`\n  Total: ${results.filter(r => r.success).length}/${companies.length} enriched, ${total} signals generated`);
}

main().catch(console.error).finally(() => db.$disconnect());
