import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { apiError } from '@/lib/apiHelpers'
import { validateEmail } from '@/lib/email-verification'

// ---------------------------------------------------------------------------
// POST /api/contacts/:id/validate
// ---------------------------------------------------------------------------

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    const contact = await db.contact.findUnique({
      where: { id },
      include: { company: true },
    })

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    const email = contact.email
    if (!email) {
      // No email to validate
      await db.contact.update({
        where: { id },
        data: { emailHealth: 'invalid', emailHealthScore: 0 },
      })

      await db.companyTimelineEvent.create({
        data: {
          companyId: contact.companyId!,
          eventType: 'signal',
          title: 'Email Validated',
          description: `Email validation for "${contact.rawName}": no email found`,
        },
      })

      return NextResponse.json({
        status: 'invalid',
        score: 0,
        contact: { id: contact.id, name: contact.rawName, email: contact.email },
      })
    }

    // Run comprehensive validation via the shared engine
    const result = await validateEmail(email)

    // Map nullable DNS results to booleans for the DB schema (Boolean @default(false))
    const mxOk = result.mxOk ?? false

    // Update contact
    await db.contact.update({
      where: { id },
      data: {
        emailHealth: result.status,
        emailHealthScore: result.score,
      },
    })

    // Timeline
    await db.companyTimelineEvent.create({
      data: {
        companyId: contact.companyId!,
        eventType: 'signal',
        title: 'Email Validated',
        description: `Email validation for "${contact.rawName}" (${email}): ${result.status} (${result.score}/100)`,
      },
    })

    return NextResponse.json({
      status: result.status,
      score: result.score,
      actionRecommendation: result.recommendation,
      contact: {
        id: contact.id,
        name: contact.rawName,
        email: contact.email,
        company: contact.company?.normalizedName ?? null,
      },
      details: {
        syntaxOk: result.syntaxOk,
        domainOk: result.domainOk,
        mxOk: result.mxOk,
        disposableOk: result.disposableOk,
        spfOk: result.spfOk,
        dmarcOk: result.dmarcOk,
        tldScore: result.tldScore,
      },
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    console.error(`[validate-email] Error: ${message}`)
    return apiError('Email validation failed. Please try again later.')
  }
}