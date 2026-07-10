import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
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
      const check = await db.emailHealthCheck.create({
        data: {
          contactId: id,
          status: 'invalid',
          score: 0,
          actionRecommendation: 'No email address on file',
          syntaxOk: false,
          domainOk: false,
          mxOk: false,
          disposableOk: false,
        },
      })

      await db.contact.update({
        where: { id },
        data: { emailHealth: 'invalid', emailHealthScore: 0, lastValidatedAt: new Date() },
      })

      await db.timelineEntry.create({
        data: {
          companyId: contact.companyId,
          contactId: id,
          action: 'email_validated',
          details: `Email validation for "${contact.name}": no email found`,
        },
      })

      return NextResponse.json({ status: 'invalid', score: 0, checkId: check.id })
    }

    // Run comprehensive validation via the shared engine
    const result = await validateEmail(email)

    // Map nullable DNS results to booleans for the DB schema (Boolean @default(false))
    const mxOk = result.mxOk ?? false

    // Save health check
    const check = await db.emailHealthCheck.create({
      data: {
        contactId: id,
        status: result.status,
        score: result.score,
        actionRecommendation: result.recommendation,
        syntaxOk: result.syntaxOk,
        domainOk: result.domainOk,
        mxOk,
        disposableOk: result.disposableOk,
      },
    })

    // Update contact
    await db.contact.update({
      where: { id },
      data: {
        emailHealth: result.status,
        emailHealthScore: result.score,
        lastValidatedAt: new Date(),
      },
    })

    // Timeline
    await db.timelineEntry.create({
      data: {
        companyId: contact.companyId,
        contactId: id,
        action: 'email_validated',
        details: `Email validation for "${contact.name}" (${email}): ${result.status} (${result.score}/100)`,
      },
    })

    return NextResponse.json({
      status: result.status,
      score: result.score,
      checkId: check.id,
      actionRecommendation: result.recommendation,
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
    return NextResponse.json({ error: message }, { status: 500 })
  }
}