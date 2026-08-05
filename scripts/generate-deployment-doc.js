// M4 Phase 3 — Deployment Pipeline Architecture Document
// Recipe: R1 (Pure Paragraph Left), Palette: DM-1 (Deep Cyan — Tech/AI)
// Scene: Report (tech industry)

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, PageBreak, SectionType, TableOfContents, AlignmentType,
  WidthType, BorderStyle, ShadingType, TableLayoutType,
} = require("docx");

// ── Color Palette: DM-1 Deep Cyan ──
const P = {
  bg: "162235",
  primary: "0A1628",
  body: "1A2B40",
  secondary: "6878A0",
  accent: "5B8DB8",
  surface: "F4F8FC",
  table: {
    headerBg: "1B6B7A",
    headerText: "FFFFFF",
    accentLine: "1B6B7A",
    innerLine: "C8DDE2",
    surface: "EDF3F5",
  },
  cover: {
    titleColor: "FFFFFF",
    subtitleColor: "B0B8C0",
    metaColor: "90989F",
    footerColor: "687078",
  },
};

// ── Border helpers ──
const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };

// ── Helper: table cell ──
function hCell(text, width) {
  return new TableCell({
    shading: { type: ShadingType.CLEAR, fill: P.table.headerBg },
    borders: { top: NB, bottom: NB, left: NB, right: NB },
    children: [new Paragraph({ spacing: { before: 40, after: 40 }, children: [new TextRun({ text, bold: true, size: 20, color: P.table.headerText, font: { ascii: "Calibri", eastAsia: "SimHei" } })] })],
    width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
  });
}

function dCell(text, width) {
  return new TableCell({
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: P.table.innerLine },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: P.table.innerLine },
      left: NB, right: NB,
    },
    children: [new Paragraph({ spacing: { before: 30, after: 30 }, children: [new TextRun({ text, size: 20, color: P.body, font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })] })],
    width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
  });
}

function tableHeaderRow(cells) {
  return new TableRow({ tableHeader: true, cantSplit: true, children: cells });
}

function tableDataRow(cells) {
  return new TableRow({ cantSplit: true, children: cells });
}

// ── Heading helper ──
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 200 },
    children: [new TextRun({ text, bold: true, size: 32, color: P.primary, font: { ascii: "Calibri", eastAsia: "SimHei" } })],
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 300, after: 150 },
    children: [new TextRun({ text, bold: true, size: 28, color: P.primary, font: { ascii: "Calibri", eastAsia: "SimHei" } })],
  });
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 100 },
    children: [new TextRun({ text, bold: true, size: 24, color: P.secondary, font: { ascii: "Calibri", eastAsia: "SimHei" } })],
  });
}

function body(text) {
  return new Paragraph({
    spacing: { before: 60, after: 60, line: 312 },
    children: [new TextRun({ text, size: 22, color: P.body, font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })],
  });
}

function bodyRuns(runs) {
  return new Paragraph({
    spacing: { before: 60, after: 60, line: 312 },
    children: runs,
  });
}

function bullet(text) {
  return new Paragraph({
    spacing: { before: 30, after: 30, line: 312 },
    indent: { left: 480, hanging: 240 },
    children: [new TextRun({ text: `\u2022  ${text}`, size: 22, color: P.body, font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })],
  });
}

function codeBlock(lines) {
  return lines.map(line => new Paragraph({
    spacing: { before: 0, after: 0, line: 276 },
    indent: { left: 480 },
    children: [new TextRun({ text: line, size: 18, color: "4A5568", font: { ascii: "Consolas", eastAsia: "Microsoft YaHei" } })],
    shading: { type: ShadingType.CLEAR, fill: P.surface },
    border: { left: { style: BorderStyle.SINGLE, size: 6, color: P.accent } },
  }));
}

function spacer(twips = 200) {
  return new Paragraph({ spacing: { before: twips } });
}

// ── Cover Recipe R1 helpers ──
function calcTitleLayout(title, maxWidthTwips, preferredPt = 40, minPt = 24) {
  const charWidth = (pt) => pt * 20;
  const charsPerLine = (pt) => Math.floor(maxWidthTwips / charWidth(pt));
  let titlePt = preferredPt;
  let lines;
  while (titlePt >= minPt) {
    const cpl = charsPerLine(titlePt);
    if (cpl < 2) { titlePt -= 2; continue; }
    lines = splitTitleLines(title, cpl);
    if (lines.length <= 3) break;
    titlePt -= 2;
  }
  if (!lines || lines.length > 3) {
    const cpl = charsPerLine(minPt);
    lines = splitTitleLines(title, cpl);
    titlePt = minPt;
  }
  return { titlePt, titleLines: lines };
}

function splitTitleLines(title, charsPerLine) {
  if (title.length <= charsPerLine) return [title];
  const breakAfter = new Set([...'-_ \t']);
  const lines = [];
  let remaining = title;
  while (remaining.length > charsPerLine) {
    let breakAt = -1;
    for (let i = charsPerLine; i >= Math.floor(charsPerLine * 0.6); i--) {
      if (i < remaining.length && breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
    }
    if (breakAt === -1) breakAt = charsPerLine;
    lines.push(remaining.slice(0, breakAt).trim());
    remaining = remaining.slice(breakAt).trim();
  }
  if (remaining) lines.push(remaining);
  if (lines.length > 1 && lines[lines.length - 1].length <= 2) {
    const last = lines.pop();
    lines[lines.length - 1] += last;
  }
  return lines;
}

function calcCoverSpacing(params) {
  const {
    titleLineCount = 1, titlePt = 36, hasSubtitle = false,
    hasEnglishLabel = false, metaLineCount = 0, fixedHeight = 800,
    pageHeight = 16838, marginTop = 0, marginBottom = 0,
  } = params;
  const SAFETY = 1200;
  const usableHeight = pageHeight - marginTop - marginBottom - SAFETY;
  const titleHeight = titleLineCount * (titlePt * 23 + 200);
  const subtitleHeight = hasSubtitle ? (12 * 23 + 600) : 0;
  const englishLabelHeight = hasEnglishLabel ? (9 * 23 + 600) : 0;
  const metaHeight = metaLineCount * (10 * 23 + 100);
  const implicitParaHeight = 3 * 300;
  const contentHeight = titleHeight + subtitleHeight + englishLabelHeight + metaHeight + fixedHeight + implicitParaHeight;
  const remainingSpace = usableHeight - contentHeight;
  const safeRemaining = Math.max(remainingSpace, 400);
  const FOOTER_MIN = 800;
  const rawTop = Math.floor(safeRemaining * 0.45);
  const rawBottom = Math.floor(safeRemaining * 0.45);
  const bottomSpacing = Math.max(rawBottom, FOOTER_MIN);
  const topSpacing = Math.max(rawTop - Math.max(0, FOOTER_MIN - rawBottom), 400);
  return { topSpacing, bottomSpacing };
}

function buildCoverR1(config) {
  const P = config.palette;
  const padL = 1200, padR = 800;
  const availableWidth = 11906 - padL - padR - 300;
  const { titlePt, titleLines } = calcTitleLayout(config.title, availableWidth, 40, 24);
  const titleSize = titlePt * 2;
  const spacing = calcCoverSpacing({
    titleLineCount: titleLines.length, titlePt,
    hasSubtitle: !!config.subtitle, hasEnglishLabel: !!config.englishLabel,
    metaLineCount: (config.metaLines || []).length, fixedHeight: 400,
  });
  const accentLeft = { style: BorderStyle.SINGLE, size: 8, color: P.accent, space: 12 };
  const children = [];

  children.push(new Paragraph({ spacing: { before: spacing.topSpacing } }));

  if (config.englishLabel) {
    children.push(new Paragraph({
      indent: { left: padL, right: padR }, spacing: { after: 500 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: P.accent, space: 8 } },
      children: [new TextRun({ text: config.englishLabel.split("").join("  "),
        size: 18, color: P.accent, font: { ascii: "Calibri" }, characterSpacing: 40 })],
    }));
  }

  for (let i = 0; i < titleLines.length; i++) {
    children.push(new Paragraph({
      indent: { left: padL },
      spacing: { after: i < titleLines.length - 1 ? 100 : 300, line: Math.ceil(titlePt * 23), lineRule: "atLeast" },
      children: [new TextRun({ text: titleLines[i], size: titleSize, bold: true,
        color: P.titleColor, font: { ascii: "Arial" } })],
    }));
  }

  if (config.subtitle) {
    children.push(new Paragraph({
      indent: { left: padL }, spacing: { after: 800 },
      children: [new TextRun({ text: config.subtitle, size: 24, color: P.subtitleColor,
        font: { ascii: "Arial" } })],
    }));
  }

  for (const line of (config.metaLines || [])) {
    children.push(new Paragraph({
      indent: { left: padL + 200 }, spacing: { after: 80 },
      border: { left: accentLeft },
      children: [new TextRun({ text: line, size: 24, color: P.metaColor,
        font: { ascii: "Arial" } })],
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
      new TextRun({ text: config.footerRight || "", size: 16, color: P.footerColor, font: { ascii: "Arial" } }),
    ],
  }));

  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: 16838, rule: "exact" },
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: P.bg }, borders: noBorders,
        children,
      })],
    })],
  })];
}

// ── Build Document ──
async function main() {
  const coverConfig = {
    title: "Deployment Pipeline Architecture",
    subtitle: "M4 Phase 3 — CI/CD & Architecture Milestone",
    englishLabel: "DeepMindQ CRM",
    metaLines: [
      "Milestone: M4 — CI/CD & Architecture",
      "Phase: 3 — Deployment Pipeline Foundation",
      "Date: 2026-08-05",
      "Status: DRAFT",
    ],
    footerLeft: "DeepMindQ Enterprise Intelligence",
    footerRight: "CONFIDENTIAL",
    palette: P.cover,
  };

  // ── TOC Section ──
  const tocSection = {
    properties: {
      type: SectionType.NEXT_PAGE,
      page: {
        size: { width: 11906, height: 16838 },
        margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
      },
    },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 480, after: 360 },
        children: [new TextRun({ text: "Table of Contents", bold: true, size: 32, color: P.primary, font: { ascii: "Calibri", eastAsia: "SimHei" } })],
      }),
      new TableOfContents("Table of Contents", {
        hyperlink: true,
        headingStyleRange: "1-3",
      }),
      new Paragraph({
        spacing: { before: 200 },
        children: [new TextRun({ text: "Note: This Table of Contents is generated via field codes. To ensure page number accuracy after editing, please right-click the TOC and select \"Update Field.\"", italics: true, size: 18, color: "888888", font: { ascii: "Calibri" } })],
      }),
      new Paragraph({ children: [new PageBreak()] }),
    ],
  };

  // ── Body Section ──
  const bodyChildren = [];

  // ======== SECTION 1: Executive Summary ========
  bodyChildren.push(h1("1. Executive Summary"));
  bodyChildren.push(body("This document defines the Deployment Pipeline Architecture for DeepMindQ CRM as part of M4 Phase 3. It builds directly on the foundation established in Phases 1 (Test Architecture Cleanup) and Phase 2 (CI Stabilization), where every CI signal was made trustworthy through the elimination of hidden suppressions, tautological assertions, and test architecture debt."));
  bodyChildren.push(body("The deployment pipeline must uphold the same principle that governed Phase 2: every automated gate must be a meaningful signal. A deployment to production that succeeds because a health check was skipped is as meaningless as a test that passes because it asserts expect(true).toBe(true). This architecture therefore mandates that every deployment step produces verifiable evidence before proceeding to the next stage."));
  bodyChildren.push(body("The scope of Phase 3 covers four interconnected domains. First, the Environment Strategy defines how development, staging, and production environments are separated, how secrets are managed, and how configuration drift is prevented. Second, the CI/CD Pipeline defines automated workflows for staging and production deployments, including approval gates and rollback triggers. Third, Deployment Validation specifies the health checks, smoke tests, and database migration verification that must pass before a deployment is considered complete. Fourth, Release Documentation ensures that every deployment has a complete audit trail from commit SHA to post-deployment verification."));
  bodyChildren.push(body("This architecture is designed as a foundation. No feature work is included in Phase 3. The objective is to establish the pipeline skeleton, validate it end-to-end, and document the procedures so that future feature work can flow through a reliable, repeatable deployment process."));

  // ======== SECTION 2: Phase 2 Closure Status ========
  bodyChildren.push(h1("2. Phase 2 Closure Status"));
  bodyChildren.push(body("Phase 2 (CI Stabilization) concluded with all seven completion criteria satisfied. The closure report is documented in docs/M4_PHASE2_CLOSURE_REPORT.md. The following table summarizes the final state that Phase 3 builds upon:"));

  bodyChildren.push(h2("2.1 Test Suite Health"));
  bodyChildren.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: P.table.accentLine },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: P.table.accentLine },
      left: NB, right: NB,
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: P.table.innerLine },
      insideVertical: NB,
    },
    rows: [
      tableHeaderRow([hCell("Test Suite", 35), hCell("Tests", 15), hCell("Status", 15), hCell("Notes", 35)]),
      tableDataRow([dCell("Research Engine (AI)", 35), dCell("133/133", 15), dCell("ALL PASS", 15), dCell("28 failures classified and fixed in Phase 2", 35)]),
      tableDataRow([dCell("Security", 35), dCell("333/333", 15), dCell("ALL PASS", 15), dCell("Tautological assertion replaced with real validation", 35)]),
      tableDataRow([dCell("AI Inference", 35), dCell("3/3", 15), dCell("ALL PASS", 15), dCell("Placeholder replaced with contract validation", 35)]),
      tableDataRow([dCell("AI Governance", 35), dCell("211/574", 15), dCell("PARTIAL", 15), dCell("6 files skipped (missing module deps)", 35)]),
      tableDataRow([dCell("Unit", 35), dCell("898/943", 15), dCell("1 IMPORT ERROR", 15), dCell("sprint1-modules.test.ts: removed module", 35)]),
      tableDataRow([dCell("API / Integration", 35), dCell("745/759", 15), dCell("14 SKIPPED", 15), dCell("Pre-existing Prisma mock debt", 35)]),
      tableDataRow([dCell("Database", 35), dCell("331/343", 15), dCell("12 SKIPPED", 15), dCell("Real PostgreSQL tests (env-dependent)", 35)]),
      tableDataRow([dCell("Integration", 35), dCell("158/158", 15), dCell("ALL PASS", 15), dCell("Cross-module integration verified", 35)]),
      tableDataRow([dCell("E2E", 35), dCell("67/67", 15), dCell("ALL PASS", 15), dCell("Business journey workflows verified", 35)]),
      tableDataRow([dCell("Performance", 35), dCell("231/231", 15), dCell("ALL PASS", 15), dCell("Benchmarks and scale tests verified", 35)]),
    ],
  }));

  bodyChildren.push(h2("2.2 Suppression Audit Results"));
  bodyChildren.push(body("The final Phase 2 suppression verification confirmed zero instances of anti-patterns across the entire codebase:"));

  bodyChildren.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: P.table.accentLine },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: P.table.accentLine },
      left: NB, right: NB,
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: P.table.innerLine },
      insideVertical: NB,
    },
    rows: [
      tableHeaderRow([hCell("Pattern", 40), hCell("Occurrences", 20), hCell("Status", 40)]),
      tableDataRow([dCell("|| true (shell suppression)", 40), dCell("0", 20), dCell("All removed in Phase 2", 40)]),
      tableDataRow([dCell("dangerouslyIgnoreUnhandledErrors", 40), dCell("0", 20), dCell("All removed in Phase 2", 40)]),
      tableDataRow([dCell("Empty catch blocks {}", 40), dCell("0", 20), dCell("All 10 catch blocks have handlers", 40)]),
      tableDataRow([dCell("expect(true).toBe(true)", 40), dCell("0", 20), dCell("Replaced with contract validation", 40)]),
      tableDataRow([dCell("expect(value).toBe(value)", 40), dCell("0", 20), dCell("Replaced with real security checks", 40)]),
    ],
  }));

  // ======== SECTION 3: Environment Strategy ========
  bodyChildren.push(h1("3. Environment Strategy"));
  bodyChildren.push(body("The deployment pipeline requires three distinct environments, each with its own configuration, data lifecycle, and access controls. The principle of environment separation ensures that code changes progress through increasing levels of verification before reaching production users. No environment may share a database or configuration secrets with another environment."));

  bodyChildren.push(h2("3.1 Environment Definitions"));

  bodyChildren.push(h3("3.1.1 Development"));
  bodyChildren.push(body("The development environment is the local developer workstation. It uses .env.local for configuration, which is never committed to version control. Developers may use prisma db push for rapid schema iteration, which is appropriate for local development but must never be used in staging or production environments. The development environment is ephemeral by nature: each developer has their own database instance, their own set of environment variables, and their own running application instance."));
  bodyChildren.push(body("Key constraints for the development environment include: DATABASE_URL should point to a local PostgreSQL instance or a developer-specific cloud database; all AI provider API keys may be set to test credentials or left unset (the application degrades gracefully to template fallback when AI keys are missing); SESSION_TOKEN_HMAC_SECRET may use a well-known dev value but must not match staging or production values; and npm run dev starts the Next.js dev server with hot reload."));

  bodyChildren.push(h3("3.1.2 Staging"));
  bodyChildren.push(body("The staging environment mirrors production as closely as possible. It is deployed automatically from the develop branch via the staging deployment workflow (Section 4.1). Staging uses a real PostgreSQL database with production-equivalent configuration, seeded with anonymized reference data rather than production data. All environment variables are stored in GitHub Secrets scoped to the staging GitHub Environment."));
  bodyChildren.push(body("Staging serves as the primary integration testing environment. After code is merged into develop, the staging deployment workflow runs the full CI suite, builds the production bundle, deploys it, runs database migrations, executes smoke tests, and reports the results. Failures at any stage halt the pipeline and generate a notification. The staging environment must be accessible to the development team for manual verification before code is promoted to production."));

  bodyChildren.push(h3("3.1.3 Production"));
  bodyChildren.push(body("The production environment is the live customer-facing application. It is deployed from the main branch only, after a mandatory approval gate (Section 4.2). Production has the strictest controls: database migrations must pass safety validation before execution, all secrets are stored in GitHub Secrets scoped to the production GitHub Environment with rotation policies, and post-deployment verification must confirm application health within a defined SLA."));
  bodyChildren.push(body("Production deployments are designed to be reversible. Every deployment records the commit SHA, the previous deployment SHA (enabling rollback), and the CI run that validated the deployment artifact. If post-deployment smoke tests fail, the pipeline automatically triggers a rollback to the previous known-good state."));

  bodyChildren.push(h2("3.2 Environment Variable Separation"));

  bodyChildren.push(body("Environment variables are the primary mechanism for configuration across all environments. The following classification defines how each variable is managed:"));

  bodyChildren.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: P.table.accentLine },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: P.table.accentLine },
      left: NB, right: NB,
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: P.table.innerLine },
      insideVertical: NB,
    },
    rows: [
      tableHeaderRow([hCell("Category", 20), hCell("Variables", 30), hCell("Storage", 25), hCell("Rotation", 25)]),
      tableDataRow([dCell("Database", 20), dCell("DATABASE_URL, DIRECT_DATABASE_URL", 30), dCell("GitHub Secrets (per env)", 25), dCell("On credential change", 25)]),
      tableDataRow([dCell("Auth", 20), dCell("SESSION_TOKEN_HMAC_SECRET, NEXTAUTH_SECRET", 30), dCell("GitHub Secrets (per env)", 25), dCell("90-day rotation", 25)]),
      tableDataRow([dCell("AI Providers", 20), dCell("NVIDIA_API_KEY, FIREWORKS_API_KEY, GROQ_API_KEY, GEMINI_API_KEY, TAVILY_API_KEY", 30), dCell("GitHub Secrets (per env)", 25), dCell("On key rotation", 25)]),
      tableDataRow([dCell("Email", 20), dCell("EMAIL_API_KEY, EMAIL_FROM", 30), dCell("GitHub Secrets (per env)", 25), dCell("On provider change", 25)]),
      tableDataRow([dCell("Encryption", 20), dCell("API_KEY_ENCRYPTION_KEY, TRACKING_SECRET", 30), dCell("GitHub Secrets (per env)", 25), dCell("180-day rotation", 25)]),
      tableDataRow([dCell("Cron/Webhooks", 20), dCell("CRON_SECRET, RESEND_WEBHOOK_SECRET", 30), dCell("GitHub Secrets (per env)", 25), dCell("180-day rotation", 25)]),
      tableDataRow([dCell("Public", 20), dCell("NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_SENTRY_DSN", 30), dCell("GitHub Env Vars (per env)", 25), dCell("N/A", 25)]),
    ],
  }));

  bodyChildren.push(h2("3.3 Secret Management"));
  bodyChildren.push(body("Secrets are managed through GitHub Environments, which provide scoped, encrypted storage with access controls. Each environment (staging, production) has its own set of secrets. The CI/CD pipeline accesses secrets through the standard GitHub Actions secrets context (secrets.ACTION_NAME), which ensures that secrets are never exposed in logs or passed as plain text arguments."));
  bodyChildren.push(body("The secret management policy requires the following: no secrets may be committed to the repository in any form (including .env files, configuration files, or test fixtures); secrets must have unique values across environments (sharing a SESSION_TOKEN_HMAC_SECRET between staging and production is a critical security failure); secret rotation must be documented in the deployment verification checklist; and any secret rotation must trigger a redeployment to ensure the application picks up the new value."));
  bodyChildren.push(body("For local development, secrets are stored in .env.local which is listed in .gitignore. The .env.example file documents all required and optional variables with placeholder values and generation instructions. Developers must never share .env.local files or copy secrets from other environments."));

  // ======== SECTION 4: CI/CD Pipeline ========
  bodyChildren.push(h1("4. CI/CD Pipeline"));
  bodyChildren.push(body("The CI/CD pipeline extends the existing CI workflow (ci.yml) with two deployment workflows: one for staging and one for production. The CI workflow remains the gatekeeper: no deployment proceeds without a passing CI run. The deployment workflows consume CI artifacts rather than re-running CI, ensuring that what gets deployed is exactly what was tested."));

  bodyChildren.push(h2("4.1 Staging Deployment Workflow"));
  bodyChildren.push(body("The staging deployment workflow is triggered by pushes to the develop branch. It is fully automated with no manual approval gate, since staging is an internal testing environment. The workflow file is .github/workflows/deploy-staging.yml."));

  bodyChildren.push(h3("4.1.1 Trigger Configuration"));
  bodyChildren.push(...codeBlock([
    "name: Deploy Staging",
    "on:",
    "  push:",
    "    branches: [develop]",
    "  workflow_dispatch:",
  ]));
  bodyChildren.push(spacer(100));

  bodyChildren.push(h3("4.1.2 Pipeline Stages"));
  bodyChildren.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: P.table.accentLine },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: P.table.accentLine },
      left: NB, right: NB,
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: P.table.innerLine },
      insideVertical: NB,
    },
    rows: [
      tableHeaderRow([hCell("Stage", 5), hCell("Step", 25), hCell("Action", 40), hCell("Failure Policy", 30)]),
      tableDataRow([dCell("1", 5), dCell("CI Gate", 25), dCell("Require passing CI run on the triggering commit", 40), dCell("Halt pipeline, notify team", 30)]),
      tableDataRow([dCell("2", 5), dCell("Build", 25), dCell("npm run build:vercel — generate production bundle with Prisma client", 40), dCell("Halt pipeline, report build error", 30)]),
      tableDataRow([dCell("3", 5), dCell("Deploy", 25), dCell("Deploy to staging platform (Vercel/Render) using platform CLI", 40), dCell("Halt pipeline, capture logs", 30)]),
      tableDataRow([dCell("4", 5), dCell("Migrate", 25), dCell("prisma migrate deploy — apply pending migrations to staging DB", 40), dCell("Halt pipeline, preserve DB state", 30)]),
      tableDataRow([dCell("5", 5), dCell("Smoke Tests", 25), dCell("Execute smoke test suite against staging URL", 40), dCell("Trigger rollback, notify team", 30)]),
      tableDataRow([dCell("6", 5), dCell("Notify", 25), dCell("Send deployment result to team (Slack/GitHub comment)", 40), dCell("Always runs (if: always())", 30)]),
    ],
  }));

  bodyChildren.push(h2("4.2 Production Deployment Workflow"));
  bodyChildren.push(body("The production deployment workflow is triggered by pushes to the main branch. Unlike staging, it includes a mandatory approval gate using GitHub Environments with required reviewers. No code reaches production without explicit human approval. The workflow file is .github/workflows/deploy-production.yml."));

  bodyChildren.push(h3("4.2.1 Trigger Configuration"));
  bodyChildren.push(...codeBlock([
    "name: Deploy Production",
    "on:",
    "  push:",
    "    branches: [main]",
    "  workflow_dispatch:",
    "environment: production  // Triggers approval gate",
  ]));
  bodyChildren.push(spacer(100));

  bodyChildren.push(h3("4.2.2 Pipeline Stages"));
  bodyChildren.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: P.table.accentLine },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: P.table.accentLine },
      left: NB, right: NB,
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: P.table.innerLine },
      insideVertical: NB,
    },
    rows: [
      tableHeaderRow([hCell("Stage", 5), hCell("Step", 25), hCell("Action", 40), hCell("Failure Policy", 30)]),
      tableDataRow([dCell("1", 5), dCell("CI Gate", 25), dCell("Require ALL CI jobs passing (blocking + non-blocking)", 40), dCell("Halt, prevent deployment", 30)]),
      tableDataRow([dCell("2", 5), dCell("Approval Gate", 25), dCell("GitHub Environment: production — requires reviewer approval", 40), dCell("Pauses until approved", 30)]),
      tableDataRow([dCell("3", 5), dCell("Pre-Deploy Validation", 25), dCell("Verify migration safety, no pending drift, check DB backup", 40), dCell("Halt if unsafe migration detected", 30)]),
      tableDataRow([dCell("4", 5), dCell("Build", 25), dCell("npm run build:vercel — production bundle", 40), dCell("Halt, report error", 30)]),
      tableDataRow([dCell("5", 5), dCell("Record Pre-State", 25), dCell("Capture current deployment SHA, timestamp, DB migration state", 40), dCell("Must succeed (audit requirement)", 30)]),
      tableDataRow([dCell("6", 5), dCell("Deploy", 25), dCell("Deploy to production platform", 40), dCell("Halt, capture logs", 30)]),
      tableDataRow([dCell("7", 5), dCell("Migrate", 25), dCell("prisma migrate deploy — apply migrations to production DB", 40), dCell("Trigger rollback if failure", 30)]),
      tableDataRow([dCell("8", 5), dCell("Smoke Tests", 25), dCell("Execute production smoke test suite", 40), dCell("Automatic rollback", 30)]),
      tableDataRow([dCell("9", 5), dCell("Health Check", 25), dCell("Verify /api/health returns 200 with db: true", 40), dCell("Automatic rollback", 30)]),
      tableDataRow([dCell("10", 5), dCell("Record Post-State", 25), dCell("Capture new deployment SHA, CI run URL, verification results", 40), dCell("Audit trail requirement", 30)]),
    ],
  }));

  bodyChildren.push(h2("4.3 Approval Gates"));
  bodyChildren.push(body("Production deployments require explicit approval through GitHub Environments. The production environment is configured with one or more required reviewers who must approve the deployment before the pipeline proceeds past Stage 2. This ensures that every production change has human accountability."));
  bodyChildren.push(body("The approval gate is configured in GitHub repository settings under Settings > Environments > production. Required reviewers should include the engineering lead and at least one team member who did not author the changes being deployed. This prevents self-approval and ensures a second pair of eyes reviews every production deployment."));
  bodyChildren.push(body("Reviewers should verify: the CI run associated with the deployment is green and complete; the commit message references the relevant milestone or issue; no known regressions or warnings are present in the CI output; the database migration is non-destructive (if applicable); and a rollback plan exists and has been tested."));

  bodyChildren.push(h2("4.4 Rollback Strategy"));
  bodyChildren.push(body("Rollback is the primary failure recovery mechanism. The deployment pipeline supports three rollback triggers: automatic rollback when smoke tests fail (Stage 8); automatic rollback when the health check fails (Stage 9); and manual rollback initiated by a team member at any time via workflow_dispatch."));
  bodyChildren.push(body("The rollback procedure redeploys the previous known-good commit SHA that was captured in Stage 5 (Record Pre-State). Because the previous state is recorded before every deployment, rollback always targets a verified, working commit rather than an assumed state. After rollback, the pipeline executes the same smoke tests and health checks to confirm the application has returned to a healthy state."));
  bodyChildren.push(body("Database rollback follows a separate procedure. Prisma migrations are designed to be forward-only in production; rollback of a destructive migration requires a manual migration that reverses the schema change. The pre-deployment validation stage (Stage 3) checks for destructive migration operations and flags them before deployment proceeds, preventing the need for database rollback in most cases."));

  // ======== SECTION 5: Deployment Validation ========
  bodyChildren.push(h1("5. Deployment Validation"));
  bodyChildren.push(body("Deployment validation ensures that every deployment produces a functioning application. Validation is performed at multiple stages: during the pipeline (smoke tests, health checks), during migration (safety checks, drift detection), and after deployment (post-deployment verification). Each validation stage must produce a pass/fail result that is recorded in the deployment audit trail."));

  bodyChildren.push(h2("5.1 Health Checks"));
  bodyChildren.push(body("The existing /api/health endpoint (src/app/api/health/route.ts) provides the foundation for deployment health checks. It already reports application uptime, timestamp, database connectivity status, and AI provider availability. For deployment validation, the health check is enhanced with environment identification and commit SHA reporting."));
  bodyChildren.push(body("The health check contract for deployment validation requires: HTTP 200 status code within 30 seconds of the health check request; the db field must be true (database connectivity confirmed); the status field must be ok (not degraded); and optional: the response time must be under 3 seconds (performance SLA)."));
  bodyChildren.push(body("Health checks are executed at two points in the pipeline: immediately after deployment (Stage 9 in production) and as part of the post-deployment verification (Section 5.4). If the health check fails after deployment, it triggers an automatic rollback. If it fails during post-deployment verification, it generates a high-priority alert."));

  bodyChildren.push(h2("5.2 Smoke Tests"));
  bodyChildren.push(body("Smoke tests are a subset of critical path tests that verify the application is functional after deployment. They are distinct from the full test suite in that they target the deployed application's HTTP endpoints rather than individual code units. The smoke test suite is defined in tests/smoke/ and executed against the deployed environment's URL."));

  bodyChildren.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: P.table.accentLine },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: P.table.accentLine },
      left: NB, right: NB,
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: P.table.innerLine },
      insideVertical: NB,
    },
    rows: [
      tableHeaderRow([hCell("Test", 30), hCell("Endpoint", 25), hCell("Expected Result", 25), hCell("SLA", 20)]),
      tableDataRow([dCell("Liveness", 30), dCell("GET /api/health", 25), dCell("200, status: ok", 25), dCell("< 3s", 20)]),
      tableDataRow([dCell("Auth Endpoint", 30), dCell("POST /api/auth/otp-request", 25), dCell("200 or 400 (not 500)", 25), dCell("< 5s", 20)]),
      tableDataRow([dCell("API Auth Guard", 30), dCell("GET /api/companies (no token)", 25), dCell("401 Unauthorized", 25), dCell("< 2s", 20)]),
      tableDataRow([dCell("Static Assets", 30), dCell("GET / (HTML response)", 25), dCell("200, contains HTML", 25), dCell("< 5s", 20)]),
      tableDataRow([dCell("DB Connectivity", 30), dCell("GET /api/health (db field)", 25), dCell("db: true", 25), dCell("< 3s", 20)]),
    ],
  }));

  bodyChildren.push(body("Smoke tests are executed using a dedicated vitest configuration (vitest.smoke.config.ts) that targets the deployed environment URL rather than local code. The configuration accepts the base URL as an environment variable (SMOKE_TEST_URL) so the same test suite can run against staging or production."));

  bodyChildren.push(h2("5.3 Database Migration Validation"));
  bodyChildren.push(body("Database migrations are a critical deployment step with no tolerance for errors. The pre-deployment validation stage performs the following checks on every pending migration before it is applied:"));
  bullet("Schema safety: Verify the migration does not contain DROP TABLE, DROP COLUMN, or ALTER COLUMN TYPE operations that would destroy data");
  bullet("Drift detection: Verify the target database schema matches the expected baseline (no manual schema changes since last migration)");
  bullet("Backup verification: Confirm a database backup exists and is recent (within the last 24 hours for production)");
  bullet("Migration order: Verify no pending migrations have been skipped (all previous migrations must be applied before the current set)");
  bodyChildren.push(body("If any of these checks fail, the deployment halts before the migration stage and the team is notified. The migration is not applied until the issue is resolved and the pipeline is re-triggered."));

  bodyChildren.push(h2("5.4 Post-Deployment Verification"));
  bodyChildren.push(body("Post-deployment verification confirms that the application is fully operational after deployment. It runs after the smoke tests and health checks, providing a comprehensive assessment of deployment success. The verification includes the following checks:"));
  bullet("Health check confirmation: /api/health returns ok with all critical services healthy");
  bullet("Smoke test summary: All smoke tests passed with no warnings");
  bullet("Error rate monitoring: Application error rate within 5 minutes of deployment is below the baseline threshold (determined from historical data)");
  bullet("Database connectivity: Verify that read and write operations succeed against the production database");
  bullet("AI engine initialization: Verify that the AI engine initializes without errors (or degrades gracefully if API keys are intentionally unset)");
  bodyChildren.push(body("Post-deployment verification results are recorded in the deployment audit trail and compared against the pre-deployment state to detect any regressions introduced by the deployment."));

  // ======== SECTION 6: Branch Strategy ========
  bodyChildren.push(h1("6. Branch Strategy and Deployment Flow"));
  bodyChildren.push(body("The branch strategy defines how code flows from development to production. It is designed to be simple and predictable: feature branches merge into develop via pull requests, develop is deployed to staging automatically, and main is deployed to production after approval."));

  bodyChildren.push(h2("6.1 Branch Model"));

  bodyChildren.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: P.table.accentLine },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: P.table.accentLine },
      left: NB, right: NB,
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: P.table.innerLine },
      insideVertical: NB,
    },
    rows: [
      tableHeaderRow([hCell("Branch", 20), hCell("Purpose", 30), hCell("Protection", 20), hCell("Deploy Target", 30)]),
      tableDataRow([dCell("main", 20), dCell("Production-ready code", 30), dCell("Required PR + approval", 20), dCell("Production (after approval)", 30)]),
      tableDataRow([dCell("develop", 20), dCell("Integration branch", 30), dCell("Required PR + CI pass", 20), dCell("Staging (automatic)", 30)]),
      tableDataRow([dCell("feature/*", 20), dCell("Feature development", 30), dCell("CI must pass for merge", 20), dCell("None (local only)", 30)]),
      tableDataRow([dCell("hotfix/*", 20), dCell("Emergency production fix", 30), dCell("Required PR + fast-track", 20), dCell("Production (expedited)", 30)]),
    ],
  }));

  bodyChildren.push(h2("6.2 Deployment Flow"));
  bodyChildren.push(body("The deployment flow follows a strict left-to-right progression. Code never flows directly from feature branches to production. The flow is: feature branch → develop (via PR, CI gate) → staging (automatic deployment) → manual verification → main (via PR, CI gate, approval) → production (deployment with rollback capability)."));
  bodyChildren.push(body("Hotfix branches are the exception. A hotfix branches from main, is tested on its own CI run, and can be deployed directly to production via an expedited approval process. After deployment, the hotfix is merged back into both main and develop to prevent the fix from being lost in future deployments."));

  // ======== SECTION 7: Workflow Diagrams ========
  bodyChildren.push(h1("7. Workflow Diagrams"));
  bodyChildren.push(body("The following diagrams illustrate the deployment pipeline flows for staging and production deployments. Each diagram shows the stages, decision points, and failure paths."));

  bodyChildren.push(h2("7.1 Staging Deployment Flow"));
  bodyChildren.push(...codeBlock([
    "push to develop",
    "    |",
    "    v",
    "[CI Gate] --FAIL--> Notify team (stop)",
    "    | PASS",
    "    v",
    "[Build Bundle]",
    "    |",
    "    v",
    "[Deploy to Staging]",
    "    |",
    "    v",
    "[Run DB Migrations]",
    "    |",
    "    v",
    "[Smoke Tests] --FAIL--> Notify team (manual investigation)",
    "    | PASS",
    "    v",
    "[Notify: Staging Ready for QA]",
  ]));
  bodyChildren.push(spacer(100));

  bodyChildren.push(h2("7.2 Production Deployment Flow"));
  bodyChildren.push(...codeBlock([
    "push to main",
    "    |",
    "    v",
    "[Full CI Suite] --FAIL--> Block deployment",
    "    | ALL PASS",
    "    v",
    "[Approval Gate] --REJECTED--> Block deployment",
    "    | APPROVED",
    "    v",
    "[Pre-Deploy Validation]",
    "    | (migration safety, drift check, backup)",
    "    v",
    "[Build Bundle]",
    "    |",
    "    v",
    "[Record Pre-State SHA]",
    "    |",
    "    v",
    "[Deploy to Production]",
    "    |",
    "    v",
    "[Run DB Migrations] --FAIL--> Auto-rollback to pre-state SHA",
    "    |",
    "    v",
    "[Smoke Tests] --FAIL--> Auto-rollback + Alert",
    "    | PASS",
    "    v",
    "[Health Check] --FAIL--> Auto-rollback + Alert",
    "    | PASS",
    "    v",
    "[Record Post-State] --> Deployment Complete",
  ]));
  bodyChildren.push(spacer(100));

  // ======== SECTION 8: Environment Lifecycle ========
  bodyChildren.push(h1("8. Environment Lifecycle"));
  bodyChildren.push(body("Each environment has a defined lifecycle from provisioning through decommissioning. Understanding the lifecycle ensures that environments are created consistently, maintained predictably, and decommissioned safely."));

  bodyChildren.push(h2("8.1 Provisioning"));
  bodyChildren.push(body("Staging and production environments are provisioned through the deployment platform (Vercel or equivalent). Each environment is configured with its own set of environment variables, domain, and database. The provisioning process follows these steps: create the environment in the platform dashboard, configure the GitHub Environment with matching secrets, provision a PostgreSQL database, run the initial schema migration (prisma migrate deploy), and execute the smoke test suite to verify the environment is operational."));

  bodyChildren.push(h2("8.2 Maintenance"));
  bodyChildren.push(body("Environment maintenance includes: secret rotation according to the schedule defined in Section 3.2; database backups (automated for production, manual for staging); dependency updates (managed through Dependabot with CI validation); and monitoring configuration (error tracking via Sentry, uptime monitoring). Each maintenance activity is recorded in the deployment audit trail."));

  bodyChildren.push(h2("8.3 Decommissioning"));
  bodyChildren.push(body("Environments may be decommissioned when they are no longer needed (e.g., a feature branch environment after merge, or a staging reset). The decommissioning process includes: revoke all secrets stored in the GitHub Environment, remove the database instance (after confirming no data needs preservation), remove the domain configuration, and update any monitoring or alerting rules that reference the decommissioned environment."));

  // ======== SECTION 9: Release Documentation ========
  bodyChildren.push(h1("9. Release Documentation"));
  bodyChildren.push(body("Every deployment must produce a complete release record that links the commit SHA to the deployment outcome. This record serves as the audit trail for the deployment pipeline and is required for post-incident investigation, compliance verification, and deployment history analysis."));

  bodyChildren.push(h2("9.1 Release Record Fields"));
  bodyChildren.push(body("Each deployment generates a release record containing the following fields:"));

  bodyChildren.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: P.table.accentLine },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: P.table.accentLine },
      left: NB, right: NB,
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: P.table.innerLine },
      insideVertical: NB,
    },
    rows: [
      tableHeaderRow([hCell("Field", 30), hCell("Source", 35), hCell("Purpose", 35)]),
      tableDataRow([dCell("Deployment ID", 30), dCell("GitHub run ID", 35), dCell("Unique identifier for the deployment", 35)]),
      tableDataRow([dCell("Commit SHA", 30), dCell("github.sha", 35), dCell("Exact code version deployed", 35)]),
      tableDataRow([dCell("Previous SHA", 30), dCell("Captured in Stage 5", 35), dCell("Version used for rollback", 35)]),
      tableDataRow([dCell("Branch", 30), dCell("github.ref_name", 35), dCell("Source branch (main/develop)", 35)]),
      tableDataRow([dCell("CI Run URL", 30), dCell("Link to CI workflow run", 35), dCell("Evidence of CI validation", 35)]),
      tableDataRow([dCell("Environment", 30), dCell("staging or production", 35), dCell("Deployment target", 35)]),
      tableDataRow([dCell("Deployer", 30), dCell("Approval actor (production)", 35), dCell("Human accountability", 35)]),
      tableDataRow([dCell("Timestamp", 30), dCell("Deployment start/end", 35), dCell("Timeline for incident correlation", 35)]),
      tableDataRow([dCell("Migration SHA", 30), dCell("Prisma migration hash", 35), dCell("Database state identifier", 35)]),
      tableDataRow([dCell("Smoke Test Results", 30), dCell("Pass/fail per test", 35), dCell("Deployment validation evidence", 35)]),
      tableDataRow([dCell("Rollback Status", 30), dCell("none/triggered/completed", 35), dCell("Recovery state tracking", 35)]),
    ],
  }));

  bodyChildren.push(h2("9.2 Release Communication"));
  bodyChildren.push(body("After each production deployment, a release note is posted to the team communication channel. The release note includes the commit SHA, a summary of changes (derived from commit messages since the last production deployment), the CI run URL, and the deployment result. For staging deployments, a notification is posted when staging is ready for manual verification."));

  // ======== SECTION 10: Implementation Roadmap ========
  bodyChildren.push(h1("10. Implementation Roadmap"));
  bodyChildren.push(body("Phase 3 implementation follows a sequential order where each step builds on the previous one. The roadmap is designed to deliver incremental value: even if Phase 3 is interrupted, each completed step provides standalone benefit."));

  bodyChildren.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: P.table.accentLine },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: P.table.accentLine },
      left: NB, right: NB,
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: P.table.innerLine },
      insideVertical: NB,
    },
    rows: [
      tableHeaderRow([hCell("Step", 5), hCell("Task", 30), hCell("Deliverable", 35), hCell("Dependencies", 30)]),
      tableDataRow([dCell("1", 5), dCell("Smoke test suite", 30), dCell("tests/smoke/ with vitest.smoke.config.ts", 35), dCell("CI pipeline (Phase 2)", 30)]),
      tableDataRow([dCell("2", 5), dCell("Health check enhancement", 30), dCell("Extended /api/health with env + SHA", 35), dCell("Existing health endpoint", 30)]),
      tableDataRow([dCell("3", 5), dCell("GitHub Environment setup", 30), dCell("staging + production envs with secrets", 35), dCell("Repository admin access", 30)]),
      tableDataRow([dCell("4", 5), dCell("Staging workflow", 30), dCell("deploy-staging.yml", 35), dCell("Steps 1-3 complete", 30)]),
      tableDataRow([dCell("5", 5), dCell("Production workflow", 30), dCell("deploy-production.yml with approval", 35), dCell("Steps 1-4 + reviewers", 30)]),
      tableDataRow([dCell("6", 5), dCell("Migration safety checks", 30), dCell("Pre-deploy validation script", 35), dCell("Prisma migrations", 30)]),
      tableDataRow([dCell("7", 5), dCell("This document", 30), dCell("docs/DEPLOYMENT_PIPELINE_ARCHITECTURE.md", 35), dCell("Steps 1-6 design", 30)]),
    ],
  }));

  // ======== SECTION 11: Completion Criteria ========
  bodyChildren.push(h1("11. Phase 3 Completion Criteria"));
  bodyChildren.push(body("Phase 3 is complete when all of the following criteria are satisfied:"));

  bullet("Staging deployment workflow created and tested end-to-end");
  bullet("Production deployment workflow with approval gate created and tested end-to-end");
  bullet("Smoke test suite passes against staging and production environments");
  bullet("Health check endpoint deployed and verified in all environments");
  bullet("Database migration safety validation is integrated into the production pipeline");
  bullet("Rollback procedure has been tested (deploy, trigger rollback, verify recovery)");
  bullet("Environment strategy documented with secret management and rotation policies");
  bullet("Branch strategy documented and enforced through branch protection rules");
  bullet("Release documentation template created and used for at least one deployment");
  bullet("This architecture document reviewed and approved by the engineering team");
  bodyChildren.push(body("Each criterion must be verified with evidence: a passing CI run, a successful deployment log, a smoke test report, or a documented procedure. Phase 3 does not proceed to feature work until all criteria are met."));

  const bodySection = {
    properties: {
      type: SectionType.NEXT_PAGE,
      page: {
        size: { width: 11906, height: 16838 },
        margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
        pageNumbers: { start: 1 },
      },
    },
    children: bodyChildren,
  };

  // ── Assemble Document ──
  const doc = new Document({
    creator: "DeepMindQ Engineering",
    title: "Deployment Pipeline Architecture — M4 Phase 3",
    description: "CI/CD deployment pipeline architecture for DeepMindQ CRM",
    styles: {
      default: {
        document: {
          run: {
            font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" },
            size: 22, color: P.body,
          },
          paragraph: { spacing: { line: 312 } },
        },
        heading1: {
          run: { font: { ascii: "Calibri", eastAsia: "SimHei" }, size: 32, bold: true, color: P.primary },
        },
        heading2: {
          run: { font: { ascii: "Calibri", eastAsia: "SimHei" }, size: 28, bold: true, color: P.primary },
        },
        heading3: {
          run: { font: { ascii: "Calibri", eastAsia: "SimHei" }, size: 24, bold: true, color: P.secondary },
        },
      },
    },
    sections: [
      // Cover section
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 0, bottom: 0, left: 0, right: 0 },
          },
        },
        children: buildCoverR1(coverConfig),
      },
      // TOC section
      tocSection,
      // Body section
      bodySection,
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const fs = require("fs");
  fs.writeFileSync("/home/z/my-project/download/DEPLOYMENT_PIPELINE_ARCHITECTURE.docx", buffer);
  console.log("Document generated: /home/z/my-project/download/DEPLOYMENT_PIPELINE_ARCHITECTURE.docx");
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
