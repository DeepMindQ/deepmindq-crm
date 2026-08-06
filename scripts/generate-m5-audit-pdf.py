#!/usr/bin/env python3
"""
DeepMindQ Enterprise Intelligence Platform - M5 Enterprise Readiness Audit
Comprehensive PDF Report Generator

Structure: Cover + TOC + 14 chapters (Exec Summary + 8 Domains + WOW + Competitive + Roadmap + Positioning)
"""

import os, sys, hashlib, subprocess, tempfile
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, inch, cm
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY, TA_RIGHT
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether, HRFlowable, CondPageBreak
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily

# ─── Paths ──────────────────────────────────────────────
PDF_SKILL_DIR = os.path.expanduser('/home/z/my-project/skills/pdf')
FONT_DIR = '/usr/share/fonts'
OUTPUT_BODY = '/tmp/m5-audit-body.pdf'
OUTPUT_COVER = '/tmp/m5-audit-cover.pdf'
OUTPUT_FINAL = '/home/z/my-project/download/DeepMindQ_M5_Enterprise_Readiness_Audit.pdf'

# ─── Register Fonts ─────────────────────────────────────
pdfmetrics.registerFont(TTFont('NotoSerifSC', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('NotoSerifSC-Bold', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Bold.ttf'))
registerFontFamily('NotoSerifSC', normal='NotoSerifSC', bold='NotoSerifSC-Bold')
# Fallback
pdfmetrics.registerFont(TTFont('NotoSansSC', f'{FONT_DIR}/truetype/chinese/NotoSansSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('NotoSansSC-Bold', f'{FONT_DIR}/truetype/chinese/NotoSansSC-Bold.ttf'))

def install_font_fallback():
    from reportlab.pdfbase.pdfmetrics import _fonts
    if 'NotoSansSC' not in _fonts:
        pdfmetrics.registerFont(TTFont('NotoSansSC', f'{FONT_DIR}/truetype/chinese/NotoSansSC-Regular.ttf'))
    if 'NotoSansSC-Bold' not in _fonts:
        pdfmetrics.registerFont(TTFont('NotoSansSC-Bold', f'{FONT_DIR}/truetype/chinese/NotoSansSC-Bold.ttf'))

install_font_fallback()

# ━━ Cascade Palette ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
from reportlab.lib import colors as _c
PAGE_BG       = _c.HexColor('#f5f5f4')
SECTION_BG    = _c.HexColor('#f2f2f0')
CARD_BG       = _c.HexColor('#eae9e6')
TABLE_STRIPE  = _c.HexColor('#f2f2ef')
HEADER_FILL   = _c.HexColor('#534a2f')
COVER_BLOCK   = _c.HexColor('#696046')
BORDER        = _c.HexColor('#c7bea3')
ICON          = _c.HexColor('#7d6c3b')
ACCENT        = _c.HexColor('#a9892b')
ACCENT_2      = _c.HexColor('#5b37c8')
TEXT_PRIMARY   = _c.HexColor('#21201e')
TEXT_MUTED     = _c.HexColor('#84827a')
SEM_SUCCESS   = _c.HexColor('#4a7d5b')
SEM_WARNING   = _c.HexColor('#a68646')
SEM_ERROR     = _c.HexColor('#9d4c44')
SEM_INFO      = _c.HexColor('#3f6891')

# ─── Styles ──────────────────────────────────────────────
styles = {}

def init_styles():
    s = styles
    s['body'] = ParagraphStyle('body', fontName='NotoSerifSC', fontSize=10, leading=16,
        alignment=TA_JUSTIFY, textColor=TEXT_PRIMARY, spaceAfter=6)
    s['body_small'] = ParagraphStyle('body_small', fontName='NotoSerifSC', fontSize=9, leading=14,
        alignment=TA_JUSTIFY, textColor=TEXT_PRIMARY, spaceAfter=4)
    s['h1'] = ParagraphStyle('h1', fontName='NotoSerifSC-Bold', fontSize=20, leading=26,
        textColor=HEADER_FILL, spaceBefore=16, spaceAfter=10)
    s['h2'] = ParagraphStyle('h2', fontName='NotoSerifSC-Bold', fontSize=14, leading=20,
        textColor=ACCENT, spaceBefore=12, spaceAfter=6)
    s['h3'] = ParagraphStyle('h3', fontName='NotoSerifSC-Bold', fontSize=11.5, leading=16,
        textColor=TEXT_PRIMARY, spaceBefore=8, spaceAfter=4)
    s['kicker'] = ParagraphStyle('kicker', fontName='NotoSerifSC', fontSize=8.5, leading=12,
        textColor=TEXT_MUTED, spaceAfter=3)
    s['quote'] = ParagraphStyle('quote', fontName='NotoSerifSC', fontSize=10, leading=15,
        textColor=ICON, leftIndent=20, rightIndent=12, spaceBefore=6, spaceAfter=8,
        borderPadding=6)
    s['table_header'] = ParagraphStyle('table_header', fontName='NotoSerifSC-Bold', fontSize=8.5,
        leading=11, textColor=_c.white, alignment=TA_LEFT)
    s['table_cell'] = ParagraphStyle('table_cell', fontName='NotoSerifSC', fontSize=8.5,
        leading=12, textColor=TEXT_PRIMARY, alignment=TA_LEFT)
    s['table_cell_bold'] = ParagraphStyle('table_cell_bold', fontName='NotoSerifSC-Bold', fontSize=8.5,
        leading=12, textColor=TEXT_PRIMARY, alignment=TA_LEFT)
    s['table_cell_small'] = ParagraphStyle('table_cell_small', fontName='NotoSerifSC', fontSize=7.5,
        leading=10, textColor=TEXT_PRIMARY, alignment=TA_LEFT)
    s['footer'] = ParagraphStyle('footer', fontName='NotoSerifSC', fontSize=8, leading=10,
        textColor=TEXT_MUTED, alignment=TA_CENTER)
    s['meta'] = ParagraphStyle('meta', fontName='NotoSerifSC', fontSize=9, leading=13,
        textColor=TEXT_MUTED, spaceAfter=3)
    s['toc_h0'] = ParagraphStyle('toc_h0', fontName='NotoSerifSC-Bold', fontSize=12, leading=20,
        textColor=HEADER_FILL, leftIndent=0)
    s['toc_h1'] = ParagraphStyle('toc_h1', fontName='NotoSerifSC', fontSize=10, leading=17,
        textColor=TEXT_PRIMARY, leftIndent=20)
    s['callout_text'] = ParagraphStyle('callout_text', fontName='NotoSerifSC', fontSize=9.5, leading=14,
        textColor=TEXT_PRIMARY, alignment=TA_LEFT)
    s['callout_title'] = ParagraphStyle('callout_title', fontName='NotoSerifSC-Bold', fontSize=10, leading=14,
        textColor=HEADER_FILL)

init_styles()

PAGE_W, PAGE_H = A4
MARGIN = 55
USABLE_W = PAGE_W - 2 * MARGIN

# ─── Helpers ─────────────────────────────────────────────
def P(text, style='body'):
    return Paragraph(str(text), styles.get(style, styles['body']))

def sp(h=6):
    return Spacer(1, h)

def hr():
    return HRFlowable(width='100%', thickness=0.5, color=BORDER, spaceAfter=8, spaceBefore=4)

def priority_badge(p):
    """Return colored priority badge."""
    p = str(p).strip()
    color_map = {'P0': SEM_ERROR, 'P1': SEM_WARNING, 'P2': SEM_INFO}
    c = color_map.get(p, TEXT_MUTED)
    return Paragraph(f'<font color="{c.hexval()}"><b>{p}</b></font>', styles['table_cell'])

def status_icon(s):
    """Return status indicator."""
    if s in ('Complete', 'Ready'):
        return Paragraph(f'<font color="{SEM_SUCCESS.hexval()}">Complete</font>', styles['table_cell'])
    elif 'Gap' in s or 'Missing' in s:
        return Paragraph(f'<font color="{SEM_ERROR.hexval()}">Gap</font>', styles['table_cell'])
    return P(s, 'table_cell')

def make_table(headers, rows, col_widths=None, font_size='table_cell'):
    """Create a styled table with header and alternating rows."""
    if col_widths is None:
        col_widths = [USABLE_W / len(headers)] * len(headers)
    header_cells = [P(h, 'table_header') for h in headers]
    row_cells = []
    for row in rows:
        row_cells.append([P(str(c), font_size) if not isinstance(c, Paragraph) else c for c in row])
    data = [header_cells] + row_cells
    t = Table(data, colWidths=col_widths, repeatRows=1)
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), HEADER_FILL),
        ('TEXTCOLOR', (0, 0), (-1, 0), _c.white),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]
    for i in range(1, len(data)):
        bg = TABLE_STRIPE if i % 2 == 0 else _c.white
        style_cmds.append(('BACKGROUND', (0, i), (-1, i), bg))
    t.setStyle(TableStyle(style_cmds))
    return t

def callout_box(text, title=None):
    """Callout/blockquote box with left accent border."""
    inner = []
    if title:
        inner.append(P(f'<b>{title}</b>', 'callout_title'))
    inner.append(P(text, 'callout_text'))
    t = Table([[inner]], colWidths=[USABLE_W - 10])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), CARD_BG),
        ('BOX', (0, 0), (-1, -1), 0.5, BORDER),
        ('LEFTPADDING', (0, 0), (-1, -1), 14),
        ('RIGHTPADDING', (0, 0), (-1, -1), 12),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('LINEAFTER', (0, 0), (0, -1), 3, ACCENT),
    ]))
    return t

def compact_assessment(cap, tech, gap, wow, diff, priority, effort=None):
    """Compact single-row capability assessment table."""
    headers = ['Dimension', 'Assessment']
    rows = [
        ['Technical Maturity', tech],
        ['Gap', gap],
        ['Customer WOW', wow],
        ['Competitive Diff.', diff],
        ['Priority', priority],
    ]
    if effort:
        rows.append(['Effort', effort])
    return make_table(headers, rows, col_widths=[120, USABLE_W - 120], font_size='table_cell_small')

# ─── TOC Template ──────────────────────────────────────
class TocDocTemplate(SimpleDocTemplate):
    def __init__(self, *args, **kwargs):
        SimpleDocTemplate.__init__(self, *args, **kwargs)
        self._page_count_offset = 0

    def afterFlowable(self, flowable):
        if hasattr(flowable, 'bookmark_name'):
            level = getattr(flowable, 'bookmark_level', 0)
            text = getattr(flowable, 'bookmark_text', '')
            key = getattr(flowable, 'bookmark_key', '')
            self.notify('TOCEntry', (level, text, self.page, key))

def add_heading(text, style='h1', level=0):
    key = f'h_{hashlib.md5(text.encode()).hexdigest()[:8]}'
    p = Paragraph(f'<a name="{key}"/>{text}', styles[style])
    p.bookmark_name = key
    p.bookmark_level = level
    p.bookmark_text = text
    p.bookmark_key = key
    return p

def page_footer(canvas, doc):
    """Page number and footer line."""
    canvas.saveState()
    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.5)
    canvas.line(MARGIN, 35, PAGE_W - MARGIN, 35)
    canvas.setFont('NotoSerifSC', 8)
    canvas.setFillColor(TEXT_MUTED)
    canvas.drawCentredString(PAGE_W / 2, 22, f'DeepMindQ M5 Enterprise Readiness Audit  |  Page {doc.page}')
    canvas.restoreState()

def page_first(canvas, doc):
    """No footer on first body page."""
    pass

# ═══════════════════════════════════════════════════════════
# CONTENT SECTIONS
# ═══════════════════════════════════════════════════════════

def build_executive_summary(story):
    story.append(add_heading('1  Executive Summary', 'h1', 0))

    story.append(callout_box(
        '"If a Fortune 500 executive sees this platform, will they immediately understand that this is not another CRM, but a new Enterprise Intelligence category?"',
        'The Core Question'
    ))
    story.append(sp(6))
    story.append(P(
        'DeepMindQ possesses <b>the deepest AI reasoning infrastructure of any platform at this stage</b> — '
        '6-signal hybrid retrieval, 16-entity knowledge graph, 4-layer memory, 7-composable AI engines, '
        'evidence-backed explainability, and hallucination prevention. No CRM product has any of this. '
        'Most enterprise AI platforms have one or two.'
    ))
    story.append(P(
        '<b>However</b>, the platform currently presents itself as a sophisticated engineering system, '
        'not an enterprise intelligence product. The gap is not in capabilities — it is in '
        '<b>experience layer, data credibility, and product narrative</b>.'
    ))
    story.append(sp(4))
    story.append(P('<b>Answer: Almost — But Not Yet</b>', 'callout_text'))
    story.append(sp(6))

    # Platform Readiness Score Table
    story.append(add_heading('Platform Readiness Score', 'h2', 1))
    readiness_headers = ['Domain', 'Tech Maturity', 'Enterprise Exp.', 'Gap to Enterprise', 'Readiness']
    readiness_rows = [
        ['1. Company Intelligence', '55%', '30%', 'Data credibility, unified profile UX', '<b>40%</b>'],
        ['2. Contact Intelligence', '65%', '35%', 'Merge resolution, unified score', '<b>48%</b>'],
        ['3. Revenue Intelligence', '78%', '40%', 'Dollar-denominated, evidence UX', '<b>55%</b>'],
        ['4. Communication Intelligence', '93%', '55%', 'Meeting intel productization', '<b>70%</b>'],
        ['5. Knowledge Intelligence', '96%', '45%', 'Enterprise search experience', '<b>65%</b>'],
        ['6. AI Reasoning Platform', '95%', '25%', 'Governance hidden, not exposed', '<b>50%</b>'],
        ['7. Autonomous Agents', '70%', '10%', 'Zero customer-ready experiences', '<b>35%</b>'],
        ['8. Recommendation Intelligence', '83%', '40%', 'Decision intel narrative', '<b>55%</b>'],
        ['<b>OVERALL</b>', '<b>79%</b>', '<b>35%</b>', '<b>Experience layer is the critical gap</b>', '<b>52%</b>'],
    ]
    story.append(make_table(readiness_headers, readiness_rows,
        col_widths=[130, 68, 72, 160, 60]))
    story.append(sp(8))

    # Fundamental Insight
    story.append(add_heading('The Fundamental Insight', 'h2', 1))
    insight_headers = ['Dimension', 'Assessment']
    insight_rows = [
        ['What DeepMindQ HAS', 'The most sophisticated AI reasoning infrastructure of any sub-enterprise platform. '
         '7 composable engines, 6-signal hybrid retrieval, knowledge graph, 4-layer memory, agent framework, '
         'evidence framework, hallucination prevention, explainability.'],
        ['What DeepMindQ LACKS', 'The experience layer that converts technology into enterprise-grade product moments. '
         'The data credibility that makes intelligence trustworthy. The narrative that positions this as '
         '"Enterprise Intelligence OS" not "AI CRM."'],
        ['The Gap', '<b>44 percentage points</b> between technical maturity (79%) and enterprise experience (35%). '
         'The technology exists. The product does not yet.'],
        ['M5 Mission', 'Close this 44-point gap. Not by building more features. By converting existing capabilities '
         'into enterprise experiences, adding data credibility, and exposing AI infrastructure as product differentiation.'],
    ]
    story.append(make_table(insight_headers, insight_rows, col_widths=[110, USABLE_W - 110]))


def build_domain1(story):
    story.append(add_heading('2  Domain 1: Company Intelligence', 'h1', 0))
    story.append(callout_box(
        '"Can DeepMindQ deeply understand any company and explain why that company matters?"',
        'Key Question'
    ))
    story.append(sp(6))

    # Compact capability assessment table
    headers = ['Capability', 'Gap', 'WOW', 'Differentiation', 'Priority']
    rows = [
        ['1.1 Company Understanding', 'Data not unified into single intelligence profile; API exists but is data dump, not executive narrative', 'Medium', 'Strong', priority_badge('P0')],
        ['1.2 Intelligence Profile', 'Missing: Industry Position, Growth trajectory, Leadership Change, Competitive Landscape in brief', 'High', 'Unique', priority_badge('P0')],
        ['1.3 Enrichment', '#1 credibility gap: all enrichment is AI-estimated, no external data provider integration', 'Low', 'Commodity', priority_badge('P0')],
        ['1.4 ICP Intelligence', 'No ICP effectiveness measurement, no drift detection, no industry taxonomy', 'Medium', 'Strong', priority_badge('P1')],
        ['1.5 Industry Intelligence', 'No industry classification taxonomy; free-text field with basic normalization', 'Low', 'Commodity', priority_badge('P1')],
        ['1.6 Technology Intelligence', 'All tech detection is LLM-estimated; no Wappalyzer/BuiltWith integration', 'Medium', 'Strong', priority_badge('P1')],
        ['1.7 Financial Intelligence', 'No distinction between known and estimated financial data; violates redesign principle', 'Medium', 'Unique', priority_badge('P0')],
        ['1.8 Competitive Intelligence', 'No competitor registry model; ad-hoc extraction, no persistent tracking', 'Medium', 'Commodity', priority_badge('P1')],
        ['1.9 Opportunity Intelligence', 'Opportunity detection scattered across multiple APIs, no unified view', 'High', 'Unique', priority_badge('P0')],
    ]
    story.append(make_table(headers, rows, col_widths=[88, 170, 42, 62, 38], font_size='table_cell_small'))


def build_domain2(story):
    story.append(add_heading('3  Domain 2: Contact Intelligence', 'h1', 0))
    story.append(callout_box(
        '"Can DeepMindQ identify the right people, understand their influence, and recommend engagement strategy?"',
        'Key Question'
    ))
    story.append(sp(6))
    headers = ['Capability', 'Gap', 'WOW', 'Differentiation', 'Priority']
    rows = [
        ['2.1 Identity Resolution', 'Detection without resolution; no merge workflow, no survivorship rules', 'Low', 'Commodity', priority_badge('P1')],
        ['2.2 Role Intelligence', 'Two incompatible scoring systems (0-25 vs 0-100) producing different scores', 'Low', 'Commodity', priority_badge('P1')],
        ['2.3 Influence Scoring', 'Network scoring simplistic; title-based without company-size context', 'Medium', 'Strong', priority_badge('P2')],
        ['2.4 Buying Authority', 'Purely title-based; no budget authority or procurement detection', 'Medium', 'Commodity', priority_badge('P2')],
        ['2.5 Buying Committee Map', 'Engine produces exact data; gap is presentation (JSON API, not visual map)', 'Transformational', 'Unique', priority_badge('P0')],
        ['2.6 Engagement Intelligence', 'totalOpens/clicks hardcoded to 0; engine operates on fabricated data', 'High', 'Unique', priority_badge('P0')],
        ['2.7 Comm. Preferences', 'No learning system; static heuristics, not learned from behavior', 'Medium', 'Strong', priority_badge('P1')],
    ]
    story.append(make_table(headers, rows, col_widths=[88, 170, 56, 56, 38], font_size='table_cell_small'))


def build_domain3(story):
    story.append(add_heading('4  Domain 3: Revenue Intelligence', 'h1', 0))
    story.append(callout_box(
        '"Can DeepMindQ explain where revenue opportunity exists, why now, and what action should happen?"',
        'Key Question'
    ))
    story.append(sp(4))
    story.append(P('<b>Critical Principle:</b> Do NOT evaluate as traditional CRM forecasting. The goal is evidence-based opportunity intelligence.', 'body_small'))
    story.append(sp(4))
    headers = ['Capability', 'Gap', 'WOW', 'Differentiation', 'Priority']
    rows = [
        ['3.1 Account Scoring', 'Strategic fit uses hardcoded industry lists; no deal-level revenue contribution', 'Medium', 'Strong', priority_badge('P2')],
        ['3.2 Buying Signals', 'No web behavior intent signals; engagement dimension is thin', 'Medium', 'Strong', priority_badge('P2')],
        ['3.3 Evidence-Based Opportunity', 'No estimatedValue field on Pursuit model; forecasting is count-based, not dollar-based', 'High', 'Unique', priority_badge('P0')],
        ['3.4 Deal Risk', 'Risk logic duplicated across 3 routes; no signal-based risk detection', 'Medium', 'Strong', priority_badge('P2')],
        ['3.5 Forecasting Framework', 'All projections count-based; no dollar amounts, no seasonality, no accuracy tracking', 'High', 'Unique', priority_badge('P0')],
        ['3.6 Revenue Recommendations', 'No feedback loop integration; no per-rep personalization', 'Medium', 'Strong', priority_badge('P2')],
    ]
    story.append(make_table(headers, rows, col_widths=[95, 170, 48, 55, 38], font_size='table_cell_small'))


def build_domain4(story):
    story.append(add_heading('5  Domain 4: Communication Intelligence', 'h1', 0))
    story.append(callout_box(
        '"Can DeepMindQ understand business conversations and improve decisions?"',
        'Key Question'
    ))
    story.append(sp(6))
    headers = ['Capability', 'Gap', 'WOW', 'Differentiation', 'Priority']
    rows = [
        ['4.1 Email Intelligence', 'None significant. Production-hardened.', 'High', 'Unique', status_icon('Complete')],
        ['4.2 Conversation Intelligence', 'API exists, not productized as one-click meeting prep experience', 'Transformational', 'Unique', priority_badge('P0')],
        ['4.3 Reply Understanding', 'None significant. Production-hardened.', 'Medium', 'Strong', status_icon('Complete')],
        ['4.4 Intent Extraction', 'None significant.', 'High', 'Strong', status_icon('Complete')],
        ['4.5 Personalization', 'None significant.', 'High', 'Unique', status_icon('Complete')],
        ['4.6 Next-Best-Action', 'Presentation gap; recommendations as decision intelligence experience, not data list', 'Transformational', 'Unique', priority_badge('P0')],
        ['4.7 Communication Learning', 'Feedback captured but does not close loop to model improvement', 'Medium', 'Unique', priority_badge('P1')],
        ['4.8 Sentiment Detection', 'Basic keyword matching; no dedicated sentiment engine', 'Low', 'Commodity', priority_badge('P2')],
    ]
    story.append(make_table(headers, rows, col_widths=[88, 170, 56, 55, 48], font_size='table_cell_small'))


def build_domain5(story):
    story.append(add_heading('6  Domain 5: Knowledge Intelligence', 'h1', 0))
    story.append(callout_box(
        '"Can DeepMindQ become the organization\'s intelligence memory?"',
        'Key Question'
    ))
    story.append(sp(6))
    headers = ['Capability', 'Gap', 'WOW', 'Differentiation', 'Priority']
    rows = [
        ['5.1 Document Ingestion', 'None significant. Production-hardened. 8-step pipeline with SHA-256 dedup.', 'Medium', 'Strong', status_icon('Complete')],
        ['5.2 Semantic Chunking', 'Fixed 800-word windows degrade retrieval quality for structured docs', 'Medium', 'Strong', priority_badge('P1')],
        ['5.3 Retrieval (Crown Jewel)', 'BM25 in-process (not dedicated index); entity extraction rule-based. Architecture exceptional.', 'High', 'Unique', priority_badge('P0')],
        ['5.4 Knowledge Graph', 'None significant. 16 entity types, 30+ relationship types. Genuine differentiator.', 'Transformational', 'Unique', priority_badge('P0')],
        ['5.5 Memory System', 'None significant. 4-layer hierarchy beyond typical enterprise platforms.', 'High', 'Unique', priority_badge('P0')],
        ['5.6 Enterprise Search', 'No unified "ask anything" endpoint; components exist but are not composed', 'Transformational', 'Unique', priority_badge('P0')],
    ]
    story.append(make_table(headers, rows, col_widths=[90, 168, 56, 52, 48], font_size='table_cell_small'))


def build_domain6(story):
    story.append(add_heading('7  Domain 6: AI Reasoning Platform', 'h1', 0))
    story.append(callout_box(
        '"Can an enterprise trust DeepMindQ\'s AI decisions?"',
        'Key Question'
    ))
    story.append(sp(6))
    headers = ['Capability', 'Gap', 'WOW', 'Differentiation', 'Priority']
    rows = [
        ['6.1 AI Governance', '1,524 lines of governance is internal engineering, not exposed as product feature', 'Transformational', 'Unique', priority_badge('P0')],
        ['6.2 Model Routing', 'None significant. Multi-provider routing with fallback chains.', 'Low', 'Strong', status_icon('Complete')],
        ['6.3 Confidence Scoring', 'Weights are static; no ML calibration. But production-grade.', 'High', 'Unique', priority_badge('P0')],
        ['6.4 Hallucination Prevention', 'Claim extraction uses keyword matching, not NLP. But two-layer defense is effective.', 'High', 'Unique', priority_badge('P0')],
        ['6.5 Explainability', '1,392-line intelligence trail exists as API but not surfaced in UI', 'Transformational', 'Unique', priority_badge('P0')],
        ['6.6 Agent Framework', '2,874 lines architecturally complete but produces zero customer-ready experiences', 'Transformational', 'Unique', priority_badge('P0')],
        ['6.7 AI Evaluation', '2,006 lines. CI-integrated quality gate not running.', 'Low', 'Unique', priority_badge('P1')],
        ['6.8 Prompt Management', 'Framework built but unused; only 4 of 85+ prompts migrated', 'Low', 'Strong', priority_badge('P1')],
    ]
    story.append(make_table(headers, rows, col_widths=[90, 168, 56, 52, 48], font_size='table_cell_small'))


def build_domain7(story):
    story.append(add_heading('8  Domain 7: Autonomous Intelligence Agents', 'h1', 0))
    story.append(callout_box(
        '"Are these only frameworks, or are they customer-ready experiences?"',
        'Key Question'
    ))
    story.append(sp(6))
    story.append(P(
        'The agent framework (2,874 lines) defines <i>how</i> agents work, but no business-specific agents are implemented. '
        'The autonomous monitor exists but generates alerts, not agent-driven workflows. '
        'The gap between framework and experience is massive.'
    ))
    story.append(sp(6))

    story.append(add_heading('Agent Readiness Matrix', 'h2', 1))
    agent_headers = ['Agent', 'Framework', 'Business Logic', 'Trigger', 'Output', 'Schedule', 'Ready?']
    agent_rows = [
        ['Account Intelligence', 'Yes', 'Yes', 'Manual', 'Alert JSON', 'No', 'No'],
        ['Research Agent', 'Yes', 'Yes', 'Manual', 'Brief JSON', 'No', 'No'],
        ['Sales Intelligence', 'Yes', 'Yes', 'No', 'No', 'No', 'No'],
        ['Opportunity Agent', 'Yes', 'Partial', 'No', 'No', 'No', 'No'],
        ['Knowledge Agent', 'Yes', 'Yes', 'No', 'No', 'No', 'No'],
    ]
    story.append(make_table(agent_headers, agent_rows,
        col_widths=[90, 55, 68, 55, 65, 55, 42], font_size='table_cell_small'))
    story.append(sp(6))
    story.append(P(
        '<b>Assessment:</b> Framework and business logic exist for 4 of 5 agents. Missing pieces are: scheduling, '
        'trigger automation, output formatting as user experiences, and notification delivery. '
        'The core intelligence work is done — the product layer is missing.'
    ))


def build_domain8(story):
    story.append(add_heading('9  Domain 8: Recommendation Intelligence', 'h1', 0))
    story.append(callout_box(
        '"Does DeepMindQ help executives decide what to do next?"',
        'Key Question'
    ))
    story.append(sp(6))
    headers = ['Capability', 'Gap', 'WOW', 'Differentiation', 'Priority']
    rows = [
        ['8.1 Recommendation Engine', 'Presents recommendations, not decisions; needs impact estimation, explicit next-steps, decision framing', 'High', 'Unique', priority_badge('P0')],
        ['8.2 Insight Generation', 'CRUD repository (217 lines), not generation engine. No pattern detection or synthesis.', 'Medium', 'Strong', priority_badge('P2')],
        ['8.3 Feedback Loops', 'Feedback captured but not wired to acceptance tracking or scoring weight adjustment', 'Medium', 'Unique', priority_badge('P1')],
        ['8.4 Learning System', 'Skeleton only (202 lines), mostly stubs', 'Medium', 'Unique', priority_badge('P1')],
    ]
    story.append(make_table(headers, rows, col_widths=[90, 168, 48, 55, 48], font_size='table_cell_small'))


def build_wow(story):
    story.append(add_heading('10  WOW Experience Readiness', 'h1', 0))
    story.append(sp(4))
    story.append(P('Four headline demo experiences assessed for current readiness and completion effort.'))
    story.append(sp(6))

    wow_headers = ['Experience', 'Readiness', 'What Exists', 'What\'s Missing', 'Effort', 'Priority']
    wow_rows = [
        ['1. Target Account Intelligence', '<b>85%</b>',
         '20-stage pipeline, intelligence-profile, account-brief, relationship-mapping, opportunity-radar, action-engine',
         'Single "Analyze Company" API; verified data; executive narrative format; visual profile experience',
         '2-3 weeks', priority_badge('P0')],
        ['2. Market Intelligence Discovery', '<b>70%</b>',
         'ICP alignment, account scoring, buying intent engine, recommendation engine, opportunity radar',
         'NL query parsing; ranked results with composite reasoning; contact recs; one-click create opportunity',
         '2 weeks', priority_badge('P0')],
        ['3. Executive Meeting Preparation', '<b>90%</b>',
         'Conversation engine (833 lines) with 4 briefing types, buyer profile extraction, evidence grounding',
         'One-click UI; export/download; share capability; post-meeting capture',
         '1 week', priority_badge('P0')],
        ['4. Enterprise Knowledge Question', '<b>75%</b>',
         'Hybrid retrieval (1,233 lines), knowledge graph (1,781 lines), memory (1,221 lines)',
         'Unified "ask anything" API; composed answer format; search UI; graceful empty handling',
         '2 weeks', priority_badge('P0')],
    ]
    story.append(make_table(wow_headers, wow_rows,
        col_widths=[72, 48, 120, 120, 48, 38], font_size='table_cell_small'))


def build_competitive(story):
    story.append(add_heading('11  Competitive Positioning', 'h1', 0))

    # vs CRM
    story.append(add_heading('DeepMindQ vs. CRM Platforms', 'h2', 1))
    crm_headers = ['Dimension', 'CRM', 'DeepMindQ', 'Assessment']
    crm_rows = [
        ['Data Storage', 'Core strength', 'Adequate', 'CRM wins'],
        ['Workflow Automation', 'Core strength', 'Basic', 'CRM wins'],
        ['Pipeline Management', 'Full-featured', 'Basic (count-based)', 'CRM wins'],
        ['AI Intelligence', 'Copilot-style tips', '7-engine architecture', 'DeepMindQ wins decisively'],
        ['Evidence-Backed Reasoning', 'Does not exist', '1,392-line explainability', 'DeepMindQ unique'],
        ['Knowledge Graph', 'Does not exist', '16 entities, 30+ relationships', 'DeepMindQ unique'],
        ['Memory Architecture', 'Does not exist', '4-layer hierarchy', 'DeepMindQ unique'],
        ['AI Governance', 'Minimal', '57 types, ESLint enforcement', 'DeepMindQ unique'],
        ['Hallucination Prevention', 'Does not exist', 'Two-layer defense', 'DeepMindQ unique'],
        ['Hybrid Retrieval', 'Keyword search', '6-signal RRF fusion', 'DeepMindQ unique'],
        ['Agent Framework', 'Does not exist', '10 specializations', 'DeepMindQ unique'],
        ['Confidence Scoring', 'Does not exist', '6-dimension unified', 'DeepMindQ unique'],
    ]
    story.append(make_table(crm_headers, crm_rows,
        col_widths=[110, 100, 135, 100], font_size='table_cell_small'))
    story.append(sp(4))
    story.append(P('<b>Conclusion:</b> DeepMindQ should NOT compete with CRM on data management or workflow. It should compete on <b>intelligence, reasoning, and decision-making</b> — dimensions where CRM products have zero capability.'))
    story.append(sp(8))

    # vs Sales Intel
    story.append(add_heading('DeepMindQ vs. Sales Intelligence Platforms', 'h2', 1))
    si_headers = ['Dimension', 'Sales Intel', 'DeepMindQ', 'Assessment']
    si_rows = [
        ['Data Volume', 'Millions of contacts', 'Limited data', 'Sales Intel wins'],
        ['Contact Database', 'Massive', 'Small', 'Sales Intel wins'],
        ['Buying Signals', 'Basic (web scraping)', '5-category engine', 'DeepMindQ wins'],
        ['Intelligence Reasoning', 'No reasoning layer', '7-engine AI reasoning', 'DeepMindQ wins decisively'],
        ['Evidence Framework', 'Does not exist', 'Full evidence chain', 'DeepMindQ unique'],
        ['Knowledge Graph', 'Does not exist', 'Enterprise-grade', 'DeepMindQ unique'],
        ['Explainability', 'Does not exist', '6-section trail', 'DeepMindQ unique'],
    ]
    story.append(make_table(si_headers, si_rows,
        col_widths=[110, 105, 120, 110], font_size='table_cell_small'))
    story.append(sp(4))
    story.append(P('<b>Conclusion:</b> Sales intelligence platforms are data vendors. DeepMindQ is an intelligence platform. "Use ZoomInfo for data. Use DeepMindQ for intelligence."'))
    story.append(sp(8))

    # vs Enterprise AI
    story.append(add_heading('DeepMindQ vs. Enterprise AI Platforms', 'h2', 1))
    ai_headers = ['Dimension', 'Enterprise AI', 'DeepMindQ', 'Assessment']
    ai_rows = [
        ['Enterprise Search', 'Core product', 'Components exist, not composed', 'Enterprise AI wins UX'],
        ['Knowledge Retrieval', 'Good', '6-signal hybrid (deeper)', 'DeepMindQ wins quality'],
        ['AI Governance', 'Basic', '57-type governance', 'DeepMindQ wins'],
        ['Domain Intelligence', 'Generic', 'B2B intelligence-specific', 'DeepMindQ unique'],
        ['Agent Framework', 'Early', '10 specializations', 'DeepMindQ wins'],
        ['Memory', 'Does not exist', '4-layer', 'DeepMindQ unique'],
    ]
    story.append(make_table(ai_headers, ai_rows,
        col_widths=[110, 110, 120, 105], font_size='table_cell_small'))
    story.append(sp(4))
    story.append(P('<b>Conclusion:</b> DeepMindQ has deeper AI infrastructure than general enterprise AI platforms. The gap is UX composition and data scale.'))
    story.append(sp(8))

    # Category Leadership
    story.append(add_heading('Category Leadership Assessment', 'h2', 1))
    cat_headers = ['Capability', 'Creates Category Leadership?', 'Status']
    cat_rows = [
        ['Evidence-Backed Architecture', 'Yes — no platform does this', 'Ready (needs UX exposure)'],
        ['6-Signal Hybrid Retrieval', 'Yes — enterprise-grade at startup stage', 'Ready (needs search UX)'],
        ['4-Layer Memory', 'Yes — unique in any platform', 'Ready (needs narrative exposure)'],
        ['AI Governance Layer', 'Yes — 57 types, audit, ESLint', 'Ready (needs dashboard)'],
        ['Knowledge Graph', 'Yes — 16/30+ at this stage', 'Ready (needs visual exploration)'],
        ['Explainability', 'Yes — 6-section trail', 'Ready (needs UI)'],
        ['Agent Framework', 'Yes — 10 specializations', 'Framework only — needs apps'],
        ['Decision Intelligence', 'Yes — evidence-backed recommendations', 'Ready (needs narrative reframing)'],
    ]
    story.append(make_table(cat_headers, cat_rows,
        col_widths=[140, 175, 175], font_size='table_cell_small'))
    story.append(sp(6))
    story.append(callout_box(
        '6 of 8 category-defining capabilities are technically ready. They need experience layer, not more engineering.'
    ))


def build_roadmap(story):
    story.append(add_heading('12  M5 Roadmap: Enterprise Intelligence Productization', 'h1', 0))
    story.append(P('<b>M5 Theme:</b> "Convert 79% technical maturity into enterprise-grade experiences."'))
    story.append(sp(6))

    # Phase A
    story.append(add_heading('Phase A: Enterprise Intelligence Experiences (Weeks 1-3)', 'h2', 1))
    story.append(P('<i>The WOW layer — convert existing engines into demo-ready experiences.</i>'))
    pa_headers = ['ID', 'Capability', 'WOW', 'Effort']
    pa_rows = [
        ['A1', 'Company Intelligence Profile', 'WOW #1', '1 week'],
        ['A2', 'Buying Committee Map', 'WOW #1', '1 week'],
        ['A3', 'Meeting Intelligence Brief', 'WOW #3', '1 week'],
        ['A4', 'Enterprise Knowledge Search', 'WOW #4', '1.5 weeks'],
        ['A5', 'Market Intelligence Discovery', 'WOW #2', '1.5 weeks'],
        ['A6', 'Decision Intelligence Narrative', 'All', '3 days'],
    ]
    story.append(make_table(pa_headers, pa_rows, col_widths=[30, 210, 55, 60]))
    story.append(sp(6))

    # Phase B
    story.append(add_heading('Phase B: Data Credibility and Trust (Weeks 3-5)', 'h2', 1))
    story.append(P('<i>Close the gap between AI estimation and enterprise trust.</i>'))
    pb_headers = ['ID', 'Capability', 'Effort']
    pb_rows = [
        ['B1', 'External Data Provider Integration (Clearbit/Apollo)', '2 weeks'],
        ['B2', 'Financial Intelligence Integrity (estimatedValue + confidence labels)', '3 days'],
        ['B3', 'Engagement Data Integration (wire actual opens/clicks)', '3 days'],
        ['B4', 'Contact Merge/Resolution (survivorship rules + undo)', '1 week'],
    ]
    story.append(make_table(pb_headers, pb_rows, col_widths=[30, 340, 60]))
    story.append(sp(6))

    # Phase C
    story.append(add_heading('Phase C: AI Trust Layer (Weeks 5-7)', 'h2', 1))
    story.append(P('<i>The single biggest differentiator is hidden. Expose it.</i>'))
    pc_headers = ['ID', 'Capability', 'Effort']
    pc_rows = [
        ['C1', 'AI Governance Dashboard (audit trail, confidence gates, cost tracking)', '1 week'],
        ['C2', 'Explainability UI (6-section intelligence trail on every recommendation)', '1 week'],
        ['C3', 'Confidence Scoring Visibility (on every AI output)', '3 days'],
        ['C4', 'Prompt Migration Phase 1 (top 20 prompts to registry)', '1 week'],
        ['C5', 'AI Cost Enforcement (hard budget caps per generation type)', '3 days'],
    ]
    story.append(make_table(pc_headers, pc_rows, col_widths=[30, 340, 60]))
    story.append(sp(6))

    # Phase D
    story.append(add_heading('Phase D: Intelligence Agent Experiences (Weeks 7-8)', 'h2', 1))
    story.append(P('<i>Productize the agent framework — the most impressive capability.</i>'))
    pd_headers = ['ID', 'Capability', 'Effort']
    pd_rows = [
        ['D1', 'Account Intelligence Agent (monitor + alert experience)', '1 week'],
        ['D2', 'Research Agent (scheduled company intelligence generation)', '1 week'],
    ]
    story.append(make_table(pd_headers, pd_rows, col_widths=[30, 340, 60]))
    story.append(sp(6))

    # Phase E
    story.append(add_heading('Phase E: Production Hardening (Weeks 8-9)', 'h2', 1))
    pe_headers = ['ID', 'Capability', 'Effort']
    pe_rows = [
        ['E1', 'Semantic Chunking Enhancement', '1 week'],
        ['E2', 'Feedback Loop Wiring', '3 days'],
        ['E3', 'Role Scoring Consolidation', '3 days'],
        ['E4', 'Test Coverage + Rate Limiting + API Docs', '1.5 weeks'],
    ]
    story.append(make_table(pe_headers, pe_rows, col_widths=[30, 340, 60]))
    story.append(sp(8))

    # Priority Matrix
    story.append(add_heading('M5 Priority Matrix', 'h2', 1))

    story.append(P('<b>P0 — Must Have (Creates WOW + Enterprise Trust)</b>', 'callout_text'))
    p0_headers = ['#', 'Capability', 'Domain', 'WOW', 'Diff.', 'Effort']
    p0_rows = [
        ['1', 'Company Intelligence Profile', 'Company', 'Transformational', 'Unique', '1 week'],
        ['2', 'Buying Committee Map', 'Contact', 'Transformational', 'Unique', '1 week'],
        ['3', 'Meeting Intelligence Brief', 'Communication', 'Transformational', 'Unique', '1 week'],
        ['4', 'Enterprise Knowledge Search', 'Knowledge', 'Transformational', 'Unique', '1.5 weeks'],
        ['5', 'Market Intelligence Discovery', 'Company', 'High', 'Unique', '1.5 weeks'],
        ['6', 'Decision Intelligence Narrative', 'Recommendation', 'High', 'Unique', '3 days'],
        ['7', 'AI Governance Dashboard', 'AI Reasoning', 'Transformational', 'Unique', '1 week'],
        ['8', 'Explainability UI', 'AI Reasoning', 'Transformational', 'Unique', '1 week'],
        ['9', 'External Data Provider', 'Company', 'High', 'Strong', '2 weeks'],
        ['10', 'Dollar-Denominated Pipeline', 'Revenue', 'High', 'Unique', '3 days'],
        ['11', 'Engagement Data Integration', 'Contact', 'High', 'Unique', '3 days'],
        ['12', 'Confidence Visibility', 'AI Reasoning', 'High', 'Unique', '3 days'],
    ]
    story.append(make_table(p0_headers, p0_rows,
        col_widths=[20, 140, 72, 72, 48, 52], font_size='table_cell_small'))
    story.append(sp(6))

    story.append(P('<b>P1 — Should Have (Strengthens Intelligence Quality)</b>', 'callout_text'))
    p1_headers = ['#', 'Capability', 'Domain', 'Effort']
    p1_rows = [
        ['13', 'Contact Merge/Resolution', 'Contact', '1 week'],
        ['14', 'Account Intelligence Agent', 'Agents', '1 week'],
        ['15', 'Research Agent', 'Agents', '1 week'],
        ['16', 'Prompt Migration Phase 1', 'AI Reasoning', '1 week'],
        ['17', 'AI Cost Enforcement', 'AI Reasoning', '3 days'],
        ['18', 'Feedback Loop Wiring', 'Recommendation', '3 days'],
        ['19', 'Role Scoring Consolidation', 'Contact', '3 days'],
        ['20', 'Financial Intelligence Integrity', 'Company', '3 days'],
        ['21', 'Semantic Chunking', 'Knowledge', '1 week'],
        ['22', 'Industry Taxonomy', 'Company', '1 week'],
        ['23', 'Communication Preference Learning', 'Communication', '1 week'],
    ]
    story.append(make_table(p1_headers, p1_rows,
        col_widths=[20, 180, 90, 55], font_size='table_cell_small'))
    story.append(sp(6))

    story.append(P('<b>P2 — Nice to Have (Enterprise Refinements)</b>', 'callout_text'))
    p2_headers = ['#', 'Capability', 'Domain', 'Effort']
    p2_rows = [
        ['24', 'Competitor Registry', 'Company', '2 weeks'],
        ['25', 'Technology Intelligence Enhancement', 'Company', '2 weeks'],
        ['26', 'Sentiment Analysis Engine', 'Communication', '1 week'],
        ['27', 'Unified Insight Synthesis', 'Recommendation', '2 weeks'],
        ['28', 'Signal Lifecycle State Machine', 'Data Platform', '1 week'],
        ['29', 'Learning System Flesh-out', 'Recommendation', '2 weeks'],
        ['30', 'AI Evaluation CI Integration', 'AI Reasoning', '1 week'],
    ]
    story.append(make_table(p2_headers, p2_rows,
        col_widths=[20, 180, 90, 55], font_size='table_cell_small'))
    story.append(sp(6))

    story.append(P('<b>M5 Exclusions:</b> Full CRM replacement, marketing automation, drip campaigns, org chart complexity, cross-sell engine, Monte Carlo forecasting, over-engineered ML, real-time event architecture.', 'body_small'))


def build_outcomes(story):
    story.append(add_heading('13  Expected M5 Outcomes', 'h1', 0))

    story.append(add_heading('After M5, DeepMindQ Delivers', 'h2', 1))

    outcomes = [
        ('<b>Product</b>', [
            'One-click Company Intelligence Profile (evidence-backed, confidence-scored)',
            'Visual Buying Committee Map (influence scores, coverage gaps, recommendations)',
            'Meeting Intelligence Brief (auto-generated, exportable, shareable)',
            'Enterprise Knowledge Search (answer + evidence + confidence)',
            'Market Intelligence Discovery ("which companies fit X?")',
            'Decision Intelligence (action + why + evidence + confidence)',
        ]),
        ('<b>AI Trust Layer (Exposed as Product)</b>', [
            'AI Governance Dashboard (visible audit trail, confidence gates, cost tracking)',
            'Explainability on every recommendation (6-section intelligence trail)',
            'Confidence scoring on every AI output',
            'Verified data enrichment (Clearbit/Apollo — not AI guesses)',
        ]),
        ('<b>Agents</b>', [
            'Account Intelligence Agent (deploy, monitor, alert)',
            'Research Agent (scheduled company intelligence generation)',
        ]),
        ('<b>Data Credibility</b>', [
            'Dollar-denominated pipeline (user-provided values, AI-calculated probability)',
            'Engagement data from actual behavior (not hardcoded zeros)',
            'Honest financial intelligence (known vs estimated, with confidence)',
            'Contact merge/resolution (detection + resolution)',
        ]),
    ]
    for cat, items in outcomes:
        story.append(P(cat, 'h3'))
        for item in items:
            story.append(Paragraph(f'<bullet>•</bullet> {item}', styles['body']))
        story.append(sp(4))

    # Post-M5 Readiness Table
    story.append(add_heading('Platform Readiness After M5', 'h2', 1))
    post_headers = ['Domain', 'Current', 'Post-M5 Target']
    post_rows = [
        ['Company Intelligence', '40%', '75%'],
        ['Contact Intelligence', '48%', '72%'],
        ['Revenue Intelligence', '55%', '78%'],
        ['Communication Intelligence', '70%', '85%'],
        ['Knowledge Intelligence', '65%', '85%'],
        ['AI Reasoning Platform', '50%', '82%'],
        ['Autonomous Agents', '35%', '65%'],
        ['Recommendation Intelligence', '55%', '80%'],
        ['<b>OVERALL</b>', '<b>52%</b>', '<b>78%</b>'],
    ]
    story.append(make_table(post_headers, post_rows,
        col_widths=[180, 120, 120]))


def build_positioning(story):
    story.append(add_heading('14  Final Positioning', 'h1', 0))
    story.append(sp(4))
    story.append(callout_box(
        '"DeepMindQ is the Enterprise Intelligence Operating System that sits above CRM, communication platforms, '
        'documents, and enterprise data — continuously understanding businesses, discovering opportunities, '
        'and recommending the next best actions."'
    ))
    story.append(sp(8))
    story.append(P('After M5, a Fortune 500 executive will see:'))
    story.append(sp(4))
    items = [
        '<b>Not a CRM</b> — no pipeline stages, no activity logging, no contact management',
        '<b>An Intelligence Platform</b> — evidence-backed company analysis, AI reasoning, knowledge graph, autonomous agents',
        '<b>Enterprise Trust</b> — every AI output shows confidence, evidence, reasoning, sources, and audit history',
        '<b>Category-Defining Differentiation</b> — 6-signal retrieval, 4-layer memory, explainability, governance layer. None of this exists in any CRM or sales intelligence platform.',
    ]
    for item in items:
        story.append(Paragraph(f'<bullet>•</bullet> {item}', styles['body']))


# ═══════════════════════════════════════════════════════════
# COVER GENERATION (Template 01: HUD Data Terminal)
# ═══════════════════════════════════════════════════════════

def generate_cover_html():
    """Generate Template 01 cover HTML."""
    W = 794  # A4 width at 96dpi
    H = 1123  # A4 height at 96dpi
    U = W * 0.05  # ~40px
    X_CONTENT = int(W * 0.12) + 30  # offset from thick line

    html = f'''<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;900&family=Playfair+Display:wght@700;900&display=swap');
* {{ margin:0; padding:0; box-sizing:border-box; }}
body {{ width:{W}px; height:{H}px; overflow:hidden; font-family:'Inter',sans-serif; background:#f5f5f4; }}
.cover-page {{ width:{W}px; height:{H}px; position:relative; border:none; outline:none; box-shadow:none; }}

/* Layer 0 - Base */
.layer-0 {{ position:absolute; inset:0; z-index:0; background:#f5f5f4; }}

/* Layer 1 - Background grid */
.layer-1 {{ position:absolute; inset:0; z-index:1; overflow:hidden; }}
.bg-grid {{ position:absolute; inset:0; background-image:
  linear-gradient(rgba(83,74,47,0.03) 1px, transparent 1px),
  linear-gradient(90deg, rgba(83,74,47,0.03) 1px, transparent 1px);
  background-size: 50px 50px; }}

/* Layer 2 - Structure */
.layer-2 {{ position:absolute; inset:0; z-index:2; }}
.anchor-line {{ position:absolute; left:{int(W*0.12)}px; top:{int(H*0.10)}px; width:6px; height:{int(H*0.80)}px; background:{COVER_BLOCK.hexval()}; }}

/* Layer 3 - Content */
.layer-3 {{ position:absolute; inset:0; z-index:3; padding-left:{X_CONTENT}px; }}
.kicker {{ position:absolute; top:{int(H*0.15)}px; left:{X_CONTENT}px; max-width:{int(W*0.75)}px;
  font-size:14px; font-weight:400; letter-spacing:3px; text-transform:uppercase;
  color:rgba(83,74,47,0.6); }}
.hero-title {{ position:absolute; top:{int(H*0.30)}px; left:{X_CONTENT}px; max-width:{int(W*0.75)}px;
  font-family:'Playfair Display',serif; font-size:42px; font-weight:900; line-height:1.15;
  color:#21201e; }}
.summary {{ position:absolute; top:{int(H*0.50)}px; left:{X_CONTENT}px; max-width:{int(W*0.6)}px;
  font-size:15px; font-weight:400; line-height:1.6; color:rgba(33,32,30,0.75); }}
.meta {{ position:absolute; top:{int(H*0.75)}px; left:{X_CONTENT}px; max-width:{int(W*0.6)}px;
  font-size:16px; font-weight:400; line-height:1.4; color:rgba(33,32,30,0.85); }}
.footer {{ position:absolute; bottom:{int(H*0.06)}px; left:{X_CONTENT}px; max-width:{int(W*0.6)}px;
  font-size:12px; font-weight:400; letter-spacing:2px; text-transform:uppercase;
  color:rgba(83,74,47,0.5); }}
</style>
</head>
<body>
<div class="cover-page">
  <div class="layer-0"></div>
  <div class="layer-1"><div class="bg-grid"></div></div>
  <div class="layer-2"><div class="anchor-line"></div></div>
  <div class="layer-3">
    <div class="kicker">Phase 0: Enterprise Readiness Audit</div>
    <div class="hero-title">DeepMindQ<br>Enterprise Intelligence<br>Platform</div>
    <div class="summary">Comprehensive audit of 8 intelligence domains, 72 capabilities, and 4 WOW experiences. Evaluating the gap between 79% technical maturity and enterprise-grade product experience.</div>
    <div class="meta">August 2026  |  Version 1.0</div>
    <div class="footer">Confidential  |  Enterprise Intelligence Audit Report</div>
  </div>
</div>
</body>
</html>'''
    return html


def generate_cover_pdf(html_path, output_path):
    """Render cover HTML to PDF via Playwright html2poster.js."""
    cmd = [
        'node', f'{PDF_SKILL_DIR}/scripts/html2poster.js',
        '--width', '794px',
        '--html', html_path,
        '--output', output_path
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    if result.returncode != 0:
        print(f'Cover generation stderr: {result.stderr[:500]}')
        raise RuntimeError(f'Cover PDF generation failed: {result.returncode}')
    return output_path


def merge_pdfs(cover_path, body_path, output_path):
    """Merge cover PDF and body PDF using pypdf."""
    try:
        from pypdf import PdfReader, PdfWriter
    except ImportError:
        from PyPDF2 import PdfReader, PdfWriter

    reader_cover = PdfReader(cover_path)
    reader_body = PdfReader(body_path)
    writer = PdfWriter()

    for page in reader_cover.pages:
        writer.add_page(page)
    for page in reader_body.pages:
        writer.add_page(page)

    with open(output_path, 'wb') as f:
        writer.write(f)
    return output_path


# ═══════════════════════════════════════════════════════════
# MAIN BUILD
# ═══════════════════════════════════════════════════════════

def main():
    os.makedirs('/home/z/my-project/download', exist_ok=True)

    # ─── Step 1: Generate Cover ─────────────────────────────
    print('Generating cover...')
    cover_html = generate_cover_html()
    cover_html_path = '/tmp/m5-audit-cover.html'
    with open(cover_html_path, 'w') as f:
        f.write(cover_html)

    # Validate cover HTML
    try:
        subprocess.run(
            ['node', f'{PDF_SKILL_DIR}/scripts/cover_validate.js', cover_html_path],
            capture_output=True, text=True, timeout=30
        )
    except Exception as e:
        print(f'Cover validation warning: {e}')

    generate_cover_pdf(cover_html_path, OUTPUT_COVER)
    print(f'Cover PDF: {OUTPUT_COVER}')

    # ─── Step 2: Build Body PDF ─────────────────────────────
    print('Building body PDF...')
    doc = TocDocTemplate(
        OUTPUT_BODY,
        pagesize=A4,
        leftMargin=MARGIN, rightMargin=MARGIN,
        topMargin=MARGIN, bottomMargin=MARGIN + 15,
    )

    story = []

    # TOC
    toc = TableOfContents()
    toc.levelStyles = [styles['toc_h0'], styles['toc_h1']]
    story.append(P('Table of Contents', 'h1'))
    story.append(sp(8))
    story.append(toc)
    story.append(PageBreak())

    # Content chapters
    build_executive_summary(story)
    story.append(PageBreak())

    build_domain1(story)
    story.append(CondPageBreak(72))

    build_domain2(story)
    story.append(CondPageBreak(72))

    build_domain3(story)
    story.append(CondPageBreak(72))

    build_domain4(story)
    story.append(CondPageBreak(72))

    build_domain5(story)
    story.append(CondPageBreak(72))

    build_domain6(story)
    story.append(CondPageBreak(72))

    build_domain7(story)
    story.append(CondPageBreak(72))

    build_domain8(story)
    story.append(CondPageBreak(72))

    build_wow(story)
    story.append(CondPageBreak(72))

    build_competitive(story)
    story.append(CondPageBreak(72))

    build_roadmap(story)
    story.append(CondPageBreak(72))

    build_outcomes(story)
    story.append(CondPageBreak(72))

    build_positioning(story)

    # Build
    doc.multiBuild(story, onFirstPage=page_first, onLaterPages=page_footer)
    print(f'Body PDF: {OUTPUT_BODY}')

    # ─── Step 3: Merge Cover + Body ────────────────────────
    print('Merging cover and body...')
    merge_pdfs(OUTPUT_COVER, OUTPUT_BODY, OUTPUT_FINAL)
    print(f'Final PDF: {OUTPUT_FINAL}')

    # Count pages
    try:
        from pypdf import PdfReader
    except ImportError:
        from PyPDF2 import PdfReader
    reader = PdfReader(OUTPUT_FINAL)
    page_count = len(reader.pages)
    print(f'Total pages: {page_count}')

    return OUTPUT_FINAL, page_count


if __name__ == '__main__':
    result = main()
    print(f'Done: {result}')
