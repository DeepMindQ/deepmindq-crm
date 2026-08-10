#!/usr/bin/env python3
"""
DeepMindQ Enterprise Production Readiness Audit Report
Generates comprehensive PDF via ReportLab.
"""

import os, sys, hashlib
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY, TA_RIGHT
from reportlab.platypus import (
    Paragraph, Spacer, Table, TableStyle, PageBreak,
    KeepTogether, HRFlowable, Image
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily
from reportlab.platypus import SimpleDocTemplate

# ━━ Cascade Palette ━━
PAGE_BG       = colors.HexColor('#f7f7f6')
SECTION_BG    = colors.HexColor('#eeeeec')
CARD_BG       = colors.HexColor('#f0f0ee')
TABLE_STRIPE  = colors.HexColor('#efeeec')
HEADER_FILL   = colors.HexColor('#4f4731')
COVER_BLOCK   = colors.HexColor('#716952')
BORDER_COLOR  = colors.HexColor('#d3cbb6')
ICON_COLOR    = colors.HexColor('#87784b')
ACCENT        = colors.HexColor('#8c7226')
ACCENT_2      = colors.HexColor('#6246b8')
TEXT_PRIMARY   = colors.HexColor('#1e1e1b')
TEXT_MUTED     = colors.HexColor('#89877f')
SEM_SUCCESS   = colors.HexColor('#498e60')
SEM_WARNING   = colors.HexColor('#8a7448')
SEM_ERROR     = colors.HexColor('#94534d')
SEM_INFO      = colors.HexColor('#4a6683')

FONT_DIR = '/usr/share/fonts'

# ── Register Fonts ──
pdfmetrics.registerFont(TTFont('NotoSerifSC', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('NotoSerifSC-Bold', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Bold.ttf'))
registerFontFamily('NotoSerifSC', normal='NotoSerifSC', bold='NotoSerifSC-Bold')

pdfmetrics.registerFont(TTFont('NotoSansSC', f'{FONT_DIR}/truetype/chinese/SarasaMonoSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('NotoSansSC-Bold', f'{FONT_DIR}/truetype/chinese/SarasaMonoSC-Bold.ttf'))

pdfmetrics.registerFont(TTFont('FreeSerif', f'{FONT_DIR}/truetype/liberation/LiberationSerif-Regular.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-Bold', f'{FONT_DIR}/truetype/liberation/LiberationSerif-Bold.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-Italic', f'{FONT_DIR}/truetype/liberation/LiberationSerif-Italic.ttf'))
registerFontFamily('FreeSerif', normal='FreeSerif', bold='FreeSerif-Bold', italic='FreeSerif-Italic')

pdfmetrics.registerFont(TTFont('DejaVuSans', f'{FONT_DIR}/truetype/dejavu/DejaVuSans.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans-Bold', f'{FONT_DIR}/truetype/dejavu/DejaVuSans-Bold.ttf'))

# ── Font Fallback ──
from reportlab.pdfbase.pdfmetrics import getFont
from reportlab.lib.fonts import addMapping
addMapping('NotoSerifSC', 0, 0, 'NotoSerifSC')
addMapping('NotoSerifSC', 1, 0, 'NotoSerifSC-Bold')
addMapping('FreeSerif', 0, 0, 'FreeSerif')
addMapping('FreeSerif', 1, 0, 'FreeSerif-Bold')
addMapping('FreeSerif', 0, 1, 'FreeSerif-Italic')
addMapping('NotoSansSC', 0, 0, 'NotoSansSC')
addMapping('NotoSansSC', 1, 0, 'NotoSansSC-Bold')

# ── Styles ──
PAGE_W, PAGE_H = A4
LEFT_M = 22 * mm
RIGHT_M = 22 * mm
TOP_M = 25 * mm
BOTTOM_M = 25 * mm
CONTENT_W = PAGE_W - LEFT_M - RIGHT_M

# Cover styles
cover_title_style = ParagraphStyle(
    'CoverTitle', fontName='FreeSerif-Bold', fontSize=32, leading=40,
    textColor=TEXT_PRIMARY, alignment=TA_LEFT, spaceAfter=6*mm
)
cover_subtitle_style = ParagraphStyle(
    'CoverSubtitle', fontName='FreeSerif', fontSize=14, leading=20,
    textColor=TEXT_MUTED, alignment=TA_LEFT, spaceAfter=4*mm
)
cover_meta_style = ParagraphStyle(
    'CoverMeta', fontName='NotoSansSC', fontSize=10, leading=14,
    textColor=TEXT_MUTED, alignment=TA_LEFT
)

# TOC styles
toc_h1 = ParagraphStyle('TOCH1', fontName='FreeSerif-Bold', fontSize=12, leading=20,
    textColor=TEXT_PRIMARY, leftIndent=0, spaceBefore=4, spaceAfter=2)
toc_h2 = ParagraphStyle('TOCH2', fontName='FreeSerif', fontSize=10.5, leading=18,
    textColor=TEXT_PRIMARY, leftIndent=12, spaceBefore=2, spaceAfter=1)

# Heading styles
h1_style = ParagraphStyle('H1', fontName='FreeSerif-Bold', fontSize=22, leading=28,
    textColor=TEXT_PRIMARY, spaceBefore=16, spaceAfter=8, alignment=TA_LEFT)
h2_style = ParagraphStyle('H2', fontName='FreeSerif-Bold', fontSize=14, leading=20,
    textColor=HEADER_FILL, spaceBefore=12, spaceAfter=6, alignment=TA_LEFT)
h3_style = ParagraphStyle('H3', fontName='FreeSerif-Bold', fontSize=11.5, leading=16,
    textColor=TEXT_PRIMARY, spaceBefore=8, spaceAfter=4, alignment=TA_LEFT)

# Body styles
body_style = ParagraphStyle('Body', fontName='FreeSerif', fontSize=10.5, leading=17,
    textColor=TEXT_PRIMARY, alignment=TA_JUSTIFY, spaceAfter=4,
    firstLineIndent=0)
body_left_style = ParagraphStyle('BodyLeft', fontName='FreeSerif', fontSize=10.5, leading=17,
    textColor=TEXT_PRIMARY, alignment=TA_LEFT, spaceAfter=4)
bullet_style = ParagraphStyle('Bullet', fontName='FreeSerif', fontSize=10, leading=16,
    textColor=TEXT_PRIMARY, alignment=TA_LEFT, leftIndent=16, bulletIndent=6,
    spaceBefore=2, spaceAfter=2)
code_style = ParagraphStyle('Code', fontName='DejaVuSans', fontSize=8.5, leading=12,
    textColor=SEM_ERROR, backColor=CARD_BG, borderPadding=4,
    leftIndent=8, rightIndent=8, spaceBefore=4, spaceAfter=4)
caption_style = ParagraphStyle('Caption', fontName='FreeSerif-Italic', fontSize=9,
    leading=13, textColor=TEXT_MUTED, alignment=TA_LEFT, spaceBefore=2, spaceAfter=6)
muted_style = ParagraphStyle('Muted', fontName='FreeSerif-Italic', fontSize=9.5, leading=14,
    textColor=TEXT_MUTED, alignment=TA_LEFT, spaceAfter=4)

# ── Helper Functions ──

def hr():
    return HRFlowable(width="100%", thickness=0.5, color=BORDER_COLOR,
                       spaceBefore=6, spaceAfter=6)

def callout_box(text, bg_color=CARD_BG, border_color=ACCENT, text_color=TEXT_PRIMARY):
    style = ParagraphStyle('Callout', fontName='FreeSerif', fontSize=10, leading=15,
        textColor=text_color, alignment=TA_LEFT)
    data = [[Paragraph(text, style)]]
    t = Table(data, colWidths=[CONTENT_W - 4*mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), bg_color),
        ('LEFTPADDING', (0,0), (-1,-1), 12),
        ('RIGHTPADDING', (0,0), (-1,-1), 12),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LINEBELOW', (0,0), (-1,-1), 0, bg_color),
        ('LINEBEFORE', (0,0), (0,-1), 3, border_color),
    ]))
    return t

def severity_badge(severity, label):
    color_map = {
        'CRITICAL': SEM_ERROR,
        'HIGH': colors.HexColor('#c47030'),
        'MEDIUM': SEM_WARNING,
        'LOW': SEM_INFO,
        'PASS': SEM_SUCCESS,
    }
    bg_map = {
        'CRITICAL': colors.HexColor('#f9e8e6'),
        'HIGH': colors.HexColor('#f5e6d4'),
        'MEDIUM': colors.HexColor('#f5f0d4'),
        'LOW': colors.HexColor('#e4eef5'),
        'PASS': colors.HexColor('#e2f0e8'),
    }
    c = color_map.get(severity, TEXT_MUTED)
    bg = bg_map.get(severity, CARD_BG)
    s = ParagraphStyle('Badge', fontName='DejaVuSans-Bold', fontSize=7.5, leading=10, textColor=c)
    data = [[Paragraph(label, s)]]
    t = Table(data, colWidths=None)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), bg),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
    ]))
    return t

def finding_table(findings):
    """Create findings table with severity, title, details, file, status."""
    hdr_style = ParagraphStyle('TH', fontName='DejaVuSans-Bold', fontSize=8.5, leading=12, textColor=colors.white)
    cell_style = ParagraphStyle('TD', fontName='FreeSerif', fontSize=9, leading=13, textColor=TEXT_PRIMARY)
    file_style = ParagraphStyle('TDFile', fontName='DejaVuSans', fontSize=7.5, leading=11, textColor=TEXT_MUTED)
    sev_style = ParagraphStyle('TDSev', fontName='DejaVuSans-Bold', fontSize=8, leading=11)

    rows = []
    # Header
    rows.append([
        Paragraph('Severity', hdr_style),
        Paragraph('Finding', hdr_style),
        Paragraph('Location', hdr_style),
        Paragraph('Status', hdr_style),
    ])

    for f in findings:
        sev = f.get('severity', 'MEDIUM')
        sev_color = {
            'CRITICAL': SEM_ERROR, 'HIGH': colors.HexColor('#c47030'),
            'MEDIUM': SEM_WARNING, 'LOW': SEM_INFO, 'PASS': SEM_SUCCESS
        }.get(sev, TEXT_MUTED)
        sev_s = ParagraphStyle('SevCell', fontName='DejaVuSans-Bold', fontSize=8, leading=11, textColor=sev_color)
        status_color = SEM_SUCCESS if f.get('status') == 'FIXED' else SEM_ERROR
        status_s = ParagraphStyle('StatusCell', fontName='DejaVuSans-Bold', fontSize=8, leading=11, textColor=status_color)
        rows.append([
            Paragraph(sev, sev_s),
            Paragraph(f.get('title', ''), cell_style),
            Paragraph(f.get('file', ''), file_style),
            Paragraph(f.get('status', 'OPEN'), status_s),
        ])

    col_widths = [14*mm, 56*mm, 48*mm, 14*mm]
    t = Table(rows, colWidths=col_widths, repeatRows=1)
    style_cmds = [
        ('BACKGROUND', (0,0), (-1,0), HEADER_FILL),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('GRID', (0,0), (-1,-1), 0.3, BORDER_COLOR),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]
    for i in range(1, len(rows)):
        bg = TABLE_STRIPE if i % 2 == 0 else colors.white
        style_cmds.append(('BACKGROUND', (0, i), (-1, i), bg))
    t.setStyle(TableStyle(style_cmds))
    return t

def score_card(dimension, score, max_score, status, summary):
    """Create a score card block."""
    pct = score / max_score * 100
    if pct >= 80:
        grade_color = SEM_SUCCESS
    elif pct >= 60:
        grade_color = SEM_WARNING
    else:
        grade_color = SEM_ERROR

    grade_style = ParagraphStyle('Grade', fontName='FreeSerif-Bold', fontSize=28, leading=32, textColor=grade_color, alignment=TA_CENTER)
    dim_style = ParagraphStyle('Dim', fontName='FreeSerif-Bold', fontSize=11, leading=14, textColor=TEXT_PRIMARY)
    sum_style = ParagraphStyle('Sum', fontName='FreeSerif', fontSize=9, leading=13, textColor=TEXT_MUTED, alignment=TA_CENTER)
    stat_style = ParagraphStyle('Stat', fontName='DejaVuSans-Bold', fontSize=8, leading=11, textColor=grade_color, alignment=TA_CENTER)

    data = [
        [Paragraph(f'{score}/{max_score}', grade_style)],
        [Paragraph(dimension, dim_style)],
        [Paragraph(status, stat_style)],
        [Spacer(1, 4)],
        [Paragraph(summary, sum_style)],
    ]
    t = Table(data, colWidths=[38*mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), CARD_BG),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ('TOPPADDING', (0,0), (0,0), 10),
        ('BOTTOMPADDING', (-1,-1), (-1,-1), 10),
        ('LINEBEFORE', (0,0), (0,-1), 3, grade_color),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    return t


# ━━ TocDocTemplate ━━
class TocDocTemplate(SimpleDocTemplate):
    def __init__(self, *args, **kwargs):
        SimpleDocTemplate.__init__(self, *args, **kwargs)
        self.page_count_offset = 0

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

# ── Page numbering ──
def page_footer(canvas, doc):
    canvas.saveState()
    canvas.setFont('NotoSansSC', 8)
    canvas.setFillColor(TEXT_MUTED)
    canvas.drawString(LEFT_M, 12*mm, 'DeepMindQ Enterprise Production Readiness Audit')
    canvas.drawRightString(PAGE_W - RIGHT_M, 12*mm, f'Page {doc.page}')
    canvas.restoreState()

def cover_page_template(canvas, doc):
    pass  # Cover has its own layout

# ━━ BUILD DOCUMENT ━━
OUTPUT_PATH = '/home/z/my-project/download/DeepMindQ_Enterprise_Production_Readiness_Audit.pdf'
os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)

doc = TocDocTemplate(
    OUTPUT_PATH,
    pagesize=A4,
    leftMargin=LEFT_M, rightMargin=RIGHT_M,
    topMargin=TOP_M, bottomMargin=BOTTOM_M,
    title='DeepMindQ Enterprise Production Readiness Audit',
    author='Z.ai Security & Architecture Review',
    subject='Comprehensive 360-degree production readiness assessment',
)

story = []

# ══════════════════════════════════════════════════════════════
# COVER PAGE
# ══════════════════════════════════════════════════════════════
story.append(Spacer(1, 40*mm))

# Title block
cover_line_style = ParagraphStyle('CoverLine', fontName='FreeSerif', fontSize=11, leading=14,
    textColor=ACCENT, spaceAfter=8, letterSpacing=2)
story.append(Paragraph('ENTERPRISE PRODUCTION READINESS AUDIT', cover_line_style))
story.append(Spacer(1, 4*mm))
story.append(Paragraph('DeepMindQ', ParagraphStyle('CoverMain', fontName='FreeSerif-Bold', fontSize=38, leading=44, textColor=TEXT_PRIMARY)))
story.append(Spacer(1, 3*mm))
story.append(Paragraph('Comprehensive 360-Degree Assessment', cover_subtitle_style))
story.append(Spacer(1, 6*mm))
story.append(hr())
story.append(Spacer(1, 4*mm))

# Meta info
meta_data = [
    [Paragraph('Audit Date', muted_style), Paragraph('August 10, 2026', body_left_style)],
    [Paragraph('Codebase Version', muted_style), Paragraph('GitHub main branch (live)', body_left_style)],
    [Paragraph('Scope', muted_style), Paragraph('334 API routes, 128 Prisma models, 355 lib files, 313 components', body_left_style)],
    [Paragraph('Assessment Method', muted_style), Paragraph('Static code analysis, line-by-line audit of critical paths', body_left_style)],
    [Paragraph('Overall Score', muted_style), Paragraph('<b>61 / 100</b>  (Needs Significant Work)', body_left_style)],
]
meta_t = Table(meta_data, colWidths=[30*mm, CONTENT_W - 34*mm])
meta_t.setStyle(TableStyle([
    ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ('TOPPADDING', (0,0), (-1,-1), 3),
    ('BOTTOMPADDING', (0,0), (-1,-1), 3),
    ('LINEBELOW', (0,0), (-1,-2), 0.3, BORDER_COLOR),
    ('LINEBELOW', (0,-1), (-1,-1), 0.5, ACCENT),
]))
story.append(meta_t)
story.append(Spacer(1, 8*mm))

# Executive summary callout
exec_summary = (
    '<b>Executive Summary:</b> DeepMindQ possesses a sophisticated architectural foundation with enterprise-grade AI governance, '
    'a multi-provider LLM routing system, RBAC authorization, and a comprehensive data model. However, the gap between '
    'architectural design and production wiring remains significant. Critical security vulnerabilities in authentication flows, '
    'in-memory state loss in serverless environments, mock implementations in customer-facing integration endpoints, and missing '
    'observability wiring prevent this codebase from being production-ready for enterprise customers. '
    'This report identifies 5 critical blockers, 18 high-severity issues, and provides a prioritized remediation roadmap.'
)
story.append(callout_box(exec_summary, CARD_BG, ACCENT))

story.append(PageBreak())

# ══════════════════════════════════════════════════════════════
# TABLE OF CONTENTS
# ══════════════════════════════════════════════════════════════
story.append(add_heading('Table of Contents', h1_style, level=0))
story.append(Spacer(1, 4*mm))
toc = TableOfContents()
toc.levelStyles = [toc_h1, toc_h2]
story.append(toc)
story.append(PageBreak())

# ══════════════════════════════════════════════════════════════
# CHAPTER 1: EXECUTIVE OVERVIEW
# ══════════════════════════════════════════════════════════════
story.append(add_heading('Executive Overview', h1_style, level=0))

story.append(Paragraph(
    'DeepMindQ is an Enterprise AI Intelligence Platform built on Next.js 16 App Router with Prisma ORM, '
    'designed for enterprise deployment and licensing. Its 7-engine architecture (ModelRouter, GroundingEngine, RetrievalEngine, SynthesisEngine, ScoringEngine, ActionEngine, ConversationEngine) transforms raw signals into evidence-backed intelligence following the chain: Signal, Reason, Evidence, Confidence, Business Impact, Recommended Action. '
    'The codebase analyzed represents the current state of the GitHub main branch and encompasses 334 API routes, '
    '128 Prisma database models across 3,942 lines of schema, 355 server-side library files, 313 React components '
    '(112 of which are screen-level), and a 2,113-line OpenAPI specification. The system integrates with four LLM providers '
    '(NVIDIA, Fireworks, Groq, Gemini) and Tavily web search, deploying behind an 807-line GitHub Actions CI/CD pipeline '
    'with 23 Vitest configuration profiles covering security, AI governance, integration, E2E, and performance testing.',
    body_style))

story.append(Paragraph(
    'The assessment methodology combined automated static analysis with targeted line-by-line code review of all authentication '
    'routes, AI pipeline code, data persistence layers, integration endpoints, and infrastructure configurations. '
    'Every finding in this report is backed by specific file paths and line numbers from the actual codebase. '
    'The scoring rubric follows enterprise deployment standards and evaluates and evaluates each dimension on a 0-10 scale '
    'across five criteria: implementation completeness, correctness, security hardening, observability, and test coverage.',
    body_style))

story.append(add_heading('Overall Score Card', h2_style, level=1))
story.append(Paragraph(
    'The overall production readiness score stands at <b>61 out of 100</b>. While this places the codebase above the "non-functional" '
    'threshold, it falls well below the 80-point minimum required for enterprise enterprise deployment. The score reflects a pattern '
    'that is common in ambitious early-stage platforms: world-class architectural design paired with incomplete production wiring. '
    'The AI governance system, RBAC framework, and data model are genuinely impressive in their design. However, design alone does '
    'not constitute production readiness. Every architectural decision must be validated through correct implementation, comprehensive '
    'testing, and operational observability. The gaps identified in this report are not theoretical; they represent concrete failure '
    'modes that would manifest under real customer usage.',
    body_style))

story.append(Spacer(1, 4*mm))

# Score cards for all 10 dimensions
score_data = [
    ('1. Security & Auth', 5, 10, 'CRITICAL', 'Auth vulns, no middleware, no CSRF'),
    ('2. Data Integrity', 5, 10, 'CRITICAL', 'No transactions, in-memory state loss'),
    ('3. AI Pipeline', 8, 10, 'GOOD', 'Mature governance, minor issues'),
    ('4. API Quality', 6, 10, 'NEEDS WORK', 'Mock integrations, no input validation'),
    ('5. Observability', 5, 10, 'CRITICAL', 'Alerts not wired, no distributed tracing'),
    ('6. Testing', 7, 10, 'ADEQUATE', '254 tests, but no load tests'),
    ('7. Infrastructure', 7, 10, 'ADEQUATE', 'CI/CD solid, Docker/Terraform ready'),
    ('8. Data Model', 8, 10, 'GOOD', '128 models, pgvector ready'),
    ('9. Code Quality', 6, 10, 'NEEDS WORK', 'TS errors, server-side UI imports'),
    ('10. Compliance', 3, 10, 'CRITICAL', 'No GDPR, no backup, no encryption at rest'),
]

row1_cards = []
row2_cards = []
for i, (dim, score, maxs, status, summary) in enumerate(score_data):
    card = score_card(dim, score, maxs, status, summary)
    if i < 5:
        row1_cards.append(card)
    else:
        row2_cards.append(card)

score_table1 = Table([row1_cards], colWidths=[CONTENT_W/5]*5)
score_table1.setStyle(TableStyle([
    ('LEFTPADDING', (0,0), (-1,-1), 3),
    ('RIGHTPADDING', (0,0), (-1,-1), 3),
    ('TOPPADDING', (0,0), (-1,-1), 3),
    ('BOTTOMPADDING', (0,0), (-1,-1), 3),
    ('VALIGN', (0,0), (-1,-1), 'TOP'),
]))
story.append(score_table1)
story.append(Spacer(1, 4*mm))

score_table2 = Table([row2_cards], colWidths=[CONTENT_W/5]*5)
score_table2.setStyle(TableStyle([
    ('LEFTPADDING', (0,0), (-1,-1), 3),
    ('RIGHTPADDING', (0,0), (-1,-1), 3),
    ('TOPPADDING', (0,0), (-1,-1), 3),
    ('BOTTOMPADDING', (0,0), (-1,-1), 3),
    ('VALIGN', (0,0), (-1,-1), 'TOP'),
]))
story.append(score_table2)

story.append(PageBreak())

# ══════════════════════════════════════════════════════════════
# CHAPTER 2: CRITICAL BLOCKERS
# ══════════════════════════════════════════════════════════════
story.append(add_heading('Critical Blockers (Must Fix Before Any Customer)', h1_style, level=0))

story.append(Paragraph(
    'The following five issues are classified as <b>critical blockers</b>. Each one represents a failure mode that would directly '
    'impact intelligence data security, system reliability, or core functionality in a production environment. These are not '
    'nice-to-have improvements; they are hard prerequisites that must be resolved before any enterprise customer interacts '
    'with the system. Attempting to onboard a customer with these issues present would expose both the customer and '
    'the platform to unacceptable risk. The estimated combined remediation time is 7-10 working days for a single senior engineer.',
    body_style))

story.append(Spacer(1, 4*mm))

# Blocker 1
story.append(add_heading('CB-1: No Edge Middleware (Missing Authentication Gate)', h2_style, level=1))
story.append(Paragraph(
    'The file <font face="DejaVuSans">src/middleware.ts</font> does not exist. In Next.js App Router, the middleware file '
    'serves as the edge-level authentication and authorization gate that executes before any API route or page renders. '
    'Without it, there is no centralized layer that can reject unauthenticated requests before they reach route handlers. '
    'While the codebase has a well-built <font face="DejaVuSans">checkApiAuth()</font> function that individual routes can call, '
    'this approach is defense-in-depth at best. The current system relies on every route developer remembering to call '
    '<font face="DejaVuSans">checkApiAuth()</font> at the top of their handler. Our audit found that while 704 references '
    'to checkApiAuth exist across the 334 route files, the monitoring endpoint and several other sensitive routes do not '
    'invoke any form of authentication check, exposing system internals to unauthenticated access.',
    body_style))
story.append(Paragraph(
    'In a serverless deployment on Vercel, the middleware.ts file runs at the Edge layer, providing sub-millisecond '
    'authentication rejection for unauthenticated requests. Without this gate, every unauthenticated request travels the full '
    'cold-start path to the route handler, consuming compute resources and increasing attack surface. The fix is to create '
    'a <font face="DejaVuSans">src/middleware.ts</font> that validates the session cookie on all /api/* routes (except '
    'explicitly public ones like /api/health, /api/ping, /api/webhooks/*), and redirects unauthenticated requests to /login '
    'for page routes. Estimated effort: 1-2 days.',
    body_style))

story.append(Spacer(1, 4*mm))

# Blocker 2
story.append(add_heading('CB-2: In-Memory State Loss in Serverless (AI Memory + Knowledge Graph)', h2_style, level=1))
story.append(Paragraph(
    'Two critical server-side libraries store all their data exclusively in JavaScript Maps with no database persistence: '
    '<font face="DejaVuSans">src/lib/ai-memory.ts</font> (five Maps: memoryStore, layerIndex, categoryIndex, scopeIndex, tagIndex) '
    'and <font face="DejaVuSans">src/lib/ai-knowledge-graph.ts</font> (six Maps: nodeStore, edgeStore, sourceEdgeIndex, targetEdgeIndex, '
    'labelIndex, typeIndex, relationshipIndex, and a nodeIdMap). In a serverless deployment on Vercel, each function invocation '
    'may run in a completely fresh container. This means all AI memory and knowledge graph data is permanently lost on every '
    'cold start. For a platform whose core value proposition is AI-driven relationship intelligence, this is a fundamental '
    'data integrity failure.',
    body_style))
story.append(Paragraph(
    'The ai-memory.ts module contains no <font face="DejaVuSans">import from "@/lib/db"</font> statement whatsoever. '
    'It does not reference Prisma, SQL, or any persistence mechanism. The knowledge graph module does contain optional '
    'fire-and-forget DB writes, but reads only from in-memory Maps, meaning even persisted data is invisible after a restart. '
    'The Prisma schema already has tables for AI-related persistence (AIGenerationAudit, AICallLog, AIUsageLog, IntelligenceActionHistory, '
    'ReasoningContext), suggesting the architecture anticipated persistence but the implementation was never completed. '
    'The fix requires migrating both modules to use Prisma CRUD operations with their existing Maps serving only as optional '
    'read-through caches. Estimated effort: 3-5 days.',
    body_style))

story.append(Spacer(1, 4*mm))

# Blocker 3
story.append(add_heading('CB-3: Mock Implementations in Customer-Facing Integration Endpoints', h2_style, level=1))
story.append(Paragraph(
    'Two integration endpoints that customers would directly use are returning mock success payloads instead of executing '
    'real operations. <font face="DejaVuSans">/api/integrations/automation/route.ts</font> (line 222) contains the comment '
    '"Mock execution -- in production this would dispatch to real handlers" and returns a fabricated execution ID with the text '
    '"executed successfully (mock)". Similarly, <font face="DejaVuSans">/api/integrations/zapier/route.ts</font> (line 163) '
    'states "For now we return a mock success payload" and generates a fake ID. Both endpoints report success to the caller '
    'while performing no actual integration work. If a customer configures a Zapier trigger to create a company when a deal '
    'closes, the system will report success but nothing will happen. This is a silent data loss scenario that would severely '
    'damage customer trust.',
    body_style))
story.append(Paragraph(
    'Additionally, <font face="DejaVuSans">/api/leads/route.ts</font> falls back to loading nine static JSON files from '
    '<font face="DejaVuSans">/public/data/leads-chunk-{0-8}.json</font> when the database is empty. While this may seem like '
    'a reasonable development convenience, it means the production system could serve fabricated data to customers if the '
    'import process has not completed. The fix requires replacing mock handlers with actual integration dispatch logic and '
    'removing the static JSON fallback. Estimated effort: 2-3 days.',
    body_style))

story.append(Spacer(1, 4*mm))

# Blocker 4
story.append(add_heading('CB-4: Monitoring Route Exposes System Internals Without Authentication', h2_style, level=1))
story.append(Paragraph(
    'The <font face="DejaVuSans">/api/monitoring/route.ts</font> endpoint returns detailed system metrics including active alerts, '
    'alert rules, memory usage (process.memoryUsage()), process uptime, and PID without any authentication check. The entire '
    'handler is seven lines of code with zero auth imports. This endpoint exposes operational details that attackers could use '
    'to profile the system: memory consumption reveals application architecture, uptime reveals deployment patterns, and alert '
    'rules reveal the monitoring threshold configuration. Combined with CB-1 (no middleware), this means anyone on the internet '
    'can access this endpoint by simply knowing the URL.',
    body_style))
story.append(Paragraph(
    'The fix is straightforward: add <font face="DejaVuSans">checkApiAuth(request)</font> at the top of the handler and return '
    'a 401 response if authentication fails, following the same pattern used by the other 250+ authenticated routes. '
    'This is a one-line fix but its absence is a critical security gap. Estimated effort: 15 minutes.',
    body_style))

story.append(Spacer(1, 4*mm))

# Blocker 5
story.append(add_heading('CB-5: Knowledge Search Uses SQL ILIKE Instead of Vector Embeddings', h2_style, level=1))
story.append(Paragraph(
    'The <font face="DejaVuSans">/api/knowledge/search/route.ts</font> endpoint uses Prisma <font face="DejaVuSans">contains</font> '
    'queries (which compile to SQL ILIKE) for knowledge search, despite the codebase having a complete pgvector migration '
    '(<font face="DejaVuSans">20260809000000_pgvector_embedding_migration</font>) that creates vector(384) columns on the '
    'Embedding table with both IVFFlat and HNSW indexes. The migration script explicitly states that the retrieval-engine.ts '
    'should write to both JSON and native vector columns, and read from the native vector column when available. However, '
    'the knowledge search endpoint ignores all of this infrastructure and performs simple substring matching.',
    body_style))
story.append(Paragraph(
    'The practical impact is that knowledge search will miss semantically relevant results. A search for "revenue growth" will '
    'not match a document containing "sales increased by 30%". For an AI-powered intelligence platform, this renders the '
    'knowledge base effectively unusable for any non-trivial query. The fix requires rewriting the search to use '
    '<font face="DejaVuSans">SELECT * FROM "Embedding" ORDER BY embedding_vector &lt;=&gt; $query_vector LIMIT $limit</font> '
    'with proper embedding generation at query time. Estimated effort: 2-3 days.',
    body_style))

story.append(PageBreak())

# ══════════════════════════════════════════════════════════════
# CHAPTER 3: HIGH-SEVERITY FINDINGS
# ══════════════════════════════════════════════════════════════
story.append(add_heading('High-Severity Findings', h1_style, level=0))

story.append(Paragraph(
    'Beyond the critical blockers, the following 18 high-severity issues represent significant gaps that would affect '
    'system reliability, developer productivity, or customer experience in production. While not immediate show-stoppers, '
    'these issues compound risk and should be addressed within the first two weeks after the critical blockers are resolved. '
    'They are organized by domain for clarity.',
    body_style))

story.append(add_heading('Security Domain', h2_style, level=1))

sec_findings = [
    {'severity': 'HIGH', 'title': 'No CSRF Protection on State-Changing Endpoints', 'file': 'src/app/api/auth/set-password/route.ts', 'status': 'OPEN'},
    {'severity': 'HIGH', 'title': 'Server-Side Library Imports UI Design Tokens', 'file': 'src/lib/session.ts:16, src/lib/ai-unified-confidence.ts:33', 'status': 'OPEN'},
    {'severity': 'HIGH', 'title': 'Rate Limiter Uses In-Memory Map (Fails in Multi-Instance)', 'file': 'src/lib/rate-limit.ts', 'status': 'OPEN'},
    {'severity': 'HIGH', 'title': 'No Input Validation Directives in API Route Handlers', 'file': '334 API route files', 'status': 'OPEN'},
    {'severity': 'HIGH', 'title': 'Monitoring Alert Notifications Not Implemented', 'file': 'src/lib/monitoring.ts:147 (only console.info)', 'status': 'OPEN'},
    {'severity': 'HIGH', 'title': 'No Encryption at Rest for Sensitive Customer Data', 'file': 'prisma/schema.prisma (no @encrypted annotations)', 'status': 'OPEN'},
]
story.append(finding_table(sec_findings))
story.append(Spacer(1, 3*mm))

story.append(Paragraph(
    'The CSRF gap is particularly notable because the set-password endpoint allows users to set their initial password '
    'without CSRF token validation, meaning a malicious website could trigger password changes through cross-site request '
    'forgery. The server-side import of UI design tokens (<font face="DejaVuSans">tokens</font> from '
    '<font face="DejaVuSans">@/components/intelligence-os/design-tokens</font>) in both session.ts and ai-unified-confidence.ts '
    'will cause runtime errors in serverless environments where UI component bundles are not available. The in-memory rate '
    'limiter in rate-limit.ts stores all counters in a JavaScript Map with a maximum of 100,000 entries, but this state is '
    'never shared between serverless function instances, making rate limiting completely ineffective under load.',
    body_style))

story.append(add_heading('Data Integrity Domain', h2_style, level=1))

data_findings = [
    {'severity': 'HIGH', 'title': 'No Prisma $transaction Usage Anywhere in Codebase', 'file': '0 files found with $transaction', 'status': 'OPEN'},
    {'severity': 'HIGH', 'title': 'query-optimizer.ts References Non-Existent Prisma Fields', 'file': 'src/lib/query-optimizer.ts:62-72', 'status': 'OPEN'},
    {'severity': 'HIGH', 'title': 'Duplicate Merge Has No Transaction (Partial Merge Risk)', 'file': 'src/app/api/duplicates/merge/route.ts', 'status': 'OPEN'},
    {'severity': 'HIGH', 'title': 'Data Import Has No Transaction (Partial Import Risk)', 'file': 'src/app/api/data-import/route.ts', 'status': 'OPEN'},
]
story.append(finding_table(data_findings))
story.append(Spacer(1, 3*mm))

story.append(Paragraph(
    'The absence of Prisma <font face="DejaVuSans">$transaction</font> across the entire codebase is one of the most concerning '
    'findings. Operations like duplicate merging, data import, and batch updates involve multiple database writes that must '
    'either all succeed or all fail. Without transactional guarantees, a failure midway through a merge operation could leave '
    'the database in an inconsistent state with orphaned records, broken references, and corrupted data. The query-optimizer.ts '
    'issue is equally critical: it references field names like <font face="DejaVuSans">name</font> (actual: rawName), '
    '<font face="DejaVuSans">employeeSize</font> (actual: sizeRange), <font face="DejaVuSans">dataFreshness</font> (actual: '
    'lastEnrichedAt), <font face="DejaVuSans">lastUpdatedAt</font> (actual: updatedAt), and <font face="DejaVuSans">jobTitle</font> '
    '(actual: title). Any route using these optimized query helpers will crash at runtime with a Prisma validation error.',
    body_style))

story.append(add_heading('API Quality Domain', h2_style, level=1))

api_findings = [
    {'severity': 'HIGH', 'title': 'Token Counting Returns Zeros in LLM Client', 'file': 'src/lib/llm-client.ts:593-595', 'status': 'OPEN'},
    {'severity': 'HIGH', 'title': 'No Error Handling (try/catch) in Any API Route', 'file': '0 of 334 routes have try/catch', 'status': 'OPEN'},
    {'severity': 'HIGH', 'title': 'No Prisma select: Clauses in 9 Intelligence Routes', 'file': 'src/app/api/intelligence/sprint3/route.ts', 'status': 'PARTIAL'},
    {'severity': 'HIGH', 'title': '19 Prisma Models Have No API Route Access', 'file': 'prisma/schema.prisma (orphaned models)', 'status': 'OPEN'},
    {'severity': 'HIGH', 'title': 'Change-Password Deletes All Sessions Except Current', 'file': 'src/app/api/auth/change-password/route.ts:62', 'status': 'OPEN'},
    {'severity': 'HIGH', 'title': 'TypeScript Compilation Errors in Production Code', 'file': '5+ TS errors in enterprise-theme.ts, ai-unified-confidence.ts', 'status': 'OPEN'},
    {'severity': 'HIGH', 'title': 'No Load Testing Infrastructure', 'file': 'tests/load/ (empty directory)', 'status': 'OPEN'},
    {'severity': 'HIGH', 'title': 'No GDPR Consent Management or Data Export APIs', 'file': 'No GDPR/privacy modules found', 'status': 'OPEN'},
]
story.append(finding_table(api_findings))

story.append(PageBreak())

# ══════════════════════════════════════════════════════════════
# CHAPTER 4: DIMENSION ANALYSIS
# ══════════════════════════════════════════════════════════════
story.append(add_heading('Detailed Dimension Analysis', h1_style, level=0))

# Dimension 1: Security
story.append(add_heading('Dimension 1: Security & Authentication (5/10)', h2_style, level=1))
story.append(Paragraph(
    'The security architecture has strong theoretical foundations but critical implementation gaps. On the positive side, '
    'the codebase implements PBKDF2-SHA256 password hashing with 100,000 iterations (well above the OWASP minimum of 600,000 '
    'for 2024, though acceptable for a 2026 codebase using hardware-accelerated crypto). Session tokens use SHA-256 hashing before '
    'database storage, preventing mass session hijack from database compromise. The RBAC system (rbac.ts at 486 lines) defines '
    'four roles (admin, operator, user, viewer) with 40+ granular permissions, and the api-auth.ts module wires RBAC checks into '
    'the route pipeline via the checkApiAuth() function. The OTP flow uses httpOnly cookies for hash storage with constant-time '
    'comparison, and the login endpoint includes zod-based input validation.',
    body_style))
story.append(Paragraph(
    'However, the negatives are severe. The complete absence of src/middleware.ts means there is no edge-level authentication gate. '
    'No CSRF protection exists on any state-changing endpoint (the withCsrf wrapper is defined but never used in auth routes). '
    'The rate limiter is purely in-memory and fails in multi-instance serverless deployments. The monitoring endpoint exposes '
    'process internals without authentication. Server-side libraries import UI component design tokens, which will crash in '
    'serverless environments. No encryption-at-rest mechanism exists for sensitive intelligence data. The overall security posture '
    'resembles a house with excellent locks on the doors but no walls.',
    body_style))

# Dimension 2: Data Integrity
story.append(add_heading('Dimension 2: Data Integrity & Persistence (5/10)', h2_style, level=1))
story.append(Paragraph(
    'The data model is genuinely impressive in its scope and design. With 128 Prisma models spanning 3,942 lines, the schema '
    'covers companies, contacts, leads, opportunities, pipeline stages, AI governance audit trails, intelligence signals, '
    'knowledge entries, embedding vectors, and much more. Four database migrations have been applied, including a pgvector '
    'migration that adds vector(384) columns with both IVFFlat and HNSW indexes. The schema includes parent-subsidiary '
    'hierarchies, GDPR consent tracking fields, and comprehensive temporal tracking. The OpenAPI specification at 2,113 lines '
    'demonstrates thorough API documentation intent.',
    body_style))
story.append(Paragraph(
    'The critical failures are in the data access layer. Zero Prisma $transaction calls exist anywhere in the codebase, '
    'meaning every multi-step database operation (merges, imports, batch updates) runs without atomicity guarantees. '
    'Two core AI libraries (ai-memory.ts and ai-knowledge-graph.ts) store all state in in-memory Maps with no database '
    'persistence, ensuring complete data loss on every serverless cold start. The query-optimizer module references six '
    'non-existent Prisma field names that will crash any route using them. Knowledge search uses SQL ILIKE despite pgvector '
    'infrastructure being fully migrated. These issues transform a sophisticated data model into one that cannot reliably '
    'store or retrieve data in production.',
    body_style))

# Dimension 3: AI Pipeline
story.append(add_heading('Dimension 3: AI Pipeline & Governance (8/10)', h2_style, level=1))
story.append(Paragraph(
    'This is the most mature dimension of the system and represents DeepMindQ\'s core competitive advantage. '
    'The AI governance module (ai-governance.ts) implements comprehensive hallucination prevention with 15 anti-hallucination '
    'rules, quality gates, and post-generation verification. Both governedAICall() and governedStreamAICall() enforce '
    'pre-flight governance checks before any LLM interaction. The LLM client supports a multi-provider chain with automatic '
    'fallback across NVIDIA, Fireworks, Groq, and Gemini, with cost-aware sub-sorting within each tier. Per-provider rate '
    'limiting (30 RPM) and circuit breaker patterns protect against provider outages.',
    body_style))
story.append(Paragraph(
    'The remaining issues are relatively minor. Token counting in llm-client.ts returns zeros (promptTokens: 0, completionTokens: 0, '
    'totalTokens: 0), which means cost tracking and usage analytics are non-functional. The ai-unified-confidence.ts module '
    'imports UI design tokens, creating a server-side dependency on React component bundles. The AI memory and knowledge graph '
    'persistence issues (covered in CB-2) limit the effectiveness of the governance system because historical context is lost '
    'between sessions. Despite these gaps, the AI pipeline is the one area of the system that would genuinely impress enterprise '
    'customers during a demo.',
    body_style))

# Dimension 4: API Quality
story.append(add_heading('Dimension 4: API Quality & Contract (6/10)', h2_style, level=1))
story.append(Paragraph(
    'With 334 API routes, the API surface is expansive. The api-auth.ts module provides a standardized authentication and RBAC '
    'check that most routes use. The apiHelpers.ts module offers structured response helpers (apiSuccess, apiError, apiPaginated) '
    'and input validation (validateBody, safeInt). The companies route demonstrates the ideal pattern: checkApiAuth for auth, '
    'createCompanySchema (zod) for validation, filterResponseArrayByRole for RBAC data filtering, and logger for audit trailing. '
    'The OpenAPI specification at 2,113 lines shows thorough documentation intent.',
    body_style))
story.append(Paragraph(
    'The issues are significant in scope. The automation and Zapier integration endpoints are entirely mock implementations. '
    'The leads endpoint falls back to static JSON files. Zero routes implement explicit try/catch error handling, meaning any '
    'unhandled exception will propagate as an unformatted 500 error. The query-optimizer\'s non-existent field references will '
    'cause runtime crashes. Nine intelligence routes were found with bare Prisma queries lacking select: clauses, potentially '
    'exposing sensitive fields and degrading query performance. Nineteen Prisma models have no API route access, suggesting '
    'either dead schema or incomplete implementation.',
    body_style))

story.append(add_heading('Dimension 5: Observability & Operations (5/10)', h2_style, level=1))
story.append(Paragraph(
    'The observability stack shows intent but lacks completion. Sentry integration is configured across client, server, and '
    'edge environments (sentry.client.config.ts, sentry.server.config.ts, sentry.edge.config.ts). A monitoring module '
    '(monitoring.ts) defines alert rules with configurable thresholds and notification channel declarations (log, email, slack). '
    'A Prometheus-compatible metrics endpoint was added in Phase 5, exporting 13 metrics. The health endpoint performs database '
    'connectivity probes with timeout handling. The CI/CD pipeline at 807 lines includes comprehensive deployment automation '
    'with staging and production environments.',
    body_style))
story.append(Paragraph(
    'However, the monitoring alert notification system is entirely non-functional. The alert rules declare notification channels '
    '(\'log\', \'email\', \'slack\') but the evaluateAlerts() function only calls console.info(). There is no actual email sending, '
    'Slack webhook posting, or PagerDuty integration. The system will silently log alerts that no human will ever see. '
    'There is no distributed tracing (no OpenTelemetry, no trace IDs in headers), no structured logging format, no log aggregation '
    'configuration, and no runbook documentation. The Prometheus endpoint was added but without Grafana dashboards or alerting rules.',
    body_style))

story.append(add_heading('Dimension 6: Testing (7/10)', h2_style, level=1))
story.append(Paragraph(
    'The testing infrastructure is well-organized and above average for a project at this stage. The test directory contains '
    '207 test files across 15 categories (accessibility, AI, API, audit, database, E2E, functional, integration, security, '
    'smoke, UI, unit, performance, load, M5). There are 23 Vitest configuration profiles targeting specific domains, '
    'including AI governance, AI retrieval, AI framework, security, API, and performance. The CI pipeline runs tests as '
    'blocking checks. Custom ESLint rules (no-ungoverned-llm.js) enforce that no LLM call bypasses governance.',
    body_style))
story.append(Paragraph(
    'The gaps are notable: the load testing directory is empty (0 files), meaning there is no validation that the system '
    'can handle concurrent users. The E2E test suite contains only 4 files for a 334-route API. TypeScript compilation '
    'produces 5+ errors in production code. Many test files appear to be evidence-capturing tests (phase-s3-kno-int-evidence, '
    'phase-s4-kno-learning) that verify specific phase implementations rather than preventing regressions. The absence of '
    'mutation testing or coverage thresholds means untested code paths can silently regress.',
    body_style))

story.append(PageBreak())

story.append(add_heading('Dimension 7: Infrastructure & CI/CD (7/10)', h2_style, level=1))
story.append(Paragraph(
    'The infrastructure layer is solid and deployment-ready. The CI/CD pipeline (ci.yml at 807 lines) includes linting, '
    'type-checking, testing, and build verification. Separate deployment pipelines exist for staging (deploy-staging.yml at '
    '244 lines) and production (deploy-production.yml at 395 lines) with auto-rollback capabilities. A nightly regression '
    'suite (nightly-regression.yml at 164 lines) provides ongoing quality validation. Docker support exists via a 74-line '
    'Dockerfile, and docker-compose.yml (115 lines) provides local development orchestration. Three Terraform files handle '
    'cloud infrastructure provisioning. The build script properly chains Prisma generate, migrate deploy, and Next.js build.',
    body_style))
story.append(Paragraph(
    'Issues include: the vercel.json configuration was missing cron registrations (partially fixed in Phase 5 worklog). '
    'There is no blue/green deployment or canary release strategy in the production pipeline. No infrastructure-as-code '
    'testing (no terraform plan/apply validation in CI). The .env.example is comprehensive at 150 lines, but there is no '
    '.env validation script that checks for missing required variables before deployment. Database backup and disaster '
    'recovery procedures are not documented or automated.',
    body_style))

story.append(add_heading('Dimension 8: Data Model Design (8/10)', h2_style, level=1))
story.append(Paragraph(
    'The Prisma schema is the strongest technical asset of the codebase. With 128 models and 3,942 lines, it represents '
    'a deeply thought-through domain model that covers the full CRM lifecycle: Company, Contact, Lead, Opportunity, Pipeline, '
    'Sequence, Email, plus AI-specific entities (AIGenerationAudit, AICallLog, AIUsageLog, HallucinationCheck), intelligence '
    'entities (CompanySignal, Evidence, IntelligenceValidation, KnowledgeEntry, Embedding), and operational entities '
    '(ImportBatch, DataExport, WebhookConfig). The pgvector migration adds vector search capability with both IVFFlat and '
    'HNSW indexing strategies. Parent-subsidiary company hierarchies, GDPR consent tracking fields, and comprehensive temporal '
    'timestamps demonstrate enterprise-awareness in the design.',
    body_style))
story.append(Paragraph(
    'The main gap is that 19 models have no API route access whatsoever, suggesting either forward-looking schema design or '
    'dead code that should be cleaned up. Additionally, only 4 migrations exist for 128 models, suggesting the schema may have '
    'been created in large batches rather than incrementally, which can make rollback difficult. The schema also lacks certain '
    'enterprise features: no soft-delete pattern (entities use hard deletes), no audit log triggers at the database level, '
    'and no row-level security policies for multi-tenant isolation.',
    body_style))

story.append(add_heading('Dimension 9: Code Quality (6/10)', h2_style, level=1))
story.append(Paragraph(
    'The codebase demonstrates strong organizational patterns. Library files are well-structured with clear module boundaries. '
    'The ai-governance.ts module at 1,000+ lines is thoroughly documented with phase annotations and architectural comments. '
    'ESLint is configured with custom rules including a governance checker that prevents unguarded LLM calls. The codebase '
    'uses TypeScript throughout with consistent patterns for API route handlers. The session management module includes '
    'detailed comments explaining security decisions. The SPA architecture with 9 page shells and 112 lazy-loaded screens '
    'via Zustand state management is a deliberate and well-executed pattern.',
    body_style))
story.append(Paragraph(
    'However, TypeScript compilation produces 5+ errors in production code (enterprise-theme.ts references undefined \'tokens\', '
    'ai-unified-confidence.ts has type mismatches). Server-side libraries import from UI component paths '
    '(session.ts imports from @/components/intelligence-os/design-tokens), which violates the server/client boundary and '
    'will break in serverless deployments. The ai-unified-confidence.ts type error shows that design token values are being '
    'assigned where strings are expected, indicating type definitions are not aligned with actual usage. No pre-commit hooks '
    'or CI gates prevent these errors from reaching production.',
    body_style))

story.append(add_heading('Dimension 10: Compliance & Data Protection (3/10)', h2_style, level=1))
story.append(Paragraph(
    'This is the weakest dimension and represents a significant enterprise readiness gap. While the Prisma schema includes '
    'GDPR-related fields (consentSource, consentDate, consentIp on the Contact model, consentStatus with opt-in/opt-out values), '
    'there are no actual GDPR compliance workflows implemented. There is no data export API that allows customers to download '
    'all their data in a machine-readable format (required by GDPR Article 20). There is no data deletion workflow that removes '
    'all intelligence data upon request (required by GDPR Article 17). There is no cookie consent management, no privacy policy page, '
    'and no data processing agreement documentation.',
    body_style))
story.append(Paragraph(
    'Beyond GDPR, there is no encryption at rest for sensitive intelligence data in the database. The Prisma schema has no '
    '@encrypted annotations or application-level encryption. Database backups are not documented or automated. There is no '
    'audit trail for data access (who accessed what, when). The SOC 2 Type II compliance that enterprise customers typically '
    'require is completely unaddressed. For an Enterprise AI Intelligence Platform handling competitive intelligence, account intelligence, and proprietary business '
    'intelligence, this level of compliance maturity is a blocking issue for enterprise sales cycles.',
    body_style))

story.append(PageBreak())

# ══════════════════════════════════════════════════════════════
# CHAPTER 5: REMEDIATION ROADMAP
# ══════════════════════════════════════════════════════════════
story.append(add_heading('Prioritized Remediation Roadmap', h1_style, level=0))

story.append(Paragraph(
    'The following roadmap prioritizes fixes based on customer impact and implementation dependency order. '
    'Each phase builds on the previous one and is designed to be executed by a single senior full-stack engineer. '
    'The total estimated effort is 25-35 working days. Phases 1-2 (critical blockers) must be completed before any '
    'customer interaction. Phases 3-5 should be completed within the first month of operations.',
    body_style))

story.append(add_heading('Phase 1: Critical Security Fixes (5-7 days)', h2_style, level=1))
p1_items = [
    'Create src/middleware.ts with session validation for all /api/* routes, whitelist public endpoints (health, ping, webhooks, tracking). This is the single highest-impact fix.',
    'Add checkApiAuth(request) to /api/monitoring/route.ts. One-line fix that closes an immediate security hole.',
    'Add withCsrf() wrapper to /api/auth/set-password/route.ts and all other state-changing auth endpoints.',
    'Move design-tokens exports from @/components/intelligence-os/design-tokens to a shared @/lib/design-tokens module that both server and client code can import safely.',
    'Fix query-optimizer.ts field names: name -> rawName, employeeSize -> sizeRange, dataFreshness -> lastEnrichedAt, lastUpdatedAt -> updatedAt, jobTitle -> title, lastValidatedAt -> lastCheckedAt.',
    'Add try/catch error handling to all 334 API routes using a standardized error handler that logs to Sentry and returns structured error responses.',
]
for item in p1_items:
    story.append(Paragraph(f'<bullet>&bull;</bullet> {item}', bullet_style))

story.append(add_heading('Phase 2: Data Integrity Fixes (7-10 days)', h2_style, level=1))
p2_items = [
    'Migrate ai-memory.ts to Prisma persistence: Create AI Memory Item and AI Memory Index tables, implement CRUD operations, use in-memory Maps as optional read-through cache only.',
    'Migrate ai-knowledge-graph.ts to Prisma persistence: Create GraphNode and GraphEdge tables, implement relationship queries, persist all mutations immediately.',
    'Replace mock handlers in /api/integrations/automation/route.ts and /api/integrations/zapier/route.ts with actual integration dispatch logic using a handler registry pattern.',
    'Remove static JSON fallback from /api/leads/route.ts. Return empty array when database has no data, not fabricated records.',
    'Rewrite /api/knowledge/search/route.ts to use pgvector cosine similarity search instead of SQL ILIKE. Generate query embeddings at search time using the existing embedding infrastructure.',
    'Add Prisma $transaction wrapping to all multi-step database operations: duplicate merge, data import, batch updates, sequence enrollment.',
]
for item in p2_items:
    story.append(Paragraph(f'<bullet>&bull;</bullet> {item}', bullet_style))

story.append(add_heading('Phase 3: Operational Readiness (5-7 days)', h2_style, level=1))
p3_items = [
    'Implement actual notification channels in monitoring.ts: integrate SendGrid/Resend for email alerts, Slack webhooks for channel notifications, PagerDuty for critical escalation.',
    'Replace in-memory rate limiter with Redis-backed rate limiting using Upstash Redis (Vercel-compatible).',
    'Fix token counting in llm-client.ts: use provider response headers or tiktoken-based estimation instead of returning zeros.',
    'Create load testing suite using k6 or Artillery: simulate 100 concurrent users, 1000 requests/minute, validate response times and error rates.',
    'Fix TypeScript compilation errors: resolve enterprise-theme.ts tokens references, fix ai-unified-confidence.ts type mismatches.',
    'Add input validation (zod schemas) to all API routes that accept request bodies, using the apiHelpers.validateBody pattern from the companies route.',
]
for item in p3_items:
    story.append(Paragraph(f'<bullet>&bull;</bullet> {item}', bullet_style))

story.append(add_heading('Phase 4: Compliance Foundation (5-7 days)', h2_style, level=1))
p4_items = [
    'Implement GDPR Article 20 (data portability): Create /api/account/data-export endpoint that generates a JSON archive of all intelligence data.',
    'Implement GDPR Article 17 (right to deletion): Create /api/account/data-deletion endpoint that cascades deletion across all customer-related records within a 30-day grace period.',
    'Add encryption at rest for sensitive fields (email, phone) using application-level encryption with a key stored in environment variables.',
    'Implement audit trail for data access: log who accessed what data, when, and from where using the existing AIGenerationAudit pattern extended to CRM data.',
    'Create and display a privacy policy page. Add cookie consent banner. Document data retention policies.',
    'Automate database backups with point-in-time recovery capability. Document disaster recovery procedures.',
]
for item in p4_items:
    story.append(Paragraph(f'<bullet>&bull;</bullet> {item}', bullet_style))

story.append(add_heading('Phase 5: Quality Hardening (3-5 days)', h2_style, level=1))
p5_items = [
    'Add pre-commit hooks that run TypeScript type-checking and ESLint before allowing commits.',
    'Add coverage thresholds to CI pipeline: block merges if coverage drops below 70%.',
    'Create canary deployment strategy in production pipeline: deploy to 10% of traffic, monitor error rates, then promote to 100%.',
    'Build Grafana dashboards for the Prometheus metrics endpoint. Configure alerting rules for critical thresholds.',
    'Add OpenTelemetry distributed tracing: inject trace IDs in middleware, propagate through API routes and LLM calls.',
    'Clean up orphaned Prisma models: either create API routes for the 19 unused models or remove them from the schema.',
]
for item in p5_items:
    story.append(Paragraph(f'<bullet>&bull;</bullet> {item}', bullet_style))

story.append(PageBreak())

# ══════════════════════════════════════════════════════════════
# CHAPTER 6: WHAT IS ACTUALLY DONE VS STILL NEEDED
# ══════════════════════════════════════════════════════════════
story.append(add_heading('What Is Done vs. What Is Still Needed', h1_style, level=0))

story.append(Paragraph(
    'Based on the comprehensive codebase audit, the following table reconciles the actual state of each major system '
    'against what a enterprise customer would expect. This is the definitive gap analysis showing precisely what exists, '
    'what works, and what must still be built.',
    body_style))

story.append(Spacer(1, 4*mm))

recon_data = [
    [Paragraph('<b>System</b>', ParagraphStyle('RH', fontName='DejaVuSans-Bold', fontSize=8.5, leading=12, textColor=colors.white)),
     Paragraph('<b>Architecture</b>', ParagraphStyle('RH', fontName='DejaVuSans-Bold', fontSize=8.5, leading=12, textColor=colors.white)),
     Paragraph('<b>Implementation</b>', ParagraphStyle('RH', fontName='DejaVuSans-Bold', fontSize=8.5, leading=12, textColor=colors.white)),
     Paragraph('<b>Verdict</b>', ParagraphStyle('RH', fontName='DejaVuSans-Bold', fontSize=8.5, leading=12, textColor=colors.white))],
]

recon_rows = [
    ('Core Intelligence', 'Models + Routes + Screens', 'Companies, Contacts, Pipeline, Dashboard all have real Prisma queries. Screens render data.', 'WORKS'),
    ('AI Governance', '15 hallucination rules, quality gates', 'governedAICall + governedStreamAICall fully implemented', 'WORKS'),
    ('LLM Routing', '4 providers, fallback, circuit breaker', 'Cost-aware ordering, health pings, 30 RPM rate limits', 'WORKS'),
    ('Authentication', 'PBKDF2, SHA-256 sessions, RBAC', 'Login, OTP, sessions all functional. Missing middleware + CSRF.', 'PARTIAL'),
    ('Integration APIs', 'Zapier, Automation handlers', 'Both return mock payloads. Zero real execution.', 'MOCK'),
    ('AI Memory', 'MemoryItem model, layer/category indices', '100% in-memory Maps. Zero DB persistence.', 'BROKEN'),
    ('Knowledge Graph', 'Node/Edge stores, 7 indexes', '100% in-memory Maps. Optional fire-and-forget writes.', 'BROKEN'),
    ('Knowledge Search', 'pgvector migrated, HNSW+IVFFlat indexes', 'Search uses SQL ILIKE, ignores vector columns.', 'BROKEN'),
    ('Monitoring Alerts', 'Rules defined, notification channels declared', 'Only console.info(). No email/Slack/PagerDuty.', 'WIRED ONLY'),
    ('Rate Limiting', 'Per-endpoint configurable limits', 'In-memory Map. Fails in multi-instance serverless.', 'BROKEN'),
    ('Observability', 'Sentry client+server+edge, Prometheus', 'No distributed tracing, no dashboards, no log aggregation.', 'PARTIAL'),
    ('CI/CD', '807-line pipeline, staging+prod', 'Comprehensive but no canary, no IaC testing.', 'GOOD'),
    ('Testing', '254 tests, 23 vitest configs', 'No load tests, 4 E2E files, no coverage gates.', 'ADEQUATE'),
    ('Data Model', '128 models, 4 migrations, pgvector', '19 orphaned models, no soft-delete, no row-level security.', 'GOOD'),
    ('Compliance', 'GDPR fields in Contact model', 'No data export API, no deletion workflow, no encryption at rest.', 'NOT STARTED'),
]

cell_s = ParagraphStyle('Cell', fontName='FreeSerif', fontSize=8.5, leading=12, textColor=TEXT_PRIMARY)
cell_pass = ParagraphStyle('CellPass', fontName='DejaVuSans-Bold', fontSize=8, leading=11, textColor=SEM_SUCCESS)
cell_warn = ParagraphStyle('CellWarn', fontName='DejaVuSans-Bold', fontSize=8, leading=11, textColor=SEM_WARNING)
cell_err = ParagraphStyle('CellErr', fontName='DejaVuSans-Bold', fontSize=8, leading=11, textColor=SEM_ERROR)
cell_ok = ParagraphStyle('CellOK', fontName='DejaVuSans-Bold', fontSize=8, leading=11, textColor=SEM_INFO)

for system, arch, impl, verdict in recon_rows:
    verdict_style = cell_pass if verdict == 'WORKS' else cell_err if verdict in ('BROKEN', 'MOCK', 'NOT STARTED') else cell_warn if verdict == 'PARTIAL' else cell_ok
    recon_data.append([
        Paragraph(system, ParagraphStyle('CellB', fontName='FreeSerif-Bold', fontSize=8.5, leading=12, textColor=TEXT_PRIMARY)),
        Paragraph(arch, cell_s),
        Paragraph(impl, cell_s),
        Paragraph(verdict, verdict_style),
    ])

recon_cols = [28*mm, 38*mm, 54*mm, 20*mm]
recon_t = Table(recon_data, colWidths=recon_cols, repeatRows=1)
recon_style = [
    ('BACKGROUND', (0,0), (-1,0), HEADER_FILL),
    ('TEXTCOLOR', (0,0), (-1,0), colors.white),
    ('LEFTPADDING', (0,0), (-1,-1), 5),
    ('RIGHTPADDING', (0,0), (-1,-1), 5),
    ('TOPPADDING', (0,0), (-1,-1), 4),
    ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ('GRID', (0,0), (-1,-1), 0.3, BORDER_COLOR),
    ('VALIGN', (0,0), (-1,-1), 'TOP'),
]
for i in range(1, len(recon_data)):
    bg = TABLE_STRIPE if i % 2 == 0 else colors.white
    recon_style.append(('BACKGROUND', (0, i), (-1, i), bg))
recon_t.setStyle(TableStyle(recon_style))
story.append(recon_t)

story.append(PageBreak())

# ══════════════════════════════════════════════════════════════
# CHAPTER 7: FINAL RECOMMENDATION
# ══════════════════════════════════════════════════════════════
story.append(add_heading('Final Recommendation', h1_style, level=0))

story.append(Paragraph(
    '<b>Do not onboard a enterprise customer until Phases 1 and 2 of the remediation roadmap are complete.</b> '
    'The five critical blockers identified in this report represent real, demonstrable failure modes that would affect '
    'intelligence data security, system reliability, and core functionality. Onboarding a customer with these issues present '
    'would not only damage the enterprise customer relationship but could also create legal liability if intelligence data is lost or '
    'exposed due to the identified vulnerabilities.',
    body_style))

story.append(Paragraph(
    'That said, the architectural foundation is genuinely strong. The AI governance system, RBAC framework, multi-provider '
    'LLM routing, and data model design reflect serious engineering talent and deep domain understanding. The gap between '
    'the current state and production readiness is not an architectural redesign; it is focused implementation work on '
    'specific, well-defined problems. A senior full-stack engineer working through the roadmap sequentially should be able '
    'to resolve all critical and high-severity issues within 25-35 working days.',
    body_style))

story.append(Paragraph(
    'After completing the roadmap, the system should undergo a formal penetration test by an independent security firm, '
    'a SOC 2 Type I audit preparation, and a minimum 7-day soak test with synthetic production traffic before customer '
    'onboarding. These validation steps are standard for enterprise SaaS platforms and will provide the confidence needed '
    'to support a enterprise customer without risking the platform\'s reputation.',
    body_style))

story.append(Spacer(1, 8*mm))

# Final score summary
final_box_text = (
    '<b>Current Score: 61/100 (Needs Significant Work)</b><br/>'
    'Target Score: 85/100 (Enterprise Ready)<br/>'
    'Estimated Remediation: 25-35 working days<br/>'
    'Critical Blockers: 5 | High Severity: 18 | Total Findings: 23<br/><br/>'
    '<b>Recommended Action: Complete Phases 1-2 (12-17 days), then reassess for controlled enterprise deployment '
    'with enhanced monitoring.</b>'
)
story.append(callout_box(final_box_text, CARD_BG, ACCENT, TEXT_PRIMARY))


# ══════════════════════════════════════════════════════════════
# BUILD
# ══════════════════════════════════════════════════════════════
doc.multiBuild(story, onLaterPages=page_footer, onFirstPage=page_footer)
print(f'PDF generated: {OUTPUT_PATH}')
print(f'File size: {os.path.getsize(OUTPUT_PATH) / 1024:.1f} KB')
