const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  PageBreak, Header, Footer, PageNumber, NumberFormat,
  AlignmentType, HeadingLevel, WidthType, BorderStyle, ShadingType,
  SectionType, TableOfContents, TableLayoutType,
} = require("docx");
const fs = require("fs");

// ═══════════════════════════════════════════════════════════
// PALETTE: DM-1 Deep Cyan
// ═══════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════
// BORDER HELPERS
// ═══════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════
// TITLE LAYOUT HELPERS
// ═══════════════════════════════════════════════════════════
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
  const breakAfter = new Set([",", ".", ":", ";", "!", "?", "-", "/", " "]);
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
  const { titleLineCount = 1, titlePt = 36, hasSubtitle = false, metaLineCount = 0, fixedHeight = 800 } = params;
  const pageHeight = 16838;
  const SAFETY = 1200;
  const usableHeight = pageHeight - SAFETY;
  const titleHeight = titleLineCount * (titlePt * 23 + 200);
  const subtitleHeight = hasSubtitle ? (12 * 23 + 600) : 0;
  const metaHeight = metaLineCount * (10 * 23 + 100);
  const implicitParaHeight = 3 * 300;
  const contentHeight = titleHeight + subtitleHeight + metaHeight + fixedHeight + implicitParaHeight;
  const remainingSpace = usableHeight - contentHeight;
  const safeRemaining = Math.max(remainingSpace, 400);
  const FOOTER_MIN = 800;
  const rawTop = Math.floor(safeRemaining * 0.45);
  const rawBottom = Math.floor(safeRemaining * 0.45);
  const bottomSpacing = Math.max(rawBottom, FOOTER_MIN);
  const topSpacing = Math.max(rawTop - Math.max(0, FOOTER_MIN - rawBottom), 400);
  return { topSpacing, bottomSpacing };
}

// ═══════════════════════════════════════════════════════════
// COVER BUILDER (R1 — Pure Paragraph Left)
// ═══════════════════════════════════════════════════════════
function buildCoverR1(config) {
  const P = config.palette;
  const padL = 1200, padR = 800;
  const availableWidth = 11906 - padL - padR - 300;
  const { titlePt, titleLines } = calcTitleLayout(config.title, availableWidth, 38, 24);
  const spacing = calcCoverSpacing({
    titleLineCount: titleLines.length, titlePt,
    hasSubtitle: !!config.subtitle, metaLineCount: (config.metaLines || []).length, fixedHeight: 400,
  });
  const accentLeft = { style: BorderStyle.SINGLE, size: 8, color: P.accent, space: 12 };
  const children = [];
  children.push(new Paragraph({ spacing: { before: spacing.topSpacing } }));
  for (let i = 0; i < titleLines.length; i++) {
    children.push(new Paragraph({
      indent: { left: padL },
      spacing: { after: i < titleLines.length - 1 ? 100 : 300, line: Math.ceil(titlePt * 23), lineRule: "atLeast" },
      children: [new TextRun({ text: titleLines[i], size: titlePt * 2, color: P.titleColor, bold: true,
        font: { ascii: "Calibri" }, characterSpacing: titlePt >= 36 ? 30 : 0 })],
    }));
  }
  if (config.subtitle) {
    children.push(new Paragraph({
      indent: { left: padL }, spacing: { after: 800 },
      children: [new TextRun({ text: config.subtitle, size: 24, color: P.subtitleColor, font: { ascii: "Calibri" } })],
    }));
  }
  for (const line of (config.metaLines || [])) {
    children.push(new Paragraph({
      indent: { left: padL + 200 }, spacing: { after: 80 },
      border: { left: accentLeft },
      children: [new TextRun({ text: line, size: 24, color: P.metaColor, font: { ascii: "Calibri" } })],
    }));
  }
  children.push(new Paragraph({ spacing: { before: spacing.bottomSpacing } }));
  children.push(new Paragraph({
    indent: { left: padL, right: padR },
    border: { top: { style: BorderStyle.SINGLE, size: 2, color: P.accent, space: 8 } },
    spacing: { before: 200 },
    children: [
      new TextRun({ text: config.footerLeft || "", size: 16, color: P.footerColor, font: { ascii: "Calibri" } }),
      new TextRun({ text: "                                        " }),
      new TextRun({ text: config.footerRight || "", size: 16, color: P.footerColor, font: { ascii: "Calibri" } }),
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

// ═══════════════════════════════════════════════════════════
// BODY COMPONENT BUILDERS
// ═══════════════════════════════════════════════════════════
const FONT_BODY = "Times New Roman";
const FONT_HEADING = "Calibri";

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 480, after: 240 },
    children: [new TextRun({ text, bold: true, size: 32, color: c(bodyPalette.primary), font: { ascii: FONT_HEADING } })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 320, after: 160 },
    children: [new TextRun({ text, bold: true, size: 26, color: c(bodyPalette.accent), font: { ascii: FONT_HEADING } })],
  });
}
function h3(text) {
  return new Paragraph({
    spacing: { before: 200, after: 120 },
    children: [new TextRun({ text, bold: true, size: 23, color: c(bodyPalette.primary), font: { ascii: FONT_HEADING } })],
  });
}
function body(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: 312, after: 100 },
    children: [new TextRun({ text, size: 22, color: c(bodyPalette.body), font: { ascii: FONT_BODY } })],
  });
}
function bodyBold(label, text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: 312, after: 100 },
    children: [
      new TextRun({ text: label, bold: true, size: 22, color: c(bodyPalette.body), font: { ascii: FONT_BODY } }),
      new TextRun({ text, size: 22, color: c(bodyPalette.body), font: { ascii: FONT_BODY } }),
    ],
  });
}
function bodyItalic(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: 312, after: 100 },
    children: [new TextRun({ text, size: 22, color: c(bodyPalette.secondary), italics: true, font: { ascii: FONT_BODY } })],
  });
}
function spacer(h = 100) {
  return new Paragraph({ spacing: { before: h, after: 0 }, children: [] });
}
function bullet(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: 312, after: 60 },
    indent: { left: 400, hanging: 200 },
    children: [
      new TextRun({ text: "\u2022 ", size: 22, color: c(bodyPalette.accent), font: { ascii: FONT_BODY } }),
      new TextRun({ text, size: 22, color: c(bodyPalette.body), font: { ascii: FONT_BODY } }),
    ],
  });
}
function codeBlock(text) {
  return new Paragraph({
    spacing: { before: 80, after: 80, line: 276 },
    indent: { left: 400 },
    children: [new TextRun({ text, size: 20, color: "4A5568", font: { ascii: "Courier New" } })],
  });
}

// ═══════════════════════════════════════════════════════════
// TABLE BUILDER
// ═══════════════════════════════════════════════════════════
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
        spacing: { before: 60, after: 60, line: 312 },
        children: [new TextRun({ text: h, bold: true, size: 20, color: c(bodyPalette.tableHeaderText), font: { ascii: "Calibri" } })],
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
        spacing: { before: 40, after: 40, line: 312 },
        children: [new TextRun({ text: cell, size: 20, color: c(bodyPalette.body), font: { ascii: FONT_BODY } })],
      })],
    })),
  }));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [headerRow, ...dataRows],
  });
}

// ═══════════════════════════════════════════════════════════
// PAGE NUMBER FOOTER
// ═══════════════════════════════════════════════════════════
function pageNumFooter(formatType) {
  return new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: c(bodyPalette.secondary), font: { ascii: FONT_BODY } })],
    })],
  });
}

// ═══════════════════════════════════════════════════════════
// COMPARISON TABLE HELPER
// ═══════════════════════════════════════════════════════════
function comparisonTable(rows) {
  return makeTable(
    ["Dimension", "Current State", "Target State"],
    rows.map(r => [r[0], r[1], r[2]]),
    [25, 35, 40],
  );
}

// ═══════════════════════════════════════════════════════════
// DOCUMENT CONTENT
// ═══════════════════════════════════════════════════════════

const coverChildren = buildCoverR1({
  title: "Phase 1B Component Design Decisions",
  subtitle: "Before Implementation Snapshots & Intelligence Command System Architecture",
  metaLines: [
    "DeepMindQ Intelligence OS  |  Branch: phase-4-critical-input-path  |  Commit: c059d8c",
    "Date: August 2026",
  ],
  footerLeft: "DeepMindQ",
  footerRight: "Confidential",
  palette: coverPalette,
});

const bodyContent = [

  // ──────────────────────────────────────────────────────────
  // EXECUTIVE SUMMARY
  // ──────────────────────────────────────────────────────────
  h1("Executive Summary"),
  body("This document presents the before-implementation snapshots and design decisions for six foundational components of the Phase 1B Intelligence Command System. These components collectively transform the DeepMindQ Command Center from a passive data dashboard into an active intelligence-driven decision platform. Each component is documented with a rigorous analysis of its current state in the codebase, its intended user journey impact, the underlying design intent, and a detailed technical implementation plan."),
  body("The six components are: HeroNarrative, the primary intelligence surface that presents the top-priority insight with progressive disclosure of evidence and reasoning; IntelligenceQueue, a ranked priority queue that replaces the undifferentiated card grid with urgency-graded recommendations; InlineReasoning, a transparency layer that connects every reasoning claim to its supporting evidence; ActionQueue, an execution-oriented component that transforms intelligence outputs into time-sensitive, actionable items; AccountDeltaTracker, a new session-to-session change detection system that eliminates the need for users to mentally diff current state against prior observations; and StatusMetricsBar, a repositioned system health strip that provides always-visible operational context without competing with intelligence content."),
  body("Together, these components implement the core interaction pattern of the Intelligence Command System: the user opens the Command Center and immediately sees the single most important insight (HeroNarrative), supported by system health context (StatusMetricsBar), with clear awareness of what has changed since their last session (AccountDeltaTracker). From this primary intelligence surface, the user can progressively drill into evidence (InlineReasoning), review ranked secondary priorities (IntelligenceQueue), and execute recommended actions (ActionQueue). The design philosophy prioritizes cognitive efficiency: zero clicks for the most critical information, one click for supporting detail, and never more than two clicks for any actionable outcome."),
  body("The architectural decisions documented here are informed by direct analysis of the existing codebase at commit c059d8c on the phase-4-critical-input-path branch. File references, line numbers, and specific code patterns are provided to anchor every design decision in the current implementation reality. All components are designed for extraction from the current 1000+ line command-center.tsx monolith into standalone, testable modules within the src/components/intelligence-os/ directory."),

  spacer(200),

  // ──────────────────────────────────────────────────────────
  // COMPONENT 1: HERO NARRATIVE
  // ──────────────────────────────────────────────────────────
  h1("1. HeroNarrative: The Primary Intelligence Surface"),

  h2("1.1 Current State Analysis"),
  body("The HeroNarrative currently exists as a private function component embedded within command-center.tsx at lines 126 through 376. It is not exported, not independently testable, and shares the 1000+ line file with five other component definitions. The component renders the number-one priority intelligence narrative sourced from the useIntelligenceNarratives hook, which calls /api/intelligence/narratives and ultimately flows through IntelligenceNarrativeService into GroundingEngine."),
  body("In its current form, the HeroNarrative displays four progressive disclosure layers. Layer 1 (L1) presents the decision headline alongside a confidence ring visualization and a priority badge. Layer 2 (L2) shows inline reasoning text in italics along with confidence factor chips derived from narrative.confidence.factors. Layer 3 and Layer 4 are handled through the IntelligencePanel component, which opens as a slide-over panel containing the evidence chain and related signals respectively."),
  body("Several specific problems exist in the current implementation. First, the L2 reasoning section consumes narrative.confidence.factors typed as any, eliminating compile-time safety and making refactoring hazardous. Second, the evidence panel opens via a simple useState boolean toggle with no animation choreography, resulting in an abrupt appearance that disrupts the user's reading flow. Third, there is zero delta or comparison awareness; the component cannot indicate whether a narrative is new, upgraded, or unchanged since the user's previous session. Fourth, when the intelligence pipeline returns no data, the component renders a generic 'no intelligence' message that provides no guidance. Fifth, the ActionCTA handler contains complex branching logic that checks narrative.primaryAction.onClick, then falls back to entityType detection, then falls back to a generic navigation path, making the click behavior unpredictable."),
  body("The component currently occupies the first position in the visual layout, which is correct, but it competes visually with the KPI metrics section that follows it. The lack of visual weight differentiation means the intelligence insight does not clearly dominate the first viewport as intended."),

  h2("1.2 User Journey Impact"),
  body("The VP Sales 30-second test reveals a critical gap. When a VP of Sales opens the Command Center, the current experience presents the intelligence headline alongside significant visual clutter from adjacent sections. While the headline is technically visible in the first viewport, it does not dominate it. The VP must mentally filter surrounding content to focus on the primary insight."),
  comparisonTable([
    ["Clicks to see reasoning (L2)", "0 (already visible)", "0 (already visible, improved layout)"],
    ["Clicks to see evidence (L3)", "1 (panel toggle)", "1 (panel toggle with animation)"],
    ["Clicks to see related signals (L4)", "2 (panel + tab)", "2 (panel + tab)"],
    ["Cognitive load", "Medium (cluttered context)", "Low (clean hierarchy)"],
    ["Decision time to first action", "8-12 seconds", "Under 5 seconds"],
    ["Delta awareness", "None", "Immediate (badge indicators)"],
  ]),
  spacer(80),
  body("The target experience ensures that within five seconds of opening the Command Center, the VP Sales can answer three questions without scrolling: 'What changed?', 'Why should I care?', and 'What should I do?' The current implementation partially answers the second question through the inline reasoning display but fails on the first (no delta tracking) and provides an inconsistent answer to the third (complex action branching)."),

  h2("1.3 Design Intent"),
  body("The HeroNarrative exists because intelligence must speak first. In a Command Center, the first thing a decision-maker sees should not be a metric or a dashboard grid but an insight with evidence. This component serves as the primary interface between the intelligence pipeline and the human decision-maker. Its existence is justified by the fundamental principle that the value of an intelligence system is measured by how quickly it delivers actionable understanding, not by how much data it displays."),
  body("The component solves the user problem of information overload combined with insight deficit. Users currently have access to abundant data points but lack a synthesized, prioritized interpretation. The HeroNarrative bridges this gap by presenting a single, high-confidence, evidence-backed recommendation as the dominant first-screen element."),
  body("The emotional target is reassurance through transparency. After interacting with the HeroNarrative, the user should feel that 'the system understands my business' and 'I can trust this recommendation because I can see exactly why.' This is achieved through the progressive disclosure architecture: the headline establishes relevance, the reasoning establishes logic, the evidence establishes proof, and the action establishes forward momentum."),
  body("The intelligence improvement expectation is a measurable reduction in decision latency. By surfacing the top-priority insight with zero clicks and making the supporting evidence accessible within one click, the component should reduce the average time from Command Center open to informed action from the current 8-12 seconds to under 5 seconds."),

  h2("1.4 Technical Implementation Plan"),
  body("The component will be extracted to a standalone file at src/components/intelligence-os/hero-narrative.tsx and exported as a named export. The internal architecture manages two state dimensions: expandedLevel (values 1 through 4, tracking the current progressive disclosure depth) and isTransitioning (a boolean governing animation choreography during level changes)."),
  bodyBold("Props Interface: ", "{ narrative: IntelligenceNarrativeData | null; isLoading: boolean; previousNarrative?: IntelligenceNarrativeData | null; onDrillDown?: (id: string) => void; onAction?: (entityType: string, entityId: string) => void; }"),
  body("The data flow follows the canonical intelligence pipeline: Signal (raw intelligence event) flows into Evidence (grounded data points from GroundingEngine), which feeds Reasoning (synthesized narrative from IntelligenceNarrativeService), which produces Confidence (calculated score with factors), which enables the Recommendation (the headline and action). The HeroNarrative consumes the final Recommendation output and provides backward navigation through the chain on user demand."),
  body("Layer 1 renders the decision headline, a large ConfidenceRing component, a PriorityBadge, and a timestamp. Layer 2 adds inline reasoning in italic text alongside ConfidenceFactorChips that distinguish positive factors (green) from negative factors (amber), displaying a maximum of three positive and two negative factors. Layer 3 triggers the IntelligencePanel slide-over containing the EvidenceChain. Layer 4 adds RelatedSignals and CrossAccountPatterns as additional tabs within the panel."),
  body("Delta mode activates when previousNarrative is provided. In this mode, the component displays animated differences between current and previous state: confidence score deltas (e.g., '+15' or '-8'), new evidence count badges, and priority escalation indicators. The delta computation compares narrative IDs and confidence scores between current and previous snapshots."),
  body("The loading state renders a skeleton with a pulsing confidence ring and three text placeholder lines. The empty state displays the message 'All accounts stable. No critical intelligence requires attention.' in a calm, non-alarming tone. The error state shows an inline error banner with a retry button that re-triggers the intelligence narrative fetch."),
  body("Animation follows a staggered entrance pattern: the confidence ring fades in first at 0.2 seconds, then the headline at 0.3 seconds, then the reasoning at 0.4 seconds, and finally the action CTA at 0.5 seconds. This creates a deliberate reading order that guides the eye from confidence assessment through content understanding to action."),
  body("Design token references include tokens.surface.card for the component background, tokens.confidence[tier] for the confidence ring color, and tokens.priority[priority] for the priority badge styling. All colors are sourced from the centralized token system to ensure theme consistency."),

  spacer(200),

  // ──────────────────────────────────────────────────────────
  // COMPONENT 2: INTELLIGENCE QUEUE
  // ──────────────────────────────────────────────────────────
  h1("2. IntelligenceQueue: Priority Intelligence Queue"),

  h2("2.1 Current State Analysis"),
  body("The IntelligenceQueue currently exists at lines 798 through 837 of command-center.tsx. It renders as a responsive grid of IntelligenceCard components, taking queueNarratives which is a simple array slice (indices 1 through 6) of the intelligenceNarratives array returned by the useIntelligenceNarratives hook. The grid uses a three-column responsive layout that collapses to fewer columns on smaller viewports."),
  body("Each IntelligenceCard in the current implementation displays: title, description (serving as reasoning text), variant indicator, confidence score, timestamp, entity name, priority badge, and an action label. Clicking the action button navigates the user to the company workspace page. Beyond this individual card navigation, there is no queue-specific interaction model."),
  body("The problems with the current implementation are substantial. First, there is no queue ordering intelligence; the items are simply the sequential slice of the narrative array as returned by the API, with no client-side re-ranking or relative priority visualization. Second, the cards all carry similar visual weight regardless of actual urgency, making it impossible to distinguish at a glance how much more important item one is compared to item three. Third, the section title reads 'Other Priorities,' which is vague and non-actionable; it does not tell the user what to do with this information. Fourth, there are no dismiss or acknowledge interactions, meaning the queue is read-only. Fifth, there are no batch operations such as 'acknowledge all low priority.' Sixth, the grid layout wastes horizontal space on mobile viewports where a single-column list would better support top-to-bottom scan order."),
  body("The fundamental issue is that the current implementation treats the queue as a display grid rather than a ranked recommendation list. The user sees five cards of equal visual weight and must individually assess each one to determine importance, which defeats the purpose of an intelligence system that should be doing this ranking automatically."),

  h2("2.2 User Journey Impact"),
  body("After scanning the HeroNarrative, the VP Sales naturally asks 'What else needs my attention?' The current experience presents three to five cards in a grid with no priority differentiation. The user must read each card's title, confidence, and priority badge individually to build a mental ranking, then decide where to focus."),
  comparisonTable([
    ["Clicks to act on a queue item", "2 (click card, then click action)", "1 (inline action on hover/tap)"],
    ["Visual priority differentiation", "None (equal card weight)", "UrgencyBar gradient + rank number"],
    ["Cognitive load for scanning", "High (read each card individually)", "Low (eye follows urgency gradient)"],
    ["Dismiss/acknowledge capability", "None", "Swipe-right (mobile) / click-X (desktop)"],
    ["Batch operations", "None", "Acknowledge all low-priority"],
    ["Layout scan consistency", "Grid (order varies by viewport)", "Single-column list (fixed order)"],
  ]),
  spacer(80),
  body("The target experience creates a ranked list where the eye naturally gravitates to the most urgent item first. The UrgencyBar provides an instant visual gradient that communicates relative importance without requiring the user to read any text. One-click inline actions eliminate the navigation overhead of the current two-click pattern."),

  h2("2.3 Design Intent"),
  body("The IntelligenceQueue answers the question 'After the top priority, what else matters?' Its existence is predicated on the reality that most intelligence systems generate more signals than a human can act on simultaneously. The queue's job is to rank these signals by combined priority weight and confidence, then present them in a way that makes the ranking immediately visible."),
  body("The component solves the user problem of priority ambiguity. When faced with five intelligence items, the user currently has no systematic way to determine which deserves attention first beyond reading each one. The queue eliminates this ambiguity by computing a rankScore (priority weight multiplied by confidence, normalized) and using that score to drive both the sort order and the visual urgency representation."),
  body("The emotional target is ordered calm. The user should feel 'I know exactly what to focus on next' rather than 'I have five things to look at and don't know where to start.' This is fundamentally different from the current experience of visual overwhelm. The queue is not merely a list; it is a ranked recommendation system presented in human-readable form."),
  body("The intelligence improvement expectation is a reduction in queue triage time from the current 15-20 seconds (reading all cards) to under 5 seconds (scanning the urgency gradient). Additionally, the introduction of dismiss and batch operations should reduce the number of repeated reviews of already-acknowledged items, improving session efficiency over time."),

  h2("2.4 Technical Implementation Plan"),
  body("The component will be extracted to src/components/intelligence-os/intelligence-queue.tsx with the following props interface: { items: IntelligenceNarrativeData[]; onAction: (item: IntelligenceNarrativeData) => void; onDismiss: (id: string) => void; maxVisible?: number; }. The maxVisible prop defaults to 6 and controls how many items are shown before a 'Show more' expansion."),
  body("The layout abandons the current grid approach in favor of a single-column list that maintains consistent scan order across all breakpoints. This is a deliberate design decision: grid layouts reorder items on different viewport sizes, which breaks the user's spatial memory of item positions. A single-column list ensures that item number two is always below item number one, regardless of screen width."),
  body("Each queue item contains the following visual elements from left to right: a RankNumber (1, 2, 3, etc.), a small ConfidenceRing, the Headline text, a OneLineReasoning summary, an UrgencyBar, and an inline Action button. The UrgencyBar is a thin horizontal bar whose width equals the normalized priority_weight multiplied by confidence. Its color maps to the priority tier: critical red, high amber, medium blue, low gray. This single visual element replaces the current approach of relying on text-based priority badges alone."),
  body("The data flow extends the intelligence pipeline by adding a ranking computation step. Raw narratives arrive from the API, are enriched with a computed rankScore, sorted by that score, and then rendered. The ranking formula is: rankScore = priorityWeight(narrative.priority) * narrative.confidence * recencyDecay(narrative.timestamp). The recencyDecay function applies a time-based multiplier that reduces the rank score for older signals."),
  body("Dismiss interactions work differently by platform: on mobile, a swipe-right gesture triggers dismissal; on desktop, a small X button in the top-right corner of each item triggers dismissal. Dismissed items are not deleted but moved to a collapsible 'Acknowledged' section at the bottom of the queue, allowing the user to review them if needed. The dismiss state is managed locally in component state and optionally synced to the backend via the onDismiss callback."),
  body("The empty state displays 'No additional priorities detected' in a muted tone. The animation uses staggered entrance from the left at 0.05 seconds per item, with rank numbers performing a count-up animation on initial render. The TypeScript type IntelligenceNarrativeData is reused from the existing narratives hook, extended with an optional rankScore: number field."),

  spacer(200),

  // ──────────────────────────────────────────────────────────
  // COMPONENT 3: INLINE REASONING
  // ──────────────────────────────────────────────────────────
  h1("3. InlineReasoning: Evidence-to-Conclusion Transparency"),

  h2("3.1 Current State Analysis"),
  body("Reasoning display in the current codebase is fragmented across three separate components with inconsistent visual treatments. The primary instance exists within the HeroNarrative component at lines 269 through 303 of command-center.tsx, where it renders narrative.reasoning as italic text alongside confidence factor chips. A secondary instance exists in the ProgressiveDisclosure component at lines 221 through 259, which presents a 'Why we think this' section containing reasoning text and a reasoningItems list with a different layout. A third instance lives in the standalone EvidenceChain component (approximately 180 lines), which handles L3 evidence display separately from reasoning."),
  body("This fragmentation creates several concrete problems. The reasoning content is presented in three different visual formats: as italic paragraph text in the HeroNarrative, as a bullet list in the ProgressiveDisclosure component, and as a separate evidence chain in the EvidenceChain component. There is no standardized reasoning structure that connects these presentations. More critically, there is no link between reasoning claims and their supporting evidence; the user sees reasoning text and evidence items but cannot trace which evidence supports which specific claim. The confidence factors consumed by the HeroNarrative are typed as any, providing no structured interface for the factor data. Additionally, there is no reasoning quality indicator that communicates whether the reasoning is high-confidence (well-supported by evidence) or speculative (based on limited data)."),
  body("The absence of inline citations means that verifying a reasoning claim currently requires two clicks: opening the IntelligencePanel and then reading through the evidence chain to find the relevant supporting items. This is an unnecessary cognitive burden that undermines trust in the intelligence system."),

  h2("3.2 User Journey Impact"),
  body("The VP Sales reads the intelligence headline and naturally asks 'Why?' The current experience shows italic reasoning text, which is good, but provides no mechanism to trace specific claims to their evidence sources. The user must open the evidence panel and manually scan the evidence chain to find support for a particular reasoning statement."),
  comparisonTable([
    ["Clicks to trace claim to evidence", "2 (open panel + read chain)", "1 (click any reasoning point)"],
    ["Reasoning presentation consistency", "3 different formats across components", "Single standardized component"],
    ["Evidence-reasoning linkage", "None", "Inline clickable anchors"],
    ["Reasoning quality indicator", "None", "Confidence tier badge per item"],
    ["Cognitive load for verification", "Medium (evidence hidden)", "Low (evidence one click away)"],
    ["Type safety for factors", "any (unsafe)", "Structured ReasoningItem type"],
  ]),
  spacer(80),
  body("The target experience makes reasoning and evidence a continuous flow rather than separate sections. Each reasoning statement becomes a clickable anchor that reveals its supporting evidence in an inline popover, eliminating the need to navigate to a separate panel for basic verification."),

  h2("3.3 Design Intent"),
  body("The InlineReasoning component exists to eliminate the gap between 'what the system thinks' and 'why it thinks that.' This gap is the single largest barrier to trust in AI-driven intelligence systems. Users who cannot verify the system's reasoning will either blindly trust it (dangerous) or ignore it (wasteful). The InlineReasoning component enables a middle path: calibrated trust based on evidence inspection."),
  body("The component solves the user problem of unverifiable claims. Every reasoning statement the system produces should be traceable to specific evidence. This is not just a UI convenience; it is a trust architecture decision. By making evidence accessible at the point of claim, the system demonstrates intellectual honesty and invites scrutiny rather than demanding faith."),
  body("The emotional target is intellectual confidence. After interacting with the InlineReasoning component, the user should feel 'I can verify every claim the system makes.' This feeling is distinct from simply trusting the system; it is the confidence that comes from having the ability to check, even if the user chooses not to exercise that ability on every occasion."),
  body("The intelligence improvement expectation is a measurable increase in user trust scores (tracked via future validation mechanisms) and a reduction in the average time spent verifying intelligence claims. By collapsing the evidence access path from two clicks to one, the component removes a significant friction point in the trust-building process."),

  h2("3.4 Technical Implementation Plan"),
  body("The component will be extracted to src/components/intelligence-os/inline-reasoning.tsx with the props interface: { reasoning: string; reasoningItems?: ReasoningItem[]; evidenceMap?: Map<string, EvidenceItem[]>; confidenceTier: 'high' | 'medium' | 'low'; compact?: boolean; }."),
  body("The core TypeScript type for structured reasoning is: ReasoningItem = { id: string; claim: string; evidenceIds: string[]; weight: 'primary' | 'supporting' | 'contextual'; }. This type replaces the current unstructured narrative.confidence.factors (typed as any) with a strongly-typed, linked structure where each claim explicitly references the evidence items that support it."),
  body("The component supports two layout modes. Compact mode (used in HeroNarrative L2) renders a single italic paragraph with clickable highlighted phrases. Full mode (used in IntelligenceQueue items and IntelligencePanel) renders numbered reasoning items with weight indicators. Each item displays the claim text as a clickable element, a weight badge (Primary, Supporting, or Contextual), and an evidence count indicator showing how many evidence items support the claim."),
  body("The evidenceMap prop is a Map<string, EvidenceItem[]> that links claim IDs to their supporting evidence items. When a user clicks a reasoning claim, an inline popover appears showing the linked evidence items with their source, snippet, date, and relevance score. This popover slides down from the claim with a spring animation and does not require navigation to a separate panel."),
  body("The connection to the existing EvidenceChain component is maintained through the evidenceMap. The EvidenceChain component (L3) receives the same evidence data but presents it as a comprehensive chain rather than per-claim popovers. This means the data model is unified while the presentation adapts to the disclosure level. The InlineReasoning component at L2 provides quick verification; the EvidenceChain at L3 provides comprehensive audit."),
  body("Animation uses staggered fade-in for claims at 0.1 seconds each. The evidence popover uses a spring animation that slides down from the clicked claim. Design tokens include tokens.domain.reasoning (hex #f59e0b) for the reasoning accent color and tokens.confidence[tier] for the quality indicator styling. The confidenceTier prop drives a visual quality indicator: high-confidence reasoning shows a solid green dot, medium shows amber, and low shows a hollow gray circle, giving users an instant visual assessment of reasoning reliability."),

  spacer(200),

  // ──────────────────────────────────────────────────────────
  // COMPONENT 4: ACTION QUEUE
  // ──────────────────────────────────────────────────────────
  h1("4. ActionQueue: What Should I Do Today?"),

  h2("4.1 Current State Analysis"),
  body("The ActionQueue currently exists at lines 854 through 906 of command-center.tsx as a flat list of action items. The actions are not fetched independently but are extracted client-side from the rankedNarratives array via a useMemo hook. This hook iterates through ranked narratives, extracts the primaryAction and the first secondaryAction from each, and creates ActionItem objects with title, priority, company name, and confidence data."),
  body("Each action item in the current implementation displays a title, a priority badge color, the associated company name, a confidence percentage, and a small ConfidenceIndicator bar. Clicking an action item navigates to the company workspace page. This is the only available interaction; there is no inline execution, no completion tracking, and no estimated impact display."),
  body("The problems with the current implementation are significant. First, actions are derived client-side from narrative data rather than being a first-class intelligence output. This means there is no dedicated action intelligence that considers factors like time sensitivity, estimated impact, or action clustering. Second, there is no time urgency differentiation; an action that should be taken immediately looks identical to one that can wait a week. Third, there is no action clustering by company, so if three actions relate to the same company, they appear as three unrelated items. Fourth, there is no action completion tracking, meaning completed actions remain visible and indistinguishable from pending ones. Fifth, the estimated impact of each action is not communicated, so the user cannot prioritize based on expected value. Sixth, navigation is the only action mode; there is no way to execute, delegate, or dismiss an action inline."),
  body("The section title 'Recommended Actions' is generic and does not communicate urgency or time relevance. The flat list format with no visual grouping means the user sees a homogeneous set of items and must individually assess each one to determine what to do and when."),

  h2("4.2 User Journey Impact"),
  body("The VP Sales opens the Command Center wanting to know 'What should I do RIGHT NOW?' The current experience shows a flat list of approximately five actions with company name and confidence but no indication of time sensitivity or expected outcome. The user must read each item, mentally assess urgency, and then navigate to the company workspace to take any actual action."),
  comparisonTable([
    ["Clicks to take an action", "2 (click item, then navigate)", "1 (inline execution or context-navigate)"],
    ["Time urgency visibility", "None (all items equal)", "UrgencyDot: now / today / this week"],
    ["Estimated impact visibility", "None", "Impact statement per action"],
    ["Action completion tracking", "None", "Checkmark + slide-out + toast"],
    ["Cognitive load", "Medium-high (no differentiation)", "Low (top action obvious)"],
    ["Grouping", "Flat list", "By urgency tier with dividers"],
  ]),
  spacer(80),
  body("The target experience groups actions by urgency tier ('Do Now', 'Today', 'This Week') with clear visual dividers. The top action in the 'Do Now' group is immediately obvious as the single most important action. Each action communicates its expected impact in plain language, enabling value-based prioritization."),

  h2("4.3 Design Intent"),
  body("The ActionQueue exists to transform intelligence into execution. An intelligence system that identifies problems but does not recommend actions is only half complete. This component bridges the gap between insight and operation by presenting ranked, time-sensitive, impact-qualified actions that the user can execute directly from the Command Center."),
  body("The component solves the user problem of 'analysis paralysis.' When a user sees five intelligence insights, the natural next question is 'So what do I do?' Without the ActionQueue, this question goes unanswered, and the user must independently translate each insight into an action plan. The ActionQueue performs this translation automatically, presenting pre-computed actions that are directly tied to their source intelligence."),
  body("The emotional target is forward momentum. The user should feel 'I am not just analyzing, I am acting.' This is a fundamentally different emotional state from the passive observation that characterizes most dashboard interactions. By making the top action immediately visible and one-click executable, the component creates a bias toward action that transforms the Command Center from a monitoring tool into a decision execution platform."),
  body("The intelligence improvement expectation is an increase in action completion rates. Currently, the system identifies intelligence but has no mechanism to track whether users act on it. The ActionQueue introduces completion tracking that will, for the first time, provide data on the conversion rate from intelligence detection to user action, enabling future optimization of both the intelligence pipeline and the action recommendation algorithm."),

  h2("4.4 Technical Implementation Plan"),
  body("The component will be extracted to src/components/intelligence-os/action-queue.tsx with the props interface: { actions: ActionQueueItem[]; onExecute: (action: ActionQueueItem) => void; onDismiss: (id: string) => void; onDelegate?: (action: ActionQueueItem, email: string) => void; }."),
  body("The core TypeScript type is: ActionQueueItem = { id: string; title: string; description: string; company: string; companyId: string; priority: 'critical' | 'high' | 'medium' | 'low'; confidence: number; urgency: 'now' | 'today' | 'this_week'; estimatedImpact: string; reasoning: string; sourceNarrativeId: string; }. The urgency field is new and will be computed by the intelligence service based on signal recency, confidence trajectory, and business context."),
  body("The layout uses a single-column card list. Each card contains three horizontal zones. The left zone holds the rank number and an UrgencyDot: a small colored circle that is red for 'now', yellow for 'today', and green for 'this week'. The center zone contains the action title in bold, the company name in muted text, and an impact statement in small text. The right zone holds the ActionCTA button and a ConfidenceIndicator displayed as a badge rather than a bar for space efficiency."),
  body("Actions are grouped by urgency tier with section dividers labeled 'Do Now', 'Today', and 'This Week'. Within each group, actions are sorted by a composite score of priority weight, confidence, and estimated impact magnitude. This grouping replaces the current flat list with a clear triage structure."),
  body("Inline execution works through the onExecute callback. When the user clicks the ActionCTA, the callback receives the full ActionQueueItem, enabling the parent component to navigate with full context (companyId, actionType, source narrative) or to trigger an inline action execution if the action type supports it (e.g., sending a pre-drafted email). The completion interaction uses a checkmark icon; clicking it triggers a slide-out animation and a 'Completed' toast notification."),
  body("The empty state displays 'No actions pending \u2014 intelligence pipeline is monitoring' to communicate that the system is active even when there are no current actions. Animation uses staggered slide-in from the bottom at 0.08 seconds per item. Design tokens include tokens.domain.action (hex #10b981) for the action accent color and tokens.priority[priority] for urgency-based styling."),

  spacer(200),

  // ──────────────────────────────────────────────────────────
  // COMPONENT 5: ACCOUNT DELTA TRACKER
  // ──────────────────────────────────────────────────────────
  h1("5. AccountDeltaTracker: What Changed Since Last Session?"),

  h2("5.1 Current State Analysis"),
  body("The AccountDeltaTracker does not exist in the current codebase. This is a net-new component with no prior implementation to refactor or extend. Currently, there is zero delta or change tracking in the Command Center. The command-center-screen.tsx file (the 856-line legacy dashboard) also contains no delta tracking capability. Intelligence narratives are fetched fresh on each page load via the useIntelligenceNarratives hook, but there is no comparison mechanism between the current fetch and any previous state."),
  body("The old dashboard screen includes a POLL_INTERVAL constant set to 30,000 milliseconds (30 seconds) and re-fetches data at this interval. However, the re-fetched data simply replaces the previous state in React's local state variable. There is no diff computation, no change detection, and no mechanism to surface what has changed between polls or between sessions."),
  body("The absence of delta tracking creates a set of gaps rather than bugs. There is no way to answer 'What changed since I last looked?' There is no detection mechanism for new signals, confidence score changes, priority shifts, or new evidence. There is no session-to-session comparison capability. There are no 'new since yesterday' indicators on any component. The user must rely on their own memory to detect changes, which is unreliable and cognitively expensive."),
  body("This is arguably the most impactful gap in the current system because it undermines the value of repeated use. An intelligence system that shows the same information every time the user opens it provides diminishing returns. The AccountDeltaTracker is the component that makes the system valuable on the second, third, and hundredth use by ensuring the user immediately sees what is new or changed."),

  h2("5.2 User Journey Impact"),
  body("The VP Sales opens the Command Center in the morning and wants to know what has changed overnight. The current experience shows the current state of all accounts and signals but provides no indication of what is different from yesterday. The user must mentally compare the current display against their memory of the previous session, which is unreliable for more than two or three accounts."),
  comparisonTable([
    ["Clicks to detect changes", "Infinite (manual mental scan)", "0 (changes immediately visible)"],
    ["Change detection mechanism", "User memory", "Automated delta computation"],
    ["Session persistence", "None (state lost on unmount)", "localStorage with timestamp"],
    ["Delta types detected", "None", "5 types (new, shift, escalation, de-escalation, evidence)"],
    ["Cognitive load", "Very high (remember previous state)", "Zero (system remembers for you)"],
    ["Filter by changes only", "Not possible", "Click delta badge to filter queue"],
  ]),
  spacer(80),
  body("The target experience shows a prominent delta summary at the top of the Command Center: '3 new signals, 2 confidence changes, 1 priority escalation since yesterday.' Each delta count is a clickable badge that filters the IntelligenceQueue to show only changed items, enabling the user to focus exclusively on what is different."),

  h2("5.3 Design Intent"),
  body("The AccountDeltaTracker exists to make the Command Center a memory system, not just a display system. This is a fundamental architectural distinction. A display system shows the current state; a memory system shows what has changed. For an intelligence platform used repeatedly throughout the day and across days, the memory capability is what creates sustained value."),
  body("The component solves the user problem of state tracking fatigue. Without delta tracking, every Command Center session requires a full mental comparison of current state against remembered state. This is exhausting and error-prone, especially for users managing more than five accounts. The AccountDeltaTracker eliminates this burden entirely by computing and surfacing deltas automatically."),
  body("The emotional target is relief. The user should feel 'I don't have to remember everything; the system remembers for me.' This is one of the most powerful emotional states an AI assistant can create: the feeling of being supported by a system that has continuity and context. It transforms the user's relationship with the tool from one of active monitoring to one of informed review."),
  body("The intelligence improvement expectation is difficult to quantify in advance because this is a net-new capability. However, the anticipated impact is significant: by reducing the time users spend on change detection from minutes to zero, the component should free cognitive resources for higher-value activities like decision-making and action execution. Additionally, the delta data captured by this component will be invaluable for future intelligence quality metrics, such as measuring how often detected changes lead to user actions."),

  h2("5.4 Technical Implementation Plan"),
  body("The component will be created as a new file at src/components/intelligence-os/account-delta-tracker.tsx with the props interface: { currentNarratives: IntelligenceNarrativeData[]; previousNarratives: IntelligenceNarrativeData[]; lastSessionTime?: string; onDeltaClick: (delta: DeltaItem) => void; }."),
  body("The core TypeScript type for delta items is: DeltaItem = { type: 'new_signal' | 'confidence_shift' | 'priority_escalation' | 'priority_deescalation' | 'new_evidence'; entityId: string; entityName: string; previousValue?: number; currentValue: number; narrativeId: string; description: string; timestamp: string; }. This type enumerates the five delta categories that the component detects."),
  body("Delta computation is performed via a useMemo hook that diffs currentNarratives against previousNarratives, keyed by entityId. The diffing algorithm detects five categories of change: new signals (entities present in current but not in previous), confidence shifts (absolute difference between current and previous confidence exceeds a 10-point threshold), priority escalations (priority tier increased between sessions), priority de-escalations (priority tier decreased), and new evidence (evidence count increased for an existing narrative)."),
  body("Persistence uses localStorage to store the previousNarratives array with an associated timestamp. On component mount, the previous session's data is loaded from localStorage. On component unmount or at a configurable interval, the current narratives are persisted as the new baseline. This creates a lightweight session-to-session memory without requiring any backend storage changes."),
  body("The layout is a compact horizontal strip showing delta counts as clickable badges. Each badge displays a count and a label: '+3 signals', '+2 updated', '1 escalated'. Badge colors map to delta type: new signals use tokens.domain.signal (blue), escalations use tokens.domain.risk (red), and general updates use tokens.domain.reasoning (amber). The strip uses tokens.surface.secondary as its background color to visually distinguish it from content sections."),
  body("Integration with other components is bidirectional. The HeroNarrative shows a small delta indicator when its narrative has changed (a badge reading something like 'Up confidence +15' or 'NEW' or 'ESCALATED'). The IntelligenceQueue supports filtering by delta type when the user clicks a delta badge. The onDeltaClick callback propagates the selected delta type to the parent layout, which applies the filter to the queue."),
  body("The empty state displays 'No changes since last session' in a calm, reassuring tone. Animation uses a single pulse on delta badges when they first appear (not continuous pulsing, which would be distracting). Design tokens for delta-specific colors are based on delta type, with tokens.surface.secondary for the strip background."),

  spacer(200),

  // ──────────────────────────────────────────────────────────
  // COMPONENT 6: STATUS METRICS BAR
  // ──────────────────────────────────────────────────────────
  h1("6. StatusMetricsBar: Collapsible System Health and KPIs"),

  h2("6.1 Current State Analysis"),
  body("The StatusMetricsBar currently exists as a private function component at lines 378 through 453 of command-center.tsx. It displays an AI status dot (green for healthy, amber for degraded), an inline KPI summary string in the format 'X accounts, Y signals, Z% confidence, W actions', and an expandable section that reveals a two-by-two grid containing four KPI cards: Accounts, Signals, Average Confidence, and Pending Actions. The expand and collapse animation uses AnimatePresence from Framer Motion."),
  body("The problems with the current implementation are primarily about position, completeness, and interactivity. First, despite being named 'StatusMetricsBar', the component is positioned at line 910 of the render output, placing it after all intelligence sections including the HeroNarrative, IntelligenceQueue, and ActionQueue. This means the user sees all intelligence content before seeing system health, which is the correct relative priority but means the bar is often below the fold. Second, system health information (AI engine status, individual engine statuses) is accessible but not prominent enough for a quick health check. Third, the KPIs are static numbers with no trend indicators; the user cannot tell whether signal count is increasing or decreasing over time. Fourth, the intelligence pipeline status (processing, last updated, next refresh) is not displayed at all. Fifth, the expand/collapse interaction is the only available interaction; there is no drill-down from any KPI to its underlying data. Sixth, the component is missing several important metrics: signal velocity (signals per hour), coverage (percentage of accounts with active signals), and action completion rate."),
  body("The component's fundamental issue is that it tries to serve two distinct use cases with a single collapsed/expanded state. The 'quick health check' use case requires always-visible, at-a-glance information. The 'detailed metrics review' use case requires comprehensive data with trends. The current implementation collapses both into a single toggle, meaning the user must expand the bar even for basic health information."),

  h2("6.2 User Journey Impact"),
  body("The VP Sales wants a quick system health check before diving into intelligence content. The current experience shows a collapsed bar at the bottom of the page with a green dot and a summary text string. The user must click to expand for any detail beyond the four-number summary. On smaller viewports, the bar may be below the fold entirely."),
  comparisonTable([
    ["Clicks for basic health info", "1 (expand bar)", "0 (always visible in strip)"],
    ["Clicks for detailed KPIs", "1 (expand)", "1 (expand, same as current)"],
    ["Trend indicators", "None (static numbers)", "Arrows + percentage change"],
    ["Pipeline status visibility", "None", "Processing dot + last updated time"],
    ["Signal velocity metric", "Missing", "Signals/hour in expanded view"],
    ["Cognitive load (basic)", "Low (collapsed)", "Low (always visible)"],
  ]),
  spacer(80),
  body("The target experience positions the StatusMetricsBar directly below the HeroNarrative (layout position 2) so that system health context is always visible without scrolling. The always-visible strip shows the AI status dot, monitored account count, active signal count, and a 'last updated' timestamp with trend arrows for signal velocity. Detailed KPIs remain behind the expand interaction, which is an acceptable click cost for secondary information."),

  h2("6.3 Design Intent"),
  body("The StatusMetricsBar exists to ensure the user always has system context without that context competing with intelligence content. This is a deliberate architectural decision: KPIs and system health are important but NOT primary. Intelligence is primary. The bar's role is to provide ambient awareness of system state, not to draw attention away from the intelligence narrative."),
  body("The component solves the user problem of operational uncertainty. Without system health visibility, users may wonder 'Is the system working?', 'Is this data fresh?', or 'Are there more signals than yesterday?' These questions create background anxiety that reduces focus on the intelligence content. The StatusMetricsBar answers these questions preemptively, creating a foundation of operational confidence that supports deeper engagement with intelligence."),
  body("The emotional target is quiet confidence. The user should feel 'The system is healthy and working for me.' This is distinctly different from the emotional targets of the intelligence components (reassurance, calm, confidence, momentum, relief). The StatusMetricsBar is intentionally understated; its goal is to be noticed when something is wrong (red dot, stale data) and to fade into the background when everything is normal."),
  body("The intelligence improvement expectation is not about the metrics themselves but about their presentation. By making basic health information always visible and adding trend indicators, the component should reduce the frequency of unnecessary 'is the system working?' checks and enable users to quickly identify data freshness issues that might affect their trust in the intelligence content."),

  h2("6.4 Technical Implementation Plan"),
  body("The component will be extracted to src/components/intelligence-os/status-metrics-bar.tsx with the props interface: { kpis: KPIMetrics | null; systemHealth: SystemHealthData | null; intelligencePipeline: PipelineStatus | null; }."),
  body("The core TypeScript types are: KPIMetrics = { totalAccounts: number; activeSignals: number; avgConfidence: number; pendingActions: number; signalVelocity: number; coverage: number; actionCompletionRate: number; } and PipelineStatus = { status: 'idle' | 'processing' | 'error'; lastUpdated: string; nextRefresh: string; narrativesGenerated: number; }. These types extend the current informal metric structure with explicitly typed fields for the new metrics."),
  body("The layout repositioning is the most impactful architectural change. The component moves from its current position at the bottom of the page (after all intelligence sections) to position 2 in the layout, directly below the HeroNarrative. This ensures the user sees intelligence first, then immediately has system health context, before encountering the detailed queue and action sections."),
  body("The always-visible strip contains four elements in a single horizontal row: the AI status dot (with pulse animation when the pipeline is processing), the text 'X accounts monitored', the text 'Y signals active', the text 'Updated 2m ago', and trend arrows for signal velocity. The trend arrows use Unicode characters (up arrow, down arrow, right arrow) with percentage change values, colored green for positive trends and red for negative trends."),
  body("The expanded view uses a three-by-three grid (up from the current two-by-two) to accommodate all seven metrics plus trend indicators. Each metric cell shows the metric name, the current value, and a small trend indicator (either a sparkline for historical data or an arrow with percentage change for simpler representation). The trend data is computed by comparing current KPI values against KPI values stored from 24 hours prior, persisted in localStorage using the same pattern as the AccountDeltaTracker."),
  body("Real-time monitoring uses a pulse dot animation when the intelligencePipeline status is 'processing'. This provides subtle but noticeable feedback that the system is actively working. The error state shows a red dot with the text 'Intelligence pipeline error' and a retry button that re-triggers the intelligence fetch cycle. The expand/collapse animation retains the existing AnimatePresence implementation, which is already well-tuned. Design tokens include tokens.surface.secondary for the strip background, tokens.text.secondary for label text, tokens.domain.signal for signal metric highlights, and tokens.confidence.high for the AI status indicator."),
];

// ═══════════════════════════════════════════════════════════
// ASSEMBLE DOCUMENT
// ═══════════════════════════════════════════════════════════
const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: { ascii: FONT_BODY }, size: 22, color: c(bodyPalette.body) },
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
          spacing: { before: 480, after: 360, line: 312 },
          children: [new TextRun({ text: "Table of Contents", bold: true, size: 32,
            font: { ascii: FONT_HEADING }, color: c(bodyPalette.primary) })],
        }),
        new TableOfContents("Table of Contents", {
          hyperlink: true,
          headingStyleRange: "1-2",
        }),
        new Paragraph({
          spacing: { before: 200, line: 312 },
          children: [new TextRun({ text: "Note: This Table of Contents is generated via field codes. To ensure page number accuracy after editing, please right-click the TOC and select \"Update Field.\"", italics: true, size: 18, color: "888888", font: { ascii: FONT_BODY } })],
        }),
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

// ═══════════════════════════════════════════════════════════
// GENERATE
// ═══════════════════════════════════════════════════════════
const OUTPUT = "/home/z/my-project/download/DeepMindQ-Phase1B-Component-Design-Decisions.docx";
Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(OUTPUT, buf);
  console.log("Generated:", OUTPUT);
});
