/**
 * Wave 8A Validation 3 — Test z-ai-web-dev-sdk
 * Measures: SDK init time, LLM call latency, web search latency, token estimation
 */
async function main() {
  const start = Date.now();
  
  // 1. Config
  const { ensureZaiConfig } = await import('../src/lib/zai-config');
  await ensureZaiConfig();
  const configTime = Date.now() - start;
  console.log(`[1] Config init: ${configTime}ms`);

  // 2. SDK create
  const sdkStart = Date.now();
  const ZAI = await import('z-ai-web-dev-sdk').then(m => m.default);
  const zai = await ZAI.create();
  const sdkTime = Date.now() - sdkStart;
  console.log(`[2] SDK create: ${sdkTime}ms`);
  console.log(`    SDK type: ${typeof zai}`);
  console.log(`    Available: chat=${!!zai.chat} functions=${!!zai.functions}`);

  // 3. Simple LLM call
  const llmStart = Date.now();
  try {
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: 'You are a concise business analyst. Respond in under 50 words.' },
        { role: 'user', content: 'What is the primary business model of Salesforce?' }
      ],
      thinking: { type: 'disabled' },
    });
    const llmTime = Date.now() - llmStart;
    const content = completion?.choices?.[0]?.message?.content || '(empty)';
    const usage = completion?.usage;
    console.log(`[3] LLM call: ${llmTime}ms`);
    console.log(`    Response: "${content.slice(0, 100)}..."`);
    console.log(`    Usage: prompt=${usage?.prompt_tokens ?? '?'} completion=${usage?.completion_tokens ?? '?'} total=${usage?.total_tokens ?? '?'}`);
    console.log(`    Model: ${completion?.model ?? 'unknown'}`);
  } catch (err) {
    const llmTime = Date.now() - llmStart;
    console.log(`[3] LLM call FAILED after ${llmTime}ms: ${err}`);
  }

  // 4. Web search call
  const searchStart = Date.now();
  try {
    const results = await zai.functions.invoke('web_search', { query: 'Microsoft Azure AI 2026', num: 3 });
    const searchTime = Date.now() - searchStart;
    const items = results?.results ?? results?.data ?? results;
    const count = Array.isArray(items) ? items.length : 0;
    console.log(`[4] Web search: ${searchTime}ms, ${count} results`);
    if (count > 0) {
      console.log(`    First: "${items[0]?.title?.slice(0, 60) || '(no title)'}"`);
    }
  } catch (err) {
    const searchTime = Date.now() - searchStart;
    console.log(`[4] Web search FAILED after ${searchTime}ms: ${err}`);
  }

  console.log(`\n=== TOTAL: ${Date.now() - start}ms ===`);
}

main().catch(console.error);
