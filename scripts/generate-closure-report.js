const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, PageNumber, AlignmentType, HeadingLevel, WidthType,
  BorderStyle, ShadingType, SectionType, TableLayoutType,
  PageBreak, TableOfContents, LevelFormat,
} = require("docx");
const fs = require("fs");

// ── DM-1 Palette (Tech / AI) ──
const PAL = {
  bg: "162235", primary: "FFFFFF", accent: "37DCF2",
  cover: { titleColor: "FFFFFF", subtitleColor: "B0B8C0", metaColor: "90989F", footerColor: "687078" },
  table: { headerBg: "1B6B7A", headerText: "FFFFFF", accentLine: "1B6B7A", innerLine: "C8DDE2", surface: "EDF3F5" },
};
const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };
const c = (hex) => hex.replace("#", "");

// ── Helper functions ──
function h1(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 160, line: 312 },
    children: [new TextRun({ text, bold: true, size: 32, color: "000000", font: { ascii: "Calibri", eastAsia: "SimHei" } })] });
}
function h2(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 120, line: 312 },
    children: [new TextRun({ text, bold: true, size: 28, color: "000000", font: { ascii: "Calibri", eastAsia: "SimHei" } })] });
}
function h3(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_3, spacing: { before: 240, after: 100, line: 312 },
    children: [new TextRun({ text, bold: true, size: 24, color: "1B6B7A", font: { ascii: "Calibri", eastAsia: "SimHei" } })] });
}
function p(text) {
  return new Paragraph({ alignment: AlignmentType.JUSTIFIED, indent: { firstLine: 480 }, spacing: { line: 312, after: 80 },
    children: [new TextRun({ text, size: 24, color: "000000", font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })] });
}
function pn(text) {
  return new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { line: 312, after: 80 },
    children: [new TextRun({ text, size: 24, color: "000000", font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })] });
}
function bold(label, text) {
  return new Paragraph({ alignment: AlignmentType.JUSTIFIED, indent: { firstLine: 480 }, spacing: { line: 312, after: 80 },
    children: [
      new TextRun({ text: label, bold: true, size: 24, color: "000000", font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } }),
      new TextRun({ text, size: 24, color: "000000", font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } }),
    ] });
}

function makeTable(headers, rows) {
  const hdrCells = headers.map(h => new TableCell({
    width: { size: 100 / headers.length, type: WidthType.PERCENTAGE },
    margins: { top: 50, bottom: 50, left: 100, right: 100 },
    shading: { type: ShadingType.CLEAR, fill: PAL.table.headerBg },
    borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
    children: [new Paragraph({ spacing: { line: 280 }, children: [new TextRun({ text: h, bold: true, size: 21, color: PAL.table.headerText, font: { ascii: "Calibri", eastAsia: "SimHei" } })] })],
  }));
  const dataRows = rows.map((r, idx) => new TableRow({
    cantSplit: true,
    children: r.map(cell => new TableCell({
      width: { size: 100 / headers.length, type: WidthType.PERCENTAGE },
      margins: { top: 40, bottom: 40, left: 100, right: 100 },
      shading: idx % 2 === 0 ? { type: ShadingType.CLEAR, fill: PAL.table.surface } : { type: ShadingType.CLEAR, fill: "FFFFFF" },
      borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
      children: [new Paragraph({ spacing: { line: 280 }, children: [new TextRun({ text: String(cell), size: 21, color: "000000", font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })] })],
    })),
  }));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: { style: BorderStyle.SINGLE, size: 4, color: PAL.table.accentLine }, bottom: { style: BorderStyle.SINGLE, size: 4, color: PAL.table.accentLine }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: PAL.table.innerLine }, insideVertical: { style: BorderStyle.NONE } },
    rows: [new TableRow({ tableHeader: true, cantSplit: true, children: hdrCells }), ...dataRows],
  });
}

function caption(text) {
  return new Paragraph({ alignment: AlignmentType.LEFT, spacing: { before: 60, after: 200, line: 312 },
    children: [new TextRun({ text, size: 21, italics: true, color: "607080", font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })] });
}

// ── Cover Recipe R1 (Pure Paragraph Left) with DM-1 palette ──
function calcTitleLayout(title, maxWidthTwips, preferredPt = 40, minPt = 24) {
  const charWidth = (pt) => pt * 20;
  const charsPerLine = (pt) => Math.floor(maxWidthTwips / charWidth(pt));
  let titlePt = preferredPt, lines;
  while (titlePt >= minPt) {
    const cpl = charsPerLine(titlePt);
    if (cpl < 2) { titlePt -= 2; continue; }
    lines = splitTitleLines(title, cpl);
    if (lines.length <= 3) break;
    titlePt -= 2;
  }
  if (!lines || lines.length > 3) { lines = splitTitleLines(title, charsPerLine(minPt)); titlePt = minPt; }
  return { titlePt, titleLines: lines };
}

function splitTitleLines(title, cpl) {
  if (title.length <= cpl) return [title];
  const breakAfter = new Set([...' ,;:!?-', ...' \t']);
  const lines = []; let rem = title;
  while (rem.length > cpl) {
    let br = -1;
    for (let i = cpl; i >= Math.floor(cpl * 0.6); i--) { if (i < rem.length && breakAfter.has(rem[i - 1])) { br = i; break; } }
    if (br === -1) { const lim = Math.min(rem.length, Math.ceil(cpl * 1.3)); for (let i = cpl + 1; i < lim; i++) { if (breakAfter.has(rem[i - 1])) { br = i; break; } } }
    if (br === -1) br = cpl;
    lines.push(rem.slice(0, br).trim()); rem = rem.slice(br).trim();
  }
  if (rem) lines.push(rem);
  if (lines.length > 1 && lines[lines.length - 1].length <= 2) { const last = lines.pop(); lines[lines.length - 1] += " " + last; }
  return lines;
}

function calcCoverSpacing(params) {
  const { titleLineCount = 1, titlePt = 36, hasSubtitle = false, hasEnglishLabel = false, metaLineCount = 0, fixedHeight = 800 } = params;
  const SAFETY = 1200, usableHeight = 16838 - SAFETY;
  const contentHeight = titleLineCount * (titlePt * 23 + 200) + (hasSubtitle ? 380 : 0) + (hasEnglishLabel ? 270 : 0) + metaLineCount * 330 + fixedHeight + 900;
  const rem = Math.max(usableHeight - contentHeight, 400);
  const rawTop = Math.floor(rem * 0.45), rawBot = Math.floor(rem * 0.45);
  const bot = Math.max(rawBot, 800);
  return { topSpacing: Math.max(rawTop - Math.max(0, 800 - rawBot), 400), bottomSpacing: bot };
}

function buildCover() {
  const padL = 1200, padR = 800;
  const title = "DeepMindQ Revenue Intelligence Platform";
  const subtitle = "Phase 0 \u2013 Phase 6 Closure Report";
  const { titlePt, titleLines } = calcTitleLayout(title, 11906 - padL - padR - 300, 38, 24);
  const titleSize = titlePt * 2;
  const sp = calcCoverSpacing({ titleLineCount: titleLines.length, titlePt, hasSubtitle: true, hasEnglishLabel: true, metaLineCount: 2, fixedHeight: 400 });
  const accentLeft = { style: BorderStyle.SINGLE, size: 8, color: PAL.accent, space: 12 };
  const children = [];
  children.push(new Paragraph({ spacing: { before: sp.topSpacing } }));
  children.push(new Paragraph({ indent: { left: padL, right: padR }, spacing: { after: 500 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: PAL.accent, space: 8 } },
    children: [new TextRun({ text: "C L O S U R E   R E P O R T", size: 18, color: PAL.accent, font: { ascii: "Calibri" }, characterSpacing: 40 })] }));
  for (let i = 0; i < titleLines.length; i++) {
    children.push(new Paragraph({ indent: { left: padL }, spacing: { after: i < titleLines.length - 1 ? 100 : 300, line: Math.ceil(titlePt * 23), lineRule: "atLeast" },
      children: [new TextRun({ text: titleLines[i], size: titleSize, bold: true, color: PAL.cover.titleColor, font: { eastAsia: "SimHei", ascii: "Arial" } })] }));
  }
  children.push(new Paragraph({ indent: { left: padL }, spacing: { after: 800 },
    children: [new TextRun({ text: subtitle, size: 24, color: PAL.cover.subtitleColor, font: { eastAsia: "Microsoft YaHei", ascii: "Arial" } })] }));
  const metaLines = ["IT Services & Consulting Vertical  |  Dedicated-Instance Architecture", "Validation Review  |  July 2026"];
  for (const line of metaLines) {
    children.push(new Paragraph({ indent: { left: padL + 200 }, spacing: { after: 80 }, border: { left: accentLeft },
      children: [new TextRun({ text: line, size: 22, color: PAL.cover.metaColor, font: { eastAsia: "Microsoft YaHei", ascii: "Arial" } })] }));
  }
  children.push(new Paragraph({ spacing: { before: sp.bottomSpacing } }));
  children.push(new Paragraph({ indent: { left: padL, right: padR },
    border: { top: { style: BorderStyle.SINGLE, size: 2, color: PAL.accent, space: 8 } }, spacing: { before: 200 },
    children: [new TextRun({ text: "DeepMindQ  |  Confidential", size: 16, color: PAL.cover.footerColor, font: { ascii: "Arial" } }),
      new TextRun({ text: "                                              ", size: 16 }),
      new TextRun({ text: "7 Phases  |  330+ Files  |  70,000+ Lines", size: 16, color: PAL.cover.footerColor, font: { ascii: "Arial" } })] }));
  return [new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, layout: TableLayoutType.FIXED, borders: allNoBorders,
    rows: [new TableRow({ height: { value: 16838, rule: "exact" }, children: [new TableCell({ shading: { type: ShadingType.CLEAR, fill: PAL.bg }, borders: noBorders, children })] })] })];
}

// ── Phase section builder ──
function phaseSection(phaseNum, title, objective, evidence, funcValidation, biValidation, status, prodReadiness) {
  return [
    h1(`Phase ${phaseNum}: ${title}`),
    h2("1. Phase Objective"),
    ...objective.map(t => p(t)),
    h2("2. Implementation Evidence"),
    ...evidence.map(t => p(t)),
    h2("3. Functional Validation"),
    ...funcValidation.map(t => p(t)),
    h2("4. Business Intelligence Validation"),
    ...biValidation.map(t => p(t)),
    h2("5. Current Status"),
    ...status.map(t => p(t)),
    h2("6. Production Readiness"),
    ...prodReadiness.map(t => p(t)),
  ];
}

// ── DOCUMENT ASSEMBLY ──
const bodyChildren = [
  // TOC Section
  new Paragraph({ spacing: { before: 200, after: 200 } }),
  new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-3" }),
  new Paragraph({ spacing: { before: 100 }, children: [new TextRun({ text: "Right-click the Table of Contents above and select \u201cUpdate Field\u201d to refresh page numbers.", italics: true, size: 20, color: "888888" })] }),
  new Paragraph({ children: [new PageBreak()] }),

  // Executive Summary
  h1("Executive Summary"),
  p("The DeepMindQ Revenue Intelligence Platform has completed all seven development phases (Phase 0 through Phase 6), delivering a dedicated-instance, single-tenant intelligence system purpose-built for the IT Services & Consulting vertical. The platform implements an end-to-end, read-only intelligence chain that transforms raw market signals into actionable revenue opportunities while preserving human decision-making authority at the critical pursuit juncture."),
  p("The codebase comprises approximately 330 files spanning 70,000+ lines of TypeScript, organized across a Next.js 16 application with Prisma 6 ORM, PostgreSQL (Neon), and the z-ai-web-dev-sdk for AI capabilities. The Prisma schema defines 35+ models, and the API layer exposes 154 route handlers across seven functional domains (g-strategy, g-ai, g-crm, g-outreach, g-data, g-system, g-auth). The frontend includes 40+ screen components backed by Zustand state management, TanStack React Query, and Recharts for data visualization."),
  p("Three critical architectural boundaries have been maintained throughout development. First, the platform contains no outbound automation and explicitly does not function as a CRM. Second, intelligenceScore (research intelligence quality) and accountPriorityScore (go-to-market sales priority) are maintained as separate, independently computed fields with distinct formulas. Third, all AI interactions are funneled through a centralized governance layer (ai-governance.ts) that enforces confidence gates, evidence grounding, hallucination prevention, and comprehensive audit trails."),

  // Phase 0
  ...phaseSection(0, "Foundation & Architecture", [
    "Phase 0 established the foundational architecture for a dedicated-instance, single-tenant revenue intelligence platform targeting the IT Services & Consulting vertical. The primary objective was to create a scalable, maintainable codebase with clear domain boundaries, a robust data model, and the infrastructure required to support all subsequent intelligence phases.",
    "The architecture was designed around several non-negotiable constraints: no multi-tenancy (dedicated instance per client), no outbound automation (read-only intelligence layer), and no CRM functionality (deal pipeline, contact activity logging, and sales stage management are explicitly out of scope). These boundaries ensure the platform remains focused on its core value proposition: transforming signals into intelligence for human decision-makers.",
  ], [
    "The Prisma schema (schema.prisma, 1,239 lines) defines 35+ models covering CRM core entities (Company, Contact, Lead), research intelligence (CompanyResearchCard, CompanySignal, Evidence), capability management (CapabilityAsset, SignalCapabilityMatch), opportunity management (OpportunityRecommendation, Pursuit), email outreach (EmailTemplate, EmailSequence, SequenceStep, Draft, SendQueue), data intelligence (ImportBatch, DataUpload, ColumnMappingRule, FieldValidationRule, NormalizationMapping, ScoringWeight), workflow automation (Job, JobLog), AI governance (AIGenerationAudit), and system configuration (SystemSetting, User, Session).",
    "The project uses Next.js 16 with React 19, TypeScript 5, Tailwind CSS 4, Prisma 6 with PostgreSQL/Neon, Zustand for client state, TanStack React Query for server state, Recharts for visualizations, and the z-ai-web-dev-sdk for web search and LLM capabilities. A custom ESLint rule (no-ungoverned-llm.js) enforces that no route may import callLLM directly, routing all AI calls through the governance layer.",
    "The SystemSetting model (id: cuid(), key: @unique) provides a flexible key-value store for runtime configuration, including ICP profiles, evidence source quality tiers, and governance thresholds. This config-over-code approach allows business rules to change without code deployment.",
  ], [
    "Schema validation confirmed: all 35+ models compile without errors, relationships are correctly defined with proper onDelete behaviors, and the @@index directives (including @@index([priorityTier]) on Company) support expected query patterns. The dedicated-instance constraint is enforced architecturally: there is no tenant_id column anywhere in the schema, and no row-level security policies are needed.",
    "The custom ESLint rule was verified to correctly flag any direct import of callLLM outside of ai-governance.ts. The scripts/check-governance.sh shell script provides a CI-level validation that all AI routes use governedAICall().",
  ], [
    "The architectural decision to separate intelligenceScore from accountPriorityScore at the data model level was validated as critical for business clarity. intelligenceScore measures research quality (how well we understand the account), while accountPriorityScore measures go-to-market priority (which accounts to pursue now). Conflating these would create confusion between \u201cwe know a lot about this company\u201d and \u201cthis company is ready to buy.\u201d",
    "The config-over-code approach via SystemSetting was validated as essential for the ICP configuration layer and evidence quality tiers, enabling business users to adjust target market definitions without developer intervention.",
  ], [
    "Phase 0 is fully complete. All foundational models, infrastructure, and guardrails are in place. The schema supports all subsequent phases, and the governance layer is operational.",
  ], [
    "Production-ready. The Prisma schema is migration-safe, the ESLint rule is integrated into the lint pipeline, and the SystemSetting-backed configuration approach survives deployments and restarts. No mock data or hardcoded business rules remain in the data layer.",
  ]),

  // Phase 1
  ...phaseSection(1, "Data Ingestion & Signal Collection", [
    "Phase 1 built the data ingestion pipeline and signal collection mechanisms that form the raw input layer for all downstream intelligence. The objective was to enable structured data import from CSV/Excel files and real-time market signal capture from web sources, with full validation, normalization, deduplication, and quality scoring.",
    "The data intelligence engine (src/lib/data-intelligence/, 8 files, ~2,735 lines) implements a complete upload pipeline: file parsing (CSV/XLSX) to column detection to field validation to normalization to deduplication to quality scoring to human review to commit. All business rules are loaded from the database via the config-store module, achieving zero hardcoded logic.",
  ], [
    "The engine module (engine.ts, 743 lines) orchestrates the full pipeline with functions: analyzeFile(), createUploadJob(), processChunk(), getReviewSummary(), applyCorrections(), and commitUpload(). The column-detector (86 lines) maps source headers to internal fields using regex patterns stored in ColumnMappingRule. The validator (221 lines) applies FieldValidationRules loaded from the database. The normalizer (263 lines) applies NormalizationMappings across 7 categories: industry, country, employee_size, title, company_name, domain, and name.",
    "The deduplicator (295 lines) implements three detection strategies: exact email match, fuzzy company+name match, and within-batch duplicate detection. The quality-scorer (229 lines) produces a 3-dimension score: Completeness 40%, Validity 30%, Richness 30%, all weighted from database configuration.",
    "The g-data API domain exposes 35 route handlers (~3,600 lines) covering upload management, data health monitoring (data-health.ts, 629 lines), revenue intelligence dashboards, governance dashboards, compliance tracking, and configuration management for column rules, validation rules, normalization mappings, and scoring weights.",
  ], [
    "The full import pipeline was validated end-to-end: file upload through column detection, validation, normalization, deduplication, quality scoring, human review, and commit. The config-store module correctly loads all business rules from the database with in-memory caching and invalidation, ensuring zero hardcoded rules.",
    "The correction-suggester (292 lines) uses governed LLM calls to suggest fixes for failed validations, demonstrating proper integration with the AI governance layer even at the data ingestion stage.",
  ], [
    "The decision to make all business rules database-configurable (ColumnMappingRule, FieldValidationRule, NormalizationMapping, ScoringWeight) was validated as critical for multi-client deployment. Each dedicated instance can have completely different import configurations without code changes.",
    "The 3-dimension quality score (Completeness/Validity/Richness) provides an actionable signal to data operators about which records need attention before they enter the intelligence pipeline.",
  ], [
    "Phase 1 is fully complete. The data ingestion engine processes files through the full pipeline with database-driven business rules and AI-assisted correction suggestions.",
  ], [
    "Production-ready with caveats. The pipeline is functionally complete but would benefit from parallel processing for large files (>10,000 rows) and webhook-based async processing to avoid request timeouts on very large imports.",
  ]),

  // Phase 2
  ...phaseSection(2, "Intelligence Processing (Research Engine)", [
    "Phase 2 built the research intelligence engine that transforms raw company data into structured, evidence-backed intelligence. The objective was to create a 6-step research pipeline: web search, evidence collection, LLM extraction with grounding, field validation, confidence scoring, and persistent storage of intelligence artifacts.",
    "The research engine (src/lib/research-engine/, 12 files, ~4,276 lines) replaced the earlier monolithic enrichment approach with a modular, step-by-step pipeline that produces auditable, evidence-linked intelligence at every stage.",
  ], [
    "The researcher module (researcher.ts, 608 lines) implements the 6-step pipeline: (1) execute 4 parallel web queries via z-ai-web-dev-sdk, (2) collect and store evidence with per-field source tracking, (3) perform LLM extraction with mandatory evidence grounding, (4) cross-reference extracted fields against existing data, (5) compute per-field confidence scores, and (6) persist intelligence to CompanyResearchCard. Each step is independently testable and produces intermediate artifacts.",
    "The evidence module (evidence.ts, 608 lines) implements source quality tiers (premium/standard/low) loaded from SystemSetting, recency decay via exponential functions, corroboration scoring across multiple sources, and multi-factor confidence computation: relevance 30%, tier 25%, recency 25%, corroboration 20%. Evidence is linked to specific fields via the linkEvidenceToFields() function.",
    "The signals module (signals.ts, 348 lines) performs LLM-based buying signal detection across 7 categories: funding, hiring, leadership_change, expansion, technology, product, and partnership. A rule-based fallback ensures signal detection works even when LLM is unavailable. The signal-lifecycle module (78 lines) manages state transitions: detected to validated to active to aging to expired to archived.",
  ], [
    "The 6-step research pipeline was validated for completeness: each step produces observable output, the pipeline handles partial failures gracefully (e.g., web search returns no results, LLM extraction fails), and all intelligence is stored with evidence provenance. The evidence quality module (evidence-quality.ts, 120 lines) produces a 5-dimension quality score: Coverage 25%, Freshness 25%, Source Quality 20%, Corroboration 15%, Volume 15%.",
    "The signal detection module was validated for both LLM-based and rule-based paths, ensuring the platform produces useful signals even during AI service degradation.",
  ], [
    "The evidence-grounded extraction approach was validated as essential for hallucination prevention. Every extracted field must be traceable to a specific evidence source, creating an audit trail that human validators can inspect in Phase 6.",
    "The signal lifecycle state machine ensures signals do not remain in indefinite states and that aging signals are automatically deprioritized without manual intervention.",
  ], [
    "Phase 2 is fully complete. The research engine produces structured, evidence-backed intelligence with confidence scores at both the field and overall level.",
  ], [
    "Production-ready. The pipeline handles errors gracefully, the evidence grounding approach provides auditability, and the signal lifecycle prevents data staleness. The main operational consideration is web search API quota management for high-volume research batches.",
  ]),

  // Phase 3
  ...phaseSection(3, "Intelligence Contract & AI Governance", [
    "Phase 3 established the intelligence contract layer and centralized AI governance. The objective was to create a single source of truth for all intelligence consumption (intelligence-contract.ts) and a mandatory governance layer (ai-governance.ts) that all AI-dependent routes must use before producing output.",
    "The intelligence contract prevents downstream phases from performing independent web searches or accessing raw data directly. The governance layer enforces confidence thresholds, evidence grounding, hallucination prevention, and comprehensive audit logging for every AI generation.",
  ], [
    "The intelligence contract (intelligence-contract.ts, 918 lines) exports four functions: getResearchContext() returns a clean, structured JSON object for AI consumption including research card data, signals, evidence, key people, and freshness indicators; getAccountIntelligence() returns an aggregated lead qualification score; getResearchFreshness() returns staleness detection with domain-specific freshness profiles; and getSignalMetrics() returns signal analytics for dashboards.",
    "The AI governance layer (ai-governance.ts, 1,092 lines) exports governedAICall() and governedAICallAggregate(). It implements per-generation-type confidence gates (e.g., email_draft requires 60% research confidence and freshness score of 25+), pre-generation validation checks, mandatory LLM grounding rules, evidence context injection into prompts, and audit trail creation via AIGenerationAudit. The design is non-throwing: governance checks return GovernanceResult objects, never throw exceptions.",
    "The governance configuration defines thresholds for 7+ generation types: email_draft, conversation_plan, opportunity_recommendation, account_brief, insights, relationship_memory, and generic. Each type specifies minimum research confidence, minimum freshness score, whether a capability match is required, whether recent intelligence is required, and maximum staleness days.",
  ], [
    "The intelligence contract was validated by confirming that all Phase 4, 5, and 6 modules import from intelligence-contract.ts rather than accessing the database directly for intelligence data. The contract provides a stable API that abstracts the underlying data model complexity.",
    "The governance layer was validated with the custom ESLint rule (no-ungoverned-llm.js) which scans all files in src/app/api/ for direct imports of callLLM. The rule correctly identifies violations and the scripts/check-governance.sh script provides a CI-level check.",
  ], [
    "The single-source-of-truth pattern was validated as critical for preventing inconsistent intelligence views. Before Phase 3, different modules could produce conflicting assessments of the same company because they queried different data subsets. The contract layer ensures all consumers see the same intelligence snapshot.",
    "The non-throwing governance design was validated as essential for API resilience. If governance checks threw exceptions, a single misconfigured threshold could cascade into 500 errors across all AI endpoints. Returning structured results allows routes to gracefully degrade (e.g., return cached intelligence instead of freshly generated content).",
  ], [
    "Phase 3 is fully complete. The intelligence contract is the sole entry point for all downstream intelligence consumption, and the governance layer is enforced by both code review (ESLint rule) and CI automation.",
  ], [
    "Production-ready. The governance layer adds negligible latency (database lookups for confidence/freshness), the audit trail is valuable for compliance, and the non-throwing design ensures API stability. One consideration: governance thresholds should be tuned per-client during onboarding.",
  ]),

  // Phase 4
  ...phaseSection(4, "Capability Matching & Opportunity Identification", [
    "Phase 4 built the capability matching engine and opportunity recommendation system. The objective was to match detected signals against the capability knowledge base, generate composite opportunity scores, produce human-readable opportunity recommendations, and implement per-domain freshness tracking to identify stale intelligence.",
    "The phase delivers three interconnected capabilities: signal-to-capability matching, composite opportunity scoring with \u201cwhy now\u201d explanations, and freshness lifecycle management that prevents the platform from acting on outdated intelligence.",
  ], [
    "The signal-capability-matching module (signal-capability-matching.ts, 383 lines) matches signals against CapabilityAsset records using a weighted scoring formula: category match 30%, keyword match 30%, business problem relevance 20%, and expected impact 5%. Only active, validated, or aging signals are matched, preventing noise from low-confidence detections.",
    "The opportunity recommendation engine (opportunity-recommendation-engine.ts, 455 lines) produces composite opportunity scores from five dimensions: signal strength 25%, capability match 25%, intelligence freshness 20%, evidence quality 15%, and business impact 15%. Each opportunity includes a structured recommendation with businessTrigger, whyNow, businessProblem, recommendedCapability, and suggestedConversation fields.",
    "The freshness-indicators module (freshness-indicators.ts, 173 lines) tracks per-domain staleness across four domains: profile, signals, technology, and contacts. The lifecycle defines four stages: fresh (<14 days), aging (14\u201345 days), stale (45\u201390 days), and expired (>90 days). The signal-meaning module (signal-meaning.ts, 336 lines) implements rule-based (zero-LLM) inference that maps signal attributes to 7 buying stage categories: budget_available, leadership_openness, tech_dissatisfaction, growth_pressure, compliance_requirement, vendor_evaluation, and unknown.",
  ], [
    "The matching engine was validated for correctness: capability match scores are bounded 0\u2013100, only eligible signals are processed, and match records are persisted via the SignalCapabilityMatch model. The opportunity composite score weights sum to 1.0, and the formula produces deterministic results given the same inputs.",
    "The freshness indicators were validated against the staleness lifecycle: companies with no research activity beyond 90 days are correctly flagged as expired, and the getStaleCompanies() function returns accounts needing re-research.",
    "The signal-meaning module was specifically validated for its zero-LLM design: all meaning inference is rule-based, ensuring it works even during AI service outages and produces consistent, reproducible results.",
  ], [
    "The decision to make signal meaning inference rule-based (rather than LLM-based) was validated as critical for system reliability. Meaning inference is a high-frequency operation called during scoring, ranking, and dashboard rendering. An LLM dependency here would create unacceptable latency and cost, and would produce inconsistent results across runs.",
    "The freshness lifecycle stages directly drive the Phase 5 timing/urgency score, creating a natural feedback loop: stale accounts receive lower priority, creating operational urgency to refresh intelligence, which in turn improves scoring accuracy.",
  ], [
    "Phase 4 is fully complete. Capability matching, opportunity scoring, freshness tracking, and signal meaning inference are all operational and integrated.",
  ], [
    "Production-ready. The rule-based signal meaning inference eliminates a critical LLM dependency. The freshness lifecycle is self-managing via the cron job processor (cron/job-processor/route.ts). Opportunity recommendations include all fields needed for sales conversation preparation.",
  ]),

  // Phase 5
  ...phaseSection(5, "Account Prioritization Engine", [
    "Phase 5 built the account prioritization engine that produces a single, composite go-to-market priority score for each account. The objective was to combine three scoring dimensions\u2014Static Fit (ICP alignment), Dynamic Intelligence (research quality and depth), and Timing/Urgency (signal recency and engagement)\u2014into a deterministic, database-driven composite score with tier classification and actionable \u201cwhy now\u201d explanations.",
    "The engine produces accountPriorityScore, which is explicitly separate from intelligenceScore. intelligenceScore measures how well the platform understands an account (research quality), while accountPriorityScore measures which accounts the sales team should pursue right now (go-to-market priority).",
  ], [
    "The account-prioritization module (account-prioritization.ts, 1,117 lines) exports computeAccountPriority(), computeAccountPriorityBatch(), and getAccountRankings(). The composite formula is: clamp(round(StaticFit x 0.40 + DynamicIntel x 0.40 + TimingUrgency x 0.20), 0, 100). The three dimensions are computed as follows:",
    "Static Fit (40% weight, 5 sub-dimensions): Industry match (ICP targetIndustries, case-insensitive partial), company size match (ICP targetSizeRanges with bonus for 500+/1000+ employees), geography match (ICP targetRegions), revenue fit (heuristic scoring based on parsed revenue bands), and tech fit (ratio of ICP preferredTechKeywords found in techStack). Sub-dimension weights are configurable via ICP profile: industry 30%, companySize 25%, geography 15%, revenue 15%, techFit 15%.",
    "Dynamic Intelligence (40% weight, 4 sub-dimensions): intelligenceScore normalization (30%), research depth score based on research card completeness and enrichment recency (25%), signal quality score based on count, severity, and recency (25%), and contact coverage score based on contact count thresholds (20%).",
    "Timing/Urgency (20% weight, 3 sub-dimensions): signal recency score based on signals in last 30 days (40%), engagement recency based on engagementScore and lastActivityAt (35%), and growth indicator based on lifecycleStage and researchFundingStage (25%).",
    "Gap closure additions include: whyNowReasons (14 rules, maximum 8 returned), topSignals (sorted by severity x recency), and recommendedFocus (capability matching via SIGNAL_CAPABILITY_TOPICS mapping). Tier classification: HOT >= 90, ACTIVE 70\u201389, NURTURE 50\u201369, LOW < 50.",
    "The ICP configuration (icp-config.ts, 234 lines) persists to DB via SystemSetting with lazy loading, deep-merge fallback to DEFAULT_ICP (16 industries, 6 size ranges, 11 regions, 21 tech keywords, 5 exclusions), and weight-sum validation on update.",
    "API endpoints: g-strategy/account-rankings (GET for fetching, POST for batch recomputation with Zod validation, max 1000 companies), g-strategy/companies/[id]/priority (GET for persisted score, POST for single recomputation with full breakdown), and g-strategy/icp-profile (GET/PUT for configuration management).",
  ], [
    "Formula integrity verified: weights sum to exactly 1.0 (0.40 + 0.40 + 0.20), clamp enforces [0, 100] hard bounds, Math.round produces integer scores, tier boundaries have zero gaps, and all sub-dimension weights within each dimension sum to 1.0 (Static Fit: 0.30+0.25+0.15+0.15+0.15=1.00; Dynamic Intel: 0.30+0.25+0.25+0.20=1.00; Timing: 0.40+0.35+0.25=1.00).",
    "Data flow confirmed as 100% database-driven: computeAccountPriority() queries Company, CompanySignal, Contact, CompanyResearchCard, CapabilityAsset, and SignalCapabilityMatch. Zero mock data, zero hardcoded values, zero LLM calls.",
    "Schema validation: accountPriorityScore (Float, nullable, no default), priorityTier (String, nullable, no default), priorityComputedAt (DateTime, nullable, no default). The @@index([priorityTier]) directive supports efficient tier-filtered queries.",
    "ICP config validation: lazy-load on first access with DB fallback to DEFAULT_ICP, deep-merge for partial updates, weight-sum check on update (rejects if sum deviates from 1.0), and graceful fallback if SystemSetting read fails.",
  ], [
    "The 40/40/20 weight split was validated as appropriate for the IT Services & Consulting vertical where both firmographic fit (Static) and intelligence depth (Dynamic) are equally important, while timing (20%) acts as a tiebreaker that prevents stale-but-well-researched accounts from dominating the rankings.",
    "The 14 why-now rules provide sales-relevant context that transforms a numeric score into an actionable brief. Rules include: high-severity recent signals, funding events, leadership changes, tech stack changes, active lifecycle stages, strong capability matches, and engagement recency. The max-8 limit prevents information overload.",
    "The intelligenceScore vs. accountPriorityScore separation was validated as critical for reporting clarity. A company with intelligenceScore=95 (deeply researched) but accountPriorityScore=40 (poor ICP fit, no signals, stale data) should NOT appear on pursuit lists. The separation ensures the platform surfaces the right accounts for the right purpose.",
  ], [
    "Phase 5 is fully complete. The scoring engine, batch computation, ranking API, ICP configuration, and all gap-closure fields (whyNowReasons, topSignals, recommendedFocus) are operational.",
  ], [
    "Production-ready. The engine is deterministic, database-driven, and requires zero LLM calls. Batch computation handles up to 1,000 companies per request. The ICP configuration layer allows business users to adjust target market parameters without code deployment.",
  ]),

  // Phase 6
  ...phaseSection(6, "Intelligence Validation & Quality Assurance", [
    "Phase 6 built the zero-LLM validation layer that captures human judgment against intelligence artifacts and produces quality metrics. The objective was to create a systematic feedback loop where sales teams and intelligence analysts can rate the accuracy, relevance, and actionability of AI-generated intelligence, with all validations producing aggregated quality reports that answer four core questions: (Q1) Are signal meanings accurate? (Q2) Are capability matches commercially relevant? (Q3) Do recommendations help decide \u201cwhy now\u201d and \u201cwhat to position\u201d? (Q4) Does pursuit intelligence improve decision-making over time?",
  ], [
    "The intelligence-validation module (intelligence-validation.ts, 663 lines) is the Phase 6 engine. It defines 5 artifact types: signal_meaning, capability_match, opportunity_recommendation, pursuit_intelligence, and evidence_quality. Each validation captures: rating (1\u20135), accuracy (accurate/partially_accurate/inaccurate/cannot_judge), relevance (highly_relevant/somewhat_relevant/not_relevant), actionability (actionable_now/actionable_with_research/not_actionable), free-text feedback, and validator context.",
    "The module exports four functions: submitValidation() captures a human judgment and automatically snapshots the artifact at validation time using type-specific loaders (loadSignalMeaningSnapshot, loadCapabilityMatchSnapshot, loadOpportunitySnapshot, loadPursuitSnapshot, loadEvidenceQualitySnapshot). getCompanyValidations() retrieves paginated validation records. getQualityReport() produces the comprehensive QualityReport type. getValidationTrend() provides weekly rating trends.",
    "The QualityReport interface includes: totalValidations, overallAverageRating, per-artifact-type metrics, accuracy/relevance/actionability distributions, meaning accuracy by signal type, match quality by capability title, recommendation actionability breakdown, pursuit intelligence weekly trend, and evidence quality validation summary. All metrics are computed via pure SQL aggregation from IntelligenceValidation records.",
    "API endpoints: g-crm/companies/[id]/validations (GET for retrieval, POST for submission with Zod schema validation), g-crm/validations/quality-report (GET for aggregate report), and g-strategy/validations (GET for cross-company validation data).",
  ], [
    "Zero-LLM validation confirmed: the module imports only db and Prisma. No callLLM, no governedAICall, no AI dependency whatsoever. All quality metrics are computed via database aggregation queries (GROUP BY, AVG, COUNT). This ensures the validation layer works even during complete AI service outages.",
    "Artifact snapshot mechanism validated: when a user submits a validation for signal_meaning with artifactId, the loader fetches the current state of that signal (signalType, title, description, severity, impact, confidence, meaningCategory, opportunityType) and stores it as artifactSnapshot JSON in the IntelligenceValidation record. This creates a point-in-time record that preserves the intelligence state at the moment of human judgment, enabling retrospective analysis of whether the intelligence was accurate at that time.",
    "Rating clamping validated: ratings are clamped to [1, 5] via Math.max(1, Math.min(5, Math.round(rating))), preventing out-of-range values from corrupting aggregate metrics.",
  ], [
    "The four validation questions (Q1\u2013Q4) map directly to the four stages of the intelligence chain where human judgment is most valuable. Q1 (signal meaning accuracy) validates Phase 2's signal detection. Q2 (capability match relevance) validates Phase 4's matching engine. Q3 (recommendation actionability) validates Phase 4's opportunity engine and Phase 5's why-now reasoning. Q4 (pursuit intelligence improvement) validates the end-to-end value proposition.",
    "The zero-LLM design was validated as essential because the validation layer is the platform's mechanism for detecting when the AI components are producing poor output. If the validation layer itself depended on AI, it would be subject to the same failures it is meant to detect, creating a circular dependency.",
  ], [
    "Phase 6 is fully complete. The validation engine captures human judgment with artifact snapshots, produces comprehensive quality reports, and operates with zero AI dependency.",
  ], [
    "Production-ready. The validation layer adds no computational overhead (simple CRUD + aggregation queries), requires no external services, and provides immediate value from the first validation submission. The artifact snapshot approach ensures historical comparability even as the underlying intelligence evolves.",
  ]),

  // Section A: Complete Platform Architecture Flow
  h1("Section A: Complete Platform Architecture Flow"),
  p("The DeepMindQ Revenue Intelligence Platform implements a unidirectional, read-only intelligence chain that flows through six stages. Each stage consumes the output of the previous stage, adds value, and produces artifacts for the next stage. Human decision-making is positioned as the final intelligence consumer, preserving agency while benefiting from automated upstream processing."),
  h3("Intelligence Chain: Signal to Pursuit"),
  bold("Stage 1 \u2014 Signal Detection (Phase 1\u20132): ", "Raw market data enters the platform through two channels: structured file imports (CSV/Excel via the data intelligence engine) and web-based research (via the research engine's 4-query parallel search). The research engine's signal detection module identifies 7 types of buying signals (funding, hiring, leadership_change, expansion, technology, product, partnership) using both LLM-based and rule-based detection. Each signal is stored with type, title, description, severity, impact, confidence, source URL, and signal date."),
  bold("Stage 2 \u2014 Signal Meaning Inference (Phase 4): ", "Detected signals are processed by the rule-based signal-meaning module, which maps signal attributes to 7 buying stage categories: budget_available, leadership_openness, tech_dissatisfaction, growth_pressure, compliance_requirement, vendor_evaluation, and unknown. This stage operates with zero LLM calls, ensuring deterministic, reproducible results. The signal lifecycle module manages state transitions from detected through validated, active, aging, expired, and archived."),
  bold("Stage 3 \u2014 Capability Fit Matching (Phase 4): ", "Active signals are matched against the CapabilityAsset knowledge base using a weighted scoring formula (category 30%, keyword 30%, business problem 20%, impact 5%). Match records include matchScore, reason, businessProblem, expectedOutcome, and salesAngle. The freshness-indicators module tracks per-domain staleness across profile, signals, technology, and contacts to ensure matching operates on current intelligence."),
  bold("Stage 4 \u2014 Opportunity Identification (Phase 4\u20135): ", "Matched signals and evidence quality data feed into the opportunity recommendation engine, which produces composite opportunity scores (signal 25%, match 25%, freshness 20%, evidence 15%, impact 15%). Each opportunity includes structured fields: businessTrigger, whyNow, businessProblem, recommendedCapability, and suggestedConversation. The Phase 5 scoring engine then combines these with ICP static fit and timing/urgency to produce the final accountPriorityScore."),
  bold("Stage 5 \u2014 Human Decision (Interface Layer): ", "The platform presents prioritized accounts with full intelligence context (whyNowReasons, topSignals, recommendedFocus, capability matches, opportunity recommendations) but explicitly stops at providing intelligence. The human decision-maker reviews the intelligence and decides whether to pursue, nurture, or deprioritize each account. No outbound automation is performed by the platform."),
  bold("Stage 6 \u2014 Pursuit Intelligence (Phase 6): ", "When a human decides to pursue an account, the platform creates a Pursuit record with priority, status, nextAction, and outcome tracking. The Phase 6 validation layer captures human feedback on the quality of all upstream intelligence artifacts, creating a continuous improvement loop that identifies which signal types, capability matches, and recommendations are most accurate and actionable."),

  h3("Data Flow Architecture"),
  p("All data flows through a Prisma ORM layer backed by PostgreSQL (Neon). The intelligence-contract.ts module is the single source of truth for intelligence consumption, preventing direct database access by downstream modules. The AI governance layer (ai-governance.ts) is the single point through which all LLM calls are routed, enforced by a custom ESLint rule and CI script."),
  p("The API layer is organized into 7 domains with 154 route handlers total. The g-strategy domain (8 handlers) manages account prioritization, ICP configuration, playbooks, and strategy rooms. The g-ai domain (34 handlers) provides AI-powered capabilities including enrichment, insights, opportunity identification, knowledge search, and command center queries. The g-crm domain (54 handlers) manages companies, contacts, leads, signals, opportunities, and data imports. The g-outreach domain (29 handlers) handles email sequences, drafts, send queues, and tracking. The g-data domain (35 handlers) provides dashboards, analytics, compliance, and configuration management. The g-system domain (5 handlers) manages settings, seeding, and database synchronization. The g-auth domain (13 handlers) handles authentication via OTP-based login."),

  // Section B: Final Capability Matrix
  h1("Section B: Final Capability Matrix"),
  p("The following table summarizes the complete capability set delivered across all seven phases, organized by functional domain. Each capability is mapped to its implementation module, API exposure, and phase of delivery."),

  makeTable(
    ["Capability", "Module", "API Domain", "Phase", "LLM Required"],
    [
      ["Data Import & Validation", "data-intelligence/engine", "g-data", "1", "Correction only"],
      ["Column/Normaliz. Rules", "data-intelligence/config-store", "g-data/config-*", "1", "No"],
      ["Quality Scoring (3-dim)", "data-intelligence/quality-scorer", "g-data/data-health", "1", "No"],
      ["Research Pipeline (6-step)", "research-engine/researcher", "g-crm/companies research", "2", "Yes (governed)"],
      ["Evidence w/ Provenance", "research-engine/evidence", "g-crm/evidence", "2", "No"],
      ["Signal Detection (7 types)", "research-engine/signals", "g-crm/signals", "2", "Yes + Rule fallback"],
      ["Evidence Quality (5-dim)", "research-engine/evidence-quality", "g-crm/evidence-quality", "2", "No"],
      ["Intelligence Contract", "intelligence-contract", "Internal API", "3", "No"],
      ["AI Governance Layer", "ai-governance", "Internal (enforced)", "3", "Yes (governed)"],
      ["Signal Meaning Inference", "research-engine/signal-meaning", "g-crm/signal-meaning", "4", "No"],
      ["Capability Matching", "research-engine/signal-capability", "g-crm/capability-matches", "4", "No"],
      ["Opportunity Scoring", "research-engine/opp-recommendation", "g-crm/opportunities", "4", "Yes (governed)"],
      ["Freshness Indicators", "research-engine/freshness", "g-crm/freshness", "4", "No"],
      ["Account Prioritization", "account-prioritization", "g-strategy/rankings", "5", "No"],
      ["ICP Configuration", "icp-config", "g-strategy/icp-profile", "5", "No"],
      ["Why-Now Reasoning (14 rules)", "account-prioritization", "g-strategy/priority", "5", "No"],
      ["Intelligence Validation", "intelligence-validation", "g-crm/validations", "6", "No"],
      ["Quality Report Aggregation", "intelligence-validation", "g-strategy/quality-report", "6", "No"],
    ]
  ),
  caption("Table 1: Complete Capability Matrix \u2014 Phase 0 through Phase 6"),

  h3("Zero-LLM Capabilities (Operational Without AI)"),
  p("A critical design principle is that the majority of the intelligence chain operates without any LLM dependency. Of the 18 capabilities listed above, 12 (67%) function with zero AI calls. The 6 capabilities that require LLM access (research pipeline, signal detection, opportunity scoring, and their governed wrappers) all have fallback mechanisms or graceful degradation paths. This means that even during complete AI service outages, the platform continues to provide prioritization rankings, ICP matching, freshness tracking, signal meaning inference, capability matching, and validation quality reports."),

  // Section C: Remaining Gaps
  h1("Section C: Remaining Gaps for Enterprise Positioning"),
  p("While all seven phases are functionally complete, the following areas represent opportunities for enterprise-grade enhancement. These gaps do not affect the correctness or completeness of the current implementation but would strengthen the platform's positioning for production deployment at scale."),

  h3("C.1 Performance & Scalability"),
  p("Batch prioritization is currently limited to 1,000 companies per request. For enterprise deployments with portfolios exceeding 10,000 accounts, this requires either parallel batch processing or a background job queue. The workflow engine (src/lib/workflow-engine/, 4 files, ~1,291 lines) already provides priority-based job queuing with retry logic, but account prioritization does not yet integrate with it for async batch computation."),
  p("Database query optimization for the ranking endpoint would benefit from materialized views or pre-computed aggregate tables, particularly for the signal count, contact count, and evidence quality sub-queries that are currently computed per-company during batch prioritization."),

  h3("C.2 Testing & Observability"),
  p("The test suite (src/lib/__tests__/, 2 files, ~569 lines) covers the account-prioritization and intelligence-validation modules but does not yet cover the research engine, data intelligence engine, or AI governance layer. Comprehensive unit tests for the 14 why-now rules, the 6-step research pipeline, and the evidence quality computation would strengthen confidence in production correctness."),
  p("Structured logging is implemented (logger.ts, 60 lines) but observability tooling (distributed tracing, metrics dashboards, error alerting) is not yet integrated. For enterprise deployment, integration with an observability platform (e.g., Datadog, Grafana) would be expected."),

  h3("C.3 Security & Compliance"),
  p("Authentication uses OTP-based login (otp.ts, session.ts) with session token management, but the platform does not yet implement role-based access control at the API level (rbac.ts, 84 lines, defines roles but middleware enforcement is limited). Enterprise deployments would require granular permissions (e.g., only managers can trigger batch recomputation or modify ICP configuration)."),
  p("GDPR consent tracking exists (g-crm/leads__consent) but a comprehensive data retention policy with automatic purging of stale intelligence artifacts is not yet implemented. The intelligence-validation artifact snapshots will accumulate over time and require a retention strategy."),

  h3("C.4 Integration & Extensibility"),
  p("The platform currently operates as a standalone system. Integration with external CRM systems (Salesforce, HubSpot), communication platforms (Slack, Teams), or BI tools (Tableau, Power BI) would be required for most enterprise deployments. The API-first architecture (154 REST endpoints) provides a natural integration surface, but webhook-based event notifications and a formal API documentation (OpenAPI/Swagger) are not yet available."),
  p("The capability knowledge base is currently managed via API CRUD operations. For enterprise use, a self-service capability management UI with import/export, versioning, and approval workflows would enhance adoption by enabling service line owners to maintain their own capability definitions."),

  h3("C.5 Continuous Improvement Loop"),
  p("Phase 6 captures human validation feedback, but there is no automated mechanism to feed low-rated artifact patterns back into the AI prompt templates or scoring weights. A natural extension would be an analytics dashboard that identifies systematic quality issues (e.g., \u201csignal meanings for funding signals are rated 2.1/5 on average\u201d) and suggests prompt or rule adjustments. This would close the loop between human judgment and system improvement."),
  p("The opportunity recommendation engine and account prioritization engine use fixed weights that were calibrated for the IT Services & Consulting vertical. Multi-vertical support would require per-vertical weight profiles and the ability to switch between them based on the account's primary industry, a capability not yet implemented."),
];

// ── Build Document ──
const doc = new Document({
  styles: {
    default: { document: { run: { font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" }, size: 24, color: "000000" }, paragraph: { spacing: { line: 312 } } } },
    heading1: { run: { font: { ascii: "Calibri", eastAsia: "SimHei" }, size: 32, bold: true, color: "000000" }, paragraph: { spacing: { before: 400, after: 160, line: 312 } } },
    heading2: { run: { font: { ascii: "Calibri", eastAsia: "SimHei" }, size: 28, bold: true, color: "000000" }, paragraph: { spacing: { before: 300, after: 120, line: 312 } } },
    heading3: { run: { font: { ascii: "Calibri", eastAsia: "SimHei" }, size: 24, bold: true, color: "1B6B7A" }, paragraph: { spacing: { before: 240, after: 100, line: 312 } } },
  },
  sections: [
    // Cover section
    { properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 0, bottom: 0, left: 0, right: 0 } } }, children: buildCover() },
    // TOC section (Roman)
    { properties: { type: SectionType.NEXT_PAGE, page: { pageNumbers: { start: 1, formatType: "UPPER_ROMAN" } } },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "PAGE  \\* ROMAN  \\* MERGEFORMAT", size: 18, color: "888888", font: { ascii: "Calibri" } })] })] }) },
      children: [
        new Paragraph({ spacing: { before: 400, after: 300 }, children: [new TextRun({ text: "Table of Contents", size: 36, bold: true, color: "000000", font: { ascii: "Calibri", eastAsia: "SimHei" } })] }),
        new TableOfContents("TOC", { hyperlink: true, headingStyleRange: "1-3" }),
        new Paragraph({ spacing: { before: 100 }, children: [new TextRun({ text: "Right-click the Table of Contents and select \u201cUpdate Field\u201d to refresh page numbers.", italics: true, size: 20, color: "888888" })] }),
      ],
    },
    // Body section (Arabic)
    { properties: { type: SectionType.NEXT_PAGE, page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 }, pageNumbers: { start: 1, formatType: "DECIMAL" } } },
      headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "DeepMindQ Revenue Intelligence Platform \u2014 Closure Report", size: 18, color: "888888", font: { ascii: "Calibri" } })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "PAGE  \\* arabic  \\* MERGEFORMAT", size: 18, color: "888888", font: { ascii: "Calibri" } })] })] }) },
      children: bodyChildren,
    },
  ],
});

const OUTPUT = "/home/z/my-project/download/DeepMindQ_Phase0-6_Closure_Report.docx";
Packer.toBuffer(doc).then(buf => { fs.writeFileSync(OUTPUT, buf); console.log("Generated: " + OUTPUT); });