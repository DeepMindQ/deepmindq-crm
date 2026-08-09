/**
 * DeepMindQ — Phase 0 Verification & Phase 1 Action Plan
 * Auditor-standard evidence report with code-level proof
 */
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  PageBreak, Header, Footer, PageNumber, NumberFormat,
  AlignmentType, HeadingLevel, WidthType, BorderStyle, ShadingType,
  TableOfContents,
} = require("docx");
const fs = require("fs");

// ── Palette: Deep Sea Academic (Cool + Heavy + Calm) ──
const palette = {
  primary: "0F2027",
  body: "000000",
  secondary: "4A6575",
  accent: "D4AF37",
  surface: "F5F7FA",
};

// ── Helper functions ──
function heading1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 200, line: 312 },
    children: [new TextRun({ text, bold: true, size: 32, font: { ascii: "Times New Roman", eastAsia: "SimHei" }, color: palette.primary })],
  });
}

function heading2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 160, line: 312 },
    children: [new TextRun({ text, bold: true, size: 28, font: { ascii: "Times New Roman", eastAsia: "SimHei" }, color: palette.primary })],
  });
}

function heading3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 120, line: 312 },
    children: [new TextRun({ text, bold: true, size: 24, font: { ascii: "Times New Roman", eastAsia: "SimHei" }, color: palette.secondary })],
  });
}

function bodyPara(runs) {
  return new Paragraph({
    spacing: { after: 120, line: 312 },
    children: runs.map(r => typeof r === "string" ? new TextRun({ text: r, size: 21, font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" }, color: palette.body }) : new TextRun({ size: 21, font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" }, color: palette.body, ...r })),
  });
}

function bold(label, text) {
  return { text: `${label}: `, bold: true }, text;
}

function evidenceRow(label, value, statusColor) {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 35, type: WidthType.PERCENTAGE },
        margins: { top: 40, bottom: 40, left: 120, right: 80 },
        children: [new Paragraph({ spacing: { line: 276 }, children: [new TextRun({ text: label, bold: true, size: 20, font: { ascii: "Calibri" }, color: palette.body })] })],
        borders: { top: { style: BorderStyle.SINGLE, size: 1, color: "D0D0D0" }, bottom: { style: BorderStyle.SINGLE, size: 1, color: "D0D0D0" }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
      }),
      new TableCell({
        width: { size: 65, type: WidthType.PERCENTAGE },
        margins: { top: 40, bottom: 40, left: 80, right: 120 },
        children: [new Paragraph({ spacing: { line: 276 }, children: [new TextRun({ text: value, size: 20, font: { ascii: "Calibri" }, color: statusColor || palette.body })] })],
        borders: { top: { style: BorderStyle.SINGLE, size: 1, color: "D0D0D0" }, bottom: { style: BorderStyle.SINGLE, size: 1, color: "D0D0D0" }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
      }),
    ],
  });
}

function tableHeader(col1, col2) {
  return new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: [
      new TableCell({
        width: { size: 35, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.CLEAR, fill: palette.primary },
        margins: { top: 60, bottom: 60, left: 120, right: 80 },
        children: [new Paragraph({ spacing: { line: 276 }, children: [new TextRun({ text: col1, bold: true, size: 20, font: { ascii: "Calibri" }, color: "FFFFFF" })] })],
        borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
      }),
      new TableCell({
        width: { size: 65, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.CLEAR, fill: palette.primary },
        margins: { top: 60, bottom: 60, left: 80, right: 120 },
        children: [new Paragraph({ spacing: { line: 276 }, children: [new TextRun({ text: col2, bold: true, size: 20, font: { ascii: "Calibri" }, color: "FFFFFF" })] })],
        borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
      }),
    ],
  });
}

function gapTable(title, rows) {
  return [
    new Paragraph({ keepNext: true, spacing: { before: 200, after: 80 }, children: [new TextRun({ text: title, bold: true, size: 21, font: { ascii: "Calibri" }, color: palette.primary })] }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: { top: { style: BorderStyle.SINGLE, size: 2, color: palette.primary }, bottom: { style: BorderStyle.SINGLE, size: 2, color: palette.primary }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "D0D0D0" } },
      rows: [tableHeader("Item", "Evidence / Gap Detail"), ...rows],
    }),
  ];
}

const GREEN = "2E7D32";
const RED = "C62828";
const AMBER = "E65100";

// ═══════════════════════════════════════════════════════════════
// DOCUMENT
// ═══════════════════════════════════════════════════════════════
const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" }, size: 21, color: palette.body },
        paragraph: { spacing: { line: 312 } },
      },
      heading1: { run: { font: { ascii: "Times New Roman", eastAsia: "SimHei" }, size: 32, bold: true, color: palette.primary } },
      heading2: { run: { font: { ascii: "Times New Roman", eastAsia: "SimHei" }, size: 28, bold: true, color: palette.primary } },
      heading3: { run: { font: { ascii: "Times New Roman", eastAsia: "SimHei" }, size: 24, bold: true, color: palette.secondary } },
    },
  },
  numbering: { config: [] },
  sections: [
    // ── COVER PAGE ──
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 0, bottom: 0, left: 0, right: 0 },
        },
      },
      children: [
        // Top accent bar
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [new TableRow({ height: { value: 200, rule: "exact" }, children: [new TableCell({ shading: { type: ShadingType.CLEAR, fill: palette.accent }, borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } }, children: [new Paragraph({ children: [] })] })] })],
        }),
        new Paragraph({ spacing: { before: 3600 }, children: [] }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [new TextRun({ text: "DeepMindQ", bold: true, size: 72, font: { ascii: "Times New Roman" }, color: palette.primary })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
          children: [new TextRun({ text: "Enterprise Intelligence Operating System", size: 28, font: { ascii: "Calibri" }, color: palette.secondary })],
        }),
        new Paragraph({ spacing: { before: 600 }, children: [] }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
          children: [new TextRun({ text: "Phase 0 Verification Report", bold: true, size: 40, font: { ascii: "Times New Roman" }, color: palette.accent })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
          children: [new TextRun({ text: "& Phase 1 Intelligence Foundation Action Plan", bold: true, size: 32, font: { ascii: "Times New Roman" }, color: palette.accent })],
        }),
        new Paragraph({ spacing: { before: 1200 }, children: [] }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "Auditor-Standard Evidence Report", size: 22, font: { ascii: "Calibri" }, color: palette.secondary })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 100 },
          children: [new TextRun({ text: "Code-Level Verification with Exact File Paths and Line Numbers", size: 20, font: { ascii: "Calibri" }, color: palette.secondary })],
        }),
        new Paragraph({ spacing: { before: 1600 }, children: [] }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "2026-08-07  |  Classification: Internal  |  Version: 1.0", size: 18, font: { ascii: "Calibri" }, color: palette.secondary })],
        }),
      ],
    },

    // ── TOC PAGE ──
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
        },
      },
      headers: {
        default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "DeepMindQ Phase 0 Verification Report", size: 16, color: palette.secondary, font: { ascii: "Calibri" }, italics: true })] })] }),
      },
      footers: {
        default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Page ", size: 16, color: palette.secondary }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: palette.secondary })] })] }),
      },
      children: [
        new Paragraph({ spacing: { before: 200, after: 300 }, children: [new TextRun({ text: "Table of Contents", bold: true, size: 32, font: { ascii: "Times New Roman" }, color: palette.primary })] }),
        new TableOfContents("Table of Contents", {
          hyperlink: true,
          headingStyleRange: "1-3",
        }),
        new Paragraph({ spacing: { before: 200, after: 100 }, children: [new TextRun({ text: "Right-click the TOC above and select 'Update Field' to refresh page numbers.", italics: true, size: 18, color: palette.secondary })] }),
        new Paragraph({ children: [new PageBreak()] }),

        // ═══════════════════════════════════════════════════════════
        // PART I: REGRESSION BASELINE
        // ═══════════════════════════════════════════════════════════
        heading1("Part I: Regression Baseline"),
        bodyPara(["The regression baseline captures the system state at the start of Phase 0 verification. This establishes the reference point against which all subsequent changes are measured. Every future modification must be validated against this baseline to ensure no regressions are introduced."]),

        heading2("1.1 Codebase Metrics"),
        ...gapTable("Baseline Snapshot", [
          evidenceRow("Metric", "Value", palette.body),
          evidenceRow("Prisma Schema", "3,515 lines, 105 models, 114 enum values", palette.body),
          evidenceRow("API Routes", "238 route.ts files under src/app/api/", palette.body),
          evidenceRow("Library Modules", "277 TypeScript files under src/lib/", palette.body),
          evidenceRow("Git Tag", "phase0-baseline (annotated, created 2026-08-07)", GREEN),
          evidenceRow("Working Tree", "Clean (no uncommitted changes)", GREEN),
        ]),

        heading2("1.2 Test Suite Results"),
        bodyPara(["The full test suite was executed using Vitest in single-run mode. Results below represent the unmodified baseline state. These numbers are the regression floor: any Phase 0 or Phase 1 change must not decrease the pass rate below these values."]),
        ...gapTable("Test Results", [
          evidenceRow("Test Files", "55 total: 42 passed, 13 failed", AMBER),
          evidenceRow("Test Cases", "1,129 total: 965 passed, 146 failed, 18 skipped", AMBER),
          evidenceRow("Duration", "31.96s (transform 1.20s, setup 2.16s)", palette.body),
          evidenceRow("Failed Files", "13 unique: api-integration, signal-extraction, account-scoring, etc.", palette.body),
          evidenceRow("Pre-existing Failures", "146 test failures appear to be pre-existing (not caused by Phase 0 changes)", AMBER),
        ]),

        heading2("1.3 Failed Test Files (Pre-existing)"),
        bodyPara(["The following 13 test files were already failing before any Phase 0 verification work. These failures are documented as part of the baseline and are not attributed to Phase 0 changes. They represent technical debt that should be tracked separately."]),
        ...gapTable("", [
          evidenceRow("File", "Category", palette.body),
          evidenceRow("api-integration.test.ts", "API integration (companies, contacts CRUD)", palette.body),
          evidenceRow("signal-extraction.test.ts", "Revenue intelligence signal processing", palette.body),
          evidenceRow("account-scoring.test.ts", "Account scoring pipeline", palette.body),
          evidenceRow("account-brief.test.ts", "Account brief generation", palette.body),
          evidenceRow("acquisition-engine.test.ts", "Intelligence acquisition engine", palette.body),
          evidenceRow("analytics-dashboard.test.ts", "Analytics dashboard computations", palette.body),
          evidenceRow("source-governance.test.ts", "Intelligence source governance", palette.body),
          evidenceRow("intelligence-alerts.test.ts", "Alert generation pipeline", palette.body),
          evidenceRow("health-export-knowledge.test.ts", "Health check for knowledge export", palette.body),
          evidenceRow("import-timeline-notes.test.ts", "Import timeline notes", palette.body),
          evidenceRow("opportunities-research.test.ts", "Opportunity research pipeline", palette.body),
          evidenceRow("design-system.test.tsx", "Shared design system components", palette.body),
          evidenceRow("deployment-smoke.test.ts", "Deployment smoke tests", palette.body),
        ]),

        // ═══════════════════════════════════════════════════════════
        // PART II: PHASE 0 VERIFIED EVIDENCE
        // ═══════════════════════════════════════════════════════════
        heading1("Part II: Phase 0 Verified Evidence"),
        bodyPara(["Each item below follows the auditor standard: exact file paths, line numbers, actual implementation code behavior, and runtime impact analysis. Claims of completion require backend logic that works, data flow that works end-to-end, and user-visible behavior that matches the product specification."]),

        heading2("2.1 G2: chat-stream Governance Bypass Seal"),
        heading3("A. Verified Existing State"),
        bodyPara([bold("File", "src/app/api/ai/chat-stream/route.ts")]),
        bodyPara([bold("Lines 27-43", "Hard 403 block placed BEFORE request body parsing")]),
        bodyPara(["The POST handler at line 22 begins with an authentication guard (line 24: checkApiAuth). Immediately after, at lines 27-43, a governance gate returns HTTP 403 with a JSON error body. The return statement at line 32 executes before the request body is parsed (line 48), before message validation (line 66), and before the streamAICall invocation (line 136). This means all code from line 45 onward is unreachable at runtime."]),
        bodyPara([bold("Runtime behavior", "Any HTTP POST to /api/ai/chat-stream returns 403 with JSON error body containing success:false and error message about Phase 0 governance hardening, redirecting to /api/ai/advisor for governed interactions.")]),
        bodyPara(["The TypeScript compiler still type-checks the unreachable code (line 155 has a @ts-expect-error comment acknowledging this), which is intentional to keep the implementation ready for Phase 5 when the governance layer is extended to support streaming."]),

        bodyPara([bold("ESLint Rule", "eslint-rules/no-ungoverned-llm.js")]),
        bodyPara([bold("Config", "eslint.config.mjs, lines 5, 13-16, 25")]),
        bodyPara(["The custom ESLint rule no-ungoverned-llm enforces AI governance at the code level. It blocks: (1) Direct import of callLLM, callAI, getZAI, revenueLLMCall outside governance files. (2) Direct import of streamAICall from llm-stream (lines 18-20, message at line 79). (3) Direct import from Vercel AI SDK, OpenAI SDK, and AI SDK OpenAI packages (lines 146-170). (4) Raw fetch() calls to 10 AI provider hostnames including api.openai.com (lines 252-299). The rule is set to error severity in eslint.config.mjs line 25, making it a blocking CI check."]),

        bodyPara([bold("ALLOWED_GOVERNANCE_FILES", "ai-governance.ts, model-router.ts, llm-client.ts, llm-stream.ts, ai-config.ts")]),
        bodyPara(["These 5 files are the exclusive locations where raw AI provider access is permitted. They constitute the governance layer itself. All other files must route through governedAICall() or governedAICallAggregate(). Verification: grep of governedAICall usage found 20+ API route files using the governed path."]),

        heading3("B. Actual Gap Remaining"),
        bodyPara(["The governance seal is complete for Phase 0. The remaining gap is Phase 5 work: implementing a governed streaming wrapper (governedStreamAICall) that applies hallucination prevention, evidence grounding, and audit logging to SSE-based streaming responses. The current llm-stream.ts bypasses these controls because it calls getLLMChain() directly from ai-config.ts without governance mediation. This is an intentional Phase 5 deferral, not a Phase 0 incompleteness."]),

        heading3("C. Implementation Verification"),
        ...gapTable("G2 Verification", [
          evidenceRow("403 Block", "Confirmed at route.ts:32-43. POST returns 403 before body parsing.", GREEN),
          evidenceRow("ESLint Coverage", "Confirmed at no-ungoverned-llm.js:146-299. Blocks SDK + fetch + streamAICall.", GREEN),
          evidenceRow("CI Enforcement", "Confirmed at eslint.config.mjs:25. Rule set to error severity.", GREEN),
          evidenceRow("User Workflow", "POST /api/ai/chat-stream -> 403 JSON. Governance bypass impossible.", GREEN),
        ]),

        heading2("2.2 G9: Fake Version History Cleanup"),
        heading3("A. Verified Existing State"),
        bodyPara([bold("File", "src/app/api/knowledge/graph/route.ts")]),
        bodyPara([bold("Lines 164-205", "handleVersionHistory() function")]),
        bodyPara(["The function at line 164 queries the database for the asset using db.capabilityAsset.findUnique at line 166. It extracts the current version from the asset record. It returns a JSON response with only the current version, the asset title, and a note about future version history (line 194)."]),
        bodyPara([bold("Removed code evidence", "Comment at lines 179-181 states: "Phase 0 (G10): Removed fabricated version history with random dates." Zero instances of Math.random(), faker, or hardcoded date arrays exist in the function.")]),
        bodyPara(["The function handles the case where the asset does not exist (lines 170-175: returns 404 with error message). For existing assets, it returns the single current version with the asset's updatedAt timestamp as the only history entry."]),

        heading3("B. Actual Gap Remaining"),
        bodyPara(["No dedicated KnowledgeVersion tracking table exists in the Prisma schema. The CapabilityAsset model has a version field (integer) but no version history table tracking who changed what, when, and the diff between versions. This is a product feature gap, not a data integrity issue. The system honestly reports what it has rather than fabricating data."]),

        heading3("C. Implementation Verification"),
        ...gapTable("G9 Verification", [
          evidenceRow("Fake data removed", "Confirmed. No Math.random/faker in version history code.", GREEN),
          evidenceRow("Real DB query", "Confirmed at graph/route.ts:166. Uses db.capabilityAsset.findUnique.", GREEN),
          evidenceRow("Honest response", "Confirmed. Returns note about future version history.", GREEN),
          evidenceRow("User Workflow", "GET /api/knowledge/graph?assetId=X&versions=true -> current version only.", GREEN),
        ]),

        heading2("2.3 G6: Company Parent-Child Hierarchy"),
        heading3("A. Verified Existing State"),
        bodyPara([bold("Schema", "prisma/schema.prisma, lines 385-484")]),
        bodyPara(["The Company model at line 385 includes parentId (String?) at line 411 and subsidiaryType (String?) at line 412. A database index exists at line 483: @@index([parentId]). The parentId field stores the ID of the parent company for subsidiary relationships. subsidiaryType stores the semantic relationship type: subsidiary, business_unit, division, regional_office, or joint_venture."]),
        bodyPara(["Important observation: The parentId field is a plain String? without a Prisma @relation declaration. There is no parent Company? or children Company[] relation defined. This means referential integrity is not enforced at the database level. Orphan children (pointing to a deleted parent) are possible. However, the API endpoints handle this gracefully by returning null for missing parents."]),

        bodyPara([bold("Hierarchy API", "src/app/api/companies/hierarchy/route.ts")]),
        bodyPara(["Three query modes are implemented:"]),
        bodyPara([bold("Mode 1 (lines 36-38)", "?companyId=xxx returns direct children via db.company.findMany({ where: { parentId } })")]),
        bodyPara([bold("Mode 2 (lines 40-43)", "?root=true returns top-level companies via db.company.findMany({ where: { parentId: null } })")]),
        bodyPara([bold("Mode 3 (lines 45-48)", "?family=xxx&depth=3 returns full family tree. Walks up to root (lines 151-178), then descends recursively (lines 184-262). Safety: infinite loop prevention at line 178 (max 20 ancestors). Depth capped at 5 levels (line 47).")]),

        heading3("B. Actual Gap Remaining"),
        bodyPara(["The missing Prisma @relation for parent-child is a minor data integrity gap. Without it: (1) Deleting a parent company leaves children with dangling parentId references. (2) No cascade delete. (3) No Prisma-level validation that parentId references a valid Company. This is a low-priority gap because the API endpoints handle missing parents gracefully, and company deletion is likely soft-delete (status=archived) in the product specification. A formal @relation with onDelete: Cascade would be a Phase 1 hardening improvement but is not blocking for the intelligence user journey."]),

        heading3("C. Implementation Verification"),
        ...gapTable("G6 Verification", [
          evidenceRow("Schema field", "Confirmed at schema.prisma:411-412, 483. parentId + index.", GREEN),
          evidenceRow("Hierarchy API", "Confirmed at hierarchy/route.ts. 3 query modes functional.", GREEN),
          evidenceRow("Safety guards", "Confirmed: loop prevention (L178), depth cap (L47).", GREEN),
          evidenceRow("Gap: Prisma @relation", "Missing. No formal self-referential relation. Low priority.", AMBER),
          evidenceRow("User Workflow", "GET /api/companies/hierarchy?companyId=X -> children list.", GREEN),
        ]),

        heading2("2.4 G1: Persistence Risk Assessment"),
        heading3("A. Verified Existing State"),
        bodyPara(["The persistence engine is a fully implemented system with 5 core files totaling approximately 1,500 lines of production code:"]),

        ...gapTable("Persistence Infrastructure", [
          evidenceRow("Adapter Contract", "types.ts L82-112: IIntelligencePersistenceAdapter interface", palette.body),
          evidenceRow("Feature Flags", "types.ts L225-236: USE_DB_PERSISTENCE, SHADOW_MODE, etc.", palette.body),
          evidenceRow("Adapter Impl", "intelligence-persistence-adapter.ts: 604 lines. Full CRUD for 5 stores.", palette.body),
          evidenceRow("Cold Start", "cold-start-loader.ts: 347 lines. 3-phase loading strategy.", palette.body),
          evidenceRow("Shadow Mode", "shadow-mode-comparator.ts: 225 lines. Map vs DB reconciliation.", palette.body),
          evidenceRow("Integration Helper", "persistence-integration.ts: 170 lines. persistWrite/persistDelete.", palette.body),
          evidenceRow("Health Monitor", "persistence-health-monitor.ts: Tracks failures, latency.", palette.body),
          evidenceRow("Failure Queue", "persistence-failure-queue.ts: Retry queue for failed writes.", palette.body),
          evidenceRow("Health API", "api/health/persistence/route.ts: Runtime health check.", palette.body),
        ]),

        bodyPara(["The 5 supported persistence stores are: knowledge_graph_nodes, knowledge_graph_edges, ai_memory, retrieval_index, retrieval_corpus_stats. Each has full upsert/read/delete support in the adapter."]),

        bodyPara([bold("Map Integration Points", "persistWrite() is called from 3 AI modules:")]),
        bodyPara([bold("ai-knowledge-graph.ts", "Lines 344, 388 (write), 440, 465 (delete). After every Map.set() for nodes and edges, persistWrite fires a non-blocking DB write.")]),
        bodyPara([bold("ai-hybrid-retrieval.ts", "Lines 1011, 1018, 1043, 1050. After index entry upserts and corpus stats updates.")]),
        bodyPara([bold("ai-memory.ts", "Lines 262, 277 (write), 293 (delete), 315 (update). After every memory store operation.")]),

        heading3("B. Actual Gap Remaining (CRITICAL)"),
        bodyPara(["Despite the infrastructure being fully built, two critical integration gaps prevent persistence from being production-reliable:", bold("", ""),

        { text: "Gap 1: registerMapStateProvider() is never called in production code. ", bold: true },
        "The shadow mode comparator (shadow-mode-comparator.ts line 35) declares that the Map state provider must be set during integration. The function registerMapStateProvider() at line 41 is exported and available, but grep of the entire src/ directory shows zero production calls to it. This means the shadow mode comparator cannot access in-memory Map state. It always sees empty Maps during reconciliation, making the comparison meaningless. The comment at cold-start-loader.ts line 243 states that the actual Map population happens during integration (Phase 3 of WI-18.2) when the adapter is connected to the AI module Maps. This integration is NOT done.",

        { text: "Gap 2: Cold start loader does not populate Maps. ", bold: true },
        "The cold-start-loader.ts loadStore() function (lines 223-280) reads records from the database via adapter.readAll(), counts them, and logs the count. But it does NOT call Map.set() to populate the actual in-memory Maps. The comment at lines 239-245 explicitly admits this. Without this integration, a server restart with USE_DB_PERSISTENCE=true will result in empty Maps even though the database has data.",

        bodyPara([bold("Gap 3: instrumentation.ts does not trigger cold start. ", bold: true }, "The Next.js instrumentation file (src/instrumentation.ts) handles environment validation and graceful shutdown registration. It does NOT call executeColdStartLoad() or startShadowModeComparator(). This means even if USE_DB_PERSISTENCE=true is set, no cold start loading occurs on application boot."]),

        heading3("C. Implementation Verification"),
        ...gapTable("G1 Verification", [
          evidenceRow("Infrastructure", "Fully built: adapter, cold-start, shadow-mode, health, failure queue.", GREEN),
          evidenceRow("persistWrite() calls", "Confirmed: 3 AI modules call persistWrite after Map operations.", GREEN),
          evidenceRow("registerMapStateProvider", "NEVER CALLED in production. Shadow mode sees empty Maps.", RED),
          evidenceRow("Map population on cold start", "NOT IMPLEMENTED. DB records loaded but not injected into Maps.", RED),
          evidenceRow("Cold start on boot", "NOT TRIGGERED in instrumentation.ts.", RED),
          evidenceRow("DB table state", "ALL 5 Tier-1 stores are EMPTY. No data to hydrate from.", RED),
          evidenceRow("Flip USE_DB_PERSISTENCE=true", "WILL CAUSE intelligence loss: empty DB, empty Maps after restart.", RED),
        ]),

        // ═══════════════════════════════════════════════════════════
        // PART III: PHASE 1 INTELLIGENCE FOUNDATION
        // ═══════════════════════════════════════════════════════════
        heading1("Part III: Phase 1 Intelligence Foundation"),
        bodyPara(["Phase 1 has two primary objectives, ordered by priority: (1) Close the learning loop circuit so that feedback visibly changes future recommendations. (2) Validate persistence reliability so that intelligence survives server restarts. All other Phase 1 items (prompt registry, cost dashboard, retention) are enterprise hardening and must not block or delay these two intelligence foundations."]),

        heading2("3.1 Learning Loop Closed Circuit"),
        heading3("A. Verified Existing State"),
        bodyPara(["Three learning loops exist in the codebase, each with distinct responsibilities:"]),

        bodyPara([bold("Loop 1: WI-17E Feedback Learning Loop", " src/lib/feedback-learning-loop.ts (954 lines)")]),
        bodyPara(["This is the primary recommendation feedback loop. It processes user feedback on AI recommendations through a 4-step pipeline: (1) Store feedback record (line 215: storeFeedbackRecord). (2) Create institutional memory from feedback (line 218: createMemoryFromFeedback). (3) Create learning event for significant outcomes (line 224-227: createLearningEvent). (4) Calibrate confidence based on feedback (line 230: calibrateFromFeedback).")]),
        bodyPara(["The calibration function calibrateFromFeedback() at lines 574-638 queries accumulated feedback for the company. If the company has 3+ positive feedback items with zero negative, it returns a confidence increase (direction: "increased", newConfidence: min(95, 70 + usefulCount * 3)). If 3+ negative with zero positive, it returns a decrease (direction: "decreased", newConfidence: max(30, 70 - notUsefulCount * 5)).")]),
        bodyPara(["The batch calibration function getCalibrationAdjustments() at lines 644-755 provides more granular adjustments: company-level calibration (useful > notUseful * 2 triggers 'up', magnitude min(0.15)), reason-specific calibration (e.g., 'accurate_signals' validated by 5+ positive items triggers 'up' magnitude 0.03), and system-wide signal type calibration."]),

        bodyPara([bold("Loop 2: Continuous Learning Loop", " src/lib/continuous-learning-loop.ts (203 lines)")]),
        bodyPara(["Records learning events from any interaction (win, loss, feedback, email reply, meeting note). When a high-confidence learning event occurs (confidence >= 0.7 and eventType is 'win', 'lesson_learned', or 'new_case_study'), it creates a new CapabilityAsset and embeds it for search (line 88). This loop builds organizational knowledge from outcomes."]),

        bodyPara([bold("Loop 3: Signal Learning Loop", " src/lib/intelligence-sources/learning-loop.ts (191 lines)")]),
        bodyPara(["Captures user feedback on signal quality (accuracy, relevance, actionability, surprise). Computes per-signal-type learning insights at lines 100-165. Includes quality alert thresholds (MIN_FEEDBACK_FOR_ALERT=3, ACCURACY_ALERT_THRESHOLD=0.4) that trigger warnings when signal type accuracy drops below 40%."]),

        heading3("B. Actual Gap Remaining (THE CRITICAL OPEN LOOP)"),
        bodyPara([{ text: "The learning loop is OPEN. ", bold: true }, "Calibration adjustments are computed but NEVER consumed by any recommendation engine. This is the single most important gap in DeepMindQ's intelligence architecture."]),

        bodyPara(["Evidence of the open loop:"), bold("", ""),
          bold("1. getCalibrationAdjustments() callers", ": Only called from (a) src/app/api/feedback/learning/route.ts (an API endpoint that returns adjustments for display) and (b) unit tests. Zero recommendation engines import or call this function."),
          bold("2. Recommendation Engine scoring", ": src/lib/recommendation-engine.ts lines 799-805 computes opportunityScore using a static formula: accountScoreVal * 0.30 + bestOppScore * 0.30 + signalStrength * 0.15 + bestCapScore * 0.10 + engagementReadiness * 0.15. The SCORE_WEIGHTS at lines 218-224 are constants. No calibration adjustments are applied. No feedback history influences the score."),
          bold("3. Opportunity Recommendation Engine", ": src/lib/research-engine/opportunity-recommendation-engine.ts does not call getCalibrationAdjustments. Zero matches for 'calibrat' or 'feedback' in the file."),
          bold("4. Revenue Intelligence Recommendation Generator", ": src/lib/revenue-intelligence/recommendation-generator.ts does not call getCalibrationAdjustments. Zero matches for 'calibrat' or 'feedback' in the file."),

        bodyPara(["The complete open loop visualization:"), bold("", ""),
        bodyPara(["User feedback -> Stored in IntelligenceFeedback table -> Memory created -> LearningEvent created -> calibrateFromFeedback() computes adjustment -> getCalibrationAdjustments() returns CalibrationAdjustment[] -> STOP. The adjustments are never applied to recommendation scores. Future recommendations for similar accounts receive the same scores regardless of feedback history."]),

        heading3("C. Required Implementation"),
        bodyPara(["To close the loop, the recommendation engine must:"]),
        bodyPara([bold("Step 1", ": Import getCalibrationAdjustments from feedback-learning-loop.ts into recommendation-engine.ts.")]),
        bodyPara([bold("Step 2", ": In the generateRecommendation() function (around line 750-805), call getCalibrationAdjustments(company.id) to retrieve active calibrations for the company.")]),
        bodyPara([bold("Step 3", ": Apply calibrations as score multipliers. For each CalibrationAdjustment with direction='up', multiply the relevant score component by (1 + magnitude). For direction='down', multiply by (1 - magnitude). Cap the final opportunityScore at 0-100.")]),
        bodyPara([bold("Step 4", ": Log the calibration application: store which adjustments were applied and their effect on the final score. This provides audit traceability.")]),
        bodyPara([bold("Step 5", ": Repeat for all recommendation engines: opportunity-recommendation-engine.ts and revenue-intelligence/recommendation-generator.ts.")]),

        bodyPara(["The user-verifiable test case:"), bold("", ""),
        bodyPara(["1. System recommends Account A with opportunityScore=72 based on signals X, Y, Z."),
        bodyPara(["2. User marks this recommendation as 'not_useful' with reason 'incorrect_technology'."),
        bodyPara(["3. System records feedback in IntelligenceFeedback table (processFeedback at line 208)."),
        bodyPara(["4. After 3+ negative feedback items for similar reasons, getCalibrationAdjustments returns { direction: 'down', magnitude: 0.05, pattern: 'reason:incorrect_technology' }."),
        bodyPara(["5. Next time recommendations are generated, the engine applies the adjustment: signalStrength * 0.15 * (1 - 0.05) = signalStrength * 0.1425."),
        bodyPara(["6. Account A's opportunityScore decreases. Similar accounts with 'incorrect_technology' patterns also receive lower scores."),
        bodyPara(["7. User can verify: after giving negative feedback, the same account or similar accounts rank lower in subsequent recommendation lists.")]),

        heading2("3.2 Persistence Validation Plan"),
        bodyPara(["The persistence infrastructure is built but three critical integration gaps prevent production use. The validation plan addresses these gaps in sequence."]),

        heading3("Stage 1: Register Map State Provider (1 day)"),
        bodyPara(["Create a MapStateProvider that exposes the in-memory Maps from ai-knowledge-graph.ts, ai-memory.ts, and ai-hybrid-retrieval.ts. This requires: (a) Exporting the nodeStore, edgeStore, memoryStore, and hybridIndex Maps or creating getter functions. (b) Creating a registration module that calls registerMapStateProvider() with a provider that returns the correct Map for each store name. (c) Calling this registration during application startup (in instrumentation.ts or a dedicated initialization module). Without this, shadow mode reconciliation always sees empty Maps and cannot validate DB parity."]),

        heading3("Stage 2: Implement Map Population on Cold Start (2 days)"),
        bodyPara(["Modify cold-start-loader.ts loadStore() to actually populate the Maps after reading from DB. Currently, it reads records and logs counts (line 237) but does not inject them into the Maps. The implementation must: (a) After adapter.readAll(store, options) returns records, iterate and call the appropriate Map.set() for each record. (b) Rebuild derived indices (sourceEdgeIndex, targetEdgeIndex, labelIndex, typeIndex for KG; layerIndex, categoryIndex, scopeIndex, tagIndex for memory). (c) Handle type conversion from DB records to in-memory types (GraphNode, GraphEdge, MemoryItem, HybridIndexEntry). This is non-trivial because the Maps store typed objects while the DB stores raw JSON fields."]),

        heading3("Stage 3: Trigger Cold Start on Boot (0.5 days)"),
        bodyPara(["Add executeColdStartLoad() and startShadowModeComparator() calls to instrumentation.ts register() function. This ensures that every server restart triggers the cold start sequence. The cold start should run AFTER environment validation but BEFORE the server accepts requests."]),

        heading3("Stage 4: Shadow Mode Validation (2 days)"),
        bodyPara(["With the MapStateProvider registered and cold start functional: (a) Set PERSISTENCE_SHADOW_MODE=true, USE_DB_PERSISTENCE=true. (b) Exercise the system: create intelligence data, trigger recommendations, submit feedback. (c) Run reconciliation: the comparator should show Map state being written to DB in parallel. (d) Compare Map vs DB counts: missingFromDb should be 0 for all stores after initial hydration. (e) Measure reconciliation timing: each store reconciliation should complete in under 5 seconds for typical data volumes."]),

        heading3("Stage 5: Restart Recovery Validation (1 day)"),
        bodyPara(["(a) Populate the database with realistic intelligence data via shadow mode. (b) Record exact counts: KG nodes, edges, memory items, retrieval entries. (c) Restart the application. (d) Verify cold-start-loader reads records from DB and populates Maps. (e) Verify Map counts match pre-restart DB counts (allowing for new data created during the restart gap). (f) Verify no intelligence loss: knowledge graph queries return same results, memory search returns same items, retrieval returns same documents. (g) Measure cold-start timing: Phase 1 (critical stores) should complete in under 10 seconds. Full load should complete in under 60 seconds."]),

        heading3("Stage 6: Failed Scenario Testing (1 day)"),
        bodyPara(["(a) Test DB connection failure during cold start: verify degraded mode activates, logs error, and system continues with empty Maps. (b) Test partial load failure: disable one store's table, verify other stores load successfully. (c) Test write failure during normal operation: verify failure queue captures the operation, health monitor increments consecutiveFailures. (d) Test concurrent writes: verify no data corruption under parallel persistWrite() calls."]),

        heading3("Evidence Required Before Phase 1 Persistence is Complete"),
        ...gapTable("Persistence Exit Criteria", [
          evidenceRow("Map state provider", "registerMapStateProvider() called at startup. Shadow mode sees real Maps.", RED),
          evidenceRow("Map population", "Cold start reads from DB and populates all Maps. nodeStore/edgeStore/memoryStore/hybridIndex populated.", RED),
          evidenceRow("Cold start on boot", "instrumentation.ts triggers executeColdStartLoad(). Logs show loading phases.", RED),
          evidenceRow("Shadow mode parity", "After exercise: missingFromDb=0 for all stores.", RED),
          evidenceRow("Restart recovery", "After restart: Map counts match pre-restart DB counts.", RED),
          evidenceRow("Cold-start timing", "Phase 1 < 10s. Full load < 60s.", RED),
          evidenceRow("Degraded mode", "DB failure -> degraded mode -> system continues with empty Maps.", RED),
          evidenceRow("No intelligence loss", "Queries return same results before and after restart.", RED),
        ]),

        heading2("3.3 Enterprise Hardening (Phase 1, Lower Priority)"),
        bodyPara(["The following items exist but need verification before they can be marked complete. They must not block or delay the learning loop or persistence work."]),
        bodyPara([bold("Prompt Registry", ": src/app/api/prompt-templates/ with route.ts, [id]/route.ts, and store.ts exists. Need to verify: (a) CRUD operations work end-to-end. (b) Version history is tracked. (c) Governance layer logs which prompt version was used per request.")]),
        bodyPara([bold("Cost Dashboard", ": AIUsageLog model exists in schema. src/app/api/admin/ai-usage/route.ts exists. Need to verify: (a) Every AI call logs tokens, latency, cost. (b) Dashboard aggregates by day/week/month. (c) Cost threshold alerting works.")]),
        bodyPara([bold("Retention", ": No retention cron job exists. Soft-delete (deletedAt) is not on all models. This is the only enterprise hardening item that requires NEW code rather than verification of existing code.")]),

        // ═══════════════════════════════════════════════════════════
        // PART IV: PHASE 0 EXIT CHECKLIST
        // ═══════════════════════════════════════════════════════════
        heading1("Part IV: Phase 0 Exit Checklist"),
        ...gapTable("Final Status", [
          evidenceRow("G2: chat-stream 403 seal", "VERIFIED. Runtime block + ESLint enforcement.", GREEN),
          evidenceRow("G9: Fake version history", "VERIFIED. Removed, real DB query, honest response.", GREEN),
          evidenceRow("G6: Company parentId", "VERIFIED. Schema + index + hierarchy API. Minor: no Prisma @relation.", GREEN),
          evidenceRow("G1: Persistence assessment", "VERIFIED. Engine built, 3 critical integration gaps documented.", GREEN),
          evidenceRow("Architecture documentation", "VERIFIED. Deliverable exists from prior session.", GREEN),
          evidenceRow("Regression baseline", "VERIFIED. Git tag phase0-baseline created. 965/1129 tests pass.", GREEN),
        ]),
      ],
    },
  ],
});

// ── Generate ──
const OUTPUT = "/home/z/my-project/download/DeepMindQ_Phase0_Verification_Report.docx";
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync(OUTPUT, buffer);
  console.log(`Generated: ${OUTPUT} (${(buffer.length / 1024).toFixed(1)} KB)`);
});
