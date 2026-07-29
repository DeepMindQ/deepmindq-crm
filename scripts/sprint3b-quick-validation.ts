/**
 * Sprint 3B — Minimal Validation Script
 * Runs just the small company scenario (critical test case)
 * with Next Best Action to validate the full pipeline.
 * Then expands to Enterprise + Meeting Prep.
 */

import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

async function callAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const { ensureZaiConfig } = await import('../src/lib/zai-config')
  await ensureZaiConfig()
  const ZAI = await import('z-ai-web-dev-sdk').then(m => m.default)
  const zai = await ZAI.create()

  for (let i = 0; i < 3; i++) {
    try {
      const result = await zai.chat.completions.create({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 1500,
      })
      return result.choices[0]?.message?.content || ''
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  Retry ${i+1}/3: ${msg.substring(0, 80)}`)
      if (msg.includes('429')) await new Promise(r => setTimeout(r, 15000))
      else await new Promise(r => setTimeout(r, 3000))
    }
  }
  throw new Error('AI call failed after 3 retries')
}

function parseJSON(raw: string): Record<string, unknown> {
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  try { const o = JSON.parse(cleaned); if (typeof o === 'object') return o as Record<string, unknown> } catch {}
  const m = cleaned.match(/\{[\s\S]*\}/)
  if (m) try { return JSON.parse(m[0]) as Record<string, unknown> } catch {}
  return { raw }
}

async function main() {
  const SCENARIO = process.argv[2] || 'all' // 'enterprise', 'midmarket', 'small', or 'all'
  console.log(`\n═══ Sprint 3B Validation — Scenario: ${SCENARIO} ═══\n`)

  // ── Seed if needed ──
  const localBiz = await db.company.findFirst({ where: { rawName: 'LocalBiz Solutions' } })
  if (!localBiz) {
    console.log('No data found. Run full seed first with sprint3b-validation.ts --all')
    process.exit(1)
  }

  const acme = await db.company.findFirst({ where: { rawName: 'Acme Corp' } })
  const techStart = await db.company.findFirst({ where: { rawName: 'TechStart Inc' } })

  const scenarios: Array<{id: string, name: string, type: string}> = []
  if ((SCENARIO === 'all' || SCENARIO === 'small') && localBiz) scenarios.push({id: localBiz.id, name: 'LocalBiz Solutions', type: 'small_company'})
  if ((SCENARIO === 'all' || SCENARIO === 'enterprise') && acme) scenarios.push({id: acme.id, name: 'Acme Corp', type: 'enterprise'})
  if ((SCENARIO === 'all' || SCENARIO === 'midmarket') && techStart) scenarios.push({id: techStart.id, name: 'TechStart Inc', type: 'midmarket'})

  for (const scenario of scenarios) {
    console.log(`\n${'─'.repeat(60)}`)
    console.log(`  ${scenario.name} (${scenario.type})`)
    console.log(`${'─'.repeat(60)}`)

    const [company, signals, contacts, notes, contactNotes, replies] = await Promise.all([
      db.company.findUnique({ where: { id: scenario.id }, select: { rawName: true, industry: true, sizeRange: true, lifecycleStage: true } }),
      db.companySignal.findMany({ where: { companyId: scenario.id, status: { in: ['detected', 'validated', 'active'] } } }),
      db.contact.findMany({ where: { companyId: scenario.id, status: { not: 'archived' } }, include: { _count: { select: { replies: true, notes: true } } }, orderBy: { leadScore: 'desc' } }),
      db.companyNote.findMany({ where: { companyId: scenario.id }, orderBy: { createdAt: 'desc' }, take: 8 }),
      db.contactNote.findMany({ where: { contact: { companyId: scenario.id } }, orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, body: true, contact: { select: { rawName: true, title: true } } } }),
      db.reply.findMany({ where: { contact: { companyId: scenario.id } }, orderBy: { receivedAt: 'desc' }, take: 6 }),
    ])

    console.log(`  Signals: ${signals.length} | Notes: ${notes.length} | Contact Notes: ${contactNotes.length} | Replies: ${replies.length} | Contacts: ${contacts.length}`)

    // ── Next Best Action ──
    console.log(`\n  → Generating Next Best Action...`)
    const criticalSignals = signals.filter(s => s.severity === 'critical').length
    const championAtRisk = contacts.filter(c => c._count.replies >= 2 && c.leadScore >= 50 && c.lastContactedAt && (Date.now() - c.lastContactedAt.getTime()) / 86400000 > 45)
    const noEngagement = contacts.filter(c => c.status !== 'replied' && c._count.replies === 0 && c.leadScore >= 60)

    const nbaPrompt = `You are a B2B revenue intelligence analyst. Identify the SINGLE most impactful next action a salesperson should take RIGHT NOW for this account.

GROUND RULES:
1. Use ONLY the provided data. DO NOT invent information.
2. Every recommendation MUST trace to a specific signal, note, contact, or email reply.
3. Be specific and actionable — name specific people and reference specific intelligence.
4. Return JSON only.

COMPANY: ${company?.rawName} | ${company?.industry || 'Unknown'} | ${company?.sizeRange || 'Unknown'} | Stage: ${company?.lifecycleStage}

KEY METRICS:
- Critical signals: ${criticalSignals}
- Champions at risk: ${championAtRisk.map(c => c.rawName).join(', ') || 'None'}
- High-value unengaged: ${noEngagement.map(c => c.rawName).join(', ') || 'None'}
- Total contacts: ${contacts.length}

EXTERNAL SIGNALS (${signals.length}):
${signals.slice(0, 8).map((s, i) => `${i+1}. [${s.signalType}/${s.severity}] ${s.title} — ${s.businessImpact || 'No impact'} — Action: ${s.recommendedAction || 'Review'}`).join('\n') || 'NO EXTERNAL SIGNALS'}

INTERNAL NOTES (${notes.length}):
${notes.slice(0, 5).map((n, i) => `${i+1}. [${n.category}] ${n.title}: ${n.body.substring(0, 180)}`).join('\n\n') || 'No internal notes'}

CONTACT NOTES (${contactNotes.length}):
${contactNotes.slice(0, 3).map(n => `- ${n.contact.rawName} (${n.contact.title}): ${n.body.substring(0, 120)}`).join('\n') || 'No contact notes'}

EMAIL REPLIES (${replies.length}):
${replies.slice(0, 4).map(r => `- [${r.category}] ${r.subject}: ${r.body?.substring(0, 100)}`).join('\n') || 'No replies'}

CONTACTS:
${contacts.map(c => `- ${c.rawName} (${c.title || c.role}) — score ${c.leadScore}, ${c._count.replies} replies, ${c.status}`).join('\n')}

Return JSON:
{
  "action": "Specific action (e.g. 'Email Rajesh Kumar with the 15-user proposal')",
  "actionType": "outreach|meeting|follow_up|proposal|escalation",
  "priority": "critical|high|medium|low",
  "urgency": "immediate|within_24_hours|within_7_days|within_30_days",
  "reason": "Why this is the best action right now (2-3 sentences referencing evidence)",
  "evidence": [{"source": "type", "snippet": "exact evidence text"}],
  "expectedOutcome": "What should happen",
  "talkingPoint": "Specific talking point or message to use",
  "successMetric": "How to measure success",
  "alternatives": [{"action": "Alternative", "reason": "Why second choice"}]
}`

    try {
      const raw = await callAI(nbaPrompt, '')
      const parsed = parseJSON(raw) as any
      console.log(`\n  ══ NEXT BEST ACTION ══`)
      console.log(`  Action:       ${parsed.action || 'None'}`)
      console.log(`  Type:         ${parsed.actionType} | Priority: ${parsed.priority} | Urgency: ${parsed.urgency}`)
      console.log(`  Reason:       ${parsed.reason}`)
      console.log(`  Evidence:     ${(parsed.evidence || []).length} sources`)
      for (const e of (parsed.evidence || []).slice(0, 3)) {
        console.log(`    → [${e.source}] ${e.snippet?.substring(0, 100)}`)
      }
      console.log(`  Talking Point: ${parsed.talkingPoint}`)
      console.log(`  Metric:       ${parsed.successMetric}`)
      console.log(`  Outcome:      ${parsed.expectedOutcome}`)
      if (parsed.alternatives?.length > 0) {
        console.log(`  Alternatives:`)
        for (const a of parsed.alternatives.slice(0, 2)) {
          console.log(`    → ${a.action}: ${a.reason}`)
        }
      }
    } catch (err) {
      console.error(`  ✗ NBA FAILED: ${err instanceof Error ? err.message : err}`)
    }

    // ── Meeting Prep ──
    if (scenarios.indexOf(scenario) === 0) { // Only for first scenario to save time
      console.log(`\n  → Generating Meeting Prep...`)
      await new Promise(r => setTimeout(r, 10000)) // Rate limit buffer

      const mpPrompt = `You are a B2B sales meeting preparation assistant. Generate a concise meeting prep brief.
GROUND RULES:
1. Use ONLY the provided data. DO NOT invent.
2. Combine external signals AND internal memory.
3. Internal memory is often MORE valuable for small companies.
4. Return JSON only.

COMPANY: ${company?.rawName} | ${company?.industry} | ${company?.sizeRange} | Stage: ${company?.lifecycleStage}

EXTERNAL SIGNALS (${signals.length}):
${signals.slice(0, 8).map((s, i) => `${i+1}. [${s.signalType}/${s.severity}] ${s.title} — ${s.businessImpact || ''}`).join('\n') || 'NO EXTERNAL SIGNALS'}

INTERNAL NOTES (${notes.length}):
${notes.slice(0, 5).map(n => `[${n.category}] ${n.title}: ${n.body.substring(0, 150)}`).join('\n\n') || 'No notes'}

CONTACT NOTES (${contactNotes.length}):
${contactNotes.map(n => `${n.contact.rawName}: ${n.body.substring(0, 100)}`).join('\n') || 'None'}

EMAIL REPLIES (${replies.length}):
${replies.map(r => `[${r.category}] ${r.subject}: ${r.body?.substring(0, 80)}`).join('\n') || 'None'}

CONTACTS:
${contacts.map(c => `${c.rawName} (${c.title}) — score ${c.leadScore}, ${c._count.replies} replies`).join('\n')}

Return JSON:
{
  "executiveSummary": "2-3 sentences combining external + internal intelligence",
  "keyChanges": [{"change": "What changed", "source": "Where learned", "timing": "When"}],
  "talkingPoints": [{"point": "Talking point", "evidence": "Supporting data", "priority": "high|medium"}],
  "discoveryQuestions": ["Open-ended strategic question"],
  "icebreakers": ["Personalized icebreaker referencing actual intelligence"],
  "risks": ["Risk to prepare for"],
  "recommendedObjective": "What AE should achieve"
}`

      try {
        const raw = await callAI(mpPrompt, '')
        const parsed = parseJSON(raw) as any
        console.log(`\n  ══ MEETING PREP BRIEF ══`)
        console.log(`  Executive Summary: ${parsed.executiveSummary}`)
        console.log(`  Key Changes: ${(parsed.keyChanges || []).length}`)
        for (const k of (parsed.keyChanges || []).slice(0, 3)) console.log(`    → ${k.change} (from ${k.source}, ${k.timing})`)
        console.log(`  Talking Points: ${(parsed.talkingPoints || []).length}`)
        for (const t of (parsed.talkingPoints || []).slice(0, 3)) console.log(`    → [${t.priority}] ${t.point} (evidence: ${t.evidence?.substring(0, 80)})`)
        console.log(`  Discovery Questions: ${(parsed.discoveryQuestions || []).length}`)
        for (const q of (parsed.discoveryQuestions || []).slice(0, 3)) console.log(`    → ${q}`)
        console.log(`  Icebreakers: ${(parsed.icebreakers || []).length}`)
        for (const i of (parsed.icebreakers || []).slice(0, 2)) console.log(`    → ${i}`)
        console.log(`  Risks: ${(parsed.risks || []).length}`)
        for (const r of (parsed.risks || []).slice(0, 3)) console.log(`    → ${r}`)
        console.log(`  Objective: ${parsed.recommendedObjective}`)
      } catch (err) {
        console.error(`  ✗ MP FAILED: ${err instanceof Error ? err.message : err}`)
      }
    }

    // Rate limit buffer between scenarios
    if (scenarios.indexOf(scenario) < scenarios.length - 1) {
      console.log(`\n  ⏳ Waiting 15s before next scenario...`)
      await new Promise(r => setTimeout(r, 15000))
    }
  }

  console.log(`\n${'═'.repeat(60)}`)
  console.log('  VALIDATION COMPLETE')
  console.log(`${'═'.repeat(60)}\n`)
  await db.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
