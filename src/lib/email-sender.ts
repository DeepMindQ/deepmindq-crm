import nodemailer from 'nodemailer'

// ── Types ────────────────────────────────────────────────────────────

export interface SendEmailOptions {
  to: string
  subject: string
  html: string
  text?: string
  replyTo?: string
  from?: string
}

export interface SendResult {
  success: boolean
  messageId?: string
  error?: string
}

// ── Transporter factory ──────────────────────────────────────────────

function createTransporter() {
  const host = process.env.SMTP_HOST
  if (!host) return null

  return nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
    },
  })
}

// ── Single email send ────────────────────────────────────────────────

export async function sendEmail(options: SendEmailOptions): Promise<SendResult> {
  const transporter = createTransporter()

  // ── Demo mode: no SMTP configured ──
  if (!transporter) {
    console.log(`[Email] Would send to: ${options.to}`)
    console.log(`[Email] Subject: ${options.subject}`)
    console.log(`[Email] Body length: ${options.html.length} chars`)
    return { success: true, messageId: `demo-${Date.now()}` }
  }

  try {
    const info = await transporter.sendMail({
      from: options.from || process.env.SMTP_FROM || 'DeepMindQ <noreply@deepmindq.com>',
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, ''),
      replyTo: options.replyTo,
    })
    return { success: true, messageId: info.messageId }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Send failed'
    console.error('[Email] Send error:', message)
    return { success: false, error: message }
  }
}

// ── Bulk send with rate limiting ─────────────────────────────────────

export async function sendBulkEmails(
  emails: SendEmailOptions[],
  delayMs = 1000,
): Promise<SendResult[]> {
  const results: SendResult[] = []
  for (const email of emails) {
    results.push(await sendEmail(email))
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs))
  }
  return results
}