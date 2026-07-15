/**
 * Strip HTML tags and stray angle brackets from a string.
 */
export function sanitizeString(str: string): string {
  return str.replace(/<[^>]*>/g, '').replace(/[<>]/g, '').trim()
}

/**
 * Truncate a string to `maxLen` characters, appending "…" if truncated.
 */
export function truncate(str: string, maxLen: number): string {
  if (!str || str.length <= maxLen) return str
  return str.slice(0, maxLen) + '...'
}