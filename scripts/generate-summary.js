const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, PageNumber, AlignmentType, HeadingLevel, WidthType,
  BorderStyle, ShadingType,
} = require("docx");
const fs = require("fs");

// Palette: Tech / AI
const P = {
  primary: "#0A1628",
  body: "000000",
  secondary: "506070",
  accent: "#5B8DB8",
  surface: "#F4F8FC",
};
const c = (hex) => hex.replace("#", "");

const allNoBorders = {
  top: { style: BorderStyle.NONE },
  bottom: { style: BorderStyle.NONE },
  left: { style: BorderStyle.NONE },
  right: { style: BorderStyle.NONE },
};

function heading1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 160, line: 312 },
    children: [
      new TextRun({ text, bold: true, font: { ascii: "Calibri", eastAsia: "SimHei" }, size: 32, color: c(P.primary) }),
    ],
  });
}

function heading2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 120, line: 312 },
    children: [
      new TextRun({ text, bold: true, font: { ascii: "Calibri", eastAsia: "SimHei" }, size: 28, color: c(P.primary) }),
    ],
  });
}

function body(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    indent: { firstLine: 480 },
    spacing: { line: 312, after: 80 },
    children: [
      new TextRun({ text, size: 24, font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" }, color: P.body }),
    ],
  });
}

function bodyNoIndent(text) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { line: 312, after: 60 },
    children: [
      new TextRun({ text, size: 24, font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" }, color: P.body }),
    ],
  });
}

function bullet(text) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    indent: { left: 720, hanging: 240 },
    spacing: { line: 312, after: 40 },
    children: [
      new TextRun({ text: "\u2022  ", size: 24, color: P.body }),
      new TextRun({ text, size: 24, font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" }, color: P.body }),
    ],
  });
}

function makeTableRow(cells, isHeader = false) {
  return new TableRow({
    tableHeader: isHeader,
    cantSplit: true,
    children: cells.map((text) =>
      new TableCell({
        width: { size: 100 / cells.length, type: WidthType.PERCENTAGE },
        margins: { top: 50, bottom: 50, left: 100, right: 100 },
        shading: isHeader ? { type: ShadingType.CLEAR, fill: c(P.surface) } : undefined,
        children: [
          new Paragraph({
            spacing: { line: 280 },
            children: [
              new TextRun({
                text,
                size: 21,
                bold: isHeader,
                font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" },
                color: P.body,
              }),
            ],
          }),
        ],
      })
    ),
  });
}

function makeTable(headers, rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: "B0BEC5" },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: "B0BEC5" },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "D0D0D0" },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [
      makeTableRow(headers, true),
      ...rows.map((r) => makeTableRow(r, false)),
    ],
  });
}

function tableCaption(text) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { before: 60, after: 160, line: 312 },
    children: [
      new TextRun({ text, size: 21, italics: true, color: c(P.secondary), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } }),
    ],
  });
}

// Build document
const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" }, size: 24, color: P.body },
        paragraph: { spacing: { line: 312 } },
      },
      heading1: {
        run: { font: { ascii: "Calibri", eastAsia: "SimHei" }, size: 32, bold: true, color: c(P.primary) },
        paragraph: { spacing: { before: 360, after: 160, line: 312 } },
      },
      heading2: {
        run: { font: { ascii: "Calibri", eastAsia: "SimHei" }, size: 28, bold: true, color: c(P.primary) },
        paragraph: { spacing: { before: 280, after: 120, line: 312 } },
      },
    },
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [
                new TextRun({ text: "DeepMindQ Revenue Intelligence Platform", size: 18, color: "888888", font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } }),
              ],
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "888888" })],
            }),
          ],
        }),
      },
      children: [
        // Title
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 80, line: 312 },
          children: [
            new TextRun({ text: "DeepMindQ Revenue Intelligence Platform", bold: true, size: 36, font: { ascii: "Calibri", eastAsia: "SimHei" }, color: c(P.primary) }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 60, line: 312 },
          children: [
            new TextRun({ text: "Conversation History Summary", size: 26, font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" }, color: c(P.secondary) }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 320, line: 312 },
          children: [
            new TextRun({ text: "Phase 0 \u2013 Phase 6 Implementation & Validation Review", size: 22, font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" }, color: c(P.secondary) }),
          ],
        }),

        // 1. Platform Overview
        heading1("1. Platform Overview"),
        body("The DeepMindQ Revenue Intelligence Platform is a dedicated-instance (single-tenant) system designed for the IT Services & Consulting vertical. It provides an end-to-end intelligence pipeline that transforms raw market signals into actionable revenue opportunities, without multi-tenancy complexity. The platform spans seven development phases (Phase 0 through Phase 6), each building a discrete capability layer that integrates into a cohesive intelligence chain."),

        body("The core architectural principle is a read-only intelligence chain\u2014Signal \u2192 Meaning \u2192 Capability Fit \u2192 Opportunity \u2192 Human Decision \u2192 Pursuit Intel\u2014that preserves human agency at the decision point while automating upstream data processing and scoring. The system is explicitly not a CRM and contains no outbound automation capabilities, maintaining strict boundaries around its role as an intelligence layer."),

        // 2. Key Technical Specifications
        heading1("2. Key Technical Specifications"),

        heading2("2.1 Scoring Engine (Phase 5)"),
        body("The account prioritization engine uses a weighted composite score formula that produces a single numeric priority value for each account. The formula is deterministic, database-driven, and requires zero LLM calls at computation time. The scoring components are combined as follows:"),

        bodyNoIndent("Formula: clamp(round(StaticFit \u00d7 0.40 + DynamicIntel \u00d7 0.40 + TimingUrgency \u00d7 0.20), 0, 100)"),

        makeTable(
          ["Tier", "Score Range", "Interpretation"],
          [
            ["HOT", "\u2265 90", "Immediate pursuit recommended"],
            ["ACTIVE", "70 \u2013 89", "Active engagement warranted"],
            ["NURTURE", "50 \u2013 69", "Long-term cultivation"],
            ["LOW", "< 50", "Deprioritize or monitor"],
          ]
        ),
        tableCaption("Table 1: Priority Tier Definitions"),

        heading2("2.2 ICP Configuration"),
        body("The Ideal Customer Profile (ICP) configuration layer defines the target market with precision: 16 industries, 6 company size ranges, 11 geographic regions, 20 technology keywords for capability matching, 5 exclusion criteria, and 5 weighted sub-dimensions for fit scoring. The ICP config is lazily loaded from the database with a weight-sum validation check and graceful fallback to default values when the configuration is missing or incomplete."),

        heading2("2.3 AI Governance Model"),
        body("A centralized governance layer ensures all AI interactions are controlled and auditable. The file ai-governance.ts is the single import point for the callLLM function; no other route or module may import the LLM utility directly. All AI-dependent routes use the governedAICall() wrapper, which applies rate limiting, content filtering, prompt validation, and audit logging before any LLM request is executed."),

        // 3. Phase Summary
        heading1("3. Phase-by-Phase Implementation Summary"),

        makeTable(
          ["Phase", "Focus Area", "Key Deliverable", "Status"],
          [
            ["Phase 0", "Foundation & Architecture", "Project scaffolding, DB schema, core data models", "Completed"],
            ["Phase 1", "Data Ingestion & Signal Collection", "Company data pipelines, signal capture mechanisms", "Completed"],
            ["Phase 2", "Intelligence Processing", "Signal-to-meaning transformation engine", "Completed"],
            ["Phase 3", "Capability Fit Analysis", "Service-to-account matching algorithms", "Completed"],
            ["Phase 4", "Opportunity Identification", "Opportunity scoring and ranking logic", "Completed"],
            ["Phase 5", "Account Prioritization", "Composite scoring engine with tier classification", "Completed"],
            ["Phase 6", "Validation & Quality Assurance", "Zero-LLM validation layer, 5 artifact types", "Completed"],
          ]
        ),
        tableCaption("Table 2: Phase Implementation Status"),

        // 4. Core Architecture
        heading1("4. Core Architecture & Data Flow"),

        heading2("4.1 Data Model Changes"),
        body("The Prisma schema was extended with three new fields on the Company model: accountPriorityScore (Float, nullable), priorityTier (String, nullable), and priorityComputedAt (DateTime, nullable). A composite index on priorityTier was added for query performance. A new SystemSetting model was introduced with a cuid() primary key and a unique key constraint for configuration storage, supporting the ICP profile and other system-level settings."),

        heading2("4.2 API Endpoints"),
        body("Nine API routes were implemented under the /api/g-strategy/ path to support the platform's operations. These endpoints cover rankings retrieval (GET/POST), single-account priority computation (GET/POST), ICP profile management (GET/PUT), validation operations (POST/GET), and quality reporting (GET). All endpoints follow RESTful conventions and integrate with the governance layer where AI interaction is required."),

        heading2("4.3 Key Engine Files"),
        makeTable(
          ["File", "Lines", "Responsibility"],
          [
            ["account-prioritization.ts", "~1,117", "Phase 5 engine: computeAccountPriority(), batch compute, rankings, why-now reasons (14 rules, max 8), signal ranking, capability matching, static/dynamic/timing sub-scores"],
            ["intelligence-validation.ts", "~660", "Phase 6 engine: zero-LLM validation, 5 artifact types, quality checks"],
            ["ai-governance.ts", "Central", "Single LLM import point, governedAICall() wrapper"],
          ]
        ),
        tableCaption("Table 3: Core Engine Files"),

        // 5. Validation Evidence
        heading1("5. Validation Evidence & Quality Assurance"),

        heading2("5.1 Formula Integrity (Phase 5)"),
        body("The scoring formula was verified for correctness across multiple dimensions. Weight coefficients sum to exactly 1.0 (0.40 + 0.40 + 0.20), ensuring no scaling bias. The clamp function enforces hard bounds of [0, 100] on all outputs. Tier boundaries have zero gaps (HOT \u2265 90, ACTIVE 70\u201389, NURTURE 50\u201369, LOW < 50), and Math.round is applied to produce integer scores. The entire data flow is 100% database-driven with zero mock data or hardcoded values."),

        heading2("5.2 Schema Validation"),
        body("The Prisma schema additions were validated for correctness: all new fields use nullable types without defaults (preventing accidental data corruption), and the @@index([priorityTier]) directive ensures efficient tier-based queries. The SystemSetting model uses cuid() for primary key generation with a @unique constraint on the key field, enabling reliable upsert operations."),

        heading2("5.3 Boundary Guarantees"),
        body("Three critical architectural boundaries were confirmed intact throughout the implementation. First, intelligenceScore and accountPriorityScore are maintained as separate fields with distinct computation paths. Second, the platform contains no outbound automation\u2014it is a read-only intelligence layer. Third, the system is explicitly not a CRM, avoiding deal pipeline management, contact tracking, or activity logging features that would blur its scoped purpose."),

        // 6. Issues & Resolutions
        heading1("6. Issues Encountered & Resolutions"),
        body("A single significant issue was encountered during development: a git divergence between the local repository (4 commits) and the remote repository (90 commits). This was resolved by performing a git reset --hard origin/main to align the local branch with the remote, restoring critical Phase 5 files from a temporary backup directory (/tmp/phase5-backup/), and executing a clean push. No other user-reported errors or blocking issues were recorded across the seven development phases."),

        // 7. Pending Work
        heading1("7. Outstanding Deliverables"),
        body("A comprehensive Phase 0\u20136 Closure Report was requested but not yet generated. This report was specified to include seven phase-level sections (each with six subsections: Phase Objective, Implementation Evidence, Functional Validation, Business Intelligence Validation, Current Status, and Production Readiness) plus three final summary sections covering the complete platform architecture flow, a final capability matrix, and remaining gaps for enterprise positioning. This deliverable remains the primary outstanding item before the platform can be considered fully closed."),

        // 8. Key Design Decisions
        heading1("8. Key Design Decisions Reference"),
        bullet("Dedicated-instance architecture: No multi-tenancy, ensuring data isolation and simplified compliance."),
        bullet("IT Services & Consulting vertical focus: All ICP defaults, scoring weights, and capability categories tuned for this sector."),
        bullet("Read-only intelligence chain: Signal \u2192 Meaning \u2192 Capability Fit \u2192 Opportunity \u2192 Human Decision \u2192 Pursuit Intel."),
        bullet("Centralized AI governance: Single import point (ai-governance.ts) with governedAICall() enforcement."),
        bullet("Score separation: intelligenceScore (raw intelligence quality) vs. accountPriorityScore (go-to-market priority)."),
        bullet("Zero-LLM validation (Phase 6): Deterministic quality checks independent of AI model availability."),
        bullet("14 why-now rules with max-8 selection: Prevents signal overload while ensuring relevance."),
      ],
    },
  ],
});

const OUTPUT = "/home/z/my-project/download/DeepMindQ_Conversation_Summary.docx";
Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(OUTPUT, buf);
  console.log("Generated: " + OUTPUT);
});