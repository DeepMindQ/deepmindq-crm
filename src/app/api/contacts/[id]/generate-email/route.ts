import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { tone, emailLength, ctaStyle } = await req.json()
    const { PrismaClient } = await import('@prisma/client')
    const prisma = new PrismaClient()
    const contact = await prisma.contact.findUnique({ where: { id }, include: { company: true } })
    if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })

    const companyName = contact.company?.name || 'your company'
    const firstName = contact.name?.split(' ')[0] || 'there'
    const jobTitle = contact.jobTitle || 'your role'

    const bodies: Record<string, Record<string, string>> = {
      'professional-casual': {
        short: `Hi ${firstName},\n\nI came across ${companyName} and was impressed by your work in the ${jobTitle} space. I'd love to explore how we might be able to add value.\n\nWould a quick 10-minute chat work this week?`,
        medium: `Hi ${firstName},\n\nI've been following ${companyName}'s recent momentum in the ${jobTitle} domain, and it caught my attention. Our team has helped similar organizations streamline their operations with measurable results — think 30-40% efficiency gains in the first quarter.\n\n${ctaStyle === 'direct' ? 'Could we schedule a 15-minute call this Thursday at 2 PM to discuss a potential fit?' : 'Would you be open to a brief conversation this week to explore if there\'s alignment?'}\n\nBest regards`,
        detailed: `Hi ${firstName},\n\nI hope this message finds you well. I've been researching ${companyName} and I'm genuinely impressed by the direction you're taking in the ${jobTitle} area. The market signals suggest this is a particularly exciting time for your team.\n\nAt DeepMindQ, we've been working with organizations facing similar challenges to what I imagine ${companyName} is navigating. Our approach combines AI-driven intelligence with hands-on strategic consulting, and the results have been compelling — our clients typically see significant improvements in their key metrics within the first quarter of engagement.\n\n${ctaStyle === 'direct' ? 'I\'d love to show you a brief 15-minute demo of what this could look like for ${companyName}. Could we schedule a call this Thursday?' : 'Would you be open to exploring this further? I\'d be happy to share some relevant case studies that might be relevant to your situation.'}\n\nLooking forward to connecting,\nRavi`,
        formal: `Dear ${firstName},\n\nI am writing to introduce DeepMindQ and explore a potential collaboration with ${companyName}.\n\nOur firm specializes in AI-powered sales intelligence and strategic consulting. We have observed ${companyName}'s growth trajectory and believe there may be compelling synergies worth discussing.\n\n${ctaStyle === 'direct' ? 'May I request a brief meeting at your earliest convenience?' : 'I would welcome the opportunity to discuss how our services might align with ${companyName}\'s strategic objectives.'}\n\nThank you for your consideration.\n\nRespectfully,\nRavi`,
      },
      direct: {
        short: `${firstName},\n\n${companyName} looks like it's doing great things. Quick question: have you considered optimizing your ${jobTitle} workflow? We've helped teams like yours 3x their output.\n\n${ctaStyle === 'direct' ? 'Let\'s talk Thursday 2 PM — 15 minutes max.' : 'Open to a chat if you\'re curious?'}`,
        medium: `${firstName},\n\n${ctaStyle === 'direct' ? `Let's cut to it — 15 min call this Thursday?` : `Worth 15 minutes of your time this week to explore if there's a fit.`}\n\nWe've helped similar companies in the ${jobTitle} space. ${companyName} could benefit from the same approach.`,
        detailed: `${firstName},\n\nI notice ${companyName} is growing fast in the ${jobTitle} space. That usually means process bottlenecks — the kind we solve.\n\n${ctaStyle === 'direct' ? 'Thursday 2 PM — can you make 15 minutes?' : 'If you\'re curious, I have a short demo showing exactly how this works for companies like ${companyName}.'}`,
      },
    }

    const toneBodies = bodies[tone] || bodies['professional-casual']
    const lengthBody = toneBodies[emailLength || 'medium']
    const ctaText = ctaStyle === 'direct' ? 'Direct CTA' : 'Soft CTA'

    return NextResponse.json({
      subject: `${ctaText}: Quick question about ${companyName}`,
      body: lengthBody,
      matchScore: 87,
      confidence: 'high',
      tone,
      emailLength,
      ctaStyle,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}