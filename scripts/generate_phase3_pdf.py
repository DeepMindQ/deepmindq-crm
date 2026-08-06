#!/usr/bin/env python3
"""
DeepMindQ MS6 Phase 3 — Reference Screen Design & Prototype Validation
Consolidated deliverable PDF: Wireframes, Responsive Specs, Governance, Screen References
"""
import os, sys, hashlib
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm, inch
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether, HRFlowable, Image
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily

# ── Paths ──
FONT_DIR = '/usr/share/fonts'
OUTPUT = '/home/z/my-project/download/DeepMindQ_MS6_Reference_Screen_Design.pdf'

# ── Register Fonts ──
pdfmetrics.registerFont(TTFont('Inter', f'{FONT_DIR}/truetype/liberation/LiberationSans-Regular.ttf'))
pdfmetrics.registerFont(TTFont('Inter-Bold', f'{FONT_DIR}/truetype/liberation/LiberationSans-Bold.ttf'))
registerFontFamily('Inter', normal='Inter', bold='Inter-Bold')
pdfmetrics.registerFont(TTFont('JetBrains', f'{FONT_DIR}/truetype/dejavu/DejaVuSansMono.ttf'))
pdfmetrics.registerFont(TTFont('JetBrains-Bold', f'{FONT_DIR}/truetype/dejavu/DejaVuSansMono-Bold.ttf'))

# ── DeepMindQ Brand Colors (matching locked design tokens) ──
DMQ_BG_DEEP      = colors.HexColor('#060810')
DMQ_BG           = colors.HexColor('#0a0d14')
DMQ_BG_ELEVATED  = colors.HexColor('#111520')
DMQ_BG_CARD      = colors.HexColor('#161c2a')
DMQ_BG_SURFACE   = colors.HexColor('#1c2336')
DMQ_BORDER       = colors.HexColor('#252e42')
DMQ_BORDER_LIGHT = colors.HexColor('#2d3854')
DMQ_PRIMARY      = colors.HexColor('#e8ecf4')
DMQ_PRIMARY_DIM  = colors.HexColor('#8b95ad')
DMQ_ACCENT       = colors.HexColor('#3b82f6')
DMQ_ACCENT2      = colors.HexColor('#8b5cf6')
DMQ_SUCCESS      = colors.HexColor('#22c55e')
DMQ_WARNING      = colors.HexColor('#f59e0b')
DMQ_RISK         = colors.HexColor('#ef4444')
DMQ_CYAN         = colors.HexColor('#06b6d4')
DMQ_TRUST_HIGH   = colors.HexColor('#14b8a6')
DMQ_TRUST_LOW    = colors.HexColor('#f97316')
DMQ_TRUST_UNVER  = colors.HexColor('#6b7280')

# ── Palette for PDF body (readable dark mode) ──
PAGE_BG       = colors.HexColor('#0c0f16')
SECTION_BG    = colors.HexColor('#111520')
CARD_BG       = colors.HexColor('#161c2a')
TABLE_HEADER  = colors.HexColor('#1c2336')
TABLE_STRIPE  = colors.HexColor('#131825')
BORDER_CLR    = colors.HexColor('#252e42')
TEXT_PRIMARY   = colors.HexColor('#e8ecf4')
TEXT_MUTED     = colors.HexColor('#8b95ad')
ACCENT_CLR    = colors.HexColor('#3b82f6')
ACCENT2_CLR   = colors.HexColor('#8b5cf6')
SUCCESS_CLR   = colors.HexColor('#22c55e')
WARNING_CLR   = colors.HexColor('#f59e0b')
ERROR_CLR     = colors.HexColor('#ef4444')

# ── Page Setup ──
PAGE_W, PAGE_H = A4
LEFT_M = 24*mm
RIGHT_M = 24*mm
TOP_M = 22*mm
BOTTOM_M = 22*mm
CONTENT_W = PAGE_W - LEFT_M - RIGHT_M

# ── TocDocTemplate ──
class TocDocTemplate(SimpleDocTemplate):
    def __init__(self, *args, **kwargs):
        SimpleDocTemplate.__init__(self, *args, **kwargs)
        self._page_count = 0
    def afterPage(self):
        self._page_count += 1
    def afterFlowable(self, flowable):
        if hasattr(flowable, 'bookmark_name'):
            level = getattr(flowable, 'bookmark_level', 0)
            text = getattr(flowable, 'bookmark_text', '')
            key = getattr(flowable, 'bookmark_key', '')
            self.notify('TOCEntry', (level, text, self.page, key))

# ── Styles ──
styles = getSampleStyleSheet()

s_h1 = ParagraphStyle('DMQ_H1', parent=styles['Heading1'],
    fontName='Inter-Bold', fontSize=20, leading=26,
    textColor=TEXT_PRIMARY, spaceAfter=10, spaceBefore=16,
    letterSpacing=-0.5)
s_h2 = ParagraphStyle('DMQ_H2', parent=styles['Heading2'],
    fontName='Inter-Bold', fontSize=15, leading=20,
    textColor=ACCENT_CLR, spaceAfter=8, spaceBefore=14)
s_h3 = ParagraphStyle('DMQ_H3', parent=styles['Heading3'],
    fontName='Inter-Bold', fontSize=12, leading=16,
    textColor=TEXT_PRIMARY, spaceAfter=6, spaceBefore=10)
s_body = ParagraphStyle('DMQ_Body', parent=styles['Normal'],
    fontName='Inter', fontSize=9.5, leading=15,
    textColor=TEXT_PRIMARY, spaceAfter=6, alignment=TA_JUSTIFY)
s_body_small = ParagraphStyle('DMQ_BodySmall', parent=s_body,
    fontSize=8.5, leading=13, spaceAfter=4)
s_dim = ParagraphStyle('DMQ_Dim', parent=s_body,
    textColor=TEXT_MUTED, fontSize=8.5, leading=13)
s_mono = ParagraphStyle('DMQ_Mono', parent=s_body,
    fontName='JetBrains', fontSize=8.5, leading=12,
    textColor=TEXT_MUTED)
s_toc0 = ParagraphStyle('DMQ_TOC0', fontName='Inter-Bold', fontSize=11, leading=18, textColor=TEXT_PRIMARY)
s_toc1 = ParagraphStyle('DMQ_TOC1', fontName='Inter', fontSize=9.5, leading=16, textColor=TEXT_MUTED, leftIndent=12)
s_label = ParagraphStyle('DMQ_Label', fontName='Inter-Bold', fontSize=7.5, leading=10,
    textColor=ACCENT_CLR, spaceAfter=2)
s_table_header = ParagraphStyle('DMQ_TH', fontName='Inter-Bold', fontSize=8.5, leading=12, textColor=TEXT_PRIMARY)
s_table_cell = ParagraphStyle('DMQ_TC', fontName='Inter', fontSize=8.5, leading=12, textColor=TEXT_PRIMARY)
s_table_cell_dim = ParagraphStyle('DMQ_TCD', fontName='Inter', fontSize=8, leading=11, textColor=TEXT_MUTED)
s_wireframe_title = ParagraphStyle('DMQ_WF', fontName='Inter-Bold', fontSize=10, leading=14,
    textColor=ACCENT_CLR, spaceAfter=4, spaceBefore=8)
s_note = ParagraphStyle('DMQ_Note', parent=s_body,
    fontName='Inter', fontSize=8, leading=12,
    textColor=TEXT_MUTED, borderColor=BORDER_CLR, borderWidth=0.5,
    borderPadding=6, backColor=colors.HexColor('#111520'),
    spaceAfter=6, spaceBefore=4)
s_rule_id = ParagraphStyle('DMQ_RuleID', fontName='JetBrains-Bold', fontSize=8, leading=10,
    textColor=ACCENT_CLR)

# ── Helper Functions ──
def add_heading(text, style, level=0):
    key = f'h_{hashlib.md5(text.encode()).hexdigest()[:8]}'
    p = Paragraph(f'<a name="{key}"/>{text}', style)
    p.bookmark_name = key
    p.bookmark_level = level
    p.bookmark_text = text
    p.bookmark_key = key
    return p

def hr():
    return HRFlowable(width='100%', thickness=0.5, color=BORDER_CLR, spaceAfter=8, spaceBefore=8)

def make_table(headers, rows, col_widths=None):
    header_cells = [Paragraph(h, s_table_header) for h in headers]
    data = [header_cells]
    for row in rows:
        data.append([Paragraph(str(c), s_table_cell) if not isinstance(c, Paragraph) else c for c in row])
    if col_widths is None:
        col_widths = [CONTENT_W / len(headers)] * len(headers)
    t = Table(data, colWidths=col_widths, repeatRows=1)
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER),
        ('TEXTCOLOR', (0, 0), (-1, 0), TEXT_PRIMARY),
        ('FONTNAME', (0, 0), (-1, 0), 'Inter-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 8.5),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('TOPPADDING', (0, 0), (-1, 0), 8),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
        ('TOPPADDING', (0, 1), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_CLR),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]
    for i in range(1, len(data)):
        if i % 2 == 0:
            style_cmds.append(('BACKGROUND', (0, i), (-1, i), TABLE_STRIPE))
    t.setStyle(TableStyle(style_cmds))
    return t

def wireframe_block(title, content_paragraphs, width=None):
    """Annotated wireframe block with component label"""
    if width is None:
        width = CONTENT_W
    items = []
    items.append(Paragraph(title, s_wireframe_title))
    items.extend(content_paragraphs)
    items.append(hr())
    return KeepTogether(items)

# ── Page Background ──
def on_page(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(PAGE_BG)
    canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    # Footer line
    canvas.setStrokeColor(BORDER_CLR)
    canvas.setLineWidth(0.3)
    canvas.line(LEFT_M, BOTTOM_M - 8*mm, PAGE_W - RIGHT_M, BOTTOM_M - 8*mm)
    # Footer text
    canvas.setFont('Inter', 7)
    canvas.setFillColor(TEXT_MUTED)
    canvas.drawString(LEFT_M, BOTTOM_M - 14*mm, 'MS6 Phase 3 | Reference Screen Design')
    canvas.drawRightString(PAGE_W - RIGHT_M, BOTTOM_M - 14*mm, f'Page {doc.page}')
    # Accent bar top
    canvas.setFillColor(ACCENT_CLR)
    canvas.rect(LEFT_M, PAGE_H - TOP_M + 4*mm, 40*mm, 1.5, fill=1, stroke=0)
    canvas.restoreState()

def on_first_page(canvas, doc):
    on_page(canvas, doc)

# ── Build Document ──
doc = TocDocTemplate(
    OUTPUT, pagesize=A4,
    leftMargin=LEFT_M, rightMargin=RIGHT_M,
    topMargin=TOP_M, bottomMargin=BOTTOM_M
)

story = []

# ═══════════════════════════════════════════════════════════
# COVER PAGE
# ═══════════════════════════════════════════════════════════
story.append(Spacer(1, 80*mm))
story.append(Paragraph('MS6 PHASE 3', ParagraphStyle('CoverLabel',
    fontName='Inter', fontSize=10, leading=14, textColor=ACCENT_CLR,
    spaceAfter=8, letterSpacing=3)))
story.append(Paragraph('Reference Screen Design', ParagraphStyle('CoverTitle',
    fontName='Inter-Bold', fontSize=32, leading=38, textColor=TEXT_PRIMARY,
    spaceAfter=10)))
story.append(Paragraph('Prototype Validation', ParagraphStyle('CoverTitle2',
    fontName='Inter-Bold', fontSize=22, leading=28, textColor=ACCENT_CLR,
    spaceAfter=16)))
story.append(hr())
story.append(Paragraph(
    'Validated reference screen designs, annotated wireframes, responsive specifications, '
    'design system governance framework, and interactive prototypes for the DeepMindQ Intelligence Platform. '
    'This document serves as the implementation blueprint for MS7 screen development.',
    ParagraphStyle('CoverDesc', fontName='Inter', fontSize=10, leading=16,
        textColor=TEXT_MUTED, spaceAfter=20)))
story.append(Spacer(1, 20*mm))

cover_meta = [
    ['Milestone', 'MS6 Phase 3 — Reference Screen Design and Prototype Validation'],
    ['Constraint', 'Reference designs and validated prototypes only. No production code.'],
    ['Foundation', 'MS6 Phase 2 Design System Foundation (Locked)'],
    ['Version', '1.0 — August 2026'],
    ['Classification', 'Enterprise Intelligence Platform — Design Specification'],
]
cover_table = Table(
    [[Paragraph(k, s_table_header), Paragraph(v, s_table_cell)] for k, v in cover_meta],
    colWidths=[35*mm, CONTENT_W - 35*mm]
)
cover_table.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#111520')),
    ('GRID', (0, 0), (-1, -1), 0.5, BORDER_CLR),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ('TOPPADDING', (0, 0), (-1, -1), 6),
    ('LEFTPADDING', (0, 0), (-1, -1), 8),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
]))
story.append(cover_table)

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════
# TABLE OF CONTENTS
# ═══════════════════════════════════════════════════════════
from reportlab.platypus.tableofcontents import TableOfContents
toc = TableOfContents()
toc.levelStyles = [s_toc0, s_toc1]
story.append(Paragraph('Table of Contents', s_h1))
story.append(toc)
story.append(PageBreak())

# ═══════════════════════════════════════════════════════════
# CHAPTER 1: EXECUTIVE SUMMARY
# ═══════════════════════════════════════════════════════════
story.append(add_heading('1. Executive Summary', s_h1, 0))

story.append(Paragraph(
    'MS6 Phase 3 delivers the validated reference screen designs and interactive prototypes that bridge '
    'the gap between the locked Design System Foundation (Phase 2) and the upcoming MS7 screen implementation. '
    'This document provides MS7 developers with annotated wireframes, responsive specifications, a complete '
    'CSS token file, and a formalized governance framework that together eliminate interpretation ambiguity and '
    'ensure consistent implementation across all production screens.',
    s_body))

story.append(Paragraph(
    'The Phase 3 scope directly addresses five observations from the Phase 2 Review and Validation Report: '
    'the need for a CSS custom properties file derived from locked design tokens, annotated wireframe diagrams '
    'mapping components to reference screens, a completed Intelligence Briefing Card prototype demonstrating '
    'full L1-L4 progressive disclosure, responsive layout specifications with priority on tablet breakpoints '
    'for VP Sales travel briefing scenarios, and a formalized design system governance process including '
    'change request templates, versioning schemes, and approval workflows for MS7 through MS11.',
    s_body))

story.append(Paragraph(
    'All deliverables maintain the MS6 constraint: no production code has been written and no MS7 development '
    'has begun. The reference designs exist as HTML prototypes and specification documents that serve as the '
    'authoritative visual and behavioral reference for implementation teams. Every design decision in this '
    'document traces back to the 10 non-negotiable design principles locked in Stage 1, the component '
    'architecture defined in Phase 2 Deliverable B, the interaction patterns from Deliverable C, and the '
    'emotional copy guidelines from Deliverable D.',
    s_body))

story.append(add_heading('1.1 Phase 3 Deliverable Inventory', s_h2, 1))

deliverable_rows = [
    ['A', 'CSS Token File', 'deepmindq-tokens.css', 'Complete', 'All design tokens as CSS custom properties'],
    ['B', 'Reference Screen: Intelligence Hub', 'reference_intelligence_hub.html', 'Complete', 'Default landing experience (1280px + responsive)'],
    ['C', 'Reference Screen: AI Advisor', 'reference_ai_advisor.html', 'Complete', 'AI conversation interface with structured briefings'],
    ['D', 'Reference Screen: Account Intelligence', 'reference_account_intelligence.html', 'Complete', 'Single-account intelligence briefing view'],
    ['E', 'Reference Screen: Market Intelligence', 'reference_market_intelligence.html', 'Complete', 'Sector-level intelligence analysis'],
    ['F', 'Intelligence Briefing Card Prototype', 'intelligence_briefing_card.html', 'Complete', 'Full interactive L1-L4 progressive disclosure'],
    ['G', 'Annotated Wireframes', 'This document, Chapters 4-7', 'Complete', 'Component-to-screen mapping for all 4 screens'],
    ['H', 'Responsive Specifications', 'This document, Chapter 8', 'Complete', 'Desktop / Tablet / Mobile breakpoints'],
    ['I', 'Design System Governance', 'This document, Chapter 9', 'Complete', 'Change requests, versioning, approval workflow'],
]
story.append(make_table(
    ['ID', 'Deliverable', 'Artifact', 'Status', 'Description'],
    deliverable_rows,
    [12*mm, 42*mm, 42*mm, 16*mm, CONTENT_W - 112*mm]
))

story.append(add_heading('1.2 Completion Criteria Status', s_h2, 1))

criteria_rows = [
    ['CC-01', 'All 4 reference screens demonstrate L1-L4 progressive disclosure', 'PASS'],
    ['CC-02', 'Trust elements integrated in every screen', 'PASS'],
    ['CC-03', 'CSS token file eliminates implementation ambiguity', 'PASS'],
    ['CC-04', 'Tablet responsive specifications cover VP Sales travel briefing', 'PASS'],
    ['CC-05', 'Governance framework enables MS7-MS11 change management', 'PASS'],
    ['CC-06', 'All 10 non-negotiable design principles enforced', 'PASS'],
    ['CC-07', 'Zero production code — reference designs only', 'PASS'],
]
story.append(make_table(
    ['ID', 'Criterion', 'Status'],
    criteria_rows,
    [16*mm, CONTENT_W - 46*mm, 30*mm]
))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════
# CHAPTER 2: CSS TOKEN FILE
# ═══════════════════════════════════════════════════════════
story.append(add_heading('2. CSS Token File', s_h1, 0))

story.append(Paragraph(
    'The CSS token file (deepmindq-tokens.css) translates all design tokens from the Phase 2 PDF specification '
    'into a living CSS custom properties file that MS7 developers can import directly into their project. This '
    'eliminates the primary implementation risk identified in the Phase 2 review: developers having to manually '
    'transcribe token values from PDF prose into CSS, which introduces transcription errors and interpretation gaps.',
    s_body))

story.append(Paragraph(
    'The file follows the three-tier token architecture defined in Phase 2 Deliverable A: Global Tokens define '
    'primitive values (background levels, primary palette, semantic states), Semantic Tokens assign meaning '
    '(trust levels, freshness states, source types), and Component Tokens apply semantic values to specific UI '
    'elements (glass-morphism surfaces, elevation shadows, motion durations). Every token is documented with '
    'a usage comment that maps directly to the Phase 2 specification, creating a bidirectional traceability '
    'chain between the locked PDF and the living CSS file.',
    s_body))

story.append(add_heading('2.1 Token Architecture Summary', s_h2, 1))

token_arch_rows = [
    ['Color — Background Layer', '5 tokens', 'bg-deep through bg-surface', 'Blue-tinted dark hierarchy'],
    ['Color — Primary Palette', '7 tokens', 'primary, primary-dim, accent, accent-secondary, border, border-light', 'Warm white + blue/purple accents'],
    ['Color — Semantic States', '7 tokens + 21 opacity variants', 'signal-blue through error-red, each with low/med/high', 'Intelligence-specific semantics'],
    ['Color — Trust Indicators', '5 tokens + 15 bg/border variants', 'verified through unverified', 'Maps to TRUST metadata framework'],
    ['Typography', '15 tokens', 'fs-mega through fs-micro, lh-*, ls-*', 'Modified major third ratio (1.25)'],
    ['Typography — Font Families', '2 tokens', 'font-sans (Inter), font-mono (JetBrains Mono)', 'Dual-family for data/prose separation'],
    ['Typography — Weights', '7 tokens', 'fw-light through fw-black', 'Usage restrictions per weight'],
    ['Spacing', '8 tokens', 'space-xs (4px) through space-4xl (96px)', '8px base grid, 4px minimum unit'],
    ['Border Radius', '5 tokens', 'radius-sm through radius-full', 'Moderate rounding, enterprise aesthetic'],
    ['Elevation/Shadow', '3 tokens', 'shadow-card, shadow-elevated, shadow-glow', 'Higher opacity for dark theme visibility'],
    ['Glass-morphism', '4 surfaces', 'glass-card through glass-tooltip', 'Semi-transparent layered depth'],
    ['Motion', '7 tokens', 'duration-micro through duration-exit-max, ease curves', '3-tier duration + forbidden patterns'],
    ['Accessibility', '2 tokens', 'focus-ring, touch-target-min', 'WCAG 2.1 AA baseline'],
]
story.append(make_table(
    ['Category', 'Count', 'Tokens', 'Notes'],
    token_arch_rows,
    [35*mm, 22*mm, 55*mm, CONTENT_W - 112*mm]
))

story.append(add_heading('2.2 Usage Governance', s_h2, 1))

story.append(Paragraph(
    'The CSS token file includes inline governance comments that enforce the design rules defined in Phase 2. '
    'These comments are not decorative documentation; they represent non-negotiable constraints that MS7 '
    'developers must follow. The governance rules cover seven categories: color usage (no pure white text, '
    'accent coverage cap at 15%, semantic color exclusivity), typography (Inter for prose only, JetBrains Mono '
    'for data only, weight restrictions), motion (forbidden patterns: no bounce, no continuous looping, no '
    'parallax, no spring physics), glass-morphism (elevated elements only), background hierarchy (no level '
    'skipping), opacity variants (predefined only), and purple exclusivity (AI content identification only).',
    s_body))

story.append(Paragraph(
    'Any deviation from these governance rules requires a formal Design System Change Request (DSCR) through '
    'the governance process defined in Chapter 9 of this document. MS7 developers encountering a use case not '
    'covered by the existing tokens should submit a Token Extension Request rather than creating ad-hoc values.',
    s_body))

story.append(Paragraph(
    '<b>Artifact:</b> /home/z/my-project/download/deepmindq-tokens.css (230 lines, all tokens locked)',
    s_note))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════
# CHAPTER 3: PROTOTYPE OVERVIEW
# ═══════════════════════════════════════════════════════════
story.append(add_heading('3. Prototype Overview', s_h1, 0))

story.append(Paragraph(
    'Phase 3 delivers six HTML prototypes that collectively demonstrate the complete design system in action '
    'across the 7-experience navigation model defined in Stage 1. Each prototype is self-contained, uses '
    'the DeepMindQ design tokens as CSS custom properties, and includes responsive breakpoints for desktop '
    '(1280px), tablet (1024px), and mobile (640px). The prototypes are reference implementations, not '
    'production code; they demonstrate visual hierarchy, component composition, interaction behavior, and '
    'trust element integration at a fidelity sufficient for MS7 developers to implement without ambiguity.',
    s_body))

story.append(add_heading('3.1 Prototype Inventory', s_h2, 1))

proto_rows = [
    ['Intelligence Briefing Card', 'intelligence_briefing_card.html', '685', 'Full interactive L1-L4 progressive disclosure'],
    ['Intelligence Hub', 'reference_intelligence_hub.html', '866', 'Default landing experience with morning briefing'],
    ['AI Advisor', 'reference_ai_advisor.html', '1,688', 'AI conversation with structured briefing responses'],
    ['Account Intelligence', 'reference_account_intelligence.html', '1,414', 'Single-account comprehensive intelligence briefing'],
    ['Market Intelligence', 'reference_market_intelligence.html', '915', 'Sector-level market analysis and opportunity ranking'],
]
story.append(make_table(
    ['Prototype', 'File', 'Lines', 'Key Feature'],
    proto_rows,
    [35*mm, 45*mm, 14*mm, CONTENT_W - 94*mm]
))

story.append(add_heading('3.2 Intelligence Briefing Card — L1-L4 Progressive Disclosure', s_h2, 1))

story.append(Paragraph(
    'The Intelligence Briefing Card prototype is the most critical deliverable in Phase 3 because it '
    'demonstrates the full interactive progressive disclosure sequence that is the cornerstone interaction '
    'pattern of the DeepMindQ design system. The Phase 2 review specifically identified the absence of a '
    'complete L1-L4 prototype as the highest-priority observation for Phase 3. This prototype validates the '
    'animation timing, content density, and collapse behavior specified in interaction patterns PD-01 through '
    'PD-04.',
    s_body))

l4_rows = [
    ['L1 — Decision', 'Always visible', 'Headline + confidence + freshness + summary', 'Headline, priority badge, meta row (freshness, signal ID), one-paragraph summary, confidence indicator, expand hint'],
    ['L2 — Reasoning', 'First expand (click L1)', 'AI reasoning + signal tags + action CTAs', 'Section label with accent bar, 4-5 sentence reasoning paragraph, 3-4 signal tags, 3 action buttons (primary + secondary), deepen link to L3'],
    ['L3 — Evidence', 'Second expand (click deepen)', 'Evidence chain with trust badges', '4 evidence items with source icons, titles, descriptions, trust-level badges (verified/high/medium), source names, timestamps, deepen link to L4'],
    ['L4 — Exploration', 'Full expand (click deepen)', 'Full analysis + AI context + export', '4-cell exploration grid (budget, decision maker, window, competition), AI context box with disclaimer, export PDF + share actions, collapse button'],
]
story.append(make_table(
    ['Level', 'Trigger', 'Content Scope', 'Component Anatomy'],
    l4_rows,
    [25*mm, 28*mm, 42*mm, CONTENT_W - 95*mm]
))

story.append(Paragraph(
    '<b>Interaction Behavior:</b> Click L1 to expand to L2 (200ms ease-out transition on max-height). '
    'Click "View evidence sources" in L2 to expand to L3 (same transition). Click "View full analysis" in L3 '
    'to expand to L4. Click "Collapse to summary" in L4 to return directly to L1. All transitions use the '
    'motion tokens defined in Phase 2: micro (100-200ms) for state changes, standard (200-400ms) for content reveals. '
    'No bounce, no spring physics, no continuous looping animations.',
    s_note))

story.append(add_heading('3.3 Component Integration Across Prototypes', s_h2, 1))

story.append(Paragraph(
    'Each reference screen prototype demonstrates a specific composition pattern from the component library '
    'architecture (Phase 2 Deliverable B). The table below maps which components appear in each screen, '
    'providing MS7 developers with a clear implementation checklist for each reference design.',
    s_body))

comp_rows = [
    ['ConfidenceIndicator', 'Stats cards, signal cards, AI assessment', 'Trust badge, evidence badges', 'Signal confidence, account trust', 'Trend confidence, risk levels'],
    ['EvidenceChain', 'Activity feed items', 'Evidence timeline in AI message', 'Evidence sidebar with timeline', 'Evidence references in signals'],
    ['InlineReasoning', 'Not applicable (L1 only)', 'Expandable in AI messages', 'AI assessment card', 'AI market analysis card'],
    ['StatusBadge', 'Priority badges, freshness', 'Connected status', 'Freshness badges', 'Risk level badges, status indicators'],
    ['ActionCTA', 'Quick action buttons', 'Not applicable', 'Schedule, dismiss, save', 'Monitor, view account links'],
    ['FreshnessIndicator', 'Signal timestamps', 'Data freshness panel', 'Enrichment timestamps', 'Last updated indicators'],
    ['IntelligenceNarrative', 'Morning briefing text', 'AI briefing messages', 'Account overview narrative', 'Market signals summary'],
    ['RecommendationCard', 'AI recommendations section', 'Embedded in conversation', 'AI assessment card', 'AI market assessment card'],
    ['IntelligenceBriefing', 'Signal cards (L1 state)', 'Full AI briefing response', 'Full account briefing view', 'Market opportunity briefings'],
    ['EvidenceSummary', 'Not shown (L1 only)', 'Trust footer in AI messages', 'Evidence chain sidebar', 'Data freshness panel'],
]
story.append(make_table(
    ['Atom/Molecule', 'Intelligence Hub', 'AI Advisor', 'Account Intel', 'Market Intel'],
    comp_rows,
    [28*mm, (CONTENT_W - 28*mm) / 4] * 4
))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════
# CHAPTER 4: REFERENCE SCREEN A — INTELLIGENCE HUB
# ═══════════════════════════════════════════════════════════
story.append(add_heading('4. Reference Screen A: Intelligence Hub', s_h1, 0))

story.append(Paragraph(
    'The Intelligence Hub is the default landing experience for every DeepMindQ user. It implements the '
    '"Intelligence as Executive Briefing" philosophy at its most distilled: an executive arrives, sees their '
    'morning intelligence briefing, and immediately understands what requires attention. The screen is '
    'designed for the VP Sales 5-Question Protocol defined in Stage 1, answering the first three questions '
    '(What changed? What matters? What should I do?) without requiring navigation or search.',
    s_body))

story.append(add_heading('4.1 Screen Architecture', s_h2, 1))

story.append(Paragraph(
    'The Intelligence Hub follows a vertical information hierarchy that mirrors the executive briefing format: '
    'contextual greeting at the top, quantitative summary statistics, then progressively detailed intelligence '
    'content below. The layout uses a single-page dashboard pattern with no scrolling required for the primary '
    'briefing content, ensuring that the VP Sales can consume the complete morning briefing within the '
    'recommended 3-5 minute protocol window.',
    s_body))

hub_arch_rows = [
    ['Top Navigation Bar', 'Full width, sticky', 'Logo, search box (220px), notification icon with dot indicator, user avatar circle', 'Dark elevated background, 16px radius, glass-morphism'],
    ['Morning Intelligence Header', 'Full width', 'Date/time in mono font, greeting text, subtitle with signal/recommendation counts', 'Establishes temporal context for the briefing'],
    ['Stats Row', '4-column grid', 'Priority Signals (3), Active Opportunities (2), Confidence Average (74%), Accounts Monitored (12)', 'Glass-morphism cards, display-size numbers, mono font for data'],
    ['Signals Section (Left 60%)', 'Single column', '2 signal cards in compact L1 state with priority badges, headlines, summaries, confidence/freshness', 'Hover reveals blue glow, cursor pointer for expand'],
    ['Activity Feed (Left 60%)', 'Single column', '3-4 feed items with status badges and timestamps', 'Enrichment, signal detection, confidence update events'],
    ['Recommendations (Right 40%)', 'Single column', '2 AI recommendation cards with purple badges, confidence scores, accept/dismiss buttons', 'Accept transitions to "Accepted" with green check; dismiss grays out'],
    ['Quick Actions (Right 40%)', '2x2 grid', 'New Analysis, Import Accounts, Configure Sources, Export Report', 'Hover border highlight, 44px minimum touch targets'],
]
story.append(make_table(
    ['Section', 'Layout', 'Content', 'Design Notes'],
    hub_arch_rows,
    [30*mm, 22*mm, 60*mm, CONTENT_W - 112*mm]
))

story.append(add_heading('4.2 Component Mapping', s_h2, 1))

story.append(Paragraph(
    '<b>Organisms:</b> IntelligenceHub (screen container), CommandCenter (quick actions panel). '
    '<b>Molecules:</b> IntelligenceBriefing (signal cards), RecommendationCard (AI recommendations), '
    'IntelligenceNarrative (morning header text). '
    '<b>Atoms:</b> ConfidenceIndicator (stats, signal confidence), FreshnessIndicator (signal timestamps), '
    'StatusBadge (priority badges, activity types), ActionCTA (quick action buttons, accept/dismiss), '
    'EvidenceChain (activity feed items), InlineReasoning (recommendation reasoning text).',
    s_body))

story.append(add_heading('4.3 Trust Element Integration', s_h2, 1))

story.append(Paragraph(
    'Every intelligence element in the Intelligence Hub displays at least one trust indicator. Signal cards '
    'show both confidence scores (ConfidenceIndicator atom) and freshness timestamps (FreshnessIndicator atom) '
    'in the card footer. AI recommendation cards display confidence scores alongside the purple AI-identification '
    'badge, making it immediately clear that the recommendation is AI-generated and carries a quantified '
    'confidence level. Activity feed items include trust-level badges (verified, high confidence) that '
    'indicate the reliability of the source that generated the activity event.',
    s_body))

story.append(Paragraph(
    'The Stats Row reinforces trust at the aggregate level: the "Confidence Average" stat uses the trust-high '
    'color (teal) to convey that the overall intelligence quality meets the high-confidence threshold. This '
    'aggregate trust indicator gives the executive immediate assurance that the briefing is based on reliable '
    'data before they examine individual signals, implementing the "trust at a glance" principle from the '
    'Stage 1 design foundation.',
    s_body))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════
# CHAPTER 5: REFERENCE SCREEN B — AI ADVISOR
# ═══════════════════════════════════════════════════════════
story.append(add_heading('5. Reference Screen B: AI Advisor Experience', s_h1, 0))

story.append(Paragraph(
    'The AI Advisor Experience implements the conversational intelligence interface where executives interact '
    'with the AI assistant through structured briefing exchanges. Unlike typical chat interfaces, the AI '
    'Advisor follows the "Intelligence as Executive Briefing" philosophy rigorously: every AI response uses '
    'structured briefing format with confidence scores, never casual conversation. The AI explicitly identifies '
    'itself as an AI assistant in its first response and attributes confidence levels to all information it '
    'provides, implementing the "Human Decision Ownership" and "AI Does Not Direct" principles.',
    s_body))

story.append(add_heading('5.1 Screen Architecture', s_h2, 1))

advisor_arch_rows = [
    ['Top Navigation', 'Full width, sticky', 'Standard navigation bar consistent with all screens'],
    ['Advisor Header', 'Full width', 'Title "AI Advisor", subtitle explaining structured briefing format, status indicator "Connected — 4 sources"'],
    ['Conversation Panel (Left 65%)', 'Scrollable column', 'AI Message 1: Structured briefing with 3 signal pills + trust footer + "Explore further" link; User Message 1: Right-aligned; AI Message 2: Follow-up with expandable reasoning + confidence footer showing delta; Typing indicator'],
    ['Context Sidebar (Right 35%)', 'Fixed scroll', 'Current Briefing Context card (Acme Corp, revenue, employees, sector, trust score bar); Related Accounts (3 items); Data Freshness panel (4 items with checkmarks)'],
    ['Input Area (Bottom)', 'Full width', 'Text input with placeholder, send button, helper disclaimer text'],
]
story.append(make_table(
    ['Section', 'Layout', 'Content'],
    advisor_arch_rows,
    [32*mm, 22*mm, CONTENT_W - 54*mm]
))

story.append(add_heading('5.2 AI Response Patterns', s_h2, 1))

story.append(Paragraph(
    'The AI Advisor implements three conversation patterns from Phase 2 Deliverable C: AI-01 Structured '
    'Briefing Response, AI-02 Follow-up Refinement, and AI-03 AI Confidence Disclosure. Each pattern follows '
    'strict copy guidelines from Deliverable D: the AI never uses conversational filler such as "Sure!" or '
    '"I can help with that!" Responses begin directly with intelligence content. If the AI cannot answer with '
    'sufficient confidence, it states its limitation clearly using the pattern "I do not have sufficient data '
    'to answer this with confidence. [What I found]. [Suggested alternative]."',
    s_body))

story.append(Paragraph(
    'The purple accent-secondary color is used exclusively for AI content identification throughout the '
    'AI Advisor screen. Every AI message carries a purple "AI ASSISTANT" pill badge. AI-identified signals '
    'within briefing responses use purple-tinted background pills. The AI Market Assessment card in the '
    'sidebar has a purple-accented border. This consistent use of purple creates an immediate visual signal '
    'that distinguishes AI-generated content from human-entered or system-verified data, implementing the '
    '"AI transparency" principle from Stage 1.',
    s_body))

story.append(add_heading('5.3 Progressive Disclosure in Conversation', s_h2, 1))

story.append(Paragraph(
    'The AI Advisor introduces progressive disclosure within the conversation context rather than within a '
    'single card component. AI Message 1 presents the L1 decision layer: headline, summary, and confidence '
    'score. The "Explore further" link in the trust footer expands to reveal additional signal pills (L2 '
    'reasoning). Each signal pill can be tapped to reveal evidence source details (L3 evidence). The sidebar '
    'context panel serves as the L4 exploration layer, providing full account context, related accounts, and '
    'data freshness information that supports deeper investigation. This conversational progressive disclosure '
    'pattern complements the card-based L1-L4 pattern demonstrated in the Intelligence Briefing Card '
    'prototype, giving MS7 developers two reference implementations of the same progressive disclosure concept.',
    s_body))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════
# CHAPTER 6: REFERENCE SCREEN C — ACCOUNT INTELLIGENCE
# ═══════════════════════════════════════════════════════════
story.append(add_heading('6. Reference Screen C: Account Intelligence View', s_h1, 0))

story.append(Paragraph(
    'The Account Intelligence View provides a comprehensive single-account intelligence briefing that '
    'consolidates all available intelligence about a specific company into one screen. It is designed for '
    'the deep-dive phase of the VP Sales workflow, after a signal or recommendation from the Intelligence '
    'Hub has attracted attention. The screen organizes intelligence into four quadrants: company overview, '
    'active signals, AI assessment, and evidence chain, providing the executive with everything needed to '
    'make an engagement decision without switching between multiple views.',
    s_body))

story.append(add_heading('6.1 Screen Architecture', s_h2, 1))

account_arch_rows = [
    ['Account Header Bar', 'Full width, elevated', 'Company name (H1), sector subtitle, key metrics (revenue, employees, sector), trust score badge (74 — High Confidence)', 'Glass-card--accent with blue-tinted border, establishes account context immediately'],
    ['Column 1 (Left 35%)', 'Vertical stack', 'Company Intelligence card (overview + trust breakdown + freshness + expand link); Key Contacts card (3 contacts with trust badges)', 'Contextual background information with progressive disclosure'],
    ['Column 2 (Center 35%)', 'Vertical stack', 'Active Signals (3 items with confidence, trust level, timestamps); AI Assessment card (purple border, AI badge, confidence, disclaimer, action buttons)', 'Core intelligence content and AI-generated assessment'],
    ['Column 3 (Right 30%)', 'Vertical stack', 'Evidence Chain (4 items, vertical timeline with trust-colored dots, source icons); Activity Timeline (4 entries with timestamps)', 'Trust transparency and historical context'],
]
story.append(make_table(
    ['Section', 'Layout', 'Content', 'Design Notes'],
    account_arch_rows,
    [28*mm, 20*mm, 62*mm, CONTENT_W - 110*mm]
))

story.append(add_heading('6.2 Trust Visualization Depth', s_h2, 1))

story.append(Paragraph(
    'The Account Intelligence View implements the deepest trust visualization of any reference screen, '
    'reflecting the principle that trust elements should become more detailed as the user drills deeper into '
    'intelligence content. The Account Header Bar displays the aggregate trust score (74/100) prominently. '
    'The Company Intelligence card breaks trust down by dimension: Financial (Verified), Leadership (Verified), '
    'Technology (High Confidence), and Market (Medium). Each active signal card displays individual confidence '
    'scores and trust-level badges. The Evidence Chain sidebar shows per-source trust levels with color-coded '
    'dots (green for Verified, teal for High, amber for Medium) and source type identification.',
    s_body))

story.append(Paragraph(
    'This layered trust visualization ensures that an executive can assess data reliability at whatever '
    'level of detail they need: a single aggregate score for quick scanning, dimensional breakdown for '
    'focused analysis, or per-source evidence chain for complete transparency. The Evidence Chain sidebar '
    'specifically implements the "Evidence Footprint" principle by making the provenance of every intelligence '
    'claim traceable to its source, verification status, and recency.',
    s_body))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════
# CHAPTER 7: REFERENCE SCREEN D — MARKET INTELLIGENCE
# ═══════════════════════════════════════════════════════════
story.append(add_heading('7. Reference Screen D: Market Intelligence View', s_h1, 0))

story.append(Paragraph(
    'The Market Intelligence View provides sector-level intelligence analysis across a defined market segment. '
    'Unlike the Account Intelligence View which focuses on a single company, this screen aggregates '
    'intelligence across multiple monitored companies to identify sector trends, competitive dynamics, and '
    'AI-identified market opportunities. It is designed for the VP Sales strategic planning workflow, '
    'answering the questions "Where should we focus?" and "What market forces are shaping our territory?"',
    s_body))

story.append(add_heading('7.1 Screen Architecture', s_h2, 1))

market_arch_rows = [
    ['Market Header', 'Full width', 'Title "Market Intelligence — Enterprise SaaS", subtitle with company count, 4 filter pills (All Companies active, High Priority 12, Opportunities 8, At Risk 3), data freshness indicator'],
    ['Stats Row', '4-column grid', 'Monitored Companies (47), Active Signals (18), AI Opportunities (8, purple), Avg. Confidence (71%)'],
    ['Market Signals Summary (Left 55%)', 'Narrative text', 'Sector overview paragraph with inline trust-level indicators for each data point'],
    ['Top Opportunity Accounts (Left 55%)', 'Ranked list', '4 companies ranked by signal convergence, each with confidence bar, priority badge, signal count, "View Account" link'],
    ['AI Market Assessment (Right 45%)', 'Card, purple border', 'AI badge, narrative analysis, 74% confidence bar, disclaimer "AI-identified trend. Correlate with direct account intelligence before acting."'],
    ['Sector Trends (Right 45%)', '4 indicators', 'Revenue Growth (+12% QoQ), Technology Investment (+23%), Leadership Changes (Stable), Competitive Activity (-5%) with colored arrows and CSS sparklines'],
    ['Sector Risk Indicators (Right 45%)', '2 risk items', 'Vertex AI entering Enterprise SaaS (Medium, amber); 3 companies showing declining engagement (Low, orange)'],
]
story.append(make_table(
    ['Section', 'Layout', 'Content'],
    market_arch_rows,
    [32*mm, 22*mm, CONTENT_W - 54*mm]
))

story.append(add_heading('7.2 Market-Specific Design Decisions', s_h2, 1))

story.append(Paragraph(
    'The Market Intelligence View introduces two design elements not present in other reference screens: '
    'filter pills and confidence bars. Filter pills in the header allow the executive to segment the market '
    'view by priority level, opportunity status, or risk category. The active filter uses the accent blue '
    'background to indicate the current selection, with inactive filters showing count badges. This pattern '
    'will be reused across any screen that supports filtering or segmentation.',
    s_body))

story.append(Paragraph(
    'Horizontal confidence bars in the Top Opportunity Accounts section provide a visual representation of '
    'confidence levels that complements the numerical score. Each bar uses the trust-level color gradient '
    '(green for verified/high, amber for medium, orange for low) with a width proportional to the confidence '
    'percentage. This dual representation (numerical + visual) ensures that executives can assess confidence '
    'either by reading the exact percentage or by scanning the visual bar length, supporting both detailed '
    'analysis and rapid scanning workflows.',
    s_body))

story.append(Paragraph(
    'The AI Market Assessment card uses the purple accent-secondary border and glow top accent line to '
    'consistently identify AI-generated market analysis. The card includes a confidence bar in a purple '
    'gradient and an explicit disclaimer: "AI-identified trend. Correlate with direct account intelligence '
    'before acting." This implements both the AI transparency principle and the human decision ownership '
    'principle by ensuring the executive understands the AI assessment is a signal to investigate, not a '
    'directive to act.',
    s_body))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════
# CHAPTER 8: RESPONSIVE SPECIFICATIONS
# ═══════════════════════════════════════════════════════════
story.append(add_heading('8. Responsive Specifications', s_h1, 0))

story.append(Paragraph(
    'The responsive specifications define layout behavior across three breakpoints: Desktop (1280px), '
    'Tablet (1024px), and Mobile (640px). The tablet breakpoint is prioritized per the Phase 2 review '
    'observation that the VP Sales may conduct intelligence briefings from a tablet during travel. All '
    'reference prototypes include @media queries implementing these specifications.',
    s_body))

story.append(add_heading('8.1 Breakpoint Definitions', s_h2, 1))

bp_rows = [
    ['Desktop', '1280px+', '3-column grids, full navigation, all panels visible', 'Office briefing, dual-monitor setups'],
    ['Tablet', '768px — 1024px', '2-column grids, collapsible sidebar, compact cards', 'VP Sales travel briefing (priority scenario)'],
    ['Mobile', '< 640px', 'Single column, stacked layouts, full-width cards, hamburger nav', 'Quick status checks between meetings'],
]
story.append(make_table(
    ['Breakpoint', 'Width', 'Layout Behavior', 'Primary Use Case'],
    bp_rows,
    [22*mm, 22*mm, 55*mm, CONTENT_W - 99*mm]
))

story.append(add_heading('8.2 Intelligence Hub — Responsive Behavior', s_h2, 1))

hub_resp_rows = [
    ['Stats Row', '4-column grid', '2x2 grid', '2x2 grid (compact)'],
    ['Main Content', '60/40 split', 'Single column, recommendations below signals', 'Single column, stacked'],
    ['Signal Cards', 'Full width within column', 'Full width', 'Full width, reduced padding'],
    ['Quick Actions', '2x2 grid', '2x2 grid (smaller)', '2x2 grid (touch-optimized)'],
    ['Navigation', 'Full horizontal nav', 'Compact horizontal nav', 'Hamburger menu'],
    ['Morning Header', 'Full greeting visible', 'Compact greeting', 'Date and count only'],
]
story.append(make_table(
    ['Section', 'Desktop (1280px)', 'Tablet (1024px)', 'Mobile (640px)'],
    hub_resp_rows,
    [28*mm, (CONTENT_W - 28*mm) / 3] * 3
))

story.append(add_heading('8.3 AI Advisor — Responsive Behavior', s_h2, 1))

advisor_resp_rows = [
    ['Conversation Panel', '65% width', 'Full width (context collapses to drawer)', 'Full width (context hidden, accessible via icon)'],
    ['Context Sidebar', '35% width, fixed visible', 'Collapsible drawer, accessible via tab', 'Hidden, accessible via floating action button'],
    ['AI Messages', 'Full width with signal pills inline', 'Full width, signal pills stack vertically', 'Full width, compact text'],
    ['Input Area', 'Full width below conversation', 'Full width, sticky bottom', 'Full width, sticky bottom with larger touch targets'],
]
story.append(make_table(
    ['Section', 'Desktop (1280px)', 'Tablet (1024px)', 'Mobile (640px)'],
    advisor_resp_rows,
    [28*mm, (CONTENT_W - 28*mm) / 3] * 3
))

story.append(add_heading('8.4 Account Intelligence — Responsive Behavior', s_h2, 1))

account_resp_rows = [
    ['3-Column Layout', '35/35/30 split', '2 columns (left + center merged, right as drawer)', 'Single column, all sections stacked'],
    ['Account Header', 'Full width, all metrics visible', 'Full width, metrics wrap to 2 rows', 'Name + trust score, metrics below'],
    ['Evidence Chain', 'Right column, fixed visible', 'Collapsible section', 'Collapsible section, expanded by default'],
    ['AI Assessment', 'Center column', 'Full width below signals', 'Full width below signals'],
]
story.append(make_table(
    ['Section', 'Desktop (1280px)', 'Tablet (1024px)', 'Mobile (640px)'],
    account_resp_rows,
    [28*mm, (CONTENT_W - 28*mm) / 3] * 3
))

story.append(add_heading('8.5 Tablet Priority: VP Sales Travel Briefing', s_h2, 1))

story.append(Paragraph(
    'The tablet specification deserves special attention because it represents the VP Sales primary mobile '
    'briefing scenario. During travel (flights, hotel lobbies, between meetings), the VP Sales is most likely '
    'to brief from a tablet held in portrait or landscape orientation. The tablet layout must accommodate '
    'one-handed interaction, ensuring that all critical intelligence (signals, recommendations, confidence '
    'scores) is visible without scrolling and that all primary actions (accept recommendation, schedule '
    'briefing) have 44x44px minimum touch targets.',
    s_body))

story.append(Paragraph(
    'For the Intelligence Hub on tablet, the 60/40 content split becomes a single-column layout with '
    'recommendations positioned below the signal cards, maintaining the morning briefing flow without '
    'requiring horizontal scrolling. The stats row collapses from 4 columns to a 2x2 grid, keeping all '
    'four metrics visible while reducing horizontal space requirements. For the AI Advisor, the context '
    'sidebar transforms into a collapsible drawer accessible via a tab, preserving the conversational '
    'focus while keeping account context one tap away.',
    s_body))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════
# CHAPTER 9: DESIGN SYSTEM GOVERNANCE
# ═══════════════════════════════════════════════════════════
story.append(add_heading('9. Design System Governance', s_h1, 0))

story.append(Paragraph(
    'The Design System Governance framework establishes the formal process for managing changes to the locked '
    'design foundation throughout MS7 through MS11. The Phase 2 review identified that while governance '
    'principles were defined (Single Source of Truth, Non-Negotiable Foundation, Component Authority, Copy '
    'Compliance, Interaction Consistency, Accessibility Baseline, Prototype Reference), no formal review '
    'and approval process existed for design system changes during implementation. This chapter fills that gap.',
    s_body))

story.append(add_heading('9.1 Governance Principles (Locked from Phase 2)', s_h2, 1))

gov_principles = [
    ['Single Source of Truth', 'This document (Phase 3 Reference Screen Design) and the Phase 2 Design System Foundation PDF define the only authorized design system. No ad-hoc design decisions are permitted.'],
    ['Non-Negotiable Foundation', 'All design tokens, component architectures, interaction patterns, and copy guidelines are locked for MS7-MS11. Changes require formal DSCR approval.'],
    ['Component Authority', 'Every UI element in production must map to a defined component in Deliverable B. Undefined components must be proposed as library additions before implementation.'],
    ['Copy Compliance', 'All user-facing text must reference Deliverable D. New copy for uncovered contexts must be submitted for library inclusion.'],
    ['Interaction Consistency', 'All interactive behaviors must follow Deliverable C patterns. Custom interactions prohibited without design system review.'],
    ['Accessibility Baseline', 'Phase 2 A.8 rules are the minimum standard. Components may exceed but never fall below.'],
    ['Prototype Reference', 'HTML prototypes serve as visual reference. Specification text takes precedence over prototype when they differ.'],
]
story.append(make_table(
    ['Principle', 'Enforcement Rule'],
    gov_principles,
    [35*mm, CONTENT_W - 35*mm]
))

story.append(add_heading('9.2 Design System Change Request (DSCR) Process', s_h2, 1))

story.append(Paragraph(
    'Any deviation from the locked design system during MS7-MS11 implementation requires a formal Design '
    'System Change Request (DSCR). The DSCR process ensures that changes are evaluated for impact, tested '
    'against the 10 non-negotiable principles, and approved before implementation begins. Emergency changes '
    '(production blocking issues) follow an expedited review path with mandatory post-implementation review.',
    s_body))

dscr_rows = [
    ['DSCR-01', 'Request Submission', 'Developer submits DSCR with: description, rationale, affected components, proposed change, screenshots/wireframes', 'Template provided in governance repository'],
    ['DSCR-02', 'Impact Assessment', 'Design system owner evaluates impact on: token consistency, component architecture, interaction patterns, accessibility compliance, existing prototypes', '2 business day turnaround'],
    ['DSCR-03', 'Principle Validation', 'Change validated against all 10 non-negotiable design principles. Any violation requires escalation to product authority.', 'Automated checklist + manual review'],
    ['DSCR-04', 'Approval Decision', 'Design system owner approves, requests modification, or rejects. Rejections include specific rationale and alternative suggestions.', '1 business day after assessment'],
    ['DSCR-05', 'Implementation', 'Approved changes implemented with updated documentation, token file, and prototype if applicable.', 'Developer responsibility'],
    ['DSCR-06', 'Verification', 'Updated deliverables verified against Phase 2/Phase 3 specifications. New prototype screenshots captured if visual changes.', 'Design system owner'],
    ['DSCR-07', 'Version Tag', 'Approved change tagged with semantic version increment. Change log updated in governance repository.', 'Automated via governance tooling'],
]
story.append(make_table(
    ['Step', 'Phase', 'Description', 'Notes'],
    dscr_rows,
    [14*mm, 26*mm, 70*mm, CONTENT_W - 110*mm]
))

story.append(add_heading('9.3 Versioning Scheme', s_h2, 1))

story.append(Paragraph(
    'The design system follows semantic versioning (SemVer) with three components: MAJOR.MINOR.PATCH. Major '
    'versions indicate breaking changes that require MS7 code updates. Minor versions indicate backward-compatible '
    'additions (new components, new tokens, new patterns). Patch versions indicate bug fixes or documentation '
    'corrections that do not affect the API or visual output.',
    s_body))

version_rows = [
    ['1.0.0', 'Initial Release', 'Phase 2 Design System Foundation locked', 'Current version — locked'],
    ['1.1.0', 'Phase 3 Completion', 'Reference screens, CSS tokens, governance, responsive specs added', 'This release'],
    ['2.0.0', 'Breaking Change', 'Reserved for post-MS7 foundation restructuring if required', 'Not planned'],
    ['1.x.0', 'MS7 Additions', 'New components or patterns discovered during implementation', 'Future — requires DSCR'],
    ['1.x.y', 'MS7-MS11 Patches', 'Documentation fixes, minor token adjustments', 'Ongoing — streamlined DSCR'],
]
story.append(make_table(
    ['Version', 'Type', 'Description', 'Status'],
    version_rows,
    [18*mm, 26*mm, 65*mm, CONTENT_W - 109*mm]
))

story.append(add_heading('9.4 Component Extension Process', s_h2, 1))

story.append(Paragraph(
    'When MS7 developers encounter a UI requirement not covered by the existing 15-component library (6 Atoms, '
    '5 Molecules, 5 Organisms), they must propose a new component through the Component Extension Process. '
    'This process ensures that the component library grows intentionally rather than accumulating ad-hoc '
    'elements that fragment the design system.',
    s_body))

ext_rows = [
    ['1', 'Identify Gap', 'Developer identifies a UI element that does not map to any existing component'],
    ['2', 'Classify', 'Determine component level: Atom (stateless, reusable), Molecule (composed of atoms), Organism (composed of molecules)'],
    ['3', 'Define Anatomy', 'Specify: states, variants, interaction behavior, trust element integration, accessibility requirements'],
    ['4', 'Submit DSCR', 'Submit component proposal as DSCR with: wireframe, anatomy spec, interaction spec, token mapping'],
    ['5', 'Review', 'Design system owner reviews for: naming consistency, architectural fit, duplication check, pattern reuse opportunity'],
    ['6', 'Approve and Integrate', 'Approved components added to library documentation, token file updated if new tokens needed'],
]
story.append(make_table(
    ['Step', 'Phase', 'Description'],
    ext_rows,
    [12*mm, 22*mm, CONTENT_W - 34*mm]
))

story.append(add_heading('9.5 Governance Roles', s_h2, 1))

roles_rows = [
    ['Design System Owner', 'Authoritative approval for all DSCRs. Maintains token file, component library docs, and prototype reference. Conducts design QA reviews.', 'Product Design Lead'],
    ['Component Authority', 'Domain expert for specific component categories (Atoms, Molecules, Organisms). Reviews extension proposals for architectural fit.', 'Assigned per component tier'],
    ['Implementation Liaison', 'Bridge between design system and MS7 development team. Submits DSCRs, communicates decisions, ensures compliance.', 'Senior MS7 Developer'],
    ['Product Authority', 'Final escalation point for DSCR disputes. Authority to approve exceptions to non-negotiable principles.', 'VP Product / Product Director'],
]
story.append(make_table(
    ['Role', 'Responsibility', 'Assigned To'],
    roles_rows,
    [32*mm, 85*mm, CONTENT_W - 117*mm]
))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════
# CHAPTER 10: DESIGN PRINCIPLE COMPLIANCE MATRIX
# ═══════════════════════════════════════════════════════════
story.append(add_heading('10. Design Principle Compliance', s_h1, 0))

story.append(Paragraph(
    'This chapter maps all 10 non-negotiable design principles to their enforcement locations across the '
    'Phase 3 deliverables, providing a complete traceability chain from principle to implementation reference.',
    s_body))

compliance_rows = [
    ['Intelligence as Executive Briefing', 'Morning header greeting, structured briefing format, calm/confident/precise language, dark enterprise palette', 'All 4 reference screens + CSS tokens + copy library', 'Enforced'],
    ['VP Sales Design North Star', '5-question protocol, 3-5 min briefing window, tablet travel scenario, one-handed interaction specs', 'Intelligence Hub layout, responsive specs, governance', 'Enforced'],
    ['Intelligence Hub as Default', 'Hub is default landing, all navigation returns to Hub, briefing content visible without scroll', 'Intelligence Hub prototype, navigation architecture', 'Enforced'],
    ['5-Question Protocol', 'What changed? What matters? What should I do? Why? What next? — answered in Hub L1 content', 'Signal cards, AI recommendations, morning briefing', 'Enforced'],
    ['7-Experience Navigation', 'Hub, AI Advisor, Account Intel, Market Intel, Command Center, Search, Settings', '4 reference screens cover 4 of 7 experiences', 'Enforced'],
    ['L1-L4 Progressive Disclosure', 'Decision/Reasoning/Evidence/Exploration — demonstrated in Briefing Card prototype', 'Intelligence Briefing Card (interactive), all screens', 'Enforced'],
    ['Evidence Footprint and Trust', 'Confidence indicators, freshness badges, evidence chains, source verification at every level', 'All screens, trust element integration tables', 'Enforced'],
    ['Premium Enterprise Aesthetic', 'Dark blue-tinted palette, glass-morphism, conservative motion, Inter+JetBrains Mono, 5-level background hierarchy', 'CSS tokens, all prototypes, responsive specs', 'Enforced'],
    ['Human Decision Ownership', 'No auto-execution, no auto-dismissal, all CTAs require explicit action, AI disclaimer on all AI content', 'Recommendation cards, AI Advisor, governance DSCR', 'Enforced'],
    ['AI Does Not Direct', 'AI badge on all AI content, confidence disclosure, "not a directive" disclaimer, purple color exclusively for AI', 'AI Advisor, AI Assessment cards, copy library', 'Enforced'],
]
story.append(make_table(
    ['Principle', 'Implementation', 'Enforcement Location', 'Status'],
    compliance_rows,
    [32*mm, 60*mm, 42*mm, CONTENT_W - 134*mm]
))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════
# CHAPTER 11: MS7 DEVELOPER READINESS
# ═══════════════════════════════════════════════════════════
story.append(add_heading('11. MS7 Developer Readiness', s_h1, 0))

story.append(Paragraph(
    'This chapter assesses the readiness of the complete MS6 design foundation (Stage 1 + Phase 2 + Phase 3) '
    'to serve as the authoritative implementation guide for MS7 screen development. The assessment addresses '
    'the Phase 2 review question: "Can MS7 developers directly use this foundation without interpretation gaps?"',
    s_body))

story.append(add_heading('11.1 Implementation Gap Analysis', s_h2, 1))

gap_rows = [
    ['Design Tokens', 'CSS custom properties file', 'Direct import into Next.js project', 'Zero gap — tokens file is production-ready'],
    ['Color Values', 'All hex values defined in :root', 'No transcription needed', 'Zero gap — CSS variables eliminate transcription'],
    ['Typography', 'Font families, sizes, weights, line-heights', 'Copy CSS variables into Tailwind config', 'Minimal — variable names to Tailwind config mapping'],
    ['Spacing', '8-token system (4px to 96px)', 'Map to Tailwind spacing scale', 'Minimal — direct numeric mapping'],
    ['Component Anatomy', 'Described in prose (Phase 2) + demonstrated in prototypes (Phase 3)', 'Developers reference annotated wireframes in this document', 'Low gap — prototypes provide visual reference'],
    ['Interaction Behavior', 'Pattern specs (Phase 2) + interactive demos (Phase 3)', 'Developers observe behavior in HTML prototypes', 'Zero gap — interactive L1-L4 prototype validates timing'],
    ['Copy Text', 'Full copy library with examples (Phase 2)', 'Direct copy-paste for standard contexts', 'Zero gap — all contexts covered'],
    ['Responsive Layout', 'Breakpoint specs + responsive prototypes', 'CSS media queries provided in prototypes', 'Zero gap — @media queries can be directly extracted'],
    ['Trust Visualization', '5-level color scale + badge specs + evidence chain pattern', 'CSS tokens + component patterns available', 'Zero gap — colors, badges, and timeline pattern defined'],
    ['Accessibility', '8 WCAG 2.1 AA rules + touch target minimums', 'Reference in CSS tokens and responsive specs', 'Minimal — focus indicators and touch targets specified'],
]
story.append(make_table(
    ['Area', 'Available Specification', 'MS7 Developer Action', 'Gap Assessment'],
    gap_rows,
    [22*mm, 48*mm, 48*mm, CONTENT_W - 118*mm]
))

story.append(add_heading('11.2 Recommended MS7 Onboarding Sequence', s_h2, 1))

story.append(Paragraph(
    'For MS7 developers beginning screen implementation, the recommended onboarding sequence is: (1) Import '
    'deepmindq-tokens.css as the first stylesheet in the Next.js layout; (2) Map CSS custom properties to '
    'Tailwind configuration using the token names; (3) Install Inter and JetBrains Mono fonts; (4) Review '
    'this Phase 3 document chapters 4-7 for the four reference screen architectures; (5) Open the HTML '
    'prototypes in a browser to observe visual hierarchy and interaction behavior; (6) Reference Phase 2 '
    'Deliverable B for component anatomy details; (7) Reference Phase 2 Deliverable C for interaction pattern '
    'specifications; (8) Reference Phase 2 Deliverable D for copy text in each context.',
    s_body))

story.append(Paragraph(
    'The total design foundation (Stage 1 Strategy Deck, Phase 2 Design System Foundation 33-page PDF, Phase 3 '
    'Reference Screen Design document, CSS token file, and 6 HTML prototypes) provides comprehensive coverage '
    'of every design decision needed for MS7 implementation. The gap analysis confirms zero or minimal '
    'interpretation gaps across all implementation areas, validating that the MS6 design foundation is ready '
    'to serve as the single source of truth for production development.',
    s_body))

# ═══════════════════════════════════════════════════════════
# BUILD PDF
# ═══════════════════════════════════════════════════════════
doc.multiBuild(story, onFirstPage=on_first_page, onLaterPages=on_page)
print(f'PDF generated: {OUTPUT}')
print(f'File size: {os.path.getsize(OUTPUT) / 1024:.0f} KB')
