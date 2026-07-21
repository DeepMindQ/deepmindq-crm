const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Header, Footer,
  AlignmentType, HeadingLevel, PageNumber, PageBreak,
  Table, TableRow, TableCell, WidthType, BorderStyle,
  ShadingType, SectionType, TableOfContents, NumberFormat,
  TabStopType, TabStopPosition,
} = require("docx");

// ── Palette: Consulting (Cool + Heavy + Active) ──
const P = {
  primary: "1B2A4A",
  body: "1E293B",
  secondary: "64748B",
  accent: "0F766E",
  surface: "F0FDFA",
  white: "FFFFFF",
  lightGray: "F8FAFC",
  red: "DC2626",
  amber: "D97706",
  green: "059669",
  headerLine: "0F766E",
};

const c = (hex) => hex.replace("#", "");
const allNoBorders = {
  top: { style: BorderStyle.NONE, size: 0 },
  bottom: { style: BorderStyle.NONE, size: 0 },
  left: { style: BorderStyle.NONE, size: 0 },
  right: { style: BorderStyle.NONE, size: 0 },
};
const thinBorder = {
  top: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
  left: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
  right: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
};
const headerBorder = {
  top: { style: BorderStyle.SINGLE, size: 1, color: c(P.accent) },
  bottom: { style: BorderStyle.SINGLE, size: 2, color: c(P.accent) },
  left: { style: BorderStyle.SINGLE, size: 1, color: c(P.accent) },
  right: { style: BorderStyle.SINGLE, size: 1, color: c(P.accent) },
};

// ── Helpers ──
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 480, after: 200, line: 312 },
    children: [new TextRun({ text, bold: true, font: "Times New Roman", size: 32, color: c(P.primary) })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 360, after: 160, line: 312 },
    children: [new TextRun({ text, bold: true, font: "Times New Roman", size: 28, color: c(P.primary) })],
  });
}
function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 240, after: 120, line: 312 },
    children: [new TextRun({ text, bold: true, font: "Times New Roman", size: 26, color: c(P.body) })],
  });
}
function body(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    indent: { firstLine: 480 },
    spacing: { after: 120, line: 312 },
    children: [new TextRun({ text, font: "Times New Roman", size: 24, color: c(P.body) })],
  });
}
function bodyNoIndent(text) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { after: 120, line: 312 },
    children: [new TextRun({ text, font: "Times New Roman", size: 24, color: c(P.body) })],
  });
}
function boldBody(label, text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    indent: { firstLine: 480 },
    spacing: { after: 120, line: 312 },
    children: [
      new TextRun({ text: label, bold: true, font: "Times New Roman", size: 24, color: c(P.body) }),
      new TextRun({ text, font: "Times New Roman", size: 24, color: c(P.body) }),
    ],
  });
}
function statusBadge(text, color) {
  return new TextRun({ text: ` [${text}]`, bold: true, font: "Times New Roman", size: 24, color: c(color) });
}
function bullet(text, level = 0) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { after: 60, line: 312 },
    indent: { left: 480 + level * 360 },
    children: [
      new TextRun({ text: "\u2022  ", font: "Times New Roman", size: 24, color: c(P.accent) }),
      new TextRun({ text, font: "Times New Roman", size: 24, color: c(P.body) }),
    ],
  });
}
function findingRow(label, value, statusColor) {
  const valRun = statusColor
    ? [new TextRun({ text: value, bold: true, font: "Times New Roman", size: 22, color: c(statusColor) })]
    : [new TextRun({ text: value, font: "Times New Roman", size: 22, color: c(P.body) })];
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 40, type: WidthType.PERCENTAGE },
        borders: thinBorder,
        shading: { fill: c(P.lightGray), type: ShadingType.CLEAR },
        children: [new Paragraph({ spacing: { line: 280 }, children: [new TextRun({ text: label, font: "Times New Roman", size: 22, color: c(P.body) })] })],
      }),
      new TableCell({
        width: { size: 60, type: WidthType.PERCENTAGE },
        borders: thinBorder,
        children: [new Paragraph({ spacing: { line: 280 }, children: valRun })],
      }),
    ],
  });
}
function findingTable(rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({
            width: { size: 40, type: WidthType.PERCENTAGE },
            borders: headerBorder,
            shading: { fill: c(P.accent), type: ShadingType.CLEAR },
            children: [new Paragraph({ spacing: { line: 280 }, children: [new TextRun({ text: "Attribute", bold: true, font: "Times New Roman", size: 22, color: c(P.white) })] })],
          }),
          new TableCell({
            width: { size: 60, type: WidthType.PERCENTAGE },
            borders: headerBorder,
            shading: { fill: c(P.accent), type: ShadingType.CLEAR },
            children: [new Paragraph({ spacing: { line: 280 }, children: [new TextRun({ text: "Finding", bold: true, font: "Times New Roman", size: 22, color: c(P.white) })] })],
          }),
        ],
      }),
      ...rows,
    ],
  });
}
function spacer(h = 120) {
  return new Paragraph({ spacing: { after: h } });
}

// ── Cover Page (R1: Pure Paragraph Left) ──
function buildCover() {
  return {
    properties: {
      page: {
        size: { width: 11906, height: 16838, orientation: "portrait" },
        margin: { top: 0, bottom: 0, left: 0, right: 0 },
      },
    },
    children: [
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            height: { value: 16838, rule: "exact" },
            children: [
              new TableCell({
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: allNoBorders,
                verticalAlign: "top",
                children: [
                  new Paragraph({ spacing: { before: 4800 } }),
                  new Paragraph({
                    spacing: { after: 200, line: 600, lineRule: "atLeast" },
                    indent: { left: 1701 },
                    children: [new TextRun({ text: "PHASE 1\u20137", font: "Times New Roman", size: 28, color: c(P.accent), bold: true, characterSpacing: 120 })],
                  }),
                  new Paragraph({
                    spacing: { after: 120, line: 828, lineRule: "atLeast" },
                    indent: { left: 1701 },
                    children: [new TextRun({ text: "Product Readiness", font: "Times New Roman", size: 60, bold: true, color: c(P.primary) })],
                  }),
                  new Paragraph({
                    spacing: { after: 400, line: 828, lineRule: "atLeast" },
                    indent: { left: 1701 },
                    children: [new TextRun({ text: "Audit Report", font: "Times New Roman", size: 60, bold: true, color: c(P.primary) })],
                  }),
                  new Paragraph({
                    spacing: { after: 80 },
                    indent: { left: 1701 },
                    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: c(P.accent), space: 8 } },
                    children: [new TextRun({ text: " ", size: 4 })],
                  }),
                  new Paragraph({ spacing: { before: 400 } }),
                  new Paragraph({
                    spacing: { after: 80, line: 312 },
                    indent: { left: 1701 },
                    children: [new TextRun({ text: "Revenue Intelligence Platform", font: "Times New Roman", size: 24, color: c(P.secondary) })],
                  }),
                  new Paragraph({
                    spacing: { after: 80, line: 312 },
                    indent: { left: 1701 },
                    children: [new TextRun({ text: "End-to-End Validation, Architecture Review, and Phase 8 Readiness", font: "Times New Roman", size: 24, color: c(P.secondary) })],
                  }),
                  new Paragraph({ spacing: { before: 2000 } }),
                  new Paragraph({
                    spacing: { after: 80, line: 312 },
                    indent: { left: 1701 },
                    children: [
                      new TextRun({ text: "Date: ", font: "Times New Roman", size: 22, color: c(P.secondary) }),
                      new TextRun({ text: "21 July 2026", font: "Times New Roman", size: 22, color: c(P.body), bold: true }),
                    ],
                  }),
                  new Paragraph({
                    spacing: { after: 80, line: 312 },
                    indent: { left: 1701 },
                    children: [
                      new TextRun({ text: "Classification: ", font: "Times New Roman", size: 22, color: c(P.secondary) }),
                      new TextRun({ text: "Internal \u2014 Pre-Phase 8", font: "Times New Roman", size: 22, color: c(P.body), bold: true }),
                    ],
                  }),
                  new Paragraph({
                    spacing: { after: 80, line: 312 },
                    indent: { left: 1701 },
                    children: [
                      new TextRun({ text: "Build: ", font: "Times New Roman", size: 22, color: c(P.secondary) }),
                      new TextRun({ text: "a99d612 (Phase 7)", font: "Times New Roman", size: 22, color: c(P.body), bold: true }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  };
}

// ── DOCUMENT ASSEMBLY ──
const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: { ascii: "Times New Roman", eastAsia: "SimSun" }, size: 24, color: c(P.body) },
        paragraph: { spacing: { line: 312 } },
      },
      heading1: {
        run: { font: { ascii: "Times New Roman", eastAsia: "SimHei" }, size: 32, bold: true, color: c(P.primary) },
        paragraph: { spacing: { before: 480, after: 200, line: 312 } },
      },
      heading2: {
        run: { font: { ascii: "Times New Roman", eastAsia: "SimHei" }, size: 28, bold: true, color: c(P.primary) },
        paragraph: { spacing: { before: 360, after: 160, line: 312 } },
      },
      heading3: {
        run: { font: { ascii: "Times New Roman", eastAsia: "SimHei" }, size: 26, bold: true, color: c(P.body) },
        paragraph: { spacing: { before: 240, after: 120, line: 312 } },
      },
    },
  },
  sections: [
    // SECTION 1: COVER
    buildCover(),

    // SECTION 2: TOC
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
          pageNumbers: { start: 1, formatType: NumberFormat.UPPER_ROMAN },
        },
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ children: [PageNumber.CURRENT], font: "Times New Roman", size: 18, color: c(P.secondary) })],
            }),
          ],
        }),
      },
      children: [
        new Paragraph({
          spacing: { after: 300, line: 312 },
          children: [new TextRun({ text: "Table of Contents", font: "Times New Roman", size: 36, bold: true, color: c(P.primary) })],
        }),
        new TableOfContents("TOC", {
          hyperlink: true,
          headingStyleRange: "1-3",
        }),
        new Paragraph({
          spacing: { before: 200, after: 100, line: 312 },
          children: [new TextRun({ text: "Note: Right-click the TOC above and select \u201cUpdate Field\u201d to refresh page numbers.", font: "Times New Roman", size: 20, italics: true, color: c(P.secondary) })],
        }),
        new Paragraph({ children: [new PageBreak()] }),
      ],
    },

    // SECTION 3: BODY
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
          pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              spacing: { after: 60 },
              border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: c(P.accent), space: 4 } },
              children: [new TextRun({ text: "Phase 1\u20137 Product Readiness Audit", font: "Times New Roman", size: 18, color: c(P.secondary), italics: true })],
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ children: [PageNumber.CURRENT], font: "Times New Roman", size: 18, color: c(P.secondary) })],
            }),
          ],
        }),
      },
      children: [
        // ═══════════════════════════════════════════════════════
        // 1. EXECUTIVE SUMMARY
        // ═══════════════════════════════════════════════════════
        h1("1. Executive Summary"),
        body("This report presents a comprehensive product readiness audit of the Revenue Intelligence Platform covering Phases 1 through 7. The audit validates end-to-end flow connectivity, data consistency, architecture integrity, test coverage, and deployment readiness. The objective is to confirm that the existing foundation is stable, properly connected, and ready for Phase 8, which will focus on UI/UX refinement, complete testing, and final demo preparation."),
        body("The platform implements a 10-stage intelligence pipeline: Company Intelligence, Signal Detection, Evidence Collection, Intelligence Interpretation, Capability Matching, Opportunity Recommendation, Trust/Validation, Confidence Scoring, Revenue Intelligence Experience, and Executive Reporting. Each stage has been validated for data flow integrity and API connectivity."),
        body("Key findings: The product foundation is solid with 489 of 505 tests passing, a clean production build, and all Phase 7 experience screens properly wired into the navigation system. Two pre-existing test failures in store.test.ts (unrelated to Phase 6/7) and one architectural issue with the Zustand store not including Phase 7 screen types were identified. Neither issue blocks Phase 8 work, but both should be addressed during Phase 8."),
        body("The overall verdict: the product foundation is ready for Phase 8 with three mandatory fixes and several recommended improvements documented in Section 13."),

        // ═══════════════════════════════════════════════════════
        // 2. END-TO-END PRODUCT FLOW VALIDATION
        // ═══════════════════════════════════════════════════════
        h1("2. End-to-End Product Flow Validation"),
        body("The intelligence pipeline flows through ten distinct stages, each building upon the previous stage's output. This section validates that every stage is connected, that data flows correctly between adjacent stages, and that no stage is orphaned or disconnected from the rest of the system."),

        h2("2.1 Stage-by-Stage Connection Analysis"),
        body("Company Intelligence (Phase 1-2) forms the foundation. Companies are created through the import pipeline (g-crm/companies endpoints) and enriched via the research agent and AI enrichment APIs. Each company record includes industry, domain, location, country, and size range. The Company model serves as the primary foreign key for all downstream intelligence models, confirming proper relational dependency."),
        body("Signal Detection (Phase 3) builds on companies through CompanySignal records. The signal intelligence screen triggers signal detection via the research engine (src/lib/research-engine/signals.ts). Signals carry confidence scores, impact levels, and lifecycle status. The signal-validation engine (Phase 6, Module 3) classifies each signal as VALID, WEAK, CONFLICTING, or EXPIRED using rule-based classification that considers confidence, evidence count, source diversity, and age. This stage connects directly to the Evidence stage through the evidenceIds JSON field on CompanySignal."),
        body("Evidence Collection (Phase 3-4) is stored in the Evidence model, linked to companies via companyId. Evidence quality is computed by src/lib/research-engine/evidence-quality.ts, which produces a 5-dimension quality score (coverage, freshness, source quality, corroboration, volume). The evidence-quality API endpoint exposes this computation at /api/g-intelligence/companies/[id]/evidence-quality. Evidence records are referenced by signals and recommendations, forming a many-to-many relationship through JSON arrays."),
        body("Intelligence Interpretation (Phase 5) connects signals to opportunities through the opportunity recommendation engine (src/lib/research-engine/opportunity-recommendation-engine.ts). This engine matches detected signals against capability library entries to produce OpportunityRecommendation records with matchScore and opportunityScore fields. The interpretation layer transforms raw signal data into actionable commercial intelligence."),
        body("Capability Matching (Phase 5) uses the signal-capability-matching module (src/lib/research-engine/signal-capability-matching.ts) to determine how well a company's detected needs align with the organization's service capabilities. The match score feeds directly into the confidence computation pipeline as the 'capabilityFit' dimension, weighted at 25% of the overall confidence score."),
        body("Opportunity Recommendation (Phase 5) produces OpportunityRecommendation records with confidenceScore, confidenceBreakdown (JSON), and confidenceFactors (JSON). The confidence API at /api/g-intelligence/companies/[id]/confidence aggregates these recommendations and computes missing breakdowns on-the-fly using the 4-dimension model from intelligence-confidence.ts."),
        body("Trust/Validation Layer (Phase 6) provides governance through three engines: signal-validation.ts (4-class classification), contradiction-detection.ts (4 conflict types), and intelligence-health.ts (5-dimension health scoring). The validate API at POST /api/g-intelligence/companies/[id]/validate orchestrates all three in sequence: validate signals, detect contradictions, re-validate conflicting signals, compute health, and backfill confidence breakdowns. This orchestration confirms proper cross-module dependency wiring."),
        body("Confidence Score (Phase 6, Module 2) implements a 4-dimension weighted model: Signal Quality (30%), Evidence Quality (30%), Capability Fit (25%), and Data Completeness (15%). The computeConfidenceScore function is a pure computation that can be called independently, while computeFullConfidenceBreakdown provides the DB-backed version that pulls live data. Confidence factors (explainability) are computed by confidence-explainability.ts, which produces positive and negative contributing factors with impact scores and category labels."),
        body("Revenue Intelligence Experience (Phase 7) is a pure presentation layer that reads from all prior stages. Five screens consume the intelligence APIs: Revenue Intelligence Dashboard fetches from /dashboard and /conflicts, Company Brief fetches from /confidence, /validate, /evidence-quality, and /conflicts, AI Reasoning fetches from /trust-report and /conflicts, Intelligence Report fetches from the same APIs as the Brief, and Demo Mode uses hardcoded fallback data for 5 ME companies. Navigation flows correctly: Dashboard cards link to Brief, Demo cards link to Brief, and Brief provides a back navigation to Dashboard."),
        body("Executive Reporting (Phase 7, Module 4) renders a consulting-brief-style document using the same data sources as the Brief screen, formatted for printable output. The report follows the Decision-Reason-Evidence-Detail information hierarchy as specified in the Phase 7 requirements."),

        h2("2.2 Connection Status Summary"),
        findingTable([
          findingRow("Company to Signals", "Connected via companyId FK", P.green),
          findingRow("Signals to Evidence", "Connected via evidenceIds JSON array", P.green),
          findingRow("Evidence to Quality", "Connected via computeEvidenceQuality()", P.green),
          findingRow("Signals to Recommendations", "Connected via signalId + matchScore", P.green),
          findingRow("Recommendations to Confidence", "Connected via confidenceBreakdown JSON", P.green),
          findingRow("Confidence to Explainability", "Connected via confidenceFactors JSON", P.green),
          findingRow("Validation to Health", "Orchestrated in validate API", P.green),
          findingRow("Conflicts to Validation", "Conflicting signals re-validated", P.green),
          findingRow("Feedback to Source Reliability", "Connected via applyFeedbackToSources()", P.green),
          findingRow("All APIs to Phase 7 Screens", "Connected via fetch + fallback", P.green),
          findingRow("Phase 7 to Store Types", "NOT in ViewId union type", P.red),
        ]),
        spacer(),
        body("The single disconnection identified is that the Zustand store's ViewId type does not include the five new Phase 7 screen keys (revenue-intelligence, revenue-intelligence-brief, intelligence-reasoning, intelligence-report, demo-experience). This does not cause a runtime error because the SCREEN_MAP in page.tsx uses string keys directly, but it represents a type safety gap that should be closed during Phase 8."),

        // ═══════════════════════════════════════════════════════
        // 3. PRODUCT INFORMATION ARCHITECTURE REVIEW
        // ═══════════════════════════════════════════════════════
        h1("3. Product Information Architecture Review"),
        body("The product's primary object is the Company entity, which serves as the central node in the intelligence graph. All intelligence data (signals, evidence, health, conflicts, recommendations, feedback) is scoped to a company. The navigation structure supports a natural user journey from company discovery through intelligence analysis to decision-making."),

        h2("3.1 Navigation Structure"),
        body("The sidebar is organized into 10 sections (NAV_SECTIONS in page.tsx). The Revenue Intelligence section is placed first (defaultOpen: true) and contains 8 items. Phase 7 screens occupy the top 5 positions, followed by Phase 5 screens. This prioritization correctly positions the executive experience layer at the top of the navigation hierarchy."),
        body("The user journey follows a logical progression: Revenue Intelligence Dashboard (overview) leads to Company Brief (deep dive) via card click. Demo Mode provides an alternative entry point for first-time users. AI Reasoning and Intelligence Report serve as detail layers accessible from the Brief. The navigation uses a single-page architecture with client-side screen switching via the setActiveScreen function, which is the established pattern across all phases."),

        h2("3.2 Unified Product Assessment"),
        body("The application feels like one unified product rather than independent screens. The shared navigation framework, consistent card-based design language in Phase 7, and the common data model (company-centric) create cohesion. The Phase 7 screens share a consistent visual language: gold accents for priority elements, emerald for positive indicators, amber for warnings, red for alerts, and a card-based layout with rounded corners and subtle shadows."),
        body("One area for improvement during Phase 8: the transition between Phase 5 screens (Account Ranking, Opportunity Workspace, Pursuit Tracker) and Phase 7 screens (Revenue Intelligence, Company Brief) could be more seamless. Currently, these are separate screens with separate data fetching logic. A unified data context or shared hooks could reduce duplication and improve the sense of a single product experience."),

        // ═══════════════════════════════════════════════════════
        // 4. DATA CONSISTENCY AUDIT
        // ═══════════════════════════════════════════════════════
        h1("4. Data Consistency Audit"),
        body("This section audits data consistency for the five demo companies (Saudi Aramco, ADNOC, STC, Emirates NBD, NEOM) across all Phase 7 screens. Each screen uses one of two data sources: live API data from the database, or hardcoded fallback data when the API returns an error or empty response."),

        h2("4.1 Data Source Architecture"),
        body("The Revenue Intelligence Dashboard (revenue-intelligence-screen.tsx) defines a DEMO_COMPANIES array with 5 companies containing: id, name, industry, country, score, health, signals, sources, reason, action, and confidence. The Company Brief (revenue-intelligence-brief-screen.tsx) has its own DEMO_BRIEF_DATA constant keyed by companyId. The AI Reasoning screen (intelligence-reasoning-screen.tsx) has its own DEMO_TRUST_DATA. The Intelligence Report screen (intelligence-report-screen.tsx) has its own DEMO_REPORT_DATA. The Demo Experience screen (demo-experience-screen.tsx) has its own DEMO_COMPANIES array."),

        h2("4.2 Consistency Findings"),
        body("A critical finding is that each Phase 7 screen maintains its own independent hardcoded demo data. This means the demo data is duplicated across five files with no shared source of truth. While the company names, industries, and countries are consistent across all five files, the intelligence scores and other metrics are independently defined in each file and may not match exactly."),

        findingTable([
          findingRow("Company Names", "Consistent across all 5 screens", P.green),
          findingRow("Industries", "Consistent (Oil & Gas, Telecom, Banking, Tech)", P.green),
          findingRow("Countries", "Consistent (Saudi Arabia, UAE)", P.green),
          findingRow("Intelligence Scores", "Duplicated per screen; no shared source", P.amber),
          findingRow("Confidence Values", "Duplicated per screen; no shared source", P.amber),
          findingRow("Evidence Info", "Duplicated per screen; no shared source", P.amber),
          findingRow("Recommendations", "Duplicated per screen; no shared source", P.amber),
          findingRow("Conflicts", "Duplicated per screen; no shared source", P.amber),
        ]),
        spacer(),
        body("The inconsistency is limited to the hardcoded fallback data path. When the database is seeded with the demo seed script (demo/intelligence-validation-seed.ts) and APIs return real data, all screens fetch from the same database and will show consistent information. The duplication only manifests in the fallback scenario when the API calls fail, which occurs in a fresh database without seeded data."),
        body("Recommendation for Phase 8: Extract the demo fallback data into a single shared module (e.g., src/lib/demo-data.ts) that all five screens import from. This ensures that when fallback mode is active, all screens display identical values for the same company."),

        // ═══════════════════════════════════════════════════════
        // 5. ARCHITECTURE REVIEW
        // ═══════════════════════════════════════════════════════
        h1("5. Architecture Review"),
        body("The platform follows a clear 4-layer architecture with proper separation of concerns. Each layer has a defined responsibility and interface boundary."),

        h2("5.1 Layer Separation Validation"),
        h3("Data Foundation (Phases 1-2)"),
        body("Prisma ORM with PostgreSQL. Core models: Company, Contact, ImportBatch, CompanySignal, Evidence, CompanyResearchCard, and others. The schema file (prisma/schema.prisma) defines 20+ models with proper relations, cascading deletes, and default values. The data foundation layer is stable and has not been modified since Phase 6.1."),
        h3("Intelligence Engine (Phases 3-5)"),
        body("Located in src/lib/research-engine/. Modules: signals.ts, evidence.ts, evidence-quality.ts, opportunity-recommendation-engine.ts, signal-capability-matching.ts, signal-meaning.ts, signal-lifecycle.ts, signal-sequence-engine.ts, and freshness-indicators.ts. The engine produces OpportunityRecommendation records with confidence scores. No modifications were made to this layer during Phase 7, confirming the read-only boundary."),
        h3("Trust/Validation Layer (Phase 6-6.1)"),
        body("Six modules in src/lib/: intelligence-confidence.ts (4-dimension confidence), intelligence-health.ts (5-dimension health), signal-validation.ts (4-class signal classification), contradiction-detection.ts (4-type conflict detection), confidence-explainability.ts (positive/negative factors), source-reliability.ts (Bayesian domain reliability), and recommendation-feedback.ts (human feedback loop). All modules are pure functions or thin DB wrappers with no side effects beyond database operations. Phase 7 screens read from this layer through the g-intelligence API endpoints and do not modify any intelligence logic."),
        h3("Revenue Intelligence Experience Layer (Phase 7)"),
        body("Five React components in src/components/screens/ that are pure presentation layers. They fetch data from the g-intelligence API endpoints and render card-based UIs. No writes, no scoring, no data transformation. The only code that could be considered 'logic' is the demo fallback data definitions and the derived KPI computations (filtering and counting from fetched data)."),

        h2("5.2 Technical Debt Assessment"),
        findingTable([
          findingRow("Duplicate Logic", "Demo fallback data duplicated across 5 files", P.amber),
          findingRow("Temporary Implementation", "Dashboard API returns health-centric data, not revenue-centric; Phase 7 screens adapt via client-side transformation", P.amber),
          findingRow("Hardcoded Demo Dependencies", "Demo seed uses Math.random() for health scores and signal assignment, making runs non-deterministic", P.amber),
          findingRow("Phase 7 UI Affecting Intelligence", "No modifications to any lib/ files confirmed", P.green),
          findingRow("Schema Evolution Risk", "confidenceBreakdown and confidenceFactors stored as untyped JSON; no migration path if schema changes", P.amber),
          findingRow("backfillConfidenceBreakdowns Query", "Uses NOT filter that may not match intended semantics (line 154 of intelligence-confidence.ts)", P.red),
        ]),
        spacer(),
        body("The most significant technical debt item is the backfillConfidenceBreakdowns function in intelligence-confidence.ts. The Prisma query at line 154 uses `NOT: [{ confidenceBreakdown: { not: Prisma.DbNull } }]` which is a double-negative that may not behave as intended. The function appears intended to find recommendations where confidenceBreakdown IS null, but the current query logic is convoluted and should be simplified to `{ confidenceBreakdown: null }` during Phase 8."),

        // ═══════════════════════════════════════════════════════
        // 6. DATABASE AND API READINESS
        // ═══════════════════════════════════════════════════════
        h1("6. Database and API Readiness"),
        h2("6.1 Prisma Schema Audit"),
        body("The schema uses PostgreSQL with 20+ models. The six Phase 6/6.1 intelligence models are: SignalValidation (companyId + signalId unique), CompanyIntelligenceHealth (companyId unique), IntelligenceConflict (companyId + conflictType + detectedAt), OpportunityRecommendation (companyId + signalId indexed), RecommendationFeedback (companyId + recommendationId), and EvidenceSourceReliability (domain unique). All models have proper createdAt/updatedAt timestamps and appropriate relations."),

        h2("6.2 API Contract Stability"),
        body("The g-intelligence dispatcher (route.ts) implements a regex-based router with 10 registered routes. All routes use standard HTTP methods (GET/POST/PATCH) with JSON request/response bodies. The API contracts are stable and well-defined. Each endpoint handler includes proper error handling with try/catch blocks and appropriate HTTP status codes (200, 400, 404, 405, 500)."),

        findingTable([
          findingRow("Total API Routes", "10 routes in g-intelligence dispatcher", P.green),
          findingRow("GET Endpoints", "9 (health, evidence-quality, validation-report, confidence, conflicts, dashboard, feedback, trust-report, source-reliability)", P.green),
          findingRow("POST Endpoints", "1 (validate) + 1 (feedback)", P.green),
          findingRow("Error Handling", "All endpoints have try/catch with proper status codes", P.green),
          findingRow("Migration Risk", "No pending migrations; schema is stable", P.green),
          findingRow("Phase 8 Compatibility", "Current API contracts support future enhancements without restructuring", P.green),
        ]),

        // ═══════════════════════════════════════════════════════
        // 7. DEMO DATA VS REAL DATA SEPARATION
        // ═══════════════════════════════════════════════════════
        h1("7. Demo Data vs Real Data Separation"),
        body("Demo data is created through a separate seed script (demo/intelligence-validation-seed.ts) that uses PrismaClient directly. The script creates companies with IDs prefixed with 'demo-' (e.g., 'demo-aramco.com', 'demo-adnoc.ae'). This prefix convention provides clear visual separation from production data."),
        body("The demo seed script creates source reliability records, company records, 3-5 signals per company, 2-4 evidence items per signal, signal validation records, intelligence health records, and random intelligence conflicts. All records are properly linked through foreign keys."),
        body("Demo data does NOT affect production data because: (1) the seed script uses upsert with empty update objects, meaning it only creates records if they do not exist; (2) the demo company IDs are namespaced with 'demo-' prefix; (3) no production logic depends on the presence of demo companies; and (4) the Phase 7 screens only fall back to hardcoded data when API calls fail, not when they return empty results from real data."),

        h2("7.1 Empty State Handling"),
        body("The Revenue Intelligence Dashboard includes an explicit empty state with a TrendingUp icon and the message: 'No accounts analyzed yet. Intelligence data will appear here once accounts are enriched.' This provides clear user guidance instead of a blank screen. The Company Brief, AI Reasoning, and Intelligence Report screens use loading skeletons during fetch and fallback to demo data on error, but they do not have explicit empty-state messages for when real data returns no results. This should be addressed in Phase 8."),

        // ═══════════════════════════════════════════════════════
        // 8. EMPTY STATE AND ERROR HANDLING REVIEW
        // ═══════════════════════════════════════════════════════
        h1("8. Empty State and Error Handling Review"),
        body("A robust application must provide meaningful user guidance when data is missing or API calls fail, rather than showing blank screens or error messages. This section evaluates the current empty state and error handling across the Phase 7 screens and supporting APIs."),

        findingTable([
          findingRow("Dashboard: No Companies", "Explicit empty state with icon and guidance message", P.green),
          findingRow("Dashboard: API Failure", "Silent fallback to demo data (no user notification)", P.amber),
          findingRow("Company Brief: No Data", "Falls back to hardcoded demo data", P.amber),
          findingRow("Company Brief: API Failure", "Falls back to hardcoded demo data (silent)", P.amber),
          findingRow("AI Reasoning: No Data", "Falls back to hardcoded demo data", P.amber),
          findingRow("AI Reasoning: No Factors", "Shows 'No positive factors found' / 'No negative factors found' messages", P.green),
          findingRow("Intelligence Report: No Data", "Falls back to hardcoded demo data", P.amber),
          findingRow("Demo Mode: Always Works", "Pure client-side, no API dependency", P.green),
          findingRow("API: Company Not Found", "Returns 404 with error message", P.green),
          findingRow("API: Health Not Calculated", "Returns 404 with 'Run validation first' message", P.green),
        ]),
        spacer(),
        body("The main gap is that API failures are handled silently with demo data fallback, without informing the user that they are viewing demo data rather than live intelligence. During Phase 8, a subtle banner or indicator should be added to inform users when they are viewing fallback data, so they understand the data is not live. Additionally, the Brief and Report screens should include explicit empty-state messages for scenarios where a company exists but has no intelligence data (no signals, no evidence, no recommendations)."),

        // ═══════════════════════════════════════════════════════
        // 9. SEARCH AND DISCOVERY READINESS
        // ═══════════════════════════════════════════════════════
        h1("9. Search and Discovery Readiness"),
        body("The platform provides multiple mechanisms for discovering high-value accounts. The Revenue Intelligence Dashboard ranks companies by intelligence score and displays the top 8 as priority account cards. The Account Ranking screen (Phase 5) provides a dedicated ranking interface with sorting and filtering capabilities. The Companies screen provides full company list management with search, filter, and sort functionality."),
        body("For finding high-confidence accounts specifically, the Dashboard KPI card 'High-Confidence Opportunities' shows the count of accounts scoring 80+ with high confidence. The card-based layout allows executives to quickly scan and identify accounts requiring attention. The confidence badge (HIGH/MEDIUM/LOW) on each account card provides at-a-glance confidence assessment."),
        body("For finding companies requiring attention, the 'Accounts Requiring Attention' KPI card filters for companies with 8+ active buying signals. The Dashboard also shows an 'Active Intelligence Alerts' count derived from signal volumes and conflict counts. The Demo Mode provides a curated entry point with 5 pre-analyzed ME market companies."),
        body("The search and discovery infrastructure is ready for Phase 8. The key improvement opportunity is adding a global search or command palette entry point that allows users to search across companies by name, industry, or country and jump directly to a Company Brief."),

        // ═══════════════════════════════════════════════════════
        // 10. TESTING AND QUALITY REPORT
        // ═══════════════════════════════════════════════════════
        h1("10. Testing and Quality Report"),
        h2("10.1 Test Execution Results"),
        body("The full test suite was executed using Vitest with verbose reporter. Results as of 21 July 2026:"),

        findingTable([
          findingRow("Total Test Files", "10", P.green),
          findingRow("Total Tests", "505", P.green),
          findingRow("Passed", "489 (96.8%)", P.green),
          findingRow("Failed", "2 (0.4%)", P.amber),
          findingRow("Skipped", "14 (2.8%)", P.secondary),
          findingRow("Duration", "8.74 seconds", P.green),
        ]),
        spacer(),

        h2("10.2 Failure Analysis"),
        body("Both failures are in the same test file (src/lib/__tests__/store.test.ts) and the same test group (useAppStore > setCompanyStatusFilter). The error is: 'TypeError: useAppStore.getState(...).setCompanyStatusFilter is not a function'. This occurs because the Zustand store (src/lib/store.ts) does not define a setCompanyStatusFilter action or a companyStatusFilter state field. The test was written for a store interface that was never implemented or was removed during a prior phase."),
        body("These test failures are pre-existing (documented in the Phase 6.1 closure) and are not caused by any Phase 6 or Phase 7 changes. They represent orphaned tests that reference a store action that does not exist. The fix is straightforward: either remove the two test cases or implement the missing store action."),

        h2("10.3 Build Status"),
        body("The Next.js production build completes successfully with zero TypeScript errors in the build output. All 7 static pages are generated. The build produces a standalone output with proper API route registration for all 8 route groups (api, g-ai, g-auth, g-crm, g-data, g-intelligence, g-outreach, g-strategy, g-system)."),
        body("Pre-existing TypeScript errors exist in non-Phase-6 files (documented in Phase 6.1 closure) but these do not affect the production build because they are in files not imported by the build pipeline."),

        h2("10.4 Deployment Status"),
        body("The project is deployed to Vercel via automatic GitHub integration. Commit a99d612 (Phase 7) is the latest deployed build. The deployment pipeline is: git push to GitHub triggers Vercel auto-deploy. No manual deployment steps are required. Rollback capability is available through Vercel's deployment history."),

        // ═══════════════════════════════════════════════════════
        // 11. PERFORMANCE BASELINE
        // ═══════════════════════════════════════════════════════
        h1("11. Performance Baseline"),
        body("The following performance measurements establish a baseline before Phase 8 optimization work. All Phase 7 screens use lazy loading via React.lazy(), which means initial page load only includes the Revenue Intelligence Dashboard (the default screen), and other screens are loaded on demand."),

        findingTable([
          findingRow("Build Time", "~15 seconds (full production build)", P.green),
          findingRow("Static Page Generation", "230.6ms for 7 pages", P.green),
          findingRow("Test Suite Duration", "8.74 seconds (505 tests)", P.green),
          findingRow("Phase 7 JS Bundle (estimated)", "2,862 lines across 5 components, lazy-loaded", P.green),
          findingRow("API Response Time (dashboard)", "Depends on DB size; uses parallel Promise.all", P.amber),
          findingRow("API Response Time (trust-report)", "Sequential DB queries; potential N+1 in confidence-explainability.ts", P.amber),
          findingRow("Demo Mode Load Time", "Instant (100ms artificial delay + pure client-side)", P.green),
        ]),
        spacer(),
        body("The main performance concern is in confidence-explainability.ts, which contains a sequential loop over evidence domains to check source reliability (lines 177-189). For each domain, it performs a separate database query (db.evidenceSourceReliability.findUnique). If a company has evidence from many distinct domains, this creates an N+1 query pattern. For the demo dataset (5 domains), this is negligible, but for production scale it should be batched into a single query during Phase 8."),
        body("The dashboard API (dashboard.ts) uses parallel Promise.all for 5 independent queries, which is the correct pattern. The validation-report API (validation-report.ts) also uses Promise.all for 4 parallel queries. These are well-optimized."),

        // ═══════════════════════════════════════════════════════
        // 12. SECURITY AND DEPLOYMENT BASELINE
        // ═══════════════════════════════════════════════════════
        h1("12. Security and Deployment Baseline"),
        h2("12.1 Environment Variables"),
        body("The application uses standard Next.js environment variable configuration. The DATABASE_URL is stored as an environment variable and accessed through Prisma. The validate-env.ts module provides environment variable validation at startup. The ZAI configuration (zai-config.ts) manages platform-specific settings. No sensitive credentials were found hardcoded in the source code during this audit."),

        h2("12.2 API Exposure"),
        body("All API routes follow the /api/g-* namespace convention, with 8 route groups. The intelligence API (g-intelligence) is properly scoped with 10 routes behind a regex-based dispatcher. All endpoints use NextRequest/NextResponse with proper error boundaries. The API does not implement authentication middleware on the intelligence endpoints, which is acceptable given the current single-user deployment model but should be noted for future multi-user scenarios."),

        h2("12.3 Database Connection"),
        body("Prisma Client is instantiated once via src/lib/db.ts and reused across all API routes and library modules. The connection uses the PostgreSQL provider as defined in the Prisma schema. Connection pooling is handled by the Prisma engine (not pg-pool), which is the standard approach for serverless deployments on Vercel."),

        h2("12.4 Deployment Process"),
        body("Deployment is fully automated: code is committed to GitHub, which triggers a Vercel build and deploy. The build process runs: install dependencies, generate Prisma client, run Next.js production build, output standalone server. No manual steps are required. The deployment is configured as a serverless Next.js application on Vercel's infrastructure."),

        h2("12.5 Migration and Rollback"),
        body("Prisma migrations are managed through the standard prisma migrate workflow. No pending migrations exist at the time of this audit. Rollback is available through two mechanisms: (1) Vercel deployment history allows instant rollback to any previous deployment, and (2) Prisma migrate supports rollback to previous migration states. The demo seed script uses upsert operations, so re-running it is idempotent and safe."),

        // ═══════════════════════════════════════════════════════
        // 13. DOCUMENTATION: PRODUCT ARCHITECTURE
        // ═══════════════════════════════════════════════════════
        h1("13. Product Architecture: Phases 1-7"),
        h2("13.1 Overall Architecture"),
        body("The Revenue Intelligence Platform is a full-stack Next.js application with PostgreSQL persistence, Prisma ORM, Zustand state management, Tailwind CSS styling, and shadcn/ui component library. The architecture follows a layered pattern: Data Foundation, Intelligence Engine, Trust/Validation Layer, and Experience Layer. Communication between layers occurs through well-defined API contracts and shared library modules."),

        h2("13.2 Phase-by-Phase Summary"),
        h3("Phase 1: Data Foundation"),
        body("Company and contact management with bulk import, deduplication, normalization, and data quality scoring. Core models: Company, Contact, ImportBatch. Key screens: Companies, Contacts, Import, Duplicates."),
        h3("Phase 2: Data Intelligence"),
        body("Column detection, normalization rules, quality scoring, and data health monitoring. Core module: src/lib/data-intelligence/. Key screen: Data Health."),
        h3("Phase 3: Signal Intelligence"),
        body("Buying signal detection, evidence collection, signal lifecycle management, and signal meaning interpretation. Core models: CompanySignal, Evidence. Key modules: src/lib/research-engine/signals.ts, evidence.ts. Key screen: Signal Intelligence."),
        h3("Phase 4: AI-Powered Capabilities"),
        body("Capability library management, playbooks, conversation studio, and research agent. Core models: Capability, Playbook, ConversationPlan. Key screens: Capabilities, Playbooks, Conversation Studio, Research Agent."),
        h3("Phase 5: Revenue Intelligence Engine"),
        body("Account ranking, opportunity recommendations, capability matching, ICP profiling, pursuit tracking, and strategy room. Core models: OpportunityRecommendation. Key modules: src/lib/research-engine/opportunity-recommendation-engine.ts, signal-capability-matching.ts. Key screens: Account Ranking, Opportunity Workspace, Pursuit Tracker, Strategy Room, ICP Settings."),
        h3("Phase 6: Intelligence Governance"),
        body("Intelligence health scoring, signal validation, contradiction detection, confidence scoring, validation reporting, trust reporting, and dashboard. Core models: SignalValidation, CompanyIntelligenceHealth, IntelligenceConflict. Key modules: intelligence-confidence.ts, intelligence-health.ts, signal-validation.ts, contradiction-detection.ts. Key screen: Intelligence Health."),
        h3("Phase 6.1: Trust Hardening"),
        body("Confidence explainability (positive/negative factors), evidence source reliability (Bayesian scoring), recommendation feedback loop, and trust score modal UI. Core models: EvidenceSourceReliability, RecommendationFeedback. Key modules: confidence-explainability.ts, source-reliability.ts, recommendation-feedback.ts."),
        h3("Phase 7: Revenue Intelligence Experience Layer"),
        body("Five executive-grade screens that transform existing intelligence output into an actionable decision-making experience. Pure presentation layer with zero writes to intelligence models. Screens: Revenue Intelligence Dashboard, Company Intelligence Brief, AI Reasoning, Intelligence Report, Demo Experience Mode. Total: 2,862 lines of new code across 6 files."),

        h2("13.3 Data Flow"),
        body("Company creation triggers signal detection, which produces CompanySignal records. Signals reference Evidence records through evidenceIds JSON arrays. The opportunity recommendation engine matches signals against capabilities to produce OpportunityRecommendation records with matchScore. The confidence engine computes a 4-dimension breakdown (Signal Quality 30%, Evidence Quality 30%, Capability Fit 25%, Data Completeness 15%) stored as JSON on recommendations. The validation pipeline (signal validation, contradiction detection, health computation) enriches the intelligence graph. The experience layer reads from all these sources and presents them in executive-friendly card-based UIs."),

        h2("13.4 Core Models"),
        body("The six intelligence-specific models introduced in Phases 6-6.1: SignalValidation (signal-level trust classification), CompanyIntelligenceHealth (company-level 5-dimension health score), IntelligenceConflict (detected contradictions between signals), OpportunityRecommendation (opportunities with confidence breakdown and factors), RecommendationFeedback (human validation decisions), and EvidenceSourceReliability (per-domain Bayesian reliability scores). These models are interconnected through companyId and signalId foreign keys."),

        h2("13.5 API Map"),
        body("The g-intelligence API dispatcher handles 10 routes: GET companies/[id]/health, GET companies/[id]/evidence-quality, GET companies/[id]/validation-report, POST companies/[id]/validate, GET companies/[id]/confidence, GET conflicts, GET dashboard, GET/POST companies/[id]/feedback, GET recommendations/[id]/trust-report, GET source-reliability. Each route is a separate handler module imported into the dispatcher."),

        h2("13.6 Current Limitations"),
        bullet("No authentication on intelligence API endpoints (acceptable for current single-user deployment)"),
        bullet("Demo data duplicated across 5 screen files (consistency risk in fallback mode)"),
        bullet("backfillConfidenceBreakdowns query has convoluted double-negative Prisma filter"),
        bullet("confidence-explainability.ts has N+1 query pattern for source reliability lookups"),
        bullet("Zustand store ViewId type does not include Phase 7 screen keys"),
        bullet("Demo seed script uses Math.random() for non-deterministic results"),
        bullet("confidenceBreakdown and confidenceFactors stored as untyped JSON (no schema enforcement)"),
        bullet("No explicit 'viewing demo data' indicator when screens fall back to hardcoded data"),

        h2("13.7 Future Roadmap Boundaries"),
        body("Phase 8 will focus on UI/UX refinement, complete testing, and final demo readiness. The following items are explicitly excluded from all future phases: CRM integration, pipeline management, forecasting, outreach automation, marketing automation, multi-tenancy, RBAC, billing, new intelligence models, and new scoring algorithms. The architecture is designed to support these as optional future additions without requiring restructuring of the existing intelligence pipeline."),

        // ═══════════════════════════════════════════════════════
        // 14. FINAL RECOMMENDATION
        // ═══════════════════════════════════════════════════════
        h1("14. Final Recommendation"),

        h2("14.1 Verdict"),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 300, after: 300, line: 312 },
          children: [new TextRun({ text: "YES \u2014 The product foundation is ready for Phase 8.", bold: true, font: "Times New Roman", size: 32, color: c(P.green) })],
        }),
        body("The Phase 1-7 product foundation is structurally sound, properly connected, and stable. The 10-stage intelligence pipeline is intact from company creation through executive reporting. All Phase 7 screens are properly wired into the navigation and API layer. The build is clean, deployment is automated, and 96.8% of tests pass. The identified issues are refinements, not blockers."),

        h2("14.2 Must Fix Before Phase 8"),
        bullet("Add Phase 7 screen keys to the Zustand store ViewId union type for type safety"),
        bullet("Fix the backfillConfidenceBreakdowns Prisma query (simplify double-negative to null check)"),
        bullet("Remove or update the 2 failing store.test.ts tests to match the actual store interface"),

        h2("14.3 Should Address During Phase 8"),
        bullet("Extract demo fallback data into a single shared module (src/lib/demo-data.ts) to eliminate duplication"),
        bullet("Add a subtle 'Demo Data' indicator banner when screens fall back to hardcoded data"),
        bullet("Add explicit empty-state messages to Company Brief and Intelligence Report for companies with no intelligence data"),
        bullet("Batch the N+1 source reliability queries in confidence-explainability.ts"),
        bullet("Replace Math.random() in demo seed with deterministic values for reproducible demos"),
        bullet("Add unit tests for Phase 7 screens (currently 0 tests for the 5 new components)"),
        bullet("Consider adding TypeScript interfaces for confidenceBreakdown and confidenceFactors JSON schemas"),

        h2("14.4 What Should NOT Be Changed"),
        bullet("The 4-layer architecture (Data Foundation, Intelligence Engine, Trust Layer, Experience Layer) is correct and should be preserved as-is"),
        bullet("The g-intelligence API dispatcher pattern with regex-based routing is clean and should not be replaced"),
        bullet("The 4-dimension confidence model weights (30/30/25/15) are well-calibrated and should not be changed without new evidence"),
        bullet("The signal validation 4-class classification system (VALID/WEAK/CONFLICTING/EXPIRED) is robust and should be preserved"),
        bullet("The contradiction detection 4-type system (SIGNAL_CONTRADICTION/TECHNOLOGY_CONFLICT/FUNDING_CONFLICT/EVIDENCE_CONTRADICTION) covers the main conflict patterns"),
        bullet("The Phase 7 read-only boundary (zero writes to intelligence models) must be maintained permanently"),
        bullet("The demo seed company ID convention ('demo-' prefix) should be preserved for clear namespace separation"),
        bullet("The card-based UI approach for Phase 7 screens should be maintained and refined, not replaced with table-based layouts"),
      ],
    },
  ],
});

// ── Generate ──
Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync("/home/z/my-project/download/Phase_1-7_Product_Readiness_Audit.docx", buf);
  console.log("Report generated: /home/z/my-project/download/Phase_1-7_Product_Readiness_Audit.docx");
});