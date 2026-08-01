#!/usr/bin/env python3
"""
DeepMindQ Product Experience Transformation Document
Complete UI/UX audit, design philosophy, and redesign roadmap
"""
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch, cm, mm
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY, TA_RIGHT
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether, ListFlowable, ListItem, HRFlowable
)
from reportlab.platypus.frames import Frame
from reportlab.platypus.doctemplate import PageTemplate, BaseDocTemplate
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily
from reportlab.lib.colors import HexColor

# ─── Font Registration ───────────────────────────────────────────────────────
FONT_DIR = '/usr/share/fonts'
pdfmetrics.registerFont(TTFont('Inter', f'{FONT_DIR}/truetype/liberation/LiberationSans-Regular.ttf'))
pdfmetrics.registerFont(TTFont('Inter-Bold', f'{FONT_DIR}/truetype/liberation/LiberationSans-Bold.ttf'))
pdfmetrics.registerFont(TTFont('Inter-Italic', f'{FONT_DIR}/truetype/liberation/LiberationSans-Italic.ttf'))
pdfmetrics.registerFont(TTFont('Inter-BoldItalic', f'{FONT_DIR}/truetype/liberation/LiberationSans-BoldItalic.ttf'))
registerFontFamily('Inter', normal='Inter', bold='Inter-Bold', italic='Inter-Italic', boldItalic='Inter-BoldItalic')

# ─── Palette ───────────────────────────────────────────────────────────────────
PAGE_BG       = HexColor('#f1f1f0')
SECTION_BG    = HexColor('#efefed')
CARD_BG       = HexColor('#f1f0ed')
TABLE_STRIPE  = HexColor('#f2f1f0')
HEADER_FILL   = HexColor('#55503f')
COVER_BLOCK   = HexColor('#665e47')
BORDER        = HexColor('#d8d4c7')
ICON          = HexColor('#7a6a39')
ACCENT        = HexColor('#8b7227')
ACCENT_2      = HexColor('#65a7bd')
TEXT_PRIMARY   = HexColor('#181816')
TEXT_MUTED     = HexColor('#79766f')
SEM_SUCCESS   = HexColor('#49815c')
SEM_WARNING   = HexColor('#b49049')
SEM_ERROR     = HexColor('#a8554e')
SEM_INFO      = HexColor('#4c6680')

# Intelligence-specific palette
INTEL_DARK    = HexColor('#0a0c10')
INTEL_NAVY    = HexColor('#141821')
INTEL_BLUE    = HexColor('#2563EB')
INTEL_CYAN    = HexColor('#06B6D4')
GOLD          = HexColor('#D4AF37')

# ─── Styles ──────────────────────────────────────────────────────────────────
styles = getSampleStyleSheet()

s_h1 = ParagraphStyle('H1', fontName='Inter-Bold', fontSize=28, leading=34,
    textColor=TEXT_PRIMARY, spaceAfter=12, spaceBefore=24, alignment=TA_LEFT)
s_h2 = ParagraphStyle('H2', fontName='Inter-Bold', fontSize=20, leading=26,
    textColor=TEXT_PRIMARY, spaceAfter=8, spaceBefore=18, alignment=TA_LEFT)
s_h3 = ParagraphStyle('H3', fontName='Inter-Bold', fontSize=15, leading=20,
    textColor=HEADER_FILL, spaceAfter=6, spaceBefore=14, alignment=TA_LEFT)
s_h4 = ParagraphStyle('H4', fontName='Inter-Bold', fontSize=12, leading=16,
    textColor=ACCENT, spaceAfter=4, spaceBefore=10, alignment=TA_LEFT)
s_body = ParagraphStyle('Body', fontName='Inter', fontSize=10.5, leading=16,
    textColor=TEXT_PRIMARY, spaceAfter=6, spaceBefore=2, alignment=TA_JUSTIFY)
s_body_small = ParagraphStyle('BodySmall', fontName='Inter', fontSize=9.5, leading=14,
    textColor=TEXT_PRIMARY, spaceAfter=4, spaceBefore=1, alignment=TA_JUSTIFY)
s_bullet = ParagraphStyle('Bullet', fontName='Inter', fontSize=10.5, leading=16,
    textColor=TEXT_PRIMARY, spaceAfter=3, spaceBefore=1, leftIndent=20, bulletIndent=8,
    alignment=TA_LEFT)
s_quote = ParagraphStyle('Quote', fontName='Inter-Italic', fontSize=11, leading=17,
    textColor=HEADER_FILL, spaceAfter=8, spaceBefore=8, leftIndent=24, rightIndent=24,
    borderColor=ACCENT, borderWidth=0, borderPadding=0)
s_caption = ParagraphStyle('Caption', fontName='Inter', fontSize=8.5, leading=12,
    textColor=TEXT_MUTED, spaceAfter=4, spaceBefore=2, alignment=TA_LEFT)
s_toc = ParagraphStyle('TOC', fontName='Inter', fontSize=11, leading=22,
    textColor=TEXT_PRIMARY, spaceAfter=2, alignment=TA_LEFT)
s_toc_h = ParagraphStyle('TOCH', fontName='Inter-Bold', fontSize=12, leading=24,
    textColor=TEXT_PRIMARY, spaceAfter=4, spaceBefore=8, alignment=TA_LEFT)
s_principle_title = ParagraphStyle('PrincipleTitle', fontName='Inter-Bold', fontSize=12, leading=16,
    textColor=ACCENT, spaceAfter=2, spaceBefore=6)
s_principle = ParagraphStyle('Principle', fontName='Inter-Italic', fontSize=11, leading=16,
    textColor=TEXT_PRIMARY, spaceAfter=4, spaceBefore=2, leftIndent=12, borderColor=ACCENT,
    borderWidth=2, borderPadding=8)
s_table_header = ParagraphStyle('TableHeader', fontName='Inter-Bold', fontSize=9, leading=12,
    textColor=colors.white, alignment=TA_CENTER)
s_table_cell = ParagraphStyle('TableCell', fontName='Inter', fontSize=8.5, leading=12,
    textColor=TEXT_PRIMARY, alignment=TA_LEFT, wordWrap='CJK')
s_table_cell_center = ParagraphStyle('TableCellCenter', fontName='Inter', fontSize=8.5, leading=12,
    textColor=TEXT_PRIMARY, alignment=TA_CENTER)
s_footer = ParagraphStyle('Footer', fontName='Inter', fontSize=8, leading=10,
    textColor=TEXT_MUTED, alignment=TA_CENTER)

# ─── Helpers ──────────────────────────────────────────────────────────────────
W, H = A4
M = 1.0 * inch
AW = W - 2 * M  # available width

def h1(text): return Paragraph(text, s_h1)
def h2(text): return Paragraph(text, s_h2)
def h3(text): return Paragraph(text, s_h3)
def h4(text): return Paragraph(text, s_h4)
def body(text): return Paragraph(text, s_body)
def body_s(text): return Paragraph(text, s_body_small)
def bullet(text): return Paragraph(f"<bullet>&bull;</bullet> {text}", s_bullet)
def quote(text): return Paragraph(text, s_quote)
def caption(text): return Paragraph(text, s_caption)
def spacer(h=8): return Spacer(1, h)
def hr(): return HRFlowable(width="100%", thickness=1, color=BORDER, spaceAfter=8, spaceBefore=8)

def principle_block(number, title, statement):
    return [
        Paragraph(f"Principle {number}: {title}", s_principle_title),
        Paragraph(f'"{statement}"', s_principle),
        spacer(4),
    ]

def build_table(headers, rows, col_widths=None):
    """Build a professional table with wrapped cells."""
    header_row = [Paragraph(h, s_table_header) for h in headers]
    data = [header_row]
    for row in rows:
        data.append([Paragraph(str(c), s_table_cell) for c in row])
    
    if col_widths is None:
        n = len(headers)
        col_widths = [AW / n] * n
    
    t = Table(data, colWidths=col_widths, repeatRows=1)
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), HEADER_FILL),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Inter-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 6),
        ('TOPPADDING', (0, 0), (-1, 0), 6),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 1), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 4),
    ]
    # Alternate row shading
    for i in range(1, len(data)):
        if i % 2 == 0:
            style_cmds.append(('BACKGROUND', (0, i), (-1, i), TABLE_STRIPE))
    t.setStyle(TableStyle(style_cmds))
    return t

# ─── Page Templates ──────────────────────────────────────────────────────────
class DocTemplate(BaseDocTemplate):
    def __init__(self, filename, **kwargs):
        BaseDocTemplate.__init__(self, filename, **kwargs)
        frame_body = Frame(M, M, AW, H - 2*M, id='body')
        self.addPageTemplates([
            PageTemplate(id='cover', frames=[frame_body], onPage=self._cover_page),
            PageTemplate(id='body', frames=[frame_body], onPage=self._body_page),
        ])
    
    def _cover_page(self, canvas, doc):
        canvas.saveState()
        # Full-page dark background
        canvas.setFillColor(INTEL_DARK)
        canvas.rect(0, 0, W, H, fill=True, stroke=False)
        # Accent bar at top
        canvas.setFillColor(INTEL_BLUE)
        canvas.rect(0, H - 6, W, 6, fill=True, stroke=False)
        # Gold accent line
        canvas.setStrokeColor(GOLD)
        canvas.setLineWidth(2)
        canvas.line(M, H - 2.6*inch, W - M, H - 2.6*inch)
        canvas.restoreState()
    
    def _body_page(self, canvas, doc):
        canvas.saveState()
        # Subtle top bar
        canvas.setFillColor(HEADER_FILL)
        canvas.rect(0, H - 4, W, 4, fill=True, stroke=False)
        # Footer
        canvas.setFont('Inter', 8)
        canvas.setFillColor(TEXT_MUTED)
        canvas.drawCentredString(W/2, 0.5*inch, f"{doc.page}")
        # Side accent
        canvas.setFillColor(ACCENT)
        canvas.rect(0, H*0.3, 3, H*0.4, fill=True, stroke=False)
        canvas.restoreState()

# ─── Build Document ───────────────────────────────────────────────────────────
OUTPUT = '/home/z/my-project/download/DeepMindQ-Product-Experience-Transformation.pdf'
os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)

doc = DocTemplate(OUTPUT, pagesize=A4, leftMargin=M, rightMargin=M,
                   topMargin=M, bottomMargin=M)
story = []

# ═══════════════════════════════════════════════════════════════════════════════
# COVER PAGE
# ═══════════════════════════════════════════════════════════════════════════════
story.append(Spacer(1, 2.4*inch))
story.append(Paragraph("DeepMindQ", ParagraphStyle('CoverTitle',
    fontName='Inter-Bold', fontSize=42, leading=48, textColor=colors.white)))
story.append(Spacer(1, 8))
story.append(Paragraph("Product Experience Transformation", ParagraphStyle('CoverSub',
    fontName='Inter', fontSize=22, leading=28, textColor=GOLD)))
story.append(Spacer(1, 0.6*inch))
story.append(Paragraph("Complete UI/UX Audit, Design Philosophy, Intelligence-First Architecture,<br/>and Screen-by-Screen Redesign Roadmap",
    ParagraphStyle('CoverDesc', fontName='Inter', fontSize=12, leading=18,
    textColor=HexColor('#8892a8'), alignment=TA_LEFT, leftIndent=4)))
story.append(Spacer(1, 1.8*inch))

cover_meta = ParagraphStyle('CoverMeta', fontName='Inter', fontSize=10, leading=16,
    textColor=HexColor('#8892a8'))
story.append(Paragraph("Enterprise Intelligence OS  |  Revenue Intelligence Platform", cover_meta))
story.append(Paragraph("Version 1.0  |  August 2026  |  Confidential", cover_meta))
story.append(Spacer(1, 0.4*inch))
story.append(Paragraph("77 screens audited  |  12 design principles  |  40+ screens recommended for redesign",
    ParagraphStyle('CoverStats', fontName='Inter-Bold', fontSize=10, leading=16,
    textColor=INTEL_BLUE)))

story.append(PageBreak())
# Switch to body template
from reportlab.platypus.doctemplate import NextPageTemplate
story.insert(-1, NextPageTemplate('body'))

# ═══════════════════════════════════════════════════════════════════════════════
# TABLE OF CONTENTS
# ═══════════════════════════════════════════════════════════════════════════════
story.append(h1("Table of Contents"))
story.append(hr())
toc_items = [
    ("1", "DeepMindQ Experience Philosophy", True),
    ("2", "Current State Audit: Critical Findings", True),
    ("3", "Design DNA: 12 Intelligence-First Principles", True),
    ("4", "New Information Architecture", True),
    ("5", "Ideal User Journeys", True),
    ("6", "Executive First-10-Minute Experience", True),
    ("7", "Screen-by-Screen Audit and Redesign", True),
    ("8", "Component-Level Design Guidance", True),
    ("9", "Interaction Patterns and Micro-UX", True),
    ("10", "Design System Guidelines", True),
    ("11", "Priority Roadmap", True),
]
for num, title, is_major in toc_items:
    if is_major:
        story.append(Paragraph(f"<b>{num}.</b>&nbsp;&nbsp;&nbsp;{title}", s_toc_h))
    else:
        story.append(Paragraph(f"&nbsp;&nbsp;&nbsp;&nbsp;{num}. {title}", s_toc))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 1: EXPERIENCE PHILOSOPHY
# ═══════════════════════════════════════════════════════════════════════════════
story.append(h1("1. DeepMindQ Experience Philosophy"))

story.append(quote('"The CRM stores information. DeepMindQ creates intelligence."'))
story.append(spacer(8))

story.append(body(
    "DeepMindQ is not a CRM. It is not a sales dashboard. It is not an email automation tool. "
    "DeepMindQ is an <b>Enterprise Intelligence Operating System</b> where the core value proposition "
    "comes from transforming raw data into actionable intelligence through a sophisticated pipeline: "
    "<b>Data, Signals, Evidence, Reasoning, Intelligence, Recommendations, and Sales Actions</b>. "
    "The backend architecture already realizes this vision with six composable AI engines, a 30-step "
    "cumulative reasoning engine, a 10-agent orchestrator, evidence-grounded confidence scoring, "
    "multi-provider LLM fallback chains, and a comprehensive governance layer overseeing 61 generation "
    "type configurations across 100+ AI modules."
))

story.append(body(
    "The critical gap is not technology. The technology is deep, differentiated, and production-ready. "
    "The gap is that the <b>user experience does not communicate the power of what has been built</b>. "
    "A VP Sales or CRO opening DeepMindQ today encounters what appears to be a well-built but "
    "conventional SaaS application: a sidebar with navigation items, tables with filter bars, cards "
    "with statistics, and screens organized around database entities rather than intelligence workflows. "
    "The extraordinary AI reasoning happening beneath the surface is visible in only a handful of screens, "
    "while the majority of the 77-screen surface area presents data without context, scores without "
    "explanation, and recommendations without evidence."
))

story.append(body(
    "This transformation document defines a new experience paradigm for DeepMindQ. The goal is not "
    "incremental polish. The goal is to make DeepMindQ <b>feel like the world's most intelligent "
    "revenue intelligence platform</b>, where every screen, every interaction, and every visual element "
    "amplifies the intelligence engines rather than obscuring them. The experience should make a revenue "
    "leader feel clarity, confidence, intelligence, control, discovery, trust, and strategic advantage "
    "from the moment they open the platform."
))

story.append(h2("1.1 The Intelligence-First Mental Model"))

story.append(body(
    "The current DeepMindQ interface is organized around <b>database entities</b>: companies, contacts, "
    "signals, opportunities, leads, sequences, templates, capabilities, knowledge. This is the SaaS "
    "paradigm. A user navigates to a Company screen to see company data. They navigate to Contacts to "
    "see contact data. Each screen is a self-contained CRUD interface with its own filters, tables, "
    "dialogs, and pagination. Intelligence scores appear as columns in these tables, but the "
    "intelligence itself is not the organizing principle."
))

story.append(body(
    "The new mental model must be organized around <b>intelligence questions</b>. A revenue leader does "
    "not think 'I need to open the Company Profile screen.' They think 'I need to understand this "
    "account.' The system should naturally guide them through a journey: Company Discovery leads to "
    "AI Understanding, which reveals Important Signals, which provides Business Context, which surfaces "
    "Stakeholder Intelligence, which identifies Opportunity, which generates Recommended Actions. "
    "The UI should feel like the AI is <b>thinking alongside the user</b>, not like the user is "
    "browsing a database."
))

story.append(h2("1.2 The Emotional Contract"))

story.append(body(
    "Every screen in DeepMindQ must fulfill an emotional contract with the user. The user arrives "
    "seeking answers to fundamental questions: 'What does AI know that I do not know yet? What "
    "opportunities am I missing? Why should I act on this recommendation? What evidence supports "
    "this intelligence? What should I do next?' Each screen must answer at least one of these "
    "questions immediately and prominently. If a screen cannot answer any of these questions, it "
    "should not exist as a standalone destination; it should become a sub-component of a screen that does."
))

story.append(body(
    "The emotional contract has four dimensions. The <b>visual feeling</b> must create clarity and "
    "intelligence, not overwhelm with data. The <b>interaction feeling</b> must guide discovery, not "
    "require navigation expertise. The <b>cognitive feeling</b> must reduce load and increase confidence, "
    "not present choices without context. The <b>trust feeling</b> must show evidence and confidence, "
    "not ask for blind faith in AI outputs. When any of these dimensions fails, the experience fails."
))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 2: CURRENT STATE AUDIT
# ═══════════════════════════════════════════════════════════════════════════════
story.append(h1("2. Current State Audit: Critical Findings"))

story.append(body(
    "A comprehensive audit of all 77 screens, 42+ shared components, 165 API routes, and the entire "
    "frontend architecture reveals significant structural issues that prevent DeepMindQ from communicating "
    "its intelligence value. The audit examined every screen component, every navigation path, every "
    "design pattern, and every AI surfacing mechanism. The findings below represent the most critical "
    "issues that must be addressed in the transformation."
))

story.append(h2("2.1 Architecture-Level Findings"))

story.append(h3("Dual Color System Collision"))
story.append(body(
    "The application has three competing color systems layered on top of each other. System A uses "
    "Tailwind CSS variables with a dark navy palette (background #0a0c10, foreground #e8ecf4). "
    "System B uses iOS-style dark tokens (ios-bg-primary, ios-accent). System C, defined in "
    "enterprise-theme.ts, exports light-mode values including white glass-morphism cards, dark text "
    "(#111827), and light borders. Enterprise components such as AIInsightCard, ErrorState, and "
    "ConfidenceBar render in light mode, while the app shell, sidebar, and command center render in "
    "dark mode. The same page frequently shows both light-mode enterprise components and dark-mode "
    "intelligence components side by side, creating jarring visual breaks that undermine the premium "
    "feel of the product."
))

story.append(h3("Dual Sidebar and Mega-Page Component"))
story.append(body(
    "The root page.tsx is a 769-line monolith containing the entire SPA shell: authentication state "
    "management, login/landing/app routing logic, a full inline sidebar implementation that duplicates "
    "the extracted app-shell.tsx component, header rendering, notification system, screen rendering with "
    "error boundaries, and loading skeletons. The app-shell.tsx component exists but is never rendered. "
    "The inline sidebar in page.tsx does not use the nav-config.ts section structure, creating a "
    "maintenance nightmare where navigation changes must be made in multiple places."
))

story.append(h3("Gold vs. Blue Accent Schizophrenia"))
story.append(body(
    "The codebase uses two competing brand accent colors without resolution. The enterprise-theme.ts "
    "defines gold (#D4AF37) as the primary accent, while globals.css and nav-config use Intel Blue "
    "(#2563EB) as the primary accent. The AI chat button uses gold gradients, while the sidebar active "
    "state uses blue accent. The AnimatedCard default glow is gold, while section headers use gold "
    "gradient but tab bars use gold gradient while newer Intelligence OS components use blue. No "
    "consistent decision has been made on which accent represents the DeepMindQ brand."
))

story.append(h2("2.2 Navigation and Discoverability Crisis"))

story.append(body(
    "The sidebar displays only 7 primary navigation items across 3 sections (Intelligence, Workspaces, "
    "Administration), yet the screen-map registry contains 80+ registered route keys mapping to approximately "
    "42 unique screen components. This means roughly 91% of screens are undiscoverable without already "
    "knowing where to click. The command palette shows a different set of 19 items that do not fully "
    "align with nav-config.ts, including entries like Revenue Intelligence, Stakeholders, Pipeline, "
    "Sequences, and Email Studio that are absent from the sidebar. The breadcrumb component exists but "
    "is completely unused across all screens, leaving users without any way to understand their position "
    "in the navigation hierarchy."
))

story.append(h2("2.3 Screen Proliferation and Duplication"))

story.append(body(
    "The audit identified 9 major groups of duplicated or overlapping screens, resulting in approximately "
    "76 screens serving only 25 actual capabilities. The most egregious duplications include: two "
    "separate command center implementations (a legacy 1210-line version and a newer 899-line "
    "Intelligence OS version, both registered in the screen map); two nearly identical import wizards "
    "(1075 and 1099 lines respectively); three separate capability screens (2053, 874, and 196 lines) "
    "serving the same purpose; and three separate knowledge screens (2382, 497, and 259 lines) with "
    "overlapping functionality. The Company Profile screen at 2450 lines duplicates the Company Detail "
    "screen at 1203 lines. Two audit log screens (525 and 566 lines) are nearly identical."
))

story.append(body(
    "Consolidating these duplications could reduce the screen count from 76 to approximately 35-40 "
    "focused, purposeful screens. This reduction alone would dramatically improve the user experience "
    "by eliminating confusion about which screen to use and reducing maintenance burden."
))

story.append(h2("2.4 AI Intelligence Visibility Gap"))

story.append(body(
    "Despite having 100+ AI modules, 6 composable engines, and sophisticated reasoning capabilities, "
    "the frontend surfaces AI intelligence effectively in only a handful of screens. The AI Chat "
    "sidebar, the most visible AI interface accessed via a floating button, returns plain text responses "
    "with no source attribution, no confidence indicators, and no evidence links. This is the single "
    "most impactful UX gap: the primary AI interaction point gives users no reason to trust its outputs. "
    "The Intelligence Reasoning screen falls back to hardcoded demo data rather than showing the real "
    "30-step engine output. The mind map components are org charts, not knowledge graphs, despite a "
    "knowledge graph API endpoint existing in the backend. Score components (ScoreRing, MiniBar) are "
    "defined locally in company-detail-screen.tsx and not shared, leading to inconsistent score displays "
    "across the application."
))

story.append(h2("2.5 Pure CRUD Screens: The SaaS Problem"))

story.append(body(
    "Fifteen screens are pure CRUD data dumps with no intelligence layer whatsoever. These include "
    "Contacts (1484 lines), Opportunities (760 lines), Sequences (446 lines), Templates (489 lines), "
    "Replies (436 lines), Bounces (325 lines), Segments (414 lines), Tasks (735 lines), Playbooks "
    "(630 lines), Analytics (425 lines), Reports (920 lines), RevOps Dashboard (136 lines), Sales "
    "Execution (144 lines), Enterprise (179 lines), and both Audit screens. These screens follow "
    "traditional SaaS patterns: tables with filter bars, CRUD dialogs, pagination controls. A revenue "
    "leader encountering these screens would conclude they are using another admin tool, not an "
    "intelligence platform. The intelligence scores that do appear on some of these screens are "
    "presented as table columns, stripped of context, evidence, or actionable meaning."
))

story.append(h2("2.6 Dead-End Screens"))

story.append(body(
    "Twelve screens present information but offer no clear next action. Contact Intelligence (101 lines) "
    "shows AI scoring tiers but the contacts are not clickable. AI Reasoning (424 lines) displays "
    "reasoning chains with no way to act on the insights. AI Strategy shows recommendations but provides "
    "no execution pathway. Intelligence Analytics shows metrics without actionable insights. Relationship "
    "Memory, Intelligence Associations, RevOps Dashboard, Sales Execution, Enterprise Readiness, Pipeline "
    "Health, Pipeline Forecast, and Intelligence Scheduler all display data without guiding the user "
    "toward a decision or action. Every screen that presents information without a clear 'what should "
    "I do with this?' pathway is a failed screen in the intelligence-first paradigm."
))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 3: DESIGN DNA
# ═══════════════════════════════════════════════════════════════════════════════
story.append(h1("3. Design DNA: 12 Intelligence-First Principles"))

story.append(body(
    "Before redesigning any screen, we must establish the design principles that will govern every "
    "decision. These principles are not abstract aspirations; they are concrete, testable rules that "
    "every screen, component, and interaction must satisfy. If a design violates a principle, it must "
    "be redesigned. The final question every recommendation must answer: <b>Does this make DeepMindQ "
    "feel like the world's most intelligent revenue intelligence platform, or does it make it look like "
    "another SaaS application?</b>"
))

story.append(spacer(8))

principles = [
    ("Intelligence Before Information",
     "Never show data without meaning. Every number, every chart, every table cell must answer the "
     "user's question: 'So what?' Raw data without interpretation is noise. If a screen shows a score "
     "of 72, it must also show what that score means, why it changed, and what the user should do about it."),
    ("Evidence Before Recommendation",
     "Every AI conclusion must show why. Recommendations without evidence are opinions. Evidence without "
     "confidence is noise. Every intelligence output must include: the conclusion, the evidence chain "
     "supporting it, the confidence level, the source attribution, and the recommended action."),
    ("Decision Before Navigation",
     "Users should reach decisions, not browse screens. The interface should present the next most "
     "important decision at every point. If a user has to navigate to three different screens to make "
     "one decision, the navigation has failed. Screens should collapse intelligence into decision points."),
    ("AI as Strategic Partner",
     "The interface should feel like collaboration with intelligence, not interrogation of a database. "
     "The AI should proactively surface insights, anticipate questions, and guide the user toward "
     "high-value actions. The user should feel smarter after every interaction, not more burdened."),
    ("Progressive Disclosure, Not Information Overload",
     "Show the headline first, the reasoning on demand, the evidence on exploration. The L1-L4 "
     "progressive disclosure framework (Decision, Reasoning, Evidence, Related) must be the default "
     "pattern for all intelligence surfaces. No user should ever see all available information at once."),
    ("Trust Through Transparency",
     "Every intelligence output must show its work. Confidence bars, evidence badges, source links, "
     "reasoning chains, and conflict indicators must be visible by default, not hidden behind expandable "
     "sections. Trust is built through visible reasoning, not blind authority."),
    ("Context Is Everything",
     "No number exists in isolation. A score of 85 means nothing without context: Is it trending up "
     "or down? How does it compare to last week? What does the distribution look like across the "
     "portfolio? Every metric must include trend, comparison, and context."),
    ("Guide, Don't Display",
     "Every screen must answer: 'What should I do next?' If a screen presents information without "
     "guiding action, it has failed. The primary call-to-action on every screen should be the "
     "highest-value next step the AI recommends."),
    ("Reduce Cognitive Load",
     "Every element on screen competes for attention. If an element does not directly contribute to the "
     "user's current decision, it should be hidden, summarized, or moved to a secondary surface. "
     "White space is not wasted space; it is clarity space."),
    ("Consistency Creates Confidence",
     "The same interaction pattern should work everywhere. Scores always display the same way. Evidence "
     "always looks the same. Confidence always uses the same color scale. Inconsistency creates "
     "uncertainty, and uncertainty kills trust in AI."),
    ("One Color Family, One Voice",
     "The visual language must be unified. One primary accent. One confidence scale. One typography "
     "hierarchy. One interaction vocabulary. Visual inconsistency signals engineering inconsistency, "
     "and engineering inconsistency signals product immaturity."),
    ("Exceptional, Not Functional",
     "The bar is not 'does it work?' The bar is 'does it feel exceptional?' Every transition, every "
     "loading state, every empty state, every error state must be designed with the same care as the "
     "primary content. Polish is not a phase; it is a principle."),
]
for i, (title, statement) in enumerate(principles, 1):
    story.extend(principle_block(i, title, statement))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 4: INFORMATION ARCHITECTURE
# ═══════════════════════════════════════════════════════════════════════════════
story.append(h1("4. New Information Architecture"))

story.append(body(
    "The current information architecture is entity-based: screens organized by data type (Companies, "
    "Contacts, Signals, Opportunities, Capabilities, Knowledge). The new architecture must be "
    "intelligence-based: screens organized by the questions a revenue leader needs answered and the "
    "decisions they need to make. The navigation must collapse from 7 sidebar items and 80+ hidden "
    "screens into a focused, hierarchical structure where every destination has clear purpose and "
    "every screen answers a fundamental intelligence question."
))

story.append(h2("4.1 Primary Navigation: 5 Intelligence Zones"))

story.append(body(
    "The new sidebar collapses to 5 primary zones, each representing a fundamental intelligence workflow. "
    "Secondary screens are accessed through intelligent sub-navigation within each zone, not through "
    "an ever-growing sidebar list."
))

nav_table = build_table(
    ["Zone", "Primary Question", "Screens Included"],
    [
        ["Intelligence Cockpit",
         "What is happening right now and what should I focus on?",
         "Command Center (redesigned), Intelligence Feed, Action Center, Notification Center"],
        ["Account Intelligence",
         "Which accounts matter most and why?",
         "Account Portfolio (merged list+ranking), Account Deep Dive (merged detail+profile), "
         "Signal Intelligence, Opportunity Radar"],
        ["Stakeholder Intelligence",
         "Who should I engage and how should I approach them?",
         "Contacts (intelligence-enhanced), Conversation Studio, Deal Coaching, Email Studio"],
        ["Knowledge & Sources",
         "What intelligence do we have and where does it come from?",
         "Knowledge Base, Capabilities, Intelligence Sources, Data Import"],
        ["System & Governance",
         "Is the intelligence engine healthy and configured correctly?",
         "Settings, Analytics, AI Health, Audit Log"],
    ],
    [AW*0.18, AW*0.37, AW*0.45]
)
story.append(nav_table)
story.append(caption("Table 4.1: New five-zone navigation architecture"))

story.append(h2("4.2 Screens to Eliminate (20 screens)"))

story.append(body(
    "The following screens are recommended for elimination through consolidation. Each entry shows "
    "the screen being eliminated and its target consolidation destination."
))

elim_table = build_table(
    ["Screen to Eliminate", "Lines", "Consolidate Into", "Reason"],
    [
        ["AI Command Center (legacy)", "1210", "Command Center (Intelligence OS)", "Newer implementation is superior"],
        ["Company Profile Screen", "2450", "Company Detail Screen", "Complete duplication"],
        ["Revenue Intel Brief (separate)", "845", "Revenue Intelligence (tabs)", "Should be a sub-tab"],
        ["Revenue Intel Opportunities", "74", "Revenue Intelligence (tabs)", "Thin wrapper, no unique value"],
        ["Revenue Intel Recommendations", "555", "Revenue Intelligence (tabs)", "Should be a sub-tab"],
        ["Capability Screen (legacy)", "2053", "Capability Workspace (Intelligence OS)", "Intelligence OS is the standard"],
        ["Capability Library Screen", "874", "Capability Workspace", "Pure CRUD duplication"],
        ["Knowledge Library Screen", "2382", "Knowledge Workspace (Intelligence OS)", "Intelligence OS is the standard"],
        ["Intelligence Knowledge Screen", "497", "Knowledge Workspace", "Overlapping functionality"],
        ["Import Screen (legacy)", "1075", "Intelligence Import (enhanced)", "Near-identical wizard flows"],
        ["Audit Screen (legacy)", "525", "Audit Logs Screen", "Nearly identical"],
        ["Pipeline Health Screen", "310", "Pipeline (tabs)", "Should be a sub-tab"],
        ["Pipeline Forecast Screen", "383", "Pipeline (tabs)", "Should be a sub-tab"],
        ["RevOps Dashboard", "136", "Analytics (section)", "Pure display, no unique value"],
        ["Sales Execution Screen", "144", "Revenue Intelligence", "Pure display, no unique value"],
        ["Enterprise Screen", "179", "System Health", "Internal readiness tracker"],
        ["Demo Experience Screen", "261", "Remove (demo-specific)", "Not relevant to production"],
        ["AI Reasoning Screen (legacy)", "425", "Intelligence Reasoning (enhanced)", "Duplicate reasoning display"],
        ["Contact Intelligence Screen", "101", "Contacts Screen (intelligence tab)", "Dead-end, contacts not clickable"],
        ["Data Health Screen", "839", "Intelligence Sources (health tab)", "AI diagnosis should be actionable"],
    ],
    [AW*0.25, AW*0.07, AW*0.30, AW*0.38]
)
story.append(elim_table)
story.append(caption("Table 4.2: 20 screens recommended for elimination"))

story.append(h2("4.3 Resulting Architecture: ~40 Focused Screens"))

story.append(body(
    "After consolidation, the platform will have approximately 40 focused screens, each with a clear "
    "intelligence purpose. Every screen will have: a defined primary question it answers, clear next-action "
    "guidance, visible AI intelligence layer, consistent loading/empty/error states, and unified design "
    "language. The reduction from 77 to 40 screens does not reduce capability; it concentrates "
    "intelligence into fewer, more powerful surfaces that communicate value immediately."
))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 5: IDEAL USER JOURNEYS
# ═══════════════════════════════════════════════════════════════════════════════
story.append(h1("5. Ideal User Journeys"))

story.append(body(
    "The intelligence-first paradigm requires rethinking how users move through the platform. Instead "
    "of navigating between screens based on entity types, users should be guided through intelligence "
    "workflows based on their intent. The journeys below define the ideal experience for the three "
    "primary user personas: the VP Sales / CRO, the Account Executive, and the Sales Operations Manager."
))

story.append(h2("5.1 Journey 1: Morning Intelligence Review (VP Sales / CRO)"))

journey1_table = build_table(
    ["Step", "Action", "What the User Sees", "Intelligence Layer"],
    [
        ["1", "Opens DeepMindQ",
         "Command Center with AI-generated morning briefing: top 3 accounts needing attention, "
         "2 new high-confidence signals, 1 overdue action, portfolio health score",
         "AI Briefing Engine: 30-step reasoning synthesized into executive summary"],
        ["2", "Reviews first priority account",
         "Account Deep Dive opens with intelligence summary: why this account matters now, "
         "key signals detected, recommended next action with evidence",
         "Progressive Disclosure L1: Decision headline with confidence ring"],
        ["3", "Explores signal detail",
         "Clicks signal card to reveal: evidence chain (3 sources), business impact assessment, "
         "capability match score, conversation starter suggestion",
         "Progressive Disclosure L2-L3: Reasoning + Evidence with source links"],
        ["4", "Reviews recommended action",
         "Action card shows: specific recommendation, confidence level, target stakeholder, "
         "conversation preparation link, one-click 'Accept' or 'Dismiss'",
         "Evidence-Grounded Recommendation with feedback loop"],
        ["5", "Prepares for meeting",
         "Conversation Studio shows: account brief, stakeholder profiles, key talking points, "
         "potential objections, competitive positioning",
         "Conversation Engine: 4-phase briefing generation"],
    ],
    [AW*0.06, AW*0.16, AW*0.42, AW*0.36]
)
story.append(journey1_table)
story.append(caption("Table 5.1: Morning Intelligence Review journey (5 minutes)"))

story.append(h2("5.2 Journey 2: Account Discovery and Prioritization (Account Executive)"))

journey2_table = build_table(
    ["Step", "Action", "What the User Sees", "Intelligence Layer"],
    [
        ["1", "Opens Account Portfolio",
         "Ranked account list with intelligence scores, trend indicators, and priority badges. "
         "AI highlights: '3 accounts upgraded to HOT tier this week'",
         "Account Scoring Engine: 9-dimension scoring with trend analysis"],
        ["2", "Selects new high-priority account",
         "Account Deep Dive reveals: company intelligence brief, detected needs analysis, "
         "capability matches with win probability, key stakeholder map",
         "Company Intelligence + Capability Matching engines"],
        ["3", "Reviews capability match",
         "Capability match card shows: alignment score, specific capabilities relevant to this "
         "account, competitive differentiation points, sales angles",
         "Multi-signal correlation across company + market intelligence"],
        ["4", "Generates outreach",
         "Email Studio opens pre-populated with account context, stakeholder intelligence, "
         "and AI-drafted personalized email with talking points",
         "Email Generation Engine with company + contact + capability context"],
        ["5", "Tracks in Opportunity Radar",
         "Opportunity created with: win probability, key risks, next milestone, coaching tips",
         "Opportunity Intelligence with evidence-grounded win probability"],
    ],
    [AW*0.06, AW*0.16, AW*0.42, AW*0.36]
)
story.append(journey2_table)
story.append(caption("Table 5.2: Account Discovery journey"))

story.append(h2("5.3 Journey 3: Intelligence Health Check (Sales Ops)"))

journey3_table = build_table(
    ["Step", "Action", "What the User Sees", "Intelligence Layer"],
    [
        ["1", "Opens System Health",
         "Dashboard shows: AI engine uptime, processing quality score, data freshness index, "
         "confidence distribution across all intelligence objects",
         "AI Governance Layer: 61 generation type configurations monitored"],
        ["2", "Reviews connector status",
         "Intelligence Sources shows: each connector health, last sync time, data quality score, "
         "error rate, one-click retry for failed connectors",
         "Connector monitoring with actionable remediation"],
        ["3", "Checks intelligence analytics",
         "Analytics shows: intelligence coverage by account, confidence trends over time, "
         "signal detection frequency, recommendation acceptance rate",
         "Feedback Intelligence Loop metrics"],
    ],
    [AW*0.06, AW*0.16, AW*0.42, AW*0.36]
)
story.append(journey3_table)
story.append(caption("Table 5.3: Intelligence Health Check journey"))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 6: EXECUTIVE FIRST-10-MINUTE EXPERIENCE
# ═══════════════════════════════════════════════════════════════════════════════
story.append(h1("6. Executive First-10-Minute Experience"))

story.append(body(
    "The first 10 minutes must demonstrate value. A VP Sales or CRO opening DeepMindQ for the first "
    "time should immediately understand what the platform does, why it matters, and what actions they "
    "should take. The current experience fails this test: the user sees a sidebar with 7 navigation "
    "items, clicks on Dashboard, and encounters a mix of outreach metrics (bounces, queue) and intelligence "
    "statistics without a clear narrative. The redesigned first-10-minute experience follows a "
    "choreographed intelligence journey."
))

story.append(h2("6.1 Minutes 0-2: The Intelligence Landing"))

story.append(body(
    "When the executive opens DeepMindQ, they land on the <b>Command Center</b>, which has been "
    "redesigned as an intelligence cockpit rather than a metrics dashboard. The first screen presents "
    "an AI-generated morning briefing: a narrative paragraph summarizing the most important "
    "intelligence developments across their portfolio. This is not a list of statistics; it is a "
    "briefing that reads like an intelligence analyst's daily summary: 'Three accounts in your portfolio "
    "showed significant signal activity this week. Acme Corp received a $50M funding round (confidence: "
    "92%), suggesting increased buying intent in Q4. Two stakeholders at GlobalTech were promoted to "
    "decision-making roles, creating new entry points for your enterprise solution.'"
))

story.append(body(
    "Below the briefing, three KPI cards show portfolio-level intelligence health: total active signals "
    "this week, number of high-confidence opportunities detected, and pending actions requiring executive "
    "attention. Each card has a subtle trend indicator showing whether the metric is improving or declining. "
    "The executive should feel immediately that this platform understands their business."
))

story.append(h2("6.2 Minutes 2-5: Portfolio Intelligence Overview"))

story.append(body(
    "Below the briefing, the Command Center shows a <b>Priority Account Strip</b>: the top 5 accounts "
    "ranked by intelligence score, each rendered as an intelligence card rather than a table row. Each "
    "card shows: company name, intelligence score with confidence ring, primary signal detected, one-line "
    "AI summary of why this account matters right now, and a 'Deep Dive' call-to-action. The cards are "
    "ordered by urgency, not alphabetically. The executive can scan all five cards in 30 seconds and "
    "understand where their attention is needed most."
))

story.append(body(
    "To the right of the priority strip, a <b>Signal Feed</b> shows the latest intelligence events: "
    "new signals detected, confidence changes, stakeholder movements, trigger events. Each feed item "
    "is a compact intelligence object with a severity indicator, source badge, and one-click drill-down. "
    "The feed is not a chronological log; it is an intelligence prioritized by potential business impact."
))

story.append(h2("6.3 Minutes 5-8: First Deep Dive"))

story.append(body(
    "The executive clicks on the top-priority account card. The <b>Account Deep Dive</b> screen opens "
    "with a choreographed intelligence reveal. The first thing visible is the <b>Intelligence Summary</b>: "
    "a two-paragraph AI synthesis of everything DeepMindQ knows about this account, written in plain "
    "language. Below it, an <b>Intelligence Score Panel</b> shows the three key scores (Intelligence, "
    "Priority, Revenue) with animated confidence rings and trend arrows. Each score is expandable: "
    "clicking reveals the L2 reasoning layer explaining what factors contributed to the score."
))

story.append(body(
    "Below the summary, the <b>Signal Timeline</b> shows detected signals chronologically, each with "
    "confidence bar, evidence badge, and one-line business impact. The <b>Stakeholder Map</b> shows "
    "key contacts with role changes, engagement scores, and decision-making authority indicators. The "
    "<b>Recommended Action</b> card at the bottom presents the AI's specific recommendation: what to do, "
    "who to contact, what to say, with a 'Prepare Conversation' button that generates a full briefing."
))

story.append(h2("6.4 Minutes 8-10: Action and Trust"))

story.append(body(
    "The executive clicks 'Prepare Conversation' and is taken to the <b>Conversation Studio</b>, which "
    "generates a four-part briefing: Account Context, Stakeholder Intelligence, Key Talking Points, and "
    "Recommended Approach. The generation uses the AIProgressTracker to show the four phases completing, "
    "creating anticipation and demonstrating that real intelligence work is happening. The completed "
    "briefing includes copy-to-clipboard conversation starters, objection handling suggestions, and "
    "competitive positioning notes, all grounded in evidence with source links."
))

story.append(body(
    "By minute 10, the executive has: received an AI briefing on their portfolio, identified their "
    "highest-priority account, understood why it matters (with evidence), reviewed the signals and "
    "stakeholders, and generated a fully prepared conversation brief. They have experienced the "
    "complete intelligence pipeline: Data to Signals to Evidence to Reasoning to Intelligence to "
    "Recommendations to Action. They feel intelligent, confident, and in control."
))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 7: SCREEN-BY-SCREEN AUDIT
# ═══════════════════════════════════════════════════════════════════════════════
story.append(h1("7. Screen-by-Screen Audit and Redesign"))

story.append(body(
    "This section provides detailed audit findings and redesign recommendations for every major screen "
    "in the DeepMindQ platform. Screens are organized by their current tier classification, with the "
    "Intelligence OS screens representing the gold standard and all other screens measured against it."
))

story.append(h2("7.1 Tier 1: Intelligence OS Screens (Gold Standard)"))

story.append(h3("7.1.1 Command Center"))
story.append(body(
    "Current State: 899 lines in intelligence-os/command-center.tsx. This is the best screen in the "
    "product. It features an AI-generated morning brief, KPI cards with AnimatedCounter, recent signals "
    "feed with severity badges, top opportunities list with confidence bars, intelligence activity feed, "
    "and system health status. Uses dark Intelligence OS theme with choreographed reveal sequences."
))
story.append(body(
    "Redesign Recommendation: Make this the universal landing screen. Enhance the morning brief to be "
    "more narrative and less statistical. Add the Priority Account Strip described in Section 6. Replace "
    "the legacy AI Command Center entirely. Ensure the intelligence briefing reads like an analyst's "
    "summary, not a metrics dashboard. Add one-click 'Accept' actions on priority items."
))

story.append(h3("7.1.2 Company Workspace"))
story.append(body(
    "Current State: 2032 lines in intelligence-os/company-workspace.tsx. The largest and most sophisticated "
    "component. Implements full intelligence surface with progressive disclosure, confidence color coding, "
    "evidence expansion, human feedback (thumbs up/down), and narrative-first scrolling. This is Palantir-quality "
    "intelligence UX and represents the target design language for all screens."
))
story.append(body(
    "Redesign Recommendation: Decompose the 2032-line monolith into reusable intelligence widgets: "
    "IntelligenceSummaryCard, SignalTimeline, StakeholderMap, RecommendedActionCard, EvidencePanel. "
    "These extracted components become the building blocks for all other intelligence screens. The "
    "decomposition preserves the experience while enabling reuse across the platform."
))

story.append(h3("7.1.3 Progressive Disclosure Component"))
story.append(body(
    "Current State: 360 lines in intelligence-os/progressive-disclosure.tsx. The most important UI "
    "component in the codebase. Implements the L1 (Decision) to L2 (Reasoning) to L3 (Evidence) to "
    "L4 (Exploration) framework with animated transitions, ConfidenceRing SVG, and evidence items with "
    "external links. This pattern must become the universal standard for all intelligence surfaces."
))
story.append(body(
    "Redesign Recommendation: Extract as a first-class design system component. Apply to all list views, "
    "detail screens, and intelligence displays. Currently used only in Intelligence OS workspaces; it "
    "should appear everywhere intelligence is shown, including the account portfolio list and signal feed."
))

story.append(h2("7.2 Tier 2: Intelligence Screens Needing Enhancement"))

story.append(h3("7.2.1 Dashboard Screen"))
story.append(body(
    "Current State: 875 lines. Mixes outreach metrics (bounces, queue depth, email stats) with intelligence "
    "signals. No clear narrative, bloated with operational metrics that belong in System Health. Not an "
    "intelligence experience; it is an operations dashboard."
))
story.append(body(
    "Redesign: Eliminate as a standalone screen. Merge useful intelligence metrics into the Command Center. "
    "Move operational metrics (bounces, queue) to System Health. The 'Dashboard' concept is replaced entirely "
    "by the Intelligence Cockpit paradigm."
))

story.append(h3("7.2.2 Signal Intelligence Screen"))
story.append(body(
    "Current State: 853 lines with comprehensive signal catalog: 18+ signal types, severity color system, "
    "confidence bars per signal, evidence chains, capability matching. Well-built but table-heavy."
))
story.append(body(
    "Redesign: Convert from table-primary to intelligence-feed primary. Show signals as Progressive "
    "Disclosure cards in a feed layout, not rows in a sortable table. Each signal card should expand "
    "to reveal evidence and recommended actions. Add AI prioritization: 'Top 3 signals requiring attention' "
    "highlighted at the top."
))

story.append(h3("7.2.3 Companies Screen"))
story.append(body(
    "Current State: 630 lines. Pure CRUD table with intelligence scores as columns. Scores are visible "
    "but have no context, no explanation, and no intelligence workflow. Users see a number without "
    "understanding what it means or what to do about it."
))
story.append(body(
    "Redesign: Transform into the <b>Account Portfolio</b> screen. Replace table rows with intelligence "
    "cards using Progressive Disclosure. Each card shows: company name, intelligence score with confidence "
    "ring, trend indicator, one-line AI summary, primary signal badge, and 'Deep Dive' CTA. Add an "
    "intelligence-first filter bar: 'Show me accounts with declining scores' or 'Show me accounts "
    "with new high-confidence signals'. The goal is that the portfolio view itself becomes an intelligence "
    "surface, not a data table."
))

story.append(h3("7.2.4 AI Chat Sidebar"))
story.append(body(
    "Current State: 380 lines. Context-aware AI assistant with beautiful slide-out panel, suggested "
    "questions, and markdown formatting. However, responses are plain text with no source attribution, "
    "no confidence indicators, and no evidence links. This is the #1 UX gap in the platform."
))
story.append(body(
    "Redesign: Ground every AI response with evidence. Add source citations, confidence indicators, "
    "and evidence badges to all responses. When the AI says 'Acme Corp is a strong fit for your "
    "enterprise solution', the response must include: evidence badges (LinkedIn, news, filings), "
    "confidence score, and links to the relevant signals. The chat should feel like consulting with "
    "an intelligence analyst who always cites their sources."
))

story.append(h2("7.3 Tier 3: Screens to Merge or Eliminate"))

# Consolidated merge table
merge_table = build_table(
    ["Current Screens (to Merge)", "Target Screen", "Approach"],
    [
        ["Revenue Intelligence + Brief + Opportunities + Recommendations",
         "Revenue Intelligence Hub",
         "Tab-based consolidation: Overview | Opportunities | Recommendations. Each tab shows intelligence with evidence."],
        ["Import + Intelligence Import",
         "Unified Import Wizard",
         "Single 5-step wizard with AI quality analysis."],
        ["Pipeline + Pipeline Health + Pipeline Forecast",
         "Pipeline Intelligence",
         "Tab-based: Funnel | Health | Forecast with AI coaching on each tab."],
        ["Capability + Capability Library + Capability Workspace",
         "Capability Intelligence",
         "Intelligence OS design language with CRUD + AI enrichment."],
        ["Knowledge Library + Intelligence Knowledge + Knowledge Workspace",
         "Knowledge Intelligence",
         "Intelligence OS design with graph view + search + ingestion."],
        ["Audit + Audit Logs",
         "Audit Trail",
         "Single screen with timeline view and filters."],
        ["Company Profile + Company Detail",
         "Account Deep Dive",
         "Merge profile features into enhanced detail screen."],
        ["AI Command Center (legacy) + Command Center (Intelligence OS)",
         "Intelligence Cockpit",
         "Kill legacy. Enhance Intelligence OS version."],
    ],
    [AW*0.35, AW*0.20, AW*0.45]
)
story.append(merge_table)
story.append(caption("Table 7.1: Screen consolidation plan"))

story.append(h2("7.4 Tier 4: CRUD Screens Requiring Intelligence Injection"))

story.append(body(
    "Fifteen pure CRUD screens need intelligence injection to meet the design principles. The approach "
    "for each follows a consistent pattern: replace table-centric layout with intelligence-centric "
    "layout, add Progressive Disclosure to list items, surface AI insights at the top of each screen, "
    "and add clear next-action guidance. The following table summarizes the transformation for each."
))

crud_table = build_table(
    ["Screen", "Current State", "Intelligence Injection", "Priority"],
    [
        ["Contacts", "1484-line table", "Add intelligence summary per contact, AI-suggested outreach, "
         "engagement prediction", "P0"],
        ["Opportunities", "760-line table", "Add win probability, risk factors, coaching tips, "
         "next milestone guidance", "P0"],
        ["Sequences", "446-line CRUD", "Add AI sequence optimization suggestions, engagement "
         "prediction per step", "P2"],
        ["Templates", "489-line CRUD", "Add AI template effectiveness analysis, suggest "
         "improvements based on performance data", "P2"],
        ["Leads", "1238-line kitchen sink", "Extract AIInsightCard to top, simplify to "
         "intelligence-first view, reduce to 3 focused actions", "P1"],
        ["Analytics", "425-line dashboard", "Add AI-generated insights overlay: 'Your signal "
         "detection rate improved 23% this week'", "P1"],
        ["Reports", "920-line reports", "Add AI-generated executive summary to each report, "
         "natural language insights", "P1"],
        ["Tasks", "735-line CRUD", "Add AI task prioritization, auto-suggest tasks based on "
         "intelligence signals", "P2"],
        ["Playbooks", "630-line CRUD", "Add AI effectiveness scoring, suggest playbook "
         "assignments based on account signals", "P2"],
        ["Replies", "436-line data dump", "Add AI classification, sentiment analysis, suggested "
         "response drafts", "P2"],
        ["Bounces", "325-line data dump", "Add AI pattern analysis: '3 emails bounced due to "
         "role changes; 2 contacts have new addresses'", "P2"],
        ["Segments", "414-line CRUD", "Add AI segment suggestions: 'These 15 accounts show "
         "similar buying signals'", "P2"],
        ["Settings", "2308-line mega screen", "Split into 3 focused screens. Add AI configuration "
         "suggestions for ICP and scoring", "P1"],
        ["Audit Logs", "566-line table", "Add AI anomaly detection: flag unusual patterns, "
         "summarize key events", "P2"],
        ["Mind Map", "514-line org chart", "Rebuild as true knowledge graph with intelligence "
         "relationship edges", "P1"],
    ],
    [AW*0.12, AW*0.22, AW*0.42, AW*0.08]
)
story.append(crud_table)
story.append(caption("Table 7.2: Intelligence injection plan for CRUD screens"))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 8: COMPONENT-LEVEL DESIGN GUIDANCE
# ═══════════════════════════════════════════════════════════════════════════════
story.append(h1("8. Component-Level Design Guidance"))

story.append(body(
    "The current component library has excellent building blocks (AIInsightCard, ConfidenceBar, "
    "EvidenceBadge, ProgressiveDisclosure) but suffers from inconsistent usage, duplication across "
    "screens, and a light/dark mode collision. This section defines the target component architecture "
    "that will form the DeepMindQ Design System."
))

story.append(h2("8.1 Core Intelligence Components"))

comp_table = build_table(
    ["Component", "Purpose", "Current Location", "Action"],
    [
        ["IntelligenceCard", "Universal intelligence display unit with progressive disclosure, "
         "confidence ring, evidence badges, and action area",
         "Intelligence OS (inline)", "Extract to design system. Apply everywhere."],
        ["ConfidenceBar", "Animated horizontal confidence indicator (green/amber/red thresholds)",
         "enterprise/ConfidenceBar.tsx", "Standardize to dark mode. Use universally."],
        ["ConfidenceRing", "SVG radial gauge with glow effect",
         "company-detail-screen.tsx (local)", "Extract. Replace all inline score circles."],
        ["EvidenceBadge", "Source-typed badge with icon (11 source types)",
         "enterprise/EvidenceBadge.tsx", "Standardize to dark mode. Add confidence %."],
        ["AIInsightCard", "Signal + evidence + confidence + recommended action",
         "enterprise/AIInsightCard.tsx", "Standardize to dark mode. Use on all CRUD screens."],
        ["ProgressiveDisclosure", "L1-L4 expandable intelligence framework",
         "intelligence-os/progressive-disclosure.tsx", "Extract as design system primitive."],
        ["ScoreTriple", "3-in-1 score display (Intelligence + Priority + Revenue)",
         "shared/design-system.tsx (partial)", "Complete implementation. Dark mode."],
        ["IntelligenceSummary", "2-paragraph AI synthesis narrative block",
         "command-center.tsx (inline)", "Extract as reusable component."],
        ["ActionRecommendation", "AI recommendation with CTA, confidence, evidence",
         "revenue-intel-recommendations (inline)", "Extract. Standardize pattern."],
        ["AIProcessingPhases", "Multi-step AI generation animation",
         "Multiple inline implementations", "Extract single shared component."],
    ],
    [AW*0.14, AW*0.32, AW*0.22, AW*0.32]
)
story.append(comp_table)
story.append(caption("Table 8.1: Core intelligence component library"))

story.append(h2("8.2 Loading, Empty, and Error States"))

story.append(body(
    "The current codebase has four different loading implementations, three error state implementations, "
    "and two different EmptyState components with different APIs and color schemes. This must be unified "
    "into a single consistent system."
))

story.append(h3("Loading States"))
story.append(body(
    "Standardize on a single LoadingState component with three variants: (1) <b>Screen Loading</b>: "
    "full-page skeleton with intelligence-appropriate structure (showing the expected layout shape), "
    "(2) <b>Card Loading</b>: shimmer placeholder for intelligence cards, (3) <b>AI Processing</b>: "
    "multi-phase animation showing what the AI is currently doing ('Analyzing signals...', 'Evaluating "
    "evidence...', 'Generating recommendation...'). The AI Processing variant is critical for the "
    "intelligence experience because it makes the AI's work visible and builds trust through transparency."
))

story.append(h3("Empty States"))
story.append(body(
    "Standardize on a single EmptyState component with intelligence-appropriate messaging. Instead of "
    "'No data available', use 'No intelligence detected yet. Activate data sources to begin generating "
    "intelligence.' Instead of 'No signals found', use 'No active signals for this account. Signals will "
    "appear here when significant changes are detected.' Every empty state must include a clear next "
    "action that guides the user toward generating intelligence."
))

story.append(h3("Error States"))
story.append(body(
    "Standardize on a single ErrorState component that differentiates between transient errors "
    "('Intelligence temporarily unavailable. Retrying...') and persistent errors ('Unable to generate "
    "intelligence for this account. Check data sources.'). Every error state must include a retry "
    "mechanism and a fallback action."
))

story.append(h2("8.3 Dark Mode Unification"))

story.append(body(
    "The entire application must be unified on the dark navy color system defined in the Tailwind CSS "
    "variables (background #0a0c10, foreground #e8ecf4, card #141821). The light-mode enterprise-theme.ts "
    "values must be deprecated and all enterprise components (AIInsightCard, ErrorState, DataTable, "
    "ConfidenceBar, EvidenceBadge) must be converted to dark-mode compatible rendering. This is a "
    "non-negotiable prerequisite for visual consistency."
))

story.append(body(
    "The accent color must be unified on Intel Blue (#2563EB / #3b82f6) as the primary accent, with "
    "confidence colors (emerald for high, amber for medium, red for low) as the only semantic color "
    "system. The gold accent (#D4AF37) should be reserved exclusively for the Intelligence OS brand "
    "identity elements (logo, premium indicators) and not used as a general-purpose accent."
))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 9: INTERACTION PATTERNS
# ═══════════════════════════════════════════════════════════════════════════════
story.append(h1("9. Interaction Patterns and Micro-UX"))

story.append(body(
    "The intelligence-first experience requires a new interaction vocabulary. Traditional SaaS "
    "interactions (click row to open detail page, fill form, submit, return to list) are replaced "
    "by intelligence interactions (expand insight, drill into evidence, accept recommendation, "
    "generate briefing). This section defines the specific interaction patterns that will make "
    "DeepMindQ feel like an intelligence cockpit rather than a data management tool."
))

story.append(h2("9.1 Progressive Disclosure Interaction"))

story.append(body(
    "The primary interaction pattern for all intelligence surfaces. The user sees a collapsed "
    "IntelligenceCard showing: headline, confidence ring, and one-line summary. Hovering reveals a "
    "'Why?' button. Clicking expands to L2: the reasoning layer with evidence chain and factors. "
    "Clicking further expands to L3: the evidence layer with source links, URLs, and data. A final "
    "L4 expansion shows related signals and historical context. At any level, a 'Take Action' "
    "button is visible. The user controls depth. The AI provides content at every depth."
))

story.append(h2("9.2 Intelligence Hover Preview"))

story.append(body(
    "When hovering over any score, badge, or intelligence indicator anywhere in the application, a "
    "tooltip appears showing: the current value, the trend (up/down/stable), the primary contributing "
    "factor, and a 'View Details' link. This applies to scores in tables, confidence bars in feeds, "
    "and badges in lists. The hover preview eliminates the need to navigate away to understand a metric."
))

story.append(h2("9.3 AI Action Accept/Dismiss Flow"))

story.append(body(
    "Every AI recommendation has a visible accept/dismiss workflow. 'Accept' marks the action as "
    "committed, optionally opens the relevant workspace (Conversation Studio, Email Studio, etc.), "
    "and feeds back to the AI's feedback loop for learning. 'Dismiss' requires a reason selection "
    "(Not relevant, Wrong timing, Already handled, Need more evidence) which also feeds the learning "
    "loop. Dismissed items are hidden from the feed but available in a 'Dismissed Intelligence' view "
    "for audit. This creates a human-in-the-loop intelligence refinement cycle."
))

story.append(h2("9.4 Command Palette Intelligence Search"))

story.append(body(
    "The command palette (Cmd+K) should search across all intelligence objects, not just companies "
    "and contacts. Users should be able to search: 'high confidence signals from last week', 'accounts "
    "with declining scores', 'opportunities with win probability above 80%', 'contacts who changed "
    "roles recently'. The command palette becomes an intelligence query interface."
))

story.append(h2("9.5 Breadcrumb Intelligence Context"))

story.append(body(
    "The existing but unused breadcrumb component should be activated on all detail screens. The "
    "breadcrumb should show the intelligence context path, not just the navigation path: "
    "Command Center > Account Portfolio > [Company] > Signal Intelligence > [Signal] > Evidence. "
    "Each breadcrumb segment is clickable, providing a quick way to navigate back up the intelligence "
    "hierarchy."
))

story.append(h2("9.6 Notification Intelligence"))

story.append(body(
    "Notifications should be intelligence-driven, not event-driven. Instead of 'New signal detected', "
    "the notification should say: 'High-confidence funding signal detected for Acme Corp ($50M round, "
    "92% confidence). This suggests increased Q4 buying intent. [View] [Dismiss]'. Every notification "
    "is a micro intelligence briefing with a clear call-to-action."
))

story.append(h2("9.7 Keyboard Navigation"))

story.append(body(
    "Power users should be able to navigate the entire platform via keyboard. J/K to move between "
    "intelligence cards. Enter to expand/collapse progressive disclosure. A to accept a recommendation. "
    "D to dismiss. C to open conversation preparation. These shortcuts should be discoverable via "
    "the command palette and a '?' help overlay."
))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 10: DESIGN SYSTEM GUIDELINES
# ═══════════════════════════════════════════════════════════════════════════════
story.append(h1("10. Design System Guidelines"))

story.append(body(
    "The DeepMindQ Design System must be codified into a set of tokens, components, patterns, and "
    "rules that ensure every screen, every component, and every interaction is consistent and "
    "intelligence-first. This section defines the concrete specifications."
))

story.append(h2("10.1 Color System"))

color_table = build_table(
    ["Role", "Token", "Value", "Usage"],
    [
        ["Background", "--dmq-bg", "#0a0c10", "Page and container backgrounds"],
        ["Surface", "--dmq-surface", "#141821", "Cards, panels, elevated surfaces"],
        ["Surface Elevated", "--dmq-surface-elevated", "#1e2433", "Modals, drawers, popovers"],
        ["Border", "--dmq-border", "#1e2535", "Card borders, dividers, separators"],
        ["Text Primary", "--dmq-text", "#e8ecf4", "Headings, body text, primary content"],
        ["Text Secondary", "--dmq-text-muted", "#8892a8", "Captions, meta text, timestamps"],
        ["Accent Primary", "--dmq-accent", "#3b82f6", "Active states, links, primary CTAs"],
        ["Accent Intel", "--dmq-intel", "#06B6D4", "Intelligence indicators, AI elements"],
        ["Confidence High", "--dmq-success", "#059669", "Scores >= 80, high confidence"],
        ["Confidence Medium", "--dmq-warning", "#D97706", "Scores 60-79, medium confidence"],
        ["Confidence Low", "--dmq-error", "#DC2626", "Scores < 60, low confidence"],
        ["Gold Brand", "--dmq-gold", "#D4AF37", "Logo, premium indicators only"],
    ],
    [AW*0.15, AW*0.20, AW*0.12, AW*0.53]
)
story.append(color_table)
story.append(caption("Table 10.1: DeepMindQ color token system"))

story.append(h2("10.2 Typography Scale"))

typo_table = build_table(
    ["Role", "Size", "Weight", "Line Height", "Usage"],
    [
        ["Display", "28px", "Bold (700)", "1.15", "Page titles, Command Center heading"],
        ["Heading 1", "22px", "Bold (700)", "1.2", "Section titles"],
        ["Heading 2", "18px", "Semibold (600)", "1.25", "Card titles, subsection headings"],
        ["Heading 3", "15px", "Medium (500)", "1.3", "Component titles, tab headers"],
        ["Body", "14px", "Regular (400)", "1.6", "Primary body text, descriptions"],
        ["Body Small", "13px", "Regular (400)", "1.5", "Secondary text, list items"],
        ["Caption", "12px", "Regular (400)", "1.4", "Meta text, timestamps, labels"],
        ["Tabular", "12px", "Medium (500)", "1.3", "Numbers, scores, table data (monospace)"],
    ],
    [AW*0.12, AW*0.10, AW*0.16, AW*0.14, AW*0.48]
)
story.append(typo_table)
story.append(caption("Table 10.2: Typography scale"))

story.append(h2("10.3 Spacing and Layout"))

story.append(body(
    "Base unit: 4px. All spacing values are multiples of 4. Content padding within cards: 16px. "
    "Gap between intelligence cards: 12px. Section spacing: 24px. Page margins: 24px. Sidebar "
    "width: 260px expanded, 64px collapsed. Header height: 64px. Content area maximum width: "
    "1440px (centered on larger screens). These values ensure visual rhythm and consistency."
))

story.append(h2("10.4 Component Variants"))

story.append(body(
    "Every component must support three states: Default, Hover, and Active/Focused. Intelligence cards "
    "must additionally support: Loading (shimmer skeleton), Empty (guidance message with CTA), Error "
    "(retry mechanism), AI Processing (phase animation), and Collapsed/Expanded (progressive disclosure). "
    "All transitions use the existing Framer Motion deceleration curve [0.22, 1, 0.36, 1] for consistency."
))

story.append(h2("10.5 Motion and Animation"))

story.append(body(
    "Animations serve three purposes: (1) <b>Reveal</b>: Content appears with fade-up animations "
    "(150ms stagger per item, max 8 items per group). (2) <b>Feedback</b>: Buttons scale on press, "
    "cards elevate on hover, confidence bars animate from 0 to value on mount (700ms ease-out). "
    "(3) <b>AI Processing</b>: Multi-phase generation animations show current processing step with "
    "connecting lines between completed and pending steps. All animations respect prefers-reduced-motion."
))

story.append(h2("10.6 Accessibility"))

story.append(body(
    "The existing accessibility foundation is strong: WCAG 2.2 focus rings, skip-to-content link, "
    "reduced-motion support, and forced-colors support are all present. The redesign must maintain these "
    "standards and additionally ensure: all intelligence cards are keyboard navigable, confidence values "
    "have aria-valuenow attributes, evidence badges have aria-labels describing source type, and "
    "progressive disclosure expand/collapse is keyboard-driven."
))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 11: PRIORITY ROADMAP
# ═══════════════════════════════════════════════════════════════════════════════
story.append(h1("11. Priority Roadmap"))

story.append(body(
    "The transformation is organized into four phases, each building on the previous. Phase 1 "
    "addresses the most impactful changes: dark mode unification, screen consolidation, and the "
    "Intelligence Cockpit landing experience. Phase 2 brings all CRUD screens up to the intelligence-first "
    "standard. Phase 3 adds the advanced interaction patterns. Phase 4 polishes the experience to "
    "exceptional quality."
))

story.append(h2("11.1 Phase 1: Foundation and Intelligence Cockpit (2 weeks)"))

p1_table = build_table(
    ["#", "Task", "Focus Area", "Effort", "Impact"],
    [
        ["1.1", "Unify color system to dark mode", "Design System", "3 days",
         "Eliminates visual inconsistency across all screens"],
        ["1.2", "Refactor page.tsx to use app-shell.tsx", "Architecture", "2 days",
         "Eliminates 769-line monolith and duplicated sidebar"],
        ["1.3", "Eliminate 20 duplicate screens", "Complexity", "3 days",
         "Reduces from 77 to ~40 focused screens"],
        ["1.4", "Redesign Command Center as Intelligence Cockpit", "Executive", "5 days",
         "Creates the 10-minute executive value experience"],
        ["1.5", "Extract shared design system components", "Design System", "3 days",
         "ScoreRing, ProgressiveDisclosure, AIProcessingPhases extracted"],
        ["1.6", "Ground AI Chat with evidence and confidence", "Intelligence", "3 days",
         "Fixes the #1 UX gap in the platform"],
        ["1.7", "Standardize loading/empty/error states", "Design System", "2 days",
         "Single implementation of each, dark mode compatible"],
    ],
    [AW*0.06, AW*0.34, AW*0.14, AW*0.10, AW*0.36]
)
story.append(p1_table)
story.append(caption("Table 11.1: Phase 1 roadmap"))

story.append(h2("11.2 Phase 2: Intelligence Injection (3 weeks)"))

p2_table = build_table(
    ["#", "Task", "Focus Area", "Effort", "Impact"],
    [
        ["2.1", "Redesign Account Portfolio (Companies screen)", "Intelligence", "5 days",
         "Transforms CRUD table into intelligence surface"],
        ["2.2", "Enhance Account Deep Dive (Company Detail)", "Intelligence", "5 days",
         "Intelligence summary, signal timeline, stakeholder map"],
        ["2.3", "Enhance Signal Intelligence with Progressive Disclosure", "Intelligence", "3 days",
         "Feed-first layout with expandable evidence"],
        ["2.4", "Intelligence injection for Contacts and Opportunities", "Intelligence", "5 days",
         "AI insights, confidence, next-action on CRUD screens"],
        ["2.5", "Intelligence injection for Analytics and Reports", "Intelligence", "3 days",
         "AI-generated insights overlay on traditional dashboards"],
        ["2.6", "Implement 5-zone navigation", "Navigation", "3 days",
         "Collapses 7+ nav items into 5 intelligence zones"],
        ["2.7", "Activate breadcrumbs on all detail screens", "Navigation", "1 day",
         "Intelligence context path navigation"],
    ],
    [AW*0.06, AW*0.34, AW*0.14, AW*0.10, AW*0.36]
)
story.append(p2_table)
story.append(caption("Table 11.2: Phase 2 roadmap"))

story.append(h2("11.3 Phase 3: Advanced Patterns (2 weeks)"))

p3_table = build_table(
    ["#", "Task", "Focus Area", "Effort", "Impact"],
    [
        ["3.1", "Implement Intelligence Hover Preview system", "Interaction", "3 days",
         "Context tooltips on all scores, badges, indicators"],
        ["3.2", "Implement AI Accept/Dismiss feedback loop", "Interaction", "3 days",
         "Human-in-the-loop intelligence refinement"],
        ["3.3", "Intelligence Command Palette search", "Interaction", "3 days",
         "Natural language intelligence queries via Cmd+K"],
        ["3.4", "Notification Intelligence redesign", "Interaction", "2 days",
         "Micro intelligence briefings with CTAs"],
        ["3.5", "Keyboard navigation system", "Accessibility", "2 days",
         "J/K/Enter/A/D/C shortcuts for power users"],
        ["3.6", "Build knowledge graph visualization", "Intelligence", "5 days",
         "True relationship graph replacing org chart"],
    ],
    [AW*0.06, AW*0.34, AW*0.14, AW*0.10, AW*0.36]
)
story.append(p3_table)
story.append(caption("Table 11.3: Phase 3 roadmap"))

story.append(h2("11.4 Phase 4: Polish and Exceptional Quality (1 week)"))

p4_table = build_table(
    ["#", "Task", "Focus Area", "Effort", "Impact"],
    [
        ["4.1", "Animation polish and choreography", "Motion", "3 days",
         "Consistent reveal, feedback, and AI processing animations"],
        ["4.2", "Edge case review: empty states, error states, loading", "States", "2 days",
         "Every state is intelligence-appropriate"],
        ["4.3", "Mobile responsive adaptation", "Responsive", "3 days",
         "Sidebar becomes drawer, cards stack, tables collapse"],
        ["4.4", "Performance optimization for large datasets", "Performance", "2 days",
         "Virtual scrolling, lazy loading for 1000+ accounts"],
        ["4.5", "Demo data curation for compelling experience", "Demo", "3 days",
         "Consistent, realistic demo data across all screens"],
        ["4.6", "Final design system documentation", "Documentation", "2 days",
         "Codified tokens, components, patterns, and rules"],
    ],
    [AW*0.06, AW*0.34, AW*0.14, AW*0.10, AW*0.36]
)
story.append(p4_table)
story.append(caption("Table 11.4: Phase 4 roadmap"))

story.append(h2("11.5 Success Criteria"))

story.append(body(
    "The transformation is complete when a VP Sales or CRO can open DeepMindQ and within 10 minutes: "
    "(1) understand their portfolio's intelligence health, (2) identify their highest-priority account, "
    "(3) understand why that account matters with visible evidence, (4) review the relevant signals and "
    "stakeholders, (5) generate a fully prepared conversation brief, and (6) feel that the platform "
    "is making them smarter, not just showing them data. The final test: does DeepMindQ feel like the "
    "world's most intelligent revenue intelligence platform, or does it look like another SaaS application?"
))

story.append(spacer(20))

# ─── Build ───────────────────────────────────────────────────────────────────
print("Building PDF...")
doc.multiBuild(story)
print(f"PDF generated: {OUTPUT}")

# Check file size
size = os.path.getsize(OUTPUT)
print(f"File size: {size:,} bytes ({size/1024:.1f} KB)")
