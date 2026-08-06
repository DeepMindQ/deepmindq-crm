#!/usr/bin/env python3
"""
DeepMindQ MS6 Design Foundation — Complete Supporting Documentation
Generates a 5-chapter PDF covering UX Philosophy, IA, Components, Interactions, and Copy.
"""

import hashlib, os, sys
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    Paragraph, Spacer, PageBreak, Table, TableStyle,
    KeepTogether, HRFlowable, ListFlowable, ListItem
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily

# ━━ Paths ━━
FONT_DIR = '/usr/share/fonts'
PDF_SKILL_DIR = '/home/z/my-project/skills/pdf'
OUTPUT = '/home/z/my-project/download/DeepMindQ_MS6_Supporting_Documentation.pdf'

# ━━ Register Fonts ━━
pdfmetrics.registerFont(TTFont('Inter', f'{FONT_DIR}/truetype/liberation/LiberationSans-Regular.ttf'))
pdfmetrics.registerFont(TTFont('Inter-Bold', f'{FONT_DIR}/truetype/liberation/LiberationSans-Bold.ttf'))
registerFontFamily('Inter', normal='Inter', bold='Inter-Bold')

pdfmetrics.registerFont(TTFont('FreeSerif', f'{FONT_DIR}/truetype/liberation/LiberationSerif-Regular.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-Bold', f'{FONT_DIR}/truetype/liberation/LiberationSerif-Bold.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-Italic', f'{FONT_DIR}/truetype/liberation/LiberationSerif-Italic.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-BoldItalic', f'{FONT_DIR}/truetype/liberation/LiberationSerif-BoldItalic.ttf'))
registerFontFamily('FreeSerif', normal='FreeSerif', bold='FreeSerif-Bold',
                    italic='FreeSerif-Italic', boldItalic='FreeSerif-BoldItalic')

pdfmetrics.registerFont(TTFont('NotoSerifSC', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('NotoSerifSC-Bold', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Bold.ttf'))
registerFontFamily('NotoSerifSC', normal='NotoSerifSC', bold='NotoSerifSC-Bold')

pdfmetrics.registerFont(TTFont('JetBrainsMono', f'{FONT_DIR}/truetype/liberation/LiberationMono-Regular.ttf'))

# ━━ Cascade Palette (dark mode, auto-generated) ━━
PAGE_BG       = colors.HexColor('#121211')
SECTION_BG    = colors.HexColor('#23221f')
CARD_BG       = colors.HexColor('#292823')
TABLE_STRIPE  = colors.HexColor('#191917')
HEADER_FILL   = colors.HexColor('#494331')
COVER_BLOCK   = colors.HexColor('#494330')
BORDER        = colors.HexColor('#5a5443')
ICON          = colors.HexColor('#b2a16f')
ACCENT        = colors.HexColor('#dbbf6a')
ACCENT_2      = colors.HexColor('#57b4d4')
TEXT_PRIMARY   = colors.HexColor('#eeedec')
TEXT_MUTED     = colors.HexColor('#928f89')
SEM_SUCCESS   = colors.HexColor('#5fb97d')
SEM_WARNING   = colors.HexColor('#b6a073')
SEM_ERROR     = colors.HexColor('#b9665e')
SEM_INFO      = colors.HexColor('#6f8eae')

# ━━ Page dimensions ━━
W, H = A4
MARGIN = 60

# ━━ Styles ━━
styles = {}

def make_styles():
    s = styles
    s['h1'] = ParagraphStyle('H1', fontName='Inter-Bold', fontSize=22, leading=28,
        textColor=ACCENT, spaceAfter=12, spaceBefore=24, alignment=TA_LEFT)
    s['h2'] = ParagraphStyle('H2', fontName='Inter-Bold', fontSize=16, leading=22,
        textColor=TEXT_PRIMARY, spaceAfter=8, spaceBefore=18, alignment=TA_LEFT)
    s['h3'] = ParagraphStyle('H3', fontName='Inter-Bold', fontSize=13, leading=18,
        textColor=ICON, spaceAfter=6, spaceBefore=14, alignment=TA_LEFT)
    s['body'] = ParagraphStyle('Body', fontName='FreeSerif', fontSize=10.5, leading=17,
        textColor=TEXT_PRIMARY, spaceAfter=8, alignment=TA_JUSTIFY)
    s['body_indent'] = ParagraphStyle('BodyIndent', fontName='FreeSerif', fontSize=10.5, leading=17,
        textColor=TEXT_PRIMARY, spaceAfter=8, alignment=TA_JUSTIFY, leftIndent=20)
    s['quote'] = ParagraphStyle('Quote', fontName='FreeSerif-Italic', fontSize=11, leading=17,
        textColor=ACCENT, spaceAfter=10, spaceBefore=10, leftIndent=24, rightIndent=12,
        alignment=TA_LEFT, borderColor=ACCENT, borderWidth=0, borderPadding=0)
    s['bullet'] = ParagraphStyle('Bullet', fontName='FreeSerif', fontSize=10.5, leading=17,
        textColor=TEXT_PRIMARY, spaceAfter=4, leftIndent=28, bulletIndent=14, alignment=TA_LEFT)
    s['mono'] = ParagraphStyle('Mono', fontName='JetBrainsMono', fontSize=9.5, leading=15,
        textColor=ACCENT_2, spaceAfter=6, leftIndent=20, backColor=CARD_BG,
        borderColor=BORDER, borderWidth=0.5, borderPadding=6)
    s['caption'] = ParagraphStyle('Caption', fontName='FreeSerif-Italic', fontSize=9, leading=13,
        textColor=TEXT_MUTED, spaceAfter=6, alignment=TA_LEFT)
    s['toc_h1'] = ParagraphStyle('TOCH1', fontName='Inter-Bold', fontSize=13, leading=20,
        textColor=TEXT_PRIMARY, leftIndent=10, spaceBefore=6)
    s['toc_h2'] = ParagraphStyle('TOCH2', fontName='FreeSerif', fontSize=11, leading=18,
        textColor=TEXT_MUTED, leftIndent=30, spaceBefore=3)
    s['meta'] = ParagraphStyle('Meta', fontName='FreeSerif', fontSize=8.5, leading=12,
        textColor=TEXT_MUTED, alignment=TA_LEFT)

make_styles()

# ━━ TOC Template ━━
class TocDocTemplate:
    pass

# ━━ Helpers ━━
def h(text, level=1):
    key = f'h_{hashlib.md5(text.encode()).hexdigest()[:8]}'
    style_name = f'h{level}'
    p = Paragraph(f'<a name="{key}"/>{text}', styles[style_name])
    p.bookmark_name = key
    p.bookmark_level = level - 1
    p.bookmark_text = text
    p.bookmark_key = key
    return p

def body(text):
    return Paragraph(text, styles['body'])

def body_i(text):
    return Paragraph(text, styles['body_indent'])

def quote(text):
    return Paragraph(text, styles['quote'])

def bullet_list(items):
    elements = []
    for item in items:
        elements.append(Paragraph(f'<bullet>&bull;</bullet> {item}', styles['bullet']))
    return elements

def mono_block(text):
    return Paragraph(text, styles['mono'])

def spacer(h=12):
    return Spacer(1, h)

def hr():
    return HRFlowable(width='100%', thickness=0.5, color=BORDER, spaceAfter=12, spaceBefore=12)

def callout_box(text, bg_color=CARD_BG, border_color=ACCENT):
    tbl = Table([[Paragraph(text, styles['body'])]],
        colWidths=[W - 2*MARGIN - 20])
    tbl.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), bg_color),
        ('BOX', (0,0), (-1,-1), 0.5, border_color),
        ('TOPPADDING', (0,0), (-1,-1), 10),
        ('BOTTOMPADDING', (0,0), (-1,-1), 10),
        ('LEFTPADDING', (0,0), (-1,-1), 14),
        ('RIGHTPADDING', (0,0), (-1,-1), 14),
    ]))
    return tbl

def make_table(headers, rows, col_widths=None):
    header_row = [Paragraph(f'<b>{h_text}</b>', styles['h3']) for h_text in headers]
    data = [header_row] + rows
    avail = W - 2*MARGIN - 20  # buffer for grid lines, padding, and text expansion
    if col_widths is None:
        col_widths = [avail / len(headers)] * len(headers)
    else:
        total = sum(col_widths)
        if total > avail:
            scale = avail / total
            col_widths = [w * scale for w in col_widths]
    tbl = Table(data, colWidths=col_widths, repeatRows=1)
    style_cmds = [
        ('BACKGROUND', (0,0), (-1,0), HEADER_FILL),
        ('TEXTCOLOR', (0,0), (-1,0), TEXT_PRIMARY),
        ('FONTNAME', (0,0), (-1,0), 'Inter-Bold'),
        ('FONTSIZE', (0,0), (-1,0), 10),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ('GRID', (0,0), (-1,-1), 0.3, BORDER),
    ]
    for i in range(1, len(data)):
        bg = colors.white if i % 2 == 1 else TABLE_STRIPE
        style_cmds.append(('BACKGROUND', (0,i), (-1,i), bg))
    tbl.setStyle(TableStyle(style_cmds))
    return tbl


# ═══════════════════════════════════════════════════════
# CHAPTER 1: UX PHILOSOPHY DOCUMENT
# ═══════════════════════════════════════════════════════
def chapter_1():
    elements = []
    elements.append(h('Chapter 1: UX Philosophy Document', 1))
    elements.append(spacer(6))
    elements.append(body(
        'This document establishes the foundational UX philosophy for the DeepMindQ CRM platform, '
        'as defined and locked during MS6 Design Foundation. Every design decision, component specification, '
        'interaction pattern, and visual language choice in MS7 through MS11 must trace back to the '
        'principles articulated here. This is not a style guide or a component catalog; it is the '
        'philosophical framework that gives those artifacts their meaning and coherence.'
    ))
    elements.append(spacer(6))

    # 1.1 Experience Promise
    elements.append(h('1.1 The DeepMindQ Experience Promise', 2))
    elements.append(body(
        'The DeepMindQ Experience Promise is the single most important artifact in this document. '
        'It is the contract between the product and its users. Every feature, every interaction, every '
        'visual element either serves this promise or does not belong in the product. The promise is '
        'not a feature list or a technical specification. It is an outcome guarantee.'
    ))
    elements.append(quote(
        '"Every morning, a VP Sales opens DeepMindQ and within 3 minutes knows exactly what changed, '
        'why it matters, who to engage, what to say, and what to do \u2014 with full confidence in the '
        'evidence behind every recommendation."'
    ))
    elements.append(body(
        'This promise contains three measurable commitments. First, the time commitment: 3 minutes to '
        'complete situational awareness. This is not an aspirational target; it is a design constraint. '
        'Every element of the Intelligence Hub must be architected to deliver its value within this '
        'window. Second, the completeness commitment: the user must have answers to all five morning '
        'questions (What changed? Why does it matter? Who should we engage? What should we say? What '
        'should we do?) without navigating away from the primary experience. Third, the trust commitment: '
        'every recommendation must carry its evidence footprint. The user should never have to guess '
        'why the system suggests something; the reasoning, sources, and confidence levels must be '
        'transparently available.'
    ))
    elements.append(body(
        'The three pillars that support this promise are Intelligence, Not Data; Confidence at Every '
        'Layer; and the 3-Morning-Minute Protocol. Intelligence, Not Data means the system delivers '
        'intelligence, not information. Every element answers what, why, who, how, and why trust this. '
        'Confidence at Every Layer means every recommendation carries an evidence footprint, and users '
        'never have to guess why the system suggests something. The 3-Morning-Minute Protocol means the '
        'entire Intelligence Hub experience is designed to deliver complete situational awareness in '
        'under 3 minutes.'
    ))

    # 1.2 Design North Star
    elements.append(h('1.2 Design North Star: The VP Sales Mental Model', 2))
    elements.append(body(
        'Every UX decision in DeepMindQ passes through one filter: Would a VP Sales trust this, rely '
        'on this daily, and recommend this to their team? The VP Sales is not a demographic or a persona '
        'in the traditional UX sense. It is a decision-making mindset that represents our primary user '
        'archetype. This persona embodies three behavioral principles that shape the entire experience.'
    ))
    elements.append(body(
        'The first principle is the Time-Scarce Decision Maker. A VP Sales arrives each morning with '
        'approximately 15 minutes maximum for intelligence review. They do not browse dashboards, they '
        'do not read feeds, and they do not explore interfaces. They need signal, not noise. Every element '
        'of the DeepMindQ experience must justify its cognitive cost. If a component requires more than '
        '5 seconds of processing time, it must deliver proportional value. Progressive disclosure exists '
        'precisely to manage this: the morning briefing gives the summary; deeper layers are available '
        'for those who need them.'
    ))
    elements.append(body(
        'The second principle is the Trust-Sensitive Executive. This persona will not act on AI '
        'recommendations without understanding why. Evidence is not optional for this user; it is '
        'a prerequisite for action. The trust-sensitive executive has been burned by AI tools that '
        'make confident-sounding but incorrect predictions. DeepMindQ must build trust through radical '
        'transparency: every confidence score, every evidence chain, every reasoning step must be '
        'immediately accessible. The system earns trust by showing its work, not by asking for it.'
    ))
    elements.append(body(
        'The third principle is the Action-Oriented Leader. Intelligence without a recommended next '
        'step is wasted cognitive load for this persona. Every insight in DeepMindQ must terminate in '
        'a clear, actionable recommendation. This does not mean the system tells the user what to do; '
        'rather, it suggests what to consider, with enough context for the user to make an informed '
        'decision. The distinction between direction and briefing is critical here and is explored '
        'in depth in the next section.'
    ))

    # 1.3 Core Philosophy
    elements.append(h('1.3 Core Philosophy: Intelligence as Executive Briefing', 2))
    elements.append(body(
        'This is Design Pattern #1 and it overrides all other patterns. DeepMindQ does not tell the '
        'user what to do. DeepMindQ briefs the user on what is happening, why it matters, and recommends '
        'what to consider \u2014 with full evidence transparency. This distinction is subtle but critical. '
        'An executive briefing gives the reader context, analysis, and recommendations, but the executive '
        'makes the decision. This is the relationship DeepMindQ must have with its users.'
    ))
    elements.append(body(
        'The philosophy manifests in four key distinctions. Briefing, Not Direction means the system '
        'presents intelligence as a structured, prioritized, evidence-backed briefing document. The '
        'decision always belongs to the human. Recommendation, Not Instruction means AI suggests actions '
        'with confidence levels and evidence trails. Users evaluate, adjust, and decide. The system '
        'provides the briefing; the user provides the judgment. Evidence, Not Authority means every '
        'insight carries its evidence footprint. Trust is built through transparency, not through brand '
        'or authority. Context, Not Complexity means progressive disclosure reveals depth on demand. '
        'The morning briefing gives the summary; deeper layers are available for those who need them. '
        'Intelligence surfaces first; complexity reveals itself when needed.'
    ))

    # 1.4 5-Question Framework
    elements.append(h('1.4 The 5-Question Morning Intelligence Protocol', 2))
    elements.append(body(
        'The 5-Question Framework is the structural backbone of the Intelligence Hub. It is not a '
        'feature; it is an information architecture constraint. Every card, signal, recommendation, '
        'and action in the Hub must map to at least one of these five questions. If a component cannot '
        'answer which question it serves, it belongs in a deeper experience layer, not the Hub. This '
        'constraint prevents the Hub from becoming an overloaded dashboard.'
    ))
    elements.append(make_table(
        ['Question', ' maps to', 'Information Type'],
        [
            [Paragraph('1. What Changed?', styles['body']), Paragraph('Surveillance', styles['body']),
             Paragraph('Critical signals, account movements, market shifts, competitive changes, ranked by impact', styles['body'])],
            [Paragraph('2. Why It Matters?', styles['body']), Paragraph('Analysis', styles['body']),
             Paragraph('Context, reasoning, impact analysis, trend correlation, revenue implication', styles['body'])],
            [Paragraph('3. Who to Engage?', styles['body']), Paragraph('Targeting', styles['body']),
             Paragraph('Account-specific recommendations, priority-ranked engagement targets with reasoning', styles['body'])],
            [Paragraph('4. What to Say?', styles['body']), Paragraph('Preparation', styles['body']),
             Paragraph('Conversation angles, talking points, contextual intelligence for each engagement', styles['body'])],
            [Paragraph('5. What to Do?', styles['body']), Paragraph('Action', styles['body']),
             Paragraph('Recommended actions with confidence scores, timelines, evidence trails', styles['body'])],
        ],
        col_widths=[100, 80, W - 2*MARGIN - 180]
    ))
    elements.append(spacer(6))
    elements.append(body(
        'The design rule is absolute: No intelligence element exists in the Hub that does not map to '
        'at least one of these five questions. This constraint ensures the Intelligence Hub remains '
        'focused, actionable, and bounded. The 75+ deeper screens that exist in the current system '
        'remain accessible through progressive disclosure within the seven core experiences, but they '
        'are not surfaced in the Hub unless they directly answer one of the five questions.'
    ))

    # 1.5 15 Core Design Patterns
    elements.append(h('1.5 The 15 Locked Core Design Patterns', 2))
    elements.append(body(
        'MS6 locks 15 core design patterns that form the DNA of the DeepMindQ experience. These patterns '
        'are selected from the comprehensive 72-point behavioral psychology checklist and represent the '
        'highest-impact design interventions. Each pattern is categorized by its primary domain: Philosophy, '
        'Architecture, Trust, Emotional, or Visual. Every component, interaction, and visual element in '
        'MS7 through MS11 must map to at least one of these patterns.'
    ))
    elements.append(make_table(
        ['#', 'Pattern', 'Category', 'Core Principle'],
        [
            ['1', 'AI Intelligence as Executive Briefing', 'Philosophy', 'AI briefs; humans decide'],
            ['2', 'Cognitive Load Reduction', 'Philosophy', 'Minimize mental effort per decision'],
            ['3', 'Progressive Disclosure', 'Architecture', 'Summary to depth on demand'],
            ['4', 'Navigation Intelligence', 'Architecture', 'Nav answers what to focus on next'],
            ['5', 'Decision Fatigue Prevention', 'Philosophy', 'Reduce choices per decision point'],
            ['6', 'Trust Visualization / Evidence Footprint', 'Trust', 'Every insight shows its proof'],
            ['7', 'Confidence + Freshness + Source Transparency', 'Trust', 'Confidence is quantified and sourced'],
            ['8', 'Emotional Copywriting', 'Emotional', 'Words carry emotional weight'],
            ['9', 'Compassionate Error Handling', 'Emotional', 'Errors explain why, offer a path forward'],
            ['10', 'Loss Aversion Design', 'Emotional', 'Frame as risk prevention'],
            ['11', 'Endowment Effect / Personal Ownership', 'Emotional', 'Users feel ownership of their workspace'],
            ['12', 'Premium Enterprise Visual Language', 'Visual', 'Dark glass-morphism, calm aesthetics'],
            ['13', 'Human Assistance Layer', 'Architecture', 'AI + human collaboration model'],
            ['14', 'Empty State + Success State Experience', 'Visual', 'Every state has meaningful content'],
            ['15', 'Component Architecture System', 'Architecture', 'Atomic design: tokens, atoms, molecules, organisms'],
        ],
        col_widths=[30, 150, 80, W - 2*MARGIN - 260]
    ))
    elements.append(spacer(6))
    elements.append(body(
        'The remaining patterns from the 72-point checklist will be applied progressively through '
        'MS7\u2013MS11 as specific screens are developed. Each screen development must pass a 5-question '
        'gate: Is this important? What should the user do? Why trust this? Does the user have control? '
        'Does this match the Design DNA?'
    ))

    return elements


# ═══════════════════════════════════════════════════════
# CHAPTER 2: INFORMATION ARCHITECTURE DOCUMENTATION
# ═══════════════════════════════════════════════════════
def chapter_2():
    elements = []
    elements.append(h('Chapter 2: Information Architecture Documentation', 1))
    elements.append(spacer(6))
    elements.append(body(
        'This document specifies the information architecture for DeepMindQ as established in MS6. '
        'It covers the navigation model, the Intelligence Hub structure, the progressive disclosure '
        'system, and the relationship between the seven core experiences and the 75+ deeper screens. '
        'This IA is locked and serves as the structural foundation for all MS7\u2013MS11 screen development.'
    ))

    # 2.1 Navigation Model
    elements.append(h('2.1 Navigation Model: Intelligence Hub First', 2))
    elements.append(body(
        'The Intelligence Hub is the default landing page and the primary experience. It serves as '
        'the Executive Briefing Room. Every session starts at the Intelligence Hub. No other screen '
        'is the default entry point. The Hub is not a "one screen to rule them all" overloaded dashboard. '
        'It is a focused briefing environment that answers the 5 morning questions within a 3-minute '
        'protocol. Other experiences exist as deeper intelligence environments accessible from the Hub.'
    ))
    elements.append(spacer(4))
    elements.append(mono_block(
        'Intelligence Hub (Default Landing)<br/>'
        '\u251c\u2500\u2500 Market Intelligence<br/>'
        '\u251c\u2500\u2500 Account Intelligence<br/>'
        '\u251c\u2500\u2500 AI Advisors<br/>'
        '\u251c\u2500\u2500 Workspace<br/>'
        '\u251c\u2500\u2500 Operations<br/>'
        '\u2514\u2500\u2500 Command Center'
    ))
    elements.append(spacer(6))
    elements.append(body(
        'The architectural principle is: Surface intelligence first. Reveal complexity only when needed. '
        'The 75+ deeper screens remain as progressive disclosure depth inside these seven experiences. '
        'They should NOT become top-level navigation items. Navigation shows 7 experiences; depth lives '
        'inside each experience. This reduces cognitive load from 76 choices to 7, with depth available '
        'on demand. The navigation itself is intelligent (Design Pattern #4): it answers the question '
        '"What should I focus on next?" through contextual badges, priority indicators, and attention '
        'guidance.'
    ))

    # 2.2 Seven Experiences
    elements.append(h('2.2 The Seven Core Experiences', 2))
    elements.append(body(
        'Each experience is a self-contained intelligence environment with its own information hierarchy, '
        'interaction patterns, and progressive disclosure depth. The following table documents each '
        'experience, its primary purpose, the morning questions it answers, and its key components.'
    ))
    elements.append(make_table(
        ['Experience', 'Primary Purpose', 'Morning Questions', 'Key Components'],
        [
            ['Intelligence Hub', 'Executive briefing room; answers all 5 questions in 3 minutes',
             'All 5', 'Priority Signals, Recommended Actions, Evidence Summary, Confidence Overview'],
            ['Market Intelligence', 'Market signals, industry trends, competitive landscape',
             '1, 2', 'Signal Feed, Trend Analysis, Competitive Tracker, Market Briefing'],
            ['Account Intelligence', 'Account-specific deep intelligence and engagement prep',
             '1-5', 'Account Brief, Opportunity Radar, Contact Intelligence, Engagement History'],
            ['AI Advisors', 'AI-powered advisory conversations and analysis',
             '2-5', 'AI Chat, Advisory Sessions, Scenario Analysis, Recommendation Engine'],
            ['Workspace', 'Personal workspace for saved views, preferences, custom briefings',
             '3-5', 'Saved Views, Custom Briefings, Personal Preferences, Workspace Settings'],
            ['Operations', 'System health, data management, administrative functions',
             '1', 'System Health, Data Sources, Import Management, Audit Logs'],
            ['Command Center', 'Operational command view for intelligence orchestration',
             '1, 5', 'Intelligence Queue, Action Pipeline, Status Metrics, Operations Overview'],
        ],
        col_widths=[85, 130, 55, W - 2*MARGIN - 270]
    ))

    # 2.3 Progressive Disclosure Model
    elements.append(h('2.3 Progressive Disclosure Model (L1\u2013L4)', 2))
    elements.append(body(
        'Progressive disclosure is Design Pattern #3 and the mechanism that makes Intelligence as '
        'Executive Briefing work. Not every user needs the same depth. A VP Sales who trusts the system '
        'after weeks of use may never drill past Level 1. A new user or a skeptic will want Level 3 '
        'evidence. The key insight: each level is independently accessible and answers a specific '
        'cognitive need. The experience adapts to the user\'s trust level.'
    ))
    elements.append(make_table(
        ['Level', 'Name', 'Cognitive Question', 'Contents', 'Target User'],
        [
            ['L1', 'Decision Layer', 'Do I need to act on this now?',
             'Headline, confidence score, priority badge, timestamp, variant badge',
             'All users (default view)'],
            ['L2', 'Reasoning Layer', 'Why does the system think this?',
             'Primary reasoning, positive/negative confidence factors, impact analysis',
             'Users evaluating trust'],
            ['L3', 'Evidence Layer', 'Show me the proof',
             'Evidence chain with sources, dates, relevance scores, verification links',
             'Skeptics and validators'],
            ['L4', 'Exploration Layer', 'What else should I know?',
             'Related signals, connected insights, adjacent opportunities, research paths',
             'Researchers and power users'],
        ],
        col_widths=[35, 75, 105, 130, W - 2*MARGIN - 345]
    ))
    elements.append(spacer(6))
    elements.append(callout_box(
        'Each level is independently accessible. Users who trust the system stay at L1. Skeptics drill '
        'to L3. Researchers explore L4. The experience adapts to the user\'s trust level \u2014 the user '
        'is never forced to digest complexity they do not need.'
    ))

    # 2.4 Current vs Future IA
    elements.append(h('2.4 Navigation Transformation: Current to Future', 2))
    elements.append(body(
        'The current navigation structure presents 16 items across 5 sections in the sidebar, with '
        '80+ screens accessible through various navigation paths. The routing mechanism uses hash-based '
        'SPA navigation via Zustand store (`activeView: ViewId`). This creates significant cognitive '
        'load: a new user faces 16 navigation choices without clear prioritization, and the relationship '
        'between screens is not immediately apparent.'
    ))
    elements.append(body(
        'The future navigation model collapses 16 items into 7 experiences, with the Intelligence Hub '
        'as the default landing page. The 75+ deeper screens remain accessible through progressive '
        'disclosure within each experience, not as navigation items. The routing mechanism will be '
        'updated to use a hierarchical navigation model where each experience can contain sub-views, '
        'but the primary navigation surface shows only 7 items. This transformation reduces the '
        'initial cognitive load from 16 choices to 7, with depth available on demand within each '
        'experience. The navigation itself becomes intelligent, showing contextual indicators of what '
        'needs attention across all experiences.'
    ))
    elements.append(make_table(
        ['Dimension', 'Current State', 'Future State (MS6+)'],
        [
            ['Navigation items', '16 sidebar items across 5 sections', '7 experiences, Hub as default'],
            ['Screen access', '80+ screens via flat navigation', '75+ screens via progressive disclosure'],
            ['Default landing', 'Intelligence Operations Center', 'Intelligence Hub (Executive Briefing)'],
            ['Cognitive load', '16 choices at first interaction', '7 choices at first interaction'],
            ['Navigation intelligence', 'Static sidebar with section labels', 'Contextual priority indicators'],
            ['Depth access', 'All screens equal priority', 'Progressive disclosure L1\u2013L4'],
        ],
        col_widths=[100, (W - 2*MARGIN - 100) / 2, (W - 2*MARGIN - 100) / 2]
    ))

    return elements


# ═══════════════════════════════════════════════════════
# CHAPTER 3: COMPONENT SPECIFICATIONS
# ═══════════════════════════════════════════════════════
def chapter_3():
    elements = []
    elements.append(h('Chapter 3: Component Specifications', 1))
    elements.append(spacer(6))
    elements.append(body(
        'This document evaluates the six existing Intelligence OS components against MS6 design '
        'principles. Each component is assessed for alignment with the core patterns: cognitive load '
        'reduction, intelligence as executive briefing, trust visualization, premium enterprise '
        'experience, and human-centered interaction. Components that align are incorporated into the '
        'Design System. Components that conflict are redesigned. Components are never blindly preserved '
        'or discarded; every decision is traceable to a design principle.'
    ))

    # 3.1 ConfidenceIndicator
    elements.append(h('3.1 ConfidenceIndicator \u2014 INCORPORATE', 2))
    elements.append(callout_box(
        '<b>File:</b> src/components/intelligence-os/confidence-indicator.tsx (184 lines)<br/>'
        '<b>Verdict:</b> Evaluate \u2192 Incorporate. Strong alignment with MS6 principles.<br/>'
        '<b>Action:</b> Incorporate into Design System as universal confidence display.',
        bg_color=colors.HexColor('#1a2e1a'), border_color=SEM_SUCCESS
    ))
    elements.append(spacer(4))
    elements.append(body(
        'The ConfidenceIndicator is the most aligned of all six components. It provides 4 visual modes '
        '(ring, bar, badge, score) and 4 size variants (xs, sm, md, lg), with animated value transitions '
        'and confidence tier colors from the existing design token system. The component directly serves '
        'Design Pattern #7 (Confidence + Freshness + Source Transparency) and Design Pattern #6 (Trust '
        'Visualization / Evidence Footprint).'
    ))
    elements.append(body(
        'Current interface: <font name="JetBrainsMono" size="9">ConfidenceIndicatorProps</font> with '
        'value (0-100), mode (ring|bar|badge|score), label, showPercentage, size (xs|sm|md|lg), animated, '
        'className. The component uses the existing design token system for confidence tier colors '
        '(high >= 70 = green, medium >= 45 = amber, low = red) and includes animated transitions. '
        'No changes to the core interface are needed. Visual styling will be updated to match the premium '
        'enterprise visual language, but the interaction model and prop interface remain unchanged.'
    ))

    # 3.2 EvidenceChain
    elements.append(h('3.2 EvidenceChain \u2014 INCORPORATE', 2))
    elements.append(callout_box(
        '<b>File:</b> src/components/intelligence-os/evidence-chain.tsx (180 lines)<br/>'
        '<b>Verdict:</b> Evaluate \u2192 Incorporate. Core trust pattern.<br/>'
        '<b>Action:</b> Redesign visual styling to match premium enterprise language.',
        bg_color=colors.HexColor('#1a2e1a'), border_color=SEM_SUCCESS
    ))
    elements.append(spacer(4))
    elements.append(body(
        'The EvidenceChain is a core trust visualization component that displays a numbered evidence '
        'trail with source icons, date stamps, relevance scores, and verification links. It serves '
        'Design Pattern #6 (Trust Visualization / Evidence Footprint) directly. The component uses '
        'the existing design token system for theming and supports compact and full display modes.'
    ))
    elements.append(body(
        'Current interface: <font name="JetBrainsMono" size="9">EvidenceChainProps</font> with items '
        '(EvidenceChainItem[]), title, conclusion, verdict (strong|moderate|weak), compact, className. '
        'Each item has source, sourceType (news|filing|web|database|social|internal|sec|press), snippet, '
        'url, date, relevanceScore. The visual design will be updated to match the premium enterprise '
        'visual language (glass-morphism cards, semantic color coding, refined typography), but the '
        'interaction model and data interface remain unchanged.'
    ))

    # 3.3 InlineReasoning
    elements.append(h('3.3 InlineReasoning \u2192 INCORPORATE', 2))
    elements.append(callout_box(
        '<b>File:</b> src/components/intelligence-os/inline-reasoning.tsx (158 lines)<br/>'
        '<b>Verdict:</b> Evaluate \u2192 Incorporate. Key L2 reasoning surface.<br/>'
        '<b>Action:</b> Refine factor visualization, add expand-to-evidence link pattern.',
        bg_color=colors.HexColor('#1a2e1a'), border_color=SEM_SUCCESS
    ))
    elements.append(spacer(4))
    elements.append(body(
        'The InlineReasoning component is the unified L2 reasoning surface that shows "Why does the '
        'system think this?" directly within narratives. It displays a primary reasoning statement, '
        'positive and negative confidence factor tags (green trending-up for positive, amber alert-'
        'triangle for negative), and an optional "See full evidence" expand link. It serves Design '
        'Pattern #3 (Progressive Disclosure) by providing the reasoning layer between the decision '
        'layer and the evidence layer.'
    ))
    elements.append(body(
        'Current interface: <font name="JetBrainsMono" size="9">InlineReasoningProps</font> with '
        'reasoning, positiveFactors (string[]), negativeFactors (string[]), onClickExpand, compact, '
        'showExpandLink. The component will be refined with improved factor tag visualization (larger '
        'hit targets, clearer positive/negative distinction), better transition animations for the '
        'expand link, and integration with the new evidence chain component at L3.'
    ))

    # 3.4 IntelligenceNarrative
    elements.append(h('3.4 IntelligenceNarrative \u2014 REDESIGN', 2))
    elements.append(callout_box(
        '<b>File:</b> src/components/intelligence-os/intelligence-narrative.tsx (811 lines)<br/>'
        '<b>Verdict:</b> Evaluate \u2192 Redesign. Right pattern, wrong complexity.<br/>'
        '<b>Action:</b> Decompose into composable atoms, reduce API surface.',
        bg_color=colors.HexColor('#2e2a1a'), border_color=SEM_WARNING
    ))
    elements.append(spacer(4))
    elements.append(body(
        'The IntelligenceNarrative is the most complex component at 811 lines. It is the core '
        'intelligence delivery vehicle \u2014 a narrative-first, action-terminated, progressive disclosure '
        'surface supporting 6 variants (signal, opportunity, risk, enrichment, reasoning, action) and '
        'L1\u2013L4 progressive disclosure. The concept is perfectly aligned with Design Patterns #1, #3, '
        'and #6. However, the implementation violates Design Pattern #2 (Cognitive Load Reduction): '
        'the component is a monolith that handles too many concerns.'
    ))
    elements.append(body(
        'The redesign plan decomposes IntelligenceNarrative into composable atoms: NarrativeHeader '
        '(L1: headline, confidence, badge, timestamp), NarrativeReasoning (L2: reasoning text, factor '
        'tags), NarrativeEvidence (L3: evidence chain), NarrativeExploration (L4: related signals, '
        'actions), and NarrativeAction (action CTA footer). The composite IntelligenceNarrative '
        'assembles these atoms based on the variant and disclosure level. This decomposition reduces '
        'the component from 811 lines to approximately 5 atoms of 80\u2013120 lines each, plus a '
        '120-line composite. The API surface shrinks from ~25 props to ~8 essential props, with '
        'variant-specific props handled internally by the composite.'
    ))

    # 3.5 ProgressiveDisclosure
    elements.append(h('3.5 ProgressiveDisclosure \u2014 REDESIGN', 2))
    elements.append(callout_box(
        '<b>File:</b> src/components/intelligence-os/progressive-disclosure.tsx (361 lines)<br/>'
        '<b>Verdict:</b> Evaluate \u2192 Redesign. Concept aligns, implementation inconsistent.<br/>'
        '<b>Action:</b> Unify with token system, merge with IntelligenceNarrative pattern.',
        bg_color=colors.HexColor('#2e2a1a'), border_color=SEM_WARNING
    ))
    elements.append(spacer(4))
    elements.append(body(
        'The ProgressiveDisclosure component provides a 4-level progressive disclosure pattern '
        '(L1\u2013L4) with tab-like layer toggles and Framer Motion animations. The concept is perfectly '
        'aligned with Design Pattern #3. However, the implementation uses inline Tailwind colors '
        '(hardcoded hex values like #059669, #f59e0b, #ef4444) instead of the design token system. '
        'This creates a consistency gap with the rest of the Intelligence OS components, which use '
        'design-tokens.ts for all theming.'
    ))
    elements.append(body(
        'The redesign plan has two parts. First, migrate all hardcoded colors to the design token '
        'system (semantic confidence colors, domain variant colors, surface elevations). Second, '
        'evaluate whether ProgressiveDisclosure should remain a standalone component or merge into '
        'the decomposed IntelligenceNarrative pattern. Given that both components implement the same '
        'L1\u2013L4 disclosure model, the preferred approach is to make ProgressiveDisclosure use the same '
        'atomic components (NarrativeHeader, NarrativeReasoning, NarrativeEvidence, NarrativeExploration) '
        'that the redesigned IntelligenceNarrative uses, eliminating the parallel implementation.'
    ))

    # 3.6 RecommendationCard
    elements.append(h('3.6 RecommendationCard \u2014 REDESIGN', 2))
    elements.append(callout_box(
        '<b>File:</b> src/components/intelligence-os/recommendation-card.tsx (524 lines)<br/>'
        '<b>Verdict:</b> Evaluate \u2192 Redesign. Too monolithic, violates separation of concerns.<br/>'
        '<b>Action:</b> Split into data layer and presentation layer.',
        bg_color=colors.HexColor('#2e2a1a'), border_color=SEM_WARNING
    ))
    elements.append(spacer(4))
    elements.append(body(
        'The RecommendationCard displays AI-generated account recommendations with a comprehensive '
        'progressive disclosure structure: header, "Why This Account" section, expandable evidence list, '
        'risk factors, recommended action box, confidence breakdown, enrichment indicators, and stats '
        'footer. The concept serves Design Patterns #1, #3, #6, and #7. However, at 524 lines, the '
        'component violates separation of concerns by fetching its own data from '
        '<font name="JetBrainsMono" size="9">/api/recommendations/${companyId}</font> on mount.'
    ))
    elements.append(body(
        'The redesign plan separates the component into two layers. The data layer (RecommendationData) '
        'is responsible for fetching, normalizing, and caching recommendation data. The presentation '
        'layer (RecommendationCard) is a pure presentation component that receives normalized data as '
        'props and renders using the atomic component library (NarrativeHeader, ConfidenceIndicator, '
        'EvidenceChain, InlineReasoning). This separation enables better testing, independent evolution '
        'of data fetching and presentation, and reusability of the presentation layer with different '
        'data sources.'
    ))

    # 3.7 Component Architecture
    elements.append(h('3.7 Unified Component Architecture', 2))
    elements.append(body(
        'After evaluating and redesigning all six components, the unified component architecture follows '
        'atomic design principles: Design Tokens (single source of truth), Intelligence Atoms (ConfidenceIndicator, '
        'EvidenceChain, InlineReasoning, ActionCTA, StatusBadge), Intelligence Molecules (IntelligenceNarrative, '
        'RecommendationCard, HeroNarrative, IntelligenceBriefing), and Intelligence Organisms (IntelligenceHub, '
        'Market Intelligence, Account Intelligence, Command Center). This architecture ensures consistency, '
        'composability, and testability across all seven experiences.'
    ))

    return elements


# ═══════════════════════════════════════════════════════
# CHAPTER 4: INTERACTION RULES
# ═══════════════════════════════════════════════════════
def chapter_4():
    elements = []
    elements.append(h('Chapter 4: Interaction Rules', 1))
    elements.append(spacer(6))
    elements.append(body(
        'This document defines the interaction rules for the DeepMindQ experience. These rules govern '
        'how components behave, how state transitions work, how users interact with intelligence elements, '
        'and how the system responds to user actions. Every interaction in MS7\u2013MS11 must conform to '
        'these rules. They are derived from the 15 core design patterns and the behavioral psychology '
        'checklist.'
    ))

    # 4.1 Progressive Disclosure Interaction Rules
    elements.append(h('4.1 Progressive Disclosure Interaction Rules', 2))
    elements.append(body(
        'Progressive disclosure is the primary interaction mechanism. It governs how intelligence '
        'is revealed across all four layers. The following rules define the behavior of every '
        'disclosure-enabled component in the system.'
    ))
    elements.append(make_table(
        ['Rule ID', 'Rule', 'Behavior'],
        [
            ['PD-01', 'Independent Level Access',
             'Each L1\u2013L4 level is independently accessible. Users can jump directly to any level without traversing intermediate levels. Clicking "Evidence" on L1 opens L3 directly.'],
            ['PD-02', 'State Persistence',
             'Disclosure state persists within a session. If a user expands L2 on a signal, L2 remains expanded when they return to that signal. State resets on session end.'],
            ['PD-03', 'Animation Consistency',
             'All disclosure transitions use Framer Motion AnimatePresence with 200ms duration and ease-out timing. No spring animations on disclosure. Motion presets from design tokens.'],
            ['PD-04', 'Cognitive Load Gate',
             'No more than 3 expanded disclosure levels visible simultaneously. Expanding a new level auto-collapses the least recently accessed expanded level.'],
            ['PD-05', 'Trust Adaptation',
             'The system tracks which levels a user accesses most frequently and pre-optimizes the rendering pipeline for those levels. Power users who always drill to L3 get faster L3 rendering.'],
        ],
        col_widths=[45, 100, W - 2*MARGIN - 145]
    ))

    # 4.2 Navigation Interaction Rules
    elements.append(h('4.2 Navigation Interaction Rules', 2))
    elements.append(body(
        'Navigation serves Design Pattern #4 (Navigation Intelligence). The navigation does not just '
        'route users between views; it answers the question "What should I focus on next?" through '
        'contextual indicators and attention guidance.'
    ))
    elements.append(make_table(
        ['Rule ID', 'Rule', 'Behavior'],
        [
            ['NAV-01', 'Hub as Default',
             'Every new session starts at the Intelligence Hub. No other experience is the default entry point. Clearing navigation always returns to Hub.'],
            ['NAV-02', 'Attention Indicators',
             'Navigation items show contextual badges when they contain unread intelligence: count badges for signals, priority dots for critical items, pulse animations for urgent items.'],
            ['NAV-03', 'Depth Breadcrumb',
             'When a user drills into a deeper screen within an experience, a breadcrumb trail shows the path: Experience > Section > Detail. Users can navigate back to any level.'],
            ['NAV-04', 'Session Context',
             'Navigation preserves session context. Switching between experiences does not reset the state of other experiences. Each experience maintains its own scroll position, filters, and disclosure states.'],
            ['NAV-05', 'Keyboard Navigation',
             'Full keyboard navigation: Tab between experiences, Enter to select, Escape to return to Hub, number keys 1\u20137 for direct experience access, ? for keyboard shortcut reference.'],
        ],
        col_widths=[45, 100, W - 2*MARGIN - 145]
    ))

    # 4.3 Trust Interaction Rules
    elements.append(h('4.3 Trust Visualization Interaction Rules', 2))
    elements.append(body(
        'Trust visualization governs how confidence, evidence, and reasoning are displayed and '
        'interacted with. These rules ensure that trust-building interactions are consistent, '
        'transparent, and accessible across all experiences.'
    ))
    elements.append(make_table(
        ['Rule ID', 'Rule', 'Behavior'],
        [
            ['TR-01', 'Confidence Always Visible',
             'Every intelligence element displays its confidence score at L1. Confidence is never hidden behind a click or hover. The user sees trust level immediately.'],
            ['TR-02', 'Evidence on Demand',
             'Evidence chains are accessible at L3 via progressive disclosure. Hovering on a confidence score shows a mini confidence breakdown tooltip (Signal Quality, Evidence Quality, etc.).'],
            ['TR-03', 'Source Verification',
             'Every evidence item includes a "Verify" link that opens the original source in a new tab. Sources are never dead-end references; they are always verifiable.'],
            ['TR-04', 'Reasoning Transparency',
             'L2 reasoning is accessible via inline expansion. Positive and negative confidence factors are displayed as factor tags with clear visual distinction (green vs amber).'],
            ['TR-05', 'Freshness Indication',
             'Every intelligence element shows its data freshness: "Updated 2 hours ago" or "Data from 3 days ago". Stale data (>7 days) triggers a visual warning indicator.'],
        ],
        col_widths=[45, 100, W - 2*MARGIN - 145]
    ))

    # 4.4 Error & Empty State Rules
    elements.append(h('4.4 Error and Empty State Interaction Rules', 2))
    elements.append(body(
        'Error and empty states are critical trust moments. Design Pattern #9 (Compassionate Error '
        'Handling) and Design Pattern #14 (Empty State + Success State Experience) govern these '
        'interactions. The system must never leave the user in a dead end.'
    ))
    elements.append(make_table(
        ['Rule ID', 'Rule', 'Behavior'],
        [
            ['ES-01', 'No Dead Ends',
             'Every error state includes a path forward: "Retry", "Use cached data", "Configure data source", or "Contact support". Never show an error without a next step.'],
            ['ES-02', 'Human Error Messages',
             'Error messages explain why in human terms: "We could not analyze this account because the data source has not updated in 14 days." No stack traces, no error codes as primary text.'],
            ['ES-03', 'Empty States Inspire',
             'Empty states describe what the user could do: "No signals detected yet. Connect a data source to start receiving market intelligence." No generic "No data" messages.'],
            ['ES-04', 'Success States Celebrate',
             'Success states acknowledge meaningful outcomes: "3 new signals detected. 2 high-priority actions recommended." Dignified milestone recognition, not confetti or sparkle.'],
            ['ES-05', 'Loading States Inform',
             'Loading states indicate what is being loaded and approximate time: "Analyzing 12 accounts..." with a progress indicator. Skeleton loading for structural preview.'],
        ],
        col_widths=[45, 100, W - 2*MARGIN - 145]
    ))

    # 4.5 State Transition Model
    elements.append(h('4.5 State Transition Model', 2))
    elements.append(body(
        'Every intelligence element in the system follows a consistent state transition model. '
        'Understanding these transitions is essential for implementing smooth, predictable interactions '
        'across all experiences. The model defines six primary states and the transitions between them.'
    ))
    elements.append(make_table(
        ['State', 'Trigger', 'Visual Indicators', 'User Actions Available'],
        [
            ['Loading', 'Component mount, data fetch initiated',
             'Skeleton loading, pulse animation, status text',
             'Wait, cancel request'],
            ['Ready', 'Data received, intelligence computed',
             'Full L1 display with confidence score',
             'View L1, expand L2, dismiss, action'],
            ['Expanded L2', 'User clicks reasoning/expand',
             'L2 reasoning panel with factor tags',
             'View L2, expand L3, collapse to L1'],
            ['Expanded L3', 'User clicks evidence/expand',
             'L3 evidence chain with sources',
             'View L3, verify source, expand L4, collapse'],
            ['Expanded L4', 'User clicks explore/expand',
             'L4 related signals and actions',
             'View L4, navigate to related, collapse'],
            ['Error', 'Data fetch failure, computation error',
             'Error card with human message and next step',
             'Retry, use cache, configure, contact support'],
        ],
        col_widths=[65, 120, 130, W - 2*MARGIN - 315]
    ))

    return elements


# ═══════════════════════════════════════════════════════
# CHAPTER 5: EMOTIONAL COPY LIBRARY
# ═══════════════════════════════════════════════════════
def chapter_5():
    elements = []
    elements.append(h('Chapter 5: Emotional Copy Library', 1))
    elements.append(spacer(6))
    elements.append(body(
        'This document provides the initial Emotional Copy Library for DeepMindQ. It establishes '
        'the tone, voice, and specific copy patterns for all user-facing text in the product. Every '
        'word in the interface carries emotional weight (Design Pattern #8). Error messages acknowledge '
        'frustration before offering solutions. Success states celebrate outcomes, not features. Empty '
        'states inspire possibility, not abandonment. The copy speaks to the human, not the feature.'
    ))

    # 5.1 Voice & Tone Principles
    elements.append(h('5.1 Voice and Tone Principles', 2))
    elements.append(body(
        'The DeepMindQ voice is calm, confident, and precise. It speaks to an executive audience that '
        'values clarity over personality, substance over style, and trust over charm. The voice avoids '
        'hype, exaggeration, and unnecessary enthusiasm. It does not say "Amazing insights detected!" '
        'or "You won\'t believe what we found!" It says "3 high-priority signals detected" and "Here '
        'is what changed and why it matters." The tone adapts to context: neutral for standard '
        'intelligence, urgent for critical signals, supportive for errors, and encouraging for empty states.'
    ))
    elements.append(body(
        'The four voice attributes are: Authoritative but not arrogant (the system presents intelligence '
        'with evidence, not authority), Calm but not cold (the system cares about the user\'s success, '
        'expressed through clarity and helpfulness, not through enthusiasm or emotion), Precise but not '
        'pedantic (the system uses specific language that conveys exact meaning without unnecessary '
        'jargon or over-explanation), and Supportive but not patronizing (the system helps without '
        'telling the user what to do, respects the user\'s intelligence, and assumes competence).'
    ))

    # 5.2 Signal & Intelligence Copy
    elements.append(h('5.2 Signal and Intelligence Copy Patterns', 2))
    elements.append(body(
        'Signals and intelligence elements use structured copy patterns that communicate urgency, '
        'impact, and actionability. The following patterns are locked for MS7\u2013MS11 development.'
    ))
    elements.append(make_table(
        ['Context', 'Copy Pattern', 'Example'],
        [
            ['Critical signal detected',
             '[Entity] [change] [impact]. [Recommended action].',
             'Acme Corp leadership change detected. This may affect your renewal conversation. Consider reaching out to the new VP of Operations within 48 hours.'],
            ['High-priority opportunity',
             '[Entity] shows [opportunity signal]. [Evidence summary]. [Confidence].',
             'Vertex Inc. shows strong buying intent based on 3 recent job postings for your solution category. Confidence: 78% (based on hiring patterns, technology stack match, and budget signals).'],
            ['Risk alert',
             '[Entity] [risk indicator]. [Potential impact]. [Mitigation suggestion].',
             'NovaTech has not engaged in 23 days. Historical patterns suggest 60-day inactivity precedes churn for accounts in this segment. Consider a re-engagement touchpoint.'],
            ['Routine intelligence',
             '[Entity] [update]. [Significance].',
             'DataSync updated their pricing page. Your opportunity score increased by 5 points based on improved budget alignment.'],
        ],
        col_widths=[90, 100, W - 2*MARGIN - 190]
    ))

    # 5.3 Error Copy
    elements.append(h('5.3 Error Message Copy Patterns', 2))
    elements.append(body(
        'Error messages follow the compassionate error handling pattern (Design Pattern #9). Every '
        'error message has three parts: acknowledge the situation, explain why in human terms, and '
        'offer a clear next step. Error messages never use technical jargon as the primary text, never '
        'display stack traces or error codes to the user, and never leave the user without a path forward.'
    ))
    elements.append(make_table(
        ['Error Type', 'Acknowledge', 'Explain', 'Next Step'],
        [
            ['Data fetch failure',
             'We could not load intelligence for this account.',
             'The data source has not updated in 14 days, which may indicate a connectivity issue.',
             'Retry now, or update the data source configuration in Settings.'],
            ['AI computation error',
             'We could not generate a recommendation at this time.',
             'The intelligence engine encountered an unexpected condition while analyzing this account.',
             'Try again in a few minutes, or continue with the last available intelligence.'],
            ['Network timeout',
             'The request took longer than expected.',
             'Your network connection may be slow, or the server is experiencing high demand.',
             'Retry the request, or check your connection status.'],
            ['Permission denied',
             'You do not have access to this intelligence.',
             'This account\'s intelligence is restricted to team members with specific permissions.',
             'Contact your administrator to request access, or explore available intelligence.'],
        ],
        col_widths=[80, 100, 120, W - 2*MARGIN - 300]
    ))

    # 5.4 Empty State Copy
    elements.append(h('5.4 Empty State Copy Patterns', 2))
    elements.append(body(
        'Empty states describe what the user could do, not what is absent. They inspire possibility '
        'and provide clear paths to value. Empty states never use generic "No data" messages and never '
        'make the user feel like they have done something wrong.'
    ))
    elements.append(make_table(
        ['Context', 'Copy Pattern', 'Example'],
        [
            ['No signals',
             'No [type] detected yet. [Action to start receiving intelligence].',
             'No market signals detected yet. Connect a data source to start receiving real-time market intelligence about your target accounts.'],
            ['No recommendations',
             'No recommendations available. [Reason]. [Action].',
             'No recommendations available for this account. We need more engagement data to generate reliable recommendations. Try adding recent interaction history.'],
            ['No search results',
             'No results for "[query]". [Suggestions].',
             'No results for "enterprise AI". Try broader terms like "AI" or "machine learning", or check your filters.'],
            ['No saved views',
             'You have not saved any views yet. [Benefit of saving]. [Action].',
             'You have not saved any views yet. Saved views let you quickly access your preferred intelligence configurations without setting up filters each time. Create your first saved view from any intelligence screen.'],
        ],
        col_widths=[80, 110, W - 2*MARGIN - 190]
    ))

    # 5.5 Success & Milestone Copy
    elements.append(h('5.5 Success and Milestone Copy Patterns', 2))
    elements.append(body(
        'Success states and milestone recognitions follow the enterprise celebration style: dignified, '
        'measured, and meaningful. The system acknowledges achievements with premium milestone '
        'recognition, never with confetti, sparkle, or flashy animations. Milestones are recognized '
        'because they represent genuine business outcomes, not because the user clicked a button.'
    ))
    elements.append(make_table(
        ['Milestone Type', 'Recognition Copy', 'Visual Treatment'],
        [
            ['First intelligence-driven deal',
             'Your first intelligence-driven deal has been identified. The signal that led to this opportunity was detected on [date].',
             'Dignified toast notification with timeline reference. Optional log entry in Workspace.'],
            ['Streak: 7 consecutive days',
             '7 days of consistent intelligence review. Your engagement pattern suggests strong signal awareness.',
             'Subtle counter in the Hub header. No animation.'],
            ['High-confidence prediction validated',
             'A prediction with 85%+ confidence has been validated by real-world outcomes. This reinforces the reliability of your intelligence signals.',
             'Brief mention in the daily briefing with reference to the original prediction.'],
            ['Account intelligence complete',
             'All intelligence sources for [Account] are active and reporting. Full situational awareness is available.',
             'Status indicator change in Account Intelligence view. Green completion badge.'],
        ],
        col_widths=[100, 150, W - 2*MARGIN - 250]
    ))

    # 5.6 Action & CTA Copy
    elements.append(h('5.6 Action and CTA Copy Patterns', 2))
    elements.append(body(
        'Action labels and CTA copy follow specific patterns. Actions are verbs that describe what '
        'the user will accomplish, not what the system will do. The user engages an account, the '
        'system does not. The user prepares for a meeting, the system does not. This distinction '
        'reinforces the "Intelligence as Executive Briefing" philosophy: the user is the decision-maker.'
    ))
    elements.append(make_table(
        ['Action Type', 'Label Pattern', 'Examples'],
        [
            ['Primary action', 'Verb + Object',
             'Engage Account, Prepare Briefing, View Evidence, Review Signals'],
            ['Secondary action', 'Verb + Detail',
             'See Full Reasoning, Expand Evidence, View Related Signals'],
            ['Tertiary action', 'Object + Management',
             'Save to Workspace, Dismiss Signal, Share Intelligence'],
            ['Destructive action', 'Confirm + Consequence',
             'Remove Source (intelligence from this source will be removed), Clear History (this action cannot be undone)'],
        ],
        col_widths=[85, 100, W - 2*MARGIN - 185]
    ))

    return elements


# ═══════════════════════════════════════════════════════
# BUILD DOCUMENT
# ═══════════════════════════════════════════════════════

def build_cover_html():
    """Generate cover HTML for Template 01 (HUD Data Terminal)"""
    html = '''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=793.7, height=1122.5">
<title>DeepMindQ MS6 — Supporting Documentation</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
@page { size: 793.7px 1122.5px; margin: 0; }
html, body { margin: 0; padding: 0; width: 793.7px; height: 1122.5px; background: #121211; }
.cover-bg { position: absolute; inset: 0; overflow: hidden; z-index: 1; }
.cover-grid {
  position: absolute; inset: 0;
  background-image:
    linear-gradient(rgba(219,191,106,0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(219,191,106,0.03) 1px, transparent 1px);
  background-size: 50px 50px;
}
.cover-anchor {
  position: absolute; left: 95px; top: 100px; bottom: 112px;
  width: 6px; background: #dbbf6a; z-index: 2;
}
.cover-content {
  position: absolute; inset: 0; z-index: 3;
  padding: 140px 60px 112px 130px;
  display: flex; flex-direction: column; justify-content: center;
}
.kicker { font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 400;
  letter-spacing: 4px; text-transform: uppercase; color: rgba(219,191,106,0.5); margin-bottom: 40px; }
.hero { font-family: 'Inter', sans-serif; font-size: 48px; font-weight: 800;
  color: #eeedec; line-height: 1.1; margin-bottom: 30px; max-width: 520px; }
.hero span { color: #dbbf6a; }
.summary { font-family: 'Inter', sans-serif; font-size: 15px; font-weight: 300;
  color: rgba(238,237,236,0.7); line-height: 1.65; max-width: 480px; margin-bottom: 50px; }
.meta { font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 400;
  color: rgba(146,143,137,0.6); }
.meta-line { margin-bottom: 6px; }
.footer { font-family: 'Inter', sans-serif; font-size: 11px; font-weight: 400;
  letter-spacing: 3px; text-transform: uppercase; color: rgba(146,143,137,0.35);
  margin-top: 80px; }
</style>
</head>
<body>
<div class="cover-bg"><div class="cover-grid"></div></div>
<div class="cover-anchor"></div>
<div class="cover-content">
  <div class="kicker">DeepMindQ CRM &middot; MS6 Design Foundation</div>
  <div class="hero">Complete <span>Supporting</span> Documentation</div>
  <div class="summary">
    Five comprehensive design documents establishing the UX philosophy, information architecture,
    component specifications, interaction rules, and emotional copy library for the DeepMindQ
    CRM platform. Locked foundation for MS7 through MS11 development.
  </div>
  <div class="meta">
    <div class="meta-line">UX Philosophy &middot; Information Architecture &middot; Component Specifications</div>
    <div class="meta-line">Interaction Rules &middot; Emotional Copy Library</div>
    <div class="meta-line" style="margin-top:16px;">Version 1.0 &middot; MS6 Stage 1 &middot; Confidential</div>
  </div>
  <div class="footer">DeepMindQ CRM &middot; Internal Design Documentation</div>
</div>
</body>
</html>'''
    cover_path = '/home/z/my-project/download/slides/ms6_cover.html'
    with open(cover_path, 'w') as f:
        f.write(html)
    return cover_path


def main():
    # 1. Build cover
    cover_html = build_cover_html()

    # 2. Build body PDF
    from reportlab.platypus import SimpleDocTemplate, BaseDocTemplate, PageTemplate, Frame
    from reportlab.lib.units import inch

    # Create body PDF with dark pages
    body_path = '/home/z/my-project/download/slides/ms6_body.pdf'

    # Custom page background function
    def draw_page_bg(canvas, doc):
        canvas.saveState()
        canvas.setFillColor(PAGE_BG)
        canvas.rect(0, 0, W, H, fill=True, stroke=False)
        # Footer line
        canvas.setStrokeColor(BORDER)
        canvas.setLineWidth(0.5)
        canvas.line(MARGIN, 40, W - MARGIN, 40)
        # Footer text
        canvas.setFont('JetBrainsMono', 7)
        canvas.setFillColor(TEXT_MUTED)
        canvas.drawString(MARGIN, 28, 'DeepMindQ CRM \u00b7 MS6 Design Foundation \u00b7 Confidential')
        canvas.drawRightString(W - MARGIN, 28, f'Page {doc.page}')
        canvas.restoreState()

    frame = Frame(MARGIN, 55, W - 2*MARGIN, H - 55 - 40, id='body')
    template = PageTemplate(id='body', frames=[frame], onPage=draw_page_bg)

    doc = BaseDocTemplate(body_path, pagesize=A4,
                          title='DeepMindQ MS6 Supporting Documentation',
                          author='DeepMindQ Design Team',
                          creator='DeepMindQ Design System')
    doc.addPageTemplates([template])

    # Build story
    story = []

    # TOC
    toc = TableOfContents()
    toc.levelStyles = [styles['toc_h1'], styles['toc_h2']]
    story.append(h('Table of Contents', 1))
    story.append(spacer(8))
    story.append(toc)
    story.append(PageBreak())

    # Chapters
    story.extend(chapter_1())
    story.append(PageBreak())
    story.extend(chapter_2())
    story.append(PageBreak())
    story.extend(chapter_3())
    story.append(PageBreak())
    story.extend(chapter_4())
    story.append(PageBreak())
    story.extend(chapter_5())

    # Build with TOC (use multiBuild for TOC)
    class TocDoc(BaseDocTemplate):
        def afterFlowable(self, flowable):
            if hasattr(flowable, 'bookmark_name'):
                level = getattr(flowable, 'bookmark_level', 0)
                text = getattr(flowable, 'bookmark_text', '')
                key = getattr(flowable, 'bookmark_key', '')
                self.notify('TOCEntry', (level, text, self.page, key))

    doc2 = TocDoc(body_path, pagesize=A4,
                   title='DeepMindQ MS6 Supporting Documentation',
                   author='DeepMindQ Design Team',
                   creator='DeepMindQ Design System')
    doc2.addPageTemplates([template])
    doc2.multiBuild(story)

    # 3. Merge cover + body
    import subprocess
    # Convert cover HTML to PDF
    subprocess.run([
        'node', f'{PDF_SKILL_DIR}/scripts/html2poster.js',
        cover_html, '--output', '/home/z/my-project/download/slides/ms6_cover.pdf',
        '--width', '793.7px'
    ], check=True, capture_output=True)

    # Merge cover + body
    import pypdf
    cover_pdf = pypdf.PdfReader('/home/z/my-project/download/slides/ms6_cover.pdf')
    body_pdf = pypdf.PdfReader(body_path)
    writer = pypdf.PdfWriter()
    writer.append_pages_from_reader(cover_pdf)
    writer.append_pages_from_reader(body_pdf)
    with open(OUTPUT, 'wb') as f:
        writer.write(f)

    print(f'PDF generated: {OUTPUT}')
    print(f'Cover: {len(cover_pdf.pages)} page(s)')
    print(f'Body: {len(body_pdf.pages)} page(s)')
    print(f'Total: {len(cover_pdf.pages) + len(body_pdf.pages)} page(s)')


if __name__ == '__main__':
    main()
