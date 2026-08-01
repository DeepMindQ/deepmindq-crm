/**
 * Phase 1B Before Implementation Snapshot & Design Decision Document
 * DeepMindQ Command Center: Intelligence Command System
 *
 * Pre-coding documentation per user's 8 execution conditions.
 * NO CODING until this document is reviewed.
 */

import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, WidthType,
  PageBreak, SectionType, ShadingType, BorderStyle, PageNumber,
  TableLayoutType, TabStopType, TabStopPosition,
} from "docx";
import * as fs from "fs";

// ═══════════════════════════════════════════════════════════════
// PALETTE — DM-1 Deep Cyan
// ═══════════════════════════════════════════════════════════════
const P = {
  bg: "162235", primary: "FFFFFF", accent: "37DCF2",
  table: { headerBg: "1B6B7A", headerText: "FFFFFF", accentLine: "1B6B7A", innerLine: "C8DDE2", surface: "EDF3F5" },
  body: "1A1F36", text: "000000",
  subtitleColor: "B0B8C0", metaColor: "90989F", footerColor: "687078",
};
const c = (h: string) => h.replace("#", "");
const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════
function h1(t: string): Paragraph {
  return new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 480, after: 200 }, children: [new TextRun({ text: t, bold: true, size: 32, color: c("1A1F36"), font: { ascii: "Times New Roman" } })] });
}
function h2(t: string): Paragraph {
  return new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 360, after: 160 }, children: [new TextRun({ text: t, bold: true, size: 28, color: c("1A1F36"), font: { ascii: "Times New Roman" } })] });
}
function h3(t: string): Paragraph {
  return new Paragraph({ heading: HeadingLevel.HEADING_3, spacing: { before: 240, after: 120 }, children: [new TextRun({ text: t, bold: true, size: 26, color: c("1A1F36"), font: { ascii: "Times New Roman" } })] });
}
function body(t: string): Paragraph {
  return new Paragraph({ alignment: AlignmentType.LEFT, spacing: { after: 120, line: 312 }, children: [new TextRun({ text: t, size: 24, color: c("000000"), font: { ascii: "Calibri" } })] });
}
function bullet(t: string, indent = 480): Paragraph {
  return new Paragraph({ alignment: AlignmentType.LEFT, indent: { left: indent }, spacing: { after: 80, line: 312 }, children: [new TextRun({ text: `\u2022  ${t}`, size: 24, color: c("000000"), font: { ascii: "Calibri" } })] });
}
function spacer(b = 200): Paragraph { return new Paragraph({ spacing: { before: b }, children: [] }); }
function accentBorder(t: string): Paragraph {
  return new Paragraph({ spacing: { after: 200 }, border: { left: { style: BorderStyle.SINGLE, size: 12, color: c("1B6B7A"), space: 12 } }, indent: { left: 400 }, children: [new TextRun({ text: t, bold: true, size: 20, color: c("1B6B7A"), font: { ascii: "Calibri" } })] });
}

function headerRow(cells: string[]): TableRow {
  return new TableRow({ tableHeader: true, children: cells.map(t => new TableCell({ shading: { type: ShadingType.CLEAR, fill: P.table.headerBg }, borders: { top: { style: BorderStyle.SINGLE, size: 2, color: P.table.accentLine }, bottom: { style: BorderStyle.SINGLE, size: 2, color: P.table.accentLine }, left: NB, right: NB }, margins: { top: 60, bottom: 60, left: 120, right: 120 }, children: [new Paragraph({ alignment: AlignmentType.LEFT, children: [new TextRun({ text: t, bold: true, size: 21, color: P.table.headerText, font: { ascii: "Calibri" } })] })] })) });
}
function dataRow(cells: string[], i: number): TableRow {
  const fill = i % 2 === 0 ? "FFFFFF" : P.table.surface;
  return new TableRow({ children: cells.map(t => new TableCell({ shading: { type: ShadingType.CLEAR, fill }, borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.SINGLE, size: 1, color: P.table.innerLine }, left: NB, right: NB }, margins: { top: 60, bottom: 60, left: 120, right: 120 }, children: [new Paragraph({ alignment: AlignmentType.LEFT, children: [new TextRun({ text: t, size: 21, color: c("000000"), font: { ascii: "Calibri" } })] })] })) });
}
function tbl(headers: string[], rows: string[][]): Table {
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: { top: { style: BorderStyle.SINGLE, size: 2, color: P.table.accentLine }, bottom: { style: BorderStyle.SINGLE, size: 2, color: P.table.accentLine }, left: NB, right: NB, insideVertical: NB }, rows: [headerRow(headers), ...rows.map((r, i) => dataRow(r, i))] });
}

// ═══════════════════════════════════════════════════════════════
// COVER — R1 Pure Paragraph Left
// ═══════════════════════════════════════════════════════════════
function buildCover() {
  const padL = 1200, padR = 800, availW = 11906 - padL - padR - 300;
  // Split title
  const title = "DeepMindQ Phase 1B: Before Implementation Snapshot & Design Decision Document";
  const cpl = Math.floor(availW / (34 * 20)); // 34pt
  const lines: string[] = [];
  let rem = title;
  while (rem.length > cpl) {
    let br = -1;
    for (let i = cpl; i >= Math.floor(cpl * 0.6); i--) {
      if (" .-_/".includes(rem[i - 1])) { br = i; break; }
    }
    if (br === -1) br = cpl;
    lines.push(rem.slice(0, br).trim());
    rem = rem.slice(br).trim();
  }
  if (rem) lines.push(rem);
  const titleSize = 34 * 2; // 34pt

  const children: Paragraph[] = [];
  children.push(new Paragraph({ spacing: { before: 3200 } }));
  children.push(new Paragraph({ indent: { left: padL, right: padR }, spacing: { after: 500 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: P.accent, space: 8 } }, children: [new TextRun({ text: "P R E - C O D I N G   D O C U M E N T", size: 18, color: P.accent, font: { ascii: "Calibri" }, characterSpacing: 40 })] }));
  for (const line of lines) {
    children.push(new Paragraph({ indent: { left: padL }, spacing: { after: 100, line: Math.ceil(34 * 23), lineRule: "atLeast" as const }, children: [new TextRun({ text: line, size: titleSize, bold: true, color: P.primary, font: { ascii: "Arial" } })] }));
  }
  children.push(new Paragraph({ indent: { left: padL }, spacing: { after: 800 }, children: [new TextRun({ text: "Command Center: Intelligence Command System", size: 24, color: P.subtitleColor, font: { ascii: "Calibri" } })] }));

  const metaLines = [
    "Status: PRE-CODING \u2014 No implementation until reviewed",
    "Objective: Transform from intelligence-enabled dashboard to Intelligence Command System",
    "Compliance: 8 Execution Conditions Locked",
    "Date: 2026-08-02 | Baseline: Phase 1A COMPLETE (c059d8c)",
  ];
  const accentLeft = { style: BorderStyle.SINGLE, size: 8, color: P.accent, space: 12 };
  for (const line of metaLines) {
    children.push(new Paragraph({ indent: { left: padL + 200 }, spacing: { after: 80 }, border: { left: accentLeft }, children: [new TextRun({ text: line, size: 24, color: P.metaColor, font: { ascii: "Calibri" } })] }));
  }
  children.push(new Paragraph({ spacing: { before: 2000 } }));
  children.push(new Paragraph({ indent: { left: padL, right: padR }, border: { top: { style: BorderStyle.SINGLE, size: 2, color: P.accent, space: 8 } }, spacing: { before: 200 }, children: [new TextRun({ text: "DeepMindQ Intelligence OS", size: 16, color: P.footerColor, font: { ascii: "Calibri" } }), new TextRun({ text: "                                                      CONFIDENTIAL", size: 16, color: P.footerColor, font: { ascii: "Calibri" } })] }));

  return [new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, layout: TableLayoutType.FIXED, borders: allNoBorders, rows: [new TableRow({ height: { value: 16838, rule: "exact" as const }, children: [new TableCell({ shading: { type: ShadingType.CLEAR, fill: P.bg }, borders: noBorders, children })] })] })];
  // Replace the empty cell with the real children
  return [new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, layout: TableLayoutType.FIXED, borders: allNoBorders, rows: [new TableRow({ height: { value: 16838, rule: "exact" as const }, children: [new TableCell({ shading: { type: ShadingType.CLEAR, fill: P.bg }, borders: noBorders, verticalAlign: "top" as const, children })] })] })];
}

// ═══════════════════════════════════════════════════════════════
// CONTENT SECTIONS
// ═══════════════════════════════════════════════════════════════

// ─── EXECUTION PRINCIPLE ───
const executionPrinciple: Paragraph[] = [
  spacer(200),
  accentBorder("EXECUTION PRINCIPLE \u2014 LOCKED"),
  body("Phase 1B is NOT a UI redesign. The objective is to transform Command Center from an intelligence-enabled dashboard into the primary Intelligence Command System experience of DeepMindQ. Every design decision must answer: \"What makes this feel like an intelligence partner and not another enterprise application?\""),
  body("This document provides the Before Implementation Snapshot and Design Decision for every major work item. No coding begins until this document is reviewed and approved. All 8 execution conditions specified by the user are treated as non-negotiable acceptance criteria."),
  spacer(100),
];

// ─── PART A: BEFORE IMPLEMENTATION SNAPSHOT ───
const partA: Paragraph[] = [
  h1("Part A: Before Implementation Snapshot"),
  body("This section documents the exact current state of the Command Center through source code analysis. Every claim about the current experience is grounded in the actual code structure, component hierarchy, and data flow. This snapshot serves as the baseline against which all Phase 1B changes will be measured."),
  spacer(60),

  h2("A.1 Current Page Architecture"),
  body("The Command Center is implemented across two components that serve different purposes but are not unified into a single experience."),
  tbl(
    ["Component", "File", "Lines", "Role", "Data Source"],
    [
      ["Dashboard Screen", "command-center-screen.tsx", "856", "Primary page wrapper. Renders KPI grid, signal feed, opportunity table, system health.", "/api/command-center/query (polling 30s)"],
      ["Intelligence OS CC", "intelligence-os/command-center.tsx", "1107", "Intelligence-native briefing. Daily narrative, account ranking, cross-account patterns.", "/api/intelligence/narratives + /api/companies + /api/signals + /api/capabilities"],
    ]
  ),
  spacer(40),
  body("The critical problem: these two components exist as separate rendering paths. The Dashboard Screen is the actual page route. The Intelligence OS Command Center is a component that can be toggled via the intelligenceActivated store flag. When activated, it replaces the dashboard view entirely rather than integrating with it. There is no unified Command Center that combines both approaches."),
  spacer(60),

  h2("A.2 Current Visual Layout (Dashboard Screen)"),
  body("The render order of command-center-screen.tsx (lines 644-856) defines the visual hierarchy precisely. Below is the exact element sequence a user encounters when opening the page:"),
  tbl(
    ["Position", "Element", "Lines", "User Sees", "Intelligence Value"],
    [
      ["1st (Top)", "Header bar", "650-693", "\"Command Center\" title, \"Live Intelligence Feed\" status, Refresh button", "None \u2014 navigation chrome"],
      ["2nd", "Morning Brief card (optional)", "696-700", "AI-generated summary text, shown only if API returns morningBrief", "Low \u2014 conditional, text-only, no confidence/evidence"],
      ["3rd", "KPI Grid (4 cards)", "702-732", "Total Accounts (number), Active Signals (number), Avg Intel Score (number), Pending Actions (number)", "Zero \u2014 raw numbers without context"],
      ["4th (Left)", "Recent Signals card", "737-758", "Scrollable list of signals with severity badges, company names, confidence bars", "Medium \u2014 data-rich but requires user scanning"],
      ["5th (Left-Bottom)", "Intelligence Feed card", "760-780", "Chronological list of events with type labels", "Low \u2014 chronological, not priority-ordered"],
      ["6th (Right)", "Top Opportunities card", "784-804", "Table with company, score, confidence, priority, status columns", "Medium \u2014 data table requiring reading"],
      ["7th (Right-Bottom)", "System Health card", "807-822", "Engine status dots (healthy/degraded/unhealthy), AI status indicator", "Operational only \u2014 not intelligence"],
    ]
  ),
  spacer(60),

  h2("A.3 Current Information Hierarchy Problems"),
  body("The render sequence above reveals five structural problems that violate the Intelligence-First principle established in Phase 1A."),
  bullet("Problem 1: Numbers Before Narrative. The KPI grid (Position 3) appears before any intelligence narrative. The user sees 4 raw numbers before encountering any AI reasoning. This forces the user to interpret data before receiving intelligence."),
  bullet("Problem 2: Intelligence Feed is Buried. The Intelligence Feed (Position 5) is at the bottom-left, below the signal list. A chronological event list is not intelligence \u2014 it is a log. The user must scroll past 6+ cards to reach it."),
  bullet("Problem 3: No Single Entry Point. There are 4 data cards (Signals, Feed, Opportunities, Health) competing for attention. Each has a different visual weight but none is clearly the primary action path. The user must decide where to look first."),
  bullet("Problem 4: Morning Brief is Conditional. The only narrative element (Morning Brief) only appears if the API returns it. It is not the organizing principle of the page \u2014 it is an optional add-on."),
  bullet("Problem 5: No Action Path. The current layout presents information but does not guide the user toward a specific action. There is no CTA, no recommended next step, no prioritization of what the user should do with the information presented."),
  spacer(60),

  h2("A.4 Current Cognitive Load Analysis"),
  body("Cognitive load refers to the mental effort required to use the interface. Below is a task-by-task analysis of what a VP Sales user must do to answer the 5 validation questions with the current interface:"),
  tbl(
    ["VP Sales Question", "Current Task Sequence", "Elements Scanned", "Clicks Required", "Cognitive Load"],
    [
      ["Q1: What needs attention?", "Scan KPI numbers (no help) \u2192 Scan signal list titles \u2192 Read severity badges \u2192 Cross-reference with opportunities", "8-12 elements", "0 clicks (scan only)", "High \u2014 user must prioritize themselves"],
      ["Q2: Which accounts changed?", "No change detection exists. User must remember previous state.", "N/A", "Impossible", "Maximum \u2014 no feature support"],
      ["Q3: Why does AI think this?", "For each signal: click signal card \u2192 navigate to company profile \u2192 find reasoning section", "3+ screens", "2-3 clicks per signal", "Very High \u2014 context switching"],
      ["Q4: What should I do next?", "No action recommendations in dashboard view. User must infer from signal data.", "N/A", "Impossible", "Maximum \u2014 no feature support"],
      ["Q5: How do I learn?", "No feedback mechanism. User cannot tell the system whether an insight was useful.", "N/A", "Impossible", "Maximum \u2014 no feature support"],
    ]
  ),
  spacer(60),

  h2("A.5 Current Intelligence OS Command Center Analysis"),
  body("The intelligence-os/command-center.tsx (1107 lines) provides a richer intelligence experience but has its own problems. It consumes real data from the intelligence pipeline (useIntelligenceNarratives hook), ranks narratives by confidence x priority, and generates action items from signals. However, it completely replaces the dashboard rather than augmenting it. The layout presents: (1) Stats strip (companies/capabilities/signals/contacts counts), (2) Daily Briefing narrative, (3) Priority Accounts ranked by intelligence score, (4) Account Briefings with match strength, (5) Cross-Account Insights, (6) Action Items feed. The problems with this component are: first, it uses raw fetch() calls to /api/companies, /api/signals, /api/capabilities instead of the intelligence-narrative-service for all data. Second, the action items are generated client-side from raw signal data (lines 255-269), not from the ActionEngine. Third, there is no ProgressiveDisclosure L1-L4 hierarchy in the page layout. Fourth, the priority accounts section is a score-ranked list, not an intelligence narrative. Fifth, the aggregated confidence (lines 195-209) is computed as a simple average, not weighted by relevance."),
  spacer(60),

  h2("A.6 Current Emotional Experience Assessment"),
  body("The current Command Center creates the following emotional responses in a VP Sales user, based on the interface analysis above:"),
  bullet("\"This is another dashboard I need to interpret.\" \u2014 The KPI-first layout and data grid pattern matches every enterprise SaaS product the user has seen. There is no differentiation in the first 10 seconds."),
  bullet("\"I need to figure out what matters.\" \u2014 The absence of a clear priority signal forces the user to scan and prioritize mentally. This is the opposite of the intelligence partner experience."),
  bullet("\"Where do I click?\" \u2014 Multiple competing cards with no clear primary action create decision fatigue before any intelligence value is delivered."),
  bullet("\"The numbers don't tell me what changed.\" \u2014 Static KPI values without context (delta from yesterday, trend direction) feel like a data warehouse, not a living intelligence system."),
  body("The current emotional outcome is: Generic SaaS dashboard with AI features. The target emotional outcome is: AI Intelligence Command System. This is the gap Phase 1B must close."),
  spacer(100),
];

// ─── PART B: DESIGN DECISION DOCUMENTS ───
const partB: Paragraph[] = [
  h1("Part B: Design Decision Documents"),
  body("For each of the 6 major work items, this section provides: (1) Why this component exists, (2) Current user journey problems it solves, (3) Design intent, (4) Expected emotional outcome, (5) Expected intelligence improvement, (6) Technical implementation approach, (7) L1-L4 progressive disclosure flow, (8) Loading/empty/error states, (9) Real backend dependencies."),
  spacer(60),

  // ── WORK ITEM 1: HeroNarrative ──
  h2("Work Item 1: HeroNarrative \u2014 Primary Intelligence Surface"),
  accentBorder("WHY THIS COMPONENT EXISTS"),
  body("The HeroNarrative exists to ensure that the very first thing a VP Sales user sees upon opening DeepMindQ is intelligence, not data. It replaces the KPI grid as the primary visual element. Without this component, the user starts at numbers and must interpret them. With this component, the user starts at a decision-quality conclusion with confidence and action."),
  spacer(40),
  accentBorder("CURRENT USER JOURNEY PROBLEMS"),
  bullet("User must scan 4 KPI cards and interpret raw numbers before seeing any intelligence"),
  bullet("No single entry point tells the user what matters most right now"),
  bullet("The Morning Brief (only narrative element) is conditional and appears below KPIs"),
  bullet("The user leaves the page without taking any action because no action was suggested"),
  spacer(40),
  accentBorder("DESIGN INTENT"),
  body("Render the single highest-priority intelligence item as a full-width narrative occupying the top of the Command Center, above all other elements. The narrative uses the existing IntelligenceNarrative component (variant=signal or opportunity) connected to real data from /api/intelligence/narratives?limit=1&minSeverity=high. The narrative includes: a headline answering \"what changed and why it matters\", a ConfidenceIndicator (ring mode, large) showing multi-factor confidence, a one-line reasoning summary, and an ActionCTA with the specific recommended action."),
  spacer(40),
  accentBorder("EXPECTED EMOTIONAL OUTCOME"),
  body("\"DeepMindQ already analyzed what matters. It's telling me exactly what to focus on and why.\" The user feels guided, not overwhelmed. The feeling is: \"This system understands my business.\" Not: \"I need to interpret another dashboard.\""),
  spacer(40),
  accentBorder("EXPECTED INTELLIGENCE IMPROVEMENT"),
  tbl(
    ["Metric", "Before (Current)", "After (Phase 1B)", "Improvement"],
    [
      ["Time to first intelligence value", "Scroll past 4 KPIs + 2 cards (8-10 seconds)", "Immediate \u2014 first element on page (0 seconds)", "Instant"],
      ["Clicks to reasoning (Q3)", "2-3 clicks to company profile", "0 clicks \u2014 reasoning visible inline", "Zero"],
      ["Clicks to action (Q4)", "No action exists in current UI", "1 click \u2014 ActionCTA visible in viewport", "From impossible to 1"],
      ["Cognitive load for Q1", "High \u2014 user self-prioritizes from 8-12 items", "Zero \u2014 system presents the priority", "Eliminated"],
    ]
  ),
  spacer(40),
  accentBorder("TECHNICAL IMPLEMENTATION APPROACH"),
  bullet("Create a new HeroNarrative component that wraps IntelligenceNarrative with full-width layout styling"),
  bullet("Data source: useIntelligenceNarratives({ limit: 1, minConfidence: 50, minSeverity: 'high' })"),
  bullet("Extract the first narrative from rankedNarratives (already computed by intelligence-os/command-center.tsx)"),
  bullet("Render IntelligenceNarrative with data prop, plus ConfidenceIndicator (mode=ring, size=lg) alongside"),
  bullet("Append ActionCTA (variant=primary) from narrative.actions[0] at the bottom"),
  bullet("Loading state: use IntelligenceNarrative skeleton from design system"),
  bullet("Empty state: \"No critical intelligence at this time\" with last-refreshed timestamp"),
  bullet("Error state: degraded display showing last-known narrative with amber \"Intelligence may be stale\" banner"),
  spacer(40),
  accentBorder("L1-L4 PROGRESSIVE DISCLOSURE FLOW"),
  bullet("L1 (Decision): Headline text + confidence ring + priority badge \u2014 visible immediately"),
  bullet("L2 (Reasoning): One-line reasoning summary + top 3 confidence factors \u2014 visible inline below headline"),
  bullet("L3 (Evidence): Click headline or \"View Evidence\" link \u2192 opens IntelligencePanel with EvidenceChain"),
  bullet("L4 (Exploration): Inside IntelligencePanel, below evidence, show related signals and cross-account patterns"),
  spacer(40),
  accentBorder("LOADING / EMPTY / ERROR STATES"),
  tbl(
    ["State", "Display", "Behavior"],
    [
      ["Loading", "Skeleton matching IntelligenceNarrative dimensions (title line + 3 content lines + CTA area)", "Animate pulse, replaced by real content on data arrival"],
      ["Empty", "Centered message: \"No critical intelligence requires attention right now.\" + last check timestamp", "Non-blocking; user can still access IntelligenceQueue below"],
      ["Error", "Last-known narrative with amber border: \"Intelligence may be stale. Last updated [time].\"", "Auto-retry on poll interval; manual retry via Refresh button"],
    ]
  ),
  spacer(40),
  accentBorder("REAL BACKEND DEPENDENCIES"),
  bullet("API: GET /api/intelligence/narratives?limit=1&minConfidence=50&minSeverity=high (existing endpoint)"),
  bullet("Service: intelligence-narrative-service.ts \u2192 generateCommandCenterNarratives()"),
  bullet("Engines: GroundingEngine (evidence), computeConfidenceScore (confidence), computeConfidenceFactors (explainability)"),
  bullet("Data models: IntelligenceNarrativeData, NarrativeConfidence, NarrativeEvidence from intelligence-narrative-service.ts"),
  bullet("No new API endpoints required"),
  spacer(100),

  // ── WORK ITEM 2: IntelligenceQueue ──
  h2("Work Item 2: IntelligenceQueue \u2014 Priority Intelligence Feed"),
  accentBorder("WHY THIS COMPONENT EXISTS"),
  body("After the HeroNarrative answers \"what matters most,\" the IntelligenceQueue answers \"what else matters.\" It provides the next 3-5 priority intelligence items as compact, scannable cards that the user can assess in 2-3 seconds each. Without this, the user either relies on a single item (too narrow) or must scan a chronological feed (too unstructured)."),
  spacer(40),
  accentBorder("CURRENT USER JOURNEY PROBLEMS"),
  bullet("Recent Signals list (dashboard screen) is chronological, not priority-ordered"),
  bullet("Signal cards require reading full title + description to assess relevance"),
  bullet("No visual distinction between critical and low-priority signals beyond badge color"),
  bullet("User must scan 8-12 signals to determine the top 3 that matter"),
  spacer(40),
  accentBorder("DESIGN INTENT"),
  body("A horizontal scrollable row or 2-column grid of IntelligenceCard components, ordered by priority (critical > high > medium > low) then by confidence (descending). Each card shows: title, entity name, confidence bar (compact), priority badge, and timestamp. Maximum 3 lines of visible text per card. Clicking a card expands it inline into a full IntelligenceNarrative with L2 reasoning visible, or opens IntelligencePanel for L3-L4."),
  spacer(40),
  accentBorder("EXPECTED EMOTIONAL OUTCOME"),
  body("\"The system already ranked everything for me. I can quickly scan and decide which item deserves my attention next.\" The feeling is efficient scanning, not information overload. Each card is dense with intelligence but visually calm."),
  spacer(40),
  accentBorder("EXPECTED INTELLIGENCE IMPROVEMENT"),
  tbl(
    ["Metric", "Before", "After", "Improvement"],
    [
      ["Items to scan for top 3 priorities", "8-12 unranked signals", "5 pre-ranked narratives", "60% fewer items"],
      ["Time to assess one item", "Read title + description + severity (5-8 sec)", "Title + confidence + priority badge (2-3 sec)", "60% faster"],
      ["Ordering logic", "Chronological (latest first)", "Priority x Confidence (importance first)", "Fundamental improvement"],
      ["Access to reasoning", "Navigate to company profile (2 clicks)", "Click to expand inline (1 click)", "50% fewer clicks"],
    ]
  ),
  spacer(40),
  accentBorder("L1-L4 PROGRESSIVE DISCLOSURE FLOW"),
  bullet("L1 (Decision): Card shows title + entity + confidence bar + priority badge \u2014 scannable in 2-3 seconds"),
  bullet("L2 (Reasoning): Click card \u2192 expands inline to show IntelligenceNarrative with reasoning and factors"),
  bullet("L3 (Evidence): Click \"View Evidence\" in expanded view \u2192 IntelligencePanel with EvidenceChain"),
  bullet("L4 (Exploration): Inside IntelligencePanel, related signals and cross-account patterns below evidence"),
  spacer(40),
  accentBorder("LOADING / EMPTY / ERROR STATES"),
  tbl(
    ["State", "Display", "Behavior"],
    [
      ["Loading", "5 IntelligenceCard skeletons in grid layout", "Replaced by real cards as data arrives"],
      ["Empty", "\"All intelligence items displayed above\" message (when queue has 0 items after hero)", "Non-blocking; IntelligenceQueue is supplementary"],
      ["Error", "Last-known items with amber \"May be stale\" indicator", "Auto-retry on poll; manual retry via Refresh"],
    ]
  ),
  spacer(40),
  accentBorder("REAL BACKEND DEPENDENCIES"),
  bullet("API: GET /api/intelligence/narratives?limit=5 (existing endpoint; first item excluded as HeroNarrative)"),
  bullet("Client-side: rankedNarratives array from intelligence-os/command-center.tsx (already computed)"),
  bullet("Components: IntelligenceCard (existing, intelligence-os/intelligence-card.tsx), IntelligenceNarrative (existing)"),
  bullet("No new API endpoints required"),
  spacer(100),

  // ── WORK ITEM 3: InlineReasoning ──
  h2("Work Item 3: InlineReasoning \u2014 Embedded Reasoning Display"),
  accentBorder("WHY THIS COMPONENT EXISTS"),
  body("Currently, reasoning is only accessible through ProgressiveDisclosure L2, which requires clicking an element to expand. For an executive, the reasoning should be visible without any interaction. The InlineReasoning component makes the \"why\" visible as part of the narrative itself, not hidden behind an interaction. This transforms the experience from \"tell me the headline, I'll ask for details\" to \"tell me the headline AND why, I'll ask for proof.\""),
  spacer(40),
  accentBorder("CURRENT USER JOURNEY PROBLEMS"),
  bullet("Reasoning requires clicking to expand ProgressiveDisclosure L2 (extra interaction)"),
  bullet("Confidence breakdown (4 dimensions) requires drilling into confidence detail"),
  bullet("User cannot answer \"Why does AI think this?\" without at least 1 click"),
  bullet("The confidence score alone (e.g., \"78%\") does not explain why it is 78%"),
  spacer(40),
  accentBorder("DESIGN INTENT"),
  body("A compact section rendered directly within the HeroNarrative and expanded IntelligenceQueue items. Shows: one-line reasoning summary (from narrative reasoning field) and a horizontal factor bar displaying top 3 positive factors (green labels) and top 2 negative factors (amber labels) with their magnitudes. Confidence ring displayed alongside for quick reference. All data comes from the existing NarrativeConfidence.factors field in the API response."),
  spacer(40),
  accentBorder("EXPECTED EMOTIONAL OUTCOME"),
  body("\"I understand why the system flagged this without having to dig for it.\" The user feels informed and trusted. The system shows its work proactively, building confidence in the intelligence."),
  spacer(40),
  accentBorder("EXPECTED INTELLIGENCE IMPROVEMENT"),
  tbl(
    ["Metric", "Before", "After", "Improvement"],
    [
      ["Clicks to see reasoning (Q3)", "1 click to expand L2", "0 clicks \u2014 visible inline", "Instant access"],
      ["Time to understand confidence", "See number (78%), interpret meaning yourself", "See number + 3 positive + 2 negative factors", "Self-explanatory"],
      ["Trust in intelligence", "User must trust blindly or dig", "Reasoning visible upfront; user can verify immediately", "Transparency-first"],
    ]
  ),
  spacer(40),
  accentBorder("L1-L4 PROGRESSIVE DISCLOSURE FLOW"),
  bullet("L1: Reasoning summary is PART of L1 \u2014 not a separate interaction layer"),
  bullet("L2: The factor bar provides L2 detail inline \u2014 positive/negative factors visible"),
  bullet("L3: \"View full evidence\" link within InlineReasoning \u2192 IntelligencePanel with EvidenceChain"),
  bullet("L4: Inside IntelligencePanel, full evidence + related signals + cross-account patterns"),
  spacer(40),
  accentBorder("REAL BACKEND DEPENDENCIES"),
  bullet("API: narrative.confidence.factors (already returned by /api/intelligence/narratives)"),
  bullet("Service: computeConfidenceFactors() from confidence-explainability.ts (already called by narrative service)"),
  bullet("No new API calls or service changes needed \u2014 data already flows through the pipeline"),
  spacer(100),

  // ── WORK ITEM 4: ActionQueue ──
  h2("Work Item 4: ActionQueue \u2014 Prioritized Action Feed"),
  accentBorder("WHY THIS COMPONENT EXISTS"),
  body("Currently, actions are embedded within individual narratives. An executive needs a consolidated view of all recommended actions to plan their day. The ActionQueue extracts and ranks actions from all intelligence narratives, presenting a single \"what should I do today?\" view. Without this, the user must click through each narrative individually to find actions."),
  spacer(40),
  accentBorder("CURRENT USER JOURNEY PROBLEMS"),
  bullet("No consolidated action view exists \u2014 actions are scattered across narratives"),
  bullet("User cannot answer \"What should I do next?\" without exploring each intelligence item"),
  bullet("No prioritization across actions from different sources (signals, opportunities, risks)"),
  bullet("The ActionCTA exists in individual IntelligenceNarratives but there is no cross-narrative action ranking"),
  spacer(40),
  accentBorder("DESIGN INTENT"),
  body("A distinct section below the IntelligenceQueue showing the top 5 recommended actions extracted from all active narratives. Each action row shows: action label (bold), company name, intelligence source (e.g., \"Signal: CTO Hiring\"), priority badge, and compact confidence indicator. The #1 action has a prominent CTA button; others have subtle link-style CTAs. Actions are ranked by combined priority (critical > high > medium > low) and confidence (descending)."),
  spacer(40),
  accentBorder("EXPECTED EMOTIONAL OUTCOME"),
  body("\"The system already planned my day. I just need to execute.\" The user feels productive and guided. The action queue eliminates the gap between intelligence and execution."),
  spacer(40),
  accentBorder("EXPECTED INTELLIGENCE IMPROVEMENT"),
  tbl(
    ["Metric", "Before", "After", "Improvement"],
    [
      ["Time to find an action", "Click each narrative, scan for CTA (30+ seconds)", "Read action queue (5 seconds)", "6x faster"],
      ["Actions visible without clicking", "0 (hidden in narratives)", "5 (visible in queue)", "From 0 to 5"],
      ["Cross-source prioritization", "None", "Ranked by priority x confidence", "New capability"],
    ]
  ),
  spacer(40),
  accentBorder("L1-L4 PROGRESSIVE DISCLOSURE FLOW"),
  bullet("L1: Action label + company + priority badge \u2014 scannable in 1-2 seconds per item"),
  bullet("L2: Click action \u2192 opens source IntelligenceNarrative in IntelligencePanel with reasoning"),
  bullet("L3: Inside IntelligencePanel, evidence chain for the intelligence behind the action"),
  bullet("L4: Related signals and cross-account patterns for the action's source intelligence"),
  spacer(40),
  accentBorder("REAL BACKEND DEPENDENCIES"),
  bullet("API: GET /api/intelligence/narratives?limit=10 (existing; actions extracted from narrative.actions array)"),
  bullet("Client-side: filter and rank narrative.actions across all loaded narratives"),
  bullet("No new API endpoints required \u2014 action data already flows through narrative service"),
  spacer(100),

  // ── WORK ITEM 5: AccountDeltaTracker ──
  h2("Work Item 5: AccountDeltaTracker \u2014 Change Detection"),
  accentBorder("WHY THIS COMPONENT EXISTS"),
  body("Executives need to know \"what changed?\" not just \"what is the current state?\" The current system presents static snapshots. The AccountDeltaTracker introduces change detection: new signals, confidence shifts, score movements since the user's last session. This directly answers VP Sales Question Q2 and creates the feeling of a living, monitoring intelligence system."),
  spacer(40),
  accentBorder("CURRENT USER JOURNEY PROBLEMS"),
  bullet("No change detection \u2014 Q2 is literally impossible to answer"),
  bullet("Static KPI values without context (delta, trend) feel like a data warehouse"),
  bullet("User cannot distinguish between a stable account and one with new intelligence"),
  bullet("No visual indicator of what is new vs. what was already known"),
  spacer(40),
  accentBorder("DESIGN INTENT"),
  body("Delta badges overlaid on IntelligenceQueue cards: green up-arrow for score increases, red down-arrow for decreases, blue pulse for new signals. Delta values shown inline (e.g., \"+12\", \"-5\"). A \"Changes Since Last Visit\" section header separates changed accounts from stable ones. Session timestamp stored in localStorage to compute deltas."),
  spacer(40),
  accentBorder("EXPECTED EMOTIONAL OUTCOME"),
  body("\"DeepMindQ is watching my accounts in real-time. It tells me what changed while I was away.\" This creates the feeling of a persistent intelligence partner, not a static reporting tool."),
  spacer(40),
  accentBorder("EXPECTED INTELLIGENCE IMPROVEMENT"),
  tbl(
    ["Metric", "Before", "After", "Improvement"],
    [
      ["Q2 answerability", "Impossible", "Possible via delta badges", "New capability"],
      ["New signal visibility", "Mixed into chronological feed", "Highlighted with blue pulse badge", "Instant recognition"],
      ["Score trend awareness", "None (static number only)", "Delta arrows (+12, -5) visible", "New capability"],
    ]
  ),
  spacer(40),
  accentBorder("REAL BACKEND DEPENDENCIES"),
  bullet("NEW API endpoint required: GET /api/intelligence/deltas?since=<timestamp>"),
  bullet("Data: signal-lifecycle.ts (new signal detection), freshness-indicators.ts (confidence shifts), account-prioritization (score deltas)"),
  bullet("Client: localStorage for session timestamp; compare current vs. stored values"),
  spacer(100),

  // ── WORK ITEM 6: StatusMetricsBar ──
  h2("Work Item 6: StatusMetricsBar \u2014 Cognitive Load Reduction"),
  accentBorder("WHY THIS COMPONENT EXISTS"),
  body("The KPI metrics (Total Accounts, Active Signals, Avg Intel Score, Pending Actions) serve a purpose: system health monitoring. But they should not occupy the most valuable real estate on the page (the first viewport). The StatusMetricsBar relocates these metrics to a collapsible bar at the bottom or top of the page, reducing cognitive load by removing 4 numbers from the first-screen experience while keeping them accessible."),
  spacer(40),
  accentBorder("CURRENT USER JOURNEY PROBLEMS"),
  bullet("4 KPI cards occupy the second-most-prominent position on the page (after the header)"),
  bullet("KPI numbers provide no context (no delta, no trend, no intelligence)"),
  bullet("The KPI grid competes with intelligence content for the user's attention"),
  bullet("KPI-first layout signals \"data dashboard\" not \"intelligence system\""),
  spacer(40),
  accentBorder("DESIGN INTENT"),
  body("A thin, collapsible strip at the bottom of the Command Center. Default state shows minimal summary: \"X accounts | Y signals | Z% confidence | N actions\". Click to expand to full KPI view with animated counters. The strip uses muted colors to visually de-emphasize against the intelligence content above."),
  spacer(40),
  accentBorder("EXPECTED EMOTIONAL OUTCOME"),
  body("\"The numbers are there when I need them, but they don't distract me from what matters.\" The user feels the interface respects their attention. The system knows what to foreground and what to background."),
  spacer(40),
  accentBorder("EXPECTED INTELLIGENCE IMPROVEMENT"),
  tbl(
    ["Metric", "Before", "After", "Improvement"],
    [
      ["KPI visibility in first viewport", "4 cards, prominent position", "Minimal summary strip or hidden", "Cognitive load reduced"],
      ["Time to first intelligence element", "After 4 KPI cards (3-4 seconds)", "Immediate (0 seconds)", "3-4 seconds faster"],
      ["Emotional signal on page load", "\"Data dashboard\"", "\"Intelligence briefing\"", "Category shift"],
    ]
  ),
  spacer(40),
  accentBorder("REAL BACKEND DEPENDENCIES"),
  bullet("API: GET /api/dashboard/stats (existing endpoint, same data source as current KPIs)"),
  bullet("No new API endpoints required"),
  spacer(100),
];

// ─── PART C: BEFORE vs AFTER VALIDATION FRAMEWORK ───
const partC: Paragraph[] = [
  h1("Part C: Before vs After Validation Framework"),
  body("This section defines the measurement framework for Phase 1B closure. Before any implementation begins, the baseline metrics are recorded here. After implementation, the same measurements will be taken to demonstrate improvement."),
  spacer(60),

  h2("C.1 VP Sales Scenario Validation"),
  body("The VP Sales scenario is the ultimate acceptance test. A VP Sales user opens DeepMindQ and must achieve the following within the specified time and click constraints:"),
  tbl(
    ["Task", "Before (Current)", "After (Phase 1B Target)", "Measurement Method"],
    [
      ["Understand priorities within 30 seconds", "Impossible \u2014 must scan 8+ elements", "HeroNarrative visible immediately; priority clear in 0 seconds", "Screenshot + stopwatch"],
      ["Find reasoning within 1 click", "Impossible \u2014 reasoning hidden in L2 (requires expand)", "InlineReasoning visible without clicking", "Click counter + screenshot"],
      ["See evidence within 2 clicks", "2-3 clicks (navigate to company profile, find section)", "Click HeroNarrative \u2192 IntelligencePanel with EvidenceChain (1-2 clicks)", "Click counter + screenshot"],
      ["Take action without searching menus", "No actions exist in current UI", "ActionCTA visible in HeroNarrative; ActionQueue below", "Screenshot + action log"],
    ]
  ),
  spacer(60),

  h2("C.2 Screens Required"),
  tbl(
    ["Screen", "Before", "After"],
    [
      ["First screen (Command Center)", "Header + KPIs + 2-column grid (4 data cards)", "HeroNarrative + InlineReasoning + ActionCTA + IntelligenceQueue"],
      ["Intelligence drill-down", "Navigate to company profile (separate screen)", "IntelligencePanel (slide-over, same screen)"],
      ["Evidence view", "Company profile \u2192 Intelligence section ( buried in page)", "IntelligencePanel \u2192 EvidenceChain (prominent in panel)"],
      ["Action view", "No dedicated action view", "ActionQueue section on same page"],
      ["System status", "4 KPI cards in main viewport", "Collapsible StatusMetricsBar at bottom"],
    ]
  ),
  spacer(60),

  h2("C.3 Clicks Required (Full Task Flow)"),
  tbl(
    ["Task Flow", "Before (Clicks)", "After (Clicks)", "Reduction"],
    [
      ["Understand #1 priority", "0 (scan 8+ items, no click)", "0 (visible immediately)", "Same (but quality drastically improved)"],
      ["Access reasoning for #1", "2-3 (expand signal, navigate)", "0 (inline)", "100% reduction"],
      ["View evidence for #1", "3-4 (navigate to profile, find section)", "1-2 (click \u2192 IntelligencePanel)", "60% reduction"],
      ["Take action on #1", "Impossible", "1 (click ActionCTA)", "From impossible to 1"],
      ["Review next 3 priorities", "Scan 8+ more items", "Scan 4 cards in queue", "50% fewer items"],
      ["Full Q1-Q5 validation", "15+ clicks, 5+ minutes, 2 impossible", "3 clicks, 30 seconds, all possible", "80% reduction"],
    ]
  ),
  spacer(60),

  h2("C.4 Time to Decision"),
  tbl(
    ["Decision", "Before", "After", "Improvement"],
    [
      ["What needs attention?", "8-12 seconds (scan + interpret)", "0 seconds (immediate)", "Instant"],
      ["Which accounts changed?", "Impossible (no feature)", "5 seconds (scan delta badges)", "New capability"],
      ["Why does AI think this?", "15-20 seconds (navigate + find)", "0 seconds (inline reasoning)", "Instant"],
      ["What should I do?", "Impossible (no actions)", "3 seconds (read ActionCTA)", "New capability"],
      ["Full 5-question assessment", "5+ minutes, 2 questions impossible", "Under 60 seconds, all answerable", "5x faster, 100% coverage"],
    ]
  ),
  spacer(60),

  h2("C.5 Cognitive Load Reduction"),
  tbl(
    ["Load Factor", "Before", "After", "Reduction"],
    [
      ["Elements in first viewport", "11 (header + KPIs + morning brief + 4 cards + badges)", "3-4 (HeroNarrative + ActionCTA + queue preview)", "65% fewer elements"],
      ["Decision points (what to look at)", "7 competing areas", "1 primary (HeroNarrative) + 1 secondary (queue)", "71% fewer"],
      ["Numbers requiring interpretation", "4 KPI values", "1 confidence value (contextualized)", "75% fewer"],
      ["Actions available without navigation", "0", "5 (ActionQueue + HeroNarrative CTA)", "New capability"],
      ["Information hierarchy clarity", "Flat (all elements equal weight)", "Layered (L1 headline > L2 reasoning > L3 evidence)", "Fundamental improvement"],
    ]
  ),
  spacer(60),

  h2("C.6 Anti-SaaS Visual Differentiation"),
  tbl(
    ["Product", "Layout Pattern", "DeepMindQ Phase 1B Difference"],
    [
      ["Salesforce Dashboard", "Tab navigation + grid widgets + report tables", "Narrative-first layout: intelligence headline > reasoning > evidence > action. No tabs. No grids."],
      ["Gong Analytics", "Filter sidebar + chart panels + conversation playlists", "No charts, no filters. System surfaces conclusions, not analysis tools. User is decision-maker, not analyst."],
      ["Clari Forecasting", "Pipeline grid + stage columns + deal rows + timeline", "No pipeline grid. Signal-first ordering by urgency and impact, not by pipeline stage."],
      ["Generic AI Assistant", "Chat input + conversation bubbles + suggestion chips", "Not a chat interface. Proactive intelligence briefing with structured L1-L4 hierarchy."],
      ["DeepMindQ Phase 1B", "HeroNarrative > InlineReasoning > IntelligenceQueue > ActionQueue", "Intelligence Command System: narrative-first, evidence-grounded, action-terminated"],
    ]
  ),
  spacer(100),
];

// ─── PART D: NO-MOCK INTELLIGENCE VERIFICATION ───
const partD: Paragraph[] = [
  h1("Part D: No-Mock Intelligence Verification"),
  body("This section traces the complete data flow for every displayed intelligence element in Phase 1B, proving that no static narratives, artificial recommendations, hardcoded confidence scores, or placeholder evidence will be used."),
  spacer(60),

  h2("D.1 Full Data Flow Traceability"),
  body("Every intelligence element displayed in Phase 1B components must trace back through the following pipeline:"),
  spacer(40),
  accentBorder("HERONARRATIVE DATA FLOW"),
  bullet("UI Layer: HeroNarrative renders IntelligenceNarrative with data prop"),
  bullet("Hook Layer: useIntelligenceNarratives({ limit: 1, minConfidence: 50, minSeverity: 'high' })"),
  bullet("API Layer: GET /api/intelligence/narratives?limit=1&minConfidence=50&minSeverity=high"),
  bullet("Service Layer: intelligence-narrative-service.ts \u2192 generateCommandCenterNarratives()"),
  bullet("Engine Layer: GroundingEngine.ground() \u2192 evidence extraction"),
  bullet("Confidence: computeConfidenceScore({ signalQuality, evidenceQuality, capabilityFit, dataCompleteness })"),
  bullet("Explainability: computeConfidenceFactors() \u2192 positive/negative factor labels"),
  bullet("Evidence: buildNarrativeEvidence() \u2192 EvidenceChainItem[] with source, snippet, URL"),
  bullet("Action: buildNarrativeFromSignal() \u2192 action recommendations from ActionEngine"),
  spacer(40),
  accentBorder("INTELLIGENCEQUEUE DATA FLOW"),
  bullet("Same pipeline as HeroNarrative, with limit=5, excluding first item"),
  bullet("Ranked by: confidence x priority (critical=4, high=3, medium=2, low=1)"),
  bullet("Each IntelligenceCard uses IntelligenceCard component (existing, intelligence-os/)"),
  spacer(40),
  accentBorder("INLINEREASONING DATA FLOW"),
  bullet("Data: narrative.confidence.factors (from computeConfidenceFactors)"),
  bullet("Display: factor labels and magnitudes \u2014 real computed values, not template text"),
  bullet("Source: confidence-explainability.ts, called by intelligence-narrative-service.ts"),
  spacer(40),
  accentBorder("ACTIONQUEUE DATA FLOW"),
  bullet("Data: narrative.actions[] from each narrative (from buildNarrativeFromSignal)"),
  bullet("Cross-narrative extraction: client-side filter and rank across all narratives"),
  bullet("Action labels: generated by ActionEngine, not hardcoded strings"),
  spacer(40),
  accentBorder("ACCOUNTDELTATRACKER DATA FLOW"),
  bullet("NEW endpoint: GET /api/intelligence/deltas?since=<timestamp>"),
  bullet("Computed from: signal-lifecycle.ts (new signals), freshness-indicators.ts (confidence shifts)"),
  bullet("Session: localStorage timestamp comparison"),
  bullet("Risk: This is the only component requiring a new endpoint. All others use existing APIs."),
  spacer(40),
  accentBorder("STATUSMETRICSBAR DATA FLOW"),
  bullet("Data: GET /api/dashboard/stats (existing endpoint)"),
  bullet("Same data as current KPIs, just relocated in the layout"),
  bullet("Zero new dependencies"),
  spacer(100),
];

// ─── PART E: PHASE 1B CLOSURE PACKAGE REQUIREMENTS ───
const partE: Paragraph[] = [
  h1("Part E: Phase 1B Closure Package Requirements"),
  body("Phase 1B will be considered complete only when the following closure package is delivered and verified. Each item must be present and pass its acceptance criteria."),
  spacer(60),

  h2("E.1 Required Closure Deliverables"),
  tbl(
    ["Deliverable", "Content", "Format"],
    [
      ["Files created/modified/deleted", "Complete list with file paths, change type, and description of each change", "Table"],
      ["Architecture changes", "Description of any structural changes to component hierarchy, data flow, or page layout", "Narrative + diagram"],
      ["API/data flow changes", "Documentation of any new or modified API endpoints, request/response schemas", "API spec table"],
      ["Component inventory", "List of all Phase 1B components with status (new/modified), purpose, and test coverage", "Table"],
      ["Test results", "Vitest output: total tests, pass/fail/skip, new tests added", "Test output log"],
      ["Build validation", "TypeScript compilation (tsc clean), Next.js build success, lint clean", "Build output log"],
      ["UX DNA compliance review", "Checklist: Intelligence-First, Confidence Visible, Evidence Traceable, Action-Terminated, Calm Over Complexity", "Pass/fail checklist"],
      ["Before/after screenshots", "Full-page screenshots of Command Center before and after Phase 1B", "PNG with timestamps"],
      ["VP Sales scenario validation", "Recorded walkthrough: 30-second understanding, 1-click reasoning, 2-click evidence, action without search", "Screenshots + click log"],
      ["Click/time/cognitive load comparison", "Before vs after metrics from Part C validation framework", "Comparison table"],
      ["Anti-SaaS visual differentiation", "Screenshots + explanation of how the result differs from Salesforce/Gong/Clari", "Screenshots + narrative"],
    ]
  ),
  spacer(60),

  h2("E.2 Human Experience Verdict"),
  body("The final closure deliverable is the Human Experience Verdict, a binary classification of the Phase 1B result. The verdict must be one of:"),
  spacer(40),
  bullet("A) SaaS/CRM with AI Features: The result looks and feels like a conventional enterprise dashboard with AI elements added. KPI cards, data grids, and generic layouts dominate. The user interprets data before receiving intelligence."),
  bullet("B) AI Intelligence Command System: The result looks and feels like an intelligence briefing system. Narratives lead, data follows. The user receives intelligence before seeing data. Evidence is accessible. Actions are guided."),
  spacer(40),
  body("Phase 1B passes closure only if the verdict is B. If the result is A, Phase 1B is not complete and must continue until the Intelligence Command System experience is achieved."),
  spacer(100),
];

// ═══════════════════════════════════════════════════════════════
// ASSEMBLE DOCUMENT
// ═══════════════════════════════════════════════════════════════
const doc = new Document({
  styles: {
    default: {
      document: { run: { font: { ascii: "Calibri" }, size: 24, color: c("000000") }, paragraph: { spacing: { line: 312 } } },
      heading1: { run: { font: { ascii: "Times New Roman" }, size: 32, bold: true, color: c("1A1F36") }, paragraph: { spacing: { before: 480, after: 200 } } },
      heading2: { run: { font: { ascii: "Times New Roman" }, size: 28, bold: true, color: c("1A1F36") }, paragraph: { spacing: { before: 360, after: 160 } } },
      heading3: { run: { font: { ascii: "Times New Roman" }, size: 26, bold: true, color: c("1A1F36") }, paragraph: { spacing: { before: 240, after: 120 } } },
    },
  },
  sections: [
    // Cover
    {
      properties: {
        page: { size: { width: 11906, height: 16838 }, margin: { top: 0, bottom: 0, left: 0, right: 0 } },
      },
      children: buildCover(),
    },
    // Body
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 } },
      },
      headers: {
        default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "DeepMindQ Phase 1B \u2014 Before Implementation Snapshot & Design Decisions", size: 16, color: c("90989F"), font: { ascii: "Calibri" } })] })] }),
      },
      footers: {
        default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: c("90989F"), font: { ascii: "Calibri" } })] })] }),
      },
      children: [
        ...executionPrinciple,
        ...partA,
        ...partB,
        ...partC,
        ...partD,
        ...partE,
      ],
    },
  ],
});

const OUTPUT = "/home/z/my-project/download/DeepMindQ-Phase1B-Before-Implementation-Snapshot-and-Design-Decisions.docx";
Packer.toBuffer(doc).then((buf: Buffer) => {
  fs.writeFileSync(OUTPUT, buf);
  console.log(`Document generated: ${OUTPUT}`);
});
