/**
 * DeepMindQ Phase 1B Implementation Preparation Document
 * Command Center: Executive Intelligence Experience
 *
 * 6-section design decision document per user specification.
 * DOCX generation using docx-js with DM-1 palette (tech/AI).
 */

import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, WidthType,
  PageBreak, SectionType, ShadingType, BorderStyle, PageNumber,
  TableLayoutType,
} from "docx";
import * as fs from "fs";

// ═══════════════════════════════════════════════════════════════
// PALETTE — DM-1 Deep Cyan (AI / Tech)
// ═══════════════════════════════════════════════════════════════
const P = {
  bg: "162235",
  primary: "FFFFFF",
  accent: "37DCF2",
  table: { headerBg: "1B6B7A", headerText: "FFFFFF", accentLine: "1B6B7A", innerLine: "C8DDE2", surface: "EDF3F5" },
  body: "1A1F36",
  secondary: "5A6080",
  text: "000000",
  subtitleColor: "B0B8C0",
  metaColor: "90989F",
  footerColor: "687078",
};

const c = (hex: string) => hex.replace("#", "");
const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };

// ═══════════════════════════════════════════════════════════════
// COVER — Recipe R1 (Pure Paragraph Left)
// ═══════════════════════════════════════════════════════════════
function calcTitleLayout(title: string, maxWidthTwips: number, preferredPt = 40, minPt = 24) {
  const charWidth = (pt: number) => pt * 20;
  const charsPerLine = (pt: number) => Math.floor(maxWidthTwips / charWidth(pt));
  let titlePt = preferredPt;
  let lines: string[] = [];
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

function splitTitleLines(title: string, charsPerLine: number): string[] {
  if (title.length <= charsPerLine) return [title];
  const breakAfter = new Set([...",.;:!? ", "-", "_", "/"]);
  const lines: string[] = [];
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
    lines[lines.length - 1] += ` ${last}`;
  }
  return lines;
}

function calcCoverSpacing(params: {
  titleLineCount: number; titlePt: number;
  hasSubtitle: boolean; hasEnglishLabel: boolean;
  metaLineCount: number; fixedHeight: number;
}) {
  const { titleLineCount, titlePt, hasSubtitle, hasEnglishLabel, metaLineCount, fixedHeight = 800 } = params;
  const SAFETY = 1200;
  const usableHeight = 16838 - SAFETY;
  const titleHeight = titleLineCount * (titlePt * 23 + 200);
  const subtitleHeight = hasSubtitle ? (12 * 23 + 600) : 0;
  const englishLabelHeight = hasEnglishLabel ? (9 * 23 + 600) : 0;
  const metaHeight = metaLineCount * (10 * 23 + 100);
  const implicitParaHeight = 3 * 300;
  const contentHeight = titleHeight + subtitleHeight + englishLabelHeight + metaHeight + fixedHeight + implicitParaHeight;
  const remainingSpace = Math.max(usableHeight - contentHeight, 400);
  return { topSpacing: Math.floor(remainingSpace * 0.45), midSpacing: 0, bottomSpacing: Math.max(Math.floor(remainingSpace * 0.45), 800) };
}

function buildCoverR1(config: {
  title: string; subtitle: string; englishLabel: string;
  metaLines: string[]; footerLeft: string; footerRight: string;
  palette: typeof P;
}) {
  const pal = config.palette;
  const padL = 1200, padR = 800;
  const availableWidth = 11906 - padL - padR - 300;
  const { titlePt, titleLines } = calcTitleLayout(config.title, availableWidth, 38, 24);
  const titleSize = titlePt * 2;
  const spacing = calcCoverSpacing({
    titleLineCount: titleLines.length, titlePt,
    hasSubtitle: !!config.subtitle, hasEnglishLabel: !!config.englishLabel,
    metaLineCount: config.metaLines.length, fixedHeight: 400,
  });

  const accentLeft = { style: BorderStyle.SINGLE, size: 8, color: pal.accent, space: 12 };
  const children: Paragraph[] = [];

  children.push(new Paragraph({ spacing: { before: spacing.topSpacing } }));

  if (config.englishLabel) {
    children.push(new Paragraph({
      indent: { left: padL, right: padR }, spacing: { after: 500 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: pal.accent, space: 8 } },
      children: [new TextRun({
        text: config.englishLabel.split("").join("  "),
        size: 18, color: pal.accent, font: { ascii: "Calibri" }, characterSpacing: 40,
      })],
    }));
  }

  for (let i = 0; i < titleLines.length; i++) {
    children.push(new Paragraph({
      indent: { left: padL },
      spacing: { after: i < titleLines.length - 1 ? 100 : 300, line: Math.ceil(titlePt * 23), lineRule: "atLeast" as const },
      children: [new TextRun({
        text: titleLines[i], size: titleSize, bold: true,
        color: pal.primary, font: { ascii: "Arial" },
      })],
    }));
  }

  if (config.subtitle) {
    children.push(new Paragraph({
      indent: { left: padL }, spacing: { after: 800 },
      children: [new TextRun({
        text: config.subtitle, size: 24, color: pal.subtitleColor,
        font: { ascii: "Calibri" },
      })],
    }));
  }

  for (const line of config.metaLines) {
    children.push(new Paragraph({
      indent: { left: padL + 200 }, spacing: { after: 80 },
      border: { left: accentLeft },
      children: [new TextRun({ text: line, size: 24, color: pal.metaColor, font: { ascii: "Calibri" } })],
    }));
  }

  children.push(new Paragraph({ spacing: { before: spacing.bottomSpacing } }));
  children.push(new Paragraph({
    indent: { left: padL, right: padR },
    border: { top: { style: BorderStyle.SINGLE, size: 2, color: pal.accent, space: 8 } },
    spacing: { before: 200 },
    children: [
      new TextRun({ text: config.footerLeft || "", size: 16, color: pal.footerColor, font: { ascii: "Calibri" } }),
      new TextRun({ text: "                                        " }),
      new TextRun({ text: config.footerRight || "", size: 16, color: pal.footerColor, font: { ascii: "Calibri" } }),
    ],
  }));

  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: 16838, rule: "exact" as const },
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: pal.bg }, borders: noBorders,
        children,
      })],
    })],
  })];
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════
function h1(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 480, after: 200 },
    children: [new TextRun({ text, bold: true, size: 32, color: c("1A1F36"), font: { ascii: "Times New Roman" } })],
  });
}

function h2(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 360, after: 160 },
    children: [new TextRun({ text, bold: true, size: 28, color: c("1A1F36"), font: { ascii: "Times New Roman" } })],
  });
}

function h3(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, size: 26, color: c("1A1F36"), font: { ascii: "Times New Roman" } })],
  });
}

function body(text: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { after: 120, line: 312 },
    children: [new TextRun({ text, size: 24, color: c("000000"), font: { ascii: "Calibri" } })],
  });
}

function bullet(text: string, indent = 480): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    indent: { left: indent },
    spacing: { after: 80, line: 312 },
    children: [new TextRun({ text: `\u2022  ${text}`, size: 24, color: c("000000"), font: { ascii: "Calibri" } })],
  });
}

function spacer(before = 200): Paragraph {
  return new Paragraph({ spacing: { before }, children: [] });
}

function makeHeaderRow(cells: string[]): TableRow {
  return new TableRow({
    tableHeader: true,
    children: cells.map(text => new TableCell({
      shading: { type: ShadingType.CLEAR, fill: P.table.headerBg },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 2, color: P.table.accentLine },
        bottom: { style: BorderStyle.SINGLE, size: 2, color: P.table.accentLine },
        left: NB, right: NB,
      },
      margins: { top: 60, bottom: 60, left: 120, right: 120 },
      children: [new Paragraph({
        alignment: AlignmentType.LEFT,
        children: [new TextRun({ text, bold: true, size: 21, color: P.table.headerText, font: { ascii: "Calibri" } })],
      })],
    })),
  });
}

function makeDataRow(cells: string[], idx: number): TableRow {
  const fill = idx % 2 === 0 ? "FFFFFF" : P.table.surface;
  return new TableRow({
    children: cells.map(text => new TableCell({
      shading: { type: ShadingType.CLEAR, fill },
      borders: {
        top: { style: BorderStyle.NONE },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: P.table.innerLine },
        left: NB, right: NB,
      },
      margins: { top: 60, bottom: 60, left: 120, right: 120 },
      children: [new Paragraph({
        alignment: AlignmentType.LEFT,
        children: [new TextRun({ text, size: 21, color: c("000000"), font: { ascii: "Calibri" } })],
      })],
    })),
  });
}

function makeTable(headers: string[], rows: string[][]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: P.table.accentLine },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: P.table.accentLine },
      left: NB, right: NB, insideVertical: NB,
    },
    rows: [
      makeHeaderRow(headers),
      ...rows.map((r, i) => makeDataRow(r, i)),
    ],
  });
}

// ═══════════════════════════════════════════════════════════════
// DOCUMENT ASSEMBLY
// ═══════════════════════════════════════════════════════════════

const cover = buildCoverR1({
  title: "DeepMindQ Phase 1B: Command Center Executive Intelligence Experience",
  subtitle: "Implementation Preparation Document",
  englishLabel: "DESIGN DECISION DOCUMENT",
  metaLines: [
    "Status: Design Phase \u2014 No Coding Until Reviewed",
    "Objective: Transform Command Center into Primary Decision Environment",
    "Audience: VP Sales / CRO Executive Users",
    "Date: 2026-08-02",
    "Baseline: Phase 1A COMPLETE (c059d8c)",
  ],
  footerLeft: "DeepMindQ Intelligence OS",
  footerRight: "CONFIDENTIAL",
  palette: P,
});

// ─── EXECUTION PRINCIPLE (opening statement) ───
const execPrinciple: Paragraph[] = [
  spacer(200),
  new Paragraph({
    spacing: { after: 200 },
    border: { left: { style: BorderStyle.SINGLE, size: 12, color: c("1B6B7A"), space: 12 } },
    indent: { left: 400 },
    children: [new TextRun({
      text: "EXECUTION PRINCIPLE",
      bold: true, size: 20, color: c("1B6B7A"), font: { ascii: "Calibri" },
    })],
  }),
  body("Phase 1B is NOT a UI redesign exercise. The objective is to transform Command Center from an intelligence-enabled page into the primary decision environment for VP Sales/CRO users. Success is not measured by more cards, dashboards, visual elements, or information density. Success is defined as: \"When an executive opens DeepMindQ, the system already understands what matters, explains why, and guides the next best action.\""),
  body("This document must be reviewed and approved before any Phase 1B coding begins."),
  spacer(100),
];

// ─── SECTION 1: Current Command Center Baseline ───
const section1: Paragraph[] = [
  h1("Section 1: Current Command Center Baseline"),
  body("This section documents the existing state of the Command Center as delivered at Phase 1A closure. The baseline serves as the starting point for all Phase 1B transformations. Every design decision in subsequent sections references this baseline to justify why changes are needed and what specific problems they solve."),

  h2("1.1 Current Screenshot Description"),
  body("The current Command Center (command-center.tsx, 856 lines) presents a dark-themed intelligence dashboard with the following visual zones: a top navigation bar with breadcrumb and action buttons, a KPI summary strip showing 4 key metrics (Total Accounts, Active Signals, Average Intelligence Score, Pending Actions) with animated counters, a two-column grid layout with recent signals on the left and top opportunities on the right, a horizontal intelligence feed at the bottom, and an engine health sidebar. The visual design uses the Intelligence OS design token system (surface.base #0a0c10, accent blue #3b82f6) with Framer Motion animations throughout."),
  body("The command-center.tsx inside the intelligence-os directory (1107 lines) provides the intelligence-native overlay that includes: a daily briefing header with summary narrative, a priority accounts section ranked by intelligence score with signal count indicators, an account briefing list showing match strength and action counts, a cross-account insights section for pattern detection, and an action items feed with priority-coded items. This component integrates the IntelligenceNarrative, ConfidenceIndicator, and useIntelligenceNarratives hook to consume real data from the /api/intelligence/narratives endpoint."),

  h2("1.2 Current Information Hierarchy"),
  body("The information hierarchy follows a dashboard-first pattern: KPI metrics at the top, followed by entity lists (signals, opportunities), then a chronological feed at the bottom. The intelligence-os command center adds a layer of narrative intelligence on top, but the two views exist as separate components rather than a unified experience. The current hierarchy is:"),
  bullet("Level 1 (Top): KPI counters \u2014 aggregate numbers only, no context"),
  bullet("Level 2 (Middle): Signal cards and Opportunity cards \u2014 data-rich but intelligence-light"),
  bullet("Level 3 (Bottom): Intelligence feed \u2014 chronological list, no prioritization by urgency"),
  bullet("Level 4 (Overlay): Daily briefing narrative \u2014 the only intelligence-first element, but secondary to dashboard metrics"),
  body("The problem is clear: the hierarchy leads with raw numbers and data cards, then buries the intelligence narrative. An executive must scroll past 4 KPI counters and 6-8 data cards before encountering any AI reasoning. This is the inverse of the Intelligence-First principle established in Phase 1A."),

  h2("1.3 Current User Flow"),
  body("When a VP Sales opens the Command Center today, the flow is: (1) See 4 numbers \u2014 no indication of what changed or why. (2) Scan a grid of signal cards \u2014 each requires reading to understand relevance. (3) Check opportunity cards \u2014 again, reading required. (4) Scroll to the intelligence feed at the bottom. (5) If they use the intelligence-os overlay, they see the daily briefing but must mentally connect it to the dashboard above. The cognitive sequence is: data \u2192 scan \u2192 read \u2192 interpret \u2192 decide. The executive must do the intelligence work themselves."),

  h2("1.4 Cognitive Load Issues"),
  body("The current design imposes several cognitive burdens on the executive user. First, the KPI strip presents 4 numbers without context \u2014 the user must mentally answer \"is this good or bad?\" and \"what changed since yesterday?\" without any guidance. Second, the signal/opportunity grid presents 8-12 items simultaneously, requiring the user to scan titles, severities, and confidence values to determine what matters. Third, the intelligence feed is chronological, not priority-ordered \u2014 a critical risk signal has the same visual weight as a low-priority enrichment notification. Fourth, the daily briefing exists in a separate visual context from the data cards, forcing the user to mentally integrate two different presentation models. Fifth, there is no single action path \u2014 the user must decide where to click among multiple options without guidance."),

  h2("1.5 Remaining Gaps Against Intelligence-First Principles"),
  body("Phase 1A established the intelligence foundation: real narratives, real confidence, traceable evidence, and action-driven design. However, the Command Center does not yet fully embody these principles in its user experience. The specific gaps are: (1) Intelligence is presented as a secondary layer below dashboard metrics, not as the primary experience. (2) The user starts at data, not at decisions. (3) Progressive disclosure (L1-L4) exists in individual IntelligenceNarrative components but is not the organizing principle of the page. (4) Context preservation is absent \u2014 navigating from a signal to its evidence requires context switching. (5) Navigation reduction has not been applied \u2014 the page offers too many entry points without clear priority. (6) The emotional design goal (\"I know something my competitors don't\") is present in individual narratives but not in the overall page experience. Phase 1B must close these gaps."),
  spacer(100),
];

// ─── SECTION 2: Final Experience Blueprint ───
const section2: Paragraph[] = [
  h1("Section 2: Final Experience Blueprint"),
  body("This section defines the target experience for Phase 1B. The blueprint is organized by time-to-value: what the user understands in the first 30 seconds, what decisions they can make in the first 5 minutes, and what the highest-value first action is. The blueprint is the contract between design and implementation \u2014 every component in Section 4 must map back to a specific element of this blueprint."),

  h2("2.1 First 30 Seconds: Immediate Understanding"),
  body("When an executive opens DeepMindQ, within 30 seconds they must understand three things without scrolling, without clicking, and without prior context. First, the system must communicate: \"Here is what needs your attention today.\" This is delivered through a single, prominent intelligence headline \u2014 not a KPI number, but a natural language statement like \"Acme Corp's new CTO hiring signal has increased their buying propensity to 87% confidence.\" Second, the system must communicate: \"Here is why.\" This is delivered through a confidence indicator and a one-line reasoning summary directly below the headline. Third, the system must communicate: \"Here is what you should do about it.\" This is delivered through an ActionCTA that is visible within the viewport, labeled with the specific action (\"Schedule a discovery call with Acme Corp\"), not a generic button."),
  body("The 30-second experience eliminates the current KPI-first pattern entirely. There are no aggregate counters at the top. The first thing the user sees is intelligence \u2014 a decision-quality narrative with confidence and a clear action. This is the Intelligence-First principle applied at the page level, not just the component level."),

  h2("2.2 First 5 Minutes: Decisions the User Can Make"),
  body("Within 5 minutes, the VP Sales should be able to answer all five validation questions established in Phase 1A. These five questions are the success criteria for the Command Center experience:"),
  makeTable(
    ["Question", "Current Gap", "Phase 1B Target"],
    [
      ["1. What needs my attention?", "User must scan 8-12 signal cards to determine priority", "System surfaces the #1 priority intelligence first, with clear urgency indicators"],
      ["2. Which accounts have changed?", "No change detection UI; chronological feed only", "Account change indicators with delta scoring; new vs. declining signals highlighted"],
      ["3. Why does AI think this?", "Evidence buried in ProgressiveDisclosure L2-L3; requires clicking", "One-line reasoning visible inline; full evidence accessible without context switch"],
      ["4. What should I do next?", "Multiple competing CTAs; no prioritized action path", "Single prioritized action per intelligence item; action queue ranked by impact"],
      ["5. How do I continuously learn?", "No feedback loop from actions to intelligence", "Action feedback captured; intelligence confidence updates based on user decisions"],
    ]
  ),
  spacer(60),
  body("The 5-minute experience uses progressive disclosure at the page level. The user starts at the intelligence headline (answer to Q1), drills into the reasoning (Q3), reviews account changes (Q2), takes the recommended action (Q4), and the system learns from the interaction (Q5). Each question is answered in sequence, with the intelligence hierarchy guiding the flow naturally."),

  h2("2.3 First Action: Highest-Value Guidance"),
  body("The highest-value action DeepMindQ can guide an executive toward is: engaging with the account that has the highest combination of signal strength, confidence, and revenue potential \u2014 and doing so with full intelligence context. This is not \"view a dashboard\" or \"check a report.\" It is a specific, named action on a specific account, with the reasoning and evidence already assembled."),
  body("The ActionCTA from Phase 1A provides the mechanism. Phase 1B must ensure that the CTA is always visible, always specific, and always connected to the intelligence narrative above it. The first action must be unambiguous: there should be exactly one primary action at any given time, with secondary actions available but visually de-emphasized. This is the \"Decision Reduction\" principle applied at the page level."),
  spacer(100),
];

// ─── SECTION 3: Intelligence Hierarchy Validation ───
const section3: Paragraph[] = [
  h1("Section 3: Intelligence Hierarchy Validation"),
  body("The intelligence hierarchy is the structural backbone of the Phase 1B experience. Phase 1A implemented Progressive Disclosure as a component pattern (ProgressiveDisclosure.tsx, 361 lines). Phase 1B must elevate this pattern to a page-level organizing principle. The user should never start at raw data. Every piece of information must be presented within the hierarchy, and the hierarchy must be visible in the visual layout of the Command Center itself."),

  h2("3.1 Level 1: Decision / What Matters?"),
  body("Level 1 is the intelligence headline. It occupies the most prominent position on the page \u2014 the first thing the user sees. It answers the question \"What needs my attention?\" in natural language, accompanied by a confidence indicator and a priority badge. The Level 1 element is a full IntelligenceNarrative rendered at the top of the Command Center, not buried in a feed. It is generated by the intelligence-narrative-service.ts, which composes the existing engines into a narrative-ready data structure. The Level 1 element is always a signal, opportunity, or risk \u2014 never an enrichment or informational update. It represents the highest-priority intelligence in the system at the current moment."),

  h2("3.2 Level 2: Reasoning / Why?"),
  body("Level 2 is the reasoning layer. It answers \"Why does the system think this matters?\" through a concise reasoning summary and a set of contributing factors. The Level 2 element is visible inline, directly below the Level 1 headline, without requiring the user to click or expand. The confidence breakdown from computeConfidenceFactors() is rendered as a compact visual: positive factors in green, negative factors in amber, with the 4-dimension weights (Signal 30%, Evidence 30%, Capability 25%, Data 15%) shown as a stacked bar. This gives the executive immediate understanding of why the confidence is what it is, without overwhelming detail."),

  h2("3.3 Level 3: Evidence / Proof?"),
  body("Level 3 is the evidence layer. It answers \"What proves this?\" through the EvidenceChain component connected to real evidence from the GroundingEngine. Level 3 requires user interaction to reveal \u2014 it is accessed by clicking the Level 1 or Level 2 element, which opens the IntelligencePanel. Inside the panel, the EvidenceChain renders each evidence item with source type icon, source name, snippet, date, and URL. The evidence is ordered by relevance score (computed by buildNarrativeEvidence), with the strongest evidence first. This layer ensures that the executive can always audit the AI's reasoning, building trust through transparency."),

  h2("3.4 Level 4: Exploration / Deep Analysis?"),
  body("Level 4 is the exploration layer. It answers \"What else should I consider?\" through related signals, cross-account patterns, and historical context. Level 4 is accessed from within the IntelligencePanel, below the evidence chain. It shows related signals from the same account, cross-account intelligence patterns (from cross-account-intelligence.ts), and temporal context (how this signal evolved over time). The key principle is that Level 4 never appears before Level 1-3. The user must first understand the decision (L1), trust the reasoning (L2), and verify the evidence (L3) before exploring further. This prevents information overload and ensures the user's cognitive path follows the intelligence hierarchy."),

  h2("3.5 Page-Level Hierarchy Implementation"),
  body("The hierarchy is implemented as a visual layout structure, not just a component pattern. The Command Center page is organized into a single-column layout with the Level 1 intelligence headline at the top, followed by a compact Level 2 reasoning summary, followed by a grid of Level 1 mini-narratives for the next 3-5 priority items (each expandable to L2-L4 via IntelligencePanel). Below this, a Level 1 action queue shows the top recommended actions. The KPI metrics, currently at the top, are moved to a collapsible status bar at the bottom of the page. This inversion of the current layout ensures that intelligence leads, data follows."),
  spacer(100),
];

// ─── SECTION 4: Component Implementation Plan ───
const section4: Paragraph[] = [
  h1("Section 4: Component Implementation Plan"),
  body("This section specifies every new or modified component required for Phase 1B. For each component, the following attributes are defined: purpose, user problem solved, intelligence source, API dependency, expected user behavior, visual behavior, and acceptance test. This section serves as the contract between design and engineering \u2014 no component should be built without a corresponding entry here, and no entry here should lack a corresponding implementation."),

  h2("4.1 Primary Intelligence Surface (HeroNarrative)"),
  makeTable(
    ["Attribute", "Specification"],
    [
      ["Purpose", "Render the single highest-priority intelligence item as a full-width narrative at the top of the Command Center. This is the first thing the user sees."],
      ["User Problem Solved", "Eliminates the need to scan multiple cards to find what matters. The system tells the user what matters."],
      ["Intelligence Source", "intelligence-narrative-service.ts (generateCommandCenterNarratives with limit=1, minSeverity=high). Uses the existing NarrativeConfidence and NarrativeEvidence types."],
      ["API Dependency", "GET /api/intelligence/narratives?limit=1&minSeverity=high. Auth-protected. Existing endpoint, no API changes needed."],
      ["Expected User Behavior", "User reads the headline, sees confidence, reads one-line reasoning, and either clicks to drill down (opens IntelligencePanel with L2-L4) or clicks the ActionCTA to take the recommended action."],
      ["Visual Behavior", "Full-width card (IntelligenceNarrative variant=signal/opportunity/risk), occupies 60% of the first viewport. Confidence ring (ConfidenceIndicator mode=ring, size=lg) in the top-right corner. Priority badge (critical=red, high=amber) below the title. ActionCTA at the bottom with variant=primary."],
      ["Acceptance Test", "When Command Center loads, the first visible element is an IntelligenceNarrative with real data from /api/intelligence/narratives. The narrative has confidence > 0, evidence count > 0, and an action label. Clicking the narrative opens IntelligencePanel with L2-L4 content."],
    ]
  ),
  spacer(60),

  h2("4.2 Priority Intelligence Queue (IntelligenceQueue)"),
  makeTable(
    ["Attribute", "Specification"],
    [
      ["Purpose", "Display the next 3-5 priority intelligence items as compact cards below the HeroNarrative, each expandable to full narrative with L2-L4 drill-down."],
      ["User Problem Solved", "After the top item, the user needs to see what else matters without scrolling through a chronological feed. The queue is ordered by priority, not time."],
      ["Intelligence Source", "Same narratives API (limit=5, exclude the hero item). Each item uses IntelligenceCard component for the compact view."],
      ["API Dependency", "GET /api/intelligence/narratives?limit=5. Same endpoint, different parameters. The first item is excluded client-side (already shown as HeroNarrative)."],
      ["Expected User Behavior", "User scans the compact cards (2-3 seconds each). If a card catches attention, user clicks to expand it inline into a full IntelligenceNarrative with L2-L3 visible, or opens IntelligencePanel for L4."],
      ["Visual Behavior", "Horizontal scrollable row or 2-column grid of IntelligenceCard components. Each card shows: title, entity name, confidence bar (mode=bar, size=sm), priority badge, and timestamp. Compact \u2014 maximum 3 lines of visible text per card."],
      ["Acceptance Test", "Queue displays 3-5 items ordered by priority (critical > high > medium > low, then by confidence descending). Each card expands on click to show full narrative. Evidence chain is accessible from expanded view."],
    ]
  ),
  spacer(60),

  h2("4.3 Inline Reasoning Display (InlineReasoning)"),
  makeTable(
    ["Attribute", "Specification"],
    [
      ["Purpose", "Show a compact reasoning summary and confidence breakdown directly within the HeroNarrative and expanded IntelligenceQueue items, without requiring the user to open a panel."],
      ["User Problem Solved", "Currently, reasoning is only visible in ProgressiveDisclosure L2, which requires clicking. Executives need to see the 'why' immediately, not after an interaction."],
      ["Intelligence Source", "computeConfidenceFactors() from confidence-explainability.ts. Returns positive and negative factors with magnitudes."],
      ["API Dependency", "Included in the narrative API response (NarrativeConfidence.factors field). No additional API calls needed."],
      ["Expected User Behavior", "User reads the one-line reasoning summary and the top 2-3 contributing factors without any clicking. If they want full evidence, they can drill down to L3."],
      ["Visual Behavior", "A compact section below the narrative title. Shows: one-line reasoning text (italic, secondary color), then a horizontal factor bar showing top 3 positive factors (green) and top 2 negative factors (amber) with labels. Confidence ring alongside for quick reference."],
      ["Acceptance Test", "Expanded narrative shows reasoning text and factor bar inline. Factors are real (from API response), not template text. Each factor label corresponds to a confidence dimension."],
    ]
  ),
  spacer(60),

  h2("4.4 Action Queue (ActionQueue)"),
  makeTable(
    ["Attribute", "Specification"],
    [
      ["Purpose", "Display the top 5 recommended actions across all intelligence items, ranked by combined priority and revenue impact. Single place to see 'what should I do today?'"],
      ["User Problem Solved", "Currently, actions are embedded within individual narratives. The executive needs a consolidated view of all recommended actions to plan their day."],
      ["Intelligence Source", "Action recommendations from ActionEngine (lib/engines/action-engine.ts) and opportunity-recommendation-engine.ts, composed by intelligence-narrative-service.ts buildNarrativeFromSignal()."],
      ["API Dependency", "GET /api/intelligence/narratives?limit=10. Actions are extracted client-side from narrative responses. Each narrative includes action items in the 'actions' array."],
      ["Expected User Behavior", "User scans the action list (5 items max), reads the action label and the associated company/signal context, and clicks the most impactful action to execute it."],
      ["Visual Behavior", "A distinct section below the IntelligenceQueue. Each action is a compact row: action label (bold), company name, intelligence source (e.g., 'Signal: CTO Hiring'), priority badge, and a compact confidence indicator. The #1 action has a prominent CTA button; others have subtle link-style CTAs."],
      ["Acceptance Test", "Action Queue shows exactly 5 items. Each item has a real action label, associated company, and links to the source intelligence. Clicking an action opens the relevant intelligence detail. The queue is ordered by priority."],
    ]
  ),
  spacer(60),

  h2("4.5 Account Change Detection (AccountDeltaTracker)"),
  makeTable(
    ["Attribute", "Specification"],
    [
      ["Purpose", "Highlight accounts that have experienced significant intelligence changes since the user's last session (new signals, confidence shifts, score movements)."],
      ["User Problem Solved", "Executives need to know 'what changed?' not just 'what is the current state?' Change detection surfaces movement, not static snapshots."],
      ["Intelligence Source", "Signal lifecycle data from signal-lifecycle.ts, freshness indicators from freshness-indicators.ts, and account scoring deltas from account-prioritization/engine.ts."],
      ["API Dependency", "New endpoint: GET /api/intelligence/deltas?since=<lastSessionTimestamp>. Returns accounts with score changes, new signals, and confidence shifts above threshold. Requires session timestamp tracking."],
      ["Expected User Behavior", "User sees change indicators (arrows, delta values) on accounts in the IntelligenceQueue. Accounts with significant changes have a 'New' or 'Changed' badge. Clicking reveals the delta detail."],
      ["Visual Behavior", "Delta badges on IntelligenceCards: green up-arrow for score increases, red down-arrow for decreases, blue pulse for new signals. Delta values shown inline (e.g., '+12', '-5'). A 'Changes Since Last Visit' section header separates changed accounts from stable ones."],
      ["Acceptance Test", "Accounts with new signals show 'New' badge. Accounts with confidence changes > 10 points show delta arrow. Clicking a changed account reveals what changed (new signal, confidence shift, etc.)."],
    ]
  ),
  spacer(60),

  h2("4.6 Status Metrics Bar (StatusMetricsBar)"),
  makeTable(
    ["Attribute", "Specification"],
    [
      ["Purpose", "Move the current KPI metrics (Total Accounts, Active Signals, Avg Intelligence Score, Pending Actions) to a collapsible status bar at the bottom of the page, or a subtle header strip."],
      ["User Problem Solved", "KPIs are useful for system health monitoring but should not be the first thing an executive sees. They should be accessible but not prominent."],
      ["Intelligence Source", "Existing dashboard stats API: GET /api/dashboard/stats."],
      ["API Dependency", "GET /api/dashboard/stats. Existing endpoint, no changes needed."],
      ["Expected User Behavior", "User can expand the status bar to see aggregate metrics. By default, only a minimal summary indicator is visible (e.g., '12 active signals')."],
      ["Visual Behavior", "A thin strip at the bottom of the Command Center, collapsed by default. Shows: 'X accounts | Y active signals | Z% avg confidence | N pending actions'. Expandable on click to show the full KPI view with sparklines."],
      ["Acceptance Test", "Status bar is collapsed on page load. KPI metrics are NOT visible in the first viewport. Clicking the bar expands to show full metrics. Metrics match values from /api/dashboard/stats."],
    ]
  ),
  spacer(100),
];

// ─── SECTION 5: Anti-SaaS Design Check ───
const section5: Paragraph[] = [
  h1("Section 5: Anti-SaaS Design Check"),
  body("This section is a critical design safeguard. It asks: how does the Phase 1B Command Center avoid becoming another Salesforce dashboard, Gong analytics view, Clari forecasting screen, or generic AI assistant UI? The answer must be specific and architectural, not aspirational. Every design choice in Phase 1B must pass this check before implementation."),

  h2("5.1 vs. Salesforce Dashboard"),
  body("Salesforce dashboards present data in grids, tables, and charts organized by record type (Accounts, Opportunities, Leads). The user navigates by choosing a record type, then scanning the associated data. The dashboard is a data viewer \u2014 the user must interpret the data themselves. DeepMindQ's Phase 1B Command Center is fundamentally different in three ways. First, the primary surface is a narrative, not a grid. The system tells the user what matters, rather than presenting data for the user to interpret. Second, the information hierarchy is decision-first, not record-type-first. The user starts at a decision (\"Engage with Acme Corp now\"), not at a record type (\"View all accounts\"). Third, every piece of data carries confidence and evidence. Salesforce data is presented as facts; DeepMindQ intelligence is presented as conclusions with supporting proof. The user can audit any recommendation by drilling into the evidence chain, something Salesforce dashboards do not offer."),

  h2("5.2 vs. Gong Analytics View"),
  body("Gong's analytics view excels at conversation intelligence: analyzing calls, emails, and meetings to surface patterns. Its UI presents insights as charts, filters, and playlists organized by category (deal risk, competitive mentions, coaching opportunities). Gong is analysis-first: the user must choose what to analyze. DeepMindQ is intelligence-first: the system has already analyzed and synthesized the intelligence, presenting conclusions rather than raw analysis. The key difference is that Gong requires the user to be the analyst \u2014 they choose filters, select categories, and interpret patterns. DeepMindQ positions the user as the decision-maker \u2014 the system has already done the analysis and is presenting the conclusion with a recommended action. The ProgressiveDisclosure L1-L4 hierarchy ensures the user sees the decision first and can drill into the analysis only when needed."),

  h2("5.3 vs. Clari Forecasting Screen"),
  body("Clari's forecasting screen presents pipeline data, deal stages, and revenue projections in a grid and timeline format. The user navigates between deals, stages, and time periods to understand pipeline health. Clari is data-first and temporal-first: the user works through time-based views of their pipeline. DeepMindQ's Command Center is signal-first and action-first: the user works through intelligence signals ordered by urgency and impact, not by time or pipeline stage. Additionally, Clari's intelligence is limited to internal CRM data (deal stage, close date, amount). DeepMindQ's intelligence draws from 12 external signal types (hiring signals, funding events, SEC filings, news, web monitoring, competitive intel) combined with internal data. The breadth of intelligence sources is a fundamental differentiator that the Phase 1B design must make visible."),

  h2("5.4 vs. Generic AI Assistant UI"),
  body("Generic AI assistant UIs (ChatGPT-style interfaces, Copilot sidebars) present a conversational interface where the user asks questions and the AI responds. The user must know what to ask. DeepMindQ is not a chat interface \u2014 it is an intelligence briefing system. The system proactively surfaces intelligence rather than waiting for the user to ask. The key differences are: (1) Proactive vs. Reactive: DeepMindQ tells the user what matters; chat interfaces wait for questions. (2) Structured vs. Unstructured: DeepMindQ presents intelligence in a structured hierarchy (L1-L4) with confidence and evidence; chat interfaces present unstructured text. (3) Action-driven vs. Information-driven: Every DeepMindQ narrative ends with a specific action; chat interfaces provide information that the user must translate into action. (4) Evidence-grounded vs. Black-box: DeepMindQ provides a full evidence chain; chat interfaces typically do not expose their reasoning sources."),

  h2("5.5 What Makes This Uniquely DeepMindQ"),
  body("DeepMindQ's unique identity is defined by five non-replicable characteristics. First, the Intelligence-First Architecture: the entire system, from database schema to UI components, is built around the intelligence pipeline (Signal \u2192 Grounding \u2192 Confidence \u2192 Evidence \u2192 Action). The UI is the visual expression of this pipeline, not a dashboard built on top of it. Second, Evidence Traceability: every recommendation can be traced back to specific signals, sources, and data points through the EvidenceChain. No other sales intelligence platform provides this level of auditability. Third, Multi-Factor Confidence: the 4-dimension confidence formula (Signal 30% + Evidence 30% + Capability 25% + Data 15%) with explainable factors gives executives a calibrated trust model. Fourth, Action-Terminated Intelligence: every narrative ends with a specific, prioritized action, eliminating the gap between insight and execution. Fifth, Intelligence Hierarchy: the L1-L4 progressive disclosure pattern ensures the right information at the right depth, preventing both information overload and superficial analysis. These five characteristics must be visually evident in the Phase 1B Command Center experience."),
  spacer(100),
];

// ─── SECTION 6: Evidence Standard ───
const section6: Paragraph[] = [
  h1("Section 6: Evidence Standard"),
  body("This section defines the evidence requirements for Phase 1B completion. These standards are inherited from Phase 1A and remain active for all Phase 1B items. No phase completion will be accepted based on code existence alone. Every completed item must include the evidence specified below, and the evidence must demonstrate real data flow, not template data or mock implementations."),

  h2("6.1 Required Evidence per Completed Item"),
  makeTable(
    ["Evidence Type", "Requirement", "Format"],
    [
      ["Before/After Screenshots", "Visual comparison of the Command Center before and after each component implementation. Must show real data, not placeholder text.", "PNG screenshots with timestamps"],
      ["File-Level Evidence", "List of every file created, modified, or deleted for the item. Each file must have a description of the change.", "Table with file path, change type, and description"],
      ["Real Data Flow Proof", "Demonstration that data flows from the API through the component to the UI. Must show the API response and the rendered output.", "API response JSON + rendered UI screenshot"],
      ["UX DNA Validation", "Verification that the implementation follows the Intelligence-First principles: narrative first, confidence visible, evidence traceable, action-terminated.", "Checklist with pass/fail per principle"],
      ["User Journey Improvement Metrics", "Measurement of the user's ability to answer the 5 VP Sales questions faster or more accurately after the implementation.", "Before/after comparison table"],
      ["Build/Test Results", "Verification that all tests pass, TypeScript compiles cleanly, and the build succeeds after the implementation.", "Test output with pass/fail counts"],
    ]
  ),
  spacer(60),

  h2("6.2 Phase 1B Completion Criteria"),
  body("Phase 1B is complete when ALL of the following conditions are met. First, every component in Section 4 has been implemented with its acceptance test passing. Second, the Intelligence Hierarchy (Section 3) is validated: the user never starts at raw data; L1-L4 progressive disclosure is the organizing principle of the page. Third, the Anti-SaaS check (Section 5) is validated: the Command Center does not look like a Salesforce dashboard, Gong analytics view, Clari forecasting screen, or generic AI assistant. Fourth, the VP Sales 5-minute validation passes: a VP Sales user can answer all 5 questions within 5 minutes of opening the Command Center. Fifth, all evidence standards (Section 6.1) are met for every completed item. Sixth, no regressions: all existing Phase 1A tests continue to pass (1888+ pass, 0 fail). Seventh, the design document (this document) has been reviewed and approved before coding began."),

  h2("6.3 Known Limitation from Phase 1A (Carried Forward)"),
  body("The following limitation, documented in the Phase 1A closure, applies to Phase 1B as well: \"Phase 1A established the intelligence foundation and Command Center integration. Further phases must focus on expanding this intelligence-first experience across all major user journeys while maintaining real engine connectivity.\" This means Phase 1B must not compromise the real engine connectivity established in Phase 1A. Every component must consume real API data, not template data. If an API dependency is not ready, the component must show a loading state or error state \u2014 never fallback to static content."),

  h2("6.4 Phase 1B Execution Guardrails"),
  body("Three guardrails constrain the Phase 1B implementation. First, no coding until this document is reviewed and approved. This is non-negotiable. Second, no new API endpoints unless specified in Section 4 (AccountDeltaTracker is the only new endpoint; all other components use existing APIs). Third, no changes to the intelligence engine layer (lib/engines/*, lib/intelligence-sources/*) \u2014 Phase 1B is a UI/UX transformation that consumes existing intelligence, not an engine modification. Engine changes, if needed, should be documented as Phase 1C scope. Fourth, every component must use the existing design token system (tokens from design-tokens.ts). No hardcoded colors, no new color values, no visual divergence from the established Intelligence OS design language."),
];

// ═══════════════════════════════════════════════════════════════
// DOCUMENT CREATION
// ═══════════════════════════════════════════════════════════════

const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: { ascii: "Calibri" }, size: 24, color: c("000000") },
        paragraph: { spacing: { line: 312 } },
      },
      heading1: {
        run: { font: { ascii: "Times New Roman" }, size: 32, bold: true, color: c("1A1F36") },
        paragraph: { spacing: { before: 480, after: 200 } },
      },
      heading2: {
        run: { font: { ascii: "Times New Roman" }, size: 28, bold: true, color: c("1A1F36") },
        paragraph: { spacing: { before: 360, after: 160 } },
      },
      heading3: {
        run: { font: { ascii: "Times New Roman" }, size: 26, bold: true, color: c("1A1F36") },
        paragraph: { spacing: { before: 240, after: 120 } },
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
      children: cover,
    },
    // Body section
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({
              text: "DeepMindQ Phase 1B \u2014 Implementation Preparation Document",
              size: 16, color: c("90989F"), font: { ascii: "Calibri" },
            })],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: c("90989F"), font: { ascii: "Calibri" } })],
          })],
        }),
      },
      children: [
        ...execPrinciple,
        ...section1,
        ...section2,
        ...section3,
        ...section4,
        ...section5,
        ...section6,
      ],
    },
  ],
});

const OUTPUT = "/home/z/my-project/download/DeepMindQ-Phase1B-Implementation-Preparation.docx";
Packer.toBuffer(doc).then((buf: Buffer) => {
  fs.writeFileSync(OUTPUT, buf);
  console.log(`Document generated: ${OUTPUT}`);
});
