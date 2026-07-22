import { z } from 'zod/v4'

export function validateBody<T>(schema: z.ZodType<T>, body: unknown): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(body)
  if (!result.success) {
    const messages = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
    return { success: false, error: messages }
  }
  return { success: true, data: result.data }
}

// Common schemas for reuse
export const schemas = {
  uuid: z.string().uuid(),
  positiveInt: z.number().int().positive(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  email: z.string().email(),
  nonEmptyString: z.string().min(1),
}
