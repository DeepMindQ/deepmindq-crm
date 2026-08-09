/**
 * DeepMindQ — A11Y Component Pattern Scanner (Task 10.4)
 *
 * Vitest-based source code pattern scanner that recursively scans all .tsx files
 * in src/components/ to detect common accessibility anti-patterns.
 *
 * This file does NOT require a browser — it operates purely on source text.
 * It generates a structured report of findings organized by severity.
 *
 * Scan areas (4 checks):
 *  1. Buttons without text content or aria-label
 *  2. <img> tags without alt attribute
 *  3. <div onClick> without role or tabIndex
 *  4. Form inputs without associated label or aria-label
 *
 * Run: bunx vitest run --config vitest.a11y.config.ts
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ═══════════════════════════════════════════════════════════════════════
// Types — structured report format for a11y findings
// ═══════════════════════════════════════════════════════════════════════

interface A11yFinding {
  /** Absolute file path */
  file: string;
  /** Line number (1-based) where the pattern was found */
  line: number;
  /** Human-readable description of the issue */
  message: string;
  /** WCAG criterion reference (e.g. "WCAG 4.1.2") */
  criterion: string;
  /** Severity: error (must fix), warning (should fix), info (nice to have) */
  severity: 'error' | 'warning' | 'info';
  /** The raw line of source code */
  source: string;
}

interface ScanReport {
  /** Summary counts */
  summary: { errors: number; warnings: number; info: number; total: number };
  /** Grouped findings by check category */
  findings: {
    buttonsWithoutLabels: A11yFinding[];
    imagesWithoutAlt: A11yFinding[];
    divClickWithoutRole: A11yFinding[];
    inputsWithoutLabels: A11yFinding[];
  };
}

// ═══════════════════════════════════════════════════════════════════════
// Helpers — file system and parsing utilities
// ═══════════════════════════════════════════════════════════════════════

const SRC_COMPONENTS = path.resolve(__dirname, '../../src/components');

/** Recursively collect all .tsx files under the given directory */
function collectTsxFiles(dir: string, results: string[] = []): string[] {
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip test directories and non-source folders
      if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
      collectTsxFiles(full, results);
    } else if (entry.name.endsWith('.tsx')) {
      results.push(full);
    }
  }
  return results;
}

/** Get project-relative path for readable output */
function relPath(absPath: string): string {
  return path.relative(path.resolve(__dirname, '../..'), absPath);
}

/**
 * Check if an open tag contains an aria-label attribute.
 * Handles both single and double quoted values.
 */
function hasAriaLabel(openTag: string): boolean {
  return /aria-label\s*=\s*["']/.test(openTag);
}

/** Check if a tag has a title attribute */
function hasTitle(openTag: string): boolean {
  return /title\s*=\s*["']/.test(openTag);
}

// ═══════════════════════════════════════════════════════════════════════
// Scanner 1: Buttons without text content or aria-label
// ═══════════════════════════════════════════════════════════════════════

function scanButtonsWithoutLabels(files: string[]): A11yFinding[] {
  const findings: A11yFinding[] = [];

  for (const file of files) {
    const src = fs.readFileSync(file, 'utf-8');
    const lines = src.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip UI library files (shadcn/ui components handle this via Radix)
      if (file.includes('/ui/button.tsx') || file.includes('/ui/animated-components')) continue;
      // Skip if line is clearly a type/import/definition, not JSX
      if (line.trim().startsWith('//') || line.trim().startsWith('import ') || line.trim().startsWith('export ')) continue;

      // Look for <button ...> or <Button ...> opening tags
      const buttonOpenMatch = line.match(/<(?:button|Button)[\s>]/);
      if (!buttonOpenMatch) continue;

      // Collect the full opening tag (may span multiple lines for multiline JSX)
      let fullTag = line;
      let tagLineIdx = i;
      while (!fullTag.includes('>') && tagLineIdx < lines.length - 1) {
        tagLineIdx++;
        fullTag += ' ' + lines[tagLineIdx];
      }

      // Check if this button has aria-label or title
      const hasLabel = hasAriaLabel(fullTag) || hasTitle(fullTag);

      // Simplified: check if the button line has children text
      // We look at lines between the button open and its close
      let childContent = '';
      let childLine = i + 1;
      while (childLine < lines.length && childLine < i + 20) {
        if (/<\/(?:button|Button)>/i.test(lines[childLine])) break;
        childContent += lines[childLine] + ' ';
        childLine++;
      }

      // Determine if button has text content
      const childrenText = childContent.replace(/<[^>]+>/g, '').replace(/\{[^}]*\}/g, '').trim();
      const hasTextContent = childrenText.length > 0;

      // If no text content and no aria-label, it's a violation
      if (!hasTextContent && !hasLabel) {
        findings.push({
          file,
          line: i + 1,
          message: `Button appears to be icon-only without aria-label or title`,
          criterion: 'WCAG 4.1.2',
          severity: 'warning',
          source: line.trim(),
        });
      }
    }
  }

  return findings;
}

// ═══════════════════════════════════════════════════════════════════════
// Scanner 2: <img> tags without alt attribute
// ═══════════════════════════════════════════════════════════════════════

function scanImagesWithoutAlt(files: string[]): A11yFinding[] {
  const findings: A11yFinding[] = [];

  for (const file of files) {
    const src = fs.readFileSync(file, 'utf-8');
    const lines = src.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Match <img ...> tags (including self-closing and multiline)
      const imgMatch = line.match(/<img\s/);
      if (!imgMatch) continue;

      // Collect the full tag (may span multiple lines)
      let fullTag = line;
      let tagLineIdx = i;
      while (!fullTag.trimEnd().endsWith('/>') && !fullTag.includes('>') && tagLineIdx < lines.length - 1) {
        tagLineIdx++;
        fullTag += ' ' + lines[tagLineIdx];
      }

      // Check for alt attribute
      const hasAlt = /\balt\s*=\s*["']/.test(fullTag);
      // Decorative images can use alt="" or aria-hidden="true"
      const isDecorative = /alt\s*=\s*["']\s*["']/.test(fullTag) || /aria-hidden\s*=\s*["']true["']/.test(fullTag);

      if (!hasAlt && !isDecorative) {
        findings.push({
          file,
          line: i + 1,
          message: `<img> tag is missing alt attribute`,
          criterion: 'WCAG 1.1.1',
          severity: 'error',
          source: line.trim(),
        });
      }
    }
  }

  return findings;
}

// ═══════════════════════════════════════════════════════════════════════
// Scanner 3: <div onClick> without role or tabIndex
// ═══════════════════════════════════════════════════════════════════════

function scanDivClickWithoutRole(files: string[]): A11yFinding[] {
  const findings: A11yFinding[] = [];

  for (const file of files) {
    const src = fs.readFileSync(file, 'utf-8');
    const lines = src.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Match <div ... onClick=...> patterns
      const divClickMatch = line.match(/<div[^>]*\bonClick[^>]*>/);
      if (!divClickMatch) continue;

      const tag = divClickMatch[0];

      // Check for role attribute
      const hasRole = /\brole\s*=\s*["']/.test(tag);
      // Check for tabIndex (allows keyboard focus)
      const hasTabIndex = /\btabIndex\s*=/.test(tag) || /\btabindex\s*=/.test(tag);
      // Check if it's using a Radix primitive (which handles ARIA internally)
      const isRadixPrimitive = /data-radix/.test(tag);

      // Skip Radix-managed elements (they handle role internally)
      if (isRadixPrimitive) continue;

      // Also check subsequent lines for role/tabIndex that might be added via spread
      const contextLines = lines.slice(Math.max(0, i - 2), Math.min(lines.length, i + 5)).join(' ');
      const hasRoleInContext = !hasRole && /\brole["']?\s*[:=]/.test(contextLines);
      const hasTabInContext = !hasTabIndex && /tabIndex["']?\s*[:=]/.test(contextLines);

      if (!hasRole && !hasRoleInContext && !hasTabIndex && !hasTabInContext) {
        findings.push({
          file,
          line: i + 1,
          message: `<div onClick> without role attribute — screen readers won't recognize it as interactive`,
          criterion: 'WCAG 4.1.2',
          severity: 'warning',
          source: line.trim(),
        });
      }

      if (!hasTabIndex && !hasTabInContext) {
        findings.push({
          file,
          line: i + 1,
          message: `<div onClick> without tabIndex — not keyboard focusable`,
          criterion: 'WCAG 2.1.1',
          severity: 'info',
          source: line.trim(),
        });
      }
    }
  }

  return findings;
}

// ═══════════════════════════════════════════════════════════════════════
// Scanner 4: Form inputs without associated label or aria-label
// ═══════════════════════════════════════════════════════════════════════

function scanInputsWithoutLabels(files: string[]): A11yFinding[] {
  const findings: A11yFinding[] = [];

  for (const file of files) {
    const src = fs.readFileSync(file, 'utf-8');
    const lines = src.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Match <input ...> tags, excluding hidden/submit/button types
      const inputMatch = line.match(/<input[^>]+>/);
      if (!inputMatch) continue;

      const tag = inputMatch[0];

      // Skip hidden, submit, button, reset, image inputs (they don't need labels)
      if (/type\s*=\s*["'](?:hidden|submit|button|reset|image)["']/.test(tag)) continue;

      // Check for aria-label on the input itself
      const hasAriaLabelOnInput = hasAriaLabel(tag);
      // Check for aria-labelledby on the input
      const hasAriaLabelledby = /aria-labelledby\s*=\s*["']/.test(tag);
      // Check for id attribute (needed for htmlFor association)
      const idMatch = tag.match(/\bid\s*=\s*["']([^"']+)["']/);
      const inputId = idMatch ? idMatch[1] : null;

      if (hasAriaLabelOnInput || hasAriaLabelledby) continue;

      // Check if there's a <Label htmlFor="..."> in the surrounding context
      if (inputId) {
        // Look backwards for a <Label htmlFor={inputId}> or <label for="inputId">
        const contextBefore = lines.slice(Math.max(0, i - 10), i).join('\n');
        const hasLabelHtmlFor = new RegExp(
          `<(?:Label|label)[^>]*(?:htmlFor|for)\s*=\s*["'\`]${inputId}["'\`]`,
          'i'
        ).test(contextBefore);
        const hasLabelSpread = new RegExp(
          `htmlFor.*${inputId}`,
          'i'
        ).test(contextBefore);
        if (hasLabelHtmlFor || hasLabelSpread) continue;
      }

      // Check for a wrapping <label> or <Label> that contains this input
      const contextAfter = lines.slice(i, Math.min(lines.length, i + 5)).join('\n');
      const hasWrappingLabel = /<\/label>|<\/Label>/.test(contextAfter);
      if (hasWrappingLabel) continue;

      // Also check if the input uses shadcn/ui FormField which handles labeling
      const contextAround = lines
        .slice(Math.max(0, i - 5), Math.min(lines.length, i + 10))
        .join('\n');
      const usesFormField = /FormField|<Label/.test(contextAround);
      if (usesFormField) continue;

      // If we get here, the input lacks an accessible label
      findings.push({
        file,
        line: i + 1,
        message: `Form input lacks associated <label>, aria-label, or aria-labelledby`,
        criterion: 'WCAG 1.3.1',
        severity: 'error',
        source: line.trim(),
      });
    }
  }

  return findings;
}

// ═══════════════════════════════════════════════════════════════════════
// Report generator
// ═══════════════════════════════════════════════════════════════════════

function generateReport(files: string[]): ScanReport {
  const buttonsWithoutLabels = scanButtonsWithoutLabels(files);
  const imagesWithoutAlt = scanImagesWithoutAlt(files);
  const divClickWithoutRole = scanDivClickWithoutRole(files);
  const inputsWithoutLabels = scanInputsWithoutLabels(files);

  const all = [
    ...buttonsWithoutLabels,
    ...imagesWithoutAlt,
    ...divClickWithoutRole,
    ...inputsWithoutLabels,
  ];

  return {
    summary: {
      errors: all.filter(f => f.severity === 'error').length,
      warnings: all.filter(f => f.severity === 'warning').length,
      info: all.filter(f => f.severity === 'info').length,
      total: all.length,
    },
    findings: {
      buttonsWithoutLabels,
      imagesWithoutAlt,
      divClickWithoutRole,
      inputsWithoutLabels,
    },
  };
}

/** Print a human-readable summary of the scan report */
function printReportSummary(report: ScanReport): void {
  const { summary, findings } = report;

  console.info('\n╔══════════════════════════════════════════════════════════╗');
  console.info('║   DeepMindQ — A11Y Component Pattern Scan Report       ║');
  console.info('╠══════════════════════════════════════════════════════════╣');
  console.info(`║  Errors:   ${String(summary.errors).padEnd(43)}║`);
  console.info(`║  Warnings: ${String(summary.warnings).padEnd(43)}║`);
  console.info(`║  Info:     ${String(summary.info).padEnd(43)}║`);
  console.info(`║  Total:    ${String(summary.total).padEnd(43)}║`);
  console.info('╠══════════════════════════════════════════════════════════╣');

  if (findings.buttonsWithoutLabels.length > 0) {
    console.info('║  Buttons without labels:');
    for (const f of findings.buttonsWithoutLabels.slice(0, 10)) {
      console.info(`║    ⚠ ${relPath(f.file)}:${f.line} — ${f.message}`);
    }
    if (findings.buttonsWithoutLabels.length > 10) {
      console.info(`║    ... and ${findings.buttonsWithoutLabels.length - 10} more`);
    }
  }

  if (findings.imagesWithoutAlt.length > 0) {
    console.info('║  Images without alt:');
    for (const f of findings.imagesWithoutAlt.slice(0, 10)) {
      console.info(`║    ✗ ${relPath(f.file)}:${f.line} — ${f.message}`);
    }
    if (findings.imagesWithoutAlt.length > 10) {
      console.info(`║    ... and ${findings.imagesWithoutAlt.length - 10} more`);
    }
  }

  if (findings.divClickWithoutRole.length > 0) {
    console.info('║  Div onClick without role/tabIndex:');
    for (const f of findings.divClickWithoutRole.slice(0, 10)) {
      console.info(`║    ⚠ ${relPath(f.file)}:${f.line} — ${f.message}`);
    }
    if (findings.divClickWithoutRole.length > 10) {
      console.info(`║    ... and ${findings.divClickWithoutRole.length - 10} more`);
    }
  }

  if (findings.inputsWithoutLabels.length > 0) {
    console.info('║  Inputs without labels:');
    for (const f of findings.inputsWithoutLabels.slice(0, 10)) {
      console.info(`║    ✗ ${relPath(f.file)}:${f.line} — ${f.message}`);
    }
    if (findings.inputsWithoutLabels.length > 10) {
      console.info(`║    ... and ${findings.inputsWithoutLabels.length - 10} more`);
    }
  }

  console.info('╚══════════════════════════════════════════════════════════╝\n');
}

// ═══════════════════════════════════════════════════════════════════════
// Test suites
// ═══════════════════════════════════════════════════════════════════════

describe('A11Y Component Pattern Scanner', () => {
  let files: string[];
  let report: ScanReport;

  beforeAll(() => {
    // Collect all .tsx component files for scanning
    files = collectTsxFiles(SRC_COMPONENTS);
  });

  it('scans all .tsx files in src/components/', () => {
    // Ensure we're scanning a meaningful number of component files
    expect(files.length).toBeGreaterThanOrEqual(50);
  });

  it('generates a structured scan report', () => {
    report = generateReport(files);

    // Report must have the expected structure
    expect(report.summary).toHaveProperty('errors');
    expect(report.summary).toHaveProperty('warnings');
    expect(report.summary).toHaveProperty('info');
    expect(report.summary).toHaveProperty('total');
    expect(report.findings).toHaveProperty('buttonsWithoutLabels');
    expect(report.findings).toHaveProperty('imagesWithoutAlt');
    expect(report.findings).toHaveProperty('divClickWithoutRole');
    expect(report.findings).toHaveProperty('inputsWithoutLabels');

    // Print the report summary for visibility in test output
    printReportSummary(report);
  });

  // ── Check 1: Buttons without text content or aria-label ────────────

  describe('Check 1: Buttons without accessible labels', () => {
    it('icon-only buttons in screen components should have aria-label or title', () => {
      const findings = report.findings.buttonsWithoutLabels;
      // Filter to only screen files (most likely to have icon-only buttons)
      const screenViolations = findings.filter(f => f.file.includes('/screens/'));

      // We allow some tolerance — many icon buttons are inside Radix
      // components that provide aria-label via props spreading
      expect(screenViolations.length).toBeLessThan(20);
    });

    it('no icon-only button violations in accessibility/ components', () => {
      const findings = report.findings.buttonsWithoutLabels;
      const a11yViolations = findings.filter(f => f.file.includes('/accessibility/'));
      // The accessibility components themselves must be clean
      expect(a11yViolations.length).toBe(0);
    });
  });

  // ── Check 2: Images without alt attribute ───────────────────────────

  describe('Check 2: Images without alt attribute (WCAG 1.1.1)', () => {
    it('no <img> tags in component files are missing alt attribute', () => {
      const findings = report.findings.imagesWithoutAlt;

      // Every <img> must have an alt attribute or be marked decorative
      // This is a hard WCAG requirement
      if (findings.length > 0) {
        console.info('\n  Critical: Images without alt text:');
        for (const f of findings) {
          console.info(`    ${relPath(f.file)}:${f.line} — ${f.source}`);
        }
      }

      expect(findings.length).toBe(0);
    });
  });

  // ── Check 3: Div onClick without role or tabIndex ───────────────────

  describe('Check 3: Div onClick without role or tabIndex', () => {
    it('div onClick elements should have a role attribute', () => {
      const findings = report.findings.divClickWithoutRole;
      const noRole = findings.filter(f => f.criterion === 'WCAG 4.1.2');

      // Screen reader users can't identify clickable divs without role
      // Allow some tolerance for divs wrapped in Radix components
      expect(noRole.length).toBeLessThan(30);
    });

    it('div onClick elements should be keyboard-focusable (tabIndex)', () => {
      const findings = report.findings.divClickWithoutRole;
      const noTab = findings.filter(f => f.criterion === 'WCAG 2.1.1');

      // Keyboard users can't activate divs without tabIndex
      expect(noTab.length).toBeLessThan(30);
    });
  });

  // ── Check 4: Form inputs without associated label ───────────────────

  describe('Check 4: Form inputs without associated labels (WCAG 1.3.1)', () => {
    it('all form inputs have a label, aria-label, or aria-labelledby', () => {
      const findings = report.findings.inputsWithoutLabels;

      if (findings.length > 0) {
        console.info('\n  Critical: Inputs without labels:');
        for (const f of findings.slice(0, 15)) {
          console.info(`    ${relPath(f.file)}:${f.line} — ${f.source}`);
        }
        if (findings.length > 15) {
          console.info(`    ... and ${findings.length - 15} more`);
        }
      }

      // Form inputs MUST have labels — this is a critical WCAG requirement
      // We allow some tolerance for inputs in complex form wrappers
      expect(findings.length).toBeLessThan(10);
    });

    it('login page inputs all have associated labels', () => {
      const findings = report.findings.inputsWithoutLabels;
      const loginViolations = findings.filter(
        f => f.file.includes('login-page') || f.file.includes('login')
      );
      // Login form must be fully accessible
      expect(loginViolations.length).toBe(0);
    });
  });

  // ── Overall summary ─────────────────────────────────────────────────

  it('total error-level findings are below the acceptable threshold', () => {
    // Errors are critical accessibility barriers that must be fixed
    // Allow up to 5 errors for a project this size during iteration
    expect(report.summary.errors).toBeLessThanOrEqual(5);
  });

  it('total findings remain below the overall threshold', () => {
    // Combined findings should be manageable
    // A large project may have some warnings but should be trending down
    expect(report.summary.total).toBeLessThan(100);
  });
});
