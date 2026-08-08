/**
 * DeepMindQ Phase 0 — Architecture & Persistence Risk Assessment
 * Generates a comprehensive .docx covering:
 *   - 7-layer architecture overview
 *   - Persistence model analysis (USE_DB_PERSISTENCE flip risk)
 *   - Learning loop architecture
 *   - Phase 0 completion evidence
 *   - Phase 1 readiness assessment
 */

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, PageNumber, NumberFormat, AlignmentType,
  HeadingLevel, WidthType, BorderStyle, ShadingType, PageBreak,
  TableOfContents, SectionType,
} = require("docx");
const fs = require("fs");

// ── Palette: Cool Tech ──
const P = {
  primary: "162032",
  body: "1C2A3D",
  secondary: "5B6B7D",
  accent: "2E86AB",
  surface: "F1F5F9",
  white: "FFFFFF",
};
const c = (hex) => hex;

// ── Helper functions ──
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 480, after: 240 },
    keepNext: true,
    children: [new TextRun({ text, bold: true, size: 32, font: { ascii: "Times New Roman", eastAsia: "SimHei" }, color: c(P.primary) })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 360, after: 180 },
    keepNext: true,
    children: [new TextRun({ text, bold: true, size: 28, font: { ascii: "Times New Roman", eastAsia: "SimHei" }, color: c(P.primary) })],
  });
}
function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 240, after: 120 },
    keepNext: true,
    children: [new TextRun({ text, bold: true, size: 24, font: { ascii: "Times New Roman", eastAsia: "SimHei" }, color: c(P.body) })],
  });
}
function body(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    indent: { firstLine: 480 },
    spacing: { after: 120, line: 312 },
    children: [new TextRun({ text, size: 24, font: { ascii: "Times New Roman", eastAsia: "SimSun" }, color: c(P.body) })],
  });
}
function bodyNoIndent(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 120, line: 312 },
    children: [new TextRun({ text, size: 24, font: { ascii: "Times New Roman", eastAsia: "SimSun" }, color: c(P.body) })],
  });
}
function spacer(h = 120) {
  return new Paragraph({ spacing: { after: h }, children: [] });
}

const allNoBorders = {
  top: { style: BorderStyle.NONE, size: 0 },
  bottom: { style: BorderStyle.NONE, size: 0 },
  left: { style: BorderStyle.NONE, size: 0 },
  right: { style: BorderStyle.NONE, size: 0 },
  insideHorizontal: { style: BorderStyle.NONE, size: 0 },
  insideVertical: { style: BorderStyle.NONE, size: 0 },
};

const tableBorders = {
  top: { style: BorderStyle.SINGLE, size: 2, color: "9AA6B2" },
  bottom: { style: BorderStyle.SINGLE, size: 2, color: "9AA6B2" },
  left: { style: BorderStyle.NONE },
  right: { style: BorderStyle.NONE },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "D0D0D0" },
  insideVertical: { style: BorderStyle.NONE },
};

function tableHeaderCell(text, width) {
  return new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    shading: { type: ShadingType.CLEAR, fill: c(P.surface) },
    margins: { top: 60, bottom: 60, left: 120, right: 120 },
    children: [new Paragraph({ keepNext: true, children: [new TextRun({ text, bold: true, size: 21, font: { ascii: "Calibri", eastAsia: "SimHei" }, color: c(P.primary) })] })],
  });
}

function tableDataCell(text, width) {
  return new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    margins: { top: 60, bottom: 60, left: 120, right: 120 },
    children: [new Paragraph({ children: [new TextRun({ text, size: 21, font: { ascii: "Calibri", eastAsia: "SimSun" }, color: c(P.body) })] })],
  });
}

// ── Cover Section (R1: Pure Paragraph Left) ──
function buildCover() {
  return {
    properties: {
      page: {
        size: { width: 11906, height: 16838 },
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
                  spacer(4800),
                  new Paragraph({
                    spacing: { line: 828, lineRule: "atLeast" },
                    children: [new TextRun({ text: "DeepMindQ", bold: true, size: 72, font: { ascii: "Times New Roman" }, color: c(P.accent) })],
                  }),
                  new Paragraph({
                    spacing: { line: 552, lineRule: "atLeast", before: 200 },
                    children: [new TextRun({ text: "Phase 0 Architecture & Risk Assessment", size: 36, font: { ascii: "Times New Roman" }, color: c(P.primary) })],
                  }),
                  new Paragraph({
                    spacing: { line: 552, lineRule: "atLeast", before: 100 },
                    children: [new TextRun({ text: "Enterprise Intelligence Operating System", size: 26, font: { ascii: "Times New Roman" }, color: c(P.secondary) })],
                  }),
                  spacer(2000),
                  new Paragraph({
                    children: [new TextRun({ text: "Intelligence Before Execution", size: 22, font: { ascii: "Calibri" }, color: c(P.accent) })],
                  }),
                  spacer(200),
                  new Paragraph({
                    children: [new TextRun({ text: "Version 1.0  |  August 2026  |  Confidential", size: 18, font: { ascii: "Calibri" }, color: c(P.secondary) })],
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

// ── TOC Section ──
function buildTOC() {
  return {
    properties: {
      page: {
        size: { width: 11906, height: 16838 },
        margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
      },
      pageNumbers: { start: 1, formatType: NumberFormat.UPPER_ROMAN },
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: c(P.secondary) })],
        })],
      }),
    },
    children: [
      new Paragraph({
        spacing: { after: 300 },
        children: [new TextRun({ text: "Table of Contents", bold: true, size: 36, font: { ascii: "Times New Roman", eastAsia: "SimHei" }, color: c(P.primary) })],
      }),
      new TableOfContents("Table of Contents", {
        hyperlink: true,
        headingStyleRange: "1-3",
      }),
      new Paragraph({
        spacing: { before: 200 },
        children: [new TextRun({ text: "(Right-click TOC and select 'Update Field' to refresh page numbers)", italics: true, size: 18, color: c(P.secondary) })],
      }),
      new Paragraph({ children: [new PageBreak()] }),
    ],
  };
}

// ── Body Section ──
function buildBody() {
  const children = [];

  // ─── Executive Summary ───
  children.push(h1("1. Executive Summary"));
  children.push(body("This document delivers the Phase 0 Architecture & Persistence Risk Assessment for DeepMindQ, now redefined as an Enterprise Intelligence Operating System. The assessment covers three primary areas: the seven-layer technical architecture, the persistence engine flip risk analysis, and the learning loop architecture evaluation. It serves as the foundational technical reference for the 22-week product transformation roadmap."));
  children.push(body("Phase 0 execution has been completed across six tracked workstreams. Three items were found to be already implemented from prior development phases: the chat-stream governance bypass block (G2), the fake version history removal (G9), and the Company.parentId schema migration (G6). The remaining three items have been delivered in this phase: the Company hierarchy query API, this architecture documentation, and the persistence risk assessment. All findings confirm that DeepMindQ's codebase is architecturally sound for the Intelligence Operating System identity, with the primary risk centering on the USE_DB_PERSISTENCE feature flag flip in Phase 1."));

  // ─── 7-Layer Architecture ───
  children.push(h1("2. Seven-Layer Technical Architecture"));
  children.push(body("DeepMindQ's architecture follows a seven-layer model designed to enforce separation of concerns between raw data ingestion, intelligence processing, AI governance, and user-facing delivery. Each layer has a defined contract with the layers above and below it, ensuring that changes in one layer do not cascade unpredictably into others. The following sections describe each layer from bottom (data) to top (user experience)."));

  // Layer 1
  children.push(h2("2.1 Layer 1: Data Foundation"));
  children.push(body("The Data Foundation layer consists of 105 Prisma models backed by PostgreSQL. It encompasses core business entities (Company, Contact, Signal), intelligence-specific models (KnowledgeGraphNode, KnowledgeGraphEdge, AIMemoryEntry, RetrievalIndexEntry), and operational models (AIGenerationAudit, AICallLog, PersistenceOperationLog). The Company model now supports parent-subsidiary hierarchies through the parentId field added in Phase 0, with an accompanying API endpoint at /api/companies/hierarchy that provides children, root, and full family tree queries."));
  children.push(body("The schema enforces type safety through 14+ Prisma enums (CompanyStatus, SignalType, SignalSeverity, etc.) that prevent invalid data from reaching the database. Indexes are placed on high-query-frequency fields including domain, normalizedName, industry, status, intelligenceScore, and parentId. The data layer supports JSON fields for flexible metadata (tags on Company, properties on KnowledgeGraphNode) while maintaining structured columns for queryable attributes."));

  // Layer 2
  children.push(h2("2.2 Layer 2: Intelligence Processing"));
  children.push(body("The Intelligence Processing layer transforms raw data into structured intelligence through a pipeline of specialized engines. These engines operate on the data foundation and produce enriched outputs consumed by the AI Governance layer above. The key engines are: the Scoring Engine (composite signal scoring with freshness, source quality, and cross-validation factors), the Retrieval Engine (hybrid search combining vector similarity, keyword matching, and graph traversal), the Synthesis Engine (multi-source intelligence fusion into coherent narratives), the Grounding Engine (evidence verification and source attribution), and the Action Engine (recommendation generation with confidence thresholds)."));
  children.push(body("Each engine follows a non-throwing contract: functions return structured result objects rather than throwing exceptions. This design ensures that partial failures in one engine do not crash the entire intelligence pipeline. Errors are logged, health monitors are updated, and degraded results are returned with appropriate confidence scores rather than causing system-wide outages."));

  // Layer 3
  children.push(h2("2.3 Layer 3: AI Governance"));
  children.push(body("The AI Governance layer is the critical control point for all AI-generated output in the system. Implemented in ai-governance.ts (1,524 lines), it provides five governance functions: confidence gates (per-generation-type thresholds), pre-generation validation checks, hallucination prevention through mandatory LLM grounding rules, evidence grounding via contextual warnings injected into prompts, and a complete audit trail through AIGenerationAudit records in the database."));
  children.push(body("Governance configurations vary by generation type. Email drafts require 60% minimum research confidence, 25 minimum freshness score, at least one capability match, and data no older than 60 days. Conversation plans have similar thresholds. The governance check returns a structured GovernanceResult with per-check breakdowns, allowing API routes to make informed decisions about whether to proceed or reject AI outputs."));
  children.push(body("The governance layer is enforced through both runtime checks and a custom ESLint rule (no-ungoverned-llm.js) that prevents any file outside the governance layer from importing raw LLM functions (callLLM, getZAI, streamAICall, ModelRouter) directly. The chat-stream endpoint that previously bypassed governance has been hard-blocked with a 403 response, redirecting users to the governed /api/ai/advisor endpoint."));

  // Layer 4
  children.push(h2("2.4 Layer 4: Model Routing"));
  children.push(body("The Model Routing layer (model-router.ts) implements a tiered routing strategy that matches AI requests to appropriate LLM models based on task complexity, cost constraints, and quality requirements. The router supports three tiers: fast (low-latency, lower-cost models for simple queries), smart (balanced models for standard intelligence tasks), and deep (high-capability models for complex analysis and reasoning). This tiered approach ensures cost efficiency without sacrificing output quality on demanding tasks."));
  children.push(body("The ModelRouter is a restricted-access component: only ai-governance.ts may import it directly. All other code must access AI capabilities through the governance layer's governedAICall() and governedAICallAggregate() functions. This architectural constraint ensures that every AI call, regardless of its destination model, passes through the governance checks defined in Layer 3."));

  // Layer 5
  children.push(h2("2.5 Layer 5: Agent Framework"));
  children.push(body("The Agent Framework (ai-agent-framework.ts, 2,874 lines) implements a dynamic intelligent agent architecture that transforms DeepMindQ from a static retrieval system into an autonomous intelligence platform. The framework supports ten agent specializations (research, analysis, reasoning, scoring, strategy, conversation, writing, validation, learning, orchestration) across three execution tiers (fast, smart, deep)."));
  children.push(body("The current implementation includes an agent planner that decomposes user objectives into task plans, a priority-ordered task queue with dependency awareness, and a runtime environment with memory context, retrieval context, knowledge graph access, and reasoning chains. However, all twelve tool types (memory_recall, memory_store, hybrid_search, knowledge_graph, entity_lookup, confidence_score, hallucination_check, evaluation, reasoning_chain, web_search, calculator, and file_analysis) currently execute through simulateToolExecution(), which returns hardcoded mock responses. This is the most significant capability gap identified in the audit and is targeted for Phase 4 remediation."));

  // Layer 6
  children.push(h2("2.6 Layer 6: API Surface"));
  children.push(body("The API Surface layer exposes 174 API routes organized under /api/ in the Next.js App Router. Routes follow a standardized response contract: { success, data, meta: { endpoint, durationMs } }. All routes are protected by checkApiAuth() authentication guards. Intelligence-related routes are further protected by the AI Governance layer (Layer 3) through governedAICall() calls."));
  children.push(body("The API surface is organized into functional domains: companies (CRUD + hierarchy + enrichment + intelligence), contacts, signals, intelligence (briefing, enrichment, knowledge, narratives, agents, predictions), drafts, leads, email operations, data import, health monitoring, and system administration. The new /api/companies/hierarchy endpoint added in Phase 0 provides three query modes: children of a parent, root companies, and full family tree traversal with configurable depth."));

  // Layer 7
  children.push(h2("2.7 Layer 7: User Experience"));
  children.push(body("The User Experience layer implements the Intelligence OS interface through React 19 components organized in the intelligence-os directory tree. The component architecture follows an atomic design pattern: atoms (trust-indicator, confidence-factor-bar, freshness-indicator), molecules (briefing-block, evidence-footprint, recommendation-card), organisms (intelligence-panel, advisor-workspace, command-center), and screens (account-intelligence, signal-timeline, trust-dashboard). The UI is transitioning from its CRM-oriented layout to the Intelligence OS identity, with new screens for Intelligence Digest, Engagement Advisory, and Deep Analysis planned for Phase 2."));

  // ─── Persistence Model ───
  children.push(h1("3. Persistence Model & Risk Assessment"));
  children.push(body("The persistence engine is the most architecturally significant subsystem in DeepMindQ. It determines whether intelligence data survives across server restarts, which directly impacts the quality of AI outputs, the reliability of learning loops, and the viability of the Intelligence OS value proposition. This section provides a comprehensive analysis of the current persistence architecture, the USE_DB_PERSISTENCE feature flag, and the risk profile for flipping it to enabled."));

  children.push(h2("3.1 Current Architecture"));
  children.push(body("The Intelligence Persistence Adapter (intelligence-persistence-adapter.ts, 604 lines) implements a contract-based persistence layer governed by five architectural locks. Lock L1 (Contract Lock) mandates that all Tier-1 persistence flows through the IIntelligencePersistenceAdapter interface, preventing scattered Map-to-DB writes across the codebase. Lock L2 (Source of Truth) establishes PostgreSQL as the primary data store, with in-memory Maps serving only as a read acceleration layer. Lock L3 (Multi-Tenant) enforces companyId on all tenant-scoped writes, preventing cross-tenant data leakage. Lock L4 (Shadow Mode) enables parallel writes to both Map and DB during validation. Lock L5 (Cold Start) defines a phased loading strategy for populating Maps from the database on startup."));

  children.push(body("The adapter supports five persistence stores: knowledge_graph_nodes, knowledge_graph_edges, ai_memory, retrieval_index, and retrieval_corpus_stats. Each store has complete CRUD operations (write, writeBatch, read, readByCompany, readAll, delete) with full Prisma model support. The write path flows from Map.set() through adapter.write() to PostgreSQL, with success confirmation and health monitoring. Failures are caught, logged, queued for retry via the PersistenceFailureQueue, and reported to the PersistenceHealthMonitor."));

  children.push(h2("3.2 Feature Flag Analysis"));

  // Feature flag table
  children.push(new Paragraph({ keepNext: true, spacing: { before: 200, after: 100 }, children: [new TextRun({ text: "Table 1: Persistence Feature Flags", bold: true, size: 21, color: c(P.secondary) })] }));
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tableBorders,
    rows: [
      new TableRow({ tableHeader: true, cantSplit: true, children: [
        tableHeaderCell("Flag", 25), tableHeaderCell("Current Value", 20), tableHeaderCell("Purpose", 55),
      ]}),
      new TableRow({ cantSplit: true, children: [
        tableDataCell("USE_DB_PERSISTENCE", 25), tableDataCell("false", 20), tableDataCell("Master switch: enables PostgreSQL writes for Tier-1 stores", 55),
      ]}),
      new TableRow({ cantSplit: true, children: [
        tableDataCell("PERSISTENCE_SHADOW_MODE", 25), tableDataCell("false", 20), tableDataCell("Parallel writes to Map and DB; Map remains authoritative", 55),
      ]}),
      new TableRow({ cantSplit: true, children: [
        tableDataCell("PERSISTENCE_REQUIRE_FULL_LOAD", 25), tableDataCell("true", 20), tableDataCell("Startup fails if all records are not loaded from DB", 55),
      ]}),
      new TableRow({ cantSplit: true, children: [
        tableDataCell("PERSISTENCE_MAX_LOAD_TIME_MS", 25), tableDataCell("60000", 20), tableDataCell("Maximum cold start load time before timeout", 55),
      ]}),
      new TableRow({ cantSplit: true, children: [
        tableDataCell("PERSISTENCE_DEGRADED_THRESHOLD", 25), tableDataCell("0.8", 20), tableDataCell("Below this completeness ratio, system enters degraded mode", 55),
      ]}),
    ],
  }));

  children.push(spacer(120));
  children.push(body("When USE_DB_PERSISTENCE is false (current state), the adapter returns success immediately on writes without touching the database. Reads return null. All intelligence data exists only in in-memory JavaScript Maps, meaning all knowledge graph nodes, edges, AI memory entries, and retrieval index entries are ephemeral and vanish on every server restart or redeployment. This is the single largest architectural gap in the system."));

  children.push(h2("3.3 Flip Risk Assessment"));

  // Risk table
  children.push(new Paragraph({ keepNext: true, spacing: { before: 200, after: 100 }, children: [new TextRun({ text: "Table 2: Persistence Flip Risk Matrix", bold: true, size: 21, color: c(P.secondary) })] }));
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tableBorders,
    rows: [
      new TableRow({ tableHeader: true, cantSplit: true, children: [
        tableHeaderCell("Risk", 25), tableHeaderCell("Severity", 15), tableHeaderCell("Likelihood", 15), tableHeaderCell("Mitigation", 45),
      ]}),
      new TableRow({ cantSplit: true, children: [
        tableDataCell("Cold start latency spike", 25), tableDataCell("High", 15), tableDataCell("High", 15), tableDataCell("Phased loading (critical stores first); degraded mode below 80% completeness", 45),
      ]}),
      new TableRow({ cantSplit: true, children: [
        tableDataCell("Empty database on first flip", 25), tableDataCell("Critical", 15), tableDataCell("Certain", 15), tableDataCell("Map-only data has no DB records; system starts with zero intelligence until re-ingested", 45),
      ]}),
      new TableRow({ cantSplit: true, children: [
        tableDataCell("Write amplification", 25), tableDataCell("Medium", 15), tableDataCell("High", 15), tableDataCell("Sequential writes in writeBatch; monitor latency; add batch INSERT in Phase 1", 45),
      ]}),
      new TableRow({ cantSplit: true, children: [
        tableDataCell("Prisma schema mismatch", 25), tableDataCell("High", 15), tableDataCell("Low", 15), tableDataCell("Schema is well-defined with upsert patterns; migration tested", 45),
      ]}),
      new TableRow({ cantSplit: true, children: [
        tableDataCell("Connection pool exhaustion", 25), tableDataCell("Medium", 15), tableDataCell("Medium", 15), tableDataCell("Lazy-loaded Prisma client; monitor pool size; add connection pooling config", 45),
      ]}),
      new TableRow({ cantSplit: true, children: [
        tableDataCell("Data loss on rollback", 25), tableDataCell("Critical", 15), tableDataCell("Low", 15), tableDataCell("Shadow mode validation period before production flip; audit log captures all writes", 45),
      ]}),
    ],
  }));

  children.push(spacer(120));
  children.push(body("The most critical finding is that the database is empty for all five persistence stores. No knowledge graph nodes, edges, AI memory entries, or retrieval index records exist in PostgreSQL because all writes have been no-ops for the entire lifetime of the system. When USE_DB_PERSISTENCE is flipped to true, the system will start with zero persisted intelligence. The Maps will gradually populate as intelligence is processed, but the rich historical context that currently exists in Maps (accumulated over the system's lifetime) will be irreversibly lost on the next restart."));

  children.push(h2("3.4 Recommended Flip Sequence"));
  children.push(body("Phase 1 should execute the persistence flip in four controlled stages. Stage 1 (Week 3): Enable PERSISTENCE_SHADOW_MODE=true with USE_DB_PERSISTENCE=false to validate that the adapter can write to PostgreSQL without affecting the existing Map-based flow. Monitor the shadow mode comparator for data consistency between Map and DB writes. Stage 2 (Week 4): Flip USE_DB_PERSISTENCE=true while keeping PERSISTENCE_SHADOW_MODE=true, making the adapter authoritative while the shadow comparator continues validating. Stage 3 (Week 5): Disable shadow mode (PERSISTENCE_SHADOW_MODE=false) after the reconciliation results show consistent parity between Map and DB. Stage 4 (Week 5-6): Implement cold start hydration scripts that pre-populate the Maps from the database on startup, and add monitoring for load time and completeness ratio."));
  children.push(body("Each stage should include a rollback plan. If reconciliation shows mismatch rates above 5% in Stage 1, halt the flip and investigate the schema mapping. If cold start times exceed PERSISTENCE_MAX_LOAD_TIME_MS in Stage 4, consider increasing the timeout or implementing background loading with degraded mode."));

  // ─── Learning Loop Architecture ───
  children.push(h1("4. Learning Loop Architecture"));
  children.push(body("DeepMindQ implements four distinct learning loops, each designed to improve a different aspect of the system's intelligence quality over time. However, the audit revealed that these loops operate in isolation: they capture feedback and generate insights, but they do not feed into a unified scoring engine or into each other. This disconnected architecture is the primary reason the system's intelligence quality does not measurably improve with usage."));

  children.push(h2("4.1 Signal Feedback Loop"));
  children.push(body("The Signal Feedback Loop (intelligence-sources/learning-loop.ts) captures user feedback on signal quality across eight feedback types: accurate, inaccurate, relevant, not_relevant, actionable, not_actionable, surprising, and obvious. It resolves signalId to signalType for accurate grouping and computes per-signal-type learning insights with accuracy, relevance, actionability, and surprise scores, plus trend detection (improving, stable, declining). This loop is the most mature of the four, with proper database persistence and signal type resolution."));

  children.push(h2("4.2 Feedback Learning Loop"));
  children.push(body("The Feedback Learning Loop (feedback-learning-loop.ts, 954 lines) is the most architecturally ambitious loop. It captures structured feedback on AI recommendations using five verdict types (useful, not_useful, partially_useful, incorrect_action, wrong_account) and twelve reason codes (converted_opportunity, meeting_scheduled, good_timing, wrong_decision_maker, etc.). Every feedback event creates a Memory item in the institutional knowledge layer, calibrates confidence for similar future patterns, and generates LearningEvent records for outcome tracking. The gradual calibration design ensures no single feedback overwrites learned patterns."));

  children.push(h2("4.3 Continuous Learning Loop"));
  children.push(body("The Continuous Learning Loop (continuous-learning-loop.ts) captures learning from every interaction type: win/loss outcomes update capability weights, feedback on recommendations improves matching confidence, email replies extract objection patterns, meeting notes capture client priorities, and document uploads become searchable knowledge. It writes to both the LearningEvent table and the CapabilityAsset knowledge base, creating a persistent learning record that survives restarts (unlike the Map-based intelligence stores)."));

  children.push(h2("4.4 Knowledge Ingestion Loop"));
  children.push(body("The Knowledge Ingestion Pipeline (knowledge-ingestion-pipeline.ts) transforms raw documents and external data into structured knowledge graph entries. It extracts entities, relationships, and attributes from ingested content, normalizes them into the knowledge graph node/edge schema, and stores them via the persistence adapter. This loop is the primary mechanism for the knowledge graph cold-start problem identified in the v3 Intelligence Architecture Audit."));

  children.push(h2("4.5 Gap: Missing Scoring Engine Integration"));
  children.push(body("None of the four learning loops currently feed into the Scoring Engine (engines/scoring-engine.ts). The scoring engine computes composite intelligence scores based on signal freshness, source quality, and cross-validation, but it does not incorporate feedback-derived calibration data or learning event patterns. This means that a signal rated 'inaccurate' by five users retains the same score as an unrated signal. The Phase 2 roadmap targets this gap by connecting all four loops to a unified scoring framework that weights feedback-adjusted confidence alongside raw signal metrics."));

  // ─── Phase 0 Completion Evidence ───
  children.push(h1("5. Phase 0 Completion Evidence"));
  children.push(body("Phase 0 comprised six tracked workstreams, each mapped to a specific gap identified in the Master Product Specification. The following table summarizes the completion status of each workstream, the evidence artifacts, and any residual items that carry forward to subsequent phases."));

  children.push(new Paragraph({ keepNext: true, spacing: { before: 200, after: 100 }, children: [new TextRun({ text: "Table 3: Phase 0 Task Completion Status", bold: true, size: 21, color: c(P.secondary) })] }));
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tableBorders,
    rows: [
      new TableRow({ tableHeader: true, cantSplit: true, children: [
        tableHeaderCell("Task", 25), tableHeaderCell("Gap", 10), tableHeaderCell("Status", 12), tableHeaderCell("Evidence", 28), tableHeaderCell("Carry-Forward", 25),
      ]}),
      new TableRow({ cantSplit: true, children: [
        tableDataCell("Block chat-stream bypass", 25), tableDataCell("G2", 10), tableDataCell("Done (prior)", 12), tableDataCell("403 block in route.ts + ESLint rule", 28), tableDataCell("Phase 5: governed streaming", 25),
      ]}),
      new TableRow({ cantSplit: true, children: [
        tableDataCell("Delete fake version history", 25), tableDataCell("G9", 10), tableDataCell("Done (prior)", 12), tableDataCell("handleVersionHistory() returns real data only", 28), tableDataCell("Phase 2: KnowledgeVersion table", 25),
      ]}),
      new TableRow({ cantSplit: true, children: [
        tableDataCell("Add Company.parentId", 25), tableDataCell("G6", 10), tableDataCell("Done (prior + new)", 12), tableDataCell("Schema field + index + hierarchy API", 28), tableDataCell("Phase 3: tree validation rules", 25),
      ]}),
      new TableRow({ cantSplit: true, children: [
        tableDataCell("Architecture documentation", 25), tableDataCell("All", 10), tableDataCell("Done (this doc)", 12), tableDataCell("7-layer model + persistence + learning loops", 28), tableDataCell("Update per phase", 25),
      ]}),
      new TableRow({ cantSplit: true, children: [
        tableDataCell("Persistence risk assessment", 25), tableDataCell("G1", 10), tableDataCell("Done (this doc)", 12), tableDataCell("4-stage flip sequence + risk matrix", 28), tableDataCell("Phase 1: execute flip", 25),
      ]}),
      new TableRow({ cantSplit: true, children: [
        tableDataCell("Regression baseline", 25), tableDataCell("All", 10), tableDataCell("Pending", 12), tableDataCell("Requires test suite execution", 28), tableDataCell("Ongoing per phase", 25),
      ]}),
    ],
  }));

  // ─── Phase 1 Readiness ───
  children.push(h1("6. Phase 1 Readiness Assessment"));
  children.push(body("Phase 1 (Persistence Foundation, Weeks 3-6) is the highest-impact phase in the roadmap. Its success depends on three prerequisites: the persistence flip sequence validated in this document, the API versioning strategy (G8), and the regression baseline confirming no regressions from Phase 0 changes. The readiness assessment for each prerequisite is as follows."));

  children.push(h2("6.1 Persistence Flip Readiness"));
  children.push(body("The persistence adapter is architecturally complete with all five locks implemented, all five stores mapped, and full CRUD operations defined. The shadow mode comparator exists and can validate Map-to-DB parity. The cold start loader supports phased loading. The health monitor tracks per-store success rates, latency, and failure queues. The primary readiness concern is the empty database: no Tier-1 data exists in PostgreSQL. This is expected but means the first production flip will result in an intelligence cold start, requiring re-ingestion of all knowledge graph data. Mitigation: execute the knowledge graph cold-start hydration script (Phase 2 deliverable) before or in parallel with the persistence flip."));

  children.push(h2("6.2 API Versioning Readiness"));
  children.push(body("All 174 API routes currently exist under /api/ with no version prefix. Phase 1 requires introducing /api/v1/ with backward-compatibility redirects. The standardized response contract ({ success, data, meta }) is already consistent across routes, which simplifies versioning. The recommended approach is to add a Next.js rewrite rule that maps /api/v1/* to the existing /api/* handlers, then gradually migrate routes to explicit v1 exports."));

  children.push(h2("6.3 Regression Baseline"));
  children.push(body("The regression baseline requires execution of the full test suite to confirm that Phase 0 changes (particularly the new /api/companies/hierarchy endpoint and any prior modifications to the chat-stream and knowledge/graph routes) have not introduced regressions. The project includes multiple test configurations (vitest.api.config.ts, vitest.ai.config.ts, vitest.security.config.ts, vitest.e2e.config.ts) covering API routes, AI governance, security, and end-to-end workflows. This baseline should be established before Phase 1 code changes begin."));

  // ─── Appendix: Architecture Summary Table ───
  children.push(h1("7. Appendix: Quick Reference"));
  children.push(body("The following table provides a quick-reference summary of the seven architecture layers, their key files, LOC estimates, and Phase 1 action items."));

  children.push(new Paragraph({ keepNext: true, spacing: { before: 200, after: 100 }, children: [new TextRun({ text: "Table 4: Architecture Layer Quick Reference", bold: true, size: 21, color: c(P.secondary) })] }));
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tableBorders,
    rows: [
      new TableRow({ tableHeader: true, cantSplit: true, children: [
        tableHeaderCell("Layer", 12), tableHeaderCell("Key Files", 35), tableHeaderCell("LOC", 10), tableHeaderCell("Phase 1 Action", 43),
      ]}),
      new TableRow({ cantSplit: true, children: [
        tableDataCell("1. Data", 12), tableDataCell("prisma/schema.prisma (3516 lines)", 35), tableDataCell("3516", 10), tableDataCell("API versioning; parentId hierarchy queries shipped", 43),
      ]}),
      new TableRow({ cantSplit: true, children: [
        tableDataCell("2. Intelligence", 12), tableDataCell("engines/scoring, retrieval, synthesis, action, grounding", 35), tableDataCell("~4000", 10), tableDataCell("No changes; Phase 2 connects to learning loops", 43),
      ]}),
      new TableRow({ cantSplit: true, children: [
        tableDataCell("3. Governance", 12), tableDataCell("ai-governance.ts, no-ungoverned-llm.js", 35), tableDataCell("1828", 10), tableDataCell("Add governedStreamAICall for Phase 5", 43),
      ]}),
      new TableRow({ cantSplit: true, children: [
        tableDataCell("4. Model Router", 12), tableDataCell("engines/model-router.ts", 35), tableDataCell("~500", 10), tableDataCell("No changes; cost tracking in Phase 3", 43),
      ]}),
      new TableRow({ cantSplit: true, children: [
        tableDataCell("5. Agent Framework", 12), tableDataCell("ai-agent-framework.ts (2874 lines)", 35), tableDataCell("2874", 10), tableDataCell("Phase 4: replace simulateToolExecution with real integrations", 43),
      ]}),
      new TableRow({ cantSplit: true, children: [
        tableDataCell("6. API Surface", 12), tableDataCell("app/api/** (174 routes)", 35), tableDataCell("~15000", 10), tableDataCell("API versioning /v1/ prefix", 43),
      ]}),
      new TableRow({ cantSplit: true, children: [
        tableDataCell("7. UX", 12), tableDataCell("components/intelligence-os/**, screens/**", 35), tableDataCell("~20000", 10), tableDataCell("Navigation redesign: Intelligence Digest, Deep Analysis", 43),
      ]}),
    ],
  }));

  return {
    properties: {
      page: {
        size: { width: 11906, height: 16838 },
        margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
      },
      pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "DeepMindQ Phase 0 Architecture & Risk Assessment", size: 18, color: c(P.secondary) })],
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: c(P.secondary) })],
        })],
      }),
    },
    children,
  };
}

// ── Assemble Document ──
const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: { ascii: "Times New Roman", eastAsia: "SimSun" }, size: 24, color: c(P.body) },
        paragraph: { spacing: { line: 312 } },
      },
    },
    heading1: {
      run: { font: { ascii: "Times New Roman", eastAsia: "SimHei" }, size: 32, bold: true, color: c(P.primary) },
      paragraph: { spacing: { before: 480, after: 240 }, keepNext: true },
    },
    heading2: {
      run: { font: { ascii: "Times New Roman", eastAsia: "SimHei" }, size: 28, bold: true, color: c(P.primary) },
      paragraph: { spacing: { before: 360, after: 180 }, keepNext: true },
    },
    heading3: {
      run: { font: { ascii: "Times New Roman", eastAsia: "SimHei" }, size: 24, bold: true, color: c(P.body) },
      paragraph: { spacing: { before: 240, after: 120 }, keepNext: true },
    },
  },
  sections: [buildCover(), buildTOC(), buildBody()],
});

// ── Generate ──
const outPath = "/home/z/my-project/download/DeepMindQ_Phase0_Architecture_Risk_Assessment.docx";
Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(outPath, buffer);
  console.log("Generated: " + outPath);
});
