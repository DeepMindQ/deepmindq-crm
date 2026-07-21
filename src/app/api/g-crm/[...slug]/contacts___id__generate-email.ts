import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { apiError, apiSuccess } from '@/lib/apiHelpers'
import { governedAICall } from '@/lib/ai-governance'
import { getResearchContext, buildResearchContextText } from '@/lib/intelligence-contract'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LLMResult = { subject: string; body: string } | null

function parseLlmJson(raw: string): LLMResult {
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  try {
    const obj = JSON.parse(cleaned)
    if (obj.subject && obj.body) return { subject: obj.subject, body: obj.body }
  } catch { /* fall through */ }

  const match = cleaned.match(/\{[\s\S]*"subject"[\s\S]*"body"[\s\S]*\}/)
  if (match) {
    try {
      const obj = JSON.parse(match[0])
      if (obj.subject && obj.body) return { subject: obj.subject, body: obj.body }
    } catch { /* fall through */ }
  }
  return null
}

// ---------------------------------------------------------------------------
// Template fallback
// ---------------------------------------------------------------------------

function generateFromTemplates(
  firstName: string,
  companyName: string,
  jobTitle: string,
  tone: string,
  emailLength: string,
  ctaStyle: string,
): { subject: string; body: string } {
  const bodies: Record<string, Record<string, string>> = {
    'professional-casual': {
      short: `Hi ${firstName},\n\nI came across ${companyName} and was impressed by your work in the ${jobTitle} space. I'd love to explore how we might be able to add value.\n\nWould a quick 10-minute chat work this week?`,
      medium: `Hi ${firstName},\n\nI've been following ${companyName}'s recent momentum in the ${jobTitle} domain, and it caught my attention. Our team has helped similar organizations streamline their operations with measurable results.\n\n${ctaStyle === 'direct' ? 'Could we schedule a 15-minute call this Thursday at 2 PM to discuss a potential fit?' : "Would you be open to a brief conversation this week to explore if there's alignment?"}\n\nBest regards`,
      detailed: `Hi ${firstName},\n\nI hope this message finds you well. I've been researching ${companyName} and I'm genuinely impressed by the direction you're taking in the ${jobTitle} area.\n\nAt DeepMindQ, we've been working with organizations facing similar challenges. Our approach combines AI-driven intelligence with hands-on strategic consulting.\n\n${ctaStyle === 'direct' ? `I'd love to show you a brief 15-minute demo of what this could look like for ${companyName}. Could we schedule a call this Thursday?` : "Would you be open to exploring this further?"}\n\nLooking forward to connecting,\nRavi`,
    },
    direct: {
      short: `${firstName},\n\n${companyName} looks like it's doing great things. Quick question: have you considered optimizing your ${jobTitle} workflow?\n\n${ctaStyle === 'direct' ? "Let's talk Thursday 2 PM — 15 minutes max." : "Open to a chat if you're curious?"}`,
      medium: `${firstName},\n\n${ctaStyle === 'direct' ? "Let's cut to it — 15 min call this Thursday?" : "Worth 15 minutes of your time this week to explore if there's a fit."}\n\nWe've helped similar companies in the ${jobTitle} space.`,
    },
  }

  const toneBodies = bodies[tone] || bodies['professional-casual']
  const body = toneBodies[emailLength || 'medium'] || toneBodies['medium']
  const ctaText = ctaStyle === 'direct' ? 'Direct CTA' : 'Soft CTA'
  const subject = `${ctaText}: Quick question about ${companyName}`
  return { subject, body }
}

// ---------------------------------------------------------------------------
// REWIRED: Uses Phase 3 intelligence-contract. No independent web search.
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { tone: requestTone, emailLength: requestLength, ctaStyle: requestCta } = body

    // 1. Fetch contact with company
    const contact = await db.contact.findUnique({
      where: { id },
      include: { company: true },
    })
    if (!contact) {
      return apiError('Contact not found', 404)
    }

    // 2. Read preferences from request body (no UserPreferences model)
    const tone = requestTone || 'professional-casual'
    const emailLength = requestLength || 'medium'
    const ctaStyle = requestCta || 'soft'
    const companyName = contact.company?.rawName || contact.company?.normalizedName || 'your company'
    const firstName = (contact.rawName || contact.normalizedName || 'there').split(' ')[0]
    const jobTitle = contact.title || contact.role || 'your role'
    const industry = contact.company?.industry || 'Unknown'

    // 3. Knowledge Engine: search for relevant capability assets
    const allAssets = await db.capabilityAsset.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    })

    const STOP_WORDS = new Set(['a','an','the','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would','shall','should','may','might','can','could','of','in','to','for','with','on','at','by','from','as','into','through','during','before','after','above','below','between','out','off','over','under','again','further','then','once','here','there','when','where','why','how','all','both','each','few','more','most','other','some','such','no','nor','not','only','own','same','so','than','too','very','just','because','but','and','or','if','while','about','up','it','its','this','that','these','those','i','me','my','we','our','you','your','he','him','his','she','her','they','them','their','what','which','who','whom','also','etc'])
    function tok(t: string) { return t.toLowerCase().replace(/[^a-z0-9\s-]/g,' ').split(/\s+/).filter(w=>w.length>1&&!STOP_WORDS.has(w)) }

    const queryTokens = tok(`${industry} ${jobTitle} ${companyName}`)
    const scoredAssets = allAssets.map(s => {
      let sc = 0
      const sTokens = new Set(tok(s.title + ' ' + (s.content || '')))
      if (s.targetIndustries) {
        const si = s.targetIndustries.split(',').map((x: string) => x.trim().toLowerCase())
        if (si.includes(industry.toLowerCase())) sc += 30
        else { const iw = industry.toLowerCase().split(/[\s-]+/); sc += iw.filter(w => si.some(x => x.includes(w) || w.includes(x))).length * 10 }
      }
      sc += queryTokens.filter(t => new Set(tok(s.title)).has(t)).length * 5
      sc += Math.min(queryTokens.filter(t => sTokens.has(t)).length * 2, 15)
      const contentLen = s.content?.length || 0
      if (contentLen > 200) sc += 3
      if (contentLen > 500) sc += 2
      return { ...s, _score: sc }
    }).sort((a, b) => b._score - a._score).slice(0, 5).filter(s => s._score > 0)

    const knowledgeContext = scoredAssets.length > 0
      ? `Relevant capabilities:\n${scoredAssets.map(s => `- [${s.category}] ${s.title}: ${s.content || s.summary}`).join('\n')}`
      : ''
    const retrievedContext = scoredAssets.map(s => ({
      id: s.id, title: s.title, type: s.category, score: s._score,
    }))

    // ── 4. CONSUME PHASE 3 INTELLIGENCE (no independent web search) ──
    let researchContext = ''
    let freshnessScore = 0
    let hasResearch = false

    if (contact.companyId) {
      try {
        const ctx = await getResearchContext(contact.companyId)
        if (ctx.researchCard) {
          hasResearch = true
          researchContext = buildResearchContextText(ctx)
          freshnessScore = ctx.freshness.score
        }
      } catch (err) {
        console.warn('[generate-email] Failed to load Phase 3 context:', err instanceof Error ? err.message : err)
      }
    }

    // 5. Calculate scores
    let matchScore = 50
    if (hasResearch) matchScore += 15
    if (scoredAssets.length > 0) matchScore += Math.min(scoredAssets.length * 3, 15)
    if (contact.title) matchScore += 5
    if (contact.company?.industry) matchScore += 5
    if (contact.email) matchScore += 10
    matchScore = Math.min(matchScore, 99)

    let confidenceScore = 40
    if (hasResearch) confidenceScore += 20
    if (freshnessScore >= 50) confidenceScore += 10
    if (scoredAssets.length >= 3) confidenceScore += 15
    else if (scoredAssets.length > 0) confidenceScore += scoredAssets.length * 5
    if (contact.company?.industry) confidenceScore += 10
    if (contact.title && contact.email) confidenceScore += 15
    confidenceScore = Math.min(confidenceScore, 99)

    // 6. Try LLM generation using Phase 3 context
    let subject = ''
    let emailBody = ''
    let usedLlm = false

    {
      const systemPrompt = `You are an expert B2B sales email writer. Generate a personalized outreach email with these parameters:
- Contact: ${contact.rawName || contact.normalizedName}, ${jobTitle} at ${companyName} (${industry})
- Tone: ${tone}
- Length: ${emailLength}
- CTA Style: ${ctaStyle}

${researchContext ? `${researchContext}\n` : ''}${knowledgeContext ? `${knowledgeContext}\n` : ''}Respond in JSON format: { "subject": "...", "body": "..." }`

      try {
        const emailResult = await governedAICall({
          generationType: 'email_draft',
          companyId: contact.companyId,
          contactId: contact.id,
          researchContext: (researchContext || null) as any,
          systemPrompt,
          userPrompt: 'Generate the email now.',
          enforceGovernance: false,
          inputParams: { contactId: contact.id, companyId: contact.companyId },
        });
        if (emailResult.success && emailResult.response) {
          const result = parseLlmJson(emailResult.response);
          if (result) {
            subject = result.subject;
            emailBody = result.body;
            usedLlm = true;
          }
        }
      } catch (llmErr: unknown) {
        const msg = llmErr instanceof Error ? llmErr.message : String(llmErr)
        console.error('[generate-email] LLM call failed:', msg)
      }
    }

    // 7. Fallback to templates
    if (!usedLlm) {
      const tmpl = generateFromTemplates(firstName, companyName, jobTitle, tone, emailLength, ctaStyle)
      subject = tmpl.subject
      emailBody = tmpl.body
    }

    // 8. Save as Draft
    const draft = await db.draft.create({
      data: {
        contactId: id,
        subject,
        body: emailBody,
        cta: ctaStyle,
        status: 'draft',
        confidenceScore,
      },
    })

    // 9. Return
    return apiSuccess({
      subject,
      body: emailBody,
      matchScore,
      confidence: matchScore >= 80 ? 'high' : matchScore >= 60 ? 'medium' : 'low',
      tone,
      emailLength,
      ctaStyle,
      draftId: draft.id,
      knowledgeUsed: retrievedContext,
      knowledgeAvailable: allAssets.length,
      intelligenceSource: hasResearch ? 'phase3' : 'none',
      researchFreshness: freshnessScore,
    })
  } catch {
    return apiError('Failed to generate email')
  }
}