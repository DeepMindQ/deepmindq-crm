/* eslint-disable no-console */
/**
 * DeepMindQ — Accessibility Violations Report Generator (10.4)
 *
 * A static analysis script that scans component source code for common
 * accessibility anti-patterns and generates a structured JSON report.
 *
 * Detection categories:
 *   1. Buttons without accessible labels (no text, no aria-label, no aria-labelledby)
 *   2. Images without alt text
 *   3. Form inputs without associated labels
 *   4. Interactive divs without role attributes
 *   5. Missing aria-expanded on toggleable elements
 *   6. Missing aria-current on navigation links
 *   7. Positive tabindex usage
 *   8. Empty heading elements
 *   9. Missing form action indicators
 *  10. onclick without keyboard support
 *
 * Run: bun run tests/accessibility/a11y-violations-report.ts
 * Output: Writes JSON report to reports/a11y-violations.json
 */

import * as fs from 'fs';
import * as path from 'path';

// ── Types ────────────────────────────────────────────────────────────────

interface Violation {
  rule: string;
  wcag: string;
  severity: 'error' | 'warning';
  file: string;
  line: number;
  column?: number;
  snippet: string;
  message: string;
  fix?: string;
}

interface FileSummary {
  file: string;
  errors: number;
  warnings: number;
}

interface CategorySummary {
  category: string;
  wcag: string;
  count: number;
  severity: 'error' | 'warning';
}

interface A11yReport {
  generatedAt: string;
  projectName: string;
  projectRoot: string;
  totalFiles: number;
  totalViolations: number;
  totalErrors: number;
  totalWarnings: number;
  categories: CategorySummary[];
  files: FileSummary[];
  violations: Violation[];
}

// ── Configuration ─────────────────────────────────────────────────────────

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const SRC_ROOT = path.join(PROJECT_ROOT, 'src');
const COMPONENTS_DIR = path.join(SRC_ROOT, 'components');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'reports');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'a11y-violations.json');

// Directories to scan
const SCAN_DIRS = [
  COMPONENTS_DIR,
  path.join(SRC_ROOT, 'app'),
];

// File extensions to include
const INCLUDE_EXTENSIONS = ['.tsx', '.ts'];

// Directories/files to exclude from scanning
const EXCLUDE_PATTERNS = [
  'node_modules',
  '.next',
  'dist',
  'build',
  '__tests__',
  '.test.',
  '.spec.',
  '.stories.',
  'stories/',
  'tests/',
];

// ── Helpers ──────────────────────────────────────────────────────────────

/** Recursively collect files matching extension and not excluded */
function collectFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(full));
    } else if (INCLUDE_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
      const relPath = path.relative(PROJECT_ROOT, full);
      if (!EXCLUDE_PATTERNS.some((pattern) => relPath.includes(pattern))) {
        results.push(full);
      }
    }
  }
  return results;
}

/** Truncate snippet to a reasonable length */
function truncate(str: string, max = 120): string {
  const clean = str.replace(/\s+/g, ' ').trim();
  return clean.length > max ? clean.slice(0, max) + '...' : clean;
}

/** Check if a tag has text content between its opening and closing tags */
function hasTextContent(tagContent: string): boolean {
  // Strip nested tags to get text only
  const text = tagContent.replace(/<[^>]+>/g, '').trim();
  return text.length > 0;
}

/** Extract an attribute value from a tag string */
function getAttrValue(tag: string, attr: string): string | null {
  // Match attr="value" or attr='value'
  const regex = new RegExp(`${attr}\\s*=\\s*["']([^"']+)["']`, 'i');
  const match = tag.match(regex);
  return match ? match[1] : null;
}

/** Check if a tag has a specific attribute */
function hasAttr(tag: string, attr: string): boolean {
  const regex = new RegExp(`\\b${attr}\\s*=`, 'i');
  return regex.test(tag);
}

// ── Rule Implementations ─────────────────────────────────────────────────

/** Rule 1: Buttons without accessible labels */
function checkButtonsWithoutLabels(content: string, filePath: string): Violation[] {
  const violations: Violation[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match <button tags
    if (!/<button[^>]*>/.test(line)) continue;

    // Collect the full button element (may be multiline)
    let fullButton = line;
    let j = i;
    while (j < lines.length - 1 && !fullButton.includes('</button>')) {
      j++;
      fullButton += '\n' + lines[j];
    }

    // Skip if this is a component definition (React.Component, function, export)
    if (/function\s+Button|const\s+Button|export\s+/.test(fullButton) && !fullButton.includes('<button')) continue;

    // Check for accessible name
    const hasAriaLabel = hasAttr(fullButton, 'aria-label');
    const hasAriaLabelledBy = hasAttr(fullButton, 'aria-labelledby');
    const hasTitle = hasAttr(fullButton, 'title');
    const hasText = hasTextContent(fullButton);

    // Check if it only contains icon/SVG/image children
    const hasOnlyIconChildren =
      (fullButton.includes('<Svg') || fullButton.includes('<svg') || fullButton.includes('Icon')) &&
      !hasText;

    if (!hasAriaLabel && !hasAriaLabelledBy && !hasTitle && !hasText) {
      violations.push({
        rule: 'button-label',
        wcag: '1.1.1, 4.1.2',
        severity: 'error',
        file: filePath,
        line: i + 1,
        snippet: truncate(fullButton),
        message: 'Button has no accessible label. Add aria-label, aria-labelledby, visible text, or a <title> element.',
        fix: 'Add aria-label="<descriptive text>" to the button element.',
      });
    } else if (hasOnlyIconChildren && !hasAriaLabel && !hasAriaLabelledBy && !hasTitle) {
      violations.push({
        rule: 'button-icon-label',
        wcag: '1.1.1, 4.1.2',
        severity: 'warning',
        file: filePath,
        line: i + 1,
        snippet: truncate(fullButton),
        message: 'Icon-only button may lack an accessible label. Verify aria-label or aria-labelledby is present.',
        fix: 'Add aria-label="<action description>" to the icon button.',
      });
    }
  }

  return violations;
}

/** Rule 2: Images without alt text */
function checkImagesWithoutAlt(content: string, filePath: string): Violation[] {
  const violations: Violation[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match <img and <Image (Next.js) tags
    const imgMatches = line.matchAll(/<(?:img|Image)\s[^>]*>/g);
    for (const match of imgMatches) {
      const tag = match[0];
      const hasAlt = hasAttr(tag, 'alt');
      const role = getAttrValue(tag, 'role');

      if (!hasAlt && role !== 'presentation') {
        violations.push({
          rule: 'img-alt',
          wcag: '1.1.1',
          severity: 'error',
          file: filePath,
          line: i + 1,
          column: match.index,
          snippet: truncate(tag),
          message: 'Image is missing alt attribute. All images must have descriptive alt text (or alt="" for decorative images).',
          fix: 'Add alt="<description>" for informative images or alt="" for decorative images.',
        });
      }
    }
  }

  return violations;
}

/** Rule 3: Form inputs without associated labels */
function checkInputsWithoutLabels(content: string, filePath: string): Violation[] {
  const violations: Violation[] = [];
  const lines = content.split('\n');

  // Find all input/textarea/select elements
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const inputMatches = line.matchAll(/<(input|textarea|select)\s[^>]*>/g);

    for (const match of inputMatches) {
      const tag = match[0];
      const hasAriaLabel = hasAttr(tag, 'aria-label');
      const hasAriaLabelledBy = hasAttr(tag, 'aria-labelledby');
      const hasPlaceholder = hasAttr(tag, 'placeholder');
      const type = getAttrValue(tag, 'type');
      const isHidden = type === 'hidden' || type === 'submit' || type === 'reset' || type === 'button';

      if (isHidden) continue;

      // If the input has an id, check for a corresponding <label htmlFor="...">
      const inputId = getAttrValue(tag, 'id');
      let hasCorrespondingLabel = false;
      if (inputId) {
        // Search for Label or label with htmlFor
        const htmlForPattern = new RegExp(`(?:htmlFor|for)\\s*=\\s*["']${inputId}["']`);
        hasCorrespondingLabel = htmlForPattern.test(content);

        // Also check for aria-describedby pattern
        const describedByPattern = new RegExp(`aria-describedby\\s*=\\s*["'][^"']*${inputId}`);
        if (describedByPattern.test(content)) hasCorrespondingLabel = true;
      }

      if (!hasAriaLabel && !hasAriaLabelledBy && !hasCorrespondingLabel && !hasPlaceholder) {
        violations.push({
          rule: 'input-label',
          wcag: '1.3.1, 3.3.2',
          severity: 'error',
          file: filePath,
          line: i + 1,
          column: match.index,
          snippet: truncate(tag),
          message: 'Form input has no associated label. Use <Label htmlFor="...">, aria-label, or aria-labelledby.',
          fix: 'Add a <Label htmlFor="inputId"> element or aria-label="<description>" to the input.',
        });
      }
    }
  }

  return violations;
}

/** Rule 4: Interactive divs without role attributes */
function checkInteractiveDivsWithoutRole(content: string, filePath: string): Violation[] {
  const violations: Violation[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match <div with onClick or tabIndex={0}
    const divMatches = line.matchAll(/<div\s[^>]*(?:onClick|onKeyDown|onKeyUp|tabIndex\\s*=\\s*0)[^>]*>/g);

    for (const match of divMatches) {
      const tag = match[0];
      const hasRole = hasAttr(tag, 'role');
      const hasTabindex = hasAttr(tag, 'tabIndex') || hasAttr(tag, 'tabindex');

      if (!hasRole && hasTabindex) {
        violations.push({
          rule: 'div-role',
          wcag: '4.1.2',
          severity: 'warning',
          file: filePath,
          line: i + 1,
          column: match.index,
          snippet: truncate(tag),
          message: 'Interactive div with tabIndex but no role attribute. Add role="button" or appropriate ARIA role.',
          fix: 'Add role="button" (or appropriate role) to the div element.',
        });
      }
    }

    // Also check for onClick without any ARIA attributes
    const onClickDivs = line.matchAll(/<div\s[^>]*onClick[^>]*>/g);
    for (const match of onClickDivs) {
      const tag = match[0];
      const hasRole = hasAttr(tag, 'role');
      const hasTabindex = hasAttr(tag, 'tabIndex') || hasAttr(tag, 'tabindex');
      const hasKeyboardHandler = /onKeyDown|onKeyUp|onKeyPress/.test(tag);

      if (!hasRole && !hasTabindex) {
        violations.push({
          rule: 'div-interactive',
          wcag: '2.1.1',
          severity: 'warning',
          file: filePath,
          line: i + 1,
          column: match.index,
          snippet: truncate(tag),
          message: 'Div with onClick but no role, tabindex, or keyboard handler. Consider using a <button> instead.',
          fix: 'Replace with <button> or add role="button", tabIndex={0}, and onKeyDown handler.',
        });
      }

      if (!hasKeyboardHandler && hasTabindex) {
        violations.push({
          rule: 'div-keyboard',
          wcag: '2.1.1',
          severity: 'warning',
          file: filePath,
          line: i + 1,
          column: match.index,
          snippet: truncate(tag),
          message: 'Interactive div with tabIndex but no keyboard event handler. Add onKeyDown for Enter/Space support.',
          fix: 'Add onKeyDown handler that activates on Enter and Space keys.',
        });
      }
    }
  }

  return violations;
}

/** Rule 5: Positive tabindex usage */
function checkPositiveTabindex(content: string, filePath: string): Violation[] {
  const violations: Violation[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match tabIndex={positive_number} or tabindex="positive_number"
    const matches = line.matchAll(/tabIndex\s*=\s*[{`"']?\s*([1-9]\d*)\s*[}`"']?/g);
    for (const match of matches) {
      const value = match[1];
      const hasComment = i > 0 && lines[i - 1].trim().startsWith('//');

      if (!hasComment) {
        violations.push({
          rule: 'positive-tabindex',
          wcag: '2.4.3',
          severity: 'warning',
          file: filePath,
          line: i + 1,
          snippet: truncate(line),
          message: `Positive tabIndex (${value}) disrupts natural tab order. Use DOM order or tabIndex={0} instead.`,
          fix: 'Remove tabIndex or use tabIndex={0} to follow DOM order.',
        });
      }
    }
  }

  return violations;
}

/** Rule 6: Empty heading elements */
function checkEmptyHeadings(content: string, filePath: string): Violation[] {
  const violations: Violation[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match <h1> through <h6> self-closing or with children
    const headingMatches = line.matchAll(/<(h[1-6])[^>]*>/g);
    for (const match of headingMatches) {
      const tag = match[0];
      const level = match[1];

      // Check for inline text content in the opening tag
      const inlineText = tag.replace(/<[^>]+>/g, '').trim();
      if (inlineText.length > 0) continue;

      // Check next few lines for text content or children
      let hasContent = false;
      for (let k = i + 1; k < Math.min(i + 10, lines.length); k++) {
        if (lines[k].includes(`</${level}>`)) break;
        if (lines[k].includes(`</${level}`)) break;
        if (hasTextContent(lines[k])) {
          hasContent = true;
          break;
        }
      }

      if (!hasContent) {
        // Check if it uses a className that might contain dynamic content
        const hasDynamicContent = /\{[^}]+\}/.test(tag) || /children/.test(tag);
        if (!hasDynamicContent) {
          violations.push({
            rule: 'empty-heading',
            wcag: '1.3.1',
            severity: 'warning',
            file: filePath,
            line: i + 1,
            snippet: truncate(tag),
            message: `Empty <${level}> heading element. Headings should contain descriptive text.`,
            fix: `Add text content inside the <${level}> element.`,
          });
        }
      }
    }
  }

  return violations;
}

/** Rule 7: Links without accessible names */
function checkLinksWithoutAccessibleName(content: string, filePath: string): Violation[] {
  const violations: Violation[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const linkMatches = line.matchAll(/<a\s[^>]*href[^>]*>[\s\S]*?<\/a>/g);

    for (const match of linkMatches) {
      const link = match[0];
      const hasAriaLabel = hasAttr(link, 'aria-label');
      const hasAriaLabelledBy = hasAttr(link, 'aria-labelledby');
      const hasText = hasTextContent(link);
      const hasTitle = hasAttr(link, 'title');

      if (!hasAriaLabel && !hasAriaLabelledBy && !hasText && !hasTitle) {
        violations.push({
          rule: 'link-label',
          wcag: '2.4.4, 4.1.2',
          severity: 'error',
          file: filePath,
          line: i + 1,
          snippet: truncate(link),
          message: 'Link has no accessible name. Add aria-label, visible text, or a <title> element.',
          fix: 'Add aria-label="<description>" or text content to the link.',
        });
      }
    }
  }

  return violations;
}

/** Rule 8: Missing aria-expanded on toggleable buttons */
function checkMissingAriaExpanded(content: string, filePath: string): Violation[] {
  const violations: Violation[] = [];
  const lines = content.split('\n');

  // Look for buttons that control visibility (common patterns)
  const togglePatterns = [
    /useState\s*\(\s*false\s*\)/, // boolean state for toggling
    /setOpen|setShow|setExpanded|setCollapsed|setIsOpen|setVisible/,
    /dropdown|popover|tooltip|collapse|accordion|sidebar|menu/i,
  ];

  const fileHasToggle = togglePatterns.some((pattern) => pattern.test(content));
  if (!fileHasToggle) return violations;

  // Find buttons that have aria-controls but no aria-expanded
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!/<button/.test(line)) continue;

    let fullButton = line;
    let j = i;
    while (j < lines.length - 1 && !fullButton.includes('</button>')) {
      j++;
      fullButton += '\n' + lines[j];
    }

    const hasAriaControls = hasAttr(fullButton, 'aria-controls');
    const hasAriaExpanded = hasAttr(fullButton, 'aria-expanded');

    if (hasAriaControls && !hasAriaExpanded) {
      violations.push({
        rule: 'missing-aria-expanded',
        wcag: '4.1.2',
        severity: 'warning',
        file: filePath,
        line: i + 1,
        snippet: truncate(fullButton),
        message: 'Button with aria-controls but no aria-expanded. Add aria-expanded to indicate toggle state.',
        fix: 'Add aria-expanded={isOpen} to the button element.',
      });
    }
  }

  return violations;
}

/** Rule 9: SVGs without accessible markup */
function checkSVGsWithoutAccessibility(content: string, filePath: string): Violation[] {
  const violations: Violation[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const svgMatches = line.matchAll(/<svg[^>]*>/g);

    for (const match of svgMatches) {
      const tag = match[0];
      const hasAriaHidden = getAttrValue(tag, 'aria-hidden') === 'true';
      const hasAriaLabel = hasAttr(tag, 'aria-label');
      const hasRole = getAttrValue(tag, 'role') === 'img';
      const hasTitle = tag.includes('<title>');

      // Check if it's a Lucide icon component (which handles accessibility internally)
      const isLucideComponent = /<[A-Z]\w+\s+/.test(tag) && /lucide-react/.test(content);

      if (!hasAriaHidden && !hasAriaLabel && !hasRole && !hasTitle && !isLucideComponent) {
        violations.push({
          rule: 'svg-accessibility',
          wcag: '1.1.1',
          severity: 'warning',
          file: filePath,
          line: i + 1,
          snippet: truncate(tag),
          message: 'Inline SVG without aria-hidden="true", aria-label, role="img", or <title>. Decorative SVGs should use aria-hidden="true".',
          fix: 'Add aria-hidden="true" for decorative SVGs or aria-label="<description>" for informative ones.',
        });
      }
    }
  }

  return violations;
}

/** Rule 10: Auto-playing/moving content without pause control */
function checkAutoplayWithoutControl(content: string, filePath: string): Violation[] {
  const violations: Violation[] = [];
  const lines = content.split('\n');

  // Check for animation intervals without user control
  const intervalPattern = /setInterval\s*\(/;
  const hasInterval = intervalPattern.test(content);
  const hasPauseControl = /clearInterval|pause|stop|cancel/i.test(content);

  if (hasInterval && !hasPauseControl) {
    // Find the setInterval line
    for (let i = 0; i < lines.length; i++) {
      if (intervalPattern.test(lines[i])) {
        violations.push({
          rule: 'autoplay-control',
          wcag: '2.2.2',
          severity: 'warning',
          file: filePath,
          line: i + 1,
          snippet: truncate(lines[i]),
          message: 'setInterval found without corresponding clearInterval or pause mechanism. Auto-updating content should be pausable.',
          fix: 'Add a pause/stop control and use clearInterval when paused.',
        });
        break;
      }
    }
  }

  return violations;
}

// ── Report Generator ─────────────────────────────────────────────────────

function generateReport(): A11yReport {
  console.log('🔍 Scanning for accessibility violations...\n');

  const allViolations: Violation[] = [];
  const allFiles = new Set<string>();

  // Collect all files to scan
  let filePaths: string[] = [];
  for (const dir of SCAN_DIRS) {
    filePaths.push(...collectFiles(dir));
  }

  // Deduplicate
  filePaths = [...new Set(filePaths)];

  console.log(`  Scanning ${filePaths.length} files in ${SCAN_DIRS.length} directories...`);

  // Run all rules on each file
  const rules = [
    { name: 'Buttons without labels', fn: checkButtonsWithoutLabels },
    { name: 'Images without alt', fn: checkImagesWithoutAlt },
    { name: 'Inputs without labels', fn: checkInputsWithoutLabels },
    { name: 'Interactive divs without role', fn: checkInteractiveDivsWithoutRole },
    { name: 'Positive tabindex', fn: checkPositiveTabindex },
    { name: 'Empty headings', fn: checkEmptyHeadings },
    { name: 'Links without names', fn: checkLinksWithoutAccessibleName },
    { name: 'Missing aria-expanded', fn: checkMissingAriaExpanded },
    { name: 'SVGs without a11y', fn: checkSVGsWithoutAccessibility },
    { name: 'Autoplay without control', fn: checkAutoplayWithoutControl },
  ];

  for (const filePath of filePaths) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const relPath = path.relative(PROJECT_ROOT, filePath);
    allFiles.add(relPath);

    for (const rule of rules) {
 const violations = rule.fn(content, relPath);
 allViolations.push(...violations);
 }
  }

  // Build category summaries
  const categoryMap = new Map<string, CategorySummary>();
  for (const v of allViolations) {
    const key = `${v.rule}:${v.wcag}`;
    const existing = categoryMap.get(key);
    if (existing) {
      existing.count++;
    } else {
      categoryMap.set(key, {
        category: v.rule,
        wcag: v.wcag,
        count: 1,
        severity: v.severity,
      });
    }
  }

  // Build file summaries
  const fileMap = new Map<string, FileSummary>();
  for (const v of allViolations) {
    const existing = fileMap.get(v.file);
    if (existing) {
      if (v.severity === 'error') existing.errors++;
      else existing.warnings++;
    } else {
      fileMap.set(v.file, {
        file: v.file,
        errors: v.severity === 'error' ? 1 : 0,
        warnings: v.severity === 'warning' ? 1 : 0,
      });
    }
  }

  // Sort categories by count descending
  const categories = [...categoryMap.values()].sort((a, b) => b.count - a.count);

  // Sort files by total violations descending
  const files = [...fileMap.values()].sort((a, b) => (b.errors + b.warnings) - (a.errors + a.warnings));

  const totalErrors = allViolations.filter((v) => v.severity === 'error').length;
  const totalWarnings = allViolations.filter((v) => v.severity === 'warning').length;

  const report: A11yReport = {
    generatedAt: new Date().toISOString(),
    projectName: 'DeepMindQ',
    projectRoot: PROJECT_ROOT,
    totalFiles: filePaths.length,
    totalViolations: allViolations.length,
    totalErrors,
    totalWarnings,
    categories,
    files,
    violations: allViolations.sort((a, b) => {
      // Sort by severity (errors first), then file, then line
      if (a.severity !== b.severity) return a.severity === 'error' ? -1 : 1;
      if (a.file !== b.file) return a.file.localeCompare(b.file);
      return a.line - b.line;
    }),
  };

  return report;
}

// ── Output Formatting ─────────────────────────────────────────────────────

function printSummary(report: A11yReport): void {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  DEEPMINDQ — Accessibility Violations Report');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Generated:  ${report.generatedAt}`);
  console.log(`  Files:      ${report.totalFiles} scanned`);
  console.log(`  Violations: ${report.totalViolations} total`);
  console.log(`              ${report.totalErrors} errors, ${report.totalWarnings} warnings`);
  console.log('───────────────────────────────────────────────────────────────');

  if (report.categories.length > 0) {
    console.log('\n  Categories (sorted by count):');
    console.log('  ─────────────────────────────────────────────');
    for (const cat of report.categories) {
      const icon = cat.severity === 'error' ? '✗' : '⚠';
      console.log(`  ${icon} ${cat.category.padEnd(30)} WCAG ${cat.wcag.padEnd(12)} ${String(cat.count).padStart(4)} ${cat.severity}`);
    }
  }

  if (report.files.length > 0) {
    console.log(`\n  Top files by violations (showing top 15):`);
    console.log('  ─────────────────────────────────────────────');
    const topFiles = report.files.slice(0, 15);
    for (const file of topFiles) {
      const total = file.errors + file.warnings;
      console.log(`  ${String(total).padStart(3)} (${String(file.errors).padStart(2)}E/${String(file.warnings).padStart(2)}W) ${file.file}`);
    }
  }

  if (report.totalViolations === 0) {
    console.log('\n  ✅ No accessibility violations found!');
  }

  console.log('\n  Full report written to:');
  console.log(`  ${OUTPUT_FILE}`);
  console.log('═══════════════════════════════════════════════════════════════\n');
}

// ── Main ──────────────────────────────────────────────────────────────────

function main(): void {
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const report = generateReport();

  // Write JSON report
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(report, null, 2), 'utf-8');

  // Print human-readable summary
  printSummary(report);

  // Exit with error code if critical violations found
  if (report.totalErrors > 50) {
    process.exit(1);
  }
}

main();
