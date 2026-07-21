const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  PageBreak, Header, Footer, PageNumber, NumberFormat,
  AlignmentType, HeadingLevel, WidthType, BorderStyle, ShadingType,
  SectionType, TableOfContents, TableLayoutType,
} = require("docx");
const fs = require("fs");

// ─── Palette: DM-1 Deep Cyan (tech/AI) for R1 cover, body uses table overrides ───
const coverPalette = {
  bg: "162235", titleColor: "FFFFFF", subtitleColor: "B0B8C0",
  metaColor: "90989F", footerColor: "687078", accent: "37DCF2",
};
const bodyPalette = {
  primary: "0A1628", body: "1A2B40", secondary: "6878A0",
  accent: "1B6B7A", surface: "EDF3F5", tableHeaderBg: "1B6B7A",
  tableHeaderText: "FFFFFF", innerLine: "C8DDE2", accentLine: "1B6B7A",
};
const c = (hex) => hex.replace("#", "");

// ─── Border helpers ───
const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };
const bodyBorders = {
  top: { style: BorderStyle.SINGLE, size: 1, color: c(bodyPalette.innerLine) },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: c(bodyPalette.innerLine) },
  left: { style: BorderStyle.NONE },
  right: { style: BorderStyle.NONE },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: c(bodyPalette.innerLine) },
  insideVertical: { style: BorderStyle.NONE },
};

// ─── Title layout helpers (from design-system.md) ───
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
  const breakAfter = new Set([
    ...",.:;!?-", ..."/", ..." ",
  ]);
  const lines = [];
  let remaining = title;
  while (remaining.length > charsPerLine) {
    let breakAt = -1;
    for (let i = charsPerLine; i >= Math.floor(charsPerLine * 0.6); i--) {
      if (i < remaining.length && breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
    }
    if (breakAt === -1) {
      const limit = Math.min(remaining.length, Math.ceil(charsPerLine * 1.3));
      for (let i = charsPerLine + 1; i < limit; i++) {
        if (breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
      }
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
    hasEnglishLabel = false, metaLineCount = 0,
    fixedHeight = 800, pageHeight = 16838, marginTop = 0, marginBottom = 0,
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

// ─── Cover builder (R1) ───
function buildCoverR1(config) {
  const P = config.palette;
  const padL = 1200, padR = 800;
  const availableWidth = 11906 - padL - padR - 300;
  const { titlePt, titleLines } = calcTitleLayout(config.title, availableWidth, 38, 24);
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
      children: [new TextRun({ text: config.englishLabel, size: 18, color: P.accent,
        font: { ascii: "Calibri", eastAsia: "SimHei" }, characterSpacing: 40 })],
    }));
  }
  for (let i = 0; i < titleLines.length; i++) {
    children.push(new Paragraph({
      indent: { left: padL },
      spacing: { after: i < titleLines.length - 1 ? 100 : 300, line: Math.ceil(titlePt * 23), lineRule: "atLeast" },
      children: [new TextRun({ text: titleLines[i], size: titleSize, bold: true,
        color: P.titleColor, font: { eastAsia: "SimHei", ascii: "Arial" } })],
    }));
  }
  if (config.subtitle) {
    children.push(new Paragraph({
      indent: { left: padL }, spacing: { after: 800 },
      children: [new TextRun({ text: config.subtitle, size: 24, color: P.subtitleColor,
        font: { eastAsia: "Microsoft YaHei", ascii: "Arial" } })],
    }));
  }
  for (const line of (config.metaLines || [])) {
    children.push(new Paragraph({
      indent: { left: padL + 200 }, spacing: { after: 80 },
      border: { left: accentLeft },
      children: [new TextRun({ text: line, size: 24, color: P.metaColor,
        font: { eastAsia: "Microsoft YaHei", ascii: "Arial" } })],
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

// ─── Body component builders ───
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 200 },
    children: [new TextRun({ text, bold: true, size: 32, color: c(bodyPalette.primary),
      font: { ascii: "Times New Roman", eastAsia: "SimHei" } })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 160 },
    children: [new TextRun({ text, bold: true, size: 28, color: c(bodyPalette.primary),
      font: { ascii: "Times New Roman", eastAsia: "SimHei" } })],
  });
}
function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 120 },
    children: [new TextRun({ text, bold: true, size: 24, color: c(bodyPalette.primary),
      font: { ascii: "Times New Roman", eastAsia: "SimHei" } })],
  });
}
function body(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: 312, after: 80 },
    children: [new TextRun({ text, size: 22, color: c(bodyPalette.body),
      font: { ascii: "Times New Roman", eastAsia: "Microsoft YaHei" } })],
  });
}
function bodyBold(label, text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: 312, after: 80 },
    children: [
      new TextRun({ text: label, bold: true, size: 22, color: c(bodyPalette.body),
        font: { ascii: "Times New Roman", eastAsia: "Microsoft YaHei" } }),
      new TextRun({ text, size: 22, color: c(bodyPalette.body),
        font: { ascii: "Times New Roman", eastAsia: "Microsoft YaHei" } }),
    ],
  });
}
function codeBlock(text) {
  return new Paragraph({
    spacing: { before: 80, after: 80, line: 276 },
    indent: { left: 400 },
    children: [new TextRun({ text, size: 20, color: "4A5568",
      font: { ascii: "Courier New", eastAsia: "Microsoft YaHei" } })],
  });
}
function spacer(h = 100) {
  return new Paragraph({ spacing: { before: h, after: 0 }, children: [] });
}

// ─── Table builder ───
function makeTable(headers, rows, colWidths) {
  const totalWidth = colWidths.reduce((a, b) => a + b, 0);
  const pctWidths = colWidths.map((w) => Math.round((w / totalWidth) * 100));
  const headerRow = new TableRow({
    tableHeader: true, cantSplit: true,
    children: headers.map((h, i) => new TableCell({
      width: { size: pctWidths[i], type: WidthType.PERCENTAGE },
      shading: { type: ShadingType.CLEAR, fill: c(bodyPalette.tableHeaderBg) },
      borders: bodyBorders,
      children: [new Paragraph({
        spacing: { before: 60, after: 60 },
        children: [new TextRun({ text: h, bold: true, size: 20, color: c(bodyPalette.tableHeaderText),
          font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })],
      })],
    })),
  });
  const dataRows = rows.map((row, rowIdx) => new TableRow({
    cantSplit: true,
    children: row.map((cell, i) => new TableCell({
      width: { size: pctWidths[i], type: WidthType.PERCENTAGE },
      shading: rowIdx % 2 === 1 ? { type: ShadingType.CLEAR, fill: c(bodyPalette.surface) } : undefined,
      borders: bodyBorders,
      children: [new Paragraph({
        spacing: { before: 40, after: 40 },
        children: [new TextRun({ text: cell, size: 20, color: c(bodyPalette.body),
          font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })],
      })],
    })),
  }));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: bodyBorders,
    rows: [headerRow, ...dataRows],
  });
}

function makeJsonBlock(lines) {
  return lines.map((line) => new Paragraph({
    spacing: { before: 0, after: 0, line: 260 },
    indent: { left: 600 },
    children: [new TextRun({ text: line, size: 18, color: "4A5568",
      font: { ascii: "Courier New" } })],
  }));
}

// ─── Page number footer ───
function pageNumFooter(formatType) {
  const instrText = formatType === NumberFormat.UPPER_ROMAN
    ? "PAGE \\* ROMAN \\* MERGEFORMAT"
    : "PAGE \\* arabic \\* MERGEFORMAT";
  return new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: c(bodyPalette.secondary),
        font: { ascii: "Times New Roman" } })],
      // Note: post-processing script patches instrText
    })],
  });
}

// ═══════════════════════════════════════════════════════════
// DOCUMENT ASSEMBLY
// ═══════════════════════════════════════════════════════════

const coverChildren = buildCoverR1({
  title: "Phase 6 Design Document: Intelligence Validation & Trust Layer",
  subtitle: "DeepMindQ CRM Architecture Specification",
  englishLabel: "DE E P M I N D Q",
  metaLines: [
    "Project: DeepMindQ CRM  |  Stack: Next.js 16 + Prisma 6 + PostgreSQL",
    "Phase 6  |  Status: Design Review  |  Date: July 21, 2026",
  ],
  footerLeft: "DeepMindQ",
  footerRight: "Confidential",
  palette: coverPalette,
});

// ─── Body Content ───
const bodyContent = [
  // ── 1. Executive Summary ──
  h1("1. Executive Summary"),
  body("Phase 6 answers one fundamental question: \"Can a revenue leader trust this recommendation?\" The existing DeepMindQ CRM codebase already contains solid intelligence foundations, including the IntelligenceValidation model, the computeEvidenceQuality() function, and the getQualityReport() aggregator. However, validation data is collected but never consumed by the scoring engines, no APIs expose validation metrics to the user interface, and no composite trust metric exists to summarize intelligence reliability."),
  body("Phase 6 is NOT about building new intelligence. Instead, it constructs a trust layer on top of existing intelligence outputs. The architecture introduces a feedback loop: every validation flows back into scoring, every opportunity recommendation carries a confidence breakdown, and every company has an observable intelligence health score. This transforms the system from one that generates recommendations into one that generates trustworthy recommendations with transparent reasoning."),
  body("The scope is deliberately bounded. No CRM pipeline stages, no deal tracking, no email sequences, and no forecasting capabilities are introduced. All database schema changes are purely additive, all new API endpoints live under a separate route group (/api/g-intelligence/), and existing APIs continue to function without modification. The three new Prisma models (SignalValidation, CompanyIntelligenceHealth, IntelligenceConflict) add 7 new API endpoints, 1 new dashboard screen, 1 new company profile tab, and 1 validation report dialog."),

  // ── 2. Architecture ──
  h1("2. Architecture"),

  h2("2.1 Data Flow: Before and After Phase 6"),
  body("The Phase 5 pipeline flows from Company through Signals, Signal Meaning, Capability Match, and directly into Opportunity Recommendation, ending at Human Decision. This linear flow has no mechanism for quality assessment between intelligence generation and recommendation delivery. Phase 6 inserts a validation layer between Capability Match and Opportunity Recommendation, and closes the loop from Human Decision back into future scoring."),
  body("Phase 5 Flow:"),
  codeBlock("Company -> Signals -> Signal Meaning -> Capability Match -> Opportunity Recommendation -> Human Decision"),
  body("Phase 6 Enhanced Flow:"),
  codeBlock("Company -> Signals -> Evidence Collection -> Evidence Quality Scoring -> Signal Validation"),
  codeBlock("  -> Intelligence Confidence Score -> Validation Report -> Opportunity Recommendation (Enhanced)"),
  codeBlock("  -> Human Decision -> Human Validation Feedback -> Calibration Engine (adjusts future scores)"),

  h2("2.2 Design Principles"),
  bodyBold("No new CRM/pipeline/automation: ", "Phase 6 is purely a validation and trust layer. It does not introduce pipeline stages, deal tracking, email sequences, or forecasting. The architecture boundary remains Data -> Intelligence -> Validation -> Human Decision."),
  bodyBold("Feedback loop is king: ", "Every piece of validation data must flow back into the scoring engines. Human validation feedback adjusts source reliability weights, signal validation statuses influence confidence scores, and health scores expose gaps that drive data enrichment priorities."),
  bodyBold("Non-breaking changes: ", "All modifications are additive. No existing fields are removed or have their types changed. Existing API routes under /api/g-crm/ continue to function identically. New endpoints live under the separate /api/g-intelligence/ route group."),
  bodyBold("Existing code reused: ", "The IntelligenceValidation model (661 lines), submitValidation(), getQualityReport(), computeEvidenceQuality() (6-dimension scorer), computeOpportunityScore() (5-factor composite), and the signal lifecycle state machine are all foundational components that Phase 6 builds upon, not rewrites."),

  h2("2.3 Codebase Verification Summary"),
  body("A comprehensive audit of the existing codebase was performed to validate all assumptions in this design document. The following table summarizes the verification results for each foundation component that Phase 6 depends on."),
  makeTable(
    ["Component", "Status", "File", "Notes"],
    [
      ["IntelligenceValidation model", "EXISTS", "prisma/schema.prisma:1205", "All 5 artifact types supported"],
      ["computeEvidenceQuality()", "EXISTS", "src/lib/research-engine/evidence-quality.ts", "Needs validationContext param added"],
      ["getQualityReport()", "EXISTS", "src/lib/intelligence-validation.ts:332", "Fully functional, API-routed"],
      ["submitValidation()", "EXISTS", "src/lib/intelligence-validation.ts:203", "Zod-validated, API-routed"],
      ["computeOpportunityScore()", "EXISTS", "opportunity-recommendation-engine.ts:100", "Needs confidenceBreakdown output"],
      ["SignalValidation model", "EXISTS", "prisma/schema.prisma:1239", "All fields present, relations wired"],
      ["CompanyIntelligenceHealth model", "EXISTS", "prisma/schema.prisma:1263", "All score dimensions present"],
      ["IntelligenceConflict model", "EXISTS", "prisma/schema.prisma:1295", "Conflict types and resolution fields present"],
      ["OpportunityRecommendation.confidenceBreakdown", "EXISTS (empty)", "prisma/schema.prisma:1148", "Column exists, never populated"],
      ["Company relations (3 new)", "EXISTS", "prisma/schema.prisma:78", "signalValidations, intelligenceHealth, intelligenceConflicts all wired"],
      ["Signal lifecycle state machine", "EXISTS", "src/lib/research-engine/signal-lifecycle.ts", "6 states, cursor-paginated transitions"],
      ["/api/g-intelligence/ route group", "MISSING", "-", "Must be created from scratch"],
      ["Sidebar: Intelligence Health", "MISSING", "src/app/page.tsx", "Must add to NAV_SECTIONS and SCREEN_MAP"],
      ["Company profile Intelligence tab", "MISSING", "company-profile-screen.tsx", "Currently 6 tabs, needs 7th"],
    ],
    [30, 18, 32, 20],
  ),
  spacer(),

  // ── 3. Module Design ──
  h1("3. Module Design (7 Modules)"),

  h2("3.1 Module 1: Evidence Quality Engine (Enhance Existing)"),
  h3("What Exists"),
  body("The computeEvidenceQuality() function in evidence-quality.ts computes a 6-dimension quality score: coverage (25%), freshness (25%), source quality (20%), corroboration (15%), and volume (15%). It accepts a single companyId parameter and returns an EvidenceQualityScore object with all dimensions plus input metrics (totalEvidence, activeEvidence, fieldsCovered, premiumSourceCount, etc.)."),
  h3("What Phase 6 Adds"),
  body("The function currently produces a per-company aggregate score. Phase 6 enhances it in three ways. First, it adds a per-evidence quality breakdown so each individual evidence item gets its own quality assessment, not just the company-level aggregate. Second, it introduces validation-adjusted quality: when humans rate evidence as inaccurate through the existing submitValidation() flow, the system down-weights that source domain in future quality computations. Third, it establishes source reliability tracking by maintaining a per-domain reliability score derived from cumulative validation feedback."),
  body("Implementation approach: The function signature is extended to accept an optional validationContext parameter. When provided, it loads recent IntelligenceValidation records for the company, computes domain-level reliability scores, and applies them as multipliers to the source quality dimension. No new database model is required; the existing IntelligenceValidation model with its artifactType = 'evidence_quality' captures all needed feedback."),
  h3("File Change"),
  codeBlock("File: src/lib/research-engine/evidence-quality.ts"),
  codeBlock("Change: Add optional validationContext param, per-evidence breakdown output, domain reliability adjustment"),

  h2("3.2 Module 2: Intelligence Confidence Score (New)"),
  h3("Purpose"),
  body("Every OpportunityRecommendation receives a confidenceBreakdown JSON field that decomposes the overall trust score into four weighted dimensions. This allows revenue leaders to understand not just the final score but which factors contribute to or detract from it."),
  h3("Formula"),
  body("Intelligence Confidence = Signal Quality x 0.30 + Evidence Quality x 0.30 + Capability Fit x 0.25 + Data Completeness x 0.15"),
  body("Signal Quality (30%): Derived from the average confidence scores of all active signals contributing to this opportunity, weighted by signal impact level. High-impact signals with high confidence scores contribute more than low-impact signals."),
  body("Evidence Quality (30%): The computeEvidenceQuality() overall score for the company, potentially adjusted by validation context if human feedback is available. This captures whether the underlying data supporting the recommendation is fresh, corroborated, and from reliable sources."),
  body("Capability Fit (25%): The matchScore from the SignalCapabilityMatch record associated with this opportunity. This measures how well the company's needs align with our capabilities."),
  body("Data Completeness (15%): The dataCompletenessScore from CompanyIntelligenceHealth, measuring what percentage of tracked fields are filled for this company. A company with complete data inspires more confidence than one with gaps."),
  h3("Storage"),
  body("The breakdown is stored as a JSON object on OpportunityRecommendation.confidenceBreakdown, a field that already exists in the schema but is currently never populated by the engine. The JSON structure is:"),
  ...makeJsonBlock([
    "{",
    "  signalQuality: 85,      // 0-100",
    "  evidenceQuality: 90,    // 0-100",
    "  capabilityFit: 78,      // 0-100",
    "  dataCompleteness: 80,   // 0-100",
    "  overall: 85            // weighted composite",
    "}",
  ]),
  h3("File Change"),
  codeBlock("New file: src/lib/intelligence-confidence.ts"),
  codeBlock("Modify: src/lib/research-engine/opportunity-recommendation-engine.ts (populate confidenceBreakdown)"),

  h2("3.3 Module 3: Signal Validation Engine (New Model)"),
  h3("Purpose"),
  body("Classifies each signal's trustworthiness into one of four validation statuses. This provides a per-signal trust assessment that feeds into the Intelligence Confidence Score and is displayed in the Validation Report."),
  h3("Validation Status Values"),
  makeTable(
    ["Status", "Meaning", "Automated Classification Rule"],
    [
      ["VALID", "Confirmed by evidence, optionally by human", "Confidence >= 0.7 AND impact = 'high' AND >= 2 evidence items"],
      ["WEAK", "Low evidence support or single-source", "Confidence < 0.5 OR single-source-only signal"],
      ["CONFLICTING", "Contradicts other active signals", "Contradiction detected by Module 6 (Contradiction Detection)"],
      ["EXPIRED", "Past relevance window", "Signal status = 'expired' or 'archived' in lifecycle"],
    ],
    [15, 35, 50],
  ),
  spacer(),
  h3("Model: SignalValidation"),
  body("The SignalValidation model already exists in the schema with the following fields: id, companyId, signalId (unique), validationStatus, confidenceScore, reason, evidenceCount, sourceDomainCount, signalAge (days since signalDate), validatedAt. It has a belongsTo relation to Company and a one-to-one relation to CompanySignal."),
  h3("Automated Engine"),
  body("The signal validation engine processes all active signals for a company and classifies each one. It queries the signal's confidence, impact level, associated evidence count, and current lifecycle status. If a contradiction is detected (via Module 6), the signal is immediately marked as CONFLICTING regardless of other factors. The engine is triggered by the POST /api/g-intelligence/companies/[id]/validate endpoint."),
  h3("File Change"),
  codeBlock("New file: src/lib/signal-validation.ts"),

  h2("3.4 Module 4: Intelligence Health Dashboard (New UI)"),
  h3("Purpose"),
  body("A new top-level screen showing aggregated validation statistics across all companies. This is NOT a CRM pipeline view; it is purely an intelligence quality observability dashboard. Revenue leaders can quickly identify which companies have low intelligence health, which have open conflicts, and what the overall validation coverage looks like."),
  h3("Key Metrics"),
  body("The dashboard displays four summary cards: Average Health Score (across all scored companies), Open Conflicts count, Valid Signals percentage, and average Data Completeness Score. Below these, it shows a Health Distribution bar chart segmenting companies into Excellent (90+), Good (70-89), Fair (50-69), and Poor (<50) tiers."),
  body("Two data tables follow: the Lowest Health Companies table (showing companies with the worst intelligence health, sortable by health score, evidence quality, signal coverage, and data completeness), and the Recent Conflicts table (showing the most recently detected conflicts with company name, conflict type, and severity). The dashboard data is served by GET /api/g-intelligence/dashboard."),
  h3("Route and Navigation"),
  body("The screen is registered as 'intelligence-health' in the sidebar under a new section called 'INTELLIGENCE GOVERNANCE'. It is added to NAV_SECTIONS and SCREEN_MAP in src/app/page.tsx."),
  h3("File Change"),
  codeBlock("New file: src/components/screens/intelligence-health-screen.tsx"),
  codeBlock("Modify: src/app/page.tsx (add sidebar entry)"),

  h2("3.5 Module 5: Data Completeness Score (New Model)"),
  h3("Purpose"),
  body("Computes a per-company field coverage score that measures what percentage of 12 tracked intelligence fields are populated. This score feeds into the Intelligence Confidence Score (15% weight) and is displayed on the Intelligence Health Dashboard and Company Profile Intelligence tab."),
  h3("Model: CompanyIntelligenceHealth"),
  body("The model already exists in the schema. It stores five score dimensions (dataCompletenessScore, signalCoverageScore, evidenceCoverageScore, contactCoverageScore, overallHealthScore), a fieldCoverage JSON breakdown, input metrics (totalSignals, activeSignals, totalEvidence, activeEvidence, totalContacts, filledFields, totalTrackedFields = 12), and lastCalculatedAt timestamp."),
  h3("Tracked Fields"),
  body("The 12 tracked fields are: industry, revenue, employeeCount, techStack, fundingStage, businessOverview, website, location, country, contacts, signals, evidence. The fieldCoverage JSON stores a boolean for each, indicating whether that field has data. The dataCompletenessScore is simply (filledFields / totalTrackedFields) x 100."),
  h3("Computation"),
  body("The overallHealthScore is a weighted composite: dataCompletenessScore (30%) + signalCoverageScore (25%) + evidenceCoverageScore (25%) + contactCoverageScore (20%). Each sub-score is computed independently. The health record is created or upserted when the POST /api/g-intelligence/companies/[id]/validate endpoint is called."),
  h3("File Change"),
  codeBlock("New file: src/lib/intelligence-health.ts"),

  h2("3.6 Module 6: Contradiction Detection (New Model)"),
  h3("Purpose"),
  body("Detects conflicting signals for the same company and stores them as IntelligenceConflict records. Contradicting signals are a significant trust reducer because they indicate the intelligence is unreliable or the company's situation is ambiguous. Detected conflicts are surfaced in the Validation Report and the Conflicts panel."),
  h3("Model: IntelligenceConflict"),
  body("The model already exists in the schema with fields: id, companyId, conflictType, description, relatedSignals (JSON array of signal IDs), severity (low/medium/high/critical, default medium), status (open/acknowledged/resolved/dismissed, default open), detectedAt, resolvedAt, resolvedBy, resolutionNotes."),
  h3("Detection Rules"),
  body("The contradiction detection engine applies three pattern-matching rules against all active signals for a company:"),
  bodyBold("Same signal type, opposite sentiment: ", "For example, one signal says 'expanding operations' while another says 'downsizing workforce'. The engine compares signal titles and descriptions within the same signalType for contradictory keywords."),
  bodyBold("Technology signals referencing competing platforms: ", "For example, 'migrating to AWS' contradicts 'expanding Azure deployment'. The engine maintains a known-competitors map of technology platforms and checks for co-occurring adoption signals."),
  bodyBold("Funding signals with conflicting stages: ", "For example, 'raised Series C' contradicts 'laying off 20% of staff'. The engine detects when positive funding events co-occur with negative workforce events within a 90-day window."),
  h3("Conflict Types"),
  makeTable(
    ["Conflict Type", "Detection Pattern", "Typical Severity"],
    [
      ["SIGNAL_CONTRADICTION", "Same type, opposite sentiment", "High"],
      ["TECHNOLOGY_CONFLICT", "Competing platform adoption", "Medium to High"],
      ["FUNDING_CONFLICT", "Positive funding + negative workforce events", "High to Critical"],
      ["EVIDENCE_CONTRADICTION", "Evidence items supporting opposing claims", "Medium"],
    ],
    [25, 45, 30],
  ),
  spacer(),
  h3("File Change"),
  codeBlock("New file: src/lib/contradiction-detection.ts"),

  h2("3.7 Module 7: Validation APIs (New Routes)"),
  h3("Purpose"),
  body("Seven new API endpoints under /api/g-intelligence/ expose all Phase 6 functionality to the frontend. These endpoints are served by a catch-all route handler at src/app/api/g-intelligence/[...slug]/route.ts that delegates to individual handler modules."),
  h3("Endpoint Summary"),
  makeTable(
    ["#", "Method", "Endpoint", "Purpose", "Module"],
    [
      ["1", "GET", "/companies/[id]/health", "Company intelligence health + breakdown", "M5"],
      ["2", "GET", "/companies/[id]/evidence-quality", "Per-company evidence quality with breakdown", "M1"],
      ["3", "GET", "/companies/[id]/validation-report", "Full validation report (all sections)", "M2+M3+M6"],
      ["4", "POST", "/companies/[id]/validate", "Trigger automated validation pipeline", "M3+M5+M6"],
      ["5", "GET", "/companies/[id]/confidence", "Intelligence confidence score", "M2"],
      ["6", "GET", "/conflicts", "List all open conflicts (paginated)", "M6"],
      ["7", "GET", "/dashboard", "Aggregated stats for dashboard UI", "M4"],
    ],
    [5, 8, 35, 35, 17],
  ),
  spacer(),
  h3("Route Architecture"),
  body("The route group uses a single catch-all [...slug] pattern. The handler parses the URL segments to determine which sub-handler to invoke. This keeps the file structure flat and avoids deep nesting. Each endpoint handler is in its own file for testability, imported by the route dispatcher."),
  h3("File Changes"),
  codeBlock("New: src/app/api/g-intelligence/[...slug]/route.ts (dispatcher)"),
  codeBlock("New: src/app/api/g-intelligence/[...slug]/health.ts"),
  codeBlock("New: src/app/api/g-intelligence/[...slug]/evidence-quality.ts"),
  codeBlock("New: src/app/api/g-intelligence/[...slug]/validation-report.ts"),
  codeBlock("New: src/app/api/g-intelligence/[...slug]/validate.ts"),
  codeBlock("New: src/app/api/g-intelligence/[...slug]/confidence.ts"),
  codeBlock("New: src/app/api/g-intelligence/[...slug]/conflicts.ts"),
  codeBlock("New: src/app/api/g-intelligence/[...slug]/dashboard.ts"),

  // ── 4. Database Schema Changes ──
  h1("4. Database Schema Changes"),
  body("Phase 6 introduces zero breaking schema changes. All modifications are purely additive: 3 new models (already present in the schema), 3 new relations on Company (already wired), and 1 new JSON field on OpportunityRecommendation (column exists, not yet populated). No existing fields are removed, renamed, or have their types changed."),

  h2("4.1 New Models (Already in Schema)"),
  h3("SignalValidation"),
  body("Stores per-signal validation status and supporting metrics. Each CompanySignal has at most one SignalValidation record (one-to-one relation via unique signalId). The model tracks validationStatus (VALID/WEAK/CONFLICTING/EXPIRED), confidenceScore, a human-readable reason, evidenceCount, sourceDomainCount, signalAge in days, and validatedAt timestamp. Indexes on companyId, signalId, validationStatus, and a composite index on (companyId, validationStatus) for efficient filtered queries."),

  h3("CompanyIntelligenceHealth"),
  body("Stores per-company intelligence health scores in a one-to-one relation with Company. Five score dimensions (dataCompletenessScore, signalCoverageScore, evidenceCoverageScore, contactCoverageScore, overallHealthScore) are each integers from 0 to 100. The fieldCoverage JSON stores per-field boolean coverage for 12 tracked fields. Input metrics (totalSignals, activeSignals, totalEvidence, activeEvidence, totalContacts, filledFields, totalTrackedFields) provide transparency into how scores were computed. Indexes on overallHealthScore (descending) and companyId."),

  h3("IntelligenceConflict"),
  body("Stores detected contradictions between signals for the same company. Each conflict has a conflictType (SIGNAL_CONTRADICTION/TECHNOLOGY_CONFLICT/FUNDING_CONFLICT/EVIDENCE_CONTRADICTION), a human-readable description, a relatedSignals JSON array of signal IDs, severity (low/medium/high/critical), status (open/acknowledged/resolved/dismissed), and resolution tracking fields (resolvedAt, resolvedBy, resolutionNotes). Indexes on companyId, status, severity, and a composite index on (companyId, status)."),

  h2("4.2 Model Modifications (Already Applied)"),
  h3("Company Model"),
  body("Three new relations have been added: signalValidations (one-to-many with SignalValidation), intelligenceHealth (one-to-one with CompanyIntelligenceHealth), and intelligenceConflicts (one-to-many with IntelligenceConflict). The cascade delete behavior ensures that when a company is deleted, all associated validation, health, and conflict records are cleaned up."),

  h3("CompanySignal Model"),
  body("A new signalValidation relation (one-to-one with SignalValidation) has been added, allowing direct lookup of a signal's validation status without querying by signalId."),

  h3("OpportunityRecommendation Model"),
  body("A new confidenceBreakdown field (Json?) has been added. This field already exists in the schema but is never populated by the current opportunity recommendation engine. Phase 6 adds the population logic in intelligence-confidence.ts and wires it into the recommendation generation pipeline."),

  // ── 5. API Contracts ──
  h1("5. API Contracts"),

  h2("5.1 GET /api/g-intelligence/companies/[id]/health"),
  body("Returns the CompanyIntelligenceHealth record for a specific company. If no health record exists yet, returns 404 with a message indicating that validation has not been run. The response includes all five score dimensions, the fieldCoverage breakdown, and the lastCalculatedAt timestamp."),
  ...makeJsonBlock([
    "Response 200:",
    "{",
    '  "companyId": "clx...",',
    '  "overallHealthScore": 87,',
    '  "dataCompletenessScore": 83,',
    '  "signalCoverageScore": 85,',
    '  "evidenceCoverageScore": 92,',
    '  "contactCoverageScore": 90,',
    '  "fieldCoverage": {',
    '    "industry": true, "revenue": true, "employeeCount": true,',
    '    "techStack": true, "fundingStage": false, "businessOverview": true,',
    '    "website": true, "location": true, "country": true,',
    '    "contacts": true, "signals": true, "evidence": false',
    "  },",
    '  "lastCalculatedAt": "2026-07-21T10:00:00Z"',
    "}",
  ]),

  h2("5.2 GET /api/g-intelligence/companies/[id]/validation-report"),
  body("The most comprehensive endpoint, returning the full validation report for a company. It aggregates data from multiple modules: the Intelligence Confidence Score (Module 2), Signal Validation Summary (Module 3), top conflicts (Module 6), Evidence Quality Summary (Module 1), and the Health Score (Module 5). This is the primary data source for the Validation Report dialog and the Company Intelligence tab."),
  ...makeJsonBlock([
    "Response 200:",
    "{",
    '  "companyId": "clx...",',
    '  "companyName": "Saudi Aramco",',
    '  "intelligenceConfidence": 85,',
    '  "confidenceBreakdown": {',
    '    "signalQuality": 82, "evidenceQuality": 90,',
    '    "capabilityFit": 78, "dataCompleteness": 80',
    "  },",
    '  "signalValidationSummary": {',
    '    "total": 12, "valid": 7, "weak": 3, "conflicting": 1, "expired": 1',
    "  },",
    '  "topConflicts": [{ ... }],',
    '  "evidenceQualitySummary": { ... },',
    '  "healthScore": 87',
    "}",
  ]),

  h2("5.3 POST /api/g-intelligence/companies/[id]/validate"),
  body("Triggers the full automated validation pipeline for a company. This is the primary entry point for initiating validation. The pipeline executes three steps sequentially: (1) Signal Validation Engine classifies all active signals, (2) Contradiction Detection scans for conflicts and creates IntelligenceConflict records, (3) Intelligence Health Calculator computes or updates the CompanyIntelligenceHealth record. The response summarizes what was done."),
  ...makeJsonBlock([
    "Request: empty body (triggers full pipeline)",
    "Response 200:",
    "{",
    '  "success": true,',
    '  "results": {',
    '    "signalsValidated": 12,',
    '    "newConflicts": 1,',
    '    "healthUpdated": true,',
    '    "previousHealth": 82,',
    '    "newHealth": 87',
    "  }",
    "}",
  ]),

  h2("5.4 GET /api/g-intelligence/conflicts"),
  body("Returns a paginated, filterable list of conflicts. Query parameters: severity (low/medium/high/critical), status (open/acknowledged/resolved/dismissed), companyId (optional filter), page (default 1), limit (default 20). The response includes the conflict list, total count, current page, and limit for client-side pagination rendering."),

  h2("5.5 GET /api/g-intelligence/dashboard"),
  body("Returns aggregated validation statistics for the Intelligence Health Dashboard. The response includes a summary object (totalCompanies, avgHealthScore, companiesByHealthTier, totalConflicts, openConflicts, validationRate), the lowestHealthCompanies array (top 10), and the recentConflicts array (top 10). This endpoint performs lightweight aggregation queries against CompanyIntelligenceHealth and IntelligenceConflict tables."),

  // ── 6. UI Screens ──
  h1("6. UI Screens"),

  h2("6.1 Screen 1: Intelligence Health Dashboard"),
  bodyBold("Route: ", "intelligence-health (new sidebar entry under 'INTELLIGENCE GOVERNANCE')"),
  body("This is a new top-level screen showing aggregated validation statistics across all companies. The layout consists of four summary metric cards at the top (Average Health Score, Open Conflicts, Valid Signals percentage, Coverage Score), followed by a Health Distribution visualization showing company counts in each tier (Excellent/Good/Fair/Poor), then two data tables: Lowest Health Companies and Recent Conflicts."),
  body("The dashboard uses a refresh button to re-fetch data from GET /api/g-intelligence/dashboard. Clicking any company name navigates to that company's profile with the Intelligence tab selected. Clicking a conflict navigates to the company profile and highlights the conflict. The screen is read-only; it has no form inputs or mutation operations."),

  h2("6.2 Screen 2: Company Intelligence Health Panel (New Tab)"),
  bodyBold("Location: ", "New 'Intelligence' tab in the existing company profile screen"),
  body("Added as the 7th tab in the company-profile-screen.tsx tab bar (after 'activity'). The panel displays the overall health score as a large gauge with tier label (Excellent/Good/Fair/Poor), four sub-score gauges (Data Completeness, Signal Coverage, Evidence Quality, Contact Coverage) in a 2x2 grid, a field coverage checklist showing which of the 12 tracked fields are populated, a signal validation summary (counts of VALID/WEAK/CONFLICTING/EXPIRED), and an active conflicts section with Acknowledge/Dismiss action buttons."),
  body("The panel includes a 'Run Full Validation' button that calls POST /api/g-intelligence/companies/[id]/validate and refreshes the panel data on success. The field coverage checklist uses green checkmarks and red crosses for visual clarity. Each sub-score gauge shows the numeric value and a progress bar."),

  h2("6.3 Screen 3: Validation Report Dialog"),
  bodyBold("Trigger: ", "Clicking 'View Validation' on any opportunity recommendation card"),
  body("A modal dialog that opens from the Opportunity Workspace screen. It displays the Intelligence Confidence Score as a large percentage with tier label, a confidence breakdown bar chart showing all four dimensions (Signal Quality, Evidence Quality, Capability Fit, Data Completeness), a supporting evidence list (each item showing quality level, description, source domain, age, and source tier), a signal validations section (each signal showing its validation status badge, title, and confidence score), and a footer with health and evidence summary metrics."),
  body("The dialog fetches its data from GET /api/g-intelligence/companies/[id]/validation-report. It is a read-only informational view. The modal can be dismissed by clicking outside or pressing Escape. No form inputs or mutations are present in this dialog."),

  // ── 7. File Manifest ──
  h1("7. File Manifest"),

  h2("7.1 New Files to Create"),
  makeTable(
    ["File", "Purpose"],
    [
      ["src/lib/intelligence-confidence.ts", "Confidence score computation (4-dimension weighted formula)"],
      ["src/lib/signal-validation.ts", "Signal validation engine (classifies VALID/WEAK/CONFLICTING/EXPIRED)"],
      ["src/lib/intelligence-health.ts", "Company intelligence health calculator (5 score dimensions)"],
      ["src/lib/contradiction-detection.ts", "Contradiction detection rules (4 conflict types)"],
      ["src/app/api/g-intelligence/[...slug]/route.ts", "API route dispatcher (parses slug, delegates)"],
      ["src/app/api/g-intelligence/[...slug]/health.ts", "GET health endpoint handler"],
      ["src/app/api/g-intelligence/[...slug]/evidence-quality.ts", "GET evidence quality endpoint handler"],
      ["src/app/api/g-intelligence/[...slug]/validation-report.ts", "GET validation report endpoint handler"],
      ["src/app/api/g-intelligence/[...slug]/validate.ts", "POST validate endpoint handler"],
      ["src/app/api/g-intelligence/[...slug]/confidence.ts", "GET confidence endpoint handler"],
      ["src/app/api/g-intelligence/[...slug]/conflicts.ts", "GET conflicts list endpoint handler"],
      ["src/app/api/g-intelligence/[...slug]/dashboard.ts", "GET dashboard stats endpoint handler"],
      ["src/components/screens/intelligence-health-screen.tsx", "Intelligence Health Dashboard screen component"],
      ["tests/intelligence-health.test.ts", "Unit tests for all Phase 6 modules"],
    ],
    [50, 50],
  ),
  spacer(),

  h2("7.2 Files to Modify (Additive Only)"),
  makeTable(
    ["File", "Change Description"],
    [
      ["prisma/schema.prisma", "No change needed - 3 models + relations already present"],
      ["src/app/page.tsx", "Add 'Intelligence Health' to NAV_SECTIONS + SCREEN_MAP"],
      ["src/components/screens/company-profile-screen.tsx", "Add 7th tab 'Intelligence' with health panel"],
      ["src/lib/research-engine/opportunity-recommendation-engine.ts", "Wire confidenceBreakdown population"],
      ["src/lib/research-engine/evidence-quality.ts", "Add validationContext param + per-evidence breakdown"],
    ],
    [45, 55],
  ),
  spacer(),

  // ── 8. Acceptance Criteria ──
  h1("8. Acceptance Criteria"),
  body("Phase 6 is considered complete only when ALL of the following criteria pass. These are divided into Must-Have criteria (blocking) and the Demo Scenario validation."),

  h2("8.1 Must-Have Criteria"),
  makeTable(
    ["ID", "Criterion", "Validation Method"],
    [
      ["AC-1", "Every opportunity recommendation has a confidenceBreakdown JSON with signalQuality, evidenceQuality, capabilityFit, dataCompleteness, and computed overall", "Check DB after opportunity generation"],
      ["AC-2", "Every active signal has a SignalValidation record with validationStatus, confidenceScore, and reason", "Check DB after POST validate"],
      ["AC-3", "CompanyIntelligenceHealth record exists for scored companies with all 5 score dimensions", "Check DB after POST validate"],
      ["AC-4", "Contradicting signals are detected and stored as IntelligenceConflict records", "Create 2 conflicting signals, run validate, check DB"],
      ["AC-5", "GET /companies/[id]/validation-report returns complete report with all sections", "API test"],
      ["AC-6", "GET /companies/[id]/health returns health score with field coverage", "API test"],
      ["AC-7", "Intelligence Health Dashboard screen renders with stats, distribution, and tables", "Visual check"],
      ["AC-8", "Company profile Intelligence tab renders health gauges + signal validation summary + conflicts", "Visual check"],
      ["AC-9", "Validation report dialog shows confidence breakdown + evidence list + signal validations", "Visual check"],
      ["AC-10", "POST /companies/[id]/validate triggers full validation pipeline", "API test"],
      ["AC-11", "GET /conflicts returns paginated conflicts with filters", "API test"],
      ["AC-12", "GET /dashboard returns aggregated stats", "API test"],
      ["AC-13", "No CRM functionality added (no pipeline stages, no deal tracking, no forecast fields)", "Code review"],
      ["AC-14", "No outbound automation added (no email sending, no sequence triggers)", "Code review"],
      ["AC-15", "All new models have proper indexes for query performance", "Schema review"],
      ["AC-16", "TypeScript compiles with zero new errors in Phase 6 files", "npx tsc --noEmit"],
      ["AC-17", "All Phase 6 tests pass", "npx vitest run"],
      ["AC-18", "Next.js production build succeeds", "bun run build"],
    ],
    [8, 60, 32],
  ),
  spacer(),

  h2("8.2 Demo Scenario Validation"),
  body("The demo scenario validates the end-to-end user experience across all three new UI surfaces:"),
  bodyBold("Step 1: ", "Select company 'Saudi Aramco' and navigate to the Intelligence tab. Verify the Health score is 87% or higher, showing the EXCELLENT tier label. Confirm all four sub-score gauges render with correct values, and the field coverage checklist shows populated fields."),
  bodyBold("Step 2: ", "Click 'Run Full Validation' on the Intelligence tab. Verify that signal validation records appear (counts update), conflicts are detected and displayed, and the health score refreshes to reflect the new computation."),
  bodyBold("Step 3: ", "Navigate to the Opportunity Workspace and click any opportunity recommendation. Click 'View Validation' to open the Validation Report dialog. Verify the confidence breakdown shows 85%+ overall with all four dimensions rendered as progress bars, the evidence list shows individual items with source and age, and signal validations display status badges."),
  bodyBold("Step 4: ", "Navigate to the Intelligence Health Dashboard. Verify Saudi Aramco appears in the 'Excellent' tier of the Health Distribution. Verify the Conflicts panel shows the detected contradiction with correct severity level."),
  bodyBold("Step 5: ", "Navigate to the Conflicts endpoint or dashboard panel. Verify the detected TECHNOLOGY_CONFLICT is listed with the correct description, related signals, and severity. Test acknowledging and dismissing a conflict to verify status transitions."),

  // ── 9. Scope Boundaries ──
  h1("9. Scope Boundaries and Exclusions"),
  body("The following items are explicitly OUT OF SCOPE for Phase 6 and must not be introduced during implementation:"),
  bodyBold("CRM Pipeline: ", "No pipeline stages (Lead/Qualified/Proposal/Negotiation/Closed), no deal tracking, no opportunity value fields, no forecast projections. These belong to a future CRM phase if ever needed."),
  bodyBold("Outbound Automation: ", "No email sending, no sequence triggers, no cadence scheduling, no outreach workflow automation. The system remains an intelligence platform, not a sales engagement tool."),
  bodyBold("User Management: ", "No user authentication, role-based access control, or permission changes. The existing system's auth model (if any) remains unchanged."),
  bodyBold("Data Ingestion: ", "No new data sources, no web scraping changes, no enrichment pipeline modifications. Phase 6 operates on data already in the system."),
  bodyBold("Calibration Engine: ", "While the architecture diagram includes a Calibration Engine that adjusts future scores based on validation feedback, the full implementation of automated calibration is deferred. Phase 6 lays the groundwork (validation data is collected and stored) but does not implement the automatic weight adjustment algorithm. This is a deliberate scope reduction to prevent uncontrolled expansion."),
  body("The route group separation (/api/g-intelligence/ vs /api/g-crm/) enforces the architectural boundary at the API level. Any PR that adds endpoints outside these designated groups should be rejected during code review."),
];

// ─── Assemble Document ───
const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: { ascii: "Times New Roman", eastAsia: "Microsoft YaHei" }, size: 22, color: c(bodyPalette.body) },
        paragraph: { spacing: { line: 312 } },
      },
    },
  },
  sections: [
    // Section 1: Cover (no page number, margin 0)
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 0, bottom: 0, left: 0, right: 0 },
        },
      },
      children: coverChildren,
    },
    // Section 2: TOC (Roman numerals)
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
          pageNumbers: { start: 1, formatType: NumberFormat.UPPER_ROMAN },
        },
      },
      footers: { default: pageNumFooter(NumberFormat.UPPER_ROMAN) },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 480, after: 360 },
          children: [new TextRun({ text: "Table of Contents", bold: true, size: 32,
            font: { ascii: "Times New Roman", eastAsia: "SimHei" }, color: c(bodyPalette.primary) })],
        }),
        new TableOfContents("Table of Contents", {
          hyperlink: true,
          headingStyleRange: "1-3",
        }),
        new Paragraph({
          spacing: { before: 200 },
          children: [new TextRun({ text: "Note: This Table of Contents is generated via field codes. To ensure page number accuracy after editing, please right-click the TOC and select \"Update Field.\"", italics: true, size: 18, color: "888888" })],
        }),
        new Paragraph({ children: [new PageBreak()] }),
      ],
    },
    // Section 3: Body (Arabic numerals from 1)
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
          pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
        },
      },
      footers: { default: pageNumFooter(NumberFormat.DECIMAL) },
      children: bodyContent,
    },
  ],
});

// ─── Generate ───
const OUTPUT = "/home/z/my-project/download/Phase6-Design-Document-Intelligence-Validation-Trust-Layer.docx";
Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(OUTPUT, buf);
  console.log("Generated:", OUTPUT);
});