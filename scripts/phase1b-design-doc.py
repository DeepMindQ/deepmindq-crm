#!/usr/bin/env python3
"""
DeepMindQ Phase 1B Design Document — Command Center as Executive Intelligence Experience
Generated via ReportLab with cascade palette and Template 01 cover.
"""

import os
import sys
import hashlib
import platform

# ─── PDF Skill Path ─────────────────────────────────────────────────
PDF_SKILL_DIR = '/home/z/my-project/skills/pdf'
_scripts = os.path.join(PDF_SKILL_DIR, 'scripts')
if _scripts not in sys.path:
    sys.path.insert(0, _scripts)

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch, mm, cm
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY, TA_RIGHT
from reportlab.platypus import (
    Paragraph, Spacer, PageBreak, Table, TableStyle,
    KeepTogether, HRFlowable, Image, Flowable,
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.platypus import SimpleDocTemplate
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily
from reportlab.graphics.shapes import Drawing, Line, Rect, String
from reportlab.graphics import renderPDF

# Install font fallback for mixed-language text
try:
    from pdf import install_font_fallback
    install_font_fallback()
except ImportError:
    pass

# ─── Font Registration ──────────────────────────────────────────────
_IS_MAC = platform.system() == 'Darwin'
FONT_DIR = os.path.expanduser('~/.openclaw/workspace/fonts') if _IS_MAC else '/usr/share/fonts'

pdfmetrics.registerFont(TTFont('FreeSerif', f'{FONT_DIR}/truetype/freefont/FreeSerif.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-Bold', f'{FONT_DIR}/truetype/freefont/FreeSerifBold.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-Italic', f'{FONT_DIR}/truetype/freefont/FreeSerifItalic.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-BoldItalic', f'{FONT_DIR}/truetype/freefont/FreeSerifBoldItalic.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans', f'{FONT_DIR}/truetype/dejavu/DejaVuSansMono.ttf'))

registerFontFamily('FreeSerif', normal='FreeSerif', bold='FreeSerif-Bold',
                    italic='FreeSerif-Italic', boldItalic='FreeSerif-BoldItalic')
registerFontFamily('DejaVuSans', normal='DejaVuSans', bold='DejaVuSans')

# ━━ Cascade Palette ━━
PAGE_BG       = colors.HexColor('#f4f3f2')
SECTION_BG    = colors.HexColor('#eaeae9')
CARD_BG       = colors.HexColor('#e8e7e3')
TABLE_STRIPE  = colors.HexColor('#f4f3f2')
HEADER_FILL   = colors.HexColor('#524b36')
COVER_BLOCK   = colors.HexColor('#7d724f')
BORDER        = colors.HexColor('#d5d1c4')
ICON          = colors.HexColor('#927c39')
ACCENT        = colors.HexColor('#94761e')
ACCENT_2      = colors.HexColor('#5b3fb1')
TEXT_PRIMARY   = colors.HexColor('#171715')
TEXT_MUTED     = colors.HexColor('#7c7a73')
SEM_SUCCESS   = colors.HexColor('#447a56')
SEM_WARNING   = colors.HexColor('#8c7649')
SEM_ERROR     = colors.HexColor('#a05b55')
SEM_INFO      = colors.HexColor('#4d749c')

# ─── Page Setup ─────────────────────────────────────────────────────
PAGE_W, PAGE_H = A4
MARGIN = 1.0 * inch
CONTENT_W = PAGE_W - 2 * MARGIN

OUTPUT_PATH = '/home/z/my-project/download/DeepMindQ_Phase1B_Design_Document.pdf'

# ─── Styles ──────────────────────────────────────────────────────────
styles = getSampleStyleSheet()

h1_style = ParagraphStyle(
    name='H1', fontName='FreeSerif-Bold', fontSize=22, leading=28,
    textColor=HEADER_FILL, spaceBefore=24, spaceAfter=12, alignment=TA_LEFT,
)

h2_style = ParagraphStyle(
    name='H2', fontName='FreeSerif-Bold', fontSize=15, leading=20,
    textColor=ACCENT, spaceBefore=18, spaceAfter=8, alignment=TA_LEFT,
)

h3_style = ParagraphStyle(
    name='H3', fontName='FreeSerif-Bold', fontSize=12, leading=16,
    textColor=TEXT_PRIMARY, spaceBefore=12, spaceAfter=6, alignment=TA_LEFT,
)

body_style = ParagraphStyle(
    name='Body', fontName='FreeSerif', fontSize=10.5, leading=17,
    textColor=TEXT_PRIMARY, spaceBefore=4, spaceAfter=8,
    alignment=TA_JUSTIFY, firstLineIndent=0,
)

body_indent = ParagraphStyle(
    name='BodyIndent', fontName='FreeSerif', fontSize=10.5, leading=17,
    textColor=TEXT_PRIMARY, spaceBefore=4, spaceAfter=8,
    alignment=TA_JUSTIFY, leftIndent=18,
)

bullet_style = ParagraphStyle(
    name='Bullet', fontName='FreeSerif', fontSize=10.5, leading=17,
    textColor=TEXT_PRIMARY, spaceBefore=2, spaceAfter=4,
    alignment=TA_LEFT, leftIndent=24, bulletIndent=12,
    bulletFontName='FreeSerif', bulletFontSize=10.5,
)

caption_style = ParagraphStyle(
    name='Caption', fontName='FreeSerif-Italic', fontSize=9, leading=13,
    textColor=TEXT_MUTED, spaceBefore=4, spaceAfter=12,
    alignment=TA_LEFT,
)

callout_style = ParagraphStyle(
    name='Callout', fontName='FreeSerif', fontSize=10.5, leading=16,
    textColor=TEXT_PRIMARY, spaceBefore=8, spaceAfter=8,
    alignment=TA_LEFT, leftIndent=18, rightIndent=18,
    backColor=CARD_BG, borderPadding=8,
    borderColor=ACCENT, borderWidth=1, borderRadius=4,
)

code_style = ParagraphStyle(
    name='Code', fontName='DejaVuSans', fontSize=8.5, leading=13,
    textColor=TEXT_PRIMARY, spaceBefore=6, spaceAfter=10,
    alignment=TA_LEFT, leftIndent=18, rightIndent=18,
    backColor=colors.HexColor('#f8f7f5'), borderPadding=8,
    borderColor=BORDER, borderWidth=0.5,
)

# ─── TOC Styles ─────────────────────────────────────────────────────
toc_h1_style = ParagraphStyle(
    name='TOCH1', fontName='FreeSerif-Bold', fontSize=12, leading=20,
    leftIndent=0, textColor=TEXT_PRIMARY,
)
toc_h2_style = ParagraphStyle(
    name='TOCH2', fontName='FreeSerif', fontSize=10.5, leading=18,
    leftIndent=20, textColor=TEXT_MUTED,
)

# ─── TOC Document Template ──────────────────────────────────────────
class TocDocTemplate(SimpleDocTemplate):
    def afterFlowable(self, flowable):
        if hasattr(flowable, 'bookmark_name'):
            level = getattr(flowable, 'bookmark_level', 0)
            text = getattr(flowable, 'bookmark_text', '')
            key = getattr(flowable, 'bookmark_key', '')
            self.notify('TOCEntry', (level, text, self.page, key))

def add_heading(text, style, level=0):
    key = f'h_{hashlib.md5(text.encode()).hexdigest()[:8]}'
    p = Paragraph(f'<a name="{key}"/>{text}', style)
    p.bookmark_name = key
    p.bookmark_level = level
    p.bookmark_text = text
    p.bookmark_key = key
    return p

# ─── Helper: Callout Box ────────────────────────────────────────────
def callout_box(text):
    return Paragraph(text, callout_style)

def bullet(text):
    return Paragraph(f'<bullet>&bull;</bullet> {text}', bullet_style)

def spacer(h=12):
    return Spacer(1, h)

def thin_rule():
    return HRFlowable(width='100%', thickness=0.5, color=BORDER, spaceBefore=8, spaceAfter=8)

def section_rule():
    return HRFlowable(width='100%', thickness=1.5, color=ACCENT, spaceBefore=12, spaceAfter=6)

# ─── Helper: Table ──────────────────────────────────────────────────
def styled_table(headers, rows, col_widths=None):
    """Create a styled table with cascade palette colors."""
    header_row = [Paragraph(f'<b>{h}</b>', ParagraphStyle(
        name='TH', fontName='FreeSerif-Bold', fontSize=9.5, leading=13,
        textColor=colors.white, alignment=TA_CENTER,
    )) for h in headers]

    body_rows = []
    for row in rows:
        styled_row = [Paragraph(str(cell), ParagraphStyle(
            name='TD', fontName='FreeSerif', fontSize=9.5, leading=14,
            textColor=TEXT_PRIMARY, alignment=TA_LEFT,
        )) for cell in row]
        body_rows.append(styled_row)

    all_data = [header_row] + body_rows

    if col_widths is None:
        col_widths = [CONTENT_W / len(headers)] * len(headers)

    t = Table(all_data, colWidths=col_widths, repeatRows=1)

    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), HEADER_FILL),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'FreeSerif-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9.5),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('TOPPADDING', (0, 0), (-1, 0), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 1), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
    ]
    # Stripe odd rows
    for i in range(1, len(all_data)):
        if i % 2 == 0:
            style_cmds.append(('BACKGROUND', (0, i), (-1, i), TABLE_STRIPE))

    t.setStyle(TableStyle(style_cmds))
    return t

# ─── Build Story ────────────────────────────────────────────────────
story = []

# =====================================================================
# COVER (will be rendered as HTML via Playwright and merged)
# =====================================================================

# =====================================================================
# TABLE OF CONTENTS
# =====================================================================
story.append(Paragraph('Table of Contents', ParagraphStyle(
    name='TOCTitle', fontName='FreeSerif-Bold', fontSize=20, leading=26,
    textColor=HEADER_FILL, spaceBefore=20, spaceAfter=20, alignment=TA_LEFT,
)))

toc = TableOfContents()
toc.levelStyles = [toc_h1_style, toc_h2_style]
story.append(toc)
story.append(PageBreak())

# =====================================================================
# CHAPTER 1: EXECUTIVE SUMMARY
# =====================================================================
story.append(add_heading('Chapter 1: Executive Summary', h1_style, 0))
story.append(spacer(4))

story.append(Paragraph(
    'Phase 1A of the DeepMindQ Product Experience Transformation established the intelligence '
    'design system foundation, created the core intelligence OS component library, connected the '
    'Command Center to the real intelligence pipeline, and proved that the product can deliver '
    'intelligence-driven experiences rather than static dashboard views. The transformation was '
    'verified through five technical corrections, each addressing a critical gap between visual '
    'representation and real engine connectivity.', body_style))

story.append(Paragraph(
    'The fundamental architectural shift achieved in Phase 1A moved DeepMindQ from a paradigm '
    'of "Data, Dashboard, User interpretation" to "Intelligence, Reasoning, Evidence, Confidence, '
    'Recommendation, Human action." This is not merely a visual redesign; it represents a '
    'structural reorientation of how the product communicates value to its users. Every '
    'intelligence narrative now carries real confidence scores computed from multi-factor formulas, '
    'traceable evidence chains sourced from actual signals and documents, and actionable '
    'recommendations generated by the AI action engine.', body_style))

story.append(Paragraph(
    'Phase 1B now takes this foundation and elevates it to the executive experience level. While '
    'Phase 1A proved the intelligence pipeline works within the Command Center component, '
    'Phase 1B must prove that a VP Sales or CRO can open DeepMindQ and, within five minutes, '
    'understand what needs attention, why it matters, what evidence supports the assessment, and '
    'what action to take. This is the standard against which the product will be evaluated, and '
    'it requires a fundamentally different approach to information architecture, visual hierarchy, '
    'and contextual intelligence delivery.', body_style))

story.append(add_heading('1.1 Phase 1A Achievements at a Glance', h2_style, 1))

achievements_data = [
    ['IntelligenceNarrative', 'Connected to real engine outputs via NarrativeService'],
    ['ConfidenceIndicator', 'Real 4-factor calculation (Signal 30%, Evidence 30%, Capability 25%, Data 15%)'],
    ['EvidenceChain', 'Traceable evidence from GroundingEngine with source citations'],
    ['ActionCTA', 'Recommendation-driven actions from ActionEngine'],
    ['Command Center', 'Consumes full intelligence pipeline via useIntelligenceNarratives hook'],
    ['Test Coverage', '40+ new tests (confidence formula, API shape, VP Sales 5-question validation)'],
    ['Components Delivered', '10 intelligence OS components with unified design tokens'],
    ['Services Connected', '6 engines (Grounding, Synthesis, Scoring, Action, Retrieval, Model Router)'],
]

story.append(styled_table(
    ['Component/Service', 'Phase 1A Achievement'],
    achievements_data,
    col_widths=[CONTENT_W * 0.3, CONTENT_W * 0.7],
))

story.append(spacer(8))
story.append(callout_box(
    '<b>Phase 1B Mandate:</b> Phase 1A proved the intelligence foundation. '
    'Phase 1B must now prove the experience at executive level. '
    'A VP Sales/CRO opens DeepMindQ and within 5 minutes understands: '
    'What needs attention today? Which accounts have movement? '
    'Why does AI believe this? What action should happen next? '
    'How does DeepMindQ continuously learn?'
))

# =====================================================================
# CHAPTER 2: CURRENT STATE AFTER PHASE 1A
# =====================================================================
story.append(add_heading('Chapter 2: Current State After Phase 1A', h1_style, 0))
story.append(spacer(4))

story.append(add_heading('2.1 Command Center Architecture', h2_style, 1))

story.append(Paragraph(
    'The Command Center, implemented in <font name="DejaVuSans">src/components/intelligence-os/command-center.tsx</font>, '
    'is the primary intelligence consumption surface in DeepMindQ. Following Phase 1A, it '
    'integrates with the real intelligence pipeline through the '
    '<font name="DejaVuSans">useIntelligenceNarratives</font> hook, which fetches narrative data '
    'from the <font name="DejaVuSans">/api/intelligence/narratives</font> API endpoint. This API, '
    'in turn, invokes the IntelligenceNarrativeService, which orchestrates the full engine pipeline: '
    'Signal extraction, GroundingEngine evidence collection, multi-factor confidence computation, '
    'and ActionEngine recommendation generation.', body_style))

story.append(Paragraph(
    'The current Command Center renders intelligence narratives through the IntelligenceNarrative '
    'component with progressive disclosure layers (L1 Decision, L2 Reasoning, L3 Evidence, L4 '
    'Explore). Each narrative displays a confidence ring computed from four weighted factors, an '
    'evidence chain with source citations and relevance scores, and action recommendations with '
    'priority levels. The aggregated intelligence health bar provides a system-wide confidence '
    'overview. The "Refresh Intelligence" button triggers a manual pipeline refetch, and loading '
    'and error states are handled with appropriate visual indicators.', body_style))

story.append(add_heading('2.2 Intelligence Pipeline Integration Map', h2_style, 1))

story.append(Paragraph(
    'The following table documents the complete data flow from intelligence engines to the '
    'Command Center UI surface. Each layer in this pipeline has been verified to carry real data '
    '(not static templates) following the Phase 1A correction cycle.', body_style))

pipeline_data = [
    ['Signal Extraction', 'CompanySignal, AIInsight, NewsSignal', 'Raw signals from DB, web monitors, external sources'],
    ['GroundingEngine', 'EvidenceChain, EvidenceGap[]', 'Multi-source evidence collection with gap detection'],
    ['Confidence Computation', 'NarrativeConfidence (0-100)', '4-factor formula: Signal 30% + Evidence 30% + Capability 25% + Data 15%'],
    ['SynthesisEngine', 'Brief with [En] citations', 'LLM-powered narrative generation with hallucination detection'],
    ['ActionEngine', 'ActionResult with priority', '6 action types: next_best_action, sales_motion, account_strategy, etc.'],
    ['IntelligenceNarrativeService', 'IntelligenceNarrativeData[]', 'Bridge layer composing engines into UI-ready data'],
    ['/api/intelligence/narratives', 'JSON with success/meta/data', '3 modes: command center, signal drill-down, confidence detail'],
    ['useIntelligenceNarratives', 'narratives[], isLoading, error', 'Client hook with polling, drill-down, refetch capabilities'],
    ['CommandCenter', 'Rendered intelligence narratives', 'Progressive disclosure, confidence rings, evidence chains, actions'],
]

story.append(styled_table(
    ['Layer', 'Output Type', 'Description'],
    pipeline_data,
    col_widths=[CONTENT_W * 0.22, CONTENT_W * 0.30, CONTENT_W * 0.48],
))

story.append(spacer(8))

story.append(add_heading('2.3 What Works Today', h2_style, 1))

story.append(Paragraph(
    'The Command Center successfully demonstrates the intelligence-driven paradigm when a user '
    'navigates to it. Intelligence narratives display real signals detected from monitored '
    'companies, confidence scores reflect actual evidence quality and signal strength, evidence '
    'chains trace back to specific source documents and news articles, and action recommendations '
    'are generated by the AI action engine based on grounded reasoning. The progressive disclosure '
    'pattern allows users to quickly scan L1 decision-level summaries and drill into L3 evidence '
    'and L4 exploration when they need deeper understanding.', body_style))

story.append(Paragraph(
    'The design token system provides a unified visual language across all 10 intelligence OS '
    'components. Confidence indicators render consistently in ring, bar, badge, and score modes. '
    'The intelligence panel provides contextual intelligence for any entity (company, contact, '
    'opportunity) through a slide-over surface that composes narratives and evidence chains. '
    'The action CTA component ensures every intelligence narrative terminates with a clear, '
    'priority-weighted next step.', body_style))

story.append(add_heading('2.4 What Remains Incomplete', h2_style, 1))

story.append(Paragraph(
    'Despite the Phase 1A achievements, several critical gaps remain that prevent the Command '
    'Center from delivering the executive-level experience required for Phase 1B closure. First, '
    'the intelligence pipeline is only connected to the Command Center. The other 76+ screens in '
    'the application still rely on static data, template-driven components, or direct API calls '
    'that bypass the intelligence narrative service. This means the intelligence-first experience '
    'is isolated to a single screen rather than permeating the entire product.', body_style))

story.append(Paragraph(
    'Second, the Command Center currently displays intelligence as a flat list of narratives '
    'without temporal prioritization, account grouping, or severity-based attention routing. A VP '
    'Sales arriving in the morning sees all narratives ranked by confidence, but cannot quickly '
    'distinguish "what changed since yesterday" from "what has been true for weeks." Third, the '
    'navigation architecture still presents 77+ screens through a complex sidebar, forcing '
    'executive users to choose between "Command Center," "AI Command Center," "Revenue '
    'Intelligence," "Signal Intelligence," "Account Intelligence," and other similarly named '
    'options that create cognitive overload rather than clarity.', body_style))

remaining_data = [
    ['Pipeline Isolation', 'Intelligence pipeline connected only to Command Center; 76+ screens still static'],
    ['Temporal Blindness', 'No "what changed since yesterday" differentiation; flat narrative list'],
    ['Navigation Overload', '77+ screens with 10+ "intelligence" labeled options in sidebar'],
    ['Context Loss', 'No cross-screen context preservation; drilling into an account loses Command Center state'],
    ['Feedback Gap', 'Accept/dismiss actions not tracked; no learning loop from user decisions'],
    ['Real-Time Limitation', 'Polling-based only; no WebSocket for live intelligence updates'],
    ['Executive Framing', 'No morning briefing, no daily digest, no attention-priority routing'],
]

story.append(styled_table(
    ['Gap', 'Description'],
    remaining_data,
    col_widths=[CONTENT_W * 0.25, CONTENT_W * 0.75],
))

# =====================================================================
# CHAPTER 3: USER JOURNEY PROBLEMS REMAINING
# =====================================================================
story.append(add_heading('Chapter 3: User Journey Problems Remaining', h1_style, 0))
story.append(spacer(4))

story.append(add_heading('3.1 The 5-Minute Test Failure Points', h2_style, 1))

story.append(Paragraph(
    'The definitive evaluation criterion for Phase 1B is whether a VP Sales or CRO can open '
    'DeepMindQ and, within five minutes, answer five critical questions: What needs attention today? '
    'Which accounts have movement? Why does AI believe this? What action should happen next? '
    'How does DeepMindQ continuously learn? Currently, the product fails this test at multiple '
    'points, and understanding each failure is essential to designing the Phase 1B solution.', body_style))

story.append(Paragraph(
    '<b>Failure Point 1: No Attention Routing.</b> When the VP Sales opens DeepMindQ, the '
    'Command Center displays a list of intelligence narratives, but there is no mechanism to '
    'highlight which items are new since the last session, which items have escalated in severity, '
    'or which items are most time-sensitive. The user must scan every narrative to determine what '
    'deserves immediate attention, which defeats the purpose of an intelligence command system. '
    'A true intelligence experience should proactively surface the top 3 items that demand '
    'immediate executive attention, with a clear explanation of why each was selected.', body_style))

story.append(Paragraph(
    '<b>Failure Point 2: No Account Movement Clarity.</b> While the Command Center shows signals '
    'per company, it does not aggregate movement across the portfolio. The VP Sales cannot quickly '
    'see "3 accounts had positive movement, 1 had negative movement, and 2 are approaching '
    'decision windows." This portfolio-level view is essential for executive triage and should be '
    'the first thing visible after the attention-routed items.', body_style))

story.append(Paragraph(
    '<b>Failure Point 3: Evidence Requires Too Many Clicks.</b> To understand why AI believes '
    'something, the user must expand a narrative (L1 to L2), then expand the evidence chain (L2 '
    'to L3), then potentially click into a source link (L3 to L4). This three-click drill-down '
    'is too deep for an executive who needs to quickly validate AI confidence. The evidence should '
    'be visible at L1 or L2 for high-severity items, with progressive disclosure reserved for '
    'lower-priority intelligence.', body_style))

story.append(Paragraph(
    '<b>Failure Point 4: Actions Lack Contextual Urgency.</b> Action recommendations are displayed '
    'with priority labels (critical, high, medium, low) but without temporal context. A "critical" '
    'action from three weeks ago is not the same as a "critical" action from today. The user cannot '
    'distinguish between "act now" and "act this week" without manually checking timestamps.', body_style))

story.append(Paragraph(
    '<b>Failure Point 5: Learning Loop Is Invisible.</b> The fifth question, "How does DeepMindQ '
    'continuously learn?" is currently unanswerable from the UI. The system has learning '
    'mechanisms (feedback collection, signal recalibration, model fine-tuning) but none of this '
    'is visible to the user. The executive cannot see how their actions, accepts, dismisses, '
    'or feedback contribute to system improvement. This transparency gap undermines trust in the '
    'intelligence platform.', body_style))

story.append(add_heading('3.2 Navigation Overload Analysis', h2_style, 1))

story.append(Paragraph(
    'The current navigation architecture presents a fundamental challenge to the executive '
    'experience. The sidebar contains 77+ screen options organized into categories that overlap '
    'significantly. Multiple screens serve similar purposes with unclear differentiation: '
    '"Command Center" vs. "AI Command Center" vs. "Revenue Intelligence" vs. "Signal '
    'Intelligence" vs. "Account Intelligence" vs. "Intelligence Analytics" vs. "Intelligence '
    'Reasoning" vs. "Intelligence Health." For an executive user, this proliferation of '
    '"intelligence" screens creates confusion rather than clarity.', body_style))

nav_analysis = [
    ['Intelligence Screens', '12+', 'Command Center, AI Command Center, Revenue Intelligence, Signal Intelligence, Account Intelligence, Intelligence Analytics, Intelligence Reasoning, Intelligence Health, Intelligence Sources, Intelligence Knowledge, Internal Intelligence, Intelligence Inbox'],
    ['Company Screens', '6+', 'Companies, Company Detail, Company Mind Map, Company Profile, Account Intelligence, Account Ranking'],
    ['Sales Execution', '8+', 'Pipeline, Opportunities, Contacts, Sequences, Drafts, Replies, Sales Execution, Deal Coaching'],
    ['Operations', '8+', 'Settings, Audit, Data Health, Duplicates, Import, Analytics, Reports, Tasks'],
    ['AI Features', '10+', 'Research Agent, Conversation Studio, Conversation Planner, Email Generation, AI Strategy, AI Health, AI Usage Dashboard, AI Reasoning, Knowledge Library, Prompt Templates'],
    ['Total', '77+', 'Cognitive overload for executive users'],
]

story.append(styled_table(
    ['Category', 'Count', 'Screens'],
    nav_analysis,
    col_widths=[CONTENT_W * 0.18, CONTENT_W * 0.10, CONTENT_W * 0.72],
))

story.append(spacer(8))

story.append(add_heading('3.3 Context Loss Between Screens', h2_style, 1))

story.append(Paragraph(
    'When a user drills into an intelligence narrative on the Command Center and navigates to a '
    'company detail screen, all Command Center context is lost. The company detail screen loads '
    'its own data independently, without awareness of the intelligence narrative that led the '
    'user there. This forces the user to mentally reconstruct the context: "I came here because '
    'the AI detected a hiring signal at this company, and the evidence was from a LinkedIn post '
    'two days ago." The intelligence panel partially addresses this by providing a slide-over '
    'contextual view, but it is not automatically triggered when navigating from an intelligence '
    'narrative.', body_style))

story.append(Paragraph(
    'This context loss is particularly damaging for the executive journey because it breaks the '
    '"intelligence narrative to action" flow. The VP Sales sees an intelligence item, decides to '
    'investigate further, navigates to the company, and then must re-find the intelligence that '
    'prompted the investigation. A true intelligence command system would preserve this context '
    'seamlessly, carrying the narrative thread across screen transitions and providing breadcrumb-'
    'level traceability back to the originating intelligence.', body_style))

# =====================================================================
# CHAPTER 4: TARGET EXPERIENCE
# =====================================================================
story.append(add_heading('Chapter 4: Target Experience', h1_style, 0))
story.append(spacer(4))

story.append(add_heading('4.1 The VP Sales First-5-Minute Journey', h2_style, 1))

story.append(Paragraph(
    'The target experience for Phase 1B is defined by the VP Sales first-5-minute journey. This '
    'journey is not a linear sequence of clicks; it is a layered intelligence consumption '
    'experience where each layer answers one of the five critical questions with increasing '
    'depth. The design must ensure that a VP Sales or CRO, opening DeepMindQ for the first time '
    'each morning, can achieve full situational awareness within 300 seconds without training, '
    'without confusion, and without feeling like they are using a "dashboard."', body_style))

story.append(Paragraph(
    '<b>Seconds 0-30: Attention Routing Layer.</b> The Command Center opens with a brief, '
    'AI-generated morning intelligence summary at the top. This is not a generic greeting; it '
    'is a dynamically composed briefing that states: "3 accounts require your attention today. '
    'Acme Corp escalated to critical after a CTO departure signal. Meridian Technologies '
    'entered a buying window based on 4 new signals. DataStream Inc. has 2 actions approaching '
    'deadline." The summary uses natural language generated by the SynthesisEngine, grounded in '
    'actual signal data, and directly answers "What needs attention today?"', body_style))

story.append(Paragraph(
    '<b>Seconds 30-90: Portfolio Movement Layer.</b> Below the attention summary, a portfolio '
    'intelligence view shows account movement across the entire monitored portfolio. This view '
    'uses a visual grid or heat-map style layout where each monitored account is represented as '
    'a tile. Tiles are color-coded by movement direction (positive, negative, neutral), sized by '
    'revenue impact, and annotated with the top signal type. This answers "Which accounts have '
    'movement?" in a single visual scan without requiring the user to read individual narratives.', body_style))

story.append(Paragraph(
    '<b>Seconds 90-180: Evidence and Reasoning Layer.</b> When the VP Sales clicks on an account '
    'tile or attention item, the Intelligence Panel opens with the full narrative for that '
    'account. The evidence chain is visible at the first expansion level (not buried three clicks '
    'deep). The confidence breakdown shows the four contributing factors with human-readable '
    'explanations: "Signal strength: High (3 new signals in 48 hours). Evidence quality: Medium '
    '(2 confirmed sources, 1 unverified). Capability match: Strong (alignment score 87). Data '
    'freshness: Good (last updated 6 hours ago)." This answers "Why does AI believe this?" with '
    'transparent, auditable reasoning.', body_style))

story.append(Paragraph(
    '<b>Seconds 180-240: Action Layer.</b> Each intelligence narrative terminates with one or '
    'more action recommendations that include temporal urgency: "Schedule executive call this '
    'week (window closing in 14 days)" or "Send technical whitepaper within 48 hours (proposed '
    'by AI based on buying stage analysis)." Actions are prioritized not just by severity but '
    'by time-sensitivity, helping the VP Sales distinguish between "act now" and "act soon." '
    'This answers "What action should happen next?" with actionable, time-bound recommendations.', body_style))

story.append(Paragraph(
    '<b>Seconds 240-300: Learning Transparency Layer.</b> A subtle but persistent "Intelligence '
    'Health" indicator shows how the system is learning from user interactions. When the user '
    'accepts or dismisses an intelligence item, a brief micro-interaction confirms the feedback '
    'was recorded. A collapsible "Why did AI show me this?" panel explains the ranking rationale. '
    'This answers "How does DeepMindQ continuously learn?" by making the feedback loop visible '
    'without being intrusive. The key insight is that the learning transparency should not require '
    'a separate screen; it should be embedded in every interaction.', body_style))

story.append(add_heading('4.2 The 5 Questions, Answered in Under 5 Minutes', h2_style, 1))

questions_data = [
    ['What needs attention today?', '0-30 sec', 'Morning Intelligence Summary (AI-generated, signal-grounded)'],
    ['Which accounts have movement?', '30-90 sec', 'Portfolio Intelligence Grid (visual heat-map, color-coded movement)'],
    ['Why does AI believe this?', '90-180 sec', 'Evidence Chain at L1 expansion with 4-factor confidence breakdown'],
    ['What action should happen next?', '180-240 sec', 'Time-bound action recommendations with urgency indicators'],
    ['How does DeepMindQ learn?', '240-300 sec', 'Embedded feedback indicators on every intelligence interaction'],
]

story.append(styled_table(
    ['Question', 'Time Target', 'Phase 1B Delivery Mechanism'],
    questions_data,
    col_widths=[CONTENT_W * 0.32, CONTENT_W * 0.13, CONTENT_W * 0.55],
))

# =====================================================================
# CHAPTER 5: INFORMATION ARCHITECTURE
# =====================================================================
story.append(add_heading('Chapter 5: Information Architecture', h1_style, 0))
story.append(spacer(4))

story.append(add_heading('5.1 Primary Zones', h2_style, 1))

story.append(Paragraph(
    'The Phase 1B Command Center information architecture restructures the current flat narrative '
    'list into five hierarchical zones, each serving a distinct cognitive purpose in the executive '
    'intelligence journey. These zones are designed to be consumed in sequence (Zone 1 through '
    'Zone 5) for the first-5-minute experience, while also supporting direct access to any zone '
    'for returning users who already have context.', body_style))

zones_data = [
    ['Zone 1: Attention Routing', 'Top of Command Center', 'AI-generated morning summary of top 3 items requiring immediate attention. Uses SynthesisEngine for natural language briefing grounded in today\'s signals.', 'Seconds 0-30'],
    ['Zone 2: Portfolio Intelligence', 'Below summary', 'Visual grid of monitored accounts with movement indicators. Color-coded tiles by direction, sized by revenue impact. Answers "which accounts moved?"', 'Seconds 30-90'],
    ['Zone 3: Narrative Feed', 'Center area', 'Ranked intelligence narratives with progressive disclosure. Sorted by composite score (confidence x priority x recency). Grouped by account for related signals.', 'Seconds 90-180'],
    ['Zone 4: Action Queue', 'Right sidebar or panel', 'Prioritized, time-bound action recommendations extracted from all narratives. Shows urgency, owner (if assigned), and deadline. Persistent across screen transitions.', 'Seconds 180-240'],
    ['Zone 5: Intelligence Health', 'Bottom strip or collapsible', 'System health indicators: signal freshness, evidence coverage, model confidence trends, user feedback stats. Transparent learning loop. Always visible but non-intrusive.', 'Seconds 240-300'],
]

story.append(styled_table(
    ['Zone', 'Position', 'Description', 'Time Target'],
    zones_data,
    col_widths=[CONTENT_W * 0.16, CONTENT_W * 0.12, CONTENT_W * 0.55, CONTENT_W * 0.17],
))

story.append(spacer(8))

story.append(add_heading('5.2 Intelligence Hierarchy', h2_style, 1))

story.append(Paragraph(
    'The intelligence hierarchy defines how information is prioritized and surfaced within each '
    'zone. Rather than treating all intelligence equally, the hierarchy creates a clear priority '
    'order that reflects executive decision-making patterns. The hierarchy has four levels, each '
    'with distinct visual treatment and interaction patterns.', body_style))

hierarchy_data = [
    ['L0: Critical Alert', 'Immediate action required; revenue at risk', 'Red accent, persistent notification, auto-expands in Zone 1', 'Full narrative + evidence + action at first view'],
    ['L1: Priority Signal', 'Significant change detected; attention needed today', 'Amber accent, appears in morning summary, prominent in feed', 'Headline + confidence + top evidence + action'],
    ['L2: Watch Item', 'Emerging pattern; monitor for escalation', 'Blue accent, appears in portfolio grid, standard in feed', 'Headline + confidence; evidence on expand'],
    ['L3: Context Update', 'Informational; no immediate action required', 'Muted accent, appears in feed below fold, collapsible', 'Headline only; full narrative on explicit expand'],
]

story.append(styled_table(
    ['Level', 'Criteria', 'Visual Treatment', 'Disclosure Depth'],
    hierarchy_data,
    col_widths=[CONTENT_W * 0.14, CONTENT_W * 0.22, CONTENT_W * 0.34, CONTENT_W * 0.30],
))

story.append(spacer(8))

story.append(add_heading('5.3 Cards, Panels, and Feed Behavior', h2_style, 1))

story.append(Paragraph(
    'The card and panel system in Phase 1B must support three distinct interaction patterns: '
    'scanning (quick visual triage), reading (detailed understanding), and acting (executing a '
    'recommendation). The current IntelligenceNarrative component supports progressive disclosure '
    'but treats all narratives identically. Phase 1B introduces intelligence-level-dependent '
    'disclosure behavior.', body_style))

story.append(Paragraph(
    '<b>L0 Cards (Critical Alerts)</b> auto-expand to show full evidence and action at the first '
    'view. They cannot be dismissed without explicit acknowledgment and are visually distinct '
    'from all other intelligence through color, size, and animation. The card occupies '
    'approximately 40% more vertical space than L1 cards and includes a persistent "Action Required" '
    'badge. This ensures that critical intelligence is never accidentally overlooked during a quick '
    'scan.', body_style))

story.append(Paragraph(
    '<b>L1 Cards (Priority Signals)</b> show headline, confidence ring, top evidence source, and '
    'primary action at the default view. Evidence chain and detailed reasoning are available on '
    'click/expand. These cards form the bulk of the morning intelligence scan and should be '
    'designed for rapid reading with high information density per pixel.', body_style))

story.append(Paragraph(
    '<b>L2 and L3 Cards</b> show only headline and confidence at the default view, with full '
    'narrative available on explicit expansion. This creates a natural visual hierarchy where the '
    'VP Sales sees 3-5 L0/L1 cards prominently and 10-15 L2/L3 cards as a scannable list below.', body_style))

story.append(Paragraph(
    '<b>Panel Behavior.</b> The IntelligencePanel becomes the primary deep-dive surface. When a '
    'user clicks on any card (at any level), the panel slides in from the right with full '
    'narrative context. The panel automatically includes: the originating intelligence narrative, '
    'account context (industry, revenue band, current score), related signals (other signals for '
    'the same account), evidence chain with source links, and action recommendations with urgency '
    'indicators. The panel preserves its state when the user navigates to other screens, '
    'addressing the context loss problem identified in Chapter 3.', body_style))

story.append(add_heading('5.4 Navigation Reduction', h2_style, 1))

story.append(Paragraph(
    'The current 77+ screen navigation must be dramatically simplified for the executive '
    'experience. Phase 1B does not eliminate screens but restructures how they are accessed. '
    'The primary navigation reduction strategy has three components.', body_style))

story.append(Paragraph(
    '<b>Component 1: Unified Command Center as Default Landing.</b> The Command Center becomes '
    'the single default landing page for all users. Upon login, every user sees the Command '
    'Center first. This eliminates the need for users to choose between "Command Center," "AI '
    'Command Center," and "Dashboard" as their starting point. The Command Center\'s five zones '
    '(Attention, Portfolio, Feed, Actions, Health) replace the current multiple "home" screens.', body_style))

story.append(Paragraph(
    '<b>Component 2: Contextual Navigation from Intelligence.</b> When a user interacts with an '
    'intelligence narrative, the navigation surface changes to show only the screens relevant to '
    'that intelligence context. For example, clicking on a company intelligence narrative shows '
    'navigation options for: Company Detail, Account Intelligence, Contact Intelligence, '
    'Conversation Planner, and Email Generation. Screens unrelated to the current intelligence '
    'context are hidden, reducing cognitive load.', body_style))

story.append(Paragraph(
    '<b>Component 3: Screen Consolidation.</b> The following screen groups should be evaluated '
    'for consolidation in Phase 1B or Phase 2: "Command Center" + "AI Command Center" into a '
    'single enhanced Command Center; "Revenue Intelligence" + "Signal Intelligence" + "Account '
    'Intelligence" into a unified "Intelligence" view within the Command Center; "Companies" + '
    '"Company Detail" + "Account Intelligence" + "Account Ranking" into a unified company '
    'workspace; and "Intelligence Analytics" + "Intelligence Health" + "Intelligence Reasoning" '
    'into a consolidated "System Intelligence" panel.', body_style))

consolidation_data = [
    ['Command Center + AI Command Center', 'Enhanced Command Center', 'Single default landing with 5 zones'],
    ['Revenue Intelligence + Signal Intelligence + Account Intelligence', 'Unified Intelligence View', 'Consolidated within Command Center zones'],
    ['Companies + Company Detail + Account Intelligence + Account Ranking', 'Company Workspace', 'Single entity workspace with intelligence overlay'],
    ['Intelligence Analytics + Health + Reasoning', 'System Intelligence', 'Consolidated admin/ops panel'],
    ['Contacts + Contact Detail + Contact Intelligence', 'Contact Workspace', 'Single entity workspace with relationship context'],
]

story.append(styled_table(
    ['Current Screens', 'Proposed Consolidation', 'Rationale'],
    consolidation_data,
    col_widths=[CONTENT_W * 0.35, CONTENT_W * 0.25, CONTENT_W * 0.40],
))

story.append(spacer(8))

story.append(add_heading('5.5 Context Preservation', h2_style, 1))

story.append(Paragraph(
    'Context preservation ensures that intelligence context is maintained across screen '
    'transitions. This is one of the most critical architectural changes in Phase 1B, as it '
    'directly addresses the "context loss" failure point identified in the 5-minute test. The '
    'implementation strategy uses three complementary mechanisms.', body_style))

story.append(Paragraph(
    '<b>Mechanism 1: Intelligence Thread ID.</b> Every intelligence narrative is assigned a '
    'unique thread ID that persists across screen transitions. When a user navigates from a '
    'Command Center narrative to a company detail screen, the thread ID is passed as a URL '
    'parameter and stored in the application state. The target screen reads this thread ID and '
    'automatically opens the IntelligencePanel with the originating narrative context. This '
    'creates a seamless "intelligence narrative to entity detail" flow without context loss.', body_style))

story.append(Paragraph(
    '<b>Mechanism 2: Breadcrumb Intelligence Trail.</b> A persistent breadcrumb trail at the top '
    'of every screen shows the intelligence path that led to the current view. For example: '
    '"Command Center > Meridian Technologies > CTO Departure Signal > Evidence Chain > SEC Filing." '
    'Each breadcrumb segment is clickable, allowing the user to navigate back to any point in the '
    'intelligence exploration without losing context.', body_style))

story.append(Paragraph(
    '<b>Mechanism 3: Persistent Intelligence Panel.</b> The IntelligencePanel, once opened, '
    'remains open during screen transitions. When the user navigates from Company A to Company '
    'B, the panel smoothly transitions to show Company B\'s intelligence while preserving the '
    'exploration depth (which disclosure level was expanded). This allows rapid comparison across '
    'accounts without repeatedly opening and closing the panel.', body_style))

# =====================================================================
# CHAPTER 6: VISUAL AND EMOTIONAL DESIGN
# =====================================================================
story.append(add_heading('Chapter 6: Visual and Emotional Design', h1_style, 0))
story.append(spacer(4))

story.append(add_heading('6.1 Why This Experience Feels Fundamentally Different', h2_style, 1))

story.append(Paragraph(
    'The fundamental question that Phase 1B must answer is: "Why would this experience feel '
    'fundamentally different from Salesforce, Gong, Clari, or traditional sales dashboards?" '
    'This is not a question about feature comparison or visual polish; it is a question about '
    'cognitive model and information flow architecture. The answer lies in three structural '
    'differences that no amount of visual design can replicate.', body_style))

story.append(Paragraph(
    '<b>Difference 1: Intelligence Push, Not Data Pull.</b> Salesforce, Gong, and Clari are '
    'fundamentally data retrieval systems. The user asks a question ("show me my pipeline," '
    '"show me activity for this account") and the system returns data. DeepMindQ, after Phase 1B, '
    'must be an intelligence delivery system. The system tells the user what they need to know '
    'before they ask. The morning intelligence summary proactively surfaces critical information. '
    'The attention routing layer prioritizes items by executive impact, not data recency. The '
    'portfolio intelligence grid shows patterns the user did not explicitly search for. This shift '
    'from "user queries data" to "system delivers intelligence" is the foundational cognitive '
    'difference.', body_style))

story.append(Paragraph(
    '<b>Difference 2: Reasoning Transparency, Not Black Box.</b> Traditional AI-powered sales tools '
    'present AI insights as opaque recommendations: "AI suggests reaching out to this account." '
    'DeepMindQ makes the reasoning chain visible and auditable. The evidence chain shows exactly '
    'which signals, documents, and data points contributed to the recommendation. The confidence '
    'breakdown explains the four factors and their weights. The user can trace any intelligence '
    'item back to its source and evaluate the reasoning independently. This transparency creates '
    'trust that opaque AI recommendations cannot match.', body_style))

story.append(Paragraph(
    '<b>Difference 3: Action Termination, Not Information Display.</b> Every intelligence '
    'narrative in DeepMindQ ends with a specific, time-bound action. This is not a "suggested '
    'next step" or a "recommended action" that the user may or may not follow. It is a '
    'prioritized, urgency-rated, evidence-grounded directive that the AI has computed based on '
    'the current intelligence state. The action queue in Zone 4 aggregates all pending actions '
    'across the portfolio, creating an executable intelligence agenda. Traditional tools stop '
    'at "here is what is happening." DeepMindQ continues to "here is what you should do about it, '
    'and here is how urgent it is."', body_style))

comparison_data = [
    ['Information Flow', 'User queries data', 'System delivers intelligence', 'Push vs. Pull cognitive model'],
    ['AI Transparency', 'Opaque recommendations', 'Auditable reasoning chain', 'Evidence traceability'],
    ['Action Model', 'User decides next steps', 'AI prioritizes actions by urgency', 'Recommendation-driven workflow'],
    ['Learning Visibility', 'Hidden model updates', 'Transparent feedback loop', 'User sees how system improves'],
    ['Navigation Model', 'Feature-based menu (77 screens)', 'Context-sensitive (5 zones)', 'Cognitive load reduction'],
    ['Confidence Model', 'Score without explanation', 'Multi-factor with human-readable factors', 'Trust through transparency'],
]

story.append(styled_table(
    ['Dimension', 'Traditional Tools', 'DeepMindQ Phase 1B', 'Impact'],
    comparison_data,
    col_widths=[CONTENT_W * 0.17, CONTENT_W * 0.23, CONTENT_W * 0.32, CONTENT_W * 0.28],
))

story.append(spacer(8))

story.append(add_heading('6.2 Emotional Design Principles', h2_style, 1))

story.append(Paragraph(
    'The visual and emotional design of Phase 1B must evoke a specific feeling: "I am operating '
    'an intelligence command system, not using a software dashboard." This feeling is created '
    'through five emotional design principles that inform every visual and interaction decision.', body_style))

story.append(Paragraph(
    '<b>Principle 1: Calm Authority.</b> The interface should feel authoritative without being '
    'alarming. Critical intelligence is highlighted with purpose, not with noise. Colors are '
    'muted and intentional: red for critical, amber for priority, but these colors appear only '
    'where they matter. The overall palette remains calm (the cascade palette with warm, '
    'desaturated tones) to create a sense of controlled intelligence rather than chaotic alerts.', body_style))

story.append(Paragraph(
    '<b>Principle 2: Intelligence Advantage.</b> The experience should make the user feel like '
    'they have access to intelligence that their competitors do not. This is achieved through '
    'the evidence chain visibility, the "first to know" temporal indicators (showing when a '
    'signal was first detected relative to public knowledge), and the cross-account pattern '
    'detection that reveals insights invisible to single-account analysis tools.', body_style))

story.append(Paragraph(
    '<b>Principle 3: Progressive Depth.</b> The interface respects the user\'s time by '
    'providing exactly the right amount of information at each level. L0 critical items show '
    'everything. L3 context updates show almost nothing. The user controls the depth of '
    'exploration, and the system never forces information overload. This creates a sense of '
    'efficiency and control that is fundamentally different from the "wall of data" experience '
    'of traditional dashboards.', body_style))

story.append(Paragraph(
    '<b>Principle 4: Trust Through Transparency.</b> Every confidence score, evidence citation, '
    'and action recommendation is traceable to its source. The user never has to "trust the AI '
    'blindly" because the reasoning is always available. This principle is embedded in the '
    'progressive disclosure architecture: L2 shows the evidence, L3 shows the sources, L4 shows '
    'the raw data. Trust is earned through transparency, not assumed through branding.', body_style))

story.append(Paragraph(
    '<b>Principle 5: Executive Efficiency.</b> The entire experience is optimized for the '
    'executive time budget. The 5-minute journey is achievable because every zone, every card, '
    'and every interaction is designed to answer a specific question in minimal time. Navigation '
    'is reduced, context is preserved, and intelligence is prioritized. The VP Sales should feel '
    'that DeepMindQ respects their time more than any other tool in their stack.', body_style))

story.append(add_heading('6.3 Intelligence Advantage Feel', h2_style, 1))

story.append(Paragraph(
    'The "intelligence advantage" emotional goal is the differentiator that makes DeepMindQ feel '
    'like a category-defining product rather than a better CRM dashboard. This feeling is '
    'created through specific design patterns that make intelligence feel like a strategic asset '
    'rather than a feature.', body_style))

story.append(Paragraph(
    'First, the morning intelligence summary uses the SynthesisEngine to generate a natural '
    'language briefing that reads like an intelligence report from a human analyst, not a list '
    'of data points. The summary references specific signals, companies, and timeframes, making '
    'it feel grounded and authoritative. Second, the portfolio intelligence grid reveals patterns '
    'that would be invisible in a traditional CRM: a cluster of hiring signals across an industry '
    'vertical, a correlation between news events and buying stage progression, or an anomaly in '
    'engagement patterns that suggests a competitor is making a move.', body_style))

story.append(Paragraph(
    'Third, the evidence chain with source citations creates a "knowledge edge" feeling: the '
    'user can see not just what the AI believes, but what evidence supports that belief, and '
    'access the original sources. Fourth, the learning transparency shows the user that their '
    'expertise is being amplified by the system: when they dismiss a false positive, the system '
    'acknowledges the feedback and adjusts. When they accept a recommendation, the system records '
    'the outcome. This creates a virtuous cycle where human expertise improves AI accuracy, '
    'and AI accuracy amplifies human expertise.', body_style))

# =====================================================================
# CHAPTER 7: TECHNICAL IMPLEMENTATION STRATEGY
# =====================================================================
story.append(add_heading('Chapter 7: Technical Implementation Strategy', h1_style, 0))
story.append(spacer(4))

story.append(add_heading('7.1 Component Architecture', h2_style, 1))

story.append(Paragraph(
    'Phase 1B extends the Phase 1A component library with five new or enhanced components. These '
    'components are built on top of the existing intelligence OS design tokens and compose with '
    'the Phase 1A components (IntelligenceNarrative, EvidenceChain, ConfidenceIndicator, ActionCTA, '
    'IntelligencePanel). No existing components are removed or fundamentally restructured; '
    'instead, new components add the executive experience layer on top of the intelligence '
    'foundation.', body_style))

component_data = [
    ['MorningBriefing', 'New', 'Zone 1 component. Generates and displays AI-synthesized morning intelligence summary. Uses SynthesisEngine with morning_brief type. Displays top 3 attention items with natural language reasoning.', 'IntelligenceNarrativeService (extended), SynthesisEngine'],
    ['PortfolioGrid', 'New', 'Zone 2 component. Visual grid of monitored accounts as tiles. Each tile shows: company name, movement direction (color), top signal type, revenue band, intelligence score delta. Supports filtering and sorting.', 'Company signals, intelligence scores, revenue data'],
    ['IntelligenceFeed', 'Enhanced', 'Zone 3 component. Upgrades existing narrative list with: level-dependent disclosure (L0 auto-expand, L3 collapsed), composite ranking (confidence x priority x recency), account grouping for related signals, temporal badges ("new today", "escalated").', 'useIntelligenceNarratives (extended)'],
    ['ActionQueue', 'New', 'Zone 4 component. Extracts and aggregates all action recommendations from narratives. Shows: action description, urgency (time-bound), owning account, deadline, status (new/in-progress/completed). Persistent across screens.', 'ActionEngine, narrative actions'],
    ['IntelligenceHealthBar', 'Enhanced', 'Zone 5 component. Extends existing aggregate confidence with: signal freshness indicator, evidence coverage percentage, user feedback stats (accepted/dismissed ratio), model confidence trend (7-day sparkline).', 'Signal freshness, evidence coverage, feedback data'],
]

story.append(styled_table(
    ['Component', 'Status', 'Description', 'Data Dependencies'],
    component_data,
    col_widths=[CONTENT_W * 0.14, CONTENT_W * 0.08, CONTENT_W * 0.48, CONTENT_W * 0.30],
))

story.append(spacer(8))

story.append(add_heading('7.2 Data Flow Architecture', h2_style, 1))

story.append(Paragraph(
    'The Phase 1B data flow extends the Phase 1A pipeline with three new data paths while '
    'preserving the existing Signal-to-Component flow. The existing pipeline remains unchanged: '
    'CompanySignal -> GroundingEngine -> ConfidenceComputation -> ActionEngine -> '
    'IntelligenceNarrativeService -> /api/intelligence/narratives -> useIntelligenceNarratives -> '
    'CommandCenter. Phase 1B adds parallel data flows that feed the new components.', body_style))

flow_data = [
    ['Morning Briefing', 'All active signals + account scores', 'SynthesisEngine (morning_brief type)', 'MorningBriefing component', 'Zone 1'],
    ['Portfolio Grid', 'Company scores + signal counts + movement deltas', 'Aggregate query (company scores, recent signals)', 'PortfolioGrid component', 'Zone 2'],
    ['Action Queue', 'All narrative actions (extracted during narrative generation)', 'IntelligenceNarrativeService (extended to emit action events)', 'ActionQueue component', 'Zone 4'],
    ['Intelligence Health', 'Signal freshness + evidence coverage + feedback stats', 'Aggregate queries (signal dates, evidence counts, feedback table)', 'IntelligenceHealthBar component', 'Zone 5'],
    ['Context Thread', 'Thread ID passed via URL params + app state', 'Client-side state management (zustand store)', 'IntelligencePanel + breadcrumb trail', 'Cross-screen'],
]

story.append(styled_table(
    ['Flow', 'Input', 'Processing', 'Output', 'Zone'],
    flow_data,
    col_widths=[CONTENT_W * 0.14, CONTENT_W * 0.22, CONTENT_W * 0.26, CONTENT_W * 0.22, CONTENT_W * 0.16],
))

story.append(spacer(8))

story.append(add_heading('7.3 Intelligence Pipeline Extensions', h2_style, 1))

story.append(Paragraph(
    'Three extensions to the existing intelligence pipeline are required to support the Phase 1B '
    'components. These extensions are additive and do not modify the existing Phase 1A pipeline '
    'behavior. The existing narrative generation, confidence computation, and evidence collection '
    'mechanisms remain unchanged.', body_style))

story.append(Paragraph(
    '<b>Extension 1: Morning Briefing Generation.</b> A new SynthesisEngine brief type '
    '(morning_brief) that aggregates all active signals from the past 24 hours, cross-references '
    'them with account scores and movement data, and generates a natural language briefing. The '
    'briefing includes: total signal count by severity, top 3 attention items with reasoning, '
    'portfolio movement summary (positive/negative/neutral account counts), and actions approaching '
    'deadline. This is a new API endpoint: /api/intelligence/morning-brief.', body_style))

story.append(Paragraph(
    '<b>Extension 2: Composite Narrative Ranking.</b> The existing useIntelligenceNarratives '
    'hook returns narratives sorted by confidence. Phase 1B extends this with a composite ranking '
    'formula: rank = confidence * priorityWeight * recencyDecay, where priorityWeight maps '
    'critical=4, high=3, medium=2, low=1, and recencyDecay applies a 7-day half-life to '
    'ensure recent intelligence is ranked higher. This ranking is computed client-side using '
    'data already returned by the API.', body_style))

story.append(Paragraph(
    '<b>Extension 3: Feedback Tracking API.</b> A new API endpoint (/api/intelligence/feedback) '
    'that records user interactions with intelligence narratives: accept, dismiss, view, drill-down, '
    'and action-taken. This data feeds the IntelligenceHealthBar component (accepted/dismissed '
    'ratio) and is stored for future model fine-tuning. The existing intelligence feedback '
    'service is extended to support these new interaction types.', body_style))

# =====================================================================
# CHAPTER 8: ACCEPTANCE CRITERIA
# =====================================================================
story.append(add_heading('Chapter 8: Acceptance Criteria', h1_style, 0))
story.append(spacer(4))

story.append(Paragraph(
    'Phase 1B implementation may not begin until this design document is reviewed and accepted. '
    'Upon acceptance, the following acceptance criteria must be met before Phase 1B can be '
    'considered complete. Each criterion is verifiable through either automated testing, user '
    'testing, or visual inspection.', body_style))

story.append(add_heading('8.1 Functional Acceptance Criteria', h2_style, 1))

functional_criteria = [
    ['AC-1', 'Morning Briefing', 'Command Center displays an AI-generated morning summary at the top of Zone 1, synthesized from the past 24 hours of signals, with top 3 attention items identified by name and reasoning.', 'Manual inspection + API test'],
    ['AC-2', 'Portfolio Intelligence Grid', 'Zone 2 displays a visual grid of monitored accounts with movement direction indicators (positive/negative/neutral), color-coded tiles, and top signal type annotations for each account.', 'Manual inspection'],
    ['AC-3', 'Level-Dependent Disclosure', 'Intelligence narratives display at different disclosure depths based on intelligence level: L0 auto-expands full narrative, L3 shows headline only. Level assignment is based on severity and recency.', 'Manual inspection + component test'],
    ['AC-4', 'Action Queue', 'Zone 4 displays all pending action recommendations across the portfolio with urgency indicators (time-bound), account association, and status tracking (new/in-progress/completed).', 'Manual inspection + API test'],
    ['AC-5', '5-Minute Test', 'A VP Sales/CRO test participant can answer all 5 questions (attention, movement, reasoning, action, learning) within 5 minutes of first opening the application, measured by timed user testing.', 'User testing (3+ participants)'],
    ['AC-6', 'Context Preservation', 'Navigating from a Command Center narrative to a company detail screen preserves the intelligence thread context, shown via breadcrumb trail and auto-opened IntelligencePanel.', 'Manual inspection + E2E test'],
    ['AC-7', 'Feedback Loop', 'Accepting or dismissing an intelligence narrative records the feedback via the API, updates the IntelligenceHealthBar feedback stats, and provides user confirmation of the recording.', 'API test + manual inspection'],
    ['AC-8', 'Navigation Reduction', 'Default landing page is Command Center. Contextual navigation shows only relevant screens when an intelligence narrative is active. Screen consolidation plan is documented for Phase 2.', 'Manual inspection'],
]

story.append(styled_table(
    ['ID', 'Criterion', 'Description', 'Verification'],
    functional_criteria,
    col_widths=[CONTENT_W * 0.06, CONTENT_W * 0.14, CONTENT_W * 0.58, CONTENT_W * 0.22],
))

story.append(spacer(8))

story.append(add_heading('8.2 Technical Acceptance Criteria', h2_style, 1))

technical_criteria = [
    ['TC-1', 'Pipeline Integrity', 'All 5 zones consume real intelligence data from the pipeline. Zero static/template data in any zone.', 'Code audit'],
    ['TC-2', 'Test Coverage', 'New components have test coverage: MorningBriefing (5+ tests), PortfolioGrid (5+ tests), ActionQueue (5+ tests). Total new tests >= 15.', 'Test execution'],
    ['TC-3', 'TypeScript', 'Zero TypeScript compilation errors after Phase 1B implementation.', 'npx tsc --noEmit'],
    ['TC-4', 'Build', 'Production build succeeds with zero errors.', 'npx next build'],
    ['TC-5', 'Lint', 'Zero lint errors.', 'bun run lint'],
    ['TC-6', 'Performance', 'Command Center initial render completes within 3 seconds on standard hardware (4-core, 8GB). Intelligence narratives load within 5 seconds.', 'Performance measurement'],
    ['TC-7', 'Regression', 'All existing Phase 1A tests pass (1888+ tests, 0 new failures).', 'Test execution'],
    ['TC-8', 'API Endpoints', 'New API endpoints (/api/intelligence/morning-brief, extended /api/intelligence/feedback) are authenticated, have error handling, and return correct data shapes.', 'API test'],
]

story.append(styled_table(
    ['ID', 'Criterion', 'Description', 'Verification'],
    technical_criteria,
    col_widths=[CONTENT_W * 0.06, CONTENT_W * 0.14, CONTENT_W * 0.58, CONTENT_W * 0.22],
))

story.append(spacer(8))

story.append(add_heading('8.3 Known Limitations for Phase 1B', h2_style, 1))

story.append(Paragraph(
    'The following limitations are acknowledged for Phase 1B and will be addressed in subsequent '
    'phases. They should not block Phase 1B closure but must be documented for planning purposes.', body_style))

limitations_data = [
    ['Real-Time Updates', 'WebSocket-based real-time intelligence updates are not included in Phase 1B. The system continues to use polling-based refresh (manual or timed).', 'Phase 2'],
    ['Full Screen Consolidation', 'Phase 1B documents the consolidation plan and implements the Command Center as default landing. Full screen elimination/merger (77 screens to ~40) is a Phase 2 scope.', 'Phase 2'],
    ['Cross-Account Intelligence', 'Cross-account pattern detection and industry-vertical analysis are displayed at a basic level. Advanced cross-account correlation (multi-account buying signals, competitive displacement patterns) is Phase 2.', 'Phase 2'],
    ['Mobile Optimization', 'The Phase 1B Command Center is designed for desktop executive use. Mobile-responsive optimization is deferred to Phase 3.', 'Phase 3'],
    ['Multi-User Collaboration', 'Intelligence sharing, team-based action assignment, and collaborative intelligence review are not included in Phase 1B.', 'Phase 3'],
]

story.append(styled_table(
    ['Limitation', 'Description', 'Target Phase'],
    limitations_data,
    col_widths=[CONTENT_W * 0.18, CONTENT_W * 0.60, CONTENT_W * 0.22],
))

# =====================================================================
# BUILD DOCUMENT
# =====================================================================
doc = TocDocTemplate(
    OUTPUT_PATH,
    pagesize=A4,
    leftMargin=MARGIN,
    rightMargin=MARGIN,
    topMargin=MARGIN,
    bottomMargin=MARGIN,
    title='DeepMindQ Phase 1B Design Document',
    author='DeepMindQ Product Team',
    subject='Command Center Executive Intelligence Experience',
)

# Add page numbers and header/footer
def add_page_elements(canvas, doc):
    canvas.saveState()
    # Footer: page number
    canvas.setFont('FreeSerif', 8)
    canvas.setFillColor(TEXT_MUTED)
    page_num = canvas.getPageNumber()
    if page_num > 1:  # Skip cover
        canvas.drawCentredString(PAGE_W / 2, 0.5 * inch, f'Page {page_num - 1}')
        # Header: document title
        canvas.setFont('FreeSerif-Italic', 7)
        canvas.drawString(MARGIN, PAGE_H - 0.5 * inch, 'DeepMindQ Phase 1B Design Document')
        canvas.drawRightString(PAGE_W - MARGIN, PAGE_H - 0.5 * inch, 'Command Center Executive Intelligence Experience')
        # Header line
        canvas.setStrokeColor(BORDER)
        canvas.setLineWidth(0.5)
        canvas.line(MARGIN, PAGE_H - 0.6 * inch, PAGE_W - MARGIN, PAGE_H - 0.6 * inch)
    canvas.restoreState()

doc.multiBuild(story, onLaterPages=add_page_elements)
print(f'PDF generated: {OUTPUT_PATH}')
