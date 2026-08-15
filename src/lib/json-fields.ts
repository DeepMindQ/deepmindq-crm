// ═══════════════════════════════════════════════════════════════════════════
// JSON Field Helpers
//
// SQLite stores arrays as JSON strings. These helpers parse them safely.
// ═══════════════════════════════════════════════════════════════════════════

/** Parse a JSON-encoded string array, returning the array or a fallback */
export function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Serialize an array to a JSON string for storage */
export function serializeStringArray(value: unknown): string {
  if (typeof value === 'string') return value;
  return JSON.stringify(value ?? []);
}

/** Parse all JSON-encoded string fields on an object in-place */
export function parseJsonFields<T extends Record<string, unknown>>(obj: T, fields: (keyof T)[]): T {
  const result = { ...obj };
  for (const field of fields) {
    const val = obj[field];
    result[field] = (Array.isArray(val) ? val : parseStringArray(val)) as T[typeof field];
  }
  return result;
}
