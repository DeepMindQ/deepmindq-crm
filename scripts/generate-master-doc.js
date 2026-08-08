const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, PageNumber, NumberFormat, AlignmentType, HeadingLevel,
  WidthType, BorderStyle, ShadingType, PageBreak, TableOfContents,
  LevelFormat
} = require("docx");
const fs = require("fs");

// === COLOR PALETTE: Tech/Enterprise Intelligence ===
const P = {
  primary: "0F2B46",
  body: "1A1A2E",
  secondary: "6B7B8D",
  accent: "2563EB",
  surface: "F1F5F9",
  coverBg: "0F2B46",
  coverAccent: "2563EB",
  white: "FFFFFF",
  lightGray: "E2E8F0",
  green: "059669",
  red: "DC2626",
  amber: "D97706",
  blue: "2563EB",
  purple: "7C3AED"
};

const c = (hex) => hex.replace("#", "");
const allNoBorders = {
  top: { style: BorderStyle.NONE, size: 0 },
  bottom: { style: BorderStyle.NONE, size: 0 },
  left: { style: BorderStyle.NONE, size: 0 },
  right: { style: BorderStyle.NONE, size: 0 },
};
const thinBorders = {
  top: { style: BorderStyle.SINGLE, size: 1, color: c(P.lightGray) },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: c(P.lightGray) },
  left: { style: BorderStyle.SINGLE, size: 1, color: c(P.lightGray) },
  right: { style: BorderStyle.SINGLE, size: 1, color: c(P.lightGray) },
};
const noBorderInside = {
  top: { style: BorderStyle.SINGLE, size: 1, color: c(P.lightGray) },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: c(P.lightGray) },
  left: { style: BorderStyle.NONE },
  right: { style: BorderStyle.NONE },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: c(P.lightGray) },
  insideVertical: { style: BorderStyle.NONE },
};

// === HELPER FUNCTIONS ===
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 480, after: 200 },
    children: [new TextRun({ text, bold: true, size: 32, color: c(P.primary), font: { ascii: "Calibri", eastAsia: "SimHei" } })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 360, after: 160 },
    children: [new TextRun({ text, bold: true, size: 28, color: c(P.primary), font: { ascii: "Calibri", eastAsia: "SimHei" } })],
  });
}
function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, size: 24, color: c(P.secondary), font: { ascii: "Calibri", eastAsia: "SimHei" } })],
  });
}
function body(text) {
  return new Paragraph({
    spacing: { after: 120, line: 312 },
    children: [new TextRun({ text, size: 22, color: c(P.body), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })],
  });
}
function bodyBold(text) {
  return new Paragraph({
    spacing: { after: 120, line: 312 },
    children: [new TextRun({ text, size: 22, color: c(P.body), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" }, bold: true })],
  });
}
function emptyPara() {
  return new Paragraph({ spacing: { after: 60 }, children: [] });
}

function statusCell(status, width) {
  const colors = {
    "PRODUCTION": c(P.green), "FIX REQUIRED": c(P.red),
    "REDIRECT": c(P.amber), "PLANNED": c(P.blue), "PHASE 0": c(P.red),
    "PHASE 1": c(P.amber), "PHASE 2": c(P.amber), "PHASE 3": c(P.amber),
    "PHASE 4": c(P.blue), "PHASE 5": c(P.blue), "PHASE 6": c(P.blue),
  };
  return new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    shading: { type: ShadingType.CLEAR, fill: c(P.surface) },
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
      new TextRun({ text: status, size: 18, bold: true, color: colors[status] || c(P.body), font: { ascii: "Calibri" } })
    ]})],
  });
}

function dataRow(cells, isHeader = false) {
  return new TableRow({
    tableHeader: isHeader,
    cantSplit: true,
    children: cells.map((text, i) => new TableCell({
      width: { size: cells._widths ? cells._widths[i] : Math.floor(100 / cells.length), type: WidthType.PERCENTAGE },
      shading: isHeader ? { type: ShadingType.CLEAR, fill: c(P.primary) } : undefined,
      margins: { top: 50, bottom: 50, left: 80, right: 80 },
      children: [new Paragraph({
        alignment: i === 0 && !isHeader ? AlignmentType.LEFT : AlignmentType.CENTER,
        children: [new TextRun({
          text: String(text), size: 18,
          bold: isHeader, color: isHeader ? c(P.white) : c(P.body),
          font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" }
        })]
      })]
    }))
  });
}

// === COVER PAGE ===
function buildCover() {
  return {
    properties: {
      page: { size: { width: 11906, height: 16838 }, margin: { top: 0, bottom: 0, left: 0, right: 0 } },
    },
    children: [
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [new TableRow({
          height: { value: 16838, rule: "exact" },
          children: [new TableCell({
            width: { size: 100, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill: c(P.coverBg) },
            verticalAlign: "top",
            borders: allNoBorders,
            margins: { top: 4000, bottom: 800, left: 1200, right: 1200 },
            children: [
              new Paragraph({ spacing: { after: 200 }, children: [
                new TextRun({ text: "DEEPMINDQ", size: 20, color: c(P.coverAccent), font: { ascii: "Calibri" }, bold: true, characterSpacing: 200 })
              ]}),
              new Paragraph({ spacing: { after: 100 }, children: [
                new TextRun({ text: "Enterprise Intelligence", size: 56, bold: true, color: c(P.white), font: { ascii: "Calibri" } })
              ]}),
              new Paragraph({ spacing: { after: 100 }, children: [
                new TextRun({ text: "Operating System", size: 56, bold: true, color: c(P.white), font: { ascii: "Calibri" } })
              ]}),
              new Paragraph({ spacing: { after: 600 }, children: [] }),
              new Paragraph({ spacing: { after: 80 }, border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: c(P.coverAccent) } }, children: [] }),
              new Paragraph({ spacing: { before: 200, after: 100 }, children: [
                new TextRun({ text: "Master Product Specification", size: 28, color: c(P.coverAccent), font: { ascii: "Calibri" }, bold: true })
              ]}),
              new Paragraph({ spacing: { after: 80 }, children: [
                new TextRun({ text: "Redefinition & 22-Week Transformation Plan", size: 24, color: c(P.secondary), font: { ascii: "Calibri" } })
              ]}),
              new Paragraph({ spacing: { before: 600, after: 80 }, children: [
                new TextRun({ text: "Version 1.0  |  August 2026  |  CONFIDENTIAL", size: 18, color: c(P.secondary), font: { ascii: "Calibri" } })
              ]}),
            ]
          })]
        })]
      })
    ]
  };
}

// === DOCUMENT BODY ===
function buildBody() {
  const children = [];

  // ---- SECTION 1: PRODUCT IDENTITY ----
  children.push(h1("1. Product Identity"));
  children.push(body("DeepMindQ is an Enterprise Intelligence Operating System that continuously understands your buyer universe, monitors business changes, connects those changes to your capabilities, and surfaces evidence-backed intelligence so your teams know who matters, why now, and what context to bring into every conversation."));
  children.push(emptyPara());

  children.push(h2("1.1 Core Philosophy"));
  children.push(bodyBold("Intelligence Before Execution."));
  children.push(body("DeepMindQ provides the intelligence layer that enables better human decisions. It does not automate outreach, replace CRM systems, or execute sales activities. The core cycle is: Understand, Recommend, Explain, Human Decision, Learn."));
  children.push(emptyPara());
  children.push(body("The fundamental value transformation is:"));
  children.push(body("Data -> Intelligence -> Opportunity -> Human Action."));
  children.push(body("DeepMindQ sits above CRM, data platforms, documents, and market intelligence, becoming the intelligence layer that helps enterprises understand before they engage."));
  children.push(emptyPara());

  children.push(h2("1.2 Product Category"));
  children.push(body("DeepMindQ is NOT a CRM replacement, sales automation tool, email platform, dashboard, lead database, or AI chatbot. It is an Enterprise Intelligence Operating System comparable to Palantir Foundry style intelligence, Databricks intelligence applications, and C3 AI enterprise intelligence, but focused on understanding enterprise reality, reasoning over knowledge, recommending decisions, and supporting human action with evidence."));
  children.push(emptyPara());

  children.push(h2("1.3 Engineering Test"));
  children.push(body("Every future feature must pass this test: \"Does this make DeepMindQ understand businesses better, reason better, explain better, or learn better?\" If yes, build. If it automates execution, evaluate carefully. If it belongs in CRM/outreach territory, redirect or exclude."));
  children.push(emptyPara());

  // ---- SECTION 2: BUSINESS LOGIC SPECIFICATION ----
  children.push(h1("2. Complete Business Logic (17 Steps)"));

  const steps = [
    ["Step 1", "Buyer Universe Upload", "Client uploads companies/contacts via CSV/Excel. System validates, deduplicates, scores quality, and activates intelligence. Parent-subsidiary structures supported.", "75%"],
    ["Step 2", "Data Intelligence Foundation", "Email validation (7 DNS checks), duplicate detection (Levenshtein), contact-company validation, data trust scoring, health monitoring.", "85%"],
    ["Step 3", "Client Capability Intelligence", "Upload services, expertise, case studies, differentiators. Auto-embedding for semantic matching. Signal-to-capability matching engine. Opportunity generation.", "80%"],
    ["Step 4", "Knowledge Intelligence Layer", "Upload documents (PDF, DOCX, URL, TXT, MD). Extract, chunk, embed, vector store, AI retrieval. Knowledge graph creation from documents.", "65%"],
    ["Step 5", "Knowledge Intelligence Graph", "21 entity types, 30 relationship types. Graph traversal, path-finding, reasoning. Currently in-memory only, persistence disabled.", "75%"],
    ["Step 6", "Continuous Signal Intelligence", "Monitor external changes: leadership, hiring, tech, funding, market. Web-search polling, RSS, website connectors. Adaptive by company size.", "60%"],
    ["Step 7", "Signal Interpretation Engine", "Cross-signal correlation (8 patterns). Multi-signal narrative generation. Business implication mapping.", "70%"],
    ["Step 8", "Opportunity Intelligence Engine", "Static Fit (ICP 40%) + Dynamic Signals (40%) + Timing (20%) = Opportunity score. Evidence chain. Confidence scoring.", "80%"],
    ["Step 9", "Contact Intelligence", "Buying role classification (6 roles). Influence scoring. Buying committee mapping. Persona-capability alignment.", "65%"],
    ["Step 10", "Capability-Buyer Matching", "Automatic: Signal detected -> capability match -> opportunity recommendation. Keyword + category matching.", "80%"],
    ["Step 11", "AI Executive Briefing", "7-section structured brief: exec summary, company intel, signals, contacts, opportunity, conversation context, evidence.", "85%"],
    ["Step 12", "Human Decision Layer", "Unified Engage/Monitor/Ignore workflow across all intelligence surfaces. Disposition tracking.", "65%"],
    ["Step 13", "Feedback & Learning Loop", "User feedback -> calibration adjustment -> confidence improvement -> better recommendations. 4 learning loops exist but disconnected.", "40%"],
    ["Step 14", "Technical Differentiators", "Evidence-grounded AI (TRUST metadata). Hybrid retrieval (semantic + keyword + entity + graph + recency + source reliability).", "70%"],
    ["Step 15", "Enterprise Memory (4 Layers)", "Working, Conversation, Enterprise, Institutional memory. Only Conversation persists currently.", "45%"],
    ["Step 16", "Product Boundaries", "NOT email automation, NOT CRM replacement, NOT sales outreach. Intelligence only.", "30%"],
    ["Step 17", "Complete User Journey", "Dashboard -> top opportunities -> investigate signals -> prepare conversation -> decide -> learn. Currently reactive, not proactive.", "35%"],
  ];

  const stepWidths = [12, 20, 50, 18];
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: noBorderInside,
    rows: [
      dataRow(["Step", "Component", "Description", "Ready %"], true),
      ...steps.map(s => dataRow([s[0], s[1], s[2], s[3]]))
    ]
  }));
  children.push(emptyPara());

  // ---- SECTION 3: CURRENT STATE ASSESSMENT ----
  children.push(h1("3. Current State Assessment"));
  children.push(h2("3.1 Platform Scale"));
  children.push(body("DeepMindQ is a significantly advanced platform: 174 API routes, 105 Prisma models (3,512 lines of schema), 76 screen keys mapping to 60+ UI components, 61,500+ lines of intelligence code, 195 test files. The intelligence foundation is genuinely deep."));
  children.push(emptyPara());
  children.push(h2("3.2 What Is Production-Ready"));
  children.push(body("AI Governance Layer (88/100): 19,666 LOC, dual enforcement (ESLint + CI), hallucination prevention (15 pre-gen rules + post-gen check), audit trail, prompt registry. Evidence & Trust Framework (88/100): TRUST metadata, evidence chains, confidence scoring (6-dimension composite), lineage tracking, source reliability. Capability Intelligence Engine (80%): Auto-embedding, signal-capability matching, opportunity generation. Opportunity Intelligence (80%): Exact Static Fit + Dynamic Signals + Timing model as specified. Executive Briefing Structure (85%): 7-section format matching business logic. Data Import Pipeline (85%): 6-phase pipeline, quality scoring, normalization, dedup."));
  children.push(emptyPara());
  children.push(h2("3.3 Overall Maturity"));
  children.push(body("Overall production readiness: approximately 63% relative to the full business logic specification. However, this is not a greenfield rebuild. The remaining work is primarily persistence activation, connecting existing intelligence engines, making intelligence proactive, removing identity conflicts, and improving enterprise readiness. This is a maturation and integration challenge, not a new build."));

  // ---- SECTION 4: THE 7 ARCHITECTURE LAYERS ----
  children.push(h1("4. Redefined Product Architecture (7 Layers)"));

  const layers = [
    ["Layer 1", "Intelligence Foundation", "Buyer ingestion, capability library, knowledge intelligence, enterprise memory, evidence & trust", "5 capabilities", "Fix: persistence, PDF/DOCX"],
    ["Layer 2", "Signal Intelligence", "External signal collection, classification (11 types), multi-signal interpretation, validation & trust", "4 capabilities", "Fix: cron scheduling"],
    ["Layer 3", "Intelligence Reasoning", "Knowledge graph, opportunity engine, capability matching, contact intelligence, executive briefing, deep analysis, forecasting", "7 capabilities", "Fix: persistence, contact persistence"],
    ["Layer 4", "Human Decision & Learning", "Proactive dashboard, unified decision layer, feedback & learning loop (wired), intelligence digest delivery", "4 capabilities", "Fix: dashboard redesign, wire learning"],
    ["Layer 5", "Enterprise Operations", "AI governance, AI advisor, unified search, operations center, engagement advisory, trust dashboard", "6 capabilities", "Enhancement: redirect excess"],
  ];

  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: noBorderInside,
    rows: [
      dataRow(["Layer", "Name", "Capabilities", "Count", "Status"], true),
      ...layers.map(l => dataRow(l))
    ]
  }));

  // ---- SECTION 5: GAP MAP ----
  children.push(h1("5. Complete Gap Map"));

  const gaps = [
    ["G1", "Intelligence Persistence", "USE_DB_PERSISTENCE=false. Cold start doesn't restore Maps. KG, memory, retrieval index lost on restart.", "2-3 weeks", "Phase 1"],
    ["G2", "Learning Loops Disconnected", "4 learning loops store to DB but none wired to scoring engines.", "5 days", "Phase 1"],
    ["G3", "Document Ingestion Limited", "PDF/DOCX uploads blocked in API. PDF parser is regex-only. No URL fetcher.", "2 weeks", "Phase 2"],
    ["G4", "Dashboard Is Sales-Ops", "Dashboard shows KPIs not intelligence. No proactive briefing. Top companies by contact count.", "3 weeks", "Phase 3"],
    ["G5", "Decision Layer Inconsistent", "Accept/Dismiss varies across UIs. Monitor not persisted. No unified component.", "1-2 weeks", "Phase 3"],
    ["G6", "Signal Cron Scheduling", "Signals collected via manual API call. No automated scheduling. Autonomous monitor dead code.", "1-2 weeks", "Phase 2"],
    ["G7", "No Parent-Subsidiary", "Company model has no parentId. No hierarchy.", "2 weeks", "Phase 0-1"],
    ["G8", "Relationship Maps Ephemeral", "Buying committee computed on-the-fly. No role change tracking.", "3 weeks", "Phase 3"],
    ["G9", "Governance Bypass", "chat-stream bypasses all AI governance. No hallucination rules, no audit.", "2 days", "Phase 0"],
    ["G10", "Fabricated Version History", "handleVersionHistory() generates random data.", "1 day", "Phase 0"],
    ["G11", "Email = Outreach Branding", "System labeled 'AI-Powered Outreach'. Contradicts Intelligence OS identity.", "2-3 weeks", "Phase 4"],
    ["G12", "Agent Tools Simulated", "AI Agent Framework (2,874 LOC) has 12 tool types all returning mock data.", "3-4 weeks", "Phase 4"],
    ["G13", "Pipeline Excess", "Pipeline forecast + deal coaching exist but not connected to intelligence.", "2 weeks", "Phase 5"],
  ];

  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: noBorderInside,
    rows: [
      dataRow(["ID", "Gap", "Description", "Effort", "Phase"], true),
      ...gaps.map(g => dataRow(g))
    ]
  }));

  // ---- SECTION 6: EXCESS CAPABILITY REDIRECTION ----
  children.push(h1("6. Excess Capability Redirection"));

  children.push(h2("6.1 Email System -> Intelligence Digest"));
  children.push(body("Current: Full email sequence system with AI-personalized drafts, email worker, tracking, suppression. Branded as 'AI-Powered Outreach'. Redirected: Rename to Intelligence Digest. Weekly executive intelligence summaries delivered via email. Briefing export as email-ready format. Briefing engagement tracking feeds back into contact intelligence. Same plumbing, different product story."));
  children.push(emptyPara());

  children.push(h2("6.2 Multi-Agent Architecture -> Deep Analysis"));
  children.push(body("Current: 3 agent systems (5 Enterprise Agents, 10-agent Multi-Agent Orchestrator, AI Agent Framework with 2,874 LOC). Redirected: Enterprise Agents become Intelligence Reasoning Specialists. Multi-Agent Orchestrator becomes 'Deep Analysis Mode' for comprehensive account intelligence. AI Agent Framework gets real tool connections (hybrid retrieval, knowledge graph, memory, evidence engine)."));
  children.push(emptyPara());

  children.push(h2("6.3 Pipeline/Forecasting -> Intelligence Forecasting"));
  children.push(body("Current: Pipeline forecast API (stage distribution, conversion rates, velocity). Deal coaching API (stage-specific topics, gap detection). Redirected: Intelligence Health Forecasting predicts which accounts will become high-priority. Engagement Advisory provides post-decision conversation intelligence. Outcome-Driven Confidence Calibration feeds win/loss data into scoring."));
  children.push(emptyPara());

  children.push(h2("6.4 Advanced Scoring Models"));
  children.push(body("Current: Buying intent engine (5 categories), contact influence engine, revenue opportunity engine, engagement prediction. Redirected: Intent Intelligence Layer adds buying intent dimension. Relationship Health Scoring tracks temporal contact intelligence. Value-Weighted Prioritization weights opportunities by potential value."));

  // ---- SECTION 7: 22-WEEK PHASED PLAN ----
  children.push(h1("7. 22-Week Transformation Plan"));

  children.push(h2("Phase 0: Foundation Integrity (Week 1-2)"));
  children.push(body("Objective: Stop the bleeding. Seal holes. Create stable baseline. Tasks: Seal governance bypass on chat-stream (hard 403 block, add streamAICall to ESLint). Remove fabricated version history data. Add parentId to Company model (schema migration, basic hierarchy queries). Architecture documentation (7-layer architecture, persistence model, learning loop architecture). Regression baseline (full test suite, CI green). Persistence risk assessment."));
  children.push(body("Exit Criteria: CI green. Zero ungoverned AI paths. No fabricated data. Architecture documented. Parent-subsidiary data model ready."));
  children.push(emptyPara());

  children.push(h2("Phase 1: Intelligence Persistence Activation (Week 3-5)"));
  children.push(body("Objective: DeepMindQ remembers permanently. Intelligence compounds over time. Tasks: Activate USE_DB_PERSISTENCE=true. Fix cold start loader to populate in-memory Maps from DB. Validate KG hydration (1K/5K/10K nodes). Validate derived indices. Benchmark cold start performance. Validate retrieval index hydration. Validate AI memory hydration (all 4 layers). Run shadow mode testing for 1 week. Wire learning loops to scoring engines (import calibration adjustments into recommendation engine)."));
  children.push(body("Exit Criteria: Server restart loses ZERO intelligence. Cold start under 60 seconds at 10K nodes. All 4 memory layers restore. Feedback loop electrically connected to scoring. Shadow mode shows no data loss."));
  children.push(emptyPara());

  children.push(h2("Phase 2: Document Intelligence & Signal Operations (Week 6-8)"));
  children.push(body("Objective: Knowledge ingestion works for real enterprise documents. Signals flow automatically. Tasks: Proper PDF parsing (integrate pdf-parse). Unblock DOCX upload. URL ingestion endpoint. End-to-end knowledge ingestion validation. Automated connector scheduler (cron integration). Activate autonomous monitor. RSS auto-discovery."));
  children.push(body("Exit Criteria: PDF/DOCX/URL ingestion works end-to-end. Signals collected automatically on schedule. Autonomous monitor generates alerts."));
  children.push(emptyPara());

  children.push(h2("Phase 3: Proactive Intelligence & Decision Layer (Week 9-12)"));
  children.push(body("Objective: Users open the platform and see intelligence, not metrics. Tasks: Redesign Executive Dashboard (remove sales-ops KPIs, add intelligence-first view). Morning Intelligence Brief (scheduled daily brief generation). Signal-driven prioritization. Unified DecisionActions component (Engage/Monitor/Ignore). Apply decision layer to all surfaces. Monitor state with follow-up triggers. Persistent buying committee model. Role change tracking."));
  children.push(body("Exit Criteria: Dashboard shows intelligence, not KPIs. Morning brief available daily. Decision layer unified across all screens. Monitor state is active with follow-up."));
  children.push(emptyPara());

  children.push(h2("Phase 4: Intelligence Delivery & Deep Analysis (Week 13-16)"));
  children.push(body("Objective: Intelligence comes to users. Deep analysis available for high-value accounts. Tasks: Rename email system to Intelligence Digest. Weekly intelligence digest generation. Briefing export. Briefing engagement tracking. Connect 5 agent framework tools to real modules. Expose as Deep Analysis feature. Deep Analysis output integration."));
  children.push(body("Exit Criteria: Weekly intelligence digest delivered. Briefing exportable. Agent framework executes real operations. Deep Analysis produces comprehensive reports."));
  children.push(emptyPara());

  children.push(h2("Phase 5: Predictive Intelligence & Enterprise Hardening (Week 17-20)"));
  children.push(body("Objective: Intelligence predicts, not just reports. Platform enterprise-ready. Tasks: Intelligence trajectory modeling. Priority prediction. Dashboard integration. Enterprise hardening (security, RBAC, secrets, backup/restore, performance). Streaming governance (governedStreamAICall)."));
  children.push(body("Exit Criteria: Intelligence predicts future priority changes. Enterprise security reviewed. Backup/restore tested. Streaming AI fully governed."));
  children.push(emptyPara());

  children.push(h2("Phase 6: Polish & Market Readiness (Week 21-22)"));
  children.push(body("Objective: Product demo-ready, investor-ready, customer-ready. Tasks: UX polish. Onboarding flow. End-to-end demo scenario. Performance audit. Documentation."));

  // ---- SECTION 8: NAVIGATION ARCHITECTURE ----
  children.push(h1("8. Navigation Architecture (Redefined)"));

  const nav = [
    ["INTELLIGENCE", "Executive Dashboard", "Redesigned intelligence-first view"],
    ["INTELLIGENCE", "AI Advisor", "Conversational intelligence assistant"],
    ["INTELLIGENCE", "Company Intelligence", "Company accounts with intelligence scoring"],
    ["INTELLIGENCE", "Contact Intelligence", "Contact profiles with enrichment"],
    ["INTELLIGENCE", "Signal Intelligence (AI Insights)", "AI-detected signals with matching"],
    ["INTELLIGENCE", "Opportunity Radar", "AI-generated opportunities"],
    ["INTELLIGENCE", "Intelligence Search", "Unified search across all data"],
    ["KNOWLEDGE", "Capability Library", "Service/expertise/case study management"],
    ["KNOWLEDGE", "Knowledge Workspace", "Document knowledge base"],
    ["DELIVERY", "Intelligence Digest", "Weekly briefings (redirected from email)"],
    ["DELIVERY", "Engagement Advisory", "Post-decision intelligence (redirected)"],
    ["OPERATIONS", "Data Import / Data Health / AI Trust", "Admin-only data operations"],
    ["OPERATIONS", "Analytics / AI Health / Settings / Users", "Platform management"],
  ];

  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: noBorderInside,
    rows: [
      dataRow(["Section", "Screen", "Description"], true),
      ...nav.map(n => dataRow(n))
    ]
  }));
  children.push(emptyPara());
  children.push(body("Removed from Primary Navigation: Pipeline (internal use), Email Studio (redirected), Sequences (redirected), Leads (surfaced via Contact Intelligence), Templates (part of Digest)."));

  // ---- SECTION 9: MEMORY ARCHITECTURE ----
  children.push(h1("9. Memory Architecture (4 Layers)"));

  children.push(body("DeepMindQ has exactly four memory layers. No additional layers will be added."));
  children.push(emptyPara());

  const memLayers = [
    ["L1: Working Memory", "Current session context, active query state", "In-memory (session-scoped)", "Persists across restarts", "Phase 1"],
    ["L2: Conversation Memory", "Advisor conversation history, user preferences", "DB-persisted (AdvisorConversation)", "Already working", "Production"],
    ["L3: Enterprise Memory", "Company intelligence, signal history, cross-account patterns", "DB-backed (when persistence enabled)", "Persists across restarts", "Phase 1"],
    ["L4: Institutional Memory", "Learning events, win/loss patterns, capability refinements", "DB-backed (when persistence enabled)", "Persists across restarts", "Phase 1"],
  ];

  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: noBorderInside,
    rows: [
      dataRow(["Layer", "Content", "Storage", "Target", "Phase"], true),
      ...memLayers.map(m => dataRow(m))
    ]
  }));

  // ---- SECTION 10: SUCCESS CRITERIA ----
  children.push(h1("10. Final Success Test"));
  children.push(body("After Phase 6, this sentence must be demonstrably true:"));
  children.push(emptyPara());
  children.push(new Paragraph({
    spacing: { after: 200, line: 312 },
    indent: { left: 400, right: 400 },
    border: { left: { style: BorderStyle.SINGLE, size: 4, color: c(P.accent) }, right: { style: BorderStyle.SINGLE, size: 4, color: c(P.accent) } },
    children: [new TextRun({
      text: "\"A business leader opens DeepMindQ, sees which accounts in their buyer universe have changed, understands why those changes matter, knows which capabilities to discuss, identifies the right people to engage, receives an executive briefing with evidence, decides whether to act, and the system learns from that decision to improve tomorrow's intelligence.\"",
      size: 22, italics: true, color: c(P.primary), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" }
    })]
  }));
  children.push(emptyPara());
  children.push(body("Every phase, every task, every redirect exists to make that sentence real. Nothing else matters."));

  return children;
}

// === ASSEMBLE DOCUMENT ===
async function main() {
  const doc = new Document({
    creator: "DeepMindQ Architecture Team",
    title: "DeepMindQ Master Product Specification",
    description: "Enterprise Intelligence Operating System - Redefined Product & 22-Week Transformation Plan",
    styles: {
      default: { document: {
        run: { font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" }, size: 22, color: c(P.body) },
        paragraph: { spacing: { line: 312 } },
      }},
      heading1: { run: { font: { ascii: "Calibri", eastAsia: "SimHei" }, size: 32, bold: true, color: c(P.primary) } },
      heading2: { run: { font: { ascii: "Calibri", eastAsia: "SimHei" }, size: 28, bold: true, color: c(P.primary) } },
      heading3: { run: { font: { ascii: "Calibri", eastAsia: "SimHei" }, size: 24, bold: true, color: c(P.secondary) } },
    },
    sections: [
      buildCover(),
      // TOC Section
      {
        properties: {
          page: { margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 } },
        },
        headers: {
          default: new Header({ children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: "DeepMindQ Master Product Specification", size: 16, color: c(P.secondary), font: { ascii: "Calibri" }, italics: true })]
          })] })
        },
        footers: {
          default: new Footer({ children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: c(P.secondary), font: { ascii: "Calibri" } })]
          })] })
        },
        children: [
          new Paragraph({
            spacing: { before: 200, after: 200 },
            children: [new TextRun({ text: "Table of Contents", size: 36, bold: true, color: c(P.primary), font: { ascii: "Calibri" } })]
          }),
          new TableOfContents("Table of Contents", {
            hyperlink: true,
            headingStyleRange: "1-3",
          }),
          new Paragraph({
            spacing: { before: 200, after: 200 },
            children: [new TextRun({ text: "Note: Right-click the Table of Contents above and select \"Update Field\" to refresh page numbers.", size: 18, italics: true, color: c(P.secondary), font: { ascii: "Calibri" } })]
          }),
          new Paragraph({ children: [new PageBreak()] }),
          ...buildBody()
        ]
      }
    ]
  });

  const buffer = await Packer.toBuffer(doc);
  const outPath = "/home/z/my-project/download/DeepMindQ_Master_Product_Specification.docx";
  fs.writeFileSync(outPath, buffer);
  console.log("Document saved to: " + outPath);
}

main().catch(e => { console.error(e); process.exit(1); });
