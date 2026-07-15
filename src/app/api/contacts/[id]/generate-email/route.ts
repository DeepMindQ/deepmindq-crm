import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { apiError, apiSuccess } from '@/lib/apiHelpers'

// ---------------------------------------------------------------------------
// LLM helper — uses z-ai-web-dev-sdk (auth handled internally)
// ---------------------------------------------------------------------------

type LLMResult = { subject: string; body: string } | null

async function callAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const ZAI = await import('z-ai-web-dev-sdk').then(m => m.default).then(Z => Z.create())
  const completion = await ZAI.chat.completions.create({
    messages: [
      { role: 'assistant', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    thinking: { type: 'disabled' },
  })
  return completion.choices?.[0]?.message?.content ?? ''
}

// ---------------------------------------------------------------------------
// JSON extraction from LLM output (tolerant of markdown fences)
// ---------------------------------------------------------------------------

function parseLlmJson(raw: string): LLMResult {
  const cleaned = raw
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim()

  try {
    const obj = JSON.parse(cleaned)
    if (obj.subject && obj.body) return { subject: obj.subject, body: obj.body }
  } catch {
    // fall through
  }

  const match = cleaned.match(/\{[\s\S]*"subject"[\s\S]*"body"[\s\S]*\}/)
  if (match) {
    try {
      const obj = JSON.parse(match[0])
      if (obj.subject && obj.body) return { subject: obj.subject, body: obj.body }
    } catch {
      // fall through
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Template fallback (preserved from original)
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
      medium: `Hi ${firstName},\n\nI've been following ${companyName}'s recent momentum in the ${jobTitle} domain, and it caught my attention. Our team has helped similar organizations streamline their operations with measurable results — think 30-40% efficiency gains in the first quarter.\n\n${ctaStyle === 'direct' ? 'Could we schedule a 15-minute call this Thursday at 2 PM to discuss a potential fit?' : "Would you be open to a brief conversation this week to explore if there's alignment?"}\n\nBest regards`,
      detailed: `Hi ${firstName},\n\nI hope this message finds you well. I've been researching ${companyName} and I'm genuinely impressed by the direction you're taking in the ${jobTitle} area. The market signals suggest this is a particularly exciting time for your team.\n\nAt DeepMindQ, we've been working with organizations facing similar challenges to what I imagine ${companyName} is navigating. Our approach combines AI-driven intelligence with hands-on strategic consulting, and the results have been compelling — our clients typically see significant improvements in their key metrics within the first quarter of engagement.\n\n${ctaStyle === 'direct' ? `I'd love to show you a brief 15-minute demo of what this could look like for ${companyName}. Could we schedule a call this Thursday?` : "Would you be open to exploring this further? I'd be happy to share some relevant case studies that might be relevant to your situation."}\n\nLooking forward to connecting,\nRavi`,
      formal: `Dear ${firstName},\n\nI am writing to introduce DeepMindQ and explore a potential collaboration with ${companyName}.\n\nOur firm specializes in AI-powered sales intelligence and strategic consulting. We have observed ${companyName}'s growth trajectory and believe there may be compelling synergies worth discussing.\n\n${ctaStyle === 'direct' ? 'May I request a brief meeting at your earliest convenience?' : `I would welcome the opportunity to discuss how our services might align with ${companyName}'s strategic objectives.`}\n\nThank you for your consideration.\n\nRespectfully,\nRavi`,
    },
    direct: {
      short: `${firstName},\n\n${companyName} looks like it's doing great things. Quick question: have you considered optimizing your ${jobTitle} workflow? We've helped teams like yours 3x their output.\n\n${ctaStyle === 'direct' ? "Let's talk Thursday 2 PM — 15 minutes max." : "Open to a chat if you're curious?"}`,
      medium: `${firstName},\n\n${ctaStyle === 'direct' ? "Let's cut to it — 15 min call this Thursday?" : "Worth 15 minutes of your time this week to explore if there's a fit."}\n\nWe've helped similar companies in the ${jobTitle} space. ${companyName} could benefit from the same approach.`,
      detailed: `${firstName},\n\nI notice ${companyName} is growing fast in the ${jobTitle} space. That usually means process bottlenecks — the kind we solve.\n\n${ctaStyle === 'direct' ? 'Thursday 2 PM — can you make 15 minutes?' : `If you're curious, I have a short demo showing exactly how this works for companies like ${companyName}.`}`,
    },
  }

  const toneBodies = bodies[tone] || bodies['professional-casual']
  const body = toneBodies[emailLength || 'medium'] || toneBodies['medium']
  const ctaText = ctaStyle === 'direct' ? 'Direct CTA' : 'Soft CTA'
  const subject = `${ctaText}: Quick question about ${companyName}`

  return { subject, body }
}

// ---------------------------------------------------------------------------
// Score calculation
// ---------------------------------------------------------------------------

function calculateScores(
  hasResearch: boolean,
  snippetCount: number,
  hasTitle: boolean,
  hasIndustry: boolean,
  hasEmail: boolean,
): { matchScore: number; confidenceScore: number } {
  let matchScore = 50
  if (hasResearch) matchScore += 15
  if (snippetCount > 0) matchScore += Math.min(snippetCount * 3, 15)
  if (hasTitle) matchScore += 5
  if (hasIndustry) matchScore += 5
  if (hasEmail) matchScore += 10
  matchScore = Math.min(matchScore, 99)

  let confidenceScore = 40
  if (hasResearch) confidenceScore += 20
  if (snippetCount >= 3) confidenceScore += 15
  else if (snippetCount > 0) confidenceScore += snippetCount * 5
  if (hasIndustry) confidenceScore += 10
  if (hasTitle && hasEmail) confidenceScore += 15
  confidenceScore = Math.min(confidenceScore, 99)

  return { matchScore, confidenceScore }
}

// ---------------------------------------------------------------------------
// Main route handler
// TODO: Add rate limiting (e.g., express-rate-limit or upstash/ratelimit)
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

    // 2. Read user preferences (singleton)
    const prefs = await db.userPreferences.findFirst()
    const tone = requestTone || prefs?.tone || 'professional-casual'
    const emailLength = requestLength || prefs?.emailLength || 'medium'
    const ctaStyle = requestCta || prefs?.ctaStyle || 'soft'
    const openerStyle = prefs?.openerStyle || 'Hi [First Name]'
    const signOff = prefs?.signOff || 'Regards, Ravi'
    const avoidPhrases = prefs?.avoidPhrases || ''
    const companyName = contact.company?.name || 'your company'
    const firstName = contact.name?.split(' ')[0] || 'there'
    const jobTitle = contact.jobTitle || 'your role'
    const industry = contact.company?.industry || 'Unknown'

    // 3. Knowledge Engine: semantic search for relevant snippets
    const allSnippets = await db.capabilitySnippet.findMany({
      include: { document: { select: { title: true, fileName: true } } },
      orderBy: { createdAt: 'desc' },
    })

    // Score snippets using same algorithm as /api/knowledge/search
    const STOP_WORDS = new Set(['a','an','the','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would','shall','should','may','might','can','could','of','in','to','for','with','on','at','by','from','as','into','through','during','before','after','above','below','between','out','off','over','under','again','further','then','once','here','there','when','where','why','how','all','both','each','few','more','most','other','some','such','no','nor','not','only','own','same','so','than','too','very','just','because','but','and','or','if','while','about','up','it','its','this','that','these','those','i','me','my','we','our','you','your','he','him','his','she','her','they','them','their','what','which','who','whom','also','etc'])
    function tok(t: string) { return t.toLowerCase().replace(/[^a-z0-9\s-]/g,' ').split(/\s+/).filter(w=>w.length>1&&!STOP_WORDS.has(w)) }

    const queryTokens = tok(`${industry} ${jobTitle} ${companyName}`)
    const scoredSnippets = allSnippets.map(s => {
      let sc = 0
      const cLower = s.content.toLowerCase()
      const tLower = s.title.toLowerCase()
      const sTokens = new Set(tok(s.title+' '+s.content))
      if (s.industries) {
        const si = s.industries.split(',').map(x=>x.trim().toLowerCase())
        if (si.includes(industry.toLowerCase())) sc += 30
        else { const iw = industry.toLowerCase().split(/[\s-]+/); sc += iw.filter(w=>si.some(x=>x.includes(w)||w.includes(x))).length*10 }
      }
      sc += queryTokens.filter(t=>new Set(tok(s.title)).has(t)).length*5
      sc += Math.min(queryTokens.filter(t=>sTokens.has(t)).length*2, 15)
      if (s.outcomes) { const ot=tok(s.outcomes); sc += queryTokens.filter(t=>ot.includes(t)).length*3 }
      if (s.content.length>200) sc+=3
      if (s.content.length>500) sc+=2
      return { ...s, _score: sc }
    }).sort((a,b)=>b._score-a._score).slice(0,5).filter(s=>s._score>0)

    const knowledgeContext = scoredSnippets.length > 0
      ? `Relevant knowledge / capability snippets:\n${scoredSnippets.map((s) => `- [${s.title}] ${s.content}`).join('\n')}`
      : ''
    const retrievedContext = scoredSnippets.map(s => ({
      id: s.id,
      title: s.title,
      type: s.snippetType,
      score: s._score,
      industries: s.industries ? s.industries.split(',').map((x:string)=>x.trim()) : [],
    }))

    // 4. Fetch company research card
    const researchCard = contact.companyId
      ? await db.companyResearchCard.findUnique({ where: { companyId: contact.companyId } })
      : null
    const researchContext = researchCard
      ? `Company research for ${companyName}:\n` +
        [
          researchCard.businessOverview && `Business Overview: ${researchCard.businessOverview}`,
          researchCard.currentTechLandscape && `Tech Landscape: ${researchCard.currentTechLandscape}`,
          researchCard.potentialChallenges && `Challenges: ${researchCard.potentialChallenges}`,
          researchCard.possibleOpportunities && `Opportunities: ${researchCard.possibleOpportunities}`,
          researchCard.relevantServices && `Relevant Services: ${researchCard.relevantServices}`,
        ]
          .filter(Boolean)
          .join('\n')
      : ''

    // 5. Calculate scores
    const { matchScore, confidenceScore } = calculateScores(
      !!researchCard,
      scoredSnippets.length,
      !!contact.jobTitle,
      !!contact.company?.industry,
      !!contact.email,
    )

    // 6. Try LLM generation
    let subject = ''
    let emailBody = ''
    let usedLlm = false

    {
      const systemPrompt = `You are an expert B2B sales email writer. Generate a personalized outreach email with these parameters:
- Contact: ${contact.name}, ${jobTitle} at ${companyName} (${industry})
- Tone: ${tone}
- Length: ${emailLength}
- CTA Style: ${ctaStyle}
- Opener: ${openerStyle}
- Sign-off: ${signOff}
- Avoid phrases: ${avoidPhrases || 'none'}

${researchContext ? `${researchContext}\n` : ''}${knowledgeContext ? `${knowledgeContext}\n` : ''}Respond in JSON format: { "subject": "...", "body": "..." }`

      try {
        const text = await callAI(systemPrompt, 'Generate the email now.')
        const result = parseLlmJson(text)
        if (result) {
          subject = result.subject
          emailBody = result.body
          usedLlm = true
        }
      } catch (llmErr: unknown) {
        const msg = llmErr instanceof Error ? llmErr.message : String(llmErr)
        console.error('[generate-email] LLM call failed:', msg)
        // H8: Fall through to template — don't leak raw error messages
      }
    }

    // 7. Fallback to templates if LLM didn't produce a result
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
        matchScore,
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
      knowledgeAvailable: allSnippets.length,
    })
  } catch {
    // H8: Don't leak raw error messages
    return apiError('Failed to generate email')
  }
}