// ═══════════════════════════════════════════════════════════════════════════
// Sanitization Utilities — Unit Tests
//
// Tests sanitizeString, sanitizeHtml, and truncate from @/lib/sanitize.ts.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { sanitizeString, sanitizeHtml, truncate } from '@/lib/sanitize';

// ── sanitizeString ────────────────────────────────────────────────────────

describe('sanitizeString', () => {
  it('returns empty string for empty input', () => {
    expect(sanitizeString('')).toBe('');
  });

  it('returns empty string for null/undefined (coerced)', () => {
    // @ts-expect-error — testing runtime behavior with non-string
    expect(sanitizeString(null)).toBe('');
  });

  it('returns empty string for non-string input', () => {
    // @ts-expect-error — testing runtime behavior with non-string
    expect(sanitizeString(123)).toBe('');
  });

  it('passes through plain text unchanged', () => {
    expect(sanitizeString('Hello, world!')).toBe('Hello, world!');
  });

  it('strips script tags completely', () => {
    expect(sanitizeString('<script>alert(1)</script>')).toBe('');
  });

  it('strips img tags with onerror handlers', () => {
    const result = sanitizeString('<img src=x onerror=alert(1)>');
    expect(result).not.toContain('onerror');
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
  });

  it('strips anchor tags', () => {
    expect(sanitizeString('<a href="javascript:alert(1)">click</a>')).not.toContain('<a');
  });

  it('strips HTML comments', () => {
    const result = sanitizeString('before<!-- comment -->after');
    expect(result).not.toContain('<!--');
    expect(result).toContain('before');
    expect(result).toContain('after');
  });

  it('strips nested tags', () => {
    const result = sanitizeString('<div><b>bold</b></div>');
    expect(result).not.toContain('<');
    expect(result).toContain('bold');
  });

  it('strips SVG-based XSS vectors', () => {
    const result = sanitizeString('<svg><script>alert(document.cookie)</script></svg>');
    expect(result).not.toContain('<svg');
    expect(result).not.toContain('<script');
  });

  it('handles malformed HTML gracefully', () => {
    const result = sanitizeString('<b unclosed');
    expect(result).not.toContain('<b');
  });

  it('trims whitespace from result', () => {
    expect(sanitizeString('  hello  ')).toBe('hello');
  });

  it('handles unicode content correctly', () => {
    expect(sanitizeString('こんにちは世界')).toBe('こんにちは世界');
  });

  it('strips event handler attributes on any element', () => {
    const result = sanitizeString('<div onclick="alert(1)">text</div>');
    expect(result).not.toContain('onclick');
  });

  it('handles empty-ish strings', () => {
    expect(sanitizeString('   ')).toBe('');
  });
});

// ── sanitizeHtml ──────────────────────────────────────────────────────────

describe('sanitizeHtml', () => {
  it('returns empty string for empty input', () => {
    expect(sanitizeHtml('')).toBe('');
  });

  it('returns empty string for non-string input', () => {
    // @ts-expect-error — testing runtime behavior with non-string
    expect(sanitizeHtml(null)).toBe('');
  });

  it('preserves safe formatting tags like <b> and <i>', () => {
    const result = sanitizeHtml('<b>bold</b> and <i>italic</i>');
    expect(result).toContain('<b>bold</b>');
    expect(result).toContain('<i>italic</i>');
  });

  it('preserves <strong> and <em> tags', () => {
    const result = sanitizeHtml('<strong>strong</strong> <em>emphasized</em>');
    expect(result).toContain('<strong>strong</strong>');
    expect(result).toContain('<em>emphasized</em>');
  });

  it('preserves <a> tags with href', () => {
    const result = sanitizeHtml('<a href="https://example.com">link</a>');
    expect(result).toContain('<a href="https://example.com">link</a>');
  });

  it('strips javascript: URLs from href', () => {
    const result = sanitizeHtml('<a href="javascript:alert(1)">link</a>');
    expect(result).not.toContain('javascript:');
  });

  it('strips script tags', () => {
    const result = sanitizeHtml('<script>alert(1)</script>');
    expect(result).not.toContain('<script');
  });

  it('strips onclick and other event handlers', () => {
    const result = sanitizeHtml('<div onclick="alert(1)">text</div>');
    expect(result).not.toContain('onclick');
  });

  it('preserves paragraph tags', () => {
    const result = sanitizeHtml('<p>Hello</p>');
    expect(result).toContain('<p>Hello</p>');
  });

  it('preserves heading tags', () => {
    const result = sanitizeHtml('<h1>Title</h1><h2>Subtitle</h2>');
    expect(result).toContain('<h1>Title</h1>');
    expect(result).toContain('<h2>Subtitle</h2>');
  });

  it('preserves list tags', () => {
    const result = sanitizeHtml('<ul><li>item</li></ul>');
    expect(result).toContain('<ul>');
    expect(result).toContain('<li>item</li>');
    expect(result).toContain('</ul>');
  });

  it('preserves code and pre tags', () => {
    const result = sanitizeHtml('<code>foo</code><pre>bar</pre>');
    expect(result).toContain('<code>foo</code>');
    expect(result).toContain('<pre>bar</pre>');
  });

  it('preserves blockquote tags', () => {
    const result = sanitizeHtml('<blockquote>quote</blockquote>');
    expect(result).toContain('<blockquote>quote</blockquote>');
  });

  it('strips data-* attributes (ALLOW_DATA_ATTR: false)', () => {
    const result = sanitizeHtml('<div data-test="val">text</div>');
    expect(result).not.toContain('data-test');
  });

  it('preserves class attribute', () => {
    const result = sanitizeHtml('<span class="highlight">text</span>');
    expect(result).toContain('class="highlight"');
  });

  it('trims output', () => {
    expect(sanitizeHtml('  <b>hi</b>  ')).toBe('<b>hi</b>');
  });
});

// ── truncate ─────────────────────────────────────────────────────────────

describe('truncate', () => {
  it('returns string as-is if shorter than maxLen', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('returns string as-is if equal to maxLen', () => {
    expect(truncate('hello', 5)).toBe('hello');
  });

  it('truncates and appends ellipsis when exceeding maxLen', () => {
    expect(truncate('hello world', 5)).toBe('hello...');
  });

  it('returns empty string for empty input', () => {
    expect(truncate('', 10)).toBe('');
  });

  it('handles falsy input gracefully', () => {
    // @ts-expect-error — testing falsy input
    expect(truncate(null, 10)).toBeNull();
  });

  it('works with maxLen of 0', () => {
    expect(truncate('hello', 0)).toBe('...');
  });

  it('handles unicode strings correctly', () => {
    // String.slice counts JS characters (code units), not graphemes.
    // 'こんにちは世界' is 7 characters: こ,ん,に,ち,は,世,界
    expect(truncate('こんにちは世界', 5)).toBe('こんにちは...');
  });

  it('handles single character with maxLen 1', () => {
    expect(truncate('a', 1)).toBe('a');
  });

  it('handles single character with maxLen 0', () => {
    expect(truncate('a', 0)).toBe('...');
  });
});
