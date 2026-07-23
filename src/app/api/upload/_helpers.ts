// Shared helpers for the upload API endpoints

export function normalize(s: string | undefined | null): string {
  if (!s) return '';
  return s.trim().toLowerCase();
}
