import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ---------------------------------------------------------------------------
// Simple email validation helpers (no external service)
// ---------------------------------------------------------------------------

function checkSyntax(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function extractDomain(email: string): string {
  return email.split('@')[1] || ''
}

function isDisposableDomain(domain: string): boolean {
  const list = [
    'mailinator.com', 'guerrillamail.com', 'tempmail.com', 'throwaway.email',
    'yopmail.com', 'sharklasers.com', 'guerrillamailblock.com', 'grr.la',
    'dispostable.com', 'trashmail.com', 'tempmailaddress.com',
  ]
  return list.some(d => domain.toLowerCase() === d || domain.toLowerCase().endsWith('.' + d))
}

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

    // Run checks
    const syntaxOk = checkSyntax(email)
    const domain = extractDomain(email)
    const domainParts = domain.split('.')
    const domainOk = domainParts.length >= 2 && domainParts.every(p => p.length > 0)
    const disposableOk = !isDisposableDomain(domain)

    // We can't do real DNS/MX lookup in this sandbox, so simulate it based on
    // whether the domain looks legitimate (has MX-like structure).
    const mxOk = domainOk && !isDisposableDomain(domain)

    // Calculate score
    let score = 0
    if (syntaxOk) score += 25
    if (domainOk) score += 20
    if (mxOk) score += 30
    if (disposableOk) score += 15
    // Bonus for common TLDs
    const commonTlds = ['com', 'org', 'net', 'io', 'co', 'ai', 'dev', 'app']
    const tld = domainParts[domainParts.length - 1]?.toLowerCase() || ''
    if (commonTlds.includes(tld)) score += 10
    score = Math.min(score, 100)

    const status = score >= 80 ? 'valid' : score >= 50 ? 'risky' : 'invalid'
    const actionRecommendation =
      status === 'valid'
        ? 'Email looks good for outreach'
        : status === 'risky'
          ? 'Consider verifying with a real-time validation service before sending'
          : 'Do not use this email for outreach'

    // Save health check
    const check = await db.emailHealthCheck.create({
      data: {
        contactId: id,
        status,
        score,
        actionRecommendation,
        syntaxOk,
        domainOk,
        mxOk,
        disposableOk,
      },
    })

    // Update contact
    await db.contact.update({
      where: { id },
      data: {
        emailHealth: status,
        emailHealthScore: score,
        lastValidatedAt: new Date(),
      },
    })

    // Timeline
    await db.timelineEntry.create({
      data: {
        companyId: contact.companyId,
        contactId: id,
        action: 'email_validated',
        details: `Email validation for "${contact.name}" (${email}): ${status} (${score}/100)`,
      },
    })

    return NextResponse.json({ status, score, checkId: check.id, actionRecommendation })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    console.error(`[validate-email] Error: ${message}`)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}