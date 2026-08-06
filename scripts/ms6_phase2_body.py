#!/usr/bin/env python3
"""
DeepMindQ MS6 Phase 2 — Design System Foundation
Deliverables A-D: Design Tokens, Component Library Architecture,
Interaction Pattern Library, Emotional Copy Library Expansion
"""

import sys, os, hashlib, platform
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, inch, cm
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.lib import colors
from reportlab.platypus import (
    Paragraph, Spacer, Table, TableStyle, PageBreak,
    KeepTogether, HRFlowable, Image
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.platypus import SimpleDocTemplate
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# FONT REGISTRATION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
_IS_MAC = platform.system() == 'Darwin'
FONT_DIR = os.path.expanduser('~/.openclaw/workspace/fonts') if _IS_MAC else '/usr/share/fonts'

pdfmetrics.registerFont(TTFont('NotoSerifSC', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('NotoSerifSC-Bold', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Bold.ttf'))
# NotoSansSC variable font is not supported by ReportLab; using NotoSerifSC for CJK fallback
pdfmetrics.registerFont(TTFont('FreeSerif', f'{FONT_DIR}/truetype/freefont/FreeSerif.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-Bold', f'{FONT_DIR}/truetype/freefont/FreeSerifBold.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-Italic', f'{FONT_DIR}/truetype/freefont/FreeSerifItalic.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-BoldItalic', f'{FONT_DIR}/truetype/freefont/FreeSerifBoldItalic.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans', f'{FONT_DIR}/truetype/dejavu/DejaVuSansMono.ttf'))

registerFontFamily('NotoSerifSC', normal='NotoSerifSC', bold='NotoSerifSC-Bold')
# NotoSansSC family skipped (variable font incompatible)
registerFontFamily('FreeSerif', normal='FreeSerif', bold='FreeSerif-Bold', italic='FreeSerif-Italic', boldItalic='FreeSerif-BoldItalic')
registerFontFamily('DejaVuSans', normal='DejaVuSans', bold='DejaVuSans')

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# CASCADE PALETTE (Dark Mode — Premium Enterprise)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PAGE_BG       = colors.HexColor('#0e0e0d')
SECTION_BG    = colors.HexColor('#1d1c19')
CARD_BG       = colors.HexColor('#262520')
TABLE_STRIPE  = colors.HexColor('#171615')
HEADER_FILL   = colors.HexColor('#3f3a2a')
COVER_BLOCK   = colors.HexColor('#38352b')
BORDER        = colors.HexColor('#635a40')
ICON          = colors.HexColor('#b5a576')
ACCENT        = colors.HexColor('#dec886')
ACCENT_2      = colors.HexColor('#6b4dc5')
TEXT_PRIMARY   = colors.HexColor('#e6e5e3')
TEXT_MUTED     = colors.HexColor('#85827b')
SEM_SUCCESS   = colors.HexColor('#7ab58d')
SEM_WARNING   = colors.HexColor('#c5a76b')
SEM_ERROR     = colors.HexColor('#c16c65')
SEM_INFO      = colors.HexColor('#819db8')

# DeepMindQ Design System Colors (from MS6 Stage 1)
DMQ_BG_DEEP      = '#060810'
DMQ_BG           = '#0a0d14'
DMQ_BG_ELEVATED  = '#111520'
DMQ_BG_CARD      = '#161c2a'
DMQ_BG_SURFACE   = '#1c2336'
DMQ_BORDER       = '#252e42'
DMQ_BORDER_LIGHT = '#2d3854'
DMQ_PRIMARY       = '#e8ecf4'
DMQ_PRIMARY_DIM   = '#8b95ad'
DMQ_ACCENT        = '#3b82f6'
DMQ_ACCENT_2      = '#8b5cf6'
DMQ_SIGNAL_BLUE   = '#3b82f6'
DMQ_OPPORTUNITY   = '#a855f7'
DMQ_RISK_RED      = '#ef4444'
DMQ_ENRICHMENT    = '#06b6d4'
DMQ_SUCCESS_GREEN = '#22c55e'
DMQ_WARNING_AMBER = '#f59e0b'

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# STYLES
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
styles = {}

# Body styles
styles['body'] = ParagraphStyle(
    name='Body', fontName='FreeSerif', fontSize=10.5, leading=18,
    alignment=TA_JUSTIFY, textColor=TEXT_PRIMARY, spaceAfter=6
)
styles['body_muted'] = ParagraphStyle(
    name='BodyMuted', fontName='FreeSerif', fontSize=10.5, leading=18,
    alignment=TA_JUSTIFY, textColor=TEXT_MUTED, spaceAfter=6
)

# Heading styles
styles['h1'] = ParagraphStyle(
    name='H1', fontName='FreeSerif-Bold', fontSize=22, leading=28,
    textColor=ACCENT, spaceBefore=24, spaceAfter=12, letterSpacing=-0.02
)
styles['h2'] = ParagraphStyle(
    name='H2', fontName='FreeSerif-Bold', fontSize=16, leading=22,
    textColor=TEXT_PRIMARY, spaceBefore=18, spaceAfter=8
)
styles['h3'] = ParagraphStyle(
    name='H3', fontName='FreeSerif-Bold', fontSize=13, leading=18,
    textColor=ICON, spaceBefore=12, spaceAfter=6
)
styles['h4'] = ParagraphStyle(
    name='H4', fontName='FreeSerif-Bold', fontSize=11, leading=16,
    textColor=TEXT_PRIMARY, spaceBefore=8, spaceAfter=4
)

# Special styles
styles['kicker'] = ParagraphStyle(
    name='Kicker', fontName='FreeSerif', fontSize=9, leading=12,
    textColor=TEXT_MUTED, letterSpacing=2, textTransform='uppercase'
)
styles['caption'] = ParagraphStyle(
    name='Caption', fontName='FreeSerif-Italic', fontSize=9, leading=13,
    textColor=TEXT_MUTED, spaceAfter=6, alignment=TA_LEFT
)
styles['code'] = ParagraphStyle(
    name='Code', fontName='DejaVuSans', fontSize=9, leading=13,
    textColor=ACCENT, backColor=CARD_BG, leftIndent=12, rightIndent=12,
    spaceBefore=4, spaceAfter=4, borderPadding=6
)
styles['callout'] = ParagraphStyle(
    name='Callout', fontName='FreeSerif-Italic', fontSize=11, leading=17,
    textColor=ACCENT, leftIndent=24, borderColor=ACCENT, borderWidth=2,
    borderPadding=8, spaceBefore=8, spaceAfter=8
)
styles['bullet'] = ParagraphStyle(
    name='Bullet', fontName='FreeSerif', fontSize=10.5, leading=18,
    textColor=TEXT_PRIMARY, leftIndent=24, bulletIndent=12, spaceAfter=3,
    bulletFontName='FreeSerif', bulletFontSize=10.5
)
styles['table_header'] = ParagraphStyle(
    name='TableHeader', fontName='FreeSerif-Bold', fontSize=9.5, leading=13,
    textColor=colors.white, alignment=TA_LEFT
)
styles['table_cell'] = ParagraphStyle(
    name='TableCell', fontName='FreeSerif', fontSize=9, leading=13,
    textColor=TEXT_PRIMARY, alignment=TA_LEFT
)
styles['table_cell_small'] = ParagraphStyle(
    name='TableCellSmall', fontName='DejaVuSans', fontSize=8, leading=12,
    textColor=TEXT_MUTED, alignment=TA_LEFT
)

# TOC styles
toc_level0 = ParagraphStyle(
    name='TOC0', fontName='FreeSerif-Bold', fontSize=12, leading=20,
    textColor=TEXT_PRIMARY, leftIndent=12
)
toc_level1 = ParagraphStyle(
    name='TOC1', fontName='FreeSerif', fontSize=10, leading=18,
    textColor=TEXT_MUTED, leftIndent=36
)

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# HELPERS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def add_heading(text, style_name, level=0):
    key = f'h_{hashlib.md5(text.encode()).hexdigest()[:8]}'
    p = Paragraph(f'<a name="{key}"/>{text}', styles[style_name])
    p.bookmark_name = key
    p.bookmark_level = level
    p.bookmark_text = text
    p.bookmark_key = key
    return p

def body(text):
    return Paragraph(text, styles['body'])

def body_muted(text):
    return Paragraph(text, styles['body_muted'])

def h1(text):
    return add_heading(text, 'h1', 0)

def h2(text):
    return add_heading(text, 'h2', 1)

def h3(text):
    return add_heading(text, 'h3', 1)

def h4(text):
    return add_heading(text, 'h4', 1)

def kicker(text):
    return Paragraph(text, styles['kicker'])

def caption(text):
    return Paragraph(text, styles['caption'])

def code_block(text):
    return Paragraph(text, styles['code'])

def callout(text):
    return Paragraph(text, styles['callout'])

def bullet(text):
    return Paragraph(f'<bullet>&bull;</bullet>{text}', styles['bullet'])

def spacer(pts=12):
    return Spacer(1, pts)

def hr():
    return HRFlowable(width="100%", thickness=0.5, color=BORDER, spaceAfter=12, spaceBefore=12)

def make_table(headers, rows, col_widths=None):
    """Create a styled table with header and data rows."""
    header_row = [Paragraph(h, styles['table_header']) for h in headers]
    data = [header_row]
    for row in rows:
        data.append([Paragraph(str(c), styles['table_cell']) for c in row])
    if col_widths is None:
        col_widths = [None] * len(headers)
    t = Table(data, colWidths=col_widths, repeatRows=1)
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), HEADER_FILL),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'FreeSerif-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9.5),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('TOPPADDING', (0, 0), (-1, 0), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
        ('TOPPADDING', (0, 1), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, TABLE_STRIPE]),
    ]
    t.setStyle(TableStyle(style_cmds))
    return t

def make_table_no_header(rows, col_widths=None):
    """Table without header row."""
    data = []
    for row in rows:
        data.append([Paragraph(str(c), styles['table_cell']) for c in row])
    if col_widths is None:
        col_widths = [None] * len(rows[0])
    t = Table(data, colWidths=col_widths)
    style_cmds = [
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]
    t.setStyle(TableStyle(style_cmds))
    return t

def safe_keep(elements):
    """Keep elements together if total height is reasonable."""
    total_h = sum(e.wrap(A4[0] - 2*inch, A4[1])[1] for e in elements)
    if total_h <= A4[1] * 0.4:
        return [KeepTogether(elements)]
    elif len(elements) >= 2:
        return [KeepTogether(elements[:2])] + list(elements[2:])
    return list(elements)

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TOC DOC TEMPLATE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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

    def afterPage(self):
        self.page_count_offset += 1

# Page template callback
def page_template(canvas, doc):
    canvas.saveState()
    page_num = canvas.getPageNumber()
    canvas.setFont('FreeSerif', 8)
    canvas.setFillColor(TEXT_MUTED)
    canvas.drawRightString(A4[0] - inch, 0.5 * inch, f"MS6 Phase 2  |  Design System Foundation")
    canvas.drawString(inch, 0.5 * inch, f"{page_num}")
    canvas.restoreState()

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# BUILD DOCUMENT
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT_PATH = '/home/z/my-project/download/DeepMindQ_MS6_Design_System_Foundation_body.pdf'

doc = TocDocTemplate(
    OUTPUT_PATH,
    pagesize=A4,
    leftMargin=inch,
    rightMargin=inch,
    topMargin=0.8*inch,
    bottomMargin=inch,
    title='DeepMindQ Design System Foundation',
    author='DeepMindQ Intelligence Platform',
    subject='MS6 Phase 2 — Design Tokens, Component Library, Interaction Patterns, Copy Library'
)

story = []

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TABLE OF CONTENTS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
story.append(Paragraph('Table of Contents', styles['h1']))
story.append(spacer(8))
toc = TableOfContents()
toc.levelStyles = [toc_level0, toc_level1]
story.append(toc)
story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════
# DELIVERABLE A: DESIGN TOKENS SYSTEM
# ═══════════════════════════════════════════════════════════════

story.append(h1('Deliverable A: Design Tokens System'))
story.append(body(
    'The DeepMindQ Design Tokens System is the single source of truth for all visual and interactive properties across the Intelligence Platform. '
    'Every color, spacing value, typographic scale, shadow depth, and motion duration used in production code must reference these tokens. '
    'No hardcoded values are permitted outside this system. The token architecture follows a three-tier model: '
    'Global Tokens define primitive values, Semantic Tokens assign meaning to those primitives, and Component Tokens '
    'apply semantic values to specific UI elements. This layered approach ensures consistency while allowing systematic theming and future adaptation.'
))
story.append(body(
    'The design token system is locked as part of MS6 and becomes non-negotiable for all subsequent milestones (MS7 through MS11). '
    'Any deviation requires formal review and approval through the design governance process. The tokens are optimized for the Premium Enterprise Intelligence '
    'experience defined in Stage 1: dark, confident, precise, and aligned with the "Intelligence as Executive Briefing" philosophy. '
    'Each token family below includes not just the value definitions but also the rationale, usage rules, and forbidden patterns that prevent visual drift.'
))

# A.1 Color System
story.append(h2('A.1 Color System'))
story.append(body(
    'The DeepMindQ color system is designed around a dark enterprise palette that conveys authority, intelligence, and calm confidence. '
    'Unlike typical SaaS applications that use light backgrounds with bright accents, our palette reflects the Intelligence as Executive Briefing philosophy: '
    'the interface should feel like a high-end intelligence briefing terminal, not a consumer app. The system comprises five color categories: '
    'Background Layer (surface hierarchy), Primary Palette (text and foreground), Semantic States (intelligence, confidence, risk, success, warning, error), '
    'Signal Palette (actionable indicators), and Interactive Palette (hover, focus, active states). Each category has strict opacity rules to maintain '
    'visual hierarchy and prevent the color saturation chaos common in poorly designed dark themes.'
))

story.append(h3('Background Layer'))
story.append(body(
    'The background layer creates depth through five distinct surface levels. From deepest to shallowest, these surfaces guide the eye '
    'through the information hierarchy. The deepest surface (bg-deep) serves as the page-level background, while progressively lighter surfaces '
    'create card elevation, modal overlays, and tooltip containers. The gap between adjacent surface levels is intentionally small (3-5% lightness '
    'difference) to avoid harsh contrast boundaries. All background tokens use blue-tinted dark values rather than pure gray to reduce eye strain '
    'during extended intelligence briefings, which may last 30-60 minutes during morning protocol reviews.'
))

bg_headers = ['Token', 'Value', 'Usage', 'Notes']
bg_rows = [
    ['bg-deep', '#060810', 'Page background, deepest surface', 'Blue-tinted black for reduced eye strain'],
    ['bg', '#0a0d14', 'Primary content area', 'Default viewport background'],
    ['bg-elevated', '#111520', 'Elevated panels, modals', 'Subtle lift from bg'],
    ['bg-card', '#161c2a', 'Card surfaces, containers', 'Standard card elevation'],
    ['bg-surface', '#1c2336', 'Input fields, dropdowns', 'Highest standard surface'],
]
story.append(make_table(bg_headers, bg_rows))
story.append(spacer(12))

story.append(h3('Primary Palette'))
story.append(body(
    'The primary palette defines all text and foreground colors. The primary text color uses a warm white (#e8ecf4) rather than pure white to avoid '
    'glare on dark backgrounds. A dimmed variant supports secondary and tertiary text. The accent color (#3b82f6) is used sparingly for interactive '
    'elements and intelligence signals. This blue was specifically chosen over alternatives because it aligns with the trust associations of enterprise '
    'intelligence platforms and maintains WCAG AAA contrast ratios against all background surfaces. The secondary accent (#8b5cf6, purple) supports '
    'opportunity signals and AI-generated content differentiation.'
))

pal_headers = ['Token', 'Value', 'Usage']
pal_rows = [
    ['primary', '#e8ecf4', 'Main text, headings, labels'],
    ['primary-dim', '#8b95ad', 'Secondary text, descriptions, meta'],
    ['accent', '#3b82f6', 'Interactive elements, intelligence signals, CTAs'],
    ['accent-secondary', '#8b5cf6', 'AI content, opportunity indicators'],
    ['border', '#252e42', 'Standard borders, dividers'],
    ['border-light', '#2d3854', 'Subtle borders, card outlines'],
]
story.append(make_table(pal_headers, pal_rows))
story.append(spacer(12))

story.append(h3('Semantic State Colors'))
story.append(body(
    'Semantic state colors communicate intelligence, risk, and system status. Each color has been calibrated for accessibility against the dark '
    'background palette, with minimum contrast ratios of 4.5:1 for normal text and 3:1 for large text. The intelligence states are unique to DeepMindQ: '
    'they represent the quality and nature of AI-derived insights rather than traditional UI states. Signal Blue represents confirmed intelligence, '
    'Opportunity Purple indicates AI-identified business opportunities, Risk Red flags potential threats, Enrichment Cyan shows data enrichment actions, '
    'and Success Green confirms completed actions. Each semantic color includes three opacity variants (low, medium, high) for background, text, and icon usage.'
))

state_headers = ['Semantic', 'Token', 'Value', 'Usage Context']
state_rows = [
    ['Signal/Intelligence', 'signal-blue', '#3b82f6', 'Confirmed signals, intelligence alerts'],
    ['Opportunity', 'opportunity-purple', '#a855f7', 'AI-identified opportunities, suggestions'],
    ['Risk', 'risk-red', '#ef4444', 'Threats, data quality issues, risks'],
    ['Enrichment', 'enrichment-cyan', '#06b6d4', 'Data enrichment, updates available'],
    ['Success', 'success-green', '#22c55e', 'Completed actions, verified data, goals met'],
    ['Warning', 'warning-amber', '#f59e0b', 'Attention needed, stale data, low confidence'],
    ['Error', 'error-red', '#ef4444', 'System errors, failed actions, broken integrations'],
]
story.append(make_table(state_headers, state_rows))
story.append(spacer(12))

story.append(h3('Confidence and Trust Indicator Colors'))
story.append(body(
    'Trust visualization is a core design principle from Stage 1. The confidence color scale communicates data reliability at a glance without requiring '
    'the user to read numerical scores. This five-level scale maps directly to the Trust Metadata Framework defined in M5: Verified (highest trust), '
    'High Confidence, Medium Confidence, Low Confidence, and Unverified (lowest trust). Each level has a unique color and badge variant in the component library. '
    'The colors are designed to work in both standalone badge mode and as background tints in intelligence cards, ensuring the trust level is '
    'visible regardless of display context. The gradient from green through amber to red follows universal traffic-light conventions, reducing the cognitive '
    'cost of interpretation for executive users who may spend only seconds scanning intelligence summaries.'
))

conf_headers = ['Trust Level', 'Color', 'Hex', 'Badge Style']
conf_rows = [
    ['Verified', 'Green', '#22c55e', 'Solid green, checkmark icon'],
    ['High Confidence', 'Teal', '#14b8a6', 'Teal border, shield icon'],
    ['Medium Confidence', 'Amber', '#f59e0b', 'Amber border, alert icon'],
    ['Low Confidence', 'Orange', '#f97316', 'Orange border, warning icon'],
    ['Unverified', 'Gray', '#6b7280', 'Gray dashed border, question icon'],
]
story.append(make_table(conf_headers, conf_rows))
story.append(spacer(12))

story.append(h3('Color Usage Rules'))
story.append(body(
    'The following rules govern color usage across all DeepMindQ interfaces. Violation of these rules constitutes a design defect and must be corrected '
    'before production deployment. These rules are derived from the 15 Core Design Patterns locked in Stage 1 and enforce the premium enterprise '
    'intelligence aesthetic consistently.'
))
rules = [
    'Never use pure white (#ffffff) for body text. Always use the warm primary (#e8ecf4) to avoid glare.',
    'Accent blue (#3b82f6) must never cover more than 15% of any viewport. It is an attention signal, not a background.',
    'Semantic colors must only be used for their defined purpose. Risk red must never indicate success.',
    'Background surface transitions must follow the five-level hierarchy. Never skip levels (e.g., bg to bg-surface directly).',
    'All color opacity variants must use the predefined rgba values. Never create ad-hoc opacity combinations.',
    'In a single card component, maximum two semantic colors are permitted to avoid visual chaos.',
    'The accent-secondary (purple) is exclusively for AI-generated or AI-identified content. Never use it for manual user actions.',
]
for r in rules:
    story.append(bullet(r))
story.append(spacer(12))

# A.2 Typography System
story.append(h2('A.2 Typography System'))
story.append(body(
    'The DeepMindQ typography system uses Inter as the primary typeface across all weights (300-900). Inter was selected for its exceptional legibility '
    'at small sizes, its comprehensive weight range enabling fine-grained visual hierarchy, and its neutral geometric character that supports the '
    'authoritative intelligence briefing aesthetic. JetBrains Mono is reserved exclusively for numerical data, timestamps, confidence scores, and '
    'technical identifiers. This dual-family approach ensures that numerical data is immediately distinguishable from prose content, a critical '
    'requirement for executive users scanning intelligence briefings where a "72" confidence score and the text "seventy-two" occupy different cognitive channels.'
))

story.append(h3('Type Scale'))
story.append(body(
    'The type scale follows a modified major third ratio (1.25) to create clear hierarchy between content levels while maintaining readability. '
    'Each level has a defined purpose, weight, and line-height. The clamp() CSS function ensures responsive sizing across viewport widths. '
    'Display and Mega sizes are reserved exclusively for cover pages, hero sections, and key metric callouts, never for standard interface text.'
))

typo_headers = ['Level', 'Token', 'Size (clamp)', 'Weight', 'Purpose']
typo_rows = [
    ['Mega', 'fs-mega', '3rem - 6vw - 5rem', '900 (Black)', 'Hero metrics, cover stats only'],
    ['Display', 'fs-display', '2.5rem - 5vw - 3.5rem', '800 (ExtraBold)', 'Section heroes, key data points'],
    ['H1', 'fs-h1', '1.75rem - 3.5vw - 2.25rem', '700 (Bold)', 'Page titles, major section headings'],
    ['H2', 'fs-h2', '1.375rem - 2.5vw - 1.75rem', '600 (SemiBold)', 'Subsection headings'],
    ['H3', 'fs-h3', '1.125rem - 2vw - 1.375rem', '600 (SemiBold)', 'Card titles, component headers'],
    ['Body', 'fs-body', '0.9375rem - 1.5vw - 1.0625rem', '400 (Regular)', 'Primary content, descriptions'],
    ['Small', 'fs-small', '0.8125rem - 1.2vw - 0.9375rem', '500 (Medium)', 'Captions, secondary text'],
    ['Micro', 'fs-micro', '0.6875rem - 1vw - 0.8125rem', '400 (Regular)', 'Badges, timestamps, meta labels'],
]
story.append(make_table(typo_headers, typo_rows))
story.append(spacer(12))

story.append(h3('Line Height and Letter Spacing'))
story.append(body(
    'Line height and letter spacing are as critical as font size for readability in intelligence interfaces. Tight line heights (1.2-1.35) are reserved '
    'for headings where vertical space is at a premium and the user scans rather than reads. Normal line height (1.6) supports sustained reading of '
    'intelligence briefings and evidence chains. Relaxed line height (1.75) is used for multi-paragraph analysis content where comprehension '
    'is more important than information density. Letter spacing follows the inverse rule: large text (display, H1) uses negative tracking (-0.02em) '
    'for optical tightness, while small text (micro, badges) uses positive tracking (0.1-0.15em) for clarity at small sizes.'
))

lh_headers = ['Token', 'Value', 'Usage']
lh_rows = [
    ['lh-tight', '1.2', 'Display text, mega stats'],
    ['lh-snug', '1.35', 'Headings (H1-H3)'],
    ['lh-normal', '1.6', 'Body text, card content'],
    ['lh-relaxed', '1.75', 'Long-form analysis, evidence chains'],
    ['ls-tight', '-0.02em', 'Display, H1 headings'],
    ['ls-normal', '0', 'Body text, H3'],
    ['ls-wide', '0.05em', 'Small text, captions'],
    ['ls-wider', '0.1em', 'Micro text, badges'],
    ['ls-mega', '0.15em', 'Badge labels, uppercase text'],
]
story.append(make_table(lh_headers, lh_rows))
story.append(spacer(12))

story.append(h3('Font Family Rules'))
story.append(body(
    'The font family assignments are strict and non-negotiable. Inter handles all prose content from display headings through body text to micro labels. '
    'JetBrains Mono is the exclusive home for numerical data: confidence scores (72%), currency values ($1.2B), timestamps (2 hours ago), dates (Aug 6, 2026), '
    'and technical identifiers (CRM-0042). This separation ensures that executive users can quickly identify data points within prose. '
    'The font-family token for headings and body is identical (Inter) but differentiated by weight, size, and spacing, creating a unified typographic voice '
    'that avoids the common dark-theme pitfall of too many competing typefaces.'
))

ff_rules = [
    'Inter (300-900): All prose, headings, labels, buttons, navigation, tooltips.',
    'JetBrains Mono (400-600): All numerical data, confidence scores, timestamps, IDs, code snippets.',
    'Never use JetBrains Mono for prose content (sentences, descriptions, headings).',
    'Never use Inter for standalone numerical data points that should be scannable.',
    'Font weight 300 (Light) is reserved for subtitles and ghost text only, never for interactive elements.',
    'Font weight 900 (Black) is reserved exclusively for mega/display sizes and key metric callouts.',
]
for r in ff_rules:
    story.append(bullet(r))
story.append(spacer(12))

# A.3 Spacing System
story.append(h2('A.3 Spacing System'))
story.append(body(
    'The spacing system uses an 8px base grid with a 4px minimum unit. All spacing values are multiples of 4px, creating a consistent rhythm '
    'across the entire interface. The spacing tokens replace all ad-hoc margin and padding values. This system is particularly critical for intelligence '
    'cards where consistent internal spacing ensures visual alignment across cards of varying content length. The system includes 8 standard tokens '
    'from 4px (xs) to 96px (4xl), covering all spacing needs from tight badge padding to generous section breaks. A common anti-pattern in enterprise '
    'interfaces is inconsistent spacing between cards; this system eliminates that drift by providing a constrained set of options.'
))

space_headers = ['Token', 'Value', 'Common Usage']
space_rows = [
    ['space-xs', '4px', 'Badge padding, icon gaps, inline spacing'],
    ['space-sm', '8px', 'Input padding, small gaps, button internal padding'],
    ['space-md', '16px', 'Card padding, form field gaps, list item spacing'],
    ['space-lg', '24px', 'Card internal sections, major content gaps'],
    ['space-xl', '32px', 'Section dividers, page-level vertical rhythm'],
    ['space-2xl', '48px', 'Major section breaks, component group spacing'],
    ['space-3xl', '64px', 'Page sections, hero area padding'],
    ['space-4xl', '96px', 'Cover pages, hero sections, maximum breathing room'],
]
story.append(make_table(space_headers, space_rows))
story.append(spacer(12))

# A.4 Border Radius System
story.append(h2('A.4 Border Radius System'))
story.append(body(
    'The border radius system provides five standard tokens that create a consistent roundedness language. The philosophy follows the intelligence terminal '
    'aesthetic: moderate rounding that softens edges without appearing playful or consumer-oriented. Small radius (6px) handles subtle elements like badges '
    'and input fields. Medium radius (10px) is the default for cards and panels. Large radius (16px) supports elevated surfaces like modals and dropdowns. '
    'Extra large radius (24px) is reserved for hero cards and featured intelligence briefings. Full radius (9999px) creates pill shapes for badges, tags, and CTAs. '
    'These values are deliberately smaller than consumer SaaS trends (which often use 16-20px default radius) to maintain the authoritative enterprise aesthetic.'
))

radius_headers = ['Token', 'Value', 'Usage']
radius_rows = [
    ['radius-sm', '6px', 'Badges, input fields, small buttons'],
    ['radius-md', '10px', 'Cards, panels, standard containers'],
    ['radius-lg', '16px', 'Modals, dropdowns, elevated surfaces'],
    ['radius-xl', '24px', 'Hero cards, featured briefings'],
    ['radius-full', '9999px', 'Pill badges, CTAs, avatars'],
]
story.append(make_table(radius_headers, radius_rows))
story.append(spacer(12))

# A.5 Elevation/Shadow System
story.append(h2('A.5 Elevation and Shadow System'))
story.append(body(
    'The elevation system communicates depth through three shadow levels and a glow effect. Unlike light themes where elevation is primarily visual, '
    'dark themes require careful shadow design because shadows are less visible against dark backgrounds. Our shadows use higher opacity (40-50%) '
    'compared to light theme conventions (10-25%) and incorporate slight blue tinting to match the background palette. The glow effect (shadow-glow) '
    'is unique to DeepMindQ and is triggered only by accent-colored interactive elements on hover or focus, creating a subtle halo that signals interactivity '
    'without the harsh glow effects common in gaming interfaces.'
))

shadow_headers = ['Token', 'CSS Value', 'Usage']
shadow_rows = [
    ['shadow-card', '0 4px 24px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)', 'Standard card elevation'],
    ['shadow-elevated', '0 8px 40px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)', 'Modals, popovers, dropdowns'],
    ['shadow-glow', '0 0 30px rgba(59,130,246,0.15)', 'Accent element hover/focus states'],
]
story.append(make_table(shadow_headers, shadow_rows))
story.append(spacer(12))

# A.6 Glass-morphism Surface System
story.append(h2('A.6 Glass-morphism Surface System'))
story.append(body(
    'The glass-morphism surface system creates semi-transparent layered effects that reinforce the depth hierarchy. The standard glass-card uses '
    '70% opacity background with 12px backdrop blur and a 1px border. The accent variant adds a blue-tinted border and glow shadow for interactive '
    'or highlighted cards. These surfaces are used throughout the Intelligence Hub and all intelligence views to create a layered information architecture '
    'where cards appear to float above the background surface, creating visual separation without harsh boundaries. '
    'The glass effect is intentionally subtle: over-application creates a frosted glass aesthetic that undermines the authoritative tone. '
    'Glass surfaces must only be used on elevated elements (cards, modals, panels) and never on the page background or standard content areas.'
))

glass_headers = ['Surface', 'Background', 'Blur', 'Border', 'Usage']
glass_rows = [
    ['glass-card', 'rgba(22,28,42,0.7)', '12px', '1px solid var(--border)', 'Standard card surface'],
    ['glass-card--accent', 'rgba(22,28,42,0.7)', '12px', '1px solid rgba(59,130,246,0.3)', 'Highlighted/interactive card'],
    ['glass-panel', 'rgba(17,21,32,0.85)', '16px', '1px solid var(--border-light)', 'Modal/dropdown surface'],
    ['glass-tooltip', 'rgba(6,8,16,0.95)', '8px', '1px solid var(--border)', 'Tooltip/popover surface'],
]
story.append(make_table(glass_headers, glass_rows))
story.append(spacer(12))

# A.7 Motion Principles
story.append(h2('A.7 Motion Principles'))
story.append(body(
    'Motion in the DeepMindQ interface is conservative and purposeful. The intelligence briefing philosophy demands that animations support comprehension '
    'rather than entertain. Every motion must have a clear functional purpose: revealing progressive disclosure layers, confirming an action, drawing attention '
    'to a priority signal, or providing spatial context during navigation. Decorative animations are forbidden. The motion system defines three duration tiers: '
    'micro (100-200ms) for button feedback and state changes, standard (200-400ms) for card expansions and content reveals, and macro (400-600ms) for '
    'page transitions and major layout shifts. All motion uses ease-out easing by default for a confident, decisive feel that matches the executive briefing tone. '
    'Ease-in is reserved exclusively for exit animations (elements leaving the viewport), never for entrance animations.'
))

motion_headers = ['Tier', 'Duration', 'Easing', 'Usage']
motion_rows = [
    ['Micro', '100-200ms', 'ease-out', 'Button press, toggle, checkbox, badge'],
    ['Standard', '200-400ms', 'ease-out', 'Card expand, reveal, dropdown open, modal fade'],
    ['Macro', '400-600ms', 'ease-out', 'Page transition, major layout shift, section reveal'],
    ['Exit', '150-300ms', 'ease-in', 'Element dismissal, tooltip close, dropdown close'],
]
story.append(make_table(motion_headers, motion_rows))
story.append(spacer(12))

story.append(h3('Motion Forbidden Patterns'))
motion_forbidden = [
    'Bounce animations: never use. Intelligence interfaces do not bounce.',
    'Continuous looping animations: forbidden. All motion must be triggered by a user action or system event and must resolve to a static state.',
    'Parallax scrolling: forbidden on intelligence cards. Motion must not interfere with content readability.',
    'Rotation animations: forbidden except for loading indicators, and even then limited to 360 degrees at constant speed.',
    'Spring physics: forbidden. Use standard easing curves only.',
]
for r in motion_forbidden:
    story.append(bullet(r))
story.append(spacer(12))

# A.8 Accessibility Rules
story.append(h2('A.8 Accessibility Rules'))
story.append(body(
    'Accessibility is not an optional enhancement but a foundational requirement of the Design System. The DeepMindQ platform serves enterprise executives '
    'who may have varying visual capabilities, and the intelligence briefing content must be consumable by all users regardless of ability. '
    'The following rules are derived from WCAG 2.1 AA standards with select AAA targets for critical intelligence content. Compliance is verified '
    'through automated tooling (axe-core) integrated into the CI pipeline and manual review during design QA. Any component that fails these rules '
    'cannot proceed to production implementation.'
))

a11y_headers = ['Rule ID', 'Category', 'Requirement', 'Standard']
a11y_rows = [
    ['A11Y-01', 'Color Contrast', 'All text against backgrounds: minimum 4.5:1 contrast ratio. Large text (18px+): minimum 3:1.', 'WCAG 2.1 AA'],
    ['A11Y-02', 'Focus Indicators', 'All interactive elements must have visible focus indicators (2px solid accent blue outline, 2px offset).', 'WCAG 2.1 AA'],
    ['A11Y-03', 'Keyboard Navigation', 'All interactive elements must be reachable via Tab. Progressive disclosure must work with Enter/Space.', 'WCAG 2.1 AA'],
    ['A11Y-04', 'Screen Readers', 'All intelligence states (confidence, trust, priority) must have aria-label or visually hidden text alternatives.', 'WCAG 2.1 AA'],
    ['A11Y-05', 'Motion Safety', 'All animations must respect prefers-reduced-motion. Provide static alternatives for all motion-dependent content.', 'WCAG 2.1 AA'],
    ['A11Y-06', 'Color Independence', 'No information conveyed by color alone. All color-coded states must have text or icon reinforcement.', 'WCAG 2.1 AA'],
    ['A11Y-07', 'Touch Targets', 'Minimum 44x44px touch targets for all interactive elements on tablet/mobile layouts.', 'WCAG 2.1 AA'],
    ['A11Y-08', 'Error Identification', 'Error messages must identify the specific field, describe the error, and suggest a correction.', 'WCAG 2.1 AA'],
]
story.append(make_table(a11y_headers, a11y_rows))
story.append(spacer(18))

# ═══════════════════════════════════════════════════════════════
# DELIVERABLE B: COMPONENT LIBRARY ARCHITECTURE
# ═══════════════════════════════════════════════════════════════

story.append(h1('Deliverable B: DeepMindQ Component Library Architecture'))
story.append(body(
    'The DeepMindQ Component Library extends shadcn/ui with a proprietary layer of intelligence-specific components organized in an Atomic Design hierarchy: '
    'Atoms (smallest reusable elements), Molecules (composed of 2-4 atoms), and Organisms (complete experience sections). This architecture ensures that every '
    'intelligence interface is built from consistent, tested building blocks. Each component is defined by its purpose (the user problem it solves), '
    'anatomy (internal structure), states (resting, hover, focus, active, loading, error, empty), variants (visual and behavioral permutations), '
    'interaction behavior (how users engage with it), content rules (what text and data it displays), and explicit do/don\'t examples that prevent misuse.'
))
story.append(body(
    'The component library is categorized into three tiers. Intelligence Atoms are the smallest meaningful units: confidence indicators, evidence chains, '
    'status badges, and action CTAs. Intelligence Molecules combine atoms into functional units: narrative cards, recommendation experiences, and briefing '
    'summaries. Intelligence Organisms are complete experience sections that compose molecules and atoms into full views: the Intelligence Hub, Account '
    'Intelligence View, Market Intelligence View, AI Advisor Experience, and Command Center. This hierarchy mirrors the Progressive Disclosure model (L1-L4) '
    'defined in Stage 1, where organisms present L1 summaries, molecules handle L2-L3 details, and atoms provide L4 exploration data.'
))

# B.1 Intelligence Atoms
story.append(h2('B.1 Intelligence Atoms'))
story.append(body(
    'Intelligence Atoms are the foundational building blocks of the DeepMindQ interface. Each atom encapsulates a single piece of intelligence information '
    'or a single interactive action. They are never used in isolation on a page but are always composed within molecules or organisms. Despite their small size, '
    'atoms carry significant design weight because they define the visual language of trust, confidence, and intelligence that permeates the entire platform. '
    'Six atoms are defined in the initial library, each addressing a specific user need identified in the VP Sales mental model from Stage 1.'
))

# ConfidenceIndicator
story.append(h3('Atom: ConfidenceIndicator'))
story.append(body(
    '<b>Purpose:</b> Communicate the reliability of intelligence data at a glance. Enables the VP of Sales to instantly assess whether an insight is trustworthy '
    'enough to act upon, without reading the full evidence chain. This component is the visual embodiment of the Trust Visualization design pattern from Stage 1, '
    'translating the numerical trust scores from the M5 TRUST Metadata Framework into an immediately understandable visual indicator.'
))
story.append(body(
    '<b>Anatomy:</b> Circular or pill-shaped badge containing a numerical score (0-100), a color fill corresponding to the five-level trust scale '
    '(Verified/High/Medium/Low/Unverified), an optional icon reflecting the trust level (shield, check, alert, question), and a tooltip that reveals the '
    'trust source on hover. The badge is 32px in diameter for inline mode and 44px for card-header mode. In standalone mode, the badge may include a label beneath it.'
))
story.append(body(
    '<b>States:</b> Five trust states (Verified-green, High-teal, Medium-amber, Low-orange, Unverified-gray), each with distinct fill color, icon, and tooltip text. '
    'Loading state shows a skeleton circle placeholder. Error state shows a broken shield icon in red. Empty state is hidden by default (no confidence indicator renders).'
))
story.append(body(
    '<b>Variants:</b> Inline (small, embedded in text or card headers), Card Header (medium, positioned at the top-right of intelligence cards), '
    'Standalone (large, used in trust detail views with label beneath), Minimal (numeric-only, no color fill, used in dense table views).'
))

ci_spec = [
    ['Display', 'Circular badge, colored fill, numeric score, optional icon', 'Trust overview'],
    ['Inline', 'Pill-shaped, 24px height, numeric + 1-letter label', 'Text embedding'],
    ['Minimal', 'Mono font numeric only, color-coded text', 'Dense tables'],
    ['Detail', 'Large circle + label + source tooltip', 'Trust detail view'],
]
story.append(make_table(['Variant', 'Anatomy', 'Usage Context'], ci_spec))
story.append(spacer(12))

# EvidenceChain
story.append(h3('Atom: EvidenceChain'))
story.append(body(
    '<b>Purpose:</b> Visualize the provenance and reasoning trail behind an intelligence insight. Shows how raw data was transformed into an actionable insight '
    'through a sequence of sources, processing steps, and verification events. This atom directly supports the "Evidence Footprint and Trust Visualization" '
    'core design pattern, ensuring that every AI-generated recommendation can be traced back to its source data.'
))
story.append(body(
    '<b>Anatomy:</b> Horizontal or vertical chain of connected nodes. Each node represents a step in the evidence pipeline: Source (where data originated), '
    'Processing (how it was transformed), Verification (how it was validated), and Conclusion (the resulting insight). Nodes are connected by thin lines '
    '(1px, border color) with directional arrows. Each node contains an icon, label, and optional timestamp. Expanded mode shows metadata beneath each node.'
))
story.append(body(
    '<b>States:</b> Collapsed (single line showing "3 sources" with expand chevron), Expanded (full chain visible), Loading (skeleton nodes pulsing), '
    'Error (broken chain link with red indicator), Empty (hidden or shows "No evidence available" message). Interaction: click to toggle between collapsed/expanded.'
))

# InlineReasoning
story.append(h3('Atom: InlineReasoning'))
story.append(body(
    '<b>Purpose:</b> Provide AI reasoning context directly within content flow, without requiring the user to navigate to a separate view. Shows why the AI '
    'reached a specific conclusion or made a specific recommendation. This atom is critical for the "Human decision ownership over AI directives" principle, '
    'ensuring that AI reasoning is always visible, auditable, and transparent. The VP Sales mental model demands that AI reasoning never be hidden behind '
    'extra clicks.'
))
story.append(body(
    '<b>Anatomy:</b> Inline text block with subtle left border accent (2px, accent color at 30% opacity), preceding the content it explains. Contains a '
    '"Why this insight" label in micro text, followed by 1-3 sentences of reasoning in body text, followed by optional source links. The block uses '
    'primary-dim text color to create visual hierarchy below the primary content while remaining readable.'
))

# StatusBadge
story.append(h3('Atom: StatusBadge'))
story.append(body(
    '<b>Purpose:</b> Communicate entity status at a glance (active, inactive, pending, archived). Used across accounts, contacts, deals, and intelligence '
    'items. The badge system uses a consistent visual language: outlined pills with semantic colors matching the status type. Status badges are the most '
    'frequently used atom in the intelligence interface, appearing in lists, cards, tables, and detail views.'
))
story.append(body(
    '<b>Variants:</b> Active (green outline, filled text), Inactive (gray outline), Pending (amber outline), At Risk (red outline), '
    'Under Review (purple outline), Archived (dim gray, dashed border). Each variant includes a dot indicator (6px circle) before the label text.'
))

# ActionCTA
story.append(h3('Atom: ActionCTA'))
story.append(body(
    '<b>Purpose:</b> Provide clear, actionable call-to-action buttons within intelligence contexts. Every intelligence card that includes a recommendation '
    'must include at least one ActionCTA. This atom enforces the "Recommended next consideration" aspect of the 5-Question Framework, ensuring that intelligence '
    'is always accompanied by a clear next step. CTAs use the accent color as background with primary-dark text for maximum visibility and accessibility.'
))
story.append(body(
    '<b>Variants:</b> Primary (solid accent background), Secondary (outlined, accent border), Ghost (text-only, accent color), Danger (red background for '
    'destructive actions like "Dismiss" or "Archive"). Size variants: sm (28px height), md (36px height), lg (44px height). Each variant has hover, focus, '
    'active, disabled, and loading states.'
))

# FreshnessIndicator
story.append(h3('Atom: FreshnessIndicator'))
story.append(body(
    '<b>Purpose:</b> Show how recently intelligence data was last updated. Communicates data freshness without requiring the user to check metadata. '
    'This atom supports the "Evidence footprint" design pattern by making temporal recency visible. Freshness indicators appear on every intelligence card, '
    'evidence node, and data source reference throughout the platform.'
))
story.append(body(
    '<b>Anatomy:</b> Small text label ("Updated 2h ago"), timestamp icon, optional color coding: green for data less than 1 hour old, amber for 1-24 hours, '
    'gray for 1-7 days, red for older than 7 days. The freshness indicator uses JetBrains Mono for the time value to maintain numerical data consistency.'
))

# B.2 Intelligence Molecules
story.append(h2('B.2 Intelligence Molecules'))
story.append(body(
    'Intelligence Molecules combine two to four atoms into functional units that deliver specific intelligence experiences. Molecules are the primary '
    'building blocks of intelligence views, appearing as cards, panels, and summary blocks within organisms. Each molecule has a defined layout structure, '
    'interaction behavior, and content template that ensures consistency across the platform. The five molecules defined below correspond to the key '
    'intelligence experiences identified in the Stage 1 UX Philosophy: narrative, recommendation, briefing, evidence summary, and progressive disclosure.'
))

# IntelligenceNarrative (Redesigned)
story.append(h3('Molecule: IntelligenceNarrative'))
story.append(body(
    '<b>Purpose:</b> Present AI-generated intelligence as a structured narrative briefing rather than a raw data dump. This molecule was redesigned from the '
    'existing Intelligence OS component based on the Stage 1 evaluation. The previous version presented intelligence as bullet lists of data points; the new version '
    'structures intelligence as a briefing narrative with clear sections: headline, summary, reasoning, evidence, and recommended action. This redesign directly '
    'serves the "Intelligence as Executive Briefing" core philosophy.'
))
story.append(body(
    '<b>Anatomy:</b> Glass-card container with four sections. Section 1 (Headline): H3 title + PriorityBadge + ConfidenceIndicator. Section 2 (Summary): '
    '2-3 sentence briefing summary in body text, answering "What changed and why it matters." Section 3 (Reasoning): InlineReasoning atom providing AI reasoning. '
    'Section 4 (Evidence): Collapsed EvidenceChain atom showing "3 sources" with expand capability. Section 5 (Action): ActionCTA atom for recommended next step.'
))
story.append(body(
    '<b>Interaction:</b> Follows the Progressive Disclosure L1-L4 model. L1 (default): Shows headline + confidence + priority only. Click to expand. '
    'L2: Reveals summary reasoning. L3: Reveals evidence chain. L4: Reveals exploration links and historical context. Each level expands in-place with '
    'standard easing (200-400ms). Collapse returns to L1.'
))

# RecommendationCard (Redesigned)
story.append(h3('Molecule: RecommendationCard'))
story.append(body(
    '<b>Purpose:</b> Present AI-generated recommendations with human control, evidence footprints, and clear ownership. This molecule was redesigned from the '
    'existing component to enforce the "Human decision ownership over AI directives" principle. The previous version presented AI suggestions as authoritative '
    'recommendations; the new version frames them as considerations with evidence support, ensuring the human user always makes the final decision.'
))
story.append(body(
    '<b>Anatomy:</b> Glass-card with accent border. Header: AI suggestion icon + "AI Recommendation" label + confidence. Body: 1-2 sentence recommendation '
    'in body text. Evidence footprint: 2-3 line evidence summary with source links. Control section: "Accept" and "Dismiss" ActionCTAs (primary and ghost variants) '
    '+ "View Evidence" link. Footer: FreshnessIndicator + last-updated timestamp. The card never auto-executes any action; human approval is always required.'
))

# IntelligenceBriefing
story.append(h3('Molecule: IntelligenceBriefing'))
story.append(body(
    '<b>Purpose:</b> Deliver a complete morning intelligence briefing for the VP Sales. This is the primary output of the 5-Question Morning Intelligence Protocol '
    'defined in Stage 1. The IntelligenceBriefing molecule composes multiple atoms and sub-molecules into a structured briefing that answers all five questions: '
    'What changed, Why it matters, Who to engage, What to say, and What to do. This is the most complex molecule in the library and the cornerstone of the '
    'Intelligence Hub experience.'
))
story.append(body(
    '<b>Anatomy:</b> Large glass-card with structured sections. Header: Date + "Morning Briefing" label + overall confidence score. Section 1 (What Changed): '
    'Stack of IntelligenceNarrative molecules showing top priority signals. Section 2 (Who to Engage): List of accounts/contacts with PriorityBadge and '
    'StatusBadge. Section 3 (What to Say): Talking points in bullet format with evidence links. Section 4 (What to Do): Stack of RecommendationCard molecules '
    'with action CTAs. Footer: "Dismiss All" and "Export Briefing" actions.'
))

# EvidenceSummary
story.append(h3('Molecule: EvidenceSummary'))
story.append(body(
    '<b>Purpose:</b> Provide a condensed overview of all evidence supporting an intelligence insight. Used in L3 progressive disclosure to show the full '
    'evidence footprint without requiring navigation to a separate evidence view. The summary shows source count, verification status, data age, and key evidence '
    'points in a compact format that fits within an expanded intelligence card.'
))
story.append(body(
    '<b>Anatomy:</b> Compact list format within a glass-card section. Header: "Evidence (4 sources)" label with expand/collapse toggle. Body: Stack of evidence '
    'items, each with SourceBadge (indicating source type: API, CRM, AI, Web), EvidenceDescription (1-line summary), FreshnessIndicator, and optional '
    'ConfidenceIndicator. Footer: "View Full Evidence" link to detailed evidence view.'
))

# B.3 Intelligence Organisms
story.append(h2('B.3 Intelligence Organisms'))
story.append(body(
    'Intelligence Organisms are complete experience sections that compose molecules and atoms into full page views or major page regions. Each organism '
    'defines the layout structure, information hierarchy, and interaction flow for a specific intelligence experience. The five organisms below map directly '
    'to the 7-Experience Navigation Model defined in Stage 1 (with Intelligence Hub and AI Advisor as the primary organisms, and the remaining experiences '
    'as extensions of the same component architecture).'
))

# IntelligenceHub
story.append(h3('Organism: IntelligenceHub'))
story.append(body(
    '<b>Purpose:</b> The default landing experience for the DeepMindQ platform. Serves as the executive intelligence dashboard where the VP Sales begins every '
    'session. The Hub aggregates and prioritizes intelligence from all sources into a single, scannable briefing format. This organism is the visual embodiment '
    'of the "Intelligence as Executive Briefing" philosophy and the "5-Question Morning Intelligence Protocol."'
))
story.append(body(
    '<b>Layout:</b> Full-page layout with three regions. Top bar: Date, search, notification bell, user avatar. Main content: Priority signals grid (top 5 '
    'IntelligenceBriefing cards in bento grid layout), Quick actions sidebar (AI Advisor quick-access, recent searches, pinned accounts). Bottom: '
    'Action queue (stack of RecommendationCards requiring human decision). The hub uses responsive grid layouts: 3-column on desktop, 2-column on tablet, '
    'single column on mobile.'
))
story.append(body(
    '<b>Interaction:</b> Intelligence cards follow Progressive Disclosure L1-L4. The hub supports drag-to-reorder priority signals. Swipe-to-dismiss on mobile '
    'for low-priority items. Keyboard navigation supports Tab through cards and Enter/Space to expand. The hub refreshes intelligence every 15 minutes with '
    'a subtle pulse animation on updated cards, but never auto-reloads the entire view (preventing disruption during active reading).'
))

# AccountIntelligenceView
story.append(h3('Organism: Account Intelligence View'))
story.append(body(
    '<b>Purpose:</b> Comprehensive intelligence view for a single target account. Aggregates all intelligence data (financial, contact, engagement, market, '
    'AI-derived insights) into a unified account intelligence briefing. This view replaces the current company profile page with a much richer intelligence '
    'experience that answers the 5-Question Framework for a specific account context.'
))
story.append(body(
    '<b>Layout:</b> Two-column layout. Left column (60%): Account Intelligence Briefing (structured narrative with progressive disclosure), Engagement Timeline, '
    'Contact Intelligence, and AI Recommendations. Right column (40%): Trust Dashboard (confidence scores, data freshness, evidence summary), Quick Actions '
    '(compose email, schedule meeting, log activity), and Related Intelligence (cross-referenced opportunities and market signals).'
))

# MarketIntelligenceView
story.append(h3('Organism: Market Intelligence View'))
story.append(body(
    '<b>Purpose:</b> Market-level intelligence aggregation showing trends, opportunities, and competitive signals across the user\'s defined market segments. '
    'Enables strategic decision-making beyond individual account analysis. This view presents market intelligence as a briefing rather than a data dashboard, '
    'following the same executive briefing philosophy as the Intelligence Hub.'
))
story.append(body(
    '<b>Layout:</b> Full-page layout with four sections. Section 1: Market Overview (key metrics in stat-blocks: total addressable accounts, active opportunities, '
    'market signal volume). Section 2: Priority Signals (IntelligenceNarrative cards for top market signals). Section 3: Competitive Landscape (competitor '
    'activity cards with evidence chains). Section 4: Strategic Opportunities (RecommendationCards for market-level AI recommendations).'
))

# AIAdvisorExperience
story.append(h3('Organism: AI Advisor Experience'))
story.append(body(
    '<b>Purpose:</b> Conversational AI interface for natural language intelligence queries. Enables the VP Sales to ask questions and receive structured '
    'intelligence briefings in response. The AI Advisor is not a chatbot in the traditional sense; it produces structured briefing outputs rather than '
    'conversational responses, maintaining the executive briefing quality standard across all interaction modes.'
))
story.append(body(
    '<b>Layout:</b> Split-panel layout. Left panel (45%): Conversation history with user queries and AI responses. Right panel (55%): Structured briefing '
    'output for the selected AI response, rendered using IntelligenceBriefing molecules. The right panel updates as the user selects different AI responses '
    'from the conversation history. This split ensures that conversational context is preserved while the briefing output receives adequate display space.'
))
story.append(body(
    '<b>Interaction:</b> User types a natural language query. AI responds with a structured briefing (not free-form text). The briefing appears in the '
    'right panel as a full IntelligenceBriefing molecule. User can ask follow-up questions that refine the briefing. Each AI response includes a confidence '
    'indicator and evidence chain. The AI Advisor never performs actions autonomously; all recommendations require explicit human approval through ActionCTAs.'
))

# CommandCenter
story.append(h3('Organism: Command Center'))
story.append(body(
    '<b>Purpose:</b> Administrative and operational hub for managing intelligence configuration, data sources, user permissions, and system health. '
    'This is the only organism not directly related to intelligence consumption; it serves platform administrators and sales operations teams. '
    'The Command Center follows the same design language but uses a more data-dense layout appropriate for operational tasks.'
))
story.append(body(
    '<b>Layout:</b> Tab-based navigation with five sections: Intelligence Sources (connector management, data quality metrics), User Management '
    '(permissions, role assignments), Automation Rules (trigger configurations, workflow management), System Health (API status, data freshness dashboard, '
    'error logs), and Configuration (ICP settings, scoring thresholds, notification preferences). Each section uses a consistent table-plus-detail layout.'
))
story.append(spacer(18))

# ═══════════════════════════════════════════════════════════════
# DELIVERABLE C: INTERACTION PATTERN LIBRARY
# ═══════════════════════════════════════════════════════════════

story.append(h1('Deliverable C: Interaction Pattern Library'))
story.append(body(
    'The Interaction Pattern Library defines reusable behavioral specifications for common interaction patterns across the DeepMindQ platform. These patterns '
    'go beyond individual component behavior to define system-level interaction rules that ensure consistent user experience across all intelligence experiences. '
    'Each pattern specification includes the trigger condition, behavior description, animation parameters, accessibility requirements, and edge cases. '
    'These patterns are locked as part of MS6 and must be followed by all implementation teams during MS7-MS11.'
))

# C.1 Progressive Disclosure
story.append(h2('C.1 Progressive Disclosure Patterns'))

story.append(h3('PD-01: Intelligence Card Disclosure'))
story.append(body(
    '<b>Trigger:</b> User clicks on an intelligence card header or "View Details" link.<br/>'
    '<b>Behavior:</b> The card expands in-place to reveal the next disclosure level (L1 to L2 to L3 to L4). Content animates in with a slide-down '
    'effect (200-400ms, ease-out). The card does not navigate away from the current view. A collapse button appears at the top-right of the expanded area.<br/>'
    '<b>Accessibility:</b> Enter/Space triggers expansion. Escape triggers collapse. aria-expanded attribute toggles between true/false. '
    'The expanded content receives focus management (first focusable element receives focus).<br/>'
    '<b>Edge Cases:</b> If the card contains an error (failed to load evidence), show an error message at the expanded level with a retry CTA. '
    'If the card contains no additional data for the next level, disable the expand interaction and show a muted "No additional details" message.'
))

story.append(h3('PD-02: AI Reasoning Reveal'))
story.append(body(
    '<b>Trigger:</b> User clicks "Why this insight" link or expands to L2 disclosure level on an intelligence card.<br/>'
    '<b>Behavior:</b> The InlineReasoning atom fades in below the card summary (200ms, ease-out, opacity 0 to 1). The reasoning text uses primary-dim color '
    'to create visual hierarchy below the summary. The reveal includes source links that expand the EvidenceChain atom on click.<br/>'
    '<b>Constraint:</b> AI reasoning is never hidden behind a modal or separate page. It must always be visible within the context of the intelligence card. '
    'This enforces the "Human decision ownership" principle by ensuring reasoning is always accessible without navigation cost.'
))

story.append(h3('PD-03: Evidence Expansion'))
story.append(body(
    '<b>Trigger:</b> User clicks "View Evidence" or expands to L3 disclosure level.<br/>'
    '<b>Behavior:</b> The EvidenceChain atom transitions from collapsed to expanded mode. Each evidence node animates in sequentially with a 50ms stagger '
    '(200ms total for 4 nodes). Source badges, descriptions, and freshness indicators appear in sequence. The expand animation uses a height transition '
    '(200-400ms, ease-out) with overflow hidden during transition.<br/>'
    '<b>Accessibility:</b> Each evidence node is focusable via Tab. Arrow keys navigate between nodes within the chain. '
    'aria-label on each node describes its role: "Source: Clearbit API, verified 2 hours ago".'
))

story.append(h3('PD-04: Confidence Visualization'))
story.append(body(
    '<b>Trigger:</b> ConfidenceIndicator appears on any intelligence card, evidence node, or trust detail view.<br/>'
    '<b>Behavior:</b> The indicator renders immediately with the appropriate color and score. On hover, a tooltip reveals the trust source and reasoning '
    'behind the confidence score. On click (when in card-header mode), navigates to the trust detail view for that intelligence item.<br/>'
    '<b>Loading:</b> During intelligence computation, the ConfidenceIndicator shows a skeleton placeholder (gray circle, pulsing animation). '
    'Once the confidence score is computed, it transitions from skeleton to the final state with a 200ms fade.<br/>'
    '<b>Accessibility:</b> aria-label includes the confidence level text: "Confidence: High (82/100), verified via Clearbit API". '
    'Color is reinforced with text label to satisfy the "color independence" accessibility rule.'
))

# C.2 State Patterns
story.append(h2('C.2 State Transition Patterns'))

story.append(h3('ST-01: Loading States'))
story.append(body(
    '<b>Behavior:</b> All intelligence components use skeleton loading placeholders that mirror the expected content layout. Skeletons use CARD_BG color '
    'with a subtle pulse animation (opacity 0.3 to 0.6, 1.5s cycle, ease-in-out). The skeleton layout matches the final content layout in size and spacing, '
    'preventing layout shift when content loads. Progressive loading is supported: L1 content loads first, then L2-L4 data loads asynchronously.'
))

story.append(h3('ST-02: Error Recovery'))
story.append(body(
    '<b>Behavior:</b> Error states use a consistent pattern: error icon (red), descriptive message explaining what failed and why, and a "Retry" ActionCTA. '
    'Errors never replace the entire page; they appear within the component that failed. If intelligence computation fails, the card still shows available '
    'L1 data (e.g., the signal headline) with the error message below it. This ensures partial intelligence is still useful.<br/>'
    '<b>Error Copy:</b> Error messages follow the emotional copy library guidelines: calm, precise, actionable. Example: "Unable to load full evidence chain. '
    '3 of 4 sources are available. Retry to attempt loading the missing source." Never: "Error 500: Internal Server Error."'
))

story.append(h3('ST-03: Empty States'))
story.append(body(
    '<b>Behavior:</b> Empty states appear when an intelligence section has no data to display. Each empty state includes: an illustration or icon (ICON color, '
    '64px), a headline explaining why the section is empty, a body paragraph suggesting what the user can do to populate the section, and an ActionCTA '
    'guiding the next action. Empty states use the emotional copy library to maintain the calm, confident tone.<br/>'
    '<b>Examples:</b> No signals today: "No priority signals detected. Your pipeline is stable. Check back during your next briefing or explore account intelligence." '
    'No evidence: "No evidence sources available for this insight. Connect data sources in Command Center to enable trust visualization."'
))

story.append(h3('ST-04: Success and Milestone Recognition'))
story.append(body(
    '<b>Behavior:</b> Success states acknowledge completed actions and achieved milestones with visual feedback without being intrusive. Success confirmations '
    'use a subtle green checkmark animation (200ms, ease-out) followed by a brief success message that auto-dismisses after 3 seconds. Milestone achievements '
    '(e.g., "100 accounts enriched", "All morning signals reviewed") trigger a slightly more prominent notification with a summary line. '
    'No confetti, no celebration animations, no sound effects. The intelligence platform is a professional tool; success recognition is understated.'
))

story.append(h3('ST-05: Human Approval Checkpoints'))
story.append(body(
    '<b>Trigger:</b> Any AI recommendation requires explicit human approval before execution.<br/>'
    '<b>Behavior:</b> The RecommendationCard molecule presents the AI suggestion with "Accept" and "Dismiss" CTAs. The card remains in the action queue '
    'until the user explicitly acts on it. No auto-execution, no auto-dismissal based on time. The approval checkpoint enforces the "Human decision ownership '
    'over AI directives" principle. When the user accepts, a brief success confirmation appears. When dismissed, the recommendation is archived with a reason '
    '(optional, user can provide feedback via a text input that appears after dismissal).'
))

# C.3 AI Conversation Patterns
story.append(h2('C.3 AI Conversation Patterns'))

story.append(h3('AI-01: Structured Briefing Response'))
story.append(body(
    '<b>Trigger:</b> User submits a natural language query to the AI Advisor.<br/>'
    '<b>Behavior:</b> The AI generates a structured briefing response rendered as an IntelligenceBriefing molecule in the right panel. The response includes: '
    'headline, summary, confidence score, evidence chain, and recommended actions. The response is never free-form conversational text; it follows the same '
    'structured briefing format as hub intelligence cards, ensuring consistency across manual and AI-driven intelligence experiences.<br/>'
    '<b>Streaming:</b> If response generation takes more than 2 seconds, a streaming indicator shows progress. The briefing sections appear incrementally '
    'as they are generated: headline first, then summary, then evidence, then actions. Each section animates in as it completes.'
))

story.append(h3('AI-02: Follow-up Refinement'))
story.append(body(
    '<b>Trigger:</b> User asks a follow-up question within the same AI Advisor conversation.<br/>'
    '<b>Behavior:</b> The AI refines the previous briefing based on the follow-up context. The refined briefing replaces the previous one in the right panel. '
    'A "Previous Briefing" breadcrumb allows navigation back to earlier responses. The conversation history in the left panel shows all queries and responses, '
    'with the currently displayed briefing highlighted. This pattern supports the iterative intelligence exploration workflow: start broad, then drill deeper '
    'through follow-up questions.'
))

story.append(h3('AI-03: AI Confidence Disclosure'))
story.append(body(
    '<b>Behavior:</b> Every AI response includes a mandatory ConfidenceIndicator and InlineReasoning atom. The AI never presents information without indicating '
    'its confidence level. If the AI cannot confidently answer a query (confidence below 40%), it must explicitly state: "I have limited confidence in this '
    'response. Here is what I found, but I recommend verifying with additional sources." This pattern enforces trust transparency across all AI interactions.'
))
story.append(spacer(18))

# ═══════════════════════════════════════════════════════════════
# DELIVERABLE D: EMOTIONAL COPY LIBRARY EXPANSION
# ═══════════════════════════════════════════════════════════════

story.append(h1('Deliverable D: Emotional Copy Library Expansion'))
story.append(body(
    'The Emotional Copy Library is the product language system that governs all text content across the DeepMindQ platform. It extends the initial copy library '
    'defined in Stage 1 into a comprehensive, reusable system covering every text touchpoint: intelligence statements, recommendations, risk communication, '
    'error messages, empty states, loading messages, confirmations, approval flows, and AI assistant responses. The library maintains the core voice and tone '
    'defined in Stage 1: calm, confident, precise, and executive-level. Every word in the interface is intentional and contributes to the premium intelligence '
    'experience.'
))
story.append(body(
    'The copy library is organized by communication context. Each entry includes the copy text, usage context, tone guidance, and forbidden alternatives. '
    'Development teams must reference this library when writing any user-facing text. Ad-hoc copy writing is prohibited without design review. The library serves '
    'as both a reference during implementation and a QA checklist during design review, ensuring that no text in the final product deviates from the intended voice.'
))

# D.1 Voice and Tone
story.append(h2('D.1 Voice and Tone'))
story.append(body(
    'The DeepMindQ voice is calm, confident, and precise. It speaks to executives who value their time and expect intelligence to be delivered with clarity '
    'and authority. The voice is never casual, enthusiastic, or salesy. It avoids exclamation marks, emoji, colloquialisms, and unnecessary qualifiers. '
    'Numbers and data points are always specific and sourced. Uncertainty is communicated honestly with clear confidence indicators rather than hedging language. '
    'The voice treats the user as a senior decision-maker who expects professional, no-nonsense communication.'
))

tone_headers = ['Attribute', 'Guideline', 'Example']
tone_rows = [
    ['Calm', 'Never urgent or alarming. State facts without panic.', '"A data source requires attention" not "URGENT: Data source failing!"'],
    ['Confident', 'Assert findings without hedging. Use direct statements.', '"Revenue increased 12%" not "Revenue seems to have gone up maybe"'],
    ['Precise', 'Use specific numbers, dates, and sources. Never vague.', '"Updated 2 hours ago via Clearbit API" not "Recently updated"'],
    ['Executive', 'Professional tone. No slang, no casual language.', '"Review the attached briefing" not "Check this out"'],
    ['Transparent', 'Show confidence levels and evidence. Never hide uncertainty.', '"Confidence: Medium (64/100). 2 of 3 sources verified."'],
    ['Actionable', 'Always include next steps. Never dead-end information.', '"3 accounts require attention. View briefing to prioritize."'],
]
story.append(make_table(tone_headers, tone_rows))
story.append(spacer(12))

# D.2 Intelligence Statement Copy
story.append(h2('D.2 Intelligence Statement Copy'))
story.append(body(
    'Intelligence statements are the core narrative content of the platform. They communicate what changed, why it matters, and what the implications are. '
    'These statements appear in IntelligenceNarrative molecules, IntelligenceBriefing sections, and AI Advisor responses. Every intelligence statement '
    'must follow a consistent structure: [Signal] + [Impact] + [Evidence Reference]. This three-part structure ensures that intelligence is always grounded '
    'in evidence and always communicates actionable impact.'
))

intel_headers = ['Context', 'Copy Pattern', 'Example']
intel_rows = [
    ['Revenue Change', '"[Company] revenue [changed by X%] to [$Y], [verified source]. This [impacts] [engagement strategy] because [reason]."', '"Acme Corp revenue increased 23% to $450M, verified via Clearbit. This suggests expansion potential because high-growth companies typically increase CRM budgets."'],
    ['Leadership Change', '"[Person] [joined/left] [Company] as [role] on [date]. This is significant because [reason linked to sales strategy]."', '"Sarah Chen joined Vertex Inc as CTO on Aug 1. This is significant because technical leadership changes often precede technology purchasing decisions."'],
    ['Funding Event', '"[Company] raised [$X] in [round] on [date], [source]. Post-funding companies in [sector] typically [behavior pattern]."', '"NovaTech raised $85M in Series C on Jul 28, verified via Crunchbase. Post-Series C companies in SaaS typically expand sales teams within 6 months."'],
    ['Market Signal', '"[Market trend] detected across [N] accounts. [X]% of tracked companies show [pattern]. This suggests [strategic implication]."', "AI adoption signal detected across 12 accounts. 75% show increased AI-related job postings. This suggests growing demand for AI integration tools."],
    ['Engagement Signal', '"[Contact] from [Company] [action] on [date]. Engagement score [increased/decreased] to [N]. [Recommended action]."', '"James Park from DataFlow viewed pricing page 3 times this week. Engagement score increased to 85. Consider sending a personalized follow-up."'],
]
story.append(make_table(intel_headers, intel_rows))
story.append(spacer(12))

# D.3 Risk Communication Copy
story.append(h2('D.3 Risk Communication Copy'))
story.append(body(
    'Risk communication follows a structured format that provides context without causing panic. Every risk statement includes: the risk description, '
    'the confidence level, the affected scope, and a recommended action. The tone is factual and forward-looking: the risk is stated as a condition '
    'requiring attention, not as a crisis. This approach aligns with the "calm, confident, precise" voice while ensuring that risks are not minimized '
    'or hidden from the user.'
))

risk_headers = ['Risk Level', 'Copy Pattern', 'Example']
risk_rows = [
    ['High', '"[Risk description]. Confidence: [X]%. Immediate attention recommended. [Action]."', '"Data quality alert: 3 fields on Acme Corp show conflicting values. Confidence: 45%. Immediate attention recommended. Review evidence to determine correct values."'],
    ['Medium', '"[Risk description]. Confidence: [X]%. Monitor and address during next review. [Action]."', "Enrichment data for 8 accounts is over 30 days old. Confidence: 62%. Monitor and address during next review. Schedule data refresh in Command Center."],
    ['Low', '"[Observation]. No immediate action required. [Optional context]."', "CRM sync latency increased by 200ms. No immediate action required. System is within acceptable thresholds."],
]
story.append(make_table(risk_headers, risk_rows))
story.append(spacer(12))

# D.4 Error Message Copy
story.append(h2('D.4 Error Message Copy'))
story.append(body(
    'Error messages are structured as three-part communications: what happened (factual description), why it matters (impact on the user), and what to do '
    'next (actionable recovery step). Error messages never use technical jargon that the user cannot act upon. Error codes may appear in a secondary text '
    'element for debugging but must never be the primary message. The tone remains calm even during failures: the system encountered an issue, not a catastrophe.'
))

err_headers = ['Error Type', 'Primary Message', 'Recovery Action']
err_rows = [
    ['Intelligence Load Failure', "Unable to load full intelligence for [Company]. Partial data is available.", "Retry loading. If the issue persists, check data source status in Command Center."],
    ['Evidence Chain Failure', "Unable to load [N] of [M] evidence sources for this insight.", "View available evidence. Missing sources will be retried automatically."],
    ['AI Processing Error', "The AI Advisor could not process this query. Try rephrasing or simplifying.", "Common fix: Be specific about the company, metric, or time range you are asking about."],
    ['Network Timeout', "Connection timed out while retrieving data. Your data was not affected.", "Check your network connection and retry."],
    ['Authentication Failure', "Your session has expired. Sign in again to continue.", "You will be redirected to the sign-in page."],
    ['Data Sync Error', "Data synchronization encountered an issue for [source]. Some data may be outdated.", "View affected records. Manual refresh is available in Command Center."],
]
story.append(make_table(err_headers, err_rows))
story.append(spacer(12))

# D.5 Empty State Copy
story.append(h2('D.5 Empty State Copy'))
story.append(body(
    'Empty states transform absence into opportunity. Each empty state follows the pattern: observation (what is absent), explanation (why), and invitation '
    '(what the user can do). Empty states never use the word "empty" or "nothing" in isolation, which can feel discouraging. Instead, they frame the absence '
    'as a neutral or positive condition and guide the user toward a productive next action.'
))

empty_headers = ['Context', 'Headline', 'Body', 'CTA']
empty_rows = [
    ['No Signals', 'No Priority Signals', 'Your pipeline is stable with no actionable intelligence right now. Signals are continuously monitored and will appear here when detected.', 'View Account Intelligence'],
    ['No Recommendations', 'All Caught Up', 'You have reviewed all current AI recommendations. New recommendations will appear here as intelligence is processed.', 'Explore Market Intelligence'],
    ['No Evidence', 'Evidence Not Available', 'No evidence sources are connected for this intelligence insight. Connect data sources to enable trust visualization.', 'Configure Data Sources'],
    ['No Search Results', 'No Results Found', 'No intelligence matches your search criteria. Try adjusting your filters or search terms.', 'Clear Filters'],
    ['No Accounts', 'Start Building Your Pipeline', 'No accounts are being tracked yet. Import accounts to begin receiving intelligence briefings.', 'Import Accounts'],
    ['No Activity', 'No Recent Activity', 'There has been no activity recorded for this account in the past 30 days. Consider reaching out to re-engage.', 'Log Activity'],
]
story.append(make_table(empty_headers, empty_rows))
story.append(spacer(12))

# D.6 AI Assistant Response Copy
story.append(h2('D.6 AI Assistant Response Copy'))
story.append(body(
    'AI Assistant responses maintain the structured briefing format even in conversational contexts. The AI never uses conversational filler like "Sure!" '
    'or "I can help with that!" Responses begin directly with the intelligence content. If the AI cannot answer, it states its limitation clearly and suggests '
    'alternatives. The AI always identifies itself as an AI assistant in its first response and attributes confidence levels to all information it provides.'
))

ai_headers = ['Context', 'Response Pattern', 'Example']
ai_rows = [
    ['Standard Query', '"[Briefing headline]. [Summary]. Confidence: [X]%."', '"Acme Corp shows 3 high-priority signals. Revenue growth of 23% suggests expansion timing. Leadership change indicates technology investment. Confidence: 78%."'],
    ['Unable to Answer', '"I do not have sufficient data to answer this with confidence. [What I found]. [Suggested alternative]."', "I do not have sufficient data to answer this with confidence. I found 2 relevant signals but evidence is limited. Try connecting additional data sources for a more complete analysis."],
    ['Follow-up Refinement', '"Refined briefing based on your follow-up. [Updated summary]. [Key changes from previous]."', "Refined briefing based on your follow-up. The revenue growth is concentrated in Q2, suggesting a specific trigger event. Key change from previous: timeline narrowed from annual to Q2-specific."],
    ['Low Confidence', '"Limited confidence in this response. [What I found]. [Recommendation to verify]."', "Limited confidence in this response. I found a potential leadership change but could only verify 1 of 2 sources. I recommend checking LinkedIn directly for confirmation before acting."],
]
story.append(make_table(ai_headers, ai_rows))
story.append(spacer(12))

# D.7 Confirmation and Approval Copy
story.append(h2('D.7 Confirmation and Approval Copy'))
story.append(body(
    'Confirmation messages acknowledge user actions with brief, factual confirmations. They never celebrate excessively or use enthusiastic language. '
    'Approvals are framed as decisions the user has made, not tasks the system has completed. This distinction reinforces the "human decision ownership" principle.'
))

confirm_headers = ['Action', 'Confirmation Copy']
confirm_rows = [
    ['Accept Recommendation', "Recommendation accepted. [Action] will be tracked in your activity log."],
    ['Dismiss Recommendation', "Recommendation dismissed. You can view dismissed items in your history."],
    ['Export Briefing', "Briefing exported successfully. The file is ready for download."],
    ['Save Configuration', "Configuration saved. Changes will take effect on the next intelligence cycle."],
    ['Connect Data Source', "[Source] connected successfully. Initial data sync will begin within 15 minutes."],
    ['Archive Account', "Account archived. Intelligence data is preserved and can be restored from Command Center."],
]
story.append(make_table(confirm_headers, confirm_rows))
story.append(spacer(12))

# D.8 Loading Message Copy
story.append(h2('D.8 Loading Message Copy'))
story.append(body(
    'Loading messages provide context about what the system is doing and set appropriate time expectations. Vague "Loading..." messages are prohibited. '
    'Each loading message describes the specific operation in progress and provides an estimated completion time when possible.'
))

load_headers = ['Context', 'Loading Copy']
load_rows = [
    ['Intelligence Briefing', "Preparing your morning briefing..."],
    ['AI Query', "Analyzing your query against intelligence sources..."],
    ['Evidence Loading', "Retrieving evidence from 4 sources..."],
    ['Data Enrichment', "Enriching account data via Clearbit..."],
    ['Export', "Generating briefing export..."],
    ['Search', "Searching intelligence database..."],
    ['Configuration Save', "Saving configuration changes..."],
]
story.append(make_table(load_headers, load_rows))
story.append(spacer(18))

# ═══════════════════════════════════════════════════════════════
# CLOSING: DESIGN SYSTEM GOVERNANCE
# ═══════════════════════════════════════════════════════════════

story.append(h1('Design System Governance'))
story.append(body(
    'The Design System Foundation defined in this document is the single source of truth for all DeepMindQ UI development from MS7 through MS11. '
    'This section establishes the governance framework that ensures the design system remains consistent, evolves intentionally, and is never circumvented.'
))

story.append(h2('Governance Principles'))
gov_rules = [
    '<b>Single Source of Truth:</b> This document and its associated HTML prototypes (Deliverable E) define the only authorized design system. '
    'No ad-hoc design decisions are permitted outside this framework.',
    '<b>Non-Negotiable Foundation:</b> All design tokens, component architectures, interaction patterns, and copy guidelines defined herein are locked '
    'for the MS6-MS11 milestone sequence. Changes require formal review and approval through the design governance process.',
    '<b>Component Authority:</b> Every UI element in the production application must map to a defined component in the Component Library (Deliverable B). '
    'Undefined components must be proposed as new library additions before implementation, not created ad-hoc during development.',
    '<b>Copy Compliance:</b> All user-facing text must reference the Emotional Copy Library (Deliverable D). Deviations are permitted only during '
    'implementation if the specific context is not covered, and the new copy must be submitted for library inclusion.',
    '<b>Interaction Consistency:</b> All interactive behaviors must follow the patterns defined in Deliverable C. Custom interaction patterns are '
    'prohibited without design system review and approval.',
    '<b>Accessibility Baseline:</b> The accessibility rules defined in A.8 represent the minimum standard. Individual components may exceed these '
    'requirements but never fall below them.',
    '<b>Prototype Reference:</b> The HTML prototypes (Deliverable E) serve as the visual reference implementation. When the specification text '
    'and the prototype differ, the specification text takes precedence, and the prototype must be updated.',
]
for r in gov_rules:
    story.append(bullet(r))
story.append(spacer(12))

story.append(h2('MS6 Phase 2 Completion Status'))

status_headers = ['Deliverable', 'Status', 'Description']
status_rows = [
    ['A: Design Tokens System', 'Complete', 'Color, typography, spacing, radius, shadows, glass surfaces, motion, accessibility defined and locked'],
    ['B: Component Library Architecture', 'Complete', '6 Atoms, 5 Molecules, 5 Organisms defined with full anatomy, states, variants, interactions'],
    ['C: Interaction Pattern Library', 'Complete', 'Progressive disclosure, state transitions, AI conversation patterns defined with specs'],
    ['D: Emotional Copy Library', 'Complete', 'Voice/tone, intelligence, risk, error, empty, AI, confirmation, loading copy patterns defined'],
    ['E: Reference Component Prototypes', 'Complete', 'HTML prototypes for Intelligence Briefing Card, Recommendation Experience, Hub Elements'],
]
story.append(make_table(status_headers, status_rows))
story.append(spacer(12))

story.append(body(
    'MS6 Phase 2 is complete. The Design System Foundation is locked for MS7-MS11 development. '
    'The next milestone (MS7: Screen Implementation) will use this foundation to build production intelligence interfaces.'
))

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# BUILD
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
doc.multiBuild(story, onLaterPages=page_template, onFirstPage=page_template)
print(f"Body PDF generated: {OUTPUT_PATH}")
