/**
 * Input Sanitization Utilities — WI-18.1-05
 *
 * sanitizeString: Strips dangerous HTML using DOMPurify (server-safe).
 *   Replaces the previous regex-based stripper which was vulnerable to
 *   malformed HTML and bypass patterns.
 *
 * truncate: Truncates a string to maxLen characters with ellipsis.
 */

import DOMPurify from 'isomorphic-dompurify';

// Server-side DOM setup for DOMPurify (requires jsdom window)
let purifyInstance: typeof DOMPurify | null = null;

function getPurify(): typeof DOMPurify {
  if (purifyInstance) return purifyInstance;

  if (typeof window !== 'undefined') {
    // Browser environment — DOMPurify uses global window
    purifyInstance = DOMPurify;
  } else {
    // Server environment — provide jsdom window
    try {
      const { JSDOM } = require('jsdom');
      const jsdomWindow = new JSDOM('', { url: 'http://localhost' }).window;
      purifyInstance = DOMPurify(jsdomWindow);
    } catch {
      // Fallback: if jsdom unavailable, use regex-based sanitization
      purifyInstance = null;
    }
  }

  return purifyInstance;
}

/**
 * Strip dangerous HTML tags and attributes from a string.
 * Uses DOMPurify which handles malformed HTML, nested tags,
 * script injection, event handlers, and other XSS vectors.
 *
 * Falls back to regex stripping if DOMPurify/jsdom is unavailable.
 */
export function sanitizeString(str: string): string {
  if (!str || typeof str !== 'string') return '';

  const purify = getPurify();
  if (purify) {
    return purify.sanitize(str, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
    }).trim();
  }

  // Fallback: regex strip (WI-18.1-05 upgrade from original)
  return str.replace(/<[^>]*>/g, '').replace(/[<>]/g, '').trim();
}

/**
 * Sanitize HTML content while preserving safe formatting tags.
 * Use this for fields that intentionally contain HTML.
 */
export function sanitizeHtml(html: string): string {
  if (!html || typeof html !== 'string') return '';

  const purify = getPurify();
  if (purify) {
    return purify.sanitize(html, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'span', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'code', 'pre'],
      ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
      ALLOW_DATA_ATTR: false,
    }).trim();
  }

  // Fallback
  return html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<[^>]*>/g, '').trim();
}

/**
 * Truncate a string to `maxLen` characters, appending "..." if truncated.
 */
export function truncate(str: string, maxLen: number): string {
  if (!str || str.length <= maxLen) return str
  return str.slice(0, maxLen) + '...'
}
