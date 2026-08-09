#!/usr/bin/env node
/**
 * M4 Phase 2 — CI Pipeline Verification Report
 * Generates CI_STATUS_MATRIX.docx with verified GitHub Actions results
 */
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, HeadingLevel, BorderStyle, WidthType, ShadingType,
  PageBreak, Header, Footer, PageNumber, SectionType, TableLayoutType
} = require("docx");

// ═══════════════════════════════════════════════════════
// PALETTE — DM-1 Deep Cyan (Tech/AI)
// ═══════════════════════════════════════════════════════
const P = {
  bg: "162235", primary: "FFFFFF", accent: "37DCF2",
  body: "000000", secondary: "5A6080", surface: "EDF3F5",
  table: { headerBg: "1B6B7A", headerText: "FFFFFF", accentLine: "1B6B7A", innerLine: "C8DDE2", surface: "EDF3F5" },
  titleColor: "FFFFFF", subtitleColor: "B0B8C0", metaColor: "90989F", footerColor: "687078"
};

const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };

// ═══════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════
function calcTitleLayout(title, maxWidthTwips, preferredPt = 40, minPt = 24) {
  const charWidth = (pt) => pt * 20;
  const charsPerLine = (pt) => Math.floor(maxWidthTwips / charWidth(pt));
  let titlePt = preferredPt;
  let lines;
  while (titlePt >= minPt) {
    const cpl = charsPerLine(titlePt);
    if (cpl < 2) { titlePt -= 2; continue; }
    lines = title.length <= cpl ? [title] : splitTitleLines(title, cpl);
    if (lines.length <= 3) break;
    titlePt -= 2;
  }
  if (!lines || lines.length > 3) {
    lines = [title.substring(0, Math.floor(title.length / 3)), title.substring(Math.floor(title.length / 3), Math.floor(title.length * 2 / 3)), title.substring(Math.floor(title.length * 2 / 3))];
    titlePt = minPt;
  }
  return { titlePt, titleLines: lines };
}

function splitTitleLines(title, charsPerLine) {
  if (title.length <= charsPerLine) return [title];
  const breakAfter = new Set([...' ,;:-_—–/', ...' \t']);
  const lines = [];
  let remaining = title;
  while (remaining.length > charsPerLine) {
    let breakAt = charsPerLine;
    for (let i = charsPerLine; i >= Math.floor(charsPerLine * 0.6); i--) {
      if (remaining[i - 1] && breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
    }
    lines.push(remaining.slice(0, breakAt).trim());
    remaining = remaining.slice(breakAt).trim();
  }
  if (remaining) lines.push(remaining);
  return lines;
}

function calcCoverSpacing(params) {
  const {
    titleLineCount = 1, titlePt = 36, hasSubtitle = false,
    hasEnglishLabel = false, metaLineCount = 0,
    fixedHeight = 800, pageHeight = 16838
  } = params;
  const SAFETY = 1200;
  const usableHeight = pageHeight - SAFETY;
  const titleHeight = titleLineCount * (titlePt * 23 + 200);
  const subtitleHeight = hasSubtitle ? (12 * 23 + 600) : 0;
  const englishLabelHeight = hasEnglishLabel ? (9 * 23 + 600) : 0;
  const metaHeight = metaLineCount * (10 * 23 + 100);
  const implicitParaHeight = 3 * 300;
  const contentHeight = titleHeight + subtitleHeight + englishLabelHeight + metaHeight + fixedHeight + implicitParaHeight;
  const safeRemaining = Math.max(usableHeight - contentHeight, 400);
  const FOOTER_MIN = 800;
  const rawTop = Math.floor(safeRemaining * 0.45);
  const rawBottom = Math.floor(safeRemaining * 0.45);
  const bottomSpacing = Math.max(rawBottom, FOOTER_MIN);
  const topSpacing = Math.max(rawTop - Math.max(0, FOOTER_MIN - rawBottom), 400);
  return { topSpacing, midSpacing: 0, bottomSpacing };
}

// ═══════════════════════════════════════════════════════
// COVER — R1 Pure Paragraph Left
// ═══════════════════════════════════════════════════════
function buildCoverR1(config) {
  const padL = 1200, padR = 800;
  const availableWidth = 11906 - padL - padR - 300;
  const { titlePt, titleLines } = calcTitleLayout(config.title, availableWidth, 38, 24);
  const titleSize = titlePt * 2;
  const spacing = calcCoverSpacing({
    titleLineCount: titleLines.length, titlePt,
    hasSubtitle: !!config.subtitle, hasEnglishLabel: !!config.englishLabel,
    metaLineCount: (config.metaLines || []).length, fixedHeight: 400
  });
  const accentLeft = { style: BorderStyle.SINGLE, size: 8, color: P.accent, space: 12 };
  const children = [];
  children.push(new Paragraph({ spacing: { before: spacing.topSpacing } }));
  if (config.englishLabel) {
    children.push(new Paragraph({
      indent: { left: padL, right: padR }, spacing: { after: 500 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: P.accent, space: 8 } },
      children: [new TextRun({ text: config.englishLabel.split("").join("  "),
        size: 18, color: P.accent, font: { ascii: "Calibri", eastAsia: "SimHei" }, characterSpacing: 40 })]
    }));
  }
  for (let i = 0; i < titleLines.length; i++) {
    children.push(new Paragraph({
      indent: { left: padL },
      spacing: { after: i < titleLines.length - 1 ? 100 : 300, line: Math.ceil(titlePt * 23), lineRule: "atLeast" },
      children: [new TextRun({ text: titleLines[i], size: titleSize, bold: true,
        color: P.titleColor, font: { eastAsia: "SimHei", ascii: "Arial" } })]
    }));
  }
  if (config.subtitle) {
    children.push(new Paragraph({
      indent: { left: padL }, spacing: { after: 800 },
      children: [new TextRun({ text: config.subtitle, size: 24, color: P.subtitleColor,
        font: { eastAsia: "Microsoft YaHei", ascii: "Arial" } })]
    }));
  }
  for (const line of (config.metaLines || [])) {
    children.push(new Paragraph({
      indent: { left: padL + 200 }, spacing: { after: 80 },
      border: { left: accentLeft },
      children: [new TextRun({ text: line, size: 24, color: P.metaColor,
        font: { eastAsia: "Microsoft YaHei", ascii: "Arial" } })]
    }));
  }
  children.push(new Paragraph({ spacing: { before: spacing.bottomSpacing } }));
  children.push(new Paragraph({
    indent: { left: padL, right: padR },
    border: { top: { style: BorderStyle.SINGLE, size: 2, color: P.accent, space: 8 } },
    spacing: { before: 200 },
    children: [
      new TextRun({ text: config.footerLeft || "", size: 16, color: P.footerColor, font: { ascii: "Arial" } }),
      new TextRun({ text: "                                        " }),
      new TextRun({ text: config.footerRight || "", size: 16, color: P.footerColor, font: { ascii: "Arial" } })
    ]
  }));
  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: 16838, rule: "exact" },
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: P.bg }, borders: noBorders,
        children
      })]
    })]
  })];
}

// ═══════════════════════════════════════════════════════
// BODY HELPERS
// ═══════════════════════════════════════════════════════
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 120 },
    children: [new TextRun({ text, bold: true, color: P.table.headerBg, size: 32,
      font: { ascii: "Times New Roman", eastAsia: "SimHei" } })]
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, color: P.table.headerBg, size: 28,
      font: { ascii: "Times New Roman", eastAsia: "SimHei" } })]
  });
}

function body(text) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { line: 312, after: 120 },
    children: [new TextRun({ text, size: 24, color: "000000",
      font: { ascii: "Times New Roman", eastAsia: "SimSun" } })]
  });
}

function bodyBold(text) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { line: 312, after: 120 },
    children: [new TextRun({ text, size: 24, color: "000000", bold: true,
      font: { ascii: "Times New Roman", eastAsia: "SimSun" } })]
  });
}

function spacer(twips = 200) {
  return new Paragraph({ spacing: { before: twips } });
}

// ═══════════════════════════════════════════════════════
// TABLE BUILDER — CI STATUS MATRIX
// ═══════════════════════════════════════════════════════
function buildStatusTable(rows) {
  const headers = ["#", "Job Name", "Type", "Status", "Tests", "Failures", "Duration"];
  const colWidths = [5, 28, 14, 12, 16, 10, 15]; // percentages

  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) => new TableCell({
      width: { size: colWidths[i], type: WidthType.PERCENTAGE },
      shading: { type: ShadingType.CLEAR, fill: P.table.headerBg },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 4, color: P.table.accentLine },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: P.table.accentLine },
        left: NB, right: NB
      },
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: h, bold: true, size: 20, color: P.table.headerText,
          font: { ascii: "Calibri", eastAsia: "SimHei" } })]
      })]
    }))
  });

  const dataRows = rows.map((row, idx) => {
    const isEven = idx % 2 === 0;
    return new TableRow({
      children: row.map((cell, i) => new TableCell({
        width: { size: colWidths[i], type: WidthType.PERCENTAGE },
        shading: isEven
          ? { type: ShadingType.CLEAR, fill: P.table.surface }
          : { type: ShadingType.CLEAR, fill: "FFFFFF" },
        borders: {
          top: NB, left: NB, right: NB,
          bottom: { style: BorderStyle.SINGLE, size: 1, color: P.table.innerLine }
        },
        margins: { top: 40, bottom: 40, left: 100, right: 100 },
        children: [new Paragraph({
          alignment: i === 0 ? AlignmentType.CENTER : AlignmentType.LEFT,
          children: [new TextRun({ text: cell, size: 20, color: "000000",
            font: { ascii: "Calibri", eastAsia: "SimSun" } })]
        })]
      }))
    });
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: P.table.accentLine },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: P.table.accentLine },
      left: NB, right: NB, insideVertical: NB,
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: P.table.innerLine }
    },
    rows: [headerRow, ...dataRows]
  });
}

// ═══════════════════════════════════════════════════════
// DOCUMENT CONTENT
// ═══════════════════════════════════════════════════════

// Cover config
const coverConfig = {
  title: "M4 Phase 2 CI Pipeline Verification Report",
  subtitle: "GitHub Actions Verified Green Dashboard",
  englishLabel: "DEEPMINDQ CRM  |  ENTERPRISE TEST ARCHITECTURE",
  metaLines: [
    "GitHub Run ID: 31013199087",
    "Commit SHA: 9208c4827dc2b7e64bafc41de6852aed1ffd57ce",
    "Branch: main | Date: 2026-08-05T14:02:56Z",
    "Workflow Conclusion: SUCCESS"
  ],
  footerLeft: "DeepMindQ CRM",
  footerRight: "M4 Phase 2 Closure",
  palette: P
};

// CI STATUS MATRIX DATA — All 19 jobs from verified GitHub Actions run
const ciJobs = [
  // Blocking jobs (10)
  ["1",  "Security Gate",          "Blocking",   "SUCCESS", "13 files / 333 tests", "0", "4.16s"],
  ["2",  "Dependency Audit",       "Blocking",   "SUCCESS", "Script scan",         "0", "< 2s"],
  ["3",  "API Security Contract",  "Blocking",   "SUCCESS", "250 routes scanned",  "0", "< 2s"],
  ["4",  "Lint + Typecheck",       "Blocking",   "SUCCESS", "ESLint + tsc",        "0", "N/A"],
  ["5",  "Unit Tests",             "Blocking",   "SUCCESS", "29 files / 943 tests", "0", "102s"],
  ["6",  "Security Tests",         "Blocking",   "SUCCESS", "13 files / 333 tests", "0", "4.24s"],
  ["7",  "API Tests (PostgreSQL)", "Blocking",   "SUCCESS", "12 files / 759 tests", "0", "3.74s"],
  ["8",  "Database Tests (Pg)",    "Blocking",   "SUCCESS", "10 files / 343 tests", "0", "2.28s"],
  ["9",  "Integration Tests",     "Blocking",   "SUCCESS", "7 files / 158 tests",  "0", "0.90s"],
  ["10", "Build Verification",     "Blocking",   "SUCCESS", "Next.js build",       "0", "N/A"],
  // Non-blocking jobs (9)
  ["11", "AI Engine",              "Non-Blocking","SUCCESS", "22 files / 409 tests", "0", "2.43s"],
  ["12", "AI Governance",          "Non-Blocking","SUCCESS", "16 files / 574 tests", "0", "299s"],
  ["13", "AI Retrieval",           "Non-Blocking","SUCCESS", "2 files / 91 tests",   "0", "0.57s"],
  ["14", "AI Framework",          "Non-Blocking","SUCCESS", "6 files / 386 tests",  "0", "1.46s"],
  ["15", "AI Inference",           "Non-Blocking","SUCCESS", "1 file / 3 tests",     "0", "0.25s"],
  ["16", "E2E Tests",              "Non-Blocking","SUCCESS", "4 files / 67 tests",   "0", "2.24s"],
  ["17", "Performance",            "Non-Blocking","SUCCESS", "14 files / 231 tests", "0", "5.37s"],
  ["18", "UI Components",          "Non-Blocking","SUCCESS", "2 files / 102 tests",  "0", "1.63s"],
  ["19", "Playwright E2E",         "Non-Blocking","SUCCESS", "11 browser tests",     "0", "4.2s"],
];

// Summary stats
const totalTests = 333 + 943 + 333 + 759 + 343 + 158 + 409 + 574 + 91 + 386 + 3 + 67 + 231 + 102 + 11;
const totalTestFiles = 13 + 29 + 13 + 12 + 10 + 7 + 22 + 16 + 2 + 6 + 1 + 4 + 14 + 2 + 11;

const bodyChildren = [
  // ═══ SECTION 1: Executive Summary ═══
  h1("1. Executive Summary"),
  body("This report provides the verified CI pipeline status for the DeepMindQ CRM project at the conclusion of M4 Phase 2. The GitHub Actions CI pipeline has been triggered, executed to completion, and verified with a fully green dashboard. All 19 configured CI jobs passed successfully, with zero failures and zero skipped jobs. This represents the achievement of the M4 Phase 2 acceptance criterion: the CI system itself proves pipeline integrity."),
  spacer(100),
  bodyBold("Key Metrics:"),
  body("Total Jobs: 19 | Passed: 19 | Failed: 0 | Skipped: 0. Total test files executed: " + totalTestFiles + ". Total individual tests executed across all vitest configurations: " + totalTests + ". Playwright browser tests: 11 passed. Security scans: 250 API routes verified. Build verification: Next.js 16.2.12 production build succeeded."),
  body("The pipeline was triggered by commit 9208c48 on branch main at 2026-08-05T14:02:56Z (GitHub Run ID: 31013199087). The workflow completed with conclusion: success. The GitHub Actions dashboard URL is: https://github.com/DeepMindQ/deepmindq-crm/actions/runs/31013199087"),

  // ═══ SECTION 2: CI STATUS MATRIX ═══
  h1("2. CI Status Matrix"),
  body("The following table presents the complete CI STATUS MATRIX for every configured GitHub Actions job. Each job was executed in the GitHub Actions environment (ubuntu-latest runner) and completed with verified success status. The matrix covers both blocking jobs (which gate the merge pipeline) and non-blocking jobs (which run with if: always() and do not block merge)."),
  spacer(100),
  buildStatusTable(ciJobs),
  spacer(100),

  // ═══ SECTION 3: Blocking Jobs Detail ═══
  h1("3. Blocking Jobs Detailed Results"),
  body("Blocking jobs represent the core quality gate for the CI pipeline. All 10 blocking jobs must pass for the final Build Verification job to execute. In this verified run, all 10 blocking jobs passed on the first attempt, demonstrating the stability of the test architecture and the reliability of the CI pipeline configuration."),
  spacer(100),

  h2("3.1 Security Gate"),
  body("The Security Gate job ran 13 test files containing 333 security regression tests in 4.16 seconds. All tests passed. Additionally, the job verified 8 static security checks including edge proxy existence, CSRF flow integrity (generateCsrfToken, timingSafeEqual, validateCsrf), AI route authentication guards (checkApiAuth on all AI API routes), security headers (X-Content-Type-Options, X-Frame-Options, HSTS, CSP, Referrer-Policy), DOMPurify sanitization, CSP policy (no unsafe-inline in script-src), AuthProvider session validation, and environment variable encryption key validation."),
  spacer(80),

  h2("3.2 Dependency Audit"),
  body("The Dependency Audit job executed the CI dependency audit script, which scans all npm dependencies for high and critical vulnerabilities. The audit passed with the output: CI PASSED: All high/critical vulnerabilities are documented exceptions. This confirms that all known vulnerability findings in the dependency tree are tracked and accepted as documented exceptions, not unmanaged risk."),
  spacer(80),

  h2("3.3 API Security Contract"),
  body("The API Security Contract scan verified all API routes for authentication guard compliance. The scan confirmed 219 protected routes and 31 public routes, totaling 250 routes. All API routes that require authentication have the appropriate auth guard middleware applied, ensuring no route is exposed without proper authorization."),
  spacer(80),

  h2("3.4 Lint + Typecheck"),
  body("The Lint and Typecheck job executed ESLint on the entire codebase followed by TypeScript compilation (tsc --noEmit). Both checks passed with zero errors. The only ESLint output was 2 warnings in tests/ai/wi16-hybrid-retrieval.test.ts (no-unused-expressions) which are non-blocking advisory warnings."),
  spacer(80),

  h2("3.5 Unit Tests"),
  body("The Unit Tests job executed 29 test files containing 943 individual tests in approximately 102 seconds. All 943 tests passed with zero failures. This job uses vitest.unit.config.ts with threads pool configuration and CI environment variables (NODE_OPTIONS: --max-old-space-size=2048). The job includes coverage generation which also passed successfully. Unit test results are uploaded as artifacts (unit-test-results, retention: 14 days)."),
  spacer(80),

  h2("3.6 Security Tests"),
  body("The Security Tests job ran the same vitest.security.config.ts configuration as the Security Gate, executing 13 test files with 333 tests in 4.24 seconds. All tests passed. This job serves as a dedicated verification of the security test suite separate from the gate's static checks."),
  spacer(80),

  h2("3.7 API Tests (with PostgreSQL)"),
  body("The API Tests job ran with a PostgreSQL 16 service container (postgres:16-alpine) for database-dependent tests. The job deployed the database schema via Prisma migrations, seeded CI test data, and executed 12 test files containing 759 API route handler tests in 3.74 seconds. All tests passed. The PostgreSQL service container was healthy and responsive throughout the job execution."),
  spacer(80),

  h2("3.8 Database Tests (with PostgreSQL)"),
  body("The Database Tests job also used a PostgreSQL 16 service container. It ran 10 test files with 343 database and Prisma-layer tests in 2.28 seconds. All tests passed. This confirms that the Prisma client generation, migration deployment, and database query layer are functioning correctly in the CI environment."),
  spacer(80),

  h2("3.9 Integration Tests"),
  body("The Integration Tests job executed 7 test files containing 158 cross-module integration tests in 0.90 seconds. All tests passed. These tests verify that multiple system modules work together correctly, covering auth flows, data pipelines, and API integration points."),
  spacer(80),

  h2("3.10 Build Verification"),
  body("The Build Verification job executed npm run build:vercel to produce a production-ready Next.js build. The build succeeded with Next.js 16.2.12, producing optimized static and dynamic routes. Build completion was the final job in the pipeline, confirming that all upstream blocking jobs passed and the codebase is ready for deployment."),

  // ═══ SECTION 4: Non-Blocking Jobs Detail ═══
  h1("4. Non-Blocking Jobs Detailed Results"),
  body("Non-blocking jobs use the if: always() condition in the CI workflow, meaning they execute regardless of the outcome of upstream blocking jobs. They do not block the merge pipeline but provide valuable signal about system health across specialized domains."),
  spacer(100),

  h2("4.1 AI Test Suites"),
  body("All five AI test suite jobs passed successfully. The AI Engine suite executed 22 files with 409 tests (2.43s). The AI Governance suite executed 16 files with 574 tests (299s), confirming that removing the || true suppression from the previous session did not introduce hidden failures. The AI Retrieval suite ran 2 files with 91 tests (0.57s). The AI Framework suite ran 6 files with 386 tests (1.46s). The AI Inference suite ran 1 file with 3 tests (0.25s). All AI governance checks (callLLM imports, ModelRouter imports, raw fetch() to AI providers) remain passing."),
  spacer(80),

  h2("4.2 E2E, Performance, and UI Tests"),
  body("The E2E Tests job ran 4 files with 67 end-to-end business journey tests (2.24s). The Performance job ran 14 files with 231 benchmark/scale/memory tests (5.37s). The UI Components job ran 2 files with 102 React component tests (1.63s). All tests passed successfully."),
  spacer(80),

  h2("4.3 Playwright E2E"),
  body("The Playwright E2E job completed the full browser-based end-to-end test pipeline: Chromium browser installation (114.7 MB), Next.js production build, application startup on port 3000, and execution of 11 Playwright browser tests in 4.2 seconds. All 11 tests passed. The Playwright report was uploaded as an artifact (playwright-report, retention: 14 days). This confirms that the application renders correctly in a real Chromium browser with full navigation and interaction capabilities."),
  spacer(100),

  // ═══ SECTION 5: Fix Applied This Session ═══
  h1("5. Fix Applied This Session"),
  body("During the initial CI run (Run ID: 31012022640, SHA: 3042ffb), the Security Gate job failed with 1 test failure out of 333 tests. The failure was in test file tests/security/security-phase4-critical-input-path.test.ts, specifically the test case rbac imports are present in src/ which used execSync with a hardcoded /home/z/my-project/src path to grep for RBAC imports. In the GitHub Actions runner environment, the project directory is /home/runner/work/deepmindq-crm/deepmindq-crm, so the grep command failed against a non-existent path."),
  spacer(80),
  body("The fix replaced the shell execSync grep approach with a portable Node.js-native recursive file search using readdirSync and RegExp matching. The fix resolves __dirname relative to the test file location, making it work correctly in any environment. The test now traverses the src/ directory using pure Node.js fs APIs, matching import statements against the pattern /from\\s+['\"].*rbac['\"]. No external shell commands or hardcoded paths are used. The fix was committed as 9208c48 and pushed to main, triggering the successful verified CI run."),
  spacer(100),

  // ═══ SECTION 6: Closure Certification ═══
  h1("6. M4 Phase 2 Closure Certification"),
  body("This section certifies the closure conditions for M4 Phase 2 based on verified GitHub Actions execution, not local assumptions or documented exceptions."),
  spacer(80),
  bodyBold("Acceptance Criteria: GitHub CI pipeline is a trusted signal and all configured CI jobs have verified status."),
  body("Result: MET. All 19 jobs passed on the GitHub Actions dashboard. Zero failures. Zero skipped jobs. Zero unexplained red indicators."),
  spacer(80),
  bodyBold("Verification Summary:"),
  body("Git SHA: 9208c4827dc2b7e64bafc41de6852aed1ffd57ce. GitHub Actions Run ID: 31013199087. Workflow: CI. Branch: main. Status: completed. Conclusion: success. Total jobs: 19. Passed: 19. Failed: 0. Skipped: 0. Dashboard URL: https://github.com/DeepMindQ/deepmindq-crm/actions/runs/31013199087"),
  spacer(80),
  body("The CI pipeline is now a trustworthy signal. The GitHub Actions dashboard accurately reflects the engineering state of the codebase. M4 Phase 2 is formally closed, and the project is cleared to proceed to M4 Phase 3: Deployment Pipeline Foundation."),
];

// ═══════════════════════════════════════════════════════
// ASSEMBLE DOCUMENT
// ═══════════════════════════════════════════════════════
const doc = new Document({
  styles: {
    default: {
      document: {
        run: {
          font: { ascii: "Times New Roman", eastAsia: "SimSun" },
          size: 24, color: "000000"
        },
        paragraph: { spacing: { line: 312 } }
      }
    }
  },
  sections: [
    // Cover section (margin: 0)
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 0, bottom: 0, left: 0, right: 0 }
        }
      },
      children: buildCoverR1(coverConfig)
    },
    // Body section (standard margins)
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
          pageNumbers: { start: 1 }
        }
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: "M4 Phase 2 CI Pipeline Verification",
              size: 16, color: P.secondary, font: { ascii: "Calibri" } })]
          })]
        })
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: "DeepMindQ CRM  |  Page ", size: 16, color: P.secondary, font: { ascii: "Calibri" } }),
              new TextRun({ children: [PageNumber.CURRENT], size: 16, color: P.secondary, font: { ascii: "Calibri" } })
            ]
          })]
        })
      },
      children: bodyChildren
    }
  ]
});

// Generate
const OUTPUT = "/home/z/my-project/download/CI_STATUS_MATRIX_VERIFICATION.docx";
Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(OUTPUT, buf);
  console.log("Document generated: " + OUTPUT);
}).catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
