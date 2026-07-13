/* ═══════════════════════════════════════════════════
   Document Parsers — Robust text extraction
   C-04: PDF via pdf-parse (with regex fallback)
   C-05: DOCX via mammoth (with regex fallback)
   ═══════════════════════════════════════════════════ */

import { createHash } from 'crypto';

/* ── SHA-256 content hash for deduplication (C-06) ── */
export function computeContentHash(text: string): string {
  return createHash('sha256').update(text.trim().toLowerCase()).digest('hex');
}

/* ── TXT parser ── */
export function extractTextFromTXT(content: string): string {
  return content
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/* ── MD parser (preserve structure) ── */
export function extractTextFromMD(content: string): string {
  return extractTextFromTXT(content);
}

/* ── PDF parser — C-04 ── */
async function extractTextFromPDFFallback(buffer: Buffer): Promise<string> {
  const bytes = new Uint8Array(buffer);
  const textParts: string[] = [];
  const content = new TextDecoder('latin1').decode(bytes);

  function decodePdfString(str: string): string {
    return str
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\\(/g, '(')
      .replace(/\\\)/g, ')')
      .replace(/\\\\/g, '\\');
  }

  // Strategy 1: Text between parentheses in Tj operators
  const textObjRegex = /\(([^)]*)\)\s*Tj/g;
  let match: RegExpExecArray | null;
  while ((match = textObjRegex.exec(content)) !== null) {
    const decoded = decodePdfString(match[1]);
    if (decoded.trim()) textParts.push(decoded);
  }

  // Strategy 2: Array-based text in TJ operators
  const tjArrayRegex = /\[(.*?)\]\s*TJ/g;
  while ((match = tjArrayRegex.exec(content)) !== null) {
    const innerTexts = match[1];
    const strMatches = innerTexts.matchAll(/\(([^)]*)\)\s*-?\d*\.?\d*/g);
    for (const sm of strMatches) {
      const decoded = decodePdfString(sm[1]);
      if (decoded.trim()) textParts.push(decoded);
    }
  }

  // Strategy 3: Broader search
  if (textParts.length === 0) {
    const broadTjRegex = /\(([^)]{1,200})\)/g;
    while ((match = broadTjRegex.exec(content)) !== null) {
      const decoded = decodePdfString(match[1]);
      if (decoded.trim() && decoded.trim().length > 1) {
        textParts.push(decoded);
      }
    }
  }

  const extracted = textParts.join(' ').replace(/\s+/g, ' ').trim();
  return extracted;
}

export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    const pdfParse = (await import('pdf-parse')).default;
    const data = await pdfParse(buffer);
    const text = (data.text || '').trim();
    if (text.length > 10) {
      return text;
    }
    // pdf-parse returned very little, try fallback
    const fallback = await extractTextFromPDFFallback(buffer);
    return fallback || text || '[PDF text extraction produced no results]';
  } catch {
    // pdf-parse not available or failed — use regex fallback
    const fallback = await extractTextFromPDFFallback(buffer);
    return fallback || '[PDF text extraction failed. Please try a .txt or .md file.]';
  }
}

/* ── DOCX parser — C-05 ── */
async function extractTextFromDOCXFallback(buffer: Buffer): Promise<string> {
  const content = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
  const textParts: string[] = [];
  const wTagRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  let m: RegExpExecArray | null;
  while ((m = wTagRegex.exec(content)) !== null) {
    if (m[1].trim()) textParts.push(m[1].trim());
  }
  return textParts.length > 0 ? textParts.join(' ') : '';
}

export async function extractTextFromDOCX(buffer: Buffer): Promise<string> {
  try {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    const text = (result.value || '').trim();
    if (text.length > 10) {
      return text;
    }
    // mammoth returned very little, try fallback
    const fallback = await extractTextFromDOCXFallback(buffer);
    return fallback || text || '[DOCX text extraction produced no results]';
  } catch {
    // mammoth not available or failed — use regex fallback
    const fallback = await extractTextFromDOCXFallback(buffer);
    return fallback || '[DOCX text extraction failed. Please try a .txt or .md file.]';
  }
}

/* ── Unified extract by file extension ── */
export async function extractTextFromBuffer(
  buffer: Buffer,
  fileName: string
): Promise<string> {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  switch (ext) {
    case 'txt':
      return extractTextFromTXT(new TextDecoder('utf-8', { fatal: false }).decode(buffer));
    case 'md':
      return extractTextFromMD(new TextDecoder('utf-8', { fatal: false }).decode(buffer));
    case 'pdf':
      return extractTextFromPDF(buffer);
    case 'docx':
      return extractTextFromDOCX(buffer);
    default:
      throw new Error(`Unsupported file type: .${ext}`);
  }
}