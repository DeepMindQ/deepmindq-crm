// Mock email sender — no nodemailer import

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

export async function sendEmail(_options: SendEmailOptions): Promise<SendResult> {
  return { success: true, messageId: "mock-id" }
}

export async function sendBulkEmails(
  emails: SendEmailOptions[],
  _delayMs = 1000,
): Promise<SendResult[]> {
  return emails.map(() => ({ success: true, messageId: "mock-id" }))
}